const express = require('express');
const UAParser = require('ua-parser-js');
const { getDb } = require('../db');
const { isBot, checkSuspicious } = require('../utils/detection');

const router = express.Router();

// Geo IP lookup (async, best-effort)
async function lookupGeo(ip) {
  const db = getDb();

  // Check cache
  const cached = db.prepare('SELECT * FROM geo_cache WHERE ip = ?').get(ip);
  if (cached) return cached;

  // Skip private/local IPs
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
    return null;
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,regionName,lat,lon,isp`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.country) {
      db.prepare(
        'INSERT OR REPLACE INTO geo_cache (ip, country, city, region, lat, lon, isp) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(ip, data.country, data.city, data.regionName, data.lat, data.lon, data.isp);
      return data;
    }
  } catch (e) {
    // Geo lookup is best-effort
  }
  return null;
}

// POST /api/track/visit
router.post('/visit', (req, res) => {
  const db = getDb();
  const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || '';
  const { sessionId, referrer, path, screenWidth, screenHeight, language } = req.body;

  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'sessionId required' });
  }

  // Parse user agent
  const ua = new UAParser(userAgent);
  const browser = ua.getBrowser();
  const os = ua.getOS();
  const device = ua.getDevice();
  const deviceType = device.type || 'desktop';
  const browserName = browser.name ? `${browser.name} ${browser.version || ''}`.trim() : 'Unknown';
  const osName = os.name ? `${os.name} ${os.version || ''}`.trim() : 'Unknown';

  const botFlag = isBot(userAgent) ? 1 : 0;

  const result = db.prepare(`
    INSERT INTO visits (session_id, ip, user_agent, referrer, device_type, browser, os, screen_width, screen_height, language, is_bot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(sessionId, ip, userAgent, referrer || null, deviceType, browserName, osName, screenWidth || null, screenHeight || null, language || null, botFlag);

  // Check for suspicious activity
  checkSuspicious(ip, userAgent, path);

  // Geo lookup in background (don't block response)
  lookupGeo(ip).then(geo => {
    if (geo) {
      db.prepare('UPDATE visits SET country = ?, city = ?, region = ? WHERE id = ?')
        .run(geo.country, geo.city, geo.regionName || geo.region, result.lastInsertRowid);
    }
  }).catch(() => {});

  res.json({ success: true, data: { visitId: result.lastInsertRowid } });
});

// POST /api/track/event
router.post('/event', (req, res) => {
  const db = getDb();
  const { sessionId, visitId, type, target, metadata } = req.body;

  if (!sessionId || !type) {
    return res.status(400).json({ success: false, error: 'sessionId and type required' });
  }

  db.prepare(`
    INSERT INTO events (visit_id, session_id, event_type, target, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(visitId || null, sessionId, type, target || null, metadata ? JSON.stringify(metadata) : null);

  res.json({ success: true });
});

module.exports = router;
