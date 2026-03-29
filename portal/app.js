/* Client Portal SPA — kahalany.dev */
(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const app = document.getElementById('app');

  // ===== STATE =====
  const state = {
    token: localStorage.getItem('portal_token'),
    user: null,
    page: 'dashboard',
    projectId: null,
    ticketId: null,
    sidebarOpen: false
  };

  // ===== API =====
  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
    const res = await fetch(`/api${path}`, { ...opts, headers });
    if (res.status === 401) {
      state.token = null; state.user = null;
      localStorage.removeItem('portal_token');
      render();
      throw new Error('Session expired');
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
    } catch { return false; }
  }

  async function login(email, password) {
    const res = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.data.user.role !== 'client') {
      throw new Error('This portal is for clients. Admins should use /admin');
    }
    state.token = res.data.token;
    state.user = res.data.user;
    localStorage.setItem('portal_token', state.token);
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
    state.token = null; state.user = null;
    localStorage.removeItem('portal_token');
    window.location.hash = '';
    render();
  }

  // ===== HELPERS =====
  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const seconds = Math.floor((new Date() - new Date(dateStr + 'Z')) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(dateStr + 'Z').toLocaleDateString();
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function statusBadge(status) {
    const map = {
      planning: 'badge-gray', proposed: 'badge-purple', approved: 'badge-blue',
      in_progress: 'badge-blue', review: 'badge-yellow', completed: 'badge-green',
      maintenance: 'badge-green', archived: 'badge-gray',
      open: 'badge-blue', closed: 'badge-gray',
      upcoming: 'badge-gray'
    };
    return `<span class="badge ${map[status] || 'badge-gray'}">${status.replace(/_/g, ' ')}</span>`;
  }

  function priorityBadge(priority) {
    const map = { urgent: 'badge-red', high: 'badge-red', medium: 'badge-yellow', low: 'badge-gray' };
    return `<span class="badge ${map[priority] || 'badge-gray'}">${priority}</span>`;
  }

  function typeBadge(type) {
    const map = { bug: 'badge-red', feature_request: 'badge-purple', modification: 'badge-yellow', question: 'badge-blue', task: 'badge-gray', maintenance: 'badge-green' };
    return `<span class="badge ${map[type] || 'badge-gray'}">${type.replace(/_/g, ' ')}</span>`;
  }

  function milestoneIcon(status) {
    const icons = { completed: '\u2713', in_progress: '\u25B6', upcoming: '\u25CB', skipped: '\u2014' };
    return icons[status] || '\u25CB';
  }

  function activityText(a) {
    const d = a.details ? (typeof a.details === 'string' ? JSON.parse(a.details) : a.details) : {};
    const who = a.user_name || 'System';
    switch (a.action) {
      case 'project_created': return `<strong>${escapeHtml(who)}</strong> created the project`;
      case 'project_proposed': return `<strong>${escapeHtml(who)}</strong> sent the project plan for review`;
      case 'project_approved': return `<strong>${escapeHtml(who)}</strong> approved the project`;
      case 'project_status_changed': return `<strong>${escapeHtml(who)}</strong> changed status to <strong>${d.new_status || '?'}</strong>`;
      case 'milestone_created': return `<strong>${escapeHtml(who)}</strong> added milestone: ${escapeHtml(d.title || '')}`;
      case 'milestone_status_changed': return `<strong>${escapeHtml(who)}</strong> marked <strong>${escapeHtml(d.title || '')}</strong> as ${d.new_status || '?'}`;
      case 'ticket_created': return `<strong>${escapeHtml(who)}</strong> created ticket #${d.ticket_number}: ${escapeHtml(d.title || '')}`;
      case 'ticket_status_changed': return `<strong>${escapeHtml(who)}</strong> changed ticket #${d.ticket_number} to ${d.new_status || '?'}`;
      case 'comment_added': return `<strong>${escapeHtml(who)}</strong> commented on ticket #${d.ticket_number || '?'}`;
      case 'plan_updated': return `<strong>${escapeHtml(who)}</strong> updated the project plan`;
      default: return `<strong>${escapeHtml(who)}</strong> — ${a.action.replace(/_/g, ' ')}`;
    }
  }

  // ===== MARKDOWN RENDERER =====
  function renderMarkdown(text) {
    if (!text) return '';
    let html = text;
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:var(--surface-3);padding:12px;border-radius:var(--radius);overflow-x:auto;font-size:12px"><code>$2</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code style="background:var(--surface-3);padding:2px 6px;border-radius:3px;font-size:12px">$1</code>');
    html = html.replace(/^#### (.+)$/gm, '<h4 style="font-size:14px;margin:16px 0 8px;color:var(--text)">$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:15px;margin:18px 0 8px;color:var(--text)">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:17px;margin:20px 0 10px;color:var(--text)">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:20px;margin:24px 0 12px;color:var(--text)">$1</h1>');
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text)">$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:16px 0">');
    html = html.replace(/^- (.+)$/gm, '<li style="margin:4px 0;margin-left:20px;color:var(--text-secondary)">$1</li>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin:4px 0;margin-left:20px;list-style:decimal;color:var(--text-secondary)">$1</li>');
    html = html.replace(/\[x\]/g, '<span style="color:var(--success)">&#9745;</span>');
    html = html.replace(/\[ \]/g, '<span style="color:var(--text-dim)">&#9744;</span>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:var(--accent)">$1</a>');
    html = html.replace(/\n\n/g, '<br><br>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  // ===== RENDER: LOGIN =====
  async function renderLogin() {
    // Check for OAuth error in URL
    const hashParams = new URLSearchParams(window.location.hash.replace('#/login', '').replace('?', ''));
    const oauthError = hashParams.get('error');
    const errorMessages = {
      oauth_denied: 'Google sign-in was cancelled',
      invalid_state: 'Invalid OAuth state. Please try again',
      oauth_not_configured: 'Google sign-in is not configured',
      token_exchange_failed: 'Failed to authenticate with Google',
      userinfo_failed: 'Could not retrieve Google account info',
      no_account: 'No account found for this Google email. Contact us to get set up.',
      use_admin: 'Admin accounts should sign in at /admin',
      use_portal: 'Client accounts should sign in here',
      server_error: 'Server error during sign-in. Please try again'
    };

    // Check if Google OAuth is enabled
    let googleEnabled = false;
    try {
      const oauthStatus = await fetch('/api/auth/oauth/status').then(r => r.json());
      googleEnabled = oauthStatus.data?.google_enabled;
    } catch {}

    app.innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <div class="login-logo"><span class="accent">{</span> kahalany.dev <span class="accent">}</span></div>
          <h2 class="login-title">Client Portal</h2>
          <div id="loginMsg">${oauthError ? `<div class="alert alert-error">${escapeHtml(errorMessages[oauthError] || 'Sign-in failed')}</div>` : ''}</div>
          ${googleEnabled ? `
            <a href="/api/auth/google?target=portal" class="btn btn-google" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:12px;margin-bottom:16px;background:#fff;color:#333;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;font-weight:500;text-decoration:none;cursor:pointer;transition:background 0.2s">
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Sign in with Google
            </a>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;color:var(--text-dim);font-size:13px"><div style="flex:1;height:1px;background:var(--border)"></div>or<div style="flex:1;height:1px;background:var(--border)"></div></div>
          ` : ''}
          <form id="loginForm">
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="loginEmail" placeholder="you@company.com" required autocomplete="email">
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
      btn.textContent = 'Signing in...'; btn.disabled = true;
      try { await login($('#loginEmail').value, $('#loginPassword').value); }
      catch (err) {
        $('#loginMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        btn.textContent = 'Sign In'; btn.disabled = false;
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
            <div class="form-group"><label>Current Password</label><input type="password" id="cpCurrent" required></div>
            <div class="form-group"><label>New Password</label><input type="password" id="cpNew" placeholder="Min 8 characters" required minlength="8"></div>
            <div class="form-group"><label>Confirm</label><input type="password" id="cpConfirm" required minlength="8"></div>
            <button type="submit" class="btn btn-primary">Change Password</button>
          </form>
        </div>
      </div>
    `;
    $('#cpForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if ($('#cpNew').value !== $('#cpConfirm').value) {
        $('#cpError').innerHTML = `<div class="alert alert-error">Passwords don't match</div>`;
        return;
      }
      const btn = $('button[type="submit"]', e.target);
      btn.textContent = 'Changing...'; btn.disabled = true;
      try { await changePassword($('#cpCurrent').value, $('#cpNew').value); }
      catch (err) {
        $('#cpError').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        btn.textContent = 'Change Password'; btn.disabled = false;
      }
    });
  }

  // ===== RENDER: LAYOUT =====
  function renderLayout(content, activeNav) {
    const navItems = state.projectId
      ? [
          { id: 'project', icon: '\u25A3', label: 'Overview', hash: `#/project/${state.projectId}` },
          { id: 'plan', icon: '\u2630', label: 'Plan', hash: `#/project/${state.projectId}/plan` },
          { id: 'tickets', icon: '\u2709', label: 'Tickets', hash: `#/project/${state.projectId}/tickets` },
          { id: 'activity', icon: '\u25CE', label: 'Activity', hash: `#/project/${state.projectId}/activity` },
        ]
      : [{ id: 'dashboard', icon: '\u25A3', label: 'Dashboard', hash: '#/dashboard' }];

    app.innerHTML = `
      <button class="mobile-toggle" id="mobileToggle">\u2630</button>
      <div class="layout">
        <aside class="sidebar ${state.sidebarOpen ? 'open' : ''}" id="sidebar">
          <div class="sidebar-logo"><span class="accent">{</span> kahalany.dev <span class="accent">}</span></div>
          <div class="sidebar-label">Client Portal</div>
          <ul class="sidebar-nav">
            <li><a href="#/dashboard" class="${!state.projectId && activeNav === 'dashboard' ? 'active' : ''}" data-nav="dashboard">
              <span class="icon">\u25A3</span> My Projects
            </a></li>
            ${state.projectId ? navItems.map(n => `
              <li><a href="${n.hash}" class="${activeNav === n.id ? 'active' : ''}" data-nav="${n.id}">
                <span class="icon">${n.icon}</span> ${n.label}
              </a></li>
            `).join('') : ''}
          </ul>
          <div class="sidebar-bottom">
            <div class="sidebar-user">${escapeHtml(state.user?.name || state.user?.email)}</div>
            <button class="btn btn-secondary btn-sm" id="logoutBtn" style="width:100%">Logout</button>
          </div>
        </aside>
        <main class="main" id="mainContent">${content}</main>
      </div>
    `;

    $$('.sidebar-nav a').forEach(a => a.addEventListener('click', () => { state.sidebarOpen = false; }));
    $('#logoutBtn').addEventListener('click', logout);
    const toggle = $('#mobileToggle');
    if (toggle) toggle.addEventListener('click', () => {
      state.sidebarOpen = !state.sidebarOpen;
      $('#sidebar').classList.toggle('open', state.sidebarOpen);
    });
  }

  // ===== RENDER: DASHBOARD =====
  async function renderDashboard() {
    state.projectId = null;
    renderLayout('<div class="loading"><div class="spinner"></div> Loading...</div>', 'dashboard');

    try {
      const res = await api('/portal/dashboard');
      const { projects, recentActivity } = res.data;

      $('#mainContent').innerHTML = `
        <div class="page-header">
          <h1>Welcome${state.user?.name ? ', ' + escapeHtml(state.user.name) : ''}</h1>
          <p>Your projects and recent activity</p>
        </div>

        ${projects.length === 0 ? `
          <div class="empty-state">
            <div class="icon">\u{1F4CB}</div>
            <p>No projects yet. We'll set one up for you soon!</p>
          </div>
        ` : projects.map(p => `
          <div class="project-card" data-project-id="${p.id}">
            <div class="project-card-header">
              <span class="project-card-name">${escapeHtml(p.name)}</span>
              ${statusBadge(p.status)}
            </div>
            <div class="progress-bar"><div class="progress-bar-fill" style="width:${p.progress_percent}%"></div></div>
            <div class="progress-label" style="display:flex;justify-content:space-between">
              <span>${p.progress_percent}% complete</span>
              <span>${p.open_tickets} open ticket${p.open_tickets !== 1 ? 's' : ''}</span>
            </div>
          </div>
        `).join('')}

        ${recentActivity.length > 0 ? `
          <div class="card" style="margin-top:24px">
            <div class="card-header"><span class="card-title">Recent Activity</span></div>
            <ul class="activity-list">
              ${recentActivity.slice(0, 10).map(a => `
                <li class="activity-item">
                  <div class="activity-dot"></div>
                  <div class="activity-text">${activityText(a)}</div>
                  <div class="activity-time">${timeAgo(a.created_at)}</div>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}
      `;

      $$('.project-card').forEach(card => card.addEventListener('click', () => {
        window.location.hash = `#/project/${card.dataset.projectId}`;
      }));
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: PROJECT =====
  async function renderProject(projectId) {
    state.projectId = projectId;
    renderLayout('<div class="loading"><div class="spinner"></div> Loading project...</div>', 'project');

    try {
      const res = await api(`/portal/projects/${projectId}`);
      const { project, milestones, open_tickets, recentActivity } = res.data;

      const showPlanApproval = project.status === 'proposed';

      $('#mainContent').innerHTML = `
        <div class="page-header">
          <h1>${escapeHtml(project.name)}</h1>
          <p>${escapeHtml(project.description || '')}</p>
        </div>

        ${showPlanApproval ? `
          <div class="alert alert-info" style="margin-bottom:24px">
            A project plan is ready for your review!
            <a href="#/project/${projectId}/plan" style="color:var(--accent);font-weight:600;margin-left:8px">View & Approve Plan</a>
          </div>
        ` : ''}

        <div class="card">
          <div class="card-header">
            <span class="card-title">Progress</span>
            ${statusBadge(project.status)}
          </div>
          <div class="progress-bar" style="height:12px;margin-bottom:12px">
            <div class="progress-bar-fill" style="width:${project.progress_percent}%"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-secondary)">
            <span>${project.progress_percent}% complete</span>
            <span>${open_tickets} open ticket${open_tickets !== 1 ? 's' : ''}</span>
          </div>
          ${project.target_date ? `<div style="font-size:12px;color:var(--text-dim);margin-top:8px">Target: ${formatDate(project.target_date)}</div>` : ''}
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">Milestones</span></div>
          ${milestones.length === 0 ? '<p style="color:var(--text-dim);font-size:14px">No milestones defined yet.</p>' : `
            <ul class="milestone-list">
              ${milestones.map(m => `
                <li class="milestone-item">
                  <div class="milestone-icon ${m.status}">${milestoneIcon(m.status)}</div>
                  <div class="milestone-content">
                    <div class="milestone-title">${escapeHtml(m.title)}</div>
                    ${m.description ? `<div class="milestone-desc">${escapeHtml(m.description)}</div>` : ''}
                    <div class="milestone-meta">
                      ${statusBadge(m.status)}
                      ${m.target_date ? ` \u2022 Target: ${formatDate(m.target_date)}` : ''}
                      ${m.completed_date ? ` \u2022 Completed: ${formatDate(m.completed_date)}` : ''}
                    </div>
                    ${m.completion_notes ? `<div class="milestone-notes">${escapeHtml(m.completion_notes)}</div>` : ''}
                  </div>
                </li>
              `).join('')}
            </ul>
          `}
        </div>

        <div style="display:flex;gap:12px;margin-bottom:24px">
          <a href="#/project/${projectId}/tickets" class="btn btn-secondary" style="flex:1;text-align:center">View Tickets</a>
          <a href="#/project/${projectId}/tickets/new" class="btn btn-primary" style="flex:1;width:auto">Create Ticket</a>
        </div>

        ${recentActivity.length > 0 ? `
          <div class="card">
            <div class="card-header"><span class="card-title">Recent Activity</span></div>
            <ul class="activity-list">
              ${recentActivity.map(a => `
                <li class="activity-item">
                  <div class="activity-dot"></div>
                  <div class="activity-text">${activityText(a)}</div>
                  <div class="activity-time">${timeAgo(a.created_at)}</div>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}
      `;
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: PLAN VIEW =====
  async function renderPlan(projectId) {
    state.projectId = projectId;
    renderLayout('<div class="loading"><div class="spinner"></div> Loading plan...</div>', 'project');

    try {
      const res = await api(`/portal/projects/${projectId}/plan`);
      const { plan, project_status } = res.data;

      $('#mainContent').innerHTML = `
        <div class="page-header">
          <h1>Project Plan</h1>
          <p>Review the proposed plan for your project</p>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">Plan v${plan.version}</span>
            <span style="font-size:12px;color:var(--text-dim)">Last updated: ${formatDate(plan.updated_at)}</span>
          </div>
          <div class="plan-content md-rendered" style="line-height:1.6;color:var(--text-secondary)">${renderMarkdown(escapeHtml(plan.content))}</div>
        </div>

        ${project_status === 'proposed' ? `
          <div class="approve-section" style="display:flex;flex-direction:column;gap:16px;align-items:center">
            <p>If you're happy with this plan, approve it to begin development.</p>
            <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
              <button class="btn btn-success" id="approveBtn" style="width:auto;padding:14px 40px;font-size:16px">
                Approve Project
              </button>
              <button class="btn btn-secondary" id="feedbackBtn" style="width:auto;padding:14px 24px;font-size:14px">
                Request Changes
              </button>
            </div>
          </div>

          <div id="feedbackForm" style="display:none;margin-top:16px">
            <div class="card">
              <div class="card-header"><span class="card-title">Plan Feedback</span></div>
              <p style="color:var(--text-dim);font-size:13px;margin-bottom:12px">Describe what changes you'd like. This will create a ticket for our team.</p>
              <textarea id="feedbackText" placeholder="What would you like changed in the plan?" style="width:100%;min-height:120px;padding:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font);font-size:14px;resize:vertical;line-height:1.5"></textarea>
              <div style="display:flex;gap:8px;margin-top:8px">
                <button class="btn btn-primary" id="submitFeedbackBtn" style="width:auto">Submit Feedback</button>
                <button class="btn btn-secondary" id="cancelFeedbackBtn" style="width:auto">Cancel</button>
              </div>
              <div id="feedbackMsg" style="margin-top:8px"></div>
            </div>
          </div>
        ` : plan.approved_at ? `
          <div class="alert alert-success">This plan was approved on ${formatDate(plan.approved_at)}.</div>
        ` : ''}
      `;

      const approveBtn = $('#approveBtn');
      if (approveBtn) {
        approveBtn.addEventListener('click', async () => {
          if (!confirm('This will approve the plan and begin development. Are you sure?')) return;
          approveBtn.textContent = 'Approving...'; approveBtn.disabled = true;
          try {
            await api(`/portal/projects/${projectId}/approve`, { method: 'POST' });
            window.location.hash = `#/project/${projectId}`;
          } catch (err) {
            alert(err.message);
            approveBtn.textContent = 'Approve Project'; approveBtn.disabled = false;
          }
        });
      }

      // Feedback form toggle
      const feedbackBtn = $('#feedbackBtn');
      if (feedbackBtn) {
        feedbackBtn.addEventListener('click', () => {
          $('#feedbackForm').style.display = 'block';
          feedbackBtn.style.display = 'none';
        });
        $('#cancelFeedbackBtn').addEventListener('click', () => {
          $('#feedbackForm').style.display = 'none';
          feedbackBtn.style.display = 'inline-flex';
        });
        $('#submitFeedbackBtn').addEventListener('click', async () => {
          const text = $('#feedbackText').value.trim();
          if (!text) { $('#feedbackMsg').innerHTML = '<div class="alert alert-error">Please describe the changes you want.</div>'; return; }
          const btn = $('#submitFeedbackBtn');
          btn.textContent = 'Submitting...'; btn.disabled = true;
          try {
            await api(`/portal/projects/${projectId}/tickets`, {
              method: 'POST',
              body: JSON.stringify({
                title: 'Plan feedback: ' + text.substring(0, 80) + (text.length > 80 ? '...' : ''),
                type: 'modification',
                priority: 'medium',
                description: text
              })
            });
            $('#feedbackMsg').innerHTML = '<div class="alert alert-success">Feedback submitted! We\'ll review and update the plan.</div>';
            $('#feedbackText').value = '';
            btn.textContent = 'Submit Feedback'; btn.disabled = false;
          } catch (err) {
            $('#feedbackMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
            btn.textContent = 'Submit Feedback'; btn.disabled = false;
          }
        });
      }
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: TICKETS =====
  async function renderTickets(projectId) {
    state.projectId = projectId;
    renderLayout('<div class="loading"><div class="spinner"></div> Loading tickets...</div>', 'tickets');

    try {
      const res = await api(`/portal/projects/${projectId}/tickets`);
      const tickets = res.data.tickets;

      $('#mainContent').innerHTML = `
        <div class="page-header" style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <h1>Tickets</h1>
            <p>Track requests, bugs, and changes</p>
          </div>
          <a href="#/project/${projectId}/tickets/new" class="btn btn-primary" style="width:auto">New Ticket</a>
        </div>

        <div class="filter-tabs" id="statusFilter">
          <button class="filter-tab active" data-status="all">All</button>
          <button class="filter-tab" data-status="open">Open</button>
          <button class="filter-tab" data-status="in_progress">In Progress</button>
          <button class="filter-tab" data-status="completed">Completed</button>
          <button class="filter-tab" data-status="closed">Closed</button>
        </div>

        <div class="card" style="padding:0">
          <div class="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Title</th><th>Type</th><th>Priority</th><th>Status</th><th>Updated</th></tr></thead>
              <tbody id="ticketTableBody">
                ${tickets.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:32px">No tickets yet</td></tr>' :
                  tickets.map(t => `<tr data-ticket-id="${t.id}" data-status="${t.status}">
                    <td style="font-family:var(--mono);font-size:12px">${t.ticket_number}</td>
                    <td style="color:var(--text);font-weight:500">${escapeHtml(t.title)}</td>
                    <td>${typeBadge(t.type)}</td>
                    <td>${priorityBadge(t.priority)}</td>
                    <td>${statusBadge(t.status)}</td>
                    <td>${timeAgo(t.updated_at)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Click to view ticket
      $$('#ticketTableBody tr[data-ticket-id]').forEach(row => {
        row.addEventListener('click', () => {
          window.location.hash = `#/project/${projectId}/tickets/${row.dataset.ticketId}`;
        });
      });

      // Filter tabs
      $$('#statusFilter .filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          $$('#statusFilter .filter-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const status = tab.dataset.status;
          $$('#ticketTableBody tr[data-ticket-id]').forEach(row => {
            row.style.display = (status === 'all' || row.dataset.status === status) ? '' : 'none';
          });
        });
      });
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: NEW TICKET =====
  function renderNewTicket(projectId) {
    state.projectId = projectId;
    renderLayout(`
      <div class="page-header">
        <h1>New Ticket</h1>
        <p>Submit a request, bug report, or question</p>
      </div>
      <div class="card">
        <div id="newTicketMsg"></div>
        <form id="newTicketForm">
          <div class="form-group">
            <label>Title</label>
            <input type="text" id="ticketTitle" placeholder="Brief description of your request" required maxlength="200">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Type</label>
              <select id="ticketType">
                <option value="modification">Change Request</option>
                <option value="bug">Bug Report</option>
                <option value="feature_request">Feature Request</option>
                <option value="question">Question</option>
                <option value="task">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label>Priority</label>
              <select id="ticketPriority">
                <option value="low">Low</option>
                <option value="medium" selected>Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="ticketDescription" placeholder="Describe what you need in detail..." maxlength="10000"></textarea>
          </div>
          <div style="display:flex;gap:12px">
            <a href="#/project/${projectId}/tickets" class="btn btn-secondary" style="flex:1;text-align:center">Cancel</a>
            <button type="submit" class="btn btn-primary" style="flex:1">Submit Ticket</button>
          </div>
        </form>
      </div>
    `, 'tickets');

    $('#newTicketForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type="submit"]', e.target);
      btn.textContent = 'Submitting...'; btn.disabled = true;
      try {
        await api(`/portal/projects/${projectId}/tickets`, {
          method: 'POST',
          body: JSON.stringify({
            title: $('#ticketTitle').value,
            type: $('#ticketType').value,
            priority: $('#ticketPriority').value,
            description: $('#ticketDescription').value
          })
        });
        window.location.hash = `#/project/${projectId}/tickets`;
      } catch (err) {
        $('#newTicketMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
        btn.textContent = 'Submit Ticket'; btn.disabled = false;
      }
    });
  }

  // ===== RENDER: TICKET DETAIL =====
  async function renderTicketDetail(projectId, ticketId) {
    state.projectId = projectId;
    state.ticketId = ticketId;
    renderLayout('<div class="loading"><div class="spinner"></div> Loading ticket...</div>', 'tickets');

    try {
      const res = await api(`/portal/projects/${projectId}/tickets/${ticketId}`);
      const { ticket, comments } = res.data;

      $('#mainContent').innerHTML = `
        <div style="margin-bottom:16px">
          <a href="#/project/${projectId}/tickets" style="color:var(--text-secondary);text-decoration:none;font-size:13px">\u2190 Back to Tickets</a>
        </div>

        <div class="ticket-header">
          <div class="ticket-title">#${ticket.ticket_number} — ${escapeHtml(ticket.title)}</div>
          <div class="ticket-meta">
            ${statusBadge(ticket.status)}
            ${typeBadge(ticket.type)}
            ${priorityBadge(ticket.priority)}
            <span>Created ${timeAgo(ticket.created_at)} by ${escapeHtml(ticket.created_by_name || 'Unknown')}</span>
            ${ticket.assigned_to_name ? `<span>Assigned to ${escapeHtml(ticket.assigned_to_name)}</span>` : ''}
          </div>
        </div>

        ${ticket.description ? `<div class="ticket-body">${escapeHtml(ticket.description)}</div>` : ''}

        <div class="card">
          <div class="card-header"><span class="card-title">Comments (${comments.length})</span></div>

          ${comments.length === 0 ? '<p style="color:var(--text-dim);font-size:14px">No comments yet.</p>' : `
            <div class="comment-list">
              ${comments.map(c => `
                <div class="comment ${c.user_role === 'client' ? 'client' : 'staff'}">
                  <div class="comment-header">
                    <span class="comment-author">${escapeHtml(c.user_name || 'Unknown')}
                      <span class="badge ${c.user_role === 'client' ? 'badge-green' : 'badge-blue'}" style="margin-left:6px">${c.user_role}</span>
                    </span>
                    <span class="comment-date">${timeAgo(c.created_at)}</span>
                  </div>
                  <div class="comment-body">${escapeHtml(c.body)}</div>
                </div>
              `).join('')}
            </div>
          `}

          ${!['closed', 'completed'].includes(ticket.status) ? `
            <div style="border-top:1px solid var(--border);padding-top:20px">
              <form id="commentForm">
                <div class="form-group" style="margin-bottom:12px">
                  <textarea id="commentBody" placeholder="Add a comment..." required maxlength="5000" style="min-height:80px"></textarea>
                </div>
                <button type="submit" class="btn btn-primary" style="width:auto">Post Comment</button>
              </form>
              <div id="commentMsg" style="margin-top:8px"></div>
            </div>
          ` : '<div style="color:var(--text-dim);font-size:13px;margin-top:16px;border-top:1px solid var(--border);padding-top:16px">This ticket is closed.</div>'}
        </div>
      `;

      const commentForm = $('#commentForm');
      if (commentForm) {
        commentForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = $('button[type="submit"]', e.target);
          btn.textContent = 'Posting...'; btn.disabled = true;
          try {
            await api(`/portal/tickets/${ticketId}/comments`, {
              method: 'POST',
              body: JSON.stringify({ body: $('#commentBody').value })
            });
            renderTicketDetail(projectId, ticketId); // Refresh
          } catch (err) {
            $('#commentMsg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
            btn.textContent = 'Post Comment'; btn.disabled = false;
          }
        });
      }
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== RENDER: ACTIVITY =====
  async function renderActivity(projectId) {
    state.projectId = projectId;
    renderLayout('<div class="loading"><div class="spinner"></div> Loading activity...</div>', 'activity');

    try {
      const res = await api(`/portal/projects/${projectId}/activity`);
      const activities = res.data.activities;

      $('#mainContent').innerHTML = `
        <div class="page-header">
          <h1>Activity</h1>
          <p>Everything that's happened on this project</p>
        </div>

        <div class="card">
          ${activities.length === 0 ? '<div class="empty-state"><p>No activity yet.</p></div>' : `
            <ul class="activity-list">
              ${activities.map(a => `
                <li class="activity-item">
                  <div class="activity-dot"></div>
                  <div class="activity-text">${activityText(a)}</div>
                  <div class="activity-time">${timeAgo(a.created_at)}</div>
                </li>
              `).join('')}
            </ul>
          `}
        </div>
      `;
    } catch (err) {
      $('#mainContent').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ===== ROUTER =====
  function route() {
    const hash = window.location.hash.replace('#/', '') || 'dashboard';
    const parts = hash.split('/');

    // #/dashboard
    if (parts[0] === 'dashboard' || hash === '') {
      return { page: 'dashboard' };
    }
    // #/project/:id
    if (parts[0] === 'project' && parts[1]) {
      const projectId = parts[1];
      // #/project/:id/plan
      if (parts[2] === 'plan') return { page: 'plan', projectId };
      // #/project/:id/tickets/new
      if (parts[2] === 'tickets' && parts[3] === 'new') return { page: 'newTicket', projectId };
      // #/project/:id/tickets/:ticketId
      if (parts[2] === 'tickets' && parts[3]) return { page: 'ticketDetail', projectId, ticketId: parts[3] };
      // #/project/:id/tickets
      if (parts[2] === 'tickets') return { page: 'tickets', projectId };
      // #/project/:id/activity
      if (parts[2] === 'activity') return { page: 'activity', projectId };
      // #/project/:id
      return { page: 'project', projectId };
    }

    return { page: 'dashboard' };
  }

  // ===== MAIN RENDER =====
  async function render() {
    if (!state.token || !state.user) {
      const authed = await checkAuth();
      if (!authed) return renderLogin();
      // Ensure client role
      if (state.user.role !== 'client') {
        app.innerHTML = `<div class="login-page"><div class="login-card">
          <div class="alert alert-error">This portal is for clients. Admins should use <a href="/admin" style="color:var(--accent)">/admin</a>.</div>
        </div></div>`;
        return;
      }
    }

    if (state.user.must_change_password) return renderChangePassword();

    const r = route();
    switch (r.page) {
      case 'project': return renderProject(r.projectId);
      case 'plan': return renderPlan(r.projectId);
      case 'tickets': return renderTickets(r.projectId);
      case 'newTicket': return renderNewTicket(r.projectId);
      case 'ticketDetail': return renderTicketDetail(r.projectId, r.ticketId);
      case 'activity': return renderActivity(r.projectId);
      default: return renderDashboard();
    }
  }

  // ===== INIT =====
  window.addEventListener('hashchange', render);
  render();
})();
