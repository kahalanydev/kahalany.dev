const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'analytics.db');

let wrapper = null;
let saveTimer = null;

// Wrapper that provides better-sqlite3-like API over sql.js
class DbWrapper {
  constructor(sqlDb) {
    this._db = sqlDb;
  }

  exec(sql) {
    this._db.run(sql);
  }

  prepare(sql) {
    const db = this._db;
    return {
      run(...params) {
        db.run(sql, params);
        const idRow = db.exec('SELECT last_insert_rowid() as id');
        const chRow = db.exec('SELECT changes() as c');
        const lastInsertRowid = idRow.length ? idRow[0].values[0][0] : 0;
        const changes = chRow.length ? chRow[0].values[0][0] : 0;
        scheduleSave();
        return { lastInsertRowid, changes };
      },
      get(...params) {
        let stmt;
        try {
          stmt = db.prepare(sql);
          if (params.length) stmt.bind(params);
          if (stmt.step()) {
            return stmt.getAsObject();
          }
          return undefined;
        } finally {
          if (stmt) stmt.free();
        }
      },
      all(...params) {
        let stmt;
        try {
          stmt = db.prepare(sql);
          if (params.length) stmt.bind(params);
          const results = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          return results;
        } finally {
          if (stmt) stmt.free();
        }
      }
    };
  }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveToDisk();
    saveTimer = null;
  }, 1000);
}

function saveToDisk() {
  if (!wrapper) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const data = wrapper._db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('Failed to save database:', e.message);
  }
}

// Must be called once at startup (async)
async function initDb() {
  if (wrapper) return wrapper;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    wrapper = new DbWrapper(new SQL.Database(buffer));
  } else {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    wrapper = new DbWrapper(new SQL.Database());
  }

  initSchema();
  saveToDisk();

  // Save to disk periodically and on exit
  setInterval(saveToDisk, 30000);
  process.on('exit', saveToDisk);
  process.on('SIGINT', () => { saveToDisk(); process.exit(); });
  process.on('SIGTERM', () => { saveToDisk(); process.exit(); });

  return wrapper;
}

function getDb() {
  if (!wrapper) throw new Error('Database not initialized. Call initDb() first.');
  return wrapper;
}

function initSchema() {
  const db = wrapper._db;
  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'admin',
      must_change_password INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      referrer TEXT,
      country TEXT,
      city TEXT,
      region TEXT,
      device_type TEXT,
      browser TEXT,
      os TEXT,
      screen_width INTEGER,
      screen_height INTEGER,
      language TEXT,
      is_bot INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      target TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS suspicious_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      reason TEXT NOT NULL,
      severity TEXT DEFAULT 'low',
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS geo_cache (
      ip TEXT PRIMARY KEY,
      country TEXT,
      city TEXT,
      region TEXT,
      lat REAL,
      lon REAL,
      isp TEXT,
      cached_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_visits_created ON visits(created_at);');
  db.run('CREATE INDEX IF NOT EXISTS idx_visits_ip ON visits(ip);');
  db.run('CREATE INDEX IF NOT EXISTS idx_visits_session ON visits(session_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_events_visit ON events(visit_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);');
  db.run('CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);');
  db.run('CREATE INDEX IF NOT EXISTS idx_suspicious_created ON suspicious_activity(created_at);');
  db.run('CREATE INDEX IF NOT EXISTS idx_suspicious_ip ON suspicious_activity(ip);');

  // ===== PORTAL TABLES =====

  db.run(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logo_path TEXT,
      primary_email TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'planning',
      progress_percent INTEGER DEFAULT 0,
      tech_stack TEXT,
      repo_url TEXT,
      live_url TEXT,
      coolify_uuid TEXT,
      start_date TEXT,
      target_date TEXT,
      completed_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      role TEXT NOT NULL DEFAULT 'member',
      added_at TEXT DEFAULT (datetime('now')),
      UNIQUE(project_id, user_id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'upcoming',
      sort_order INTEGER NOT NULL DEFAULT 0,
      target_date TEXT,
      completed_date TEXT,
      completion_notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      ticket_number INTEGER NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      assigned_to INTEGER REFERENCES users(id),
      type TEXT NOT NULL DEFAULT 'task',
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      closed_at TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ticket_comments (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES tickets(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      is_internal INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ticket_attachments (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES tickets(id),
      uploaded_by INTEGER NOT NULL REFERENCES users(id),
      filename TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      size INTEGER NOT NULL,
      uploaded_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS project_plans (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) UNIQUE,
      content TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      approved_at TEXT,
      approved_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS dev_keys (
      id TEXT PRIMARY KEY,
      key_id TEXT NOT NULL UNIQUE,
      secret TEXT NOT NULL,
      label TEXT,
      revoked INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      last_used_at TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL UNIQUE,
      device_info TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Portal indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(org_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);');
  db.run('CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_project ON tickets(project_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);');
  db.run('CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to);');
  db.run('CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_log(project_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);');
  db.run('CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);');

  // Extend users table for portal (safe: no-op if columns already exist)
  const safeAlter = (sql) => { try { db.run(sql); } catch(e) {} };
  safeAlter('ALTER TABLE users ADD COLUMN org_id TEXT');
  safeAlter('ALTER TABLE users ADD COLUMN login_attempts INTEGER DEFAULT 0');
  safeAlter('ALTER TABLE users ADD COLUMN locked_until TEXT');
  safeAlter('ALTER TABLE users ADD COLUMN last_login_at TEXT');
}

function getJwtSecret() {
  const d = getDb();
  const row = d.prepare('SELECT value FROM config WHERE key = ?').get('jwt_secret');
  if (row) return row.value;

  const secret = crypto.randomBytes(64).toString('hex');
  d.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('jwt_secret', secret);
  return secret;
}

function seedAdmin() {
  const d = getDb();
  const count = d.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count > 0) return;

  const password = crypto.randomBytes(12).toString('base64url');
  const hash = bcrypt.hashSync(password, 12);

  d.prepare(
    'INSERT INTO users (email, password_hash, name, role, must_change_password) VALUES (?, ?, ?, ?, ?)'
  ).run('ohavkahalany@gmail.com', hash, 'Ohav', 'admin', 1);

  console.log('\n========================================');
  console.log('  ADMIN ACCOUNT CREATED');
  console.log('========================================');
  console.log(`  Email:    ohavkahalany@gmail.com`);
  console.log(`  Password: ${password}`);
  console.log('');
  console.log('  You MUST change this password on');
  console.log('  first login at /admin');
  console.log('========================================\n');
}

function generateId() {
  return crypto.randomUUID();
}

function logActivity(db, { projectId, userId, action, entityType, entityId, details, ip }) {
  db.prepare(`
    INSERT INTO activity_log (id, project_id, user_id, action, entity_type, entity_id, details, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(generateId(), projectId || null, userId || null, action, entityType || null, entityId || null,
    details ? JSON.stringify(details) : null, ip || null);
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 80);
}

function nextTicketNumber(db, projectId) {
  const row = db.prepare('SELECT COALESCE(MAX(ticket_number), 0) + 1 as next FROM tickets WHERE project_id = ?').get(projectId);
  return row.next;
}

module.exports = { initDb, getDb, getJwtSecret, seedAdmin, generateId, logActivity, slugify, nextTicketNumber };
