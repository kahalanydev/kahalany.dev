const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDb, getJwtSecret } = require('../db');

// ===== JWT Auth =====
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, getJwtSecret());
    const user = getDb().prepare(
      'SELECT id, email, name, role, org_id, must_change_password FROM users WHERE id = ?'
    ).get(decoded.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

// ===== Role Guard =====
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  };
}

// ===== Org Scope (clients see org projects + projects they're individually assigned to) =====
function enforceOrgScope(req, res, next) {
  const projectId = req.params.projectId;
  if (!projectId) return next();

  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ success: false, error: 'Not found' });

  if (req.user.role === 'client') {
    const isOrgMember = req.user.org_id && project.org_id === req.user.org_id;
    const isProjectMember = !!db.prepare(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(projectId, req.user.id);

    if (!isOrgMember && !isProjectMember) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
  }

  req.project = project;
  next();
}

// ===== Dev API Auth (HMAC-signed) =====
function requireDevAuth(req, res, next) {
  const keyId = req.headers['x-dev-key-id'];
  const timestamp = parseInt(req.headers['x-dev-timestamp']);
  const signature = req.headers['x-dev-signature'];

  if (!keyId || !timestamp || !signature) {
    return res.status(401).json({ success: false, error: 'Missing dev auth headers' });
  }

  // Reject stale requests (replay protection: 60s window)
  if (Math.abs(Date.now() / 1000 - timestamp) > 60) {
    return res.status(401).json({ success: false, error: 'Request expired' });
  }

  const db = getDb();
  const key = db.prepare('SELECT * FROM dev_keys WHERE key_id = ? AND revoked = 0').get(keyId);
  if (!key) return res.status(401).json({ success: false, error: 'Invalid key' });

  // Check expiry
  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return res.status(401).json({ success: false, error: 'Key expired' });
  }

  // Verify HMAC signature (use raw body to match client-side hashing exactly)
  const bodyStr = req.rawBody || '';
  const bodyHash = crypto.createHash('sha256').update(bodyStr).digest('hex');
  const payload = `${req.method}\n${req.originalUrl}\n${timestamp}\n${bodyHash}`;
  const expected = crypto.createHmac('sha256', key.secret).update(payload).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
    return res.status(401).json({ success: false, error: 'Invalid signature' });
  }

  // Update last used
  db.prepare('UPDATE dev_keys SET last_used_at = datetime(\'now\') WHERE id = ?').run(key.id);
  req.devKey = key;
  next();
}

// ===== Rate Limiter =====
const rateBuckets = new Map();

function rateLimit(maxRequests, windowMs) {
  return (req, res, next) => {
    const key = `${req.ip}-${req.baseUrl}`;
    const now = Date.now();
    let bucket = rateBuckets.get(key);

    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      rateBuckets.set(key, bucket);
    }

    bucket.count++;
    if (bucket.count > maxRequests) {
      return res.status(429).json({ success: false, error: 'Too many requests' });
    }
    next();
  };
}

// Clean up stale buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (now - bucket.start > 300000) rateBuckets.delete(key);
  }
}, 300000);

module.exports = { requireAuth, requireRole, enforceOrgScope, requireDevAuth, rateLimit };
