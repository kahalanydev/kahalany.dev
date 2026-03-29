const express = require('express');
const { getDb, generateId, logActivity } = require('../db');
const { requireDevAuth, rateLimit } = require('../middleware/auth');

const router = express.Router();

// All dev routes require HMAC-signed auth
router.use(requireDevAuth);
router.use(rateLimit(120, 60000)); // 120 req/min

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
router.post('/tickets/:ticketId/resolve', (req, res) => {
  const db = getDb();
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.ticketId);
  if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

  const { resolution_notes } = req.body;

  // Add resolution as a public comment
  if (resolution_notes) {
    db.prepare('INSERT INTO ticket_comments (id, ticket_id, user_id, body, is_internal) VALUES (?, ?, 0, ?, 0)')
      .run(generateId(), ticket.id, `[Resolved] ${resolution_notes}`);
  }

  // Close the ticket
  db.prepare("UPDATE tickets SET status = 'closed', closed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
    .run(ticket.id);

  logActivity(db, {
    projectId: ticket.project_id, action: 'ticket_resolved',
    entityType: 'ticket', entityId: ticket.id,
    details: { ticket_number: ticket.ticket_number, resolved_by: 'dev_api' }
  });

  res.json({ success: true, data: { message: 'Ticket resolved' } });
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

// ===== TEMPORARY: Seed PCG project (remove after use) =====
router.post('/seed-pcg', (req, res) => {
  const db = getDb();
  let projectId, orgId;

  const existing = db.prepare("SELECT id, org_id FROM projects WHERE slug = 'PassaicCliftonGemach'").get();
  if (existing) {
    const hasMilestones = db.prepare("SELECT COUNT(*) as c FROM milestones WHERE project_id = ?").get(existing.id).c;
    if (hasMilestones > 0) {
      return res.json({ success: false, error: 'PCG project fully set up already', project_id: existing.id });
    }
    projectId = existing.id;
    orgId = existing.org_id;
  } else {
    orgId = generateId();
    db.prepare(`INSERT INTO organizations (id, name, primary_email, created_at, updated_at)
      VALUES (?, 'Passaic Clifton Gemach', '', datetime('now'), datetime('now'))`)
      .run(orgId);

    projectId = generateId();
    db.prepare(`INSERT INTO projects (id, org_id, name, slug, description, status, tech_stack, progress_percent, created_at, updated_at, scaffolded_at)
      VALUES (?, ?, 'Passaic Clifton Gemach', 'PassaicCliftonGemach',
      'Interest-free loan fund dashboard. Syncs financial data from Wave Apps (CSV + GraphQL API). Three role-based portals: Admin, Borrower, and Lender. 26 phases completed.',
      'maintenance',
      'Laravel 12, PHP 8.3, MySQL, Tailwind CSS 4, Chart.js, Vite, Docker/Coolify',
      100, datetime('now'), datetime('now'), datetime('now'))`)
      .run(projectId, orgId);
  }

  // Future enhancement milestones
  const milestones = [
    ['Payment Notifications & Overdue Detection', 'Email notifications for overdue payments + auto-detection system'],
    ['PDF Exports & Receipts', 'PDF export for loan statements + borrower payment receipts'],
    ['Admin Dashboard Charts', 'Add charts and visualizations to the admin dashboard'],
    ['Account Security', 'Password reset flow + two-factor authentication for admin'],
  ];

  const msIds = [];
  milestones.forEach((m, i) => {
    const msId = generateId();
    msIds.push({ id: msId, title: m[0], status: 'upcoming', sort_order: i + 1 });
    db.prepare(`INSERT INTO milestones (id, project_id, title, description, status, sort_order, created_at)
      VALUES (?, ?, ?, ?, 'upcoming', ?, datetime('now'))`)
      .run(msId, projectId, m[0], m[1], i + 1);
  });

  logActivity(db, { projectId, action: 'project_created', entityType: 'project', entityId: projectId,
    details: { created_via: 'seed_endpoint', phases_completed: 26 } });

  res.json({
    success: true,
    data: {
      org_id: orgId,
      project_id: projectId,
      portal_json: {
        project_id: projectId,
        project_name: 'Passaic Clifton Gemach',
        org_name: 'Passaic Clifton Gemach',
        status: 'maintenance',
        progress_percent: 100,
        milestones: msIds.map(m => ({ id: m.id, title: m.title, status: m.status, sort_order: m.sort_order, completion_notes: null })),
        last_synced: new Date().toISOString()
      }
    }
  });
});

module.exports = router;
