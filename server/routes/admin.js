const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/admin/dashboard
router.get('/dashboard', (req, res) => {
  const db = getDb();

  const visitors = {
    today: db.prepare("SELECT COUNT(*) as c FROM visits WHERE created_at >= datetime('now', '-1 day') AND is_bot = 0").get().c,
    week: db.prepare("SELECT COUNT(*) as c FROM visits WHERE created_at >= datetime('now', '-7 days') AND is_bot = 0").get().c,
    month: db.prepare("SELECT COUNT(*) as c FROM visits WHERE created_at >= datetime('now', '-30 days') AND is_bot = 0").get().c,
    total: db.prepare("SELECT COUNT(*) as c FROM visits WHERE is_bot = 0").get().c
  };

  const pageViews = {
    today: db.prepare("SELECT COUNT(*) as c FROM events WHERE event_type = 'pageview' AND created_at >= datetime('now', '-1 day')").get().c,
    week: db.prepare("SELECT COUNT(*) as c FROM events WHERE event_type = 'pageview' AND created_at >= datetime('now', '-7 days')").get().c,
    month: db.prepare("SELECT COUNT(*) as c FROM events WHERE event_type = 'pageview' AND created_at >= datetime('now', '-30 days')").get().c
  };

  // Average time on site (from heartbeat/leave events in last 30 days)
  const avgTime = db.prepare(`
    SELECT AVG(CAST(json_extract(metadata, '$.timeOnPage') AS INTEGER)) as avg_time
    FROM events
    WHERE event_type = 'leave' AND created_at >= datetime('now', '-30 days')
      AND json_extract(metadata, '$.timeOnPage') IS NOT NULL
  `).get();

  // Recent visitors (last 20)
  const recentVisitors = db.prepare(`
    SELECT v.id, v.ip, v.country, v.city, v.browser, v.os, v.device_type, v.referrer, v.is_bot, v.created_at
    FROM visits v
    ORDER BY v.created_at DESC
    LIMIT 20
  `).all();

  // Top referrers (last 30 days)
  const topReferrers = db.prepare(`
    SELECT referrer, COUNT(*) as count
    FROM visits
    WHERE referrer IS NOT NULL AND referrer != '' AND created_at >= datetime('now', '-30 days') AND is_bot = 0
    GROUP BY referrer
    ORDER BY count DESC
    LIMIT 10
  `).all();

  // Active visitors (last 5 minutes based on recent events)
  const activeNow = db.prepare(`
    SELECT COUNT(DISTINCT session_id) as c
    FROM events
    WHERE created_at >= datetime('now', '-5 minutes')
  `).get().c;

  res.json({
    success: true,
    data: {
      visitors,
      pageViews,
      avgTimeOnSite: Math.round(avgTime.avg_time || 0),
      activeNow,
      recentVisitors,
      topReferrers
    }
  });
});

// GET /api/admin/security
router.get('/security', (req, res) => {
  const db = getDb();
  const period = req.query.period || '7';
  const days = parseInt(period) || 7;

  // Suspicious activity
  const suspicious = db.prepare(`
    SELECT * FROM suspicious_activity
    WHERE created_at >= datetime('now', '-${days} days')
    ORDER BY created_at DESC
    LIMIT 100
  `).all();

  // Visitor log with geo
  const visitorLog = db.prepare(`
    SELECT v.*, g.isp
    FROM visits v
    LEFT JOIN geo_cache g ON v.ip = g.ip
    WHERE v.created_at >= datetime('now', '-${days} days')
    ORDER BY v.created_at DESC
    LIMIT 200
  `).all();

  // Bot vs human counts
  const botCount = db.prepare(`
    SELECT COUNT(*) as c FROM visits WHERE is_bot = 1 AND created_at >= datetime('now', '-${days} days')
  `).get().c;
  const humanCount = db.prepare(`
    SELECT COUNT(*) as c FROM visits WHERE is_bot = 0 AND created_at >= datetime('now', '-${days} days')
  `).get().c;

  // Top IPs
  const topIPs = db.prepare(`
    SELECT ip, country, city, COUNT(*) as count, MAX(is_bot) as is_bot
    FROM visits
    WHERE created_at >= datetime('now', '-${days} days')
    GROUP BY ip
    ORDER BY count DESC
    LIMIT 20
  `).all();

  // Suspicious IPs (those with suspicious activity entries)
  const suspiciousIPs = db.prepare(`
    SELECT ip, COUNT(*) as incidents, MAX(severity) as max_severity
    FROM suspicious_activity
    WHERE created_at >= datetime('now', '-${days} days')
    GROUP BY ip
    ORDER BY incidents DESC
    LIMIT 20
  `).all();

  res.json({
    success: true,
    data: { suspicious, visitorLog, botCount, humanCount, topIPs, suspiciousIPs }
  });
});

// GET /api/admin/analytics
router.get('/analytics', (req, res) => {
  const db = getDb();
  const period = req.query.period || '30';
  const days = parseInt(period) || 30;

  // Daily visitor counts
  const dailyVisitors = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM visits
    WHERE created_at >= datetime('now', '-${days} days') AND is_bot = 0
    GROUP BY date(created_at)
    ORDER BY date
  `).all();

  // Section engagement
  const sectionEngagement = db.prepare(`
    SELECT target, COUNT(*) as views
    FROM events
    WHERE event_type = 'section_view' AND created_at >= datetime('now', '-${days} days')
    GROUP BY target
    ORDER BY views DESC
  `).all();

  // Click events
  const clickEvents = db.prepare(`
    SELECT target, COUNT(*) as clicks
    FROM events
    WHERE event_type = 'click' AND created_at >= datetime('now', '-${days} days')
    GROUP BY target
    ORDER BY clicks DESC
    LIMIT 20
  `).all();

  // Referrer breakdown
  const referrers = db.prepare(`
    SELECT
      CASE
        WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
        ELSE referrer
      END as source,
      COUNT(*) as count
    FROM visits
    WHERE created_at >= datetime('now', '-${days} days') AND is_bot = 0
    GROUP BY source
    ORDER BY count DESC
    LIMIT 15
  `).all();

  // Device breakdown
  const devices = db.prepare(`
    SELECT device_type, COUNT(*) as count
    FROM visits
    WHERE created_at >= datetime('now', '-${days} days') AND is_bot = 0
    GROUP BY device_type
    ORDER BY count DESC
  `).all();

  // Browser breakdown
  const browsers = db.prepare(`
    SELECT browser, COUNT(*) as count
    FROM visits
    WHERE created_at >= datetime('now', '-${days} days') AND is_bot = 0
    GROUP BY browser
    ORDER BY count DESC
    LIMIT 10
  `).all();

  // Average scroll depth
  const avgScroll = db.prepare(`
    SELECT AVG(CAST(json_extract(metadata, '$.scrollDepth') AS INTEGER)) as avg_scroll
    FROM events
    WHERE event_type = 'leave' AND created_at >= datetime('now', '-${days} days')
      AND json_extract(metadata, '$.scrollDepth') IS NOT NULL
  `).get();

  // Hourly distribution
  const hourlyDistribution = db.prepare(`
    SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as count
    FROM visits
    WHERE created_at >= datetime('now', '-${days} days') AND is_bot = 0
    GROUP BY hour
    ORDER BY hour
  `).all();

  res.json({
    success: true,
    data: {
      dailyVisitors,
      sectionEngagement,
      clickEvents,
      referrers,
      devices,
      browsers,
      avgScrollDepth: Math.round(avgScroll.avg_scroll || 0),
      hourlyDistribution
    }
  });
});

module.exports = router;
