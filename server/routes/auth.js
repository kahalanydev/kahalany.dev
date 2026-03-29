const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDb, getJwtSecret } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password required' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  }

  const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '24h' });

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        must_change_password: !!user.must_change_password
      }
    }
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ success: false, error: 'Current and new password required' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ success: false, error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(new_password, 12);
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime(\'now\') WHERE id = ?')
    .run(hash, req.user.id);

  res.json({ success: true, data: { message: 'Password changed successfully' } });
});

// POST /api/auth/reset-password — self-service reset (prints new password to server logs)
router.post('/reset-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user) {
    // Don't reveal whether the email exists
    return res.json({ success: true, data: { message: 'If that email exists, the password has been reset. Check the server logs.' } });
  }

  const password = crypto.randomBytes(12).toString('base64url');
  const hash = bcrypt.hashSync(password, 12);

  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = datetime(\'now\') WHERE id = ?')
    .run(hash, user.id);

  console.log('\n========================================');
  console.log('  PASSWORD RESET');
  console.log('========================================');
  console.log(`  Email:        ${user.email}`);
  console.log(`  New Password: ${password}`);
  console.log('');
  console.log('  Must change on next login.');
  console.log('========================================\n');

  res.json({ success: true, data: { message: 'If that email exists, the password has been reset. Check the server logs.' } });
});

// POST /api/auth/users/:id/reset — admin resets another user's password
router.post('/users/:id/reset', requireAuth, (req, res) => {
  const db = getDb();
  const targetId = parseInt(req.params.id);
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!target) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  const password = crypto.randomBytes(12).toString('base64url');
  const hash = bcrypt.hashSync(password, 12);

  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = datetime(\'now\') WHERE id = ?')
    .run(hash, targetId);

  res.json({ success: true, data: { temporary_password: password } });
});

// GET /api/auth/users — list admins
router.get('/users', requireAuth, (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, email, name, role, must_change_password, created_at FROM users ORDER BY created_at').all();
  res.json({ success: true, data: { users } });
});

// POST /api/auth/users — create new admin
router.post('/users', requireAuth, (req, res) => {
  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) {
    return res.status(409).json({ success: false, error: 'User with this email already exists' });
  }

  const password = crypto.randomBytes(12).toString('base64url');
  const hash = bcrypt.hashSync(password, 12);

  const result = db.prepare(
    'INSERT INTO users (email, password_hash, name, role, must_change_password) VALUES (?, ?, ?, ?, ?)'
  ).run(email.toLowerCase().trim(), hash, name || null, 'admin', 1);

  res.json({
    success: true,
    data: {
      user: { id: result.lastInsertRowid, email: email.toLowerCase().trim(), name },
      temporary_password: password
    }
  });
});

// DELETE /api/auth/users/:id — remove admin
router.delete('/users/:id', requireAuth, (req, res) => {
  const db = getDb();
  const targetId = parseInt(req.params.id);

  if (targetId === req.user.id) {
    return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
  }

  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count <= 1) {
    return res.status(400).json({ success: false, error: 'Cannot delete the last admin' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  res.json({ success: true, data: { message: 'User deleted' } });
});

module.exports = router;
