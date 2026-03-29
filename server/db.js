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

module.exports = { initDb, getDb, getJwtSecret, seedAdmin };
