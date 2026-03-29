const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getDb, generateId } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads', 'tickets');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Allowed MIME types
const ALLOWED_MIMES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/zip'
]);

// Blocked extensions (defense-in-depth)
const BLOCKED_EXTS = new Set([
  '.exe', '.bat', '.sh', '.cmd', '.com', '.msi', '.scr', '.pif',
  '.js', '.py', '.php', '.rb', '.pl', '.ps1', '.vbs', '.wsf',
  '.dll', '.sys', '.drv'
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES_PER_TICKET = 10;

// Multer storage: UUID-based filenames in ticket subdirectories
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const ticketDir = path.join(UPLOADS_DIR, req.params.ticketId);
    if (!fs.existsSync(ticketDir)) fs.mkdirSync(ticketDir, { recursive: true });
    cb(null, ticketDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const storedName = crypto.randomUUID() + ext;
    cb(null, storedName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTS.has(ext)) {
      return cb(new Error(`File type ${ext} is not allowed`));
    }
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      return cb(new Error(`MIME type ${file.mimetype} is not allowed`));
    }
    cb(null, true);
  }
});

// All routes require auth
router.use(requireAuth);

// POST /api/uploads/tickets/:ticketId — upload file(s) to a ticket
router.post('/tickets/:ticketId', (req, res) => {
  const db = getDb();
  const ticket = db.prepare('SELECT t.*, p.org_id FROM tickets t JOIN projects p ON p.id = t.project_id WHERE t.id = ?')
    .get(req.params.ticketId);

  if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

  // Verify access: admin/staff can always upload; clients must own the ticket's org
  if (req.user.role === 'client' && ticket.org_id !== req.user.org_id) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }

  // Check existing attachment count
  const existingCount = db.prepare('SELECT COUNT(*) as c FROM ticket_attachments WHERE ticket_id = ?')
    .get(ticket.id).c;
  if (existingCount >= MAX_FILES_PER_TICKET) {
    return res.status(400).json({ success: false, error: `Max ${MAX_FILES_PER_TICKET} files per ticket` });
  }

  const uploadHandler = upload.array('files', MAX_FILES_PER_TICKET - existingCount);

  uploadHandler(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'File too large (max 10MB)' });
      }
      return res.status(400).json({ success: false, error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const attachments = req.files.map(file => {
      const id = generateId();
      db.prepare(`
        INSERT INTO ticket_attachments (id, ticket_id, uploaded_by, filename, stored_name, mimetype, size)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, ticket.id, req.user.id, file.originalname, file.filename, file.mimetype, file.size);

      return { id, filename: file.originalname, size: file.size, mimetype: file.mimetype };
    });

    db.prepare("UPDATE tickets SET updated_at = datetime('now') WHERE id = ?").run(ticket.id);

    res.json({ success: true, data: { attachments } });
  });
});

// GET /api/uploads/tickets/:ticketId — list attachments for a ticket
router.get('/tickets/:ticketId', (req, res) => {
  const db = getDb();
  const ticket = db.prepare('SELECT t.*, p.org_id FROM tickets t JOIN projects p ON p.id = t.project_id WHERE t.id = ?')
    .get(req.params.ticketId);

  if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

  if (req.user.role === 'client' && ticket.org_id !== req.user.org_id) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }

  const attachments = db.prepare(`
    SELECT a.id, a.filename, a.mimetype, a.size, a.uploaded_at, u.name as uploaded_by_name
    FROM ticket_attachments a
    LEFT JOIN users u ON u.id = a.uploaded_by
    WHERE a.ticket_id = ?
    ORDER BY a.uploaded_at
  `).all(ticket.id);

  res.json({ success: true, data: { attachments } });
});

// GET /api/uploads/download/:attachmentId — download a file
router.get('/download/:attachmentId', (req, res) => {
  const db = getDb();
  const attachment = db.prepare(`
    SELECT a.*, t.project_id, p.org_id
    FROM ticket_attachments a
    JOIN tickets t ON t.id = a.ticket_id
    JOIN projects p ON p.id = t.project_id
    WHERE a.id = ?
  `).get(req.params.attachmentId);

  if (!attachment) return res.status(404).json({ success: false, error: 'Not found' });

  // Verify access
  if (req.user.role === 'client' && attachment.org_id !== req.user.org_id) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }

  const filePath = path.join(UPLOADS_DIR, attachment.ticket_id, attachment.stored_name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'File not found on disk' });
  }

  // Security: force download, set correct content-type from DB
  res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename.replace(/"/g, '\\"')}"`);
  res.setHeader('Content-Type', attachment.mimetype);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(filePath);
});

// DELETE /api/uploads/:attachmentId — admin/staff or uploader can delete
router.delete('/:attachmentId', (req, res) => {
  const db = getDb();
  const attachment = db.prepare(`
    SELECT a.*, t.project_id, p.org_id
    FROM ticket_attachments a
    JOIN tickets t ON t.id = a.ticket_id
    JOIN projects p ON p.id = t.project_id
    WHERE a.id = ?
  `).get(req.params.attachmentId);

  if (!attachment) return res.status(404).json({ success: false, error: 'Not found' });

  // Admin/staff can always delete; clients can only delete their own uploads
  if (req.user.role === 'client') {
    if (attachment.org_id !== req.user.org_id || attachment.uploaded_by !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
  }

  // Delete file from disk
  const filePath = path.join(UPLOADS_DIR, attachment.ticket_id, attachment.stored_name);
  try { fs.unlinkSync(filePath); } catch {}

  // Delete from DB
  db.prepare('DELETE FROM ticket_attachments WHERE id = ?').run(attachment.id);

  res.json({ success: true, data: { message: 'Attachment deleted' } });
});

module.exports = router;
