const express = require('express');
const { getDb, generateId, logActivity, slugify } = require('../db');
const { requireDevAuth, rateLimit } = require('../middleware/auth');
const { sendTicketResolvedEmail } = require('../utils/email');

const router = express.Router();

// All dev routes require HMAC-signed auth
router.use(requireDevAuth);
router.use(rateLimit(120, 60000)); // 120 req/min

// POST /api/dev/bootstrap — create org + project in one call
router.post('/bootstrap', (req, res) => {
  const db = getDb();
  const { org_name, org_email, project_name, project_description, tech_stack, live_url, start_date, target_date, status } = req.body;

  if (!org_name || !project_name) {
    return res.status(400).json({ success: false, error: 'org_name and project_name required' });
  }

  // Create or find org
  let org = db.prepare('SELECT * FROM organizations WHERE name = ?').get(org_name);
  if (!org) {
    const orgId = generateId();
    db.prepare('INSERT INTO organizations (id, name, primary_email) VALUES (?, ?, ?)').run(orgId, org_name, org_email || 'hello@kahalany.dev');
    org = { id: orgId, name: org_name };
  }

  // Check if project already exists
  const existing = db.prepare('SELECT * FROM projects WHERE name = ? AND org_id = ?').get(project_name, org.id);
  if (existing) {
    return res.json({ success: true, data: { org_id: org.id, project_id: existing.id, message: 'Project already exists' } });
  }

  const projectId = generateId();
  const slug = slugify(project_name);
  db.prepare(`
    INSERT INTO projects (id, org_id, name, slug, description, tech_stack, live_url, start_date, target_date, status, progress_percent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(projectId, org.id, project_name, slug, project_description || null, tech_stack || null,
    live_url || null, start_date || null, target_date || null, status || 'planning');

  logActivity(db, { projectId, action: 'project_created', entityType: 'project', entityId: projectId, details: { name: project_name } });

  res.json({ success: true, data: { org_id: org.id, project_id: projectId } });
});

// ===== SYNC =====

// GET /api/dev/sync — returns everything changed since last sync for a project
router.get('/sync', (req, res) => {
  const db = getDb();
  const { project_id, since } = req.query;

  if (!project_id) return res.status(400).json({ success: false, error: 'project_id required' });

  const project = db.prepare('SELECT id, status, progress_percent FROM projects WHERE id = ?').get(project_id);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

  // Current milestone statuses
  const milestones = db.prepare(
    'SELECT id, title, description, status, sort_order, target_date, completed_date, completion_notes FROM milestones WHERE project_id = ? ORDER BY sort_order'
  ).all(project_id);

  // Since-based filtering for tickets
  const sinceDate = since || '1970-01-01T00:00:00';

  // New/updated tickets since last sync
  const newTickets = db.prepare(`
    SELECT t.id, t.ticket_number, t.type, t.priority, t.status, t.title, t.description,
           t.created_at, t.updated_at, u.name as created_by_name
    FROM tickets t
    LEFT JOIN users u ON u.id = t.created_by
    WHERE t.project_id = ? AND t.created_at > ? AND t.status IN ('open', 'in_progress')
    ORDER BY t.created_at DESC
  `).all(project_id, sinceDate);

  // Attach latest public comment to each new ticket
  const ticketsWithComments = newTickets.map(t => {
    const latestComment = db.prepare(`
      SELECT c.body, u.name as author, c.created_at as date
      FROM ticket_comments c LEFT JOIN users u ON u.id = c.user_id
      WHERE c.ticket_id = ? AND c.is_internal = 0
      ORDER BY c.created_at DESC LIMIT 1
    `).get(t.id);
    return { ...t, latest_comment: latestComment || null };
  });

  // Tickets whose status changed since last sync (but were created before)
  const updatedTickets = db.prepare(`
    SELECT id, ticket_number, status, updated_at
    FROM tickets
    WHERE project_id = ? AND updated_at > ? AND created_at <= ?
    ORDER BY updated_at DESC
  `).all(project_id, sinceDate, sinceDate);

  // Tickets that were closed since last sync
  const closedTickets = db.prepare(`
    SELECT id, ticket_number
    FROM tickets
    WHERE project_id = ? AND closed_at > ?
  `).all(project_id, sinceDate);

  res.json({
    success: true,
    data: {
      project_status: project.status,
      progress_percent: project.progress_percent,
      milestones,
      new_tickets: ticketsWithComments,
      updated_tickets: updatedTickets,
      closed_tickets: closedTickets
    }
  });
});

// ===== PENDING PROJECTS =====

// GET /api/dev/projects/pending — returns approved projects not yet scaffolded
router.get('/projects/pending', (req, res) => {
  const db = getDb();

  const projects = db.prepare(`
    SELECT p.id, p.name, p.slug, p.description, p.tech_stack, p.status,
           o.name as org_name,
           pp.content as plan_content
    FROM projects p
    JOIN organizations o ON o.id = p.org_id
    LEFT JOIN project_plans pp ON pp.project_id = p.id
    WHERE p.status = 'approved' AND p.scaffolded_at IS NULL
    ORDER BY p.updated_at DESC
  `).all();

  // Attach milestones to each project
  const result = projects.map(p => {
    const milestones = db.prepare(
      'SELECT id, title, description, status, sort_order, target_date FROM milestones WHERE project_id = ? ORDER BY sort_order'
    ).all(p.id);
    return { ...p, milestones };
  });

  res.json({ success: true, data: { projects: result } });
});

// POST /api/dev/projects/:projectId/scaffolded — mark project as scaffolded
router.post('/projects/:projectId/scaffolded', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

  db.prepare("UPDATE projects SET scaffolded_at = datetime('now'), status = 'in_progress', updated_at = datetime('now') WHERE id = ?")
    .run(project.id);

  // Set first milestone to in_progress if not already
  const firstMs = db.prepare("SELECT id FROM milestones WHERE project_id = ? AND status = 'upcoming' ORDER BY sort_order LIMIT 1").get(project.id);
  if (firstMs) {
    db.prepare("UPDATE milestones SET status = 'in_progress' WHERE id = ?").run(firstMs.id);
  }

  logActivity(db, {
    projectId: project.id, action: 'project_scaffolded',
    entityType: 'project', entityId: project.id,
    details: { scaffolded_by: 'dev_api' }
  });

  res.json({ success: true, data: { message: 'Project marked as scaffolded' } });
});

// POST /api/dev/projects/:id/update — update project metadata
router.post('/projects/:id/update', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

  const allowed = ['status', 'progress_percent', 'start_date', 'target_date', 'completed_date', 'description', 'tech_stack', 'live_url'];
  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (updates.length === 0) return res.status(400).json({ success: false, error: 'No valid fields to update' });

  updates.push("updated_at = datetime('now')");
  values.push(req.params.id);
  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  if (req.body.status && req.body.status !== project.status) {
    logActivity(db, {
      projectId: req.params.id, action: 'project_status_changed',
      entityType: 'project', entityId: req.params.id,
      details: { old_status: project.status, new_status: req.body.status }
    });
  }

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: { project: updated } });
});

// POST /api/dev/projects/:id/milestones — bulk create/replace milestones
router.post('/projects/:id/milestones', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

  const { milestones, replace } = req.body;
  if (!milestones || !Array.isArray(milestones)) {
    return res.status(400).json({ success: false, error: 'milestones array required' });
  }

  // If replace mode, delete existing milestones first
  if (replace) {
    db.prepare('DELETE FROM milestones WHERE project_id = ?').run(req.params.id);
  }

  const created = [];
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    const id = generateId();
    db.prepare(`
      INSERT INTO milestones (id, project_id, title, description, status, sort_order, target_date, completed_date, completion_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.id, m.title, m.description || null, m.status || 'upcoming',
      m.sort_order ?? i, m.target_date || null, m.completed_date || null, m.completion_notes || null);
    created.push({ id, title: m.title, status: m.status || 'upcoming' });
  }

  // Recalculate progress
  const total = db.prepare("SELECT COUNT(*) as c FROM milestones WHERE project_id = ?").get(req.params.id).c;
  const done = db.prepare("SELECT COUNT(*) as c FROM milestones WHERE project_id = ? AND status IN ('completed', 'skipped')").get(req.params.id).c;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  db.prepare("UPDATE projects SET progress_percent = ?, updated_at = datetime('now') WHERE id = ?").run(progress, req.params.id);

  res.json({ success: true, data: { created, progress_percent: progress } });
});

// ===== PROGRESS =====

// POST /api/dev/progress — push milestone updates
router.post('/progress', (req, res) => {
  const db = getDb();
  const { project_id, updates } = req.body;

  if (!project_id || !updates || !Array.isArray(updates)) {
    return res.status(400).json({ success: false, error: 'project_id and updates array required' });
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

  const validStatuses = ['upcoming', 'in_progress', 'completed', 'skipped'];

  for (const update of updates) {
    if (!update.milestone_id || !update.status) continue;
    if (!validStatuses.includes(update.status)) continue;

    const milestone = db.prepare('SELECT * FROM milestones WHERE id = ? AND project_id = ?')
      .get(update.milestone_id, project_id);
    if (!milestone) continue;

    const setCompleted = update.status === 'completed' ? ", completed_date = datetime('now')" : '';
    const notes = update.completion_notes || null;

    db.prepare(`UPDATE milestones SET status = ?, completion_notes = COALESCE(?, completion_notes)${setCompleted} WHERE id = ?`)
      .run(update.status, notes, update.milestone_id);

    // If completing a milestone, start the next one
    if (update.status === 'completed') {
      const nextMs = db.prepare(
        "SELECT id FROM milestones WHERE project_id = ? AND status = 'upcoming' ORDER BY sort_order LIMIT 1"
      ).get(project_id);
      if (nextMs) {
        db.prepare("UPDATE milestones SET status = 'in_progress' WHERE id = ?").run(nextMs.id);
      }

      logActivity(db, {
        projectId: project_id, action: 'milestone_completed',
        entityType: 'milestone', entityId: update.milestone_id,
        details: { title: milestone.title, notes }
      });
    }
  }

  // Recalculate progress
  const total = db.prepare("SELECT COUNT(*) as c FROM milestones WHERE project_id = ?").get(project_id).c;
  const done = db.prepare("SELECT COUNT(*) as c FROM milestones WHERE project_id = ? AND status IN ('completed', 'skipped')").get(project_id).c;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  db.prepare("UPDATE projects SET progress_percent = ?, updated_at = datetime('now') WHERE id = ?").run(progress, project_id);

  // If all milestones done, suggest project completion
  const allDone = total > 0 && done === total;
  if (allDone && project.status === 'in_progress') {
    db.prepare("UPDATE projects SET status = 'review', updated_at = datetime('now') WHERE id = ?").run(project_id);
  }

  res.json({
    success: true,
    data: {
      progress_percent: progress,
      all_milestones_complete: allDone,
      project_status: allDone ? 'review' : project.status
    }
  });
});

// ===== TICKETS =====

// POST /api/dev/tickets/:ticketId/resolve — mark ticket as completed
// Accepts: { resolution_notes, client_message, project_id }
// - ticketId param can be a UUID (id) or a ticket number (e.g. "1")
// - If using ticket number, project_id must be provided in the body
// - client_message: friendly message the client will see (e.g. "We fixed the crash...")
// - resolution_notes: internal technical notes (fallback if no client_message)
router.post('/tickets/:ticketId/resolve', (req, res) => {
  const db = getDb();
  console.log(`[DEV] Resolve ticket called: ticketId=${req.params.ticketId}, body=`, JSON.stringify(req.body));

  let ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.ticketId);
  // Fall back to ticket_number + project_id lookup
  if (!ticket && req.body.project_id) {
    ticket = db.prepare('SELECT * FROM tickets WHERE ticket_number = ? AND project_id = ?')
      .get(parseInt(req.params.ticketId), req.body.project_id);
    if (ticket) console.log(`[DEV] Found ticket via number fallback: #${ticket.ticket_number} (${ticket.id})`);
  }
  if (!ticket) {
    console.log(`[DEV] Ticket not found for: ${req.params.ticketId}`);
    return res.status(404).json({ success: false, error: 'Ticket not found' });
  }

  console.log(`[DEV] Resolving ticket #${ticket.ticket_number} "${ticket.title}" (current status: ${ticket.status})`);

  const { resolution_notes, client_message } = req.body;
  const publicMessage = client_message || resolution_notes;

  // Add resolution as a public comment visible to client (user_id=0 = system/dev comment)
  if (publicMessage) {
    db.prepare('INSERT INTO ticket_comments (id, ticket_id, user_id, body, is_internal) VALUES (?, ?, 0, ?, 0)')
      .run(generateId(), ticket.id, publicMessage);
  }

  // Also add internal technical notes if both were provided
  if (client_message && resolution_notes) {
    db.prepare('INSERT INTO ticket_comments (id, ticket_id, user_id, body, is_internal) VALUES (?, ?, 0, ?, 1)')
      .run(generateId(), ticket.id, `[Technical] ${resolution_notes}`);
  }

  // Close the ticket
  const result = db.prepare("UPDATE tickets SET status = 'closed', closed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
    .run(ticket.id);
  console.log(`[DEV] Ticket UPDATE result: changes=${result.changes}`);

  // Verify the update took effect
  const updated = db.prepare('SELECT status, closed_at FROM tickets WHERE id = ?').get(ticket.id);
  console.log(`[DEV] Ticket #${ticket.ticket_number} after update: status=${updated.status}, closed_at=${updated.closed_at}`);

  logActivity(db, {
    projectId: ticket.project_id, action: 'ticket_resolved',
    entityType: 'ticket', entityId: ticket.id,
    details: { ticket_number: ticket.ticket_number, resolved_by: 'dev_api' }
  });

  res.json({ success: true, data: { message: 'Ticket resolved', ticket_number: ticket.ticket_number, status: updated.status } });

  // Notify client org members via email (async, non-blocking)
  try {
    const project = db.prepare('SELECT p.name, p.org_id FROM projects p WHERE p.id = ?').get(ticket.project_id);
    if (project && project.org_id) {
      const clientUsers = db.prepare("SELECT email FROM users WHERE org_id = ? AND role = 'client'").all(project.org_id);
      const clientEmails = clientUsers.map(u => u.email).filter(Boolean);
      if (clientEmails.length && publicMessage) {
        sendTicketResolvedEmail({
          clientEmails,
          projectName: project.name,
          ticketNumber: ticket.ticket_number,
          title: ticket.title,
          clientMessage: publicMessage,
          portalUrl: 'https://kahalany.dev/portal'
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[DEV] Failed to send ticket resolved email:', err.message);
  }
});

// GET /api/dev/tickets/:ticketId/full — complete ticket with all comments
router.get('/tickets/:ticketId/full', (req, res) => {
  const db = getDb();
  const ticket = db.prepare(`
    SELECT t.*, u.name as created_by_name
    FROM tickets t LEFT JOIN users u ON u.id = t.created_by
    WHERE t.id = ?
  `).get(req.params.ticketId);
  if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

  const comments = db.prepare(`
    SELECT c.id, c.body, c.is_internal, c.created_at, u.name as user_name, u.role as user_role
    FROM ticket_comments c LEFT JOIN users u ON u.id = c.user_id
    WHERE c.ticket_id = ?
    ORDER BY c.created_at
  `).all(ticket.id);

  res.json({ success: true, data: { ticket, comments } });
});

// ===== ACTIVITY =====

// POST /api/dev/activity — log a development activity
router.post('/activity', (req, res) => {
  const { project_id, action, details } = req.body;

  if (!project_id || !action) {
    return res.status(400).json({ success: false, error: 'project_id and action required' });
  }

  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(project_id);
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

  const allowedActions = [
    'code_pushed', 'deploy_triggered', 'repo_created', 'build_completed',
    'test_passed', 'test_failed', 'dev_note', 'branch_created'
  ];

  if (!allowedActions.includes(action)) {
    return res.status(400).json({ success: false, error: `Invalid action. Allowed: ${allowedActions.join(', ')}` });
  }

  logActivity(db, {
    projectId: project_id,
    action,
    entityType: 'dev',
    details: details || {}
  });

  res.json({ success: true, data: { message: 'Activity logged' } });
});


module.exports = router;
