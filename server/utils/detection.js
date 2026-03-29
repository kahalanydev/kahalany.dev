const { getDb } = require('../db');

const BOT_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /scraper/i, /scan/i,
  /curl/i, /wget/i, /python-requests/i, /httpie/i, /postman/i,
  /go-http-client/i, /java\//i, /perl/i, /ruby/i,
  /nikto/i, /nmap/i, /sqlmap/i, /dirbuster/i, /gobuster/i,
  /masscan/i, /zgrab/i, /censys/i, /shodan/i,
  /semrush/i, /ahrefs/i, /mj12bot/i, /dotbot/i,
  /headlesschrome/i, /phantomjs/i
];

const SCANNER_PATHS = [
  '/wp-admin', '/wp-login', '/wp-content', '/wordpress',
  '/.env', '/.git', '/.htaccess', '/config.php',
  '/phpmyadmin', '/pma', '/adminer',
  '/admin.php', '/login.php', '/shell.php',
  '/xmlrpc.php', '/wp-cron.php',
  '/api/v1', '/graphql', '/swagger',
  '/.well-known/security.txt'
];

// In-memory rate tracker (resets on restart, which is fine)
const requestCounts = new Map();

function isBot(userAgent) {
  if (!userAgent) return true;
  return BOT_PATTERNS.some(p => p.test(userAgent));
}

function isScannerPath(path) {
  return SCANNER_PATHS.some(p => path.toLowerCase().startsWith(p));
}

function trackRequest(ip) {
  const now = Date.now();
  const window = 60000; // 1 minute

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }

  const timestamps = requestCounts.get(ip);
  timestamps.push(now);

  // Clean old entries
  const cutoff = now - window;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }

  return timestamps.length;
}

function checkSuspicious(ip, userAgent, path) {
  const db = getDb();
  const reasons = [];

  // Check rate
  const rate = trackRequest(ip);
  if (rate > 60) {
    reasons.push({ reason: 'High request rate', severity: 'high', details: `${rate} requests/min` });
  } else if (rate > 30) {
    reasons.push({ reason: 'Elevated request rate', severity: 'medium', details: `${rate} requests/min` });
  }

  // Check scanner paths
  if (path && isScannerPath(path)) {
    reasons.push({ reason: 'Scanner path accessed', severity: 'medium', details: path });
  }

  // Check for no user agent (common in automated tools)
  if (!userAgent) {
    reasons.push({ reason: 'Empty user agent', severity: 'low', details: 'No UA string' });
  }

  // Log suspicious activity
  for (const r of reasons) {
    db.prepare(
      'INSERT INTO suspicious_activity (ip, reason, severity, details) VALUES (?, ?, ?, ?)'
    ).run(ip, r.reason, r.severity, r.details);
  }

  return reasons;
}

// Clean up old rate tracking entries periodically
setInterval(() => {
  const cutoff = Date.now() - 120000;
  for (const [ip, timestamps] of requestCounts) {
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }
    if (timestamps.length === 0) {
      requestCounts.delete(ip);
    }
  }
}, 60000);

module.exports = { isBot, isScannerPath, checkSuspicious, trackRequest };
