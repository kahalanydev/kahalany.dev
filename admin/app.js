/* Admin Panel SPA — kahalany.dev */
(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const app = document.getElementById('app');

  // ===== STATE =====
  const state = {
    token: localStorage.getItem('admin_token'),
    user: null,
    page: 'dashboard',
    sidebarOpen: false
  };

  // ===== API =====
  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
    const res = await fetch(`/api${path}`, { ...opts, headers });
    if (res.status === 401) {
      state.token = null;
      state.user = null;
      localStorage.removeItem('admin_token');
      render();
      throw new Error('Unauthorized');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // ===== AUTH =====
  async function checkAuth() {
    if (!state.token) return false;
    try {
      const res = await api('/auth/me');
      state.user = res.data.user;
      return true;
    } catch {
      return false;
    }
  }

  async function login(email, password) {
    const res = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    state.token = res.data.token;
    state.user = res.data.user;
    localStorage.setItem('admin_token', state.token);
    render();
  }

  async function changePassword(current, newPass) {
    await api('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: current, new_password: newPass })
    });
    state.user.must_change_password = 0;
    render();
  }

  function logout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('admin_token');
    render();
  }

  // ===== HELPERS =====
  function timeAgo(dateStr) {
    const seconds = Math.floor((new Date() - new Date(dateStr + 'Z')) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function truncate(str, len = 40) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  function severityBadge(severity) {
    const map = { high: 'badge-red', medium: 'badge-yellow', low: 'badge-gray' };
    return `<span class="badge ${map[severity] || 'badge-gray'}">${severity}</span>`;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // ===== MARKDOWN RENDERER =====
  function renderMarkdown(text) {
    if (!text) return '';
    let html = text;
    // Code blocks (``` ... ```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code style="background:var(--surface-3);padding:2px 6px;border-radius:3px;font-size:12px">$1</code>');
    // Headings
    html = html.replace(/^#### (.+)$/gm, '<h4 style="font-size:14px;margin:16px 0 8px;color:var(--text)">$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:15px;margin:18px 0 8px;color:var(--text)">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:17px;margin:20px 0 10px;color:var(--text)">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:20px;margin:24px 0 12px;color:var(--text)">$1</h1>');
    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text)">$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Horizontal rule
    html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:16px 0">');
    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li style="margin:4px 0;margin-left:20px;color:var(--text-secondary)">$1</li>');
    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin:4px 0;margin-left:20px;list-style:decimal;color:var(--text-secondary)">$1</li>');
    // Checkboxes
    html = html.replace(/\[x\]/g, '<span style="color:var(--success)">&#9745;</span>');
    html = html.replace(/\[ \]/g, '<span style="color:var(--text-dim)">&#9744;</span>');
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:var(--accent)">$1</a>');
    // Line breaks (double newline = paragraph)
    html = html.replace(/\n\n/g, '<br><br>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  // ===== CHART HELPERS =====
  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#a1a1aa', font: { size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#a1a1aa', font: { size: 11 } },
        beginAtZero: true
      }
    }
  };

  let charts = {};
  function destroyCharts() {
    Object.values(charts).forEach(c => c.destroy());
    charts = {};
  }

  // ===== RENDER: LOGIN =====
  async function renderLogin() {
    // Check if Google OAuth is enabled
    let googleEnabled = false;
    try {
      const oauthStatus = await fetch('/api/auth/oauth/status').then(r => r.json());
      googleEnabled = oauthStatus.data?.google_enabled;
    } catch {}

    // Check for OAuth error in URL hash
    const hashParams = new URLSearchParams(window.location.hash.replace('#/login', '').replace('?', ''));
    const oauthError = hashParams.get('error');
    const errorMessages = {
      oauth_denied: 'Google sign-in was cancelled',
      invalid_state: 'Invalid OAuth state. Please try again',
      use_portal: 'Client accounts should use the client portal',
      server_error: 'Server error during sign-in. Please try again'
    };

    app.innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <div class="login-logo"><span class="accent">{</span> kahalany.dev <span class="accent">}</span></div>
          <h2 class="login-title">Admin Login</h2>
          <div id="loginMsg">${oauthError ? `<div class="alert alert-error">${escapeHtml(errorMessages[oauthError] || 'Sign-in failed')}</div>` : ''}</div>
          ${googleEnabled ? `
            <a href="/api/auth/google?target=admin" class="btn btn-google" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:12px;margin-bottom:16px;background:#fff;color:#333;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;font-weight:500;text-decoration:none;cursor:pointer;transition:background 0.2s">
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Sign in with Google
            </a>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;color:var(--text-dim);font-size:13px"><div style="flex:1;height:1px;background:var(--border)"></div>or<div style="flex:1;height:1px;background:var(--border)"></div></div>
          ` : ''}
          <form id="loginForm">
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="loginEmail" placeholder="you@example.com" required autocomplete="email">
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" id="loginPassword" placeholder="Enter password" required autocomplete="current-password">
            </div>
            <button type="submit" class="btn btn-primary">Sign In</button>
          </form>
          <div style="text-align:center;margin-top:16px">
            <a href="#" id="forgotLink" style="color:var(--text-secondary);font-size:13px;text-decoration:underline">Forgot password?</a>
          </div>
          <div id="resetSection" style="display:none;margin-top:20px;padding-top:20px;border-top:1px solid var(--border)">
            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Enter your email to reset your password. The new password will appear in the server logs.</p>
            <form id="resetForm" style="display:flex;gap:8px">
              <input type="email" id="resetEmail" placeholder="Your admin email" required style="flex:1;padding:10px 14px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:14px">
              <button type="submit" class="btn btn-secondary" style="width:auto;white-space:nowrap">Reset</button>
            </form>
            <div id="resetMsg" style="margin-top:10px"></div>
          </div>
        </div>
      </div>
    `;
    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type="submit"]', e.target);
      btn.textContent = 'Signing in...';
      btn.disabled = true;
      try {
        await login($('#loginEmail').value, $('#loginPassword').value);
      } catch (err) {
        $('#loginMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        btn.textContent = 'Sign In';
        btn.disabled = false;
      }
    });
    $('#forgotLink').addEventListener('click', (e) => {
      e.preventDefault();
      const section = $('#resetSection');
      section.style.display = section.style.display === 'none' ? 'block' : 'none';
    });
    $('#resetForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type="submit"]', e.target);
      btn.textContent = 'Resetting...';
      btn.disabled = true;
      try {
        const res = await api('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email: $('#resetEmail').value })
        });
        $('#resetMsg').innerHTML = `<div class="alert alert-success">${escapeHtml(res.data.message)}</div>`;
      } catch (err) {
        $('#resetMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
      }
      btn.textContent = 'Reset';
      btn.disabled = false;
    });
  }

  // ===== RENDER: CHANGE PASSWORD =====
  function renderChangePassword() {
    app.innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <div class="login-logo"><span class="accent">{</span> kahalany.dev <span class="accent">}</span></div>
          <h2 class="login-title">Change Password</h2>
          <div class="alert alert-warning">You must change your password before continuing.</div>
          <div id="cpError"></div>
          <form id="cpForm">
            <div class="form-group">
              <label>Current Password</label>
              <input type="password" id="cpCurrent" required autocomplete="current-password">
            </div>
            <div class="form-group">
              <label>New Password</label>
              <input type="password" id="cpNew" placeholder="Min 8 characters" required minlength="8" autocomplete="new-password">
            </div>
            <div class="form-group">
              <label>Confirm New Password</label>
              <input type="password" id="cpConfirm" required minlength="8" autocomplete="new-password">
            </div>
            <button type="submit" class="btn btn-primary">Change Password</button>
          </form>
        </div>
      </div>
    `;
    $('#cpForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPass = $('#cpNew').value;
      if (newPass !== $('#cpConfirm').value) {
        $('#cpError').innerHTML = `<div class="alert alert-error">Passwords don't match</div>`;
        return;
      }
      const btn = $('button[type="submit"]', e.target);
      btn.textContent = 'Changing...';
      btn.disabled = true;
      try {
        await changePassword($('#cpCurrent').value, newPass);
      } catch (err) {
        $('#cpError').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        btn.textContent = 'Change Password';
        btn.disabled = false;
      }
    });
  }

  // ===== RENDER: LAYOUT =====
  function renderLayout(content) {
    const navItems = [
      { id: 'dashboard', icon: '\u25A3', label: 'Dashboard' },
      { id: 'projects', icon: '\u{1F4CB}', label: 'Projects' },
      { id: 'clients', icon: '\u{1F465}', label: 'Clients' },
      { id: 'security', icon: '\u26A0', label: 'Security' },
      { id: 'analytics', icon: '\u25CE', label: 'Analytics' },
      { id: 'settings', icon: '\u2699', label: 'Settings' },
    ];
    app.innerHTML = `
      <button class="mobile-toggle" id="mobileToggle">\u2630</button>
      <div class="layout">
        <aside class="sidebar ${state.sidebarOpen ? 'open' : ''}" id="sidebar">
          <div class="sidebar-logo"><span class="accent">{</span> kahalany.dev <span class="accent">}</span></div>
          <div class="sidebar-label">Admin Panel</div>
          <ul class="sidebar-nav">
            ${navItems.map(n => `
              <li><a href="#/${n.id}" class="${state.page === n.id ? 'active' : ''}" data-page="${n.id}">
                <span class="icon">${n.icon}</span> ${n.label}
              </a></li>
            `).join('')}
          </ul>
          <div class="sidebar-bottom">
            <div class="sidebar-user">${escapeHtml(state.user?.email)}</div>
            <button class="btn btn-secondary btn-sm" id="logoutBtn" style="width:100%">Logout</button>
          </div>
        </aside>
        <main class="main" id="mainContent">${content}</main>
      </div>
    `;
    // Nav handlers
    $$('.sidebar-nav a').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      state.page = a.dataset.page;
      state.sidebarOpen = false;
      window.location.hash = `/${state.page}`;
      render();
    }));
    $('#logoutBtn').addEventListener('click', logout);
    const toggle = $('#mobileToggle');
    if (toggle) toggle.addEventListener('click', () => {
      state.sidebarOpen = !state.sidebarOpen;
      $('#sidebar').classList.toggle('open', state.sidebarOpen);
    });
  }

  // ===== RENDER: DASHBOARD =====
  async function renderDashboard() {
    renderLayout(`
      <div class="page-header">
        <h1>Dashboard</h1>
        <p>Overview of your site activity</p>
      </div>
      <div class="loading"><div class="spinner"></div> Loading data...</div>
    `);

    try {
      const res = await api('/admin/dashboard');
      const d = res.data;

      $('#mainContent').innerHTML = `
        <div class="page-header">
          <h1>Dashboard</h1>
          <p>Overview of your site activity</p>
        </div>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Active Now</div>
            <div class="metric-value accent">${d.activeNow}</div>
            <div class="metric-sub">visitors in last 5 min</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Today</div>
            <div class="metric-value">${d.visitors.today}</div>
            <div class="metric-sub">visitors today</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">This Week</div>
            <div class="metric-value">${d.visitors.week}</div>
            <div class="metric-sub">visitors this week</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">This Month</div>
            <div class="metric-value">${d.visitors.month}</div>
            <div class="metric-sub">visitors this month</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Avg Time on Site</div>
            <div class="metric-value info">${d.avgTimeOnSite}s</div>
            <div class="metric-sub">average session</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Total Visitors</div>
            <div class="metric-value">${d.visitors.total}</div>
            <div class="metric-sub">all time (humans)</div>
          </div>
        </div>
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><span class="card-title">Recent Visitors</span></div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>IP</th><th>Location</th><th>Browser</th><th>Device</th><th>When</th></tr></thead>
                <tbody>
                  ${d.recentVisitors.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--text-dim)">No visitors yet</td></tr>' :
                    d.recentVisitors.map(v => `<tr>
                      <td><span class="mono">${escapeHtml(v.ip)}</span> ${v.is_bot ? '<span class="badge badge-yellow">bot</span>' : ''}</td>
                      <td>${escapeHtml(v.country ? `${v.city || ''}, ${v.country}` : 'Unknown')}</td>
                      <td>${escapeHtml(truncate(v.browser, 20))}</td>
                      <td>${escapeHtml(v.device_type)}</td>
                      <td>${timeAgo(v.created_at)}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">Top Referrers</span></div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Source</th><th>Visits</th></tr></thead>
                <tbody>
                  ${d.topReferrers.length === 0 ? '<tr><td colspan="2" style="text-align:center;color:var(--text-dim)">No referrer data yet</td></tr>' :
                    d.topReferrers.map(r => `<tr>
                      <td>${escapeHtml(truncate(r.referrer, 50))}</td>
                      <td><strong>${r.count}</strong></td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">Failed to load dashboard: ${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: SECURITY =====
  async function renderSecurity() {
    renderLayout(`
      <div class="page-header">
        <h1>Security</h1>
        <p>Monitor visitor activity and suspicious behavior</p>
      </div>
      <div class="loading"><div class="spinner"></div> Loading security data...</div>
    `);

    try {
      const res = await api('/admin/security?period=7');
      const d = res.data;

      const suspiciousHigh = d.suspicious.filter(s => s.severity === 'high').length;

      $('#mainContent').innerHTML = `
        <div class="page-header">
          <h1>Security</h1>
          <p>Monitor visitor activity and suspicious behavior</p>
        </div>
        ${suspiciousHigh > 0 ? `<div class="alert alert-error">${suspiciousHigh} high severity alert(s) in the last 7 days</div>` : ''}
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Human Visitors</div>
            <div class="metric-value accent">${d.humanCount}</div>
            <div class="metric-sub">last 7 days</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Bot Visits</div>
            <div class="metric-value warning">${d.botCount}</div>
            <div class="metric-sub">last 7 days</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Suspicious Events</div>
            <div class="metric-value danger">${d.suspicious.length}</div>
            <div class="metric-sub">last 7 days</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Unique IPs</div>
            <div class="metric-value">${d.topIPs.length}</div>
            <div class="metric-sub">last 7 days</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">Suspicious Activity</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Severity</th><th>IP</th><th>Reason</th><th>Details</th><th>When</th></tr></thead>
              <tbody>
                ${d.suspicious.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--text-dim)">No suspicious activity detected</td></tr>' :
                  d.suspicious.slice(0, 50).map(s => `<tr>
                    <td>${severityBadge(s.severity)}</td>
                    <td><span class="mono">${escapeHtml(s.ip)}</span></td>
                    <td>${escapeHtml(s.reason)}</td>
                    <td>${escapeHtml(truncate(s.details, 40))}</td>
                    <td>${timeAgo(s.created_at)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-header"><span class="card-title">Top IPs</span></div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>IP</th><th>Location</th><th>Visits</th><th>Type</th></tr></thead>
                <tbody>
                  ${d.topIPs.map(ip => `<tr>
                    <td><span class="mono">${escapeHtml(ip.ip)}</span></td>
                    <td>${escapeHtml(ip.country ? `${ip.city || ''}, ${ip.country}` : 'Unknown')}</td>
                    <td><strong>${ip.count}</strong></td>
                    <td>${ip.is_bot ? '<span class="badge badge-yellow">bot</span>' : '<span class="badge badge-green">human</span>'}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">Flagged IPs</span></div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>IP</th><th>Incidents</th><th>Max Severity</th></tr></thead>
                <tbody>
                  ${d.suspiciousIPs.length === 0 ? '<tr><td colspan="3" style="text-align:center;color:var(--text-dim)">No flagged IPs</td></tr>' :
                    d.suspiciousIPs.map(ip => `<tr>
                      <td><span class="mono">${escapeHtml(ip.ip)}</span></td>
                      <td><strong>${ip.incidents}</strong></td>
                      <td>${severityBadge(ip.max_severity)}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Full Visitor Log</span></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>IP</th><th>Location</th><th>ISP</th><th>Browser / OS</th><th>Referrer</th><th>Type</th><th>When</th></tr></thead>
              <tbody>
                ${d.visitorLog.slice(0, 100).map(v => `<tr>
                  <td><span class="mono">${escapeHtml(v.ip)}</span></td>
                  <td>${escapeHtml(v.country ? `${v.city || ''}, ${v.country}` : 'Unknown')}</td>
                  <td>${escapeHtml(truncate(v.isp, 25) || '-')}</td>
                  <td>${escapeHtml(truncate(v.browser, 15))} / ${escapeHtml(truncate(v.os, 15))}</td>
                  <td>${escapeHtml(truncate(v.referrer, 30) || 'Direct')}</td>
                  <td>${v.is_bot ? '<span class="badge badge-yellow">bot</span>' : '<span class="badge badge-green">human</span>'}</td>
                  <td>${timeAgo(v.created_at)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">Failed to load security data: ${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: ANALYTICS =====
  async function renderAnalytics() {
    renderLayout(`
      <div class="page-header">
        <h1>Analytics</h1>
        <p>Understand how people engage with your site</p>
      </div>
      <div class="loading"><div class="spinner"></div> Loading analytics...</div>
    `);

    try {
      const res = await api('/admin/analytics?period=30');
      const d = res.data;

      $('#mainContent').innerHTML = `
        <div class="page-header">
          <h1>Analytics</h1>
          <p>Understand how people engage with your site</p>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Avg Scroll Depth</div>
            <div class="metric-value accent">${d.avgScrollDepth}%</div>
            <div class="metric-sub">how far people scroll</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Visitors — Last 30 Days</span></div>
          <div class="chart-container"><canvas id="visitorsChart"></canvas></div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-header"><span class="card-title">Section Engagement</span></div>
            <div class="chart-container" style="height:250px"><canvas id="sectionsChart"></canvas></div>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">Visits by Hour</span></div>
            <div class="chart-container" style="height:250px"><canvas id="hourlyChart"></canvas></div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-header"><span class="card-title">Click Tracking</span></div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Element</th><th>Clicks</th></tr></thead>
                <tbody>
                  ${d.clickEvents.length === 0 ? '<tr><td colspan="2" style="text-align:center;color:var(--text-dim)">No click data yet</td></tr>' :
                    d.clickEvents.map(c => `<tr>
                      <td>${escapeHtml(c.target)}</td>
                      <td><strong>${c.clicks}</strong></td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">Referrer Sources</span></div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Source</th><th>Visits</th></tr></thead>
                <tbody>
                  ${d.referrers.length === 0 ? '<tr><td colspan="2" style="text-align:center;color:var(--text-dim)">No referrer data yet</td></tr>' :
                    d.referrers.map(r => `<tr>
                      <td>${escapeHtml(truncate(r.source, 50))}</td>
                      <td><strong>${r.count}</strong></td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-header"><span class="card-title">Devices</span></div>
            <div class="chart-container" style="height:220px"><canvas id="devicesChart"></canvas></div>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">Browsers</span></div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Browser</th><th>Visits</th></tr></thead>
                <tbody>
                  ${d.browsers.map(b => `<tr>
                    <td>${escapeHtml(b.browser)}</td>
                    <td><strong>${b.count}</strong></td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      // Draw charts
      destroyCharts();

      // Visitors line chart
      if (d.dailyVisitors.length > 0) {
        charts.visitors = new Chart($('#visitorsChart'), {
          type: 'line',
          data: {
            labels: d.dailyVisitors.map(v => v.date.slice(5)),
            datasets: [{
              data: d.dailyVisitors.map(v => v.count),
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59,130,246,0.1)',
              fill: true,
              tension: 0.3,
              pointRadius: 3,
              pointBackgroundColor: '#3b82f6'
            }]
          },
          options: chartDefaults
        });
      }

      // Section engagement bar chart
      if (d.sectionEngagement.length > 0) {
        charts.sections = new Chart($('#sectionsChart'), {
          type: 'bar',
          data: {
            labels: d.sectionEngagement.map(s => s.target || 'unknown'),
            datasets: [{
              data: d.sectionEngagement.map(s => s.views),
              backgroundColor: 'rgba(59,130,246,0.3)',
              borderColor: '#3b82f6',
              borderWidth: 1
            }]
          },
          options: { ...chartDefaults, indexAxis: 'y' }
        });
      }

      // Hourly distribution
      if (d.hourlyDistribution.length > 0) {
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const hourMap = Object.fromEntries(d.hourlyDistribution.map(h => [h.hour, h.count]));
        charts.hourly = new Chart($('#hourlyChart'), {
          type: 'bar',
          data: {
            labels: hours.map(h => `${h}:00`),
            datasets: [{
              data: hours.map(h => hourMap[h] || 0),
              backgroundColor: 'rgba(59,130,246,0.3)',
              borderColor: '#3b82f6',
              borderWidth: 1
            }]
          },
          options: chartDefaults
        });
      }

      // Devices doughnut
      if (d.devices.length > 0) {
        const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#22c55e'];
        charts.devices = new Chart($('#devicesChart'), {
          type: 'doughnut',
          data: {
            labels: d.devices.map(d => d.device_type),
            datasets: [{
              data: d.devices.map(d => d.count),
              backgroundColor: colors.slice(0, d.devices.length),
              borderWidth: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right', labels: { color: '#a1a1aa', font: { size: 12 } } }
            }
          }
        });
      }
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">Failed to load analytics: ${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: SETTINGS =====
  async function renderSettings() {
    renderLayout(`
      <div class="page-header">
        <h1>Settings</h1>
        <p>Manage your account and other administrators</p>
      </div>
      <div class="loading"><div class="spinner"></div> Loading...</div>
    `);

    try {
      const [usersRes, oauthRes] = await Promise.all([
        api('/auth/users'),
        api('/auth/oauth/config')
      ]);
      const users = usersRes.data.users;
      const oauth = oauthRes.data;

      $('#mainContent').innerHTML = `
        <div class="page-header">
          <h1>Settings</h1>
          <p>Manage your account, administrators, and integrations</p>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-header"><span class="card-title">Change Password</span></div>
            <div id="cpMsg"></div>
            <form id="settingsCpForm">
              <div class="form-group">
                <label>Current Password</label>
                <input type="password" id="sCurrent" required autocomplete="current-password">
              </div>
              <div class="form-group">
                <label>New Password</label>
                <input type="password" id="sNew" placeholder="Min 8 characters" required minlength="8" autocomplete="new-password">
              </div>
              <div class="form-group">
                <label>Confirm New Password</label>
                <input type="password" id="sConfirm" required minlength="8" autocomplete="new-password">
              </div>
              <button type="submit" class="btn btn-primary" style="width:auto">Update Password</button>
            </form>
          </div>

          <div class="card">
            <div class="card-header">
              <span class="card-title">Administrators</span>
            </div>
            <div id="usersMsg"></div>
            <div class="table-wrap" style="margin-bottom:20px">
              <table>
                <thead><tr><th>Email</th><th>Name</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  ${users.map(u => `<tr>
                    <td>${escapeHtml(u.email)}</td>
                    <td>${escapeHtml(u.name || '-')}</td>
                    <td>${u.must_change_password ? '<span class="badge badge-yellow">pending</span>' : '<span class="badge badge-green">active</span>'}</td>
                    <td>${u.id !== state.user.id ? `<button class="btn btn-secondary btn-sm" data-reset-user="${u.id}" style="margin-right:4px">Reset PW</button><button class="btn btn-danger btn-sm" data-delete-user="${u.id}">Remove</button>` : '<span class="badge badge-blue">you</span>'}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
            <div style="border-top:1px solid var(--border);padding-top:20px">
              <h4 style="font-size:14px;margin-bottom:12px">Add New Admin</h4>
              <form id="addUserForm" style="display:flex;gap:8px;flex-wrap:wrap">
                <input type="email" id="newUserEmail" placeholder="Email" required style="flex:1;min-width:200px;padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font)">
                <input type="text" id="newUserName" placeholder="Name (optional)" style="flex:1;min-width:150px;padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font)">
                <button type="submit" class="btn btn-primary" style="width:auto">Add Admin</button>
              </form>
              <div id="newUserResult" style="margin-top:12px"></div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-top:20px">
          <div class="card-header"><span class="card-title">Google OAuth</span></div>
          <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px">
            Allow clients (and admins) to sign in with their Google account. Users must be created first — Google login only works for existing accounts.
          </p>
          <div id="oauthMsg"></div>
          <form id="oauthForm">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
              <div class="form-group" style="margin-bottom:0">
                <label>Google Client ID</label>
                <input type="text" id="oauthClientId" value="${escapeHtml(oauth.google_client_id)}" placeholder="xxxx.apps.googleusercontent.com" style="font-family:var(--mono);font-size:12px">
              </div>
              <div class="form-group" style="margin-bottom:0">
                <label>Client Secret ${oauth.google_client_secret_set ? '<span class="badge badge-green" style="margin-left:6px;font-size:10px">set</span>' : '<span class="badge badge-gray" style="margin-left:6px;font-size:10px">not set</span>'}</label>
                <input type="password" id="oauthClientSecret" placeholder="${oauth.google_client_secret_set ? 'Leave blank to keep current' : 'Enter client secret'}" style="font-family:var(--mono);font-size:12px">
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:16px">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
                <input type="checkbox" id="oauthEnabled" ${oauth.google_oauth_enabled ? 'checked' : ''} style="width:auto">
                Enable Google Sign-In
              </label>
              <button type="submit" class="btn btn-primary" style="width:auto">Save OAuth Settings</button>
            </div>
          </form>
          ${oauth.google_oauth_enabled ? '<div style="margin-top:12px;padding:12px;background:var(--surface-2);border-radius:var(--radius);font-size:12px;color:var(--text-dim)"><strong>Authorized redirect URI</strong> (add this in Google Cloud Console):<br><code style="color:var(--accent);font-family:var(--mono)">' + window.location.origin + '/api/auth/google/callback</code></div>' : ''}
        </div>
      `;

      // Change password handler
      $('#settingsCpForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if ($('#sNew').value !== $('#sConfirm').value) {
          $('#cpMsg').innerHTML = `<div class="alert alert-error">Passwords don't match</div>`;
          return;
        }
        try {
          await api('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ current_password: $('#sCurrent').value, new_password: $('#sNew').value })
          });
          $('#cpMsg').innerHTML = `<div class="alert alert-success">Password updated</div>`;
          e.target.reset();
        } catch (err) {
          $('#cpMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      });

      // Add user handler
      $('#addUserForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const res = await api('/auth/users', {
            method: 'POST',
            body: JSON.stringify({ email: $('#newUserEmail').value, name: $('#newUserName').value || undefined })
          });
          const tempPass = res.data.temporary_password;
          $('#newUserResult').innerHTML = `
            <div class="alert alert-success">
              Admin created! Temporary password: <strong style="font-family:var(--mono)">${escapeHtml(tempPass)}</strong><br>
              <small>Share this securely — they must change it on first login.</small>
            </div>
          `;
          e.target.reset();
          setTimeout(() => renderSettings(), 2000);
        } catch (err) {
          $('#newUserResult').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      });

      // Reset user password handlers
      $$('[data-reset-user]').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm('Reset this user\'s password?')) return;
        try {
          const res = await api(`/auth/users/${btn.dataset.resetUser}/reset`, { method: 'POST' });
          const tempPass = res.data.temporary_password;
          $('#usersMsg').innerHTML = `<div class="alert alert-success">Password reset! New temp password: <strong style="font-family:var(--mono)">${escapeHtml(tempPass)}</strong><br><small>They must change it on next login.</small></div>`;
        } catch (err) {
          $('#usersMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      }));

      // Delete user handlers
      $$('[data-delete-user]').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm('Remove this admin?')) return;
        try {
          await api(`/auth/users/${btn.dataset.deleteUser}`, { method: 'DELETE' });
          renderSettings();
        } catch (err) {
          $('#usersMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      }));

      // OAuth settings handler
      $('#oauthForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const payload = {
            google_client_id: $('#oauthClientId').value,
            google_oauth_enabled: $('#oauthEnabled').checked
          };
          const secret = $('#oauthClientSecret').value;
          if (secret) payload.google_client_secret = secret;

          await api('/auth/oauth/config', {
            method: 'PUT',
            body: JSON.stringify(payload)
          });
          $('#oauthMsg').innerHTML = `<div class="alert alert-success">OAuth settings saved</div>`;
          setTimeout(() => renderSettings(), 1500);
        } catch (err) {
          $('#oauthMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      });
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">Failed to load settings: ${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: PROJECTS =====
  async function renderProjects() {
    renderLayout(`
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:start">
        <div><h1>Projects</h1><p>Manage client projects</p></div>
        <button class="btn btn-primary" id="newProjectBtn" style="width:auto">New Project</button>
      </div>
      <div class="loading"><div class="spinner"></div> Loading...</div>
    `);

    try {
      const res = await api('/admin/projects');
      const projects = res.data.projects;

      const statusColors = { planning: 'badge-gray', proposed: 'badge-yellow', approved: 'badge-blue', in_progress: 'badge-blue', review: 'badge-yellow', completed: 'badge-green', maintenance: 'badge-green', archived: 'badge-gray' };

      $('#mainContent').innerHTML = `
        <div class="page-header" style="display:flex;justify-content:space-between;align-items:start">
          <div><h1>Projects</h1><p>Manage client projects</p></div>
          <button class="btn btn-primary" id="newProjectBtn" style="width:auto">New Project</button>
        </div>

        <div id="newProjectForm" style="display:none;margin-bottom:24px" class="card">
          <div class="card-header"><span class="card-title">Create Project</span></div>
          <div id="newProjectMsg"></div>
          <form id="createProjectForm">
            <div style="display:flex;gap:12px;flex-wrap:wrap">
              <div class="form-group" style="flex:1;min-width:200px">
                <label>Organization</label>
                <select id="projOrg" required style="width:100%;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font)">
                  <option value="">Select org...</option>
                </select>
              </div>
              <div class="form-group" style="flex:2;min-width:200px">
                <label>Project Name</label>
                <input type="text" id="projName" required placeholder="e.g. PCG Website Redesign" style="width:100%;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font)">
              </div>
            </div>
            <div class="form-group">
              <label>Description</label>
              <input type="text" id="projDesc" placeholder="Brief description" style="width:100%;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font)">
            </div>
            <button type="submit" class="btn btn-primary" style="width:auto">Create</button>
          </form>
        </div>

        <div class="card" style="padding:0">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Progress</th><th>Tickets</th><th>Last Activity</th></tr></thead>
              <tbody>
                ${projects.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:32px">No projects yet</td></tr>' :
                  projects.map(p => `<tr data-project-id="${p.id}" style="cursor:pointer">
                    <td style="color:var(--text);font-weight:500">${escapeHtml(p.name)}</td>
                    <td>${escapeHtml(p.org_name)}</td>
                    <td><span class="badge ${statusColors[p.status] || 'badge-gray'}">${p.status.replace(/_/g, ' ')}</span></td>
                    <td><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:6px;background:var(--surface-3);border-radius:3px;min-width:60px"><div style="height:100%;background:var(--accent);border-radius:3px;width:${p.progress_percent}%"></div></div><span style="font-size:11px">${p.progress_percent}%</span></div></td>
                    <td>${p.open_tickets > 0 ? `<span class="badge badge-yellow">${p.open_tickets} open</span>` : '<span style="color:var(--text-dim)">0</span>'}</td>
                    <td>${p.last_activity ? timeAgo(p.last_activity) : '-'}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // New project toggle
      $('#newProjectBtn').addEventListener('click', async () => {
        const form = $('#newProjectForm');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
        if (form.style.display === 'block') {
          // Load orgs into select
          const orgsRes = await api('/admin/clients');
          const select = $('#projOrg');
          select.innerHTML = '<option value="">Select org...</option>' +
            orgsRes.data.organizations.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');
        }
      });

      // Create project handler
      $('#createProjectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await api('/admin/projects', {
            method: 'POST',
            body: JSON.stringify({ org_id: $('#projOrg').value, name: $('#projName').value, description: $('#projDesc').value })
          });
          renderProjects();
        } catch (err) {
          $('#newProjectMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      });

      // Click to view project
      $$('tr[data-project-id]').forEach(row => row.addEventListener('click', () => {
        state.page = 'projectDetail';
        state.projectDetailId = row.dataset.projectId;
        window.location.hash = `#/projects/${row.dataset.projectId}`;
        render();
      }));
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: PROJECT DETAIL (admin) =====
  async function renderProjectDetail(projectId) {
    renderLayout(`
      <div class="page-header"><h1>Project</h1></div>
      <div class="loading"><div class="spinner"></div> Loading...</div>
    `);

    try {
      const res = await api(`/admin/projects/${projectId}`);
      const { project, milestones, plan, members, recentActivity } = res.data;

      const statusOptions = ['planning', 'proposed', 'approved', 'in_progress', 'review', 'completed', 'maintenance', 'archived'];
      const statusColors = { planning: 'badge-gray', proposed: 'badge-yellow', approved: 'badge-blue', in_progress: 'badge-blue', review: 'badge-yellow', completed: 'badge-green', maintenance: 'badge-green', archived: 'badge-gray' };
      const msStatusColors = { upcoming: 'badge-gray', in_progress: 'badge-blue', completed: 'badge-green', skipped: 'badge-gray' };

      $('#mainContent').innerHTML = `
        <div style="margin-bottom:16px">
          <a href="#/projects" style="color:var(--text-secondary);text-decoration:none;font-size:13px">\u2190 All Projects</a>
        </div>
        <div class="page-header" style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <h1>${escapeHtml(project.name)}</h1>
            <p>${escapeHtml(project.org_name)} \u2022 ${escapeHtml(project.description || '')}</p>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <select id="statusSelect" style="padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:13px">
              ${statusOptions.map(s => `<option value="${s}" ${s === project.status ? 'selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}
            </select>
          </div>
        </div>

        <div id="statusMsg"></div>

        <div style="display:flex;gap:8px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:24px">
          <div style="flex:1;text-align:center">
            <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;margin-bottom:4px">Progress</div>
            <div style="font-size:24px;font-weight:700;font-family:var(--mono);color:var(--accent)">${project.progress_percent}%</div>
          </div>
          <div style="flex:1;text-align:center">
            <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;margin-bottom:4px">Milestones</div>
            <div style="font-size:24px;font-weight:700;font-family:var(--mono)">${milestones.filter(m=>m.status==='completed').length}/${milestones.length}</div>
          </div>
          <div style="flex:1;text-align:center">
            <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;margin-bottom:4px">Target</div>
            <div style="font-size:14px;font-weight:500">${project.target_date ? new Date(project.target_date+'Z').toLocaleDateString() : '-'}</div>
          </div>
        </div>

        <div class="grid-2">
          <!-- Milestones -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Milestones</span>
              <button class="btn btn-secondary btn-sm" id="addMsBtn">+ Add</button>
            </div>
            <div id="addMsForm" style="display:none;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)">
              <div style="display:flex;gap:8px">
                <input type="text" id="msTitle" placeholder="Milestone title" style="flex:1;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:13px">
                <button class="btn btn-primary btn-sm" id="saveMsBtn">Save</button>
              </div>
            </div>
            ${milestones.length === 0 ? '<p style="color:var(--text-dim);font-size:13px">No milestones yet.</p>' :
              milestones.map(m => `
                <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--surface-3)" data-ms-id="${m.id}">
                  <select class="ms-status-select" data-ms-id="${m.id}" style="padding:4px 8px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:11px;min-width:90px">
                    ${['upcoming','in_progress','completed','skipped'].map(s => `<option value="${s}" ${s===m.status?'selected':''}>${s.replace(/_/g,' ')}</option>`).join('')}
                  </select>
                  <span style="flex:1;font-size:14px">${escapeHtml(m.title)}</span>
                  <button class="btn btn-danger btn-sm ms-delete" data-ms-id="${m.id}" style="padding:2px 8px;font-size:10px">\u2715</button>
                </div>
              `).join('')}
          </div>

          <!-- Plan -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Project Plan</span>
              <div style="display:flex;align-items:center;gap:8px">
                ${plan ? `<span style="font-size:11px;color:var(--text-dim)">v${plan.version}</span>` : ''}
                ${plan ? `<button class="btn btn-secondary btn-sm" id="planHistoryBtn">History</button>` : ''}
                <button class="btn btn-secondary btn-sm" id="editPlanBtn">${plan ? 'Edit' : 'Create'} Plan</button>
              </div>
            </div>
            <div id="planEditor" style="display:none;margin-bottom:16px">
              <div style="display:flex;gap:4px;margin-bottom:8px;border-bottom:1px solid var(--border);padding-bottom:8px">
                <button class="btn btn-sm planTabBtn active" data-tab="write" style="font-size:12px">Write</button>
                <button class="btn btn-sm planTabBtn" data-tab="preview" style="font-size:12px">Preview</button>
              </div>
              <div id="planWriteTab">
                <textarea id="planContent" style="width:100%;min-height:300px;padding:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--mono);font-size:13px;resize:vertical;line-height:1.6">${plan ? escapeHtml(plan.content) : ''}</textarea>
              </div>
              <div id="planPreviewTab" style="display:none;min-height:300px;padding:16px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);overflow-y:auto;max-height:600px" class="md-rendered"></div>
              <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
                <button class="btn btn-primary btn-sm" id="savePlanBtn">Save Plan</button>
                ${['planning', 'proposed'].includes(project.status) && plan ? `<button class="btn btn-secondary btn-sm" id="proposePlanBtn" style="background:var(--success);border-color:var(--success);color:#fff">${project.status === 'proposed' ? 'Re-send to Client' : 'Send to Client'}</button>` : ''}
                <span id="planMsg" style="font-size:12px"></span>
              </div>
            </div>
            <div id="planVersionsPanel" style="display:none;margin-bottom:16px"></div>
            ${plan ? `<div id="planDisplay" class="md-rendered" style="max-height:300px;overflow-y:auto;font-size:13px;line-height:1.6">${renderMarkdown(escapeHtml(plan.content))}</div>` :
              '<p style="color:var(--text-dim);font-size:13px">No plan created yet.</p>'}
          </div>
        </div>

        <!-- Tickets -->
        <div class="card">
          <div class="card-header"><span class="card-title">Tickets</span></div>
          <div id="ticketsSection"><div class="loading"><div class="spinner"></div> Loading tickets...</div></div>
        </div>

        <!-- Activity -->
        <div class="card">
          <div class="card-header"><span class="card-title">Recent Activity</span></div>
          ${recentActivity.length === 0 ? '<p style="color:var(--text-dim);font-size:13px">No activity yet.</p>' : `
            <div style="max-height:300px;overflow-y:auto">
              ${recentActivity.map(a => {
                const d = a.details ? JSON.parse(a.details) : {};
                return `<div style="padding:8px 0;border-bottom:1px solid var(--surface-3);font-size:13px;color:var(--text-secondary)">
                  <strong>${escapeHtml(a.user_name || a.user_email || 'System')}</strong> — ${a.action.replace(/_/g, ' ')}
                  <span style="float:right;color:var(--text-dim);font-size:11px">${timeAgo(a.created_at)}</span>
                </div>`;
              }).join('')}
            </div>
          `}
        </div>
      `;

      // Status change handler
      $('#statusSelect').addEventListener('change', async (e) => {
        try {
          await api(`/admin/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) });
          $('#statusMsg').innerHTML = `<div class="alert alert-success" style="margin-bottom:16px">Status updated to ${e.target.value}</div>`;
          setTimeout(() => { const el = $('#statusMsg'); if(el) el.innerHTML=''; }, 2000);
        } catch (err) { $('#statusMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`; }
      });

      // Add milestone
      $('#addMsBtn').addEventListener('click', () => {
        const form = $('#addMsForm');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
      });
      $('#saveMsBtn').addEventListener('click', async () => {
        const title = $('#msTitle').value.trim();
        if (!title) return;
        try {
          await api(`/admin/projects/${projectId}/milestones`, { method: 'POST', body: JSON.stringify({ title }) });
          renderProjectDetail(projectId);
        } catch (err) { alert(err.message); }
      });

      // Milestone status changes
      $$('.ms-status-select').forEach(sel => sel.addEventListener('change', async (e) => {
        try {
          await api(`/admin/milestones/${e.target.dataset.msId}`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) });
          renderProjectDetail(projectId);
        } catch (err) { alert(err.message); }
      }));

      // Milestone delete
      $$('.ms-delete').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm('Delete this milestone?')) return;
        try {
          await api(`/admin/milestones/${btn.dataset.msId}`, { method: 'DELETE' });
          renderProjectDetail(projectId);
        } catch (err) { alert(err.message); }
      }));

      // Plan editor
      $('#editPlanBtn').addEventListener('click', () => {
        const editor = $('#planEditor');
        const display = $('#planDisplay');
        editor.style.display = editor.style.display === 'none' ? 'block' : 'none';
        if (display) display.style.display = editor.style.display === 'none' ? 'block' : 'none';
      });

      // Write/Preview tabs
      $$('.planTabBtn').forEach(btn => btn.addEventListener('click', () => {
        $$('.planTabBtn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        const writeTab = $('#planWriteTab');
        const previewTab = $('#planPreviewTab');
        if (tab === 'write') { writeTab.style.display = 'block'; previewTab.style.display = 'none'; }
        else { writeTab.style.display = 'none'; previewTab.style.display = 'block'; previewTab.innerHTML = renderMarkdown(escapeHtml($('#planContent').value)); }
      }));

      $('#savePlanBtn').addEventListener('click', async () => {
        const msg = $('#planMsg');
        try {
          const result = await api(`/admin/projects/${projectId}/plan`, { method: 'POST', body: JSON.stringify({ content: $('#planContent').value }) });
          if (msg) msg.innerHTML = `<span class="badge badge-green">Saved (v${result.data.version})</span>`;
          setTimeout(() => { if (msg) msg.innerHTML = ''; }, 3000);
          // Update preview display if visible
          const display = $('#planDisplay');
          if (display) display.innerHTML = renderMarkdown(escapeHtml($('#planContent').value));
        } catch (err) {
          if (msg) msg.innerHTML = `<span class="badge badge-red">${escapeHtml(err.message)}</span>`;
        }
      });

      const proposeBtn = $('#proposePlanBtn');
      if (proposeBtn) {
        proposeBtn.addEventListener('click', async () => {
          if (!confirm('This will send the plan to the client for approval. Continue?')) return;
          try {
            await api(`/admin/projects/${projectId}/plan`, { method: 'POST', body: JSON.stringify({ content: $('#planContent').value }) });
            await api(`/admin/projects/${projectId}/propose`, { method: 'POST' });
            renderProjectDetail(projectId);
          } catch (err) { alert(err.message); }
        });
      }

      // Version history
      const histBtn = $('#planHistoryBtn');
      if (histBtn) {
        histBtn.addEventListener('click', async () => {
          const panel = $('#planVersionsPanel');
          if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
          panel.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
          panel.style.display = 'block';
          try {
            const res = await api(`/admin/projects/${projectId}/plan/versions`);
            const versions = res.data.versions;
            if (versions.length === 0) {
              panel.innerHTML = '<p style="color:var(--text-dim);font-size:13px;padding:8px">No previous versions.</p>';
              return;
            }
            panel.innerHTML = `
              <div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
                <div style="padding:8px 12px;background:var(--surface-3);font-size:12px;font-weight:600;color:var(--text-dim)">Version History</div>
                ${versions.map(v => `
                  <div style="padding:8px 12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:13px">
                    <div>
                      <strong>v${v.version}</strong>
                      <span style="color:var(--text-dim);margin-left:8px">${v.saved_by_name || 'Unknown'}</span>
                      <span style="color:var(--text-dim);margin-left:8px">${timeAgo(v.created_at)}</span>
                    </div>
                    <div style="display:flex;gap:4px">
                      <button class="btn btn-secondary btn-sm" data-view-version="${v.id}" style="font-size:11px">View</button>
                      <button class="btn btn-secondary btn-sm" data-restore-version="${v.id}" data-ver="${v.version}" style="font-size:11px">Restore</button>
                    </div>
                  </div>
                `).join('')}
              </div>
              <div id="versionPreview" style="display:none;margin-top:8px;padding:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);max-height:300px;overflow-y:auto" class="md-rendered"></div>
            `;
            $$('[data-view-version]').forEach(btn => btn.addEventListener('click', async () => {
              try {
                const vRes = await api(`/admin/projects/${projectId}/plan/versions/${btn.dataset.viewVersion}`);
                const preview = $('#versionPreview');
                preview.style.display = 'block';
                preview.innerHTML = renderMarkdown(escapeHtml(vRes.data.version.content));
              } catch (err) { alert(err.message); }
            }));
            $$('[data-restore-version]').forEach(btn => btn.addEventListener('click', async () => {
              if (!confirm(`Restore to v${btn.dataset.ver}? Current plan will be saved as a new version.`)) return;
              try {
                await api(`/admin/projects/${projectId}/plan/restore/${btn.dataset.restoreVersion}`, { method: 'POST' });
                renderProjectDetail(projectId);
              } catch (err) { alert(err.message); }
            }));
          } catch (err) {
            panel.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
          }
        });
      }

      // Load tickets
      try {
        const ticketsRes = await api(`/admin/projects/${projectId}/tickets`);
        const tickets = ticketsRes.data.tickets;
        const tsEl = $('#ticketsSection');
        if (!tsEl) return;
        tsEl.innerHTML = tickets.length === 0 ? '<p style="color:var(--text-dim);font-size:13px">No tickets yet.</p>' : `
          <div class="table-wrap"><table>
            <thead><tr><th>#</th><th>Title</th><th>Type</th><th>Priority</th><th>Status</th><th>Assigned</th><th>Updated</th></tr></thead>
            <tbody>${tickets.map(t => `<tr data-ticket-href="#/tickets/${t.id}" style="cursor:pointer">
              <td style="font-family:var(--mono);font-size:12px">${t.ticket_number}</td>
              <td style="color:var(--text)">${escapeHtml(t.title)}</td>
              <td><span class="badge badge-gray">${t.type.replace(/_/g,' ')}</span></td>
              <td><span class="badge ${t.priority==='high'||t.priority==='urgent'?'badge-red':t.priority==='medium'?'badge-yellow':'badge-gray'}">${t.priority}</span></td>
              <td><span class="badge ${t.status==='open'?'badge-blue':t.status==='in_progress'?'badge-yellow':t.status==='completed'?'badge-green':'badge-gray'}">${t.status.replace(/_/g,' ')}</span></td>
              <td>${escapeHtml(t.assigned_to_name || '-')}</td>
              <td>${timeAgo(t.updated_at)}</td>
            </tr>`).join('')}</tbody>
          </table></div>
        `;
        $$('[data-ticket-href]').forEach(r => r.addEventListener('click', () => {
          window.location.hash = r.dataset.ticketHref;
        }));
      } catch (e) {
        const tsEl = $('#ticketsSection');
        if (tsEl) tsEl.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
      }
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: TICKET DETAIL (admin) =====
  async function renderAdminTicketDetail(ticketId) {
    renderLayout(`<div class="loading"><div class="spinner"></div> Loading ticket...</div>`);

    try {
      const res = await api(`/admin/tickets/${ticketId}`);
      const { ticket, comments } = res.data;

      // Fetch attachments
      let attachments = [];
      try {
        const attRes = await fetch(`/api/uploads/tickets/${ticket.id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` } });
        const attData = await attRes.json();
        if (attData.success) attachments = attData.data.attachments;
      } catch {}

      const statusOpts = ['open', 'in_progress', 'review', 'completed', 'closed'];
      const priorityOpts = ['low', 'medium', 'high', 'urgent'];

      const fileIcon = (mime) => {
        if (mime.startsWith('image/')) return '\u{1F5BC}';
        if (mime.includes('pdf')) return '\u{1F4C4}';
        if (mime.includes('word') || mime.includes('document')) return '\u{1F4DD}';
        if (mime.includes('sheet') || mime.includes('excel')) return '\u{1F4CA}';
        if (mime.includes('zip')) return '\u{1F4E6}';
        return '\u{1F4CE}';
      };

      $('#mainContent').innerHTML = `
        <div style="margin-bottom:16px">
          <a href="#/projects/${ticket.project_id || ''}" style="color:var(--text-secondary);text-decoration:none;font-size:13px">\u2190 Back to Project</a>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:24px">
          <div>
            <h1 style="font-size:22px;margin-bottom:8px">#${ticket.ticket_number} — ${escapeHtml(ticket.title)}</h1>
            <div style="font-size:13px;color:var(--text-secondary)">
              ${escapeHtml(ticket.project_name || '')} \u2022 Created by ${escapeHtml(ticket.created_by_name || ticket.created_by_email)} \u2022 ${timeAgo(ticket.created_at)}
            </div>
          </div>
          <div style="display:flex;gap:8px">
            <select id="ticketStatus" style="padding:6px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:12px">
              ${statusOpts.map(s => `<option value="${s}" ${s===ticket.status?'selected':''}>${s.replace(/_/g,' ')}</option>`).join('')}
            </select>
            <select id="ticketPriority" style="padding:6px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:12px">
              ${priorityOpts.map(p => `<option value="${p}" ${p===ticket.priority?'selected':''}>${p}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="ticketUpdateMsg"></div>

        ${ticket.description ? `<div style="padding:16px;background:var(--surface-2);border-radius:var(--radius);font-size:14px;line-height:1.6;color:var(--text-secondary);margin-bottom:24px;white-space:pre-wrap">${escapeHtml(ticket.description)}</div>` : ''}

        <div class="card" style="margin-bottom:24px">
          <div class="card-header">
            <span class="card-title">Attachments (${attachments.length}/10)</span>
          </div>
          <div id="attachmentsList">
            ${attachments.length === 0 ? '<p style="color:var(--text-dim);font-size:13px;margin:0">No files attached.</p>' : `
              <div style="display:flex;flex-direction:column;gap:6px">
                ${attachments.map(a => `
                  <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface-2);border-radius:var(--radius);font-size:13px" data-att-id="${a.id}">
                    <span style="font-size:18px">${fileIcon(a.mimetype)}</span>
                    <a href="#" class="att-download" data-id="${a.id}" data-name="${escapeHtml(a.filename)}" style="color:var(--accent);text-decoration:none;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(a.filename)}">${escapeHtml(a.filename)}</a>
                    <span style="color:var(--text-dim);font-size:12px;white-space:nowrap">${formatFileSize(a.size)}</span>
                    <span style="color:var(--text-dim);font-size:12px;white-space:nowrap">${escapeHtml(a.uploaded_by_name || '')}</span>
                    <span style="color:var(--text-dim);font-size:12px;white-space:nowrap">${timeAgo(a.uploaded_at)}</span>
                    <button class="btn btn-secondary btn-sm att-delete" data-id="${a.id}" style="padding:2px 8px;font-size:11px;color:var(--danger);border-color:var(--danger)">\u2715</button>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
          ${attachments.length < 10 ? `
            <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px">
              <div id="uploadDropZone" style="border:2px dashed var(--border);border-radius:var(--radius);padding:20px;text-align:center;cursor:pointer;transition:border-color 0.2s">
                <div style="color:var(--text-secondary);font-size:13px">Drop files here or <label for="fileInput" style="color:var(--accent);cursor:pointer;text-decoration:underline">browse</label></div>
                <div style="color:var(--text-dim);font-size:11px;margin-top:4px">Max 10MB per file. Images, PDFs, docs, spreadsheets, CSV, ZIP.</div>
                <input type="file" id="fileInput" multiple style="display:none" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip">
              </div>
              <div id="uploadProgress" style="margin-top:8px"></div>
              <div id="uploadMsg" style="margin-top:8px"></div>
            </div>
          ` : ''}
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Comments (${comments.length})</span></div>
          ${comments.map(c => `
            <div style="padding:12px;background:${c.is_internal?'rgba(245,158,11,0.05)':'var(--surface-2)'};border-radius:var(--radius);margin-bottom:8px;border-left:3px solid ${c.is_internal?'var(--warning)':c.user_role==='client'?'var(--success)':'var(--accent)'}">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px">
                <span style="font-weight:600;color:var(--text)">${escapeHtml(c.user_name || c.user_email)} <span class="badge ${c.user_role==='client'?'badge-green':c.is_internal?'badge-yellow':'badge-blue'}">${c.is_internal?'internal':c.user_role}</span></span>
                <span style="color:var(--text-dim)">${timeAgo(c.created_at)}</span>
              </div>
              <div style="font-size:14px;color:var(--text-secondary);white-space:pre-wrap">${escapeHtml(c.body)}</div>
            </div>
          `).join('')}

          <div style="border-top:1px solid var(--border);padding-top:16px;margin-top:16px">
            <div style="display:flex;gap:12px;margin-bottom:8px">
              <textarea id="newComment" placeholder="Add a comment..." style="flex:1;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:13px;min-height:60px;resize:vertical"></textarea>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary btn-sm" id="postPublicBtn">Post (visible to client)</button>
              <button class="btn btn-secondary btn-sm" id="postInternalBtn" style="border-color:var(--warning);color:var(--warning)">Post Internal Note</button>
            </div>
            <div id="commentMsg" style="margin-top:8px"></div>
          </div>
        </div>
      `;

      // Status/priority change
      const updateTicket = async (field, value) => {
        try {
          await api(`/admin/tickets/${ticketId}`, { method: 'PATCH', body: JSON.stringify({ [field]: value }) });
          $('#ticketUpdateMsg').innerHTML = `<div class="alert alert-success" style="margin-bottom:12px">${field} updated</div>`;
          setTimeout(() => { const el=$('#ticketUpdateMsg'); if(el) el.innerHTML=''; }, 2000);
        } catch (err) { $('#ticketUpdateMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`; }
      };
      $('#ticketStatus').addEventListener('change', (e) => updateTicket('status', e.target.value));
      $('#ticketPriority').addEventListener('change', (e) => updateTicket('priority', e.target.value));

      // File upload handling
      const uploadFiles = async (files) => {
        if (!files || files.length === 0) return;
        const formData = new FormData();
        for (const f of files) formData.append('files', f);
        const progressEl = $('#uploadProgress');
        const msgEl = $('#uploadMsg');
        if (progressEl) progressEl.innerHTML = '<div style="color:var(--text-secondary);font-size:13px">Uploading...</div>';
        if (msgEl) msgEl.innerHTML = '';
        try {
          const uploadRes = await fetch(`/api/uploads/tickets/${ticket.id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` },
            body: formData
          });
          const uploadData = await uploadRes.json();
          if (!uploadData.success) throw new Error(uploadData.error);
          renderAdminTicketDetail(ticketId);
        } catch (err) {
          if (progressEl) progressEl.innerHTML = '';
          if (msgEl) msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        }
      };

      const dropZone = $('#uploadDropZone');
      const fileInput = $('#fileInput');
      if (dropZone) {
        dropZone.addEventListener('click', () => fileInput && fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent)'; });
        dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--border)'; });
        dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--border)'; uploadFiles(e.dataTransfer.files); });
      }
      if (fileInput) {
        fileInput.addEventListener('change', () => { uploadFiles(fileInput.files); });
      }

      // Download attachment (auth-gated)
      $$('.att-download').forEach(link => {
        link.addEventListener('click', async (e) => {
          e.preventDefault();
          try {
            const dlRes = await fetch(`/api/uploads/download/${link.dataset.id}`, {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
            });
            if (!dlRes.ok) throw new Error('Download failed');
            const blob = await dlRes.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = link.dataset.name; a.click();
            URL.revokeObjectURL(url);
          } catch (err) { alert('Download failed: ' + err.message); }
        });
      });

      // Delete attachment
      $$('.att-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this attachment?')) return;
          try {
            const delRes = await fetch(`/api/uploads/${btn.dataset.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
            });
            const delData = await delRes.json();
            if (!delData.success) throw new Error(delData.error);
            renderAdminTicketDetail(ticketId);
          } catch (err) {
            alert('Delete failed: ' + err.message);
          }
        });
      });

      // Post comment
      const postComment = async (isInternal) => {
        const body = $('#newComment').value.trim();
        if (!body) return;
        try {
          await api(`/admin/tickets/${ticketId}/comments`, { method: 'POST', body: JSON.stringify({ body, is_internal: isInternal }) });
          renderAdminTicketDetail(ticketId);
        } catch (err) { $('#commentMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`; }
      };
      $('#postPublicBtn').addEventListener('click', () => postComment(false));
      $('#postInternalBtn').addEventListener('click', () => postComment(true));
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: CLIENTS =====
  async function renderClients() {
    renderLayout(`
      <div class="page-header"><h1>Clients</h1><p>Manage client organizations</p></div>
      <div class="loading"><div class="spinner"></div> Loading...</div>
    `);

    try {
      const res = await api('/admin/clients');
      const orgs = res.data.organizations;

      $('#mainContent').innerHTML = `
        <div class="page-header" style="display:flex;justify-content:space-between;align-items:start">
          <div><h1>Clients</h1><p>Manage client organizations</p></div>
          <button class="btn btn-primary" id="newOrgBtn" style="width:auto">New Client</button>
        </div>

        <div id="newOrgForm" style="display:none;margin-bottom:24px" class="card">
          <div class="card-header"><span class="card-title">Create Organization</span></div>
          <div id="newOrgMsg"></div>
          <form id="createOrgForm" style="display:flex;gap:8px;flex-wrap:wrap">
            <input type="text" id="orgName" placeholder="Company name" required style="flex:1;min-width:200px;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font)">
            <input type="email" id="orgEmail" placeholder="Primary email" required style="flex:1;min-width:200px;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font)">
            <button type="submit" class="btn btn-primary" style="width:auto">Create</button>
          </form>
        </div>

        ${orgs.length === 0 ? '<div class="empty-state"><p>No clients yet. Create one to get started!</p></div>' :
          orgs.map(o => `
            <div class="card" style="margin-bottom:16px">
              <div class="card-header">
                <span class="card-title">${escapeHtml(o.name)}</span>
                <span style="font-size:12px;color:var(--text-dim)">${escapeHtml(o.primary_email)}</span>
              </div>
              <div style="display:flex;gap:24px;font-size:13px;color:var(--text-secondary);margin-bottom:16px">
                <span>${o.project_count} project${o.project_count!==1?'s':''}</span>
                <span>${o.user_count} portal user${o.user_count!==1?'s':''}</span>
                <span>Created ${timeAgo(o.created_at)}</span>
              </div>
              <div style="border-top:1px solid var(--border);padding-top:12px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                  <span style="font-size:13px;font-weight:600">Portal Users</span>
                  <button class="btn btn-secondary btn-sm add-user-btn" data-org-id="${o.id}">+ Add User</button>
                </div>
                <div id="addUserForm-${o.id}" style="display:none;margin-bottom:12px">
                  <div style="display:flex;gap:8px">
                    <input type="email" placeholder="Email" class="new-client-email" style="flex:1;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:13px">
                    <input type="text" placeholder="Name" class="new-client-name" style="flex:1;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:13px">
                    <button class="btn btn-primary btn-sm save-client-btn" data-org-id="${o.id}">Create</button>
                  </div>
                  <div class="new-client-result" style="margin-top:8px"></div>
                </div>
                <div id="usersList-${o.id}" style="font-size:13px;color:var(--text-dim)">Loading...</div>
              </div>
            </div>
          `).join('')}
      `;

      // New org toggle + handler
      $('#newOrgBtn').addEventListener('click', () => {
        const form = $('#newOrgForm');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
      });
      $('#createOrgForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await api('/admin/clients', { method: 'POST', body: JSON.stringify({ name: $('#orgName').value, primary_email: $('#orgEmail').value }) });
          renderClients();
        } catch (err) { $('#newOrgMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`; }
      });

      // Load users for each org + add user handlers
      for (const o of orgs) {
        try {
          const usersRes = await api(`/admin/clients/${o.id}/users`);
          const users = usersRes.data.users;
          const el = $(`#usersList-${o.id}`);
          if (!el) continue;
          el.innerHTML = users.length === 0 ? 'No portal users yet.' :
            users.map(u => `<div style="padding:4px 0">${escapeHtml(u.email)} ${u.name ? '('+escapeHtml(u.name)+')' : ''} ${u.must_change_password ? '<span class="badge badge-yellow">pending</span>' : '<span class="badge badge-green">active</span>'}</div>`).join('');
        } catch(e) {}
      }

      // Add user toggles
      $$('.add-user-btn').forEach(btn => btn.addEventListener('click', () => {
        const form = $(`#addUserForm-${btn.dataset.orgId}`);
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
      }));

      // Save client user
      $$('.save-client-btn').forEach(btn => btn.addEventListener('click', async () => {
        const orgId = btn.dataset.orgId;
        const form = $(`#addUserForm-${orgId}`);
        const email = form.querySelector('.new-client-email').value;
        const name = form.querySelector('.new-client-name').value;
        const result = form.querySelector('.new-client-result');
        try {
          const res = await api(`/admin/clients/${orgId}/users`, { method: 'POST', body: JSON.stringify({ email, name }) });
          result.innerHTML = `<div class="alert alert-success">Created! Temp password: <strong style="font-family:var(--mono)">${escapeHtml(res.data.temporary_password)}</strong><br><small>Share securely — must change on first login.</small></div>`;
          setTimeout(() => renderClients(), 3000);
        } catch (err) { result.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`; }
      }));
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== ROUTER =====
  function route() {
    const hash = window.location.hash.replace('#/', '') || 'dashboard';
    const parts = hash.split('/');

    if (parts[0] === 'projects' && parts[1]) {
      state.page = 'projectDetail';
      state.projectDetailId = parts[1];
      return;
    }
    if (parts[0] === 'tickets' && parts[1]) {
      state.page = 'ticketDetail';
      state.ticketDetailId = parts[1];
      return;
    }
    if (['dashboard', 'security', 'analytics', 'settings', 'projects', 'clients'].includes(parts[0])) {
      state.page = parts[0];
    }
  }

  // ===== MAIN RENDER =====
  async function render() {
    destroyCharts();

    if (!state.token || !state.user) {
      const authed = await checkAuth();
      if (!authed) return renderLogin();
    }

    if (state.user.must_change_password) return renderChangePassword();

    route();
    switch (state.page) {
      case 'projects': return renderProjects();
      case 'projectDetail': return renderProjectDetail(state.projectDetailId);
      case 'ticketDetail': return renderAdminTicketDetail(state.ticketDetailId);
      case 'clients': return renderClients();
      case 'security': return renderSecurity();
      case 'analytics': return renderAnalytics();
      case 'settings': return renderSettings();
      default: return renderDashboard();
    }
  }

  // ===== INIT =====
  window.addEventListener('hashchange', render);
  render();
})();
