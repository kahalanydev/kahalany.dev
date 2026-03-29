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
        ticks: { color: '#888', font: { size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#888', font: { size: 11 } },
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
  function renderLogin() {
    app.innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <div class="login-logo"><span class="accent">{</span> kahalany.dev <span class="accent">}</span></div>
          <h2 class="login-title">Admin Login</h2>
          <div id="loginError"></div>
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
        $('#loginError').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        btn.textContent = 'Sign In';
        btn.disabled = false;
      }
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
              borderColor: '#00ff88',
              backgroundColor: 'rgba(0,255,136,0.1)',
              fill: true,
              tension: 0.3,
              pointRadius: 3,
              pointBackgroundColor: '#00ff88'
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
              backgroundColor: 'rgba(0,255,136,0.3)',
              borderColor: '#00ff88',
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
        const colors = ['#00ff88', '#3b82f6', '#ffa502', '#ff4757', '#a855f7'];
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
              legend: { position: 'right', labels: { color: '#888', font: { size: 12 } } }
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
      const usersRes = await api('/auth/users');
      const users = usersRes.data.users;

      $('#mainContent').innerHTML = `
        <div class="page-header">
          <h1>Settings</h1>
          <p>Manage your account and other administrators</p>
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
                    <td>${u.id !== state.user.id ? `<button class="btn btn-danger btn-sm" data-delete-user="${u.id}">Remove</button>` : '<span class="badge badge-blue">you</span>'}</td>
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
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">Failed to load settings: ${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== ROUTER =====
  function route() {
    const hash = window.location.hash.replace('#/', '') || 'dashboard';
    if (['dashboard', 'security', 'analytics', 'settings'].includes(hash)) {
      state.page = hash;
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
