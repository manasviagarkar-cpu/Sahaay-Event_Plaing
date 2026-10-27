/**
 * @fileoverview Sahaay — Main Application Controller
 *
 * Responsibilities:
 *   - Single-page navigation and view rendering
 *   - CRUD operations for expenses, tasks, vendors, timeline items
 *   - Crisis Switch: rescue plan generation and application
 *   - Message Studio: multilingual message generation
 *   - Data export / import / reset
 *   - Onboarding form validation and event initialisation
 *
 * All user-supplied strings are HTML-escaped via esc() before insertion
 * into innerHTML. Input is also sanitised via sanitizeText() before
 * persisting to localStorage.
 *
 * @module app
 */
'use strict';

// ─── Shorthand aliases ────────────────────────────────────────
const { KEYS, Store, uid, addDays, today, daysFrom, esc, formatINR, sanitizeText,
  createDemoEvent, createDemoExpenses, createDemoTasks, createDemoVendors, createDemoTimeline,
  generateTasksForEvent, generateExpensesForEvent, generateVendorsForEvent, generateTimelineForEvent,
  generateRescuePlan, generateMessage, extractTasksFromText,
  calcBudgetStats, simulateWhatIf } = window.SahaayData;

/**
 * Optional AI backend connector.
 *
 * In demo mode this always throws, causing all AI-dependent features
 * to fall back to deterministic offline logic.
 *
 * To enable real AI responses, replace this function body with a fetch()
 * call to a **server-side** endpoint that holds the API key as an
 * environment variable (never hardcode keys in client-side code).
 *
 * @param {string} prompt - The prompt to send to the AI model.
 * @returns {Promise<string>} The generated text response.
 * @throws {Error} Always throws in demo mode.
 */
async function callAI(prompt) {
  // Connect this function to a secure backend endpoint.
  // Never expose the Gemini API key in browser code.
  // Example: return await fetch('/api/ai', {method:'POST', body: JSON.stringify({prompt})}).then(r=>r.json());
  throw new Error('AI endpoint not configured — using demo mode.');
}

// ─── Application State ────────────────────────────────────────
/** @type {string} Currently active view identifier */
let currentView = 'dashboard';
/** @type {Object|null} Current event object loaded from storage */
let currentEvent = null;
/** @type {Array} All expense records for the current event */
let currentExpenses = [];
/** @type {Array} All task/responsibility records */
let currentTasks = [];
/** @type {Array} All vendor records */
let currentVendors = [];
/** @type {Array} All timeline items */
let currentTimeline = [];
/** @type {Array} All crisis incident records */
let currentIncidents = [];
/** @type {string|null} Currently selected crisis type key */
let selectedCrisisType = null;
/** @type {string|null} Currently selected message type key */
let selectedMessageType = null;
/** @type {number|null} setInterval handle for the countdown timer */
let countdownInterval = null;
/** @type {string} Active filter for the expense table */
let expenseFilter = 'all';
/** @type {string} Active filter for the task board */
let taskFilter = 'all';
/** @type {string|null} ID of the expense being edited (null = new) */
let editingExpenseId = null;
/** @type {string|null} ID of the task being edited (null = new) */
let editingTaskId = null;
/** @type {string|null} ID of the vendor being edited (null = new) */
let editingVendorId = null;
/** @type {Object|null} Most recently generated rescue plan */
let rescuePlanData = null;

/**
 * Hydrate all in-memory state arrays from localStorage via the Store helper.
 * Called on boot and after any data import.
 */
function loadData() {
  currentEvent     = Store.get(KEYS.EVENT);
  currentExpenses  = Store.get(KEYS.EXPENSES)  || [];
  currentTasks     = Store.get(KEYS.TASKS)     || [];
  currentVendors   = Store.get(KEYS.VENDORS)   || [];
  currentTimeline  = Store.get(KEYS.TIMELINE)  || [];
  currentIncidents = Store.get(KEYS.INCIDENTS) || [];
}

/** Persist the expenses array to localStorage. */
function saveExpenses()  { Store.set(KEYS.EXPENSES,  currentExpenses); }
/** Persist the tasks array to localStorage. */
function saveTasks()     { Store.set(KEYS.TASKS,     currentTasks); }
/** Persist the vendors array to localStorage. */
function saveVendors()   { Store.set(KEYS.VENDORS,   currentVendors); }
/** Persist the timeline array to localStorage. */
function saveTimeline()  { Store.set(KEYS.TIMELINE,  currentTimeline); }
/** Persist the incidents array to localStorage. */
function saveIncidents() { Store.set(KEYS.INCIDENTS, currentIncidents); }


// ─── Toast Notifications ─────────────────────────────────────
/**
 * Display a transient notification toast at the bottom of the screen.
 *
 * @param {string} msg       - Message body text (will be HTML-escaped).
 * @param {'info'|'success'|'error'|'warning'} [type='info'] - Visual variant.
 * @param {number} [duration=3800] - Auto-dismiss delay in milliseconds.
 */
function showToast(msg, type = 'info', duration = 3800) {
  const icons = {
    info: '💬', success: '✓', error: '✕', warning: '!'
  };
  const titles = {
    info: 'Operational Update', success: 'Action Complete', error: 'Action Needed', warning: 'Attention Required'
  };
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.innerHTML = `
    <div class="toast-icon" aria-hidden="true">${icons[type] || '💬'}</div>
    <div class="toast-content">
      <div class="toast-title">${titles[type] || 'Notice'}</div>
      <div class="toast-msg">${esc(msg)}</div>
    </div>
    <button class="toast-close-btn" aria-label="Close notification" type="button">✕</button>
    <div class="toast-progress" style="animation-duration:${duration}ms"></div>
  `;
  container.appendChild(toast);
  const timer = setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 260);
  }, duration);
  const closeBtn = toast.querySelector('.toast-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      clearTimeout(timer);
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 260);
    });
  }
}

// ─── Navigation ───────────────────────────────────────────────
/**
 * Navigate to a named view, update all nav states, and render the view.
 * Closes the mobile sidebar as a side effect.
 *
 * @param {'dashboard'|'budget'|'tasks'|'timeline'|'vendors'|'crisis'|'messages'|'settings'} view
 * @param {boolean} [updateHash=true] - Whether to sync window URL hash
 */
function navigateTo(view, updateHash = true) {
  const validViews = ['dashboard', 'budget', 'tasks', 'timeline', 'vendors', 'crisis', 'messages', 'settings'];
  if (!validViews.includes(view)) {
    view = 'dashboard';
  }
  currentView = view;

  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + view);
  if (target) target.classList.add('active');

  // Update sidebar nav
  document.querySelectorAll('.nav-item').forEach(n => {
    const isActive = n.dataset.view === view;
    n.classList.toggle('active', isActive);
    n.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  // Update bottom nav
  document.querySelectorAll('.bottom-nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.view === view);
  });

  // Close mobile sidebar
  closeMobileSidebar();

  // Scroll to top of view
  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Update URL hash for redirection / bookmarking
  if (updateHash && typeof window !== 'undefined' && window.location) {
    if (window.location.hash !== '#' + view) {
      if (typeof history !== 'undefined' && history.pushState) {
        history.pushState(null, '', '#' + view);
      } else {
        window.location.hash = view;
      }
    }
  }

  // Render relevant view
  switch (view) {
    case 'dashboard': renderDashboard(); break;
    case 'budget':    renderBudget(); break;
    case 'tasks':     renderTasks(); break;
    case 'timeline':  renderTimeline(); startCountdown(); break;
    case 'vendors':   renderVendors(); break;
    case 'crisis':    renderCrisis(); break;
    case 'messages':  renderMessages(); break;
    case 'settings':  renderSettings(); break;
  }
}

// ─── Mobile sidebar ───────────────────────────────────────────
/**
 * Open the mobile sidebar overlay (only visible at ≤768 px viewport).
 */
function openMobileSidebar() {
  document.getElementById('sidebar').classList.add('mobile-open');
  document.getElementById('sidebar-overlay').classList.add('visible');
}
/**
 * Close the mobile sidebar overlay.
 */
function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}

// ─── App Boot ─────────────────────────────────────────────────
/**
 * Application entry point: load persisted data and show the correct screen.
 * If an event has been saved before, go straight to the dashboard.
 * Otherwise show the onboarding form.
 */
function bootApp() {
  loadData();
  if (currentEvent) {
    showApp();
  } else {
    showOnboarding();
  }
}

function showOnboarding() {
  document.getElementById('onboarding-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function showApp() {
  document.getElementById('onboarding-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  updateTopbar();
  updateSidebarInfo();
  buildNotifications();

  let targetView = 'dashboard';
  if (typeof window !== 'undefined' && window.location && window.location.hash) {
    const hashView = window.location.hash.replace('#', '').trim();
    if (['dashboard', 'budget', 'tasks', 'timeline', 'vendors', 'crisis', 'messages', 'settings'].includes(hashView)) {
      targetView = hashView;
    }
  }
  navigateTo(targetView, false);

  // Responsive: show menu toggle on mobile
  if (window.innerWidth <= 768) {
    document.getElementById('menu-toggle').style.display = 'flex';
  }
}

// ─── Topbar ───────────────────────────────────────────────────
function updateTopbar() {
  if (!currentEvent) return;
  document.getElementById('topbar-event-name').textContent = currentEvent.name;
  const days = daysFrom(currentEvent.date);
  document.getElementById('days-count').textContent = days > 0 ? days : (days === 0 ? 'Today!' : 'Passed');
  document.getElementById('topbar-lang').value = currentEvent.language || 'English';

  // Avatar
  const name = currentEvent.name || 'U';
  document.getElementById('topbar-avatar').textContent = name.charAt(0).toUpperCase();
}

function updateSidebarInfo() {
  if (!currentEvent) return;
  document.getElementById('sidebar-event-name').textContent = currentEvent.name;
  const d = new Date(currentEvent.date);
  document.getElementById('sidebar-event-date').textContent =
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Dashboard ────────────────────────────────────────────────
function renderDashboard() {
  renderGreeting();
  renderStatCards();
  renderTodayFocus();
  renderEventHealth();
}

function renderGreeting() {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  // Try both the old and new element IDs for backwards compatibility
  const headingEl = document.getElementById('dashboard-heading') || document.getElementById('dashboard-greeting-text');
  if (headingEl) headingEl.textContent = `${greet}, organiser.`;

  const typeEl = document.getElementById('dash-event-type');
  if (typeEl && currentEvent) {
    typeEl.textContent = `✨ ${currentEvent.type || 'Celebration'} • ${currentEvent.city || 'India'} (${currentEvent.guests || 0} Guests)`;
  }
  const pulseEl = document.getElementById('dash-pulse-status');
  if (pulseEl) {
    pulseEl.textContent = 'Command Center Live';
  }
}

function renderStatCards() {
  const stats = calcBudgetStats(currentEvent, currentExpenses);
  const completedTasks = currentTasks.filter(t => t.status === 'completed').length;
  const totalTasks = currentTasks.length;
  const pendingVendors = currentVendors.filter(v => !v.confirmed).length;
  const days = daysFrom(currentEvent?.date || today());

  const budgetPctUsed = stats.total > 0 ? Math.round((stats.committed / stats.total) * 100) : 0;
  const budgetTag = stats.overBudget
    ? { text: 'Over Budget', type: 'bad' }
    : budgetPctUsed >= 90
    ? { text: `${budgetPctUsed}% Committed`, type: 'warn' }
    : { text: `${100 - budgetPctUsed}% Available`, type: 'good' };

  const taskTag = totalTasks === 0
    ? { text: 'No Tasks', type: 'neutral' }
    : completedTasks === totalTasks
    ? { text: 'All Done ✓', type: 'good' }
    : { text: `${totalTasks - completedTasks} Pending`, type: completedTasks > 0 ? 'good' : 'warn' };

  const vendorTag = currentVendors.length === 0
    ? { text: 'No Vendors', type: 'neutral' }
    : pendingVendors === 0
    ? { text: '100% Confirmed', type: 'good' }
    : { text: `${pendingVendors} Unconfirmed`, type: 'warn' };

  const daysTag = days > 7
    ? { text: 'On Track', type: 'good' }
    : days >= 0
    ? { text: 'Final Stretch', type: 'warn' }
    : { text: 'Concluded', type: 'neutral' };

  const cards = [
    {
      cardClass: 'stat-budget',
      label: 'Budget Remaining',
      value: formatINR(stats.remaining),
      sub: `of ${formatINR(stats.total)} total budget`,
      tag: budgetTag,
      icon: '₹',
      iconBg: 'rgba(214,168,79,0.18)',
      iconColor: 'var(--gold)',
      danger: stats.overBudget,
    },
    {
      cardClass: 'stat-tasks',
      label: 'Tasks Completed',
      value: `${completedTasks} of ${totalTasks}`,
      sub: `${totalTasks - completedTasks} responsibilities pending`,
      tag: taskTag,
      icon: '✓',
      iconBg: 'rgba(46,125,104,0.15)',
      iconColor: 'var(--emerald)',
    },
    {
      cardClass: 'stat-vendors',
      label: 'Vendor Confirmations',
      value: `${currentVendors.length - pendingVendors} of ${currentVendors.length}`,
      sub: `${pendingVendors} awaiting final confirmation`,
      tag: vendorTag,
      icon: '🏪',
      iconBg: 'rgba(232,137,50,0.15)',
      iconColor: 'var(--saffron)',
      danger: pendingVendors > 0 && days <= 7,
    },
    {
      cardClass: 'stat-days',
      label: 'Days to Celebration',
      value: days > 0 ? days : (days === 0 ? 'Today!' : Math.abs(days) + 'd ago'),
      sub: currentEvent ? new Date(currentEvent.date).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'}) : '—',
      tag: daysTag,
      icon: '🗓',
      iconBg: 'rgba(100,28,50,0.12)',
      iconColor: 'var(--maroon)',
    },
  ];

  const container = document.getElementById('stat-cards');
  container.innerHTML = cards.map(c => `
    <div class="card stat-card ${c.cardClass}">
      <div class="stat-card-top">
        <div class="stat-icon" style="background:${c.iconBg};color:${c.iconColor};font-size:1.25rem">${c.icon}</div>
        <span class="stat-tag ${c.tag.type}">${esc(c.tag.text)}</span>
      </div>
      <div class="stat-value" style="${c.danger ? 'color:var(--alert)' : ''}">${esc(String(c.value))}</div>
      <div class="stat-label">${esc(c.label)}</div>
      <div class="stat-sub">${esc(c.sub)}</div>
    </div>
  `).join('');
}

function renderTodayFocus() {
  const urgent = currentTasks
    .filter(t => t.status !== 'completed' && (t.priority === 'urgent' || t.priority === 'high'))
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 3);

  const container = document.getElementById('today-focus-list');
  if (urgent.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:28px 20px;margin:0">
        <div class="empty-state-icon-wrap" style="width:48px;height:48px;font-size:1.6rem;margin-bottom:10px">🎉</div>
        <h3 style="font-size:1.1rem;margin-bottom:4px">All Clear For Today</h3>
        <p style="margin-bottom:14px;font-size:0.85rem">No urgent bottlenecks on your radar. Review the board or relax.</p>
        <button class="btn btn-ghost btn-sm" onclick="navigateTo('tasks')">Open Responsibility Board</button>
      </div>`;
    return;
  }

  container.innerHTML = urgent.map(t => {
    const deadlineStr = t.deadline ? new Date(t.deadline).toLocaleDateString('en-IN', {day:'numeric',month:'short'}) : '';
    return `
      <div class="focus-task ${t.status === 'completed' ? 'done' : ''}" data-priority="${esc(t.priority)}" data-id="${esc(t.id)}">
        <div class="focus-task-info">
          <div class="focus-task-name ${t.status === 'completed' ? 'done' : ''}">${esc(t.name)}</div>
          <div class="focus-task-meta">
            ${t.owner ? `<span>👤 ${esc(t.owner)}</span>` : ''}
            ${deadlineStr ? `<span>📅 ${deadlineStr}</span>` : ''}
            <span class="badge badge-${esc(t.priority)}">${esc(t.priority)}</span>
          </div>
        </div>
        ${t.status !== 'completed' ? `<button class="btn btn-success btn-sm" onclick="completeTask('${esc(t.id)}')">✓ Done</button>` : '<span class="text-small text-success fw-bold">✓ Done</span>'}
      </div>
    `;
  }).join('');
}

function renderEventHealth() {
  const stats = calcBudgetStats(currentEvent, currentExpenses);
  const completedTasks = currentTasks.filter(t => t.status === 'completed').length;
  const totalTasks = currentTasks.length;
  const confirmedVendors = currentVendors.filter(v => v.confirmed).length;
  const totalVendors = currentVendors.length;

  const budgetPct = stats.total ? Math.min(100, Math.round((stats.remaining / stats.total) * 100)) : 100;
  const taskPct = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const vendorPct = totalVendors ? Math.round((confirmedVendors / totalVendors) * 100) : 0;

  const budgetStatus = budgetPct >= 30 ? 'good' : budgetPct >= 10 ? 'warn' : 'bad';
  const taskStatus   = taskPct >= 60 ? 'good' : taskPct >= 30 ? 'warn' : 'bad';
  const vendorStatus = vendorPct >= 70 ? 'good' : vendorPct >= 40 ? 'warn' : 'bad';

  // Overall badge
  const healthBadge = document.getElementById('health-overall-badge');
  if (healthBadge) {
    if (budgetStatus === 'bad' || taskStatus === 'bad') {
      healthBadge.textContent = 'Attention Needed';
      healthBadge.style.color = 'var(--alert)';
      healthBadge.style.background = 'rgba(185,74,72,0.12)';
    } else if (budgetStatus === 'warn' || vendorStatus === 'warn') {
      healthBadge.textContent = 'Operational Review';
      healthBadge.style.color = '#b36020';
      healthBadge.style.background = 'rgba(232,137,50,0.12)';
    } else {
      healthBadge.textContent = 'All Systems Nominal';
      healthBadge.style.color = 'var(--emerald)';
      healthBadge.style.background = 'rgba(46,125,104,0.12)';
    }
  }

  const bars = [
    { label: 'Budget Runway',   pct: budgetPct, status: budgetStatus, text: `${budgetPct}% remaining` },
    { label: 'Task Execution',  pct: taskPct,   status: taskStatus,   text: `${completedTasks}/${totalTasks} done` },
    { label: 'Vendor Readiness',pct: vendorPct, status: vendorStatus, text: `${confirmedVendors}/${totalVendors} confirmed` },
  ];

  const colorMap = { good: 'success', warn: 'warning', bad: 'danger' };

  document.getElementById('event-health-bars').innerHTML = bars.map(b => `
    <div class="health-item">
      <div class="health-label">
        <span>${esc(b.label)}</span>
        <span class="health-status ${esc(b.status)}">${esc(b.text)}</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar ${colorMap[b.status]}" style="width:${b.pct}%"></div>
      </div>
    </div>
  `).join('');
}

// ─── Budget ───────────────────────────────────────────────────
function renderBudget() {
  renderBudgetOverview();
  renderCategorySummary();
  renderExpenseTable();
}

function renderBudgetOverview() {
  const stats = calcBudgetStats(currentEvent, currentExpenses);
  const items = [
    { label: 'Total Budget',   amount: stats.total,     color: 'var(--ink)', sub: 'Approved allocation' },
    { label: 'Committed',      amount: stats.committed, color: 'var(--saffron)', sub: `${stats.total > 0 ? Math.round((stats.committed/stats.total)*100) : 0}% of budget` },
    { label: 'Paid',           amount: stats.paid,      color: 'var(--emerald)', sub: 'Confirmed cleared' },
    { label: 'Pending',        amount: stats.pending,   color: 'var(--gold)', sub: 'Yet to be committed' },
    { label: 'Optional',       amount: stats.optional,  color: 'var(--maroon)', sub: 'Can be scaled back' },
    {
      label: 'Remaining',
      amount: stats.remaining,
      color: stats.overBudget ? 'var(--alert)' : 'var(--emerald)',
      hero: true,
      overBudget: stats.overBudget,
      sub: stats.overBudget ? 'Deficit warning' : 'Available runway'
    },
  ];

  document.getElementById('budget-stats-grid').innerHTML = items.map(i => `
    <div class="budget-stat ${i.hero ? 'hero-stat ' + (i.overBudget ? 'over-budget' : '') : ''}">
      <div class="stat-top-row">
        <span class="label">${esc(i.label)}</span>
        ${i.hero ? `<span class="stat-tag ${i.overBudget ? 'bad' : 'good'}">${i.overBudget ? 'Exceeded' : 'Healthy'}</span>` : ''}
      </div>
      <span class="amount" style="color:${i.color}">${formatINR(i.amount)}</span>
      <div class="sub-text">${esc(i.sub)}</div>
    </div>
  `).join('');

  // Visual bar
  const total = stats.total || 1;
  const segments = [
    { width: (stats.paid / total * 100).toFixed(1),      color: 'var(--emerald)', label: 'Paid' },
    { width: ((stats.committed - stats.paid) / total * 100).toFixed(1), color: 'var(--saffron)', label: 'Promised' },
    { width: (stats.pending / total * 100).toFixed(1),   color: 'var(--gold)',    label: 'Pending' },
  ];
  document.getElementById('budget-visual-bar').innerHTML = segments.map(s =>
    `<div class="budget-bar-segment" style="width:${Math.max(0,s.width)}%;background:${s.color}" title="${s.label}: ${s.width}%"></div>`
  ).join('');
  document.getElementById('budget-bar-legend').innerHTML = segments.map(s =>
    `<span class="legend-pill"><span class="legend-dot" style="background:${s.color}"></span>${s.label}: ${s.width}%</span>`
  ).join('');
}

function getCategoryColor(cat) {
  const map = {
    'Venue': '#641C32', 'Catering': '#E88932', 'Decoration': '#D6A84F',
    'Photography': '#2E7D68', 'Transport': '#4a7fa8', 'Invitations': '#9b59b6',
    'Guest support': '#e74c3c', 'Emergency': '#B94A48', 'Other': '#7f8c8d'
  };
  return map[cat] || '#888';
}

function renderCategorySummary() {
  const cats = {};
  currentExpenses.forEach(e => {
    const c = e.category || 'Other';
    cats[c] = (cats[c] || 0) + Number(e.amount || 0);
  });
  const catIcons = {
    'Venue': '🏰', 'Catering': '🍽️', 'Decoration': '🌸', 'Photography': '📸',
    'Transport': '🚗', 'Invitations': '💌', 'Guest support': '🤝', 'Emergency': '🚨', 'Other': '📦'
  };
  const total = Object.values(cats).reduce((s, v) => s + v, 0) || 1;
  const entries = Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  if (entries.length === 0) {
    document.getElementById('category-summary-list').innerHTML = `
      <div class="text-muted text-small text-center" style="padding:14px">No expense categories to summarize yet.</div>`;
    return;
  }
  const html = entries.map(([cat, amt]) => {
    const pct = (amt / total * 100).toFixed(0);
    const color = getCategoryColor(cat);
    const icon = catIcons[cat] || '🏷️';
    return `
      <div class="category-summary-row">
        <span class="cat-chip"><span style="width:10px;height:10px;border-radius:50%;background:${color}"></span>${icon} ${esc(cat)}</span>
        <div style="flex:1;min-width:120px">
          <div class="progress-bar-wrap" style="margin:0;height:8px">
            <div class="progress-bar" style="width:${pct}%;background:${color}"></div>
          </div>
        </div>
        <span style="font-size:0.80rem;color:var(--color-text-muted);min-width:38px;text-align:right">${pct}%</span>
        <span style="font-size:0.92rem;font-weight:700;min-width:90px;text-align:right;color:var(--ink)">${formatINR(amt)}</span>
      </div>
    `;
  }).join('');
  document.getElementById('category-summary-list').innerHTML = html;
}

function renderExpenseTable() {
  const filtered = expenseFilter === 'all'
    ? currentExpenses
    : currentExpenses.filter(e => e.status === expenseFilter);

  if (filtered.length === 0) {
    document.getElementById('expense-table-wrap').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon-wrap">💸</div>
        <h3>No Expenses Recorded</h3>
        <p>Log your vendor payments, decor advances, and rentals to keep budgets accurate.</p>
        <button class="btn btn-primary" onclick="openAddExpenseModal()">Add First Expense</button>
      </div>`;
    return;
  }

  const rows = filtered.map(e => {
    const dueStr = e.dueDate ? new Date(e.dueDate).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'}) : '—';
    const catColor = getCategoryColor(e.category);
    return `
      <tr>
        <td><strong>${esc(e.name)}</strong></td>
        <td><span style="display:inline-flex;align-items:center;gap:6px;font-size:0.84rem"><span style="width:8px;height:8px;border-radius:50%;background:${catColor}"></span>${esc(e.category)}</span></td>
        <td class="expense-amount-cell">${formatINR(e.amount)}</td>
        <td><span class="badge badge-${esc(e.status)}">${esc(e.status)}</span></td>
        <td style="color:var(--color-text-muted);font-size:0.82rem">${dueStr}</td>
        <td>
          <div class="expense-actions">
            <button class="btn btn-ghost btn-sm btn-icon" onclick="openEditExpenseModal('${esc(e.id)}')" title="Edit expense" aria-label="Edit ${esc(e.name)}">✏️</button>
            <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteExpense('${esc(e.id)}')" title="Delete expense" aria-label="Delete ${esc(e.name)}">🗑</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('expense-table-wrap').innerHTML = `
    <div class="expense-table-container">
      <table class="expense-table" role="table" aria-label="Expense list">
        <thead>
          <tr>
            <th>Name</th><th>Category</th><th>Amount</th><th>Status</th><th>Due Date</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ─── Expense Modal ────────────────────────────────────────────
function openAddExpenseModal(prefill = {}) {
  editingExpenseId = prefill.id || null;
  const title = editingExpenseId ? 'Edit Expense' : 'Add Expense';
  const html = `
    <div class="form-group">
      <label class="form-label" for="exp-name">Expense name <span class="required">*</span></label>
      <input type="text" id="exp-name" class="form-control" value="${esc(prefill.name||'')}" placeholder="e.g. Venue booking advance" required />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="exp-category">Category</label>
        <select id="exp-category" class="form-control">
          ${['Venue','Catering','Decoration','Photography','Transport','Invitations','Guest support','Emergency','Other']
            .map(c => `<option value="${c}" ${prefill.category===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="exp-amount">Amount (₹) <span class="required">*</span></label>
        <input type="number" id="exp-amount" class="form-control" value="${esc(String(prefill.amount||''))}" placeholder="e.g. 25000" min="0" required />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="exp-status">Status</label>
        <select id="exp-status" class="form-control">
          ${['paid','promised','pending','optional']
            .map(s => `<option value="${s}" ${prefill.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="exp-due">Due date</label>
        <input type="date" id="exp-due" class="form-control" value="${esc(prefill.dueDate||'')}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="exp-notes">Notes</label>
      <textarea id="exp-notes" class="form-control" rows="2" placeholder="Any extra details…">${esc(prefill.notes||'')}</textarea>
    </div>
  `;

  openModal(title, html, () => {
    const name   = sanitizeText(document.getElementById('exp-name').value, 200);
    const amount = parseFloat(document.getElementById('exp-amount').value);
    if (!name) { showToast('Please enter an expense name.', 'error'); return false; }
    if (isNaN(amount) || amount < 0) { showToast('Please enter a valid amount (0 or more).', 'error'); return false; }
    if (amount > 10000000) { showToast('Amount seems unreasonably large. Please check.', 'error'); return false; }

    const expense = {
      id: editingExpenseId || uid(),
      eventId: currentEvent.id,
      name,
      category: document.getElementById('exp-category').value,
      amount,
      status: document.getElementById('exp-status').value,
      dueDate: document.getElementById('exp-due').value,
      notes: sanitizeText(document.getElementById('exp-notes').value, 500),
      createdAt: new Date().toISOString(),
    };

    if (editingExpenseId) {
      const idx = currentExpenses.findIndex(e => e.id === editingExpenseId);
      if (idx !== -1) currentExpenses[idx] = expense;
      showToast('Expense updated.', 'success');
    } else {
      currentExpenses.push(expense);
      showToast('Expense added.', 'success');
    }
    saveExpenses();
    renderBudget();
    return true;
  });
}

function openEditExpenseModal(id) {
  const expense = currentExpenses.find(e => e.id === id);
  if (expense) openAddExpenseModal(expense);
}

function deleteExpense(id) {
  openConfirmModal(
    'Delete Expense',
    'Are you sure you want to delete this expense? This cannot be undone.',
    () => {
      currentExpenses = currentExpenses.filter(e => e.id !== id);
      saveExpenses();
      renderBudget();
      showToast('Expense deleted.', 'success');
      return true;
    }
  );
}

// ─── What-If Simulation ───────────────────────────────────────
function runWhatIf() {
  const extraGuests    = parseInt(document.getElementById('wi-guests').value) || 0;
  const unexpectedExp  = parseFloat(document.getElementById('wi-expense').value) || 0;
  const budgetReduction= parseFloat(document.getElementById('wi-budget-cut').value) || 0;

  if (extraGuests === 0 && unexpectedExp === 0 && budgetReduction === 0) {
    showToast('Enter at least one change to simulate.', 'warning');
    return;
  }

  const result = simulateWhatIf(currentEvent, currentExpenses, { extraGuests, unexpectedExpense: unexpectedExp, budgetReduction });

  const resultEl = document.getElementById('wi-result');
  resultEl.style.display = 'block';
  resultEl.innerHTML = `
    <div class="whatif-result ${result.overBudget ? 'danger' : ''}">
      <div class="fw-bold mb-1" style="font-size:0.93rem;color:var(--maroon)">Simulation Result</div>
      ${result.breakdown.map(b => `
        <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px">
          <span>${esc(b.label)}</span>
          <strong style="color:var(--alert)">+${formatINR(b.amount)}</strong>
        </div>
      `).join('')}
      <div class="sep"></div>
      <div style="display:flex;justify-content:space-between;font-size:0.93rem;font-weight:700;margin-bottom:6px">
        <span>Total additional cost</span>
        <span style="color:${result.overBudget ? 'var(--alert)' : 'var(--saffron)'}">${formatINR(result.impact)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.93rem;font-weight:700">
        <span>New remaining budget</span>
        <span style="color:${result.overBudget ? 'var(--alert)' : 'var(--emerald)'}">${formatINR(result.newRemaining)}</span>
      </div>
      ${result.overBudget ? `
        <div style="margin-top:10px;font-size:0.82rem;color:var(--alert)">
          <strong>⚠ Over budget.</strong> Recommended cuts:<br>
          <ul style="margin:6px 0 0 16px">${result.cuts.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
        </div>
      ` : ''}
      <div class="d-flex gap-1 mt-2">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('wi-result').style.display='none';['wi-guests','wi-expense','wi-budget-cut'].forEach(id=>document.getElementById(id).value='')">Cancel</button>
      </div>
    </div>
  `;
}

// ─── Tasks ────────────────────────────────────────────────────
function renderTasks() {
  const filtered = taskFilter === 'all' ? currentTasks
    : taskFilter === 'completed' ? currentTasks.filter(t => t.status === 'completed')
    : taskFilter === 'pending'   ? currentTasks.filter(t => t.status !== 'completed')
    : taskFilter === 'urgent'    ? currentTasks.filter(t => t.priority === 'urgent' && t.status !== 'completed')
    : currentTasks;

  const container = document.getElementById('tasks-grid');
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="empty-state-icon">📋</span>
        <h3>No tasks here</h3>
        <p>Add responsibilities to keep the team aligned.</p>
        <button class="btn btn-primary" onclick="openAddTaskModal()">Add First Task</button>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(t => renderTaskCard(t)).join('');
}

function renderTaskCard(t) {
  const deadlineStr = t.deadline ? new Date(t.deadline).toLocaleDateString('en-IN', {day:'numeric',month:'short'}) : '—';
  const isOverdue = t.deadline && t.status !== 'completed' && new Date(t.deadline) < new Date();
  return `
    <div class="card task-card ${t.status === 'completed' ? 'completed' : ''}" data-priority="${esc(t.priority)}" data-id="${esc(t.id)}">
      <div class="task-card-header">
        <div>
          <div class="task-name ${t.status === 'completed' ? 'done' : ''}">${esc(t.name)}</div>
          <div class="task-meta-row">
            ${t.category ? `<span class="task-meta-item">🏷 ${esc(t.category)}</span>` : ''}
            ${t.owner    ? `<span class="task-meta-item">👤 ${esc(t.owner)}</span>` : ''}
            ${t.backup   ? `<span class="task-meta-item">🔄 ${esc(t.backup)}</span>` : ''}
            <span class="task-meta-item ${isOverdue ? 'text-danger' : ''}">📅 ${deadlineStr}${isOverdue ? ' (Overdue)' : ''}</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;align-items:flex-start">
          <span class="badge badge-${esc(t.priority)}">${esc(t.priority)}</span>
          ${t.status === 'completed' ? '<span class="badge badge-completed">Done</span>' : ''}
        </div>
      </div>
      ${t.notes ? `<div class="text-small text-muted" style="margin-top:4px;padding-left:2px">${esc(t.notes)}</div>` : ''}
      <div class="task-actions">
        ${t.status !== 'completed'
          ? `<button class="btn btn-success btn-sm" onclick="completeTask('${esc(t.id)}')">✓ Mark Complete</button>`
          : `<button class="btn btn-ghost btn-sm" onclick="reopenTask('${esc(t.id)}')">↩ Reopen</button>`}
        <button class="btn btn-ghost btn-sm" onclick="openEditTaskModal('${esc(t.id)}')">✏️ Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteTask('${esc(t.id)}')">🗑 Delete</button>
      </div>
    </div>
  `;
}

function completeTask(id) {
  const task = currentTasks.find(t => t.id === id);
  if (task) {
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    saveTasks();
    showToast(`"${task.name}" marked complete! 🎉`, 'success');
    if (currentView === 'tasks') renderTasks();
    if (currentView === 'dashboard') renderDashboard();
  }
}

function reopenTask(id) {
  const task = currentTasks.find(t => t.id === id);
  if (task) {
    task.status = 'pending';
    delete task.completedAt;
    saveTasks();
    if (currentView === 'tasks') renderTasks();
    if (currentView === 'dashboard') renderDashboard();
  }
}

function deleteTask(id) {
  openConfirmModal('Delete Task', 'Delete this task? This cannot be undone.', () => {
    currentTasks = currentTasks.filter(t => t.id !== id);
    saveTasks();
    renderTasks();
    showToast('Task deleted.', 'success');
    return true;
  });
}

function openAddTaskModal(prefill = {}) {
  editingTaskId = prefill.id || null;
  const title = editingTaskId ? 'Edit Task' : 'Add Task';
  const html = `
    <div class="form-group">
      <label class="form-label" for="task-name-inp">Task name <span class="required">*</span></label>
      <input type="text" id="task-name-inp" class="form-control" value="${esc(prefill.name||'')}" placeholder="e.g. Confirm caterer" required />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="task-category-inp">Category</label>
        <input type="text" id="task-category-inp" class="form-control" value="${esc(prefill.category||'')}" placeholder="e.g. Catering" />
      </div>
      <div class="form-group">
        <label class="form-label" for="task-priority-inp">Priority</label>
        <select id="task-priority-inp" class="form-control">
          <option value="urgent" ${prefill.priority==='urgent'?'selected':''}>Urgent</option>
          <option value="high"   ${prefill.priority==='high'?'selected':''}>High</option>
          <option value="normal" ${(!prefill.priority||prefill.priority==='normal')?'selected':''}>Normal</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="task-owner-inp">Owner</label>
        <input type="text" id="task-owner-inp" class="form-control" value="${esc(prefill.owner||'')}" placeholder="e.g. Aman" />
      </div>
      <div class="form-group">
        <label class="form-label" for="task-backup-inp">Backup person</label>
        <input type="text" id="task-backup-inp" class="form-control" value="${esc(prefill.backup||'')}" placeholder="e.g. Priya" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="task-deadline-inp">Deadline</label>
      <input type="date" id="task-deadline-inp" class="form-control" value="${esc(prefill.deadline||'')}" />
    </div>
    <div class="form-group">
      <label class="form-label" for="task-notes-inp">Notes</label>
      <textarea id="task-notes-inp" class="form-control" rows="2" placeholder="Any extra details…">${esc(prefill.notes||'')}</textarea>
    </div>
  `;

  openModal(title, html, () => {
    const name = sanitizeText(document.getElementById('task-name-inp').value, 200);
    if (!name) { showToast('Please enter a task name.', 'error'); return false; }
    const task = {
      id: editingTaskId || uid(),
      eventId: currentEvent.id,
      name,
      category: sanitizeText(document.getElementById('task-category-inp').value, 100),
      priority: document.getElementById('task-priority-inp').value,
      owner: sanitizeText(document.getElementById('task-owner-inp').value, 100),
      backup: sanitizeText(document.getElementById('task-backup-inp').value, 100),
      deadline: document.getElementById('task-deadline-inp').value,
      notes: sanitizeText(document.getElementById('task-notes-inp').value, 500),
      status: prefill.status || 'pending',
      createdAt: new Date().toISOString(),
    };
    if (editingTaskId) {
      const idx = currentTasks.findIndex(t => t.id === editingTaskId);
      if (idx !== -1) currentTasks[idx] = task;
      showToast('Task updated.', 'success');
    } else {
      currentTasks.push(task);
      showToast('Task added.', 'success');
    }
    saveTasks();
    renderTasks();
    return true;
  });
}

function openEditTaskModal(id) {
  const task = currentTasks.find(t => t.id === id);
  if (task) openAddTaskModal(task);
}

// ─── Extract Tasks ────────────────────────────────────────────
function runExtractTasks() {
  const text = document.getElementById('extract-input').value.trim();
  if (!text) { showToast('Please paste a message to extract tasks from.', 'warning'); return; }
  const extracted = extractTasksFromText(text);
  if (extracted.length === 0) {
    showToast('No tasks could be extracted. Try a clearer message with names and actions.', 'warning');
    return;
  }

  const previewEl = document.getElementById('extract-preview');
  previewEl.style.display = 'block';
  previewEl.innerHTML = `
    <div class="fw-bold mb-2" style="color:var(--maroon)">${extracted.length} task${extracted.length>1?'s':''} found — review before adding:</div>
    ${extracted.map((t, i) => `
      <div style="background:var(--white);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:12px;margin-bottom:8px">
        <input type="text" class="form-control mb-1" id="ext-name-${i}" value="${esc(t.name)}" placeholder="Task name" />
        <div class="form-row" style="gap:8px">
          <input type="text" class="form-control" id="ext-owner-${i}" value="${esc(t.owner)}" placeholder="Owner" />
          <input type="date" class="form-control" id="ext-deadline-${i}" value="${esc(t.deadline)}" />
        </div>
      </div>
    `).join('')}
    <div class="d-flex gap-1 mt-2">
      <button class="btn btn-primary btn-sm" onclick="confirmExtractedTasks(${extracted.length})">Add All Tasks</button>
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('extract-preview').style.display='none';document.getElementById('extract-input').value=''">Cancel</button>
    </div>
  `;
}

function confirmExtractedTasks(count) {
  let added = 0;
  for (let i = 0; i < count; i++) {
    const nameEl = document.getElementById(`ext-name-${i}`);
    const ownerEl = document.getElementById(`ext-owner-${i}`);
    const deadlineEl = document.getElementById(`ext-deadline-${i}`);
    if (!nameEl) continue;
    const name = nameEl.value.trim();
    if (!name) continue;
    currentTasks.push({
      id: uid(), eventId: currentEvent.id,
      name,
      category: 'Extracted',
      owner: ownerEl ? ownerEl.value.trim() : '',
      backup: '', deadline: deadlineEl ? deadlineEl.value : '',
      priority: 'normal', status: 'pending', notes: '',
      createdAt: new Date().toISOString(),
    });
    added++;
  }
  saveTasks();
  document.getElementById('extract-preview').style.display = 'none';
  document.getElementById('extract-input').value = '';
  renderTasks();
  showToast(`${added} task${added>1?'s':''} added successfully!`, 'success');
}

// ─── Timeline ─────────────────────────────────────────────────
function renderTimeline() {
  startCountdown();
  const phases = ['30 days before','14 days before','7 days before','3 days before','1 day before','Event day','After event'];
  const grouped = {};
  phases.forEach(p => { grouped[p] = []; });
  currentTimeline.forEach(item => {
    if (!grouped[item.phase]) grouped[item.phase] = [];
    grouped[item.phase].push(item);
  });

  const container = document.getElementById('timeline-phases');
  if (currentTimeline.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon-wrap">📅</div>
        <h3>No Timeline Milestones Yet</h3>
        <p>Build your celebration run-of-show so coordinators and families never miss a beat.</p>
        <button class="btn btn-primary" onclick="document.getElementById('tl-task').focus()">Add First Milestone</button>
      </div>`;
    return;
  }

  container.innerHTML = phases.map(phase => {
    const items = grouped[phase] || [];
    if (items.length === 0) return '';
    return `
      <div class="timeline-phase">
        <div class="timeline-phase-header">
          <span class="timeline-phase-label">${esc(phase)}</span>
          <div class="timeline-phase-line"></div>
        </div>
        ${items.map(item => `
          <div class="timeline-item ${item.status === 'completed' ? 'done' : ''}" data-id="${esc(item.id)}">
            <div class="timeline-dot"></div>
            <span class="timeline-task">${esc(item.task)}</span>
            ${item.owner ? `<span class="timeline-owner">👤 ${esc(item.owner)}</span>` : ''}
            ${item.date  ? `<span class="timeline-date">${new Date(item.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>` : ''}
            <button class="btn btn-ghost btn-sm" style="flex-shrink:0" onclick="toggleTimelineItem('${esc(item.id)}')">${item.status === 'completed' ? '↩ Undo' : '✓ Done'}</button>
            <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteTimelineItem('${esc(item.id)}')" title="Delete" aria-label="Delete timeline item">🗑</button>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}

function toggleTimelineItem(id) {
  const item = currentTimeline.find(i => i.id === id);
  if (item) {
    item.status = item.status === 'completed' ? 'pending' : 'completed';
    saveTimeline();
    renderTimeline();
    if (item.status === 'completed') showToast('Timeline milestone completed! ✓', 'success');
  }
}

function deleteTimelineItem(id) {
  openConfirmModal('Delete Timeline Item', 'Remove this milestone from the timeline?', () => {
    currentTimeline = currentTimeline.filter(i => i.id !== id);
    saveTimeline();
    renderTimeline();
    showToast('Removed from timeline.', 'success');
    return true;
  });
}

function addTimelineItem() {
  const task = document.getElementById('tl-task').value.trim();
  const phase = document.getElementById('tl-phase').value;
  const owner = document.getElementById('tl-owner').value.trim();
  if (!task) { showToast('Please enter a milestone or task name.', 'warning'); return; }
  currentTimeline.push({
    id: uid(), eventId: currentEvent.id,
    phase, task, owner, date: today(), status: 'pending',
    createdAt: new Date().toISOString(),
  });
  saveTimeline();
  document.getElementById('tl-task').value = '';
  document.getElementById('tl-owner').value = '';
  renderTimeline();
  showToast('Milestone added to timeline.', 'success');
}

function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

function updateCountdown() {
  if (!currentEvent) return;
  const target = new Date(currentEvent.date);
  target.setHours(9, 0, 0, 0); // Assume celebration starts 9 AM
  const now = new Date();
  const diff = target - now;

  const daysEl   = document.getElementById('cd-days');
  const hoursEl  = document.getElementById('cd-hours');
  const minsEl   = document.getElementById('cd-mins');
  const secsEl   = document.getElementById('cd-secs');
  const statusEl = document.getElementById('cd-status-badge');
  const titleEl  = document.getElementById('cd-title');

  if (titleEl && currentEvent.name) {
    titleEl.textContent = `Time Until ${currentEvent.name}`;
  }

  if (diff <= 0) {
    if (daysEl)  daysEl.textContent  = '00';
    if (hoursEl) hoursEl.textContent = '00';
    if (minsEl)  minsEl.textContent  = '00';
    if (secsEl)  secsEl.textContent  = '00';
    if (statusEl) statusEl.textContent = '🎉 Celebration Day is here! Live Operations active.';
    return;
  }
  const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins  = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs  = Math.floor((diff % (1000 * 60)) / 1000);

  if (daysEl)  daysEl.textContent  = String(days).padStart(2, '0');
  if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
  if (minsEl)  minsEl.textContent  = String(mins).padStart(2, '0');
  if (secsEl)  secsEl.textContent  = String(secs).padStart(2, '0');

  if (statusEl) {
    statusEl.textContent = days > 7
      ? `⏳ ${days} days remaining • Core planning in progress`
      : days > 1
      ? `⚡ Final week preparations • Vendor locks underway`
      : days === 1
      ? `🔥 Tomorrow is the celebration! Final setup in progress`
      : `🌟 Hours away • Celebration Operations live`;
  }
}

// ─── Vendors ──────────────────────────────────────────────────
function renderVendors() {
  renderVendorSummary();
  renderVendorGrid();
}

function renderVendorSummary() {
  const total = currentVendors.length;
  const confirmed = currentVendors.filter(v => v.confirmed).length;
  const totalQuoted = currentVendors.reduce((s, v) => s + Number(v.quoted || 0), 0);
  const totalAdvance = currentVendors.reduce((s, v) => s + Number(v.advance || 0), 0);

  document.getElementById('vendor-summary-grid').innerHTML = `
    <div class="card budget-stat">
      <span class="amount">${total}</span>
      <span class="label">Total Vendors</span>
    </div>
    <div class="card budget-stat">
      <span class="amount" style="color:var(--emerald)">${confirmed}</span>
      <span class="label">Confirmed</span>
    </div>
    <div class="card budget-stat">
      <span class="amount" style="color:var(--saffron)">${formatINR(totalQuoted)}</span>
      <span class="label">Total Quoted</span>
    </div>
  `;
}

function renderVendorGrid() {
  const container = document.getElementById('vendors-grid');
  if (currentVendors.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="empty-state-icon">🏪</span>
        <h3>No vendors added</h3>
        <p>Add a vendor to track confirmation, payment, and contact details.</p>
        <button class="btn btn-primary" onclick="openAddVendorModal()">Add First Vendor</button>
      </div>`;
    return;
  }
  container.innerHTML = currentVendors.map(v => renderVendorCard(v)).join('');
}

function renderVendorCard(v) {
  const advancePct = v.quoted ? Math.min(100, Math.round((v.advance / v.quoted) * 100)) : 0;
  return `
    <div class="card vendor-card">
      <div class="vendor-card-header">
        <div>
          <div class="vendor-name">${esc(v.name || '(Unnamed vendor)')}</div>
          <div class="vendor-category">${esc(v.category)}</div>
        </div>
        <span class="badge badge-${v.confirmed ? 'confirmed' : 'unconfirmed'}">${v.confirmed ? '✓ Confirmed' : 'Pending'}</span>
      </div>
      <div class="vendor-details">
        <div class="vendor-detail-item">
          <span class="vendor-detail-label">Contact</span>
          <span class="vendor-detail-value">${esc(v.contact || '—')}</span>
        </div>
        <div class="vendor-detail-item">
          <span class="vendor-detail-label">Quoted</span>
          <span class="vendor-detail-value">${formatINR(v.quoted)}</span>
        </div>
        <div class="vendor-detail-item">
          <span class="vendor-detail-label">Advance Paid</span>
          <span class="vendor-detail-value">${formatINR(v.advance)}</span>
        </div>
        <div class="vendor-detail-item">
          <span class="vendor-detail-label">Balance Due</span>
          <span class="vendor-detail-value">${formatINR(Math.max(0, (v.quoted||0) - (v.advance||0)))}</span>
        </div>
      </div>
      <div class="progress-bar-wrap mb-1">
        <div class="progress-bar ${advancePct >= 100 ? 'success' : 'primary'}" style="width:${advancePct}%"></div>
      </div>
      <div class="text-small text-muted mb-1">${advancePct}% advance paid</div>
      ${v.backup ? `<div class="text-small text-muted mb-1">🔄 Backup: ${esc(v.backup)}</div>` : ''}
      ${v.notes  ? `<div class="text-small text-muted mb-1">${esc(v.notes)}</div>` : ''}
      <div class="vendor-actions">
        ${!v.confirmed ? `<button class="btn btn-success btn-sm" onclick="confirmVendor('${esc(v.id)}')">✓ Confirm</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="openEditVendorModal('${esc(v.id)}')">✏️ Edit</button>
        ${v.contact ? `<button class="btn btn-ghost btn-sm" onclick="copyContact('${esc(v.contact)}','${esc(v.name)}')">📋 Copy Contact</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="deleteVendor('${esc(v.id)}')">🗑 Delete</button>
      </div>
    </div>
  `;
}

function confirmVendor(id) {
  const v = currentVendors.find(v => v.id === id);
  if (v) {
    v.confirmed = true;
    saveVendors();
    renderVendors();
    showToast(`${v.name || 'Vendor'} confirmed! ✓`, 'success');
  }
}

function copyContact(number, name) {
  navigator.clipboard.writeText(number).then(() => {
    showToast(`${name || 'Vendor'}'s contact copied: ${number}`, 'success');
  }).catch(() => {
    showToast(`Contact: ${number} — copy manually.`, 'info');
  });
}

function deleteVendor(id) {
  openConfirmModal('Delete Vendor', 'Remove this vendor from your checklist?', () => {
    currentVendors = currentVendors.filter(v => v.id !== id);
    saveVendors();
    renderVendors();
    showToast('Vendor removed.', 'success');
    return true;
  });
}

function openAddVendorModal(prefill = {}) {
  editingVendorId = prefill.id || null;
  const title = editingVendorId ? 'Edit Vendor' : 'Add Vendor';
  const categories = ['Venue','Caterer','Decorator','Photographer','Transport','Sound & Lights','Makeup / Styling','Security / Medical','Other'];

  const html = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="v-name">Vendor name <span class="required">*</span></label>
        <input type="text" id="v-name" class="form-control" value="${esc(prefill.name||'')}" placeholder="e.g. Annapurna Caterers" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="v-category">Category</label>
        <select id="v-category" class="form-control">
          ${categories.map(c => `<option value="${c}" ${prefill.category===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="v-contact">Contact number</label>
        <input type="tel" id="v-contact" class="form-control" value="${esc(prefill.contact||'')}" placeholder="e.g. 9876543210" />
      </div>
      <div class="form-group">
        <label class="form-label" for="v-quoted">Quoted amount (₹)</label>
        <input type="number" id="v-quoted" class="form-control" value="${esc(String(prefill.quoted||''))}" placeholder="e.g. 50000" min="0" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="v-advance">Advance paid (₹)</label>
        <input type="number" id="v-advance" class="form-control" value="${esc(String(prefill.advance||''))}" placeholder="e.g. 10000" min="0" />
      </div>
      <div class="form-group">
        <label class="form-label" for="v-backup">Backup vendor</label>
        <input type="text" id="v-backup" class="form-control" value="${esc(prefill.backup||'')}" placeholder="Name + contact" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="v-notes">Notes</label>
      <textarea id="v-notes" class="form-control" rows="2">${esc(prefill.notes||'')}</textarea>
    </div>
  `;

  openModal(title, html, () => {
    const name = document.getElementById('v-name').value.trim();
    if (!name) { showToast('Please enter a vendor name.', 'error'); return false; }
    const quoted  = parseFloat(document.getElementById('v-quoted').value)  || 0;
    const advance = parseFloat(document.getElementById('v-advance').value) || 0;
    if (advance > quoted && quoted > 0) { showToast('Advance cannot exceed quoted amount.', 'error'); return false; }

    const vendor = {
      id: editingVendorId || uid(),
      eventId: currentEvent.id,
      name,
      category: document.getElementById('v-category').value,
      contact:  document.getElementById('v-contact').value.trim(),
      quoted, advance,
      backup: document.getElementById('v-backup').value.trim(),
      notes:  document.getElementById('v-notes').value.trim(),
      confirmed: prefill.confirmed || false,
      createdAt: new Date().toISOString(),
    };
    if (editingVendorId) {
      const idx = currentVendors.findIndex(v => v.id === editingVendorId);
      if (idx !== -1) currentVendors[idx] = vendor;
      showToast('Vendor updated.', 'success');
    } else {
      currentVendors.push(vendor);
      showToast('Vendor added.', 'success');
    }
    saveVendors();
    renderVendors();
    return true;
  });
}

function openEditVendorModal(id) {
  const v = currentVendors.find(v => v.id === id);
  if (v) openAddVendorModal(v);
}

// ─── Crisis Switch ────────────────────────────────────────────
const CRISIS_OPTIONS = [
  { key: 'caterer_delayed', icon: '🍽️', label: 'Caterer Delayed',       desc: 'Food is running late' },
  { key: 'vendor_cancelled',icon: '❌', label: 'Vendor Cancelled',       desc: 'A key vendor backed out' },
  { key: 'heavy_rain',      icon: '🌧️', label: 'Heavy Rain Expected',    desc: 'Weather disruption' },
  { key: 'power_failure',   icon: '⚡', label: 'Electricity Failure',    desc: 'Power outage at venue' },
  { key: 'extra_guests',    icon: '👥', label: 'More Guests Arrived',    desc: 'More than expected' },
  { key: 'budget_reduced',  icon: '💸', label: 'Budget Reduced',         desc: 'Funds are short' },
  { key: 'vip_late',        icon: '⏰', label: 'Important Guest is Late','desc': 'Key person delayed' },
  { key: 'custom',          icon: '🚨', label: 'Custom Emergency',       desc: 'Something else happened' },
];

function renderCrisis() {
  const grid = document.getElementById('crisis-grid');
  grid.innerHTML = CRISIS_OPTIONS.map(c => `
    <button class="crisis-card-btn ${selectedCrisisType === c.key ? 'selected' : ''}" data-crisis="${c.key}" onclick="selectCrisis('${c.key}')" aria-pressed="${selectedCrisisType === c.key ? 'true' : 'false'}">
      <div class="crisis-card-icon-wrap">${c.icon}</div>
      <span class="crisis-card-label">${esc(c.label)}</span>
      <span class="crisis-card-desc">${esc(c.desc)}</span>
    </button>
  `).join('');
  renderIncidents();
}

function selectCrisis(key) {
  selectedCrisisType = key;
  const option = CRISIS_OPTIONS.find(c => c.key === key);
  document.querySelectorAll('.crisis-card-btn').forEach(btn => {
    const isSelected = btn.dataset.crisis === key;
    btn.classList.toggle('selected', isSelected);
    btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  });
  document.getElementById('crisis-form-wrap').style.display = 'block';
  document.getElementById('crisis-form-title').textContent = `Describe Situation: ${option ? option.label : 'Crisis'}`;
  document.getElementById('rescue-plan-output').style.display = 'none';
  document.getElementById('rescue-plan-output').innerHTML = '';
}

function generatePlan() {
  if (!selectedCrisisType) { showToast('Please select a crisis type first.', 'warning'); return; }
  const description = document.getElementById('crisis-description').value.trim();
  const urgency = document.getElementById('crisis-urgency').value;

  const btn = document.getElementById('generate-plan-btn');
  btn.classList.add('btn-loading');
  btn.disabled = true;

  // Simulate brief processing delay for UX
  setTimeout(() => {
    btn.classList.remove('btn-loading');
    btn.disabled = false;
    try {
      rescuePlanData = generateRescuePlan(selectedCrisisType, { extra: description, urgency }, currentEvent);
      renderRescuePlan(rescuePlanData);
    } catch (e) {
      showToast('Could not generate rescue plan. Please try again.', 'error');
    }
  }, 900);
}

function renderRescuePlan(plan) {
  const outputEl = document.getElementById('rescue-plan-output');
  outputEl.style.display = 'block';
  outputEl.innerHTML = `
    <div class="card rescue-dossier-card mb-2">
      <div class="d-flex align-center justify-between flex-wrap gap-1 mb-3 pb-2" style="border-bottom:1px solid rgba(100,28,50,0.12)">
        <div class="d-flex align-center gap-1">
          <span style="font-size:1.8rem">🚨</span>
          <div>
            <div class="fw-bold" style="font-size:1.25rem;color:var(--maroon);font-family:'Playfair Display',serif">${esc(plan.title)} — Operational Rescue Plan</div>
            <div class="text-small text-muted">Generated by Sahaay Operations Engine • Ready to execute</div>
          </div>
        </div>
        <span class="badge badge-urgent" style="font-size:0.75rem;padding:4px 12px">⚡ Mission Critical</span>
      </div>

      <div class="rescue-section">
        <div class="rescue-section-title"><span>🔍</span> Situation Assessment</div>
        <p style="font-size:0.90rem;line-height:1.6">${esc(plan.situation)}</p>
      </div>

      <div class="rescue-section immediate">
        <div class="rescue-section-title"><span style="color:var(--alert)">⚡</span> Phase 1 — First 15 Minutes (Immediate Containment)</div>
        <ul class="rescue-list">${plan.first15.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
      </div>

      <div class="rescue-section hourly">
        <div class="rescue-section-title"><span style="color:var(--gold)">🕐</span> Phase 2 — Next 60 Minutes (Stabilization & Lock)</div>
        <ul class="rescue-list">${plan.next60.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
      </div>

      <div class="rescue-section assignments">
        <div class="rescue-section-title"><span style="color:var(--emerald)">👥</span> Operational Roles & Delegation</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:10px;margin-top:8px">
          ${plan.assignments.map(a => `
            <div style="background:var(--white);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:10px 12px">
              <strong style="color:var(--maroon);display:block;font-size:0.86rem;margin-bottom:2px">👤 ${esc(a.name)}</strong>
              <span style="font-size:0.84rem;color:var(--ink)">${esc(a.task)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      ${plan.budgetImpact && plan.budgetImpact.length > 0 ? `
      <div class="rescue-section">
        <div class="rescue-section-title"><span>💸</span> Financial Impact Breakdown</div>
        ${plan.budgetImpact.map(b => `
          <div style="display:flex;justify-content:space-between;font-size:0.88rem;margin-bottom:6px;padding-bottom:4px;border-bottom:1px dashed var(--cream-dark)">
            <span>${esc(b.item)}</span>
            <strong style="color:var(--alert)">${formatINR(b.amount)}</strong>
          </div>
        `).join('')}
        <div style="font-size:0.85rem;color:var(--ink);font-weight:700;margin-top:8px;text-align:right">
          Total Emergency Allocation: ${formatINR(plan.budgetImpact.reduce((s,b)=>s+b.amount,0))}
        </div>
      </div>` : ''}

      <div class="rescue-section">
        <div class="rescue-section-title"><span>📅</span> Timeline Impact</div>
        <p style="font-size:0.90rem;line-height:1.5">${esc(plan.timelineImpact)}</p>
      </div>

      <div class="rescue-section">
        <div class="d-flex align-center justify-between mb-2">
          <div class="rescue-section-title" style="margin-bottom:0"><span>💬</span> Pre-drafted Guest Communication Message</div>
          <button class="btn btn-ghost btn-sm" onclick="copyGuestMessage()" id="btn-copy-guest-top">📋 Copy Message</button>
        </div>
        <div class="guest-message-box" id="guest-msg-text">${esc(plan.guestMessage)}</div>
      </div>

      <div class="rescue-section">
        <div class="rescue-section-title"><span>🔄</span> Contingency / Secondary Backup</div>
        <p style="font-size:0.90rem;line-height:1.5">${esc(plan.backupOption)}</p>
      </div>

      <div class="rescue-actions">
        <button class="btn btn-danger btn-lg" onclick="applyRescuePlan()" id="btn-apply-plan">
          ⚡ Apply Rescue Plan to App
        </button>
        <button class="btn btn-success" onclick="copyGuestMessage()">
          📋 Copy Guest Broadcast
        </button>
        <button class="btn btn-maroon" onclick="saveAsIncident()">
          📁 Log as Incident
        </button>
        <button class="btn btn-ghost" onclick="resetCrisis()">
          🔄 New Scenario
        </button>
      </div>
    </div>
  `;
  outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function applyRescuePlan() {
  if (!rescuePlanData) return;
  const plan = rescuePlanData;

  // Add tasks
  let tasksAdded = 0;
  if (plan.tasks && plan.tasks.length > 0) {
    plan.tasks.forEach(t => {
      currentTasks.push({
        id: uid(), eventId: currentEvent.id,
        name: `[RESCUE] ${t.name}`,
        category: t.category, priority: t.priority, owner: t.owner || '',
        backup: '', deadline: today(), notes: 'Auto-created from crisis rescue plan.',
        status: 'pending', createdAt: new Date().toISOString(),
      });
      tasksAdded++;
    });
    saveTasks();
  }

  // Add expenses
  let expensesAdded = 0;
  if (plan.expenses && plan.expenses.length > 0) {
    plan.expenses.forEach(e => {
      currentExpenses.push({
        id: uid(), eventId: currentEvent.id,
        name: `[RESCUE] ${e.name}`, category: e.category || 'Emergency',
        amount: e.amount, status: e.status || 'pending',
        dueDate: today(), notes: 'Emergency expense from rescue plan.',
        createdAt: new Date().toISOString(),
      });
      expensesAdded++;
    });
    saveExpenses();
  }

  // Save incident
  saveAsIncident();

  showToast(`Rescue plan applied! ${tasksAdded} task${tasksAdded!==1?'s':''} and ${expensesAdded} expense${expensesAdded!==1?'s':''} added.`, 'success', 5000);

  // Confirmation message
  const outputEl = document.getElementById('rescue-plan-output');
  const confirmDiv = document.createElement('div');
  confirmDiv.className = 'card';
  confirmDiv.style.borderLeft = '4px solid var(--emerald)';
  confirmDiv.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:1.6rem">✅</span>
      <div>
        <div class="fw-bold" style="color:var(--emerald)">Rescue Plan Applied!</div>
        <div class="text-small text-muted">
          ${tasksAdded} rescue tasks added to Responsibility Board.<br>
          ${expensesAdded} emergency expenses added to Budget.<br>
          Incident logged.
        </div>
      </div>
    </div>
    <div class="d-flex gap-1 mt-2">
      <button class="btn btn-maroon btn-sm" onclick="navigateTo('tasks')">View Rescue Tasks</button>
      <button class="btn btn-ghost btn-sm" onclick="navigateTo('budget')">View Budget</button>
    </div>
  `;
  outputEl.appendChild(confirmDiv);
  confirmDiv.scrollIntoView({ behavior: 'smooth' });
}

function copyGuestMessage() {
  if (!rescuePlanData) return;
  const msg = rescuePlanData.guestMessage;
  navigator.clipboard.writeText(msg).then(() => {
    showToast('Guest message copied to clipboard! 📋', 'success');
  }).catch(() => {
    showToast('Could not copy automatically. Please copy manually.', 'warning');
  });
}

function saveAsIncident() {
  if (!rescuePlanData) return;
  const incident = {
    id: uid(),
    eventId: currentEvent.id,
    title: rescuePlanData.title,
    situation: rescuePlanData.situation,
    crisisType: selectedCrisisType,
    savedAt: new Date().toISOString(),
  };
  currentIncidents.push(incident);
  saveIncidents();
  renderIncidents();
  showToast('Incident saved to log.', 'info');
}

function resetCrisis() {
  selectedCrisisType = null;
  rescuePlanData = null;
  document.querySelectorAll('.crisis-card-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('crisis-form-wrap').style.display = 'none';
  document.getElementById('rescue-plan-output').style.display = 'none';
  document.getElementById('rescue-plan-output').innerHTML = '';
  document.getElementById('crisis-description').value = '';
}

function renderIncidents() {
  const list = document.getElementById('incidents-list');
  if (currentIncidents.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding:24px"><span class="empty-state-icon">🛡️</span><h3>No incidents recorded</h3><p>Hopefully it stays that way.</p></div>`;
    return;
  }
  list.innerHTML = currentIncidents.slice().reverse().map(inc => `
    <div class="incident-card card">
      <div class="incident-title">${esc(inc.title)}</div>
      <div class="incident-meta">${new Date(inc.savedAt).toLocaleString('en-IN')} &bull; ${esc(inc.situation.substring(0,80))}…</div>
    </div>
  `).join('');
}

// ─── Message Studio ───────────────────────────────────────────
const MESSAGE_TYPES = [
  { key: 'vendor_reminder',      label: 'Vendor Reminder',       icon: '🔔' },
  { key: 'guest_invitation',     label: 'Guest Invitation',      icon: '💌' },
  { key: 'delay_notification',   label: 'Delay Notification',    icon: '⏰' },
  { key: 'volunteer_assignment', label: 'Volunteer Assignment',  icon: '🙋' },
  { key: 'payment_reminder',     label: 'Payment Reminder',      icon: '💰' },
  { key: 'thankyou',             label: 'Thank-You Message',     icon: '❤️' },
  { key: 'emergency_announcement',label:'Emergency Announcement',icon: '🚨' },
];

function renderMessages() {
  const grid = document.getElementById('message-type-grid');
  grid.innerHTML = MESSAGE_TYPES.map(mt => `
    <button class="message-type-btn ${selectedMessageType === mt.key ? 'selected' : ''}" data-mtype="${mt.key}" onclick="selectMessageType('${mt.key}')">
      <span>${mt.icon}</span> ${esc(mt.label)}
    </button>
  `).join('');

  // Sync language to event setting
  if (currentEvent) {
    const langSel = document.getElementById('msg-language');
    if (langSel) langSel.value = currentEvent.language || 'English';
  }
}

function selectMessageType(key) {
  selectedMessageType = key;
  document.querySelectorAll('.message-type-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.mtype === key);
  });
}

function doGenerateMessage() {
  if (!selectedMessageType) { showToast('Please select a message type first.', 'warning'); return; }
  const lang    = document.getElementById('msg-language').value;
  const recipient = document.getElementById('msg-recipient').value.trim();
  const details = document.getElementById('msg-details').value.trim();

  const data = {
    eventName: currentEvent?.name || 'our event',
    eventDate: currentEvent ? new Date(currentEvent.date).toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'}) : '',
    city: currentEvent?.city || '',
    organiser: currentEvent?.name || 'The Organiser',
    recipient,
    extra: details,
  };

  let msg = '';
  try {
    msg = generateMessage(selectedMessageType, lang, data);
  } catch (e) {
    msg = 'Could not generate message. Please try again.';
  }

  document.getElementById('message-output').value = msg;
  document.getElementById('message-output-card').style.display = 'block';
  document.getElementById('message-output-card').scrollIntoView({ behavior: 'smooth' });
}

function copyMessage() {
  const text = document.getElementById('message-output').value;
  if (!text) { showToast('No message to copy.', 'warning'); return; }
  navigator.clipboard.writeText(text).then(() => {
    showToast('Message copied to clipboard! 📋', 'success');
  }).catch(() => {
    showToast('Please copy the message manually.', 'warning');
  });
}

// ─── Settings ─────────────────────────────────────────────────
function renderSettings() {
  const el = document.getElementById('settings-event-info');
  if (!currentEvent) {
    el.innerHTML = '<p class="text-muted">No event loaded.</p>';
    return;
  }
  const e = currentEvent;
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:0.88rem">
      <div><strong>Name:</strong> ${esc(e.name)}</div>
      <div><strong>Type:</strong> ${esc(e.type)}</div>
      <div><strong>Date:</strong> ${new Date(e.date).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</div>
      <div><strong>City:</strong> ${esc(e.city)}</div>
      <div><strong>Guests:</strong> ${esc(String(e.guests))}</div>
      <div><strong>Budget:</strong> ${formatINR(e.budget)}</div>
      <div><strong>Food:</strong> ${esc(e.food)}</div>
      <div><strong>Language:</strong> ${esc(e.language)}</div>
      <div><strong>Volunteers:</strong> ${esc(String(e.volunteers))}</div>
      <div><strong>Accessibility:</strong> ${(e.accessibility||[]).join(', ') || 'None'}</div>
    </div>
  `;
}

function exportData() {
  const data = {
    sahaay_version: '1.0',
    exported_at: new Date().toISOString(),
    event:     currentEvent,
    expenses:  currentExpenses,
    tasks:     currentTasks,
    vendors:   currentVendors,
    timeline:  currentTimeline,
    incidents: currentIncidents,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sahaay-export-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Event data exported as JSON.', 'success');
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || typeof data !== 'object') throw new Error('Invalid format');
      if (!data.event) throw new Error('No event data found');

      openConfirmModal(
        'Import Event Data',
        `This will replace all current data with the imported data for "${esc(data.event.name)}". Continue?`,
        () => {
          if (data.event)     { currentEvent = data.event;         Store.set(KEYS.EVENT, data.event); }
          if (data.expenses)  { currentExpenses = data.expenses;   saveExpenses(); }
          if (data.tasks)     { currentTasks = data.tasks;         saveTasks(); }
          if (data.vendors)   { currentVendors = data.vendors;     saveVendors(); }
          if (data.timeline)  { currentTimeline = data.timeline;   saveTimeline(); }
          if (data.incidents) { currentIncidents = data.incidents; saveIncidents(); }
          updateTopbar();
          updateSidebarInfo();
          renderSettings();
          showToast('Event data imported successfully!', 'success');
          return true;
        }
      );
    } catch (err) {
      showToast(`Import failed: ${err.message || 'Invalid JSON file.'}`, 'error');
    }
  };
  reader.readAsText(file);
  // Reset input
  document.getElementById('import-input').value = '';
}

function resetAllData() {
  openConfirmModal(
    'Reset All Event Data',
    'This will permanently delete ALL your event data, expenses, tasks, vendors, timeline, and incidents from this browser. This action CANNOT be undone. Are you sure?',
    () => {
      Store.clear();
      currentEvent = null; currentExpenses = []; currentTasks = [];
      currentVendors = []; currentTimeline = []; currentIncidents = [];
      showToast('All data deleted. Reloading…', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      return true;
    }
  );
}

// ─── Notifications ────────────────────────────────────────────
function buildNotifications() {
  const notifs = [];
  const urgentTasks = currentTasks.filter(t => t.status !== 'completed' && t.priority === 'urgent');
  if (urgentTasks.length > 0) notifs.push({ title: `${urgentTasks.length} urgent task${urgentTasks.length>1?'s':''}`, body: urgentTasks[0].name });
  const unconfirmedVendors = currentVendors.filter(v => !v.confirmed);
  if (unconfirmedVendors.length > 0) notifs.push({ title: `${unconfirmedVendors.length} vendor${unconfirmedVendors.length>1?'s':''} unconfirmed`, body: unconfirmedVendors[0].name || 'Check vendor checklist' });
  const stats = calcBudgetStats(currentEvent, currentExpenses);
  if (stats.overBudget) notifs.push({ title: 'Budget alert', body: 'Your committed expenses exceed the total budget.' });

  document.getElementById('notif-dot').style.display = notifs.length > 0 ? 'block' : 'none';
  const list = document.getElementById('notif-list');
  if (notifs.length === 0) {
    list.innerHTML = '<div class="notif-item"><div class="notif-item-body text-muted">No new notifications.</div></div>';
  } else {
    list.innerHTML = notifs.map(n => `
      <div class="notif-item">
        <div class="notif-item-title">${esc(n.title)}</div>
        <div class="notif-item-body">${esc(n.body)}</div>
      </div>
    `).join('');
  }
}

// ─── Generic Modal ────────────────────────────────────────────
function openModal(title, bodyHtml, onSave) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', title);

  overlay.innerHTML = `
    <div class="modal-box" role="document">
      <div class="modal-header">
        <h2 class="modal-title">${esc(title)}</h2>
        <button class="modal-close" id="modal-close-btn" aria-label="Close dialog">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="modal-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="modal-save-btn">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close on overlay click
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  document.getElementById('modal-save-btn').addEventListener('click', () => {
    const result = onSave();
    if (result !== false) closeModal();
  });

  // Focus first input
  setTimeout(() => {
    const first = overlay.querySelector('input, select, textarea');
    if (first) first.focus();
  }, 100);

  // Trap Escape
  overlay._escHandler = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', overlay._escHandler);
}

function closeModal() {
  const modal = document.getElementById('active-modal');
  if (modal) {
    if (modal._escHandler) document.removeEventListener('keydown', modal._escHandler);
    modal.classList.add('closing');
    setTimeout(() => modal.remove(), 220);
  }
}

function openConfirmModal(title, message, onConfirm) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:420px">
      <div class="modal-header">
        <h2 class="modal-title">${esc(title)}</h2>
        <button class="modal-close" id="modal-close-btn" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        <p style="font-size:0.92rem;line-height:1.6;color:var(--ink)">${esc(message)}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="modal-cancel-btn">Cancel</button>
        <button class="btn btn-danger" id="modal-confirm-btn">Confirm</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  document.getElementById('modal-confirm-btn').addEventListener('click', () => {
    const result = onConfirm();
    if (result !== false) closeModal();
  });
  overlay._escHandler = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', overlay._escHandler);
  setTimeout(() => { document.getElementById('modal-confirm-btn')?.focus(); }, 100);
}

// ─── Onboarding ───────────────────────────────────────────────
function initOnboarding() {
  // Set min date to tomorrow
  const dateInput = document.getElementById('ob-date');
  dateInput.min = addDays(today(), 1);

  // Checkbox group interactions
  document.querySelectorAll('.checkbox-item').forEach(item => {
    item.addEventListener('click', () => {
      const cb = item.querySelector('input[type=checkbox]');
      if (!cb) return;
      if (cb.value === 'None') {
        // If None selected, uncheck others
        document.querySelectorAll('#ob-accessibility input[type=checkbox]').forEach(o => {
          if (o.value !== 'None') { o.checked = false; o.closest('.checkbox-item').classList.remove('checked'); }
        });
      } else {
        // If something else selected, uncheck None
        const noneCb = document.getElementById('ob-access-none');
        if (noneCb) { noneCb.checked = false; noneCb.closest('.checkbox-item').classList.remove('checked'); }
      }
      cb.checked = !cb.checked;
      item.classList.toggle('checked', cb.checked);
    });
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); } });
  });

  // Form submit
  document.getElementById('onboarding-form').addEventListener('submit', e => {
    e.preventDefault();
    submitOnboardingForm();
  });

  // Demo button
  document.getElementById('ob-demo-btn').addEventListener('click', loadDemoEvent);
}

function getAccessibilityChecked() {
  return Array.from(document.querySelectorAll('#ob-accessibility input[type=checkbox]'))
    .filter(cb => cb.checked).map(cb => cb.value);
}

function validateOnboardingField(id, errId, check) {
  const el = document.getElementById(id);
  const err = document.getElementById(errId);
  const valid = check(el ? el.value : '');
  if (el) el.classList.toggle('error', !valid);
  if (err) err.classList.toggle('visible', !valid);
  return valid;
}

function submitOnboardingForm() {
  let valid = true;
  valid &= validateOnboardingField('ob-event-name', 'err-event-name', v => v.trim().length > 0);
  valid &= validateOnboardingField('ob-event-type', 'err-event-type', v => v !== '');
  valid &= validateOnboardingField('ob-date', 'err-date', v => v && new Date(v) > new Date());
  valid &= validateOnboardingField('ob-city', 'err-city', v => v.trim().length > 0);
  valid &= validateOnboardingField('ob-guests', 'err-guests', v => { const n = parseInt(v); return n >= 1 && n <= 10000; });
  valid &= validateOnboardingField('ob-budget', 'err-budget', v => { const n = parseFloat(v); return n >= 1000; });

  if (!valid) return;

  const btn = document.getElementById('ob-submit-btn');
  btn.classList.add('btn-loading');
  btn.disabled = true;

  setTimeout(() => {
    btn.classList.remove('btn-loading');
    btn.disabled = false;
    const event = {
      id: uid(),
      name: document.getElementById('ob-event-name').value.trim(),
      type: document.getElementById('ob-event-type').value,
      date: document.getElementById('ob-date').value,
      city: document.getElementById('ob-city').value.trim(),
      guests: parseInt(document.getElementById('ob-guests').value),
      budget: parseFloat(document.getElementById('ob-budget').value),
      food: document.getElementById('ob-food').value,
      language: document.getElementById('ob-language').value,
      accessibility: getAccessibilityChecked(),
      volunteers: parseInt(document.getElementById('ob-volunteers').value) || 0,
      createdAt: new Date().toISOString(),
    };

    Store.set(KEYS.EVENT, event);
    Store.set(KEYS.EXPENSES, generateExpensesForEvent(event));
    Store.set(KEYS.TASKS, generateTasksForEvent(event));
    Store.set(KEYS.VENDORS, generateVendorsForEvent(event));
    Store.set(KEYS.TIMELINE, generateTimelineForEvent(event));
    Store.set(KEYS.INCIDENTS, []);

    loadData();
    showApp();
    showToast('Your celebration command center is ready. 🎉', 'success', 4000);
  }, 800);
}

function loadDemoEvent() {
  const event = createDemoEvent();
  Store.set(KEYS.EVENT, event);
  Store.set(KEYS.EXPENSES, createDemoExpenses(event.id));
  Store.set(KEYS.TASKS, createDemoTasks(event.id));
  Store.set(KEYS.VENDORS, createDemoVendors(event.id));
  Store.set(KEYS.TIMELINE, createDemoTimeline(event.id));
  Store.set(KEYS.INCIDENTS, []);
  loadData();
  showApp();
  showToast('Demo event loaded! Welcome to Asha & Rohan\'s command centre. 🌸', 'success', 4000);
}

// ─── Wire up all event listeners ─────────────────────────────
function initEventListeners() {
  // Navigation: sidebar + bottom nav
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.view));
  });

  // Sidebar logo click goes to dashboard overview
  const sidebarLogo = document.getElementById('sidebar-logo');
  if (sidebarLogo) {
    sidebarLogo.addEventListener('click', () => navigateTo('dashboard'));
    sidebarLogo.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigateTo('dashboard');
      }
    });
  }

  // Sync with browser back / forward buttons
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('popstate', () => {
      if (currentEvent && typeof window !== 'undefined' && window.location && window.location.hash) {
        const hashView = window.location.hash.replace('#', '').trim();
        if (['dashboard', 'budget', 'tasks', 'timeline', 'vendors', 'crisis', 'messages', 'settings'].includes(hashView)) {
          navigateTo(hashView, false);
        }
      }
    });
  }

  // Mobile menu toggle
  const menuToggle = document.getElementById('menu-toggle');
  if (menuToggle) menuToggle.addEventListener('click', openMobileSidebar);

  // Sidebar overlay close
  document.getElementById('sidebar-overlay').addEventListener('click', closeMobileSidebar);

  // Topbar language select
  document.getElementById('topbar-lang').addEventListener('change', e => {
    if (currentEvent) {
      currentEvent.language = e.target.value;
      Store.set(KEYS.EVENT, currentEvent);
    }
  });

  // Notifications panel
  const notifBtn = document.getElementById('notif-btn');
  const notifPanel = document.getElementById('notif-panel');
  notifBtn.addEventListener('click', e => {
    e.stopPropagation();
    const visible = notifPanel.style.display !== 'none';
    notifPanel.style.display = visible ? 'none' : 'block';
  });
  document.addEventListener('click', () => { notifPanel.style.display = 'none'; });

  // Dashboard buttons
  document.getElementById('dash-crisis-btn').addEventListener('click', () => navigateTo('crisis'));
  document.getElementById('dash-view-all-tasks').addEventListener('click', () => navigateTo('tasks'));

  // Budget
  document.getElementById('add-expense-btn').addEventListener('click', () => openAddExpenseModal());
  document.getElementById('wi-simulate-btn').addEventListener('click', runWhatIf);
  document.querySelectorAll('[data-expense-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      expenseFilter = btn.dataset.expenseFilter;
      document.querySelectorAll('[data-expense-filter]').forEach(b => b.classList.toggle('active', b === btn));
      renderExpenseTable();
    });
  });

  // Tasks
  document.getElementById('add-task-btn').addEventListener('click', () => openAddTaskModal());
  document.querySelectorAll('[data-task-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      taskFilter = btn.dataset.taskFilter;
      document.querySelectorAll('[data-task-filter]').forEach(b => b.classList.toggle('active', b === btn));
      renderTasks();
    });
  });
  document.getElementById('extract-tasks-btn').addEventListener('click', runExtractTasks);

  // Timeline
  document.getElementById('add-timeline-btn').addEventListener('click', addTimelineItem);

  // Vendors
  document.getElementById('add-vendor-btn').addEventListener('click', () => openAddVendorModal());

  // Crisis
  document.getElementById('generate-plan-btn').addEventListener('click', generatePlan);
  document.getElementById('crisis-cancel-btn').addEventListener('click', () => {
    document.getElementById('crisis-form-wrap').style.display = 'none';
    selectedCrisisType = null;
    document.querySelectorAll('.crisis-card-btn').forEach(b => b.classList.remove('selected'));
  });

  // Messages
  document.getElementById('generate-msg-btn').addEventListener('click', doGenerateMessage);
  document.getElementById('copy-msg-btn').addEventListener('click', copyMessage);
  document.getElementById('regen-msg-btn').addEventListener('click', doGenerateMessage);
  document.getElementById('clear-msg-btn').addEventListener('click', () => {
    document.getElementById('message-output').value = '';
    document.getElementById('message-output-card').style.display = 'none';
    selectedMessageType = null;
    document.querySelectorAll('.message-type-btn').forEach(b => b.classList.remove('selected'));
  });

  // Settings
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-input').addEventListener('change', e => importData(e.target.files[0]));
  document.getElementById('load-demo-btn').addEventListener('click', () => {
    openConfirmModal('Load Demo Data', 'This will replace your current data with a demo event. Continue?', () => {
      loadDemoEvent();
      return true;
    });
  });
  document.getElementById('reset-all-btn').addEventListener('click', resetAllData);

  // Responsive: show/hide menu toggle
  window.addEventListener('resize', () => {
    const toggle = document.getElementById('menu-toggle');
    if (toggle) toggle.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
    if (window.innerWidth > 768) closeMobileSidebar();
  });
}

// ─── Global functions (called from inline onclick) ────────────
window.completeTask      = completeTask;
window.reopenTask        = reopenTask;
window.deleteTask        = deleteTask;
window.openEditTaskModal = openEditTaskModal;
window.openAddTaskModal  = openAddTaskModal;
window.confirmExtractedTasks = confirmExtractedTasks;
window.openEditExpenseModal = openEditExpenseModal;
window.openAddExpenseModal  = openAddExpenseModal;
window.deleteExpense     = deleteExpense;
window.confirmVendor     = confirmVendor;
window.copyContact       = copyContact;
window.deleteVendor      = deleteVendor;
window.openEditVendorModal = openEditVendorModal;
window.openAddVendorModal  = openAddVendorModal;
window.selectCrisis      = selectCrisis;
window.applyRescuePlan   = applyRescuePlan;
window.copyGuestMessage  = copyGuestMessage;
window.saveAsIncident    = saveAsIncident;
window.resetCrisis       = resetCrisis;
window.selectMessageType = selectMessageType;
window.navigateTo        = navigateTo;
window.toggleTimelineItem = toggleTimelineItem;
window.deleteTimelineItem = deleteTimelineItem;

window.SahaayApp = {
  getState: () => ({ currentView, currentEvent, currentExpenses, currentTasks, currentVendors, currentTimeline, currentIncidents, selectedCrisisType, rescuePlanData }),
  showApp,
  showOnboarding,
  navigateTo,
  loadDemoEvent,
  submitOnboardingForm,
  openAddExpenseModal,
  openEditExpenseModal,
  deleteExpense,
  openAddTaskModal,
  openEditTaskModal,
  completeTask,
  reopenTask,
  deleteTask,
  runExtractTasks,
  confirmExtractedTasks,
  openAddVendorModal,
  openEditVendorModal,
  confirmVendor,
  copyContact,
  deleteVendor,
  addTimelineItem,
  toggleTimelineItem,
  deleteTimelineItem,
  selectCrisis,
  generatePlan,
  applyRescuePlan,
  selectMessageType,
  doGenerateMessage,
  copyMessage,
  runWhatIf,
  exportData,
  importData,
  resetAllData,
  openMobileSidebar,
  closeMobileSidebar
};

// ─── App Initialisation ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initOnboarding();
  initEventListeners();
  bootApp();
});
