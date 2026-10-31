// ============================================================
// SAHAAY — Data Layer, Seed Data & Fallback AI Logic
// ============================================================

(() => {
'use strict';

// ─── Storage Keys ────────────────────────────────────────────
const KEYS = {
  EVENT:     'sahaay_event',
  EXPENSES:  'sahaay_expenses',
  TASKS:     'sahaay_tasks',
  VENDORS:   'sahaay_vendors',
  INCIDENTS: 'sahaay_incidents',
  SETTINGS:  'sahaay_settings',
  TIMELINE:  'sahaay_timeline',
};

// ─── Storage Helpers ─────────────────────────────────────────
/**
 * Thin wrapper around localStorage with JSON serialisation and
 * silent error handling (e.g. incognito / storage-full scenarios).
 */
const Store = {
  /**
   * Retrieve and JSON-parse a stored value.
   * @param {string} key
   * @returns {*} Parsed value, or null on error / missing key.
   */
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  /**
   * JSON-serialise and store a value.
   * @param {string} key
   * @param {*} value
   * @returns {boolean} true on success.
   */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch { return false; }
  },
  /** @param {string} key */
  remove(key) {
    localStorage.removeItem(key);
  },
  /** Remove all Sahaay keys from localStorage. */
  clear() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  }
};

// ─── ID Generator ────────────────────────────────────────────
/**
 * Generate a collision-resistant short UID.
 * Uses timestamp + random suffix — no crypto dependency needed.
 * @returns {string}
 */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Date Helpers ────────────────────────────────────────────
/**
 * Return an ISO date string N days after the given date.
 * @param {string|Date} date
 * @param {number} days
 * @returns {string} YYYY-MM-DD
 */
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Return today's ISO date string.
 * @returns {string} YYYY-MM-DD
 */
function today() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Number of whole days from today to a target date.
 * Negative values mean the target is in the past.
 * @param {string} dateStr YYYY-MM-DD
 * @returns {number}
 */
function daysFrom(dateStr) {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

// ─── Security: HTML Escape ────────────────────────────────────
/**
 * Escape a value for safe insertion into HTML.
 * This is the primary XSS defence used throughout the codebase —
 * every piece of user-supplied data must pass through esc() before
 * being written to innerHTML.
 *
 * @param {*} str - Any value; will be coerced to string.
 * @returns {string} HTML-entity–escaped string.
 */
function esc(str) {
  if (str === null || str === undefined) return '';
  // Strip null bytes and ASCII control characters (except tab/newline)
  const cleaned = String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return cleaned
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/**
 * Sanitise plain-text user input: trim whitespace, remove control chars.
 * Use this on text values *before* storing, not just before rendering.
 * @param {*} str
 * @param {number} [maxLen=500] - Maximum allowed length.
 * @returns {string}
 */
function sanitizeText(str, maxLen = 500) {
  if (!str) return '';
  return String(str)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLen);
}

// ─── Format Currency ─────────────────────────────────────────
/**
 * Format a number as Indian Rupee currency string.
 * @param {number|string} amount
 * @returns {string} e.g. "₹1,20,000"
 */
function formatINR(amount) {
  const n = Number(amount) || 0;
  return '₹' + n.toLocaleString('en-IN');
}


// ─── Demo Event Data ─────────────────────────────────────────
function createDemoEvent() {
  const eventDate = addDays(today(), 30);
  return {
    id: uid(),
    name: 'Asha & Rohan Community Wedding',
    type: 'Wedding',
    date: eventDate,
    city: 'Lucknow',
    guests: 120,
    budget: 200000,
    food: 'Vegetarian',
    language: 'Hinglish',
    accessibility: ['Elderly seating', 'Wheelchair access'],
    volunteers: 12,
    createdAt: new Date().toISOString(),
  };
}

function createDemoExpenses(eventId) {
  const base = [
    { category: 'Venue',      name: 'Shri Sai Mahal Booking',      amount: 40000,  status: 'paid',     dueDate: addDays(today(), 5),  notes: 'Advance paid. Balance on event day.' },
    { category: 'Catering',   name: 'Annapurna Catering Services',  amount: 80000,  status: 'promised', dueDate: addDays(today(), 25), notes: '50% advance due next week.' },
    { category: 'Decoration', name: 'Rangoli Decor Package',        amount: 25000,  status: 'pending',  dueDate: addDays(today(), 20), notes: 'Quote received, awaiting confirmation.' },
    { category: 'Photography',name: 'Moments Photography Studio',   amount: 20000,  status: 'paid',     dueDate: addDays(today(), 2),  notes: 'Token paid. Shooting confirmed.' },
    { category: 'Transport',  name: 'CityRide Guest Shuttle',       amount: 10000,  status: 'pending',  dueDate: addDays(today(), 28), notes: 'Pending quote confirmation.' },
    { category: 'Emergency',  name: 'Emergency Reserve Fund',       amount: 15000,  status: 'optional', dueDate: '',                   notes: 'Keep aside for unexpected costs.' },
    { category: 'Invitations',name: 'Digital & Print Invitations',  amount: 5000,   status: 'paid',     dueDate: addDays(today(), 1),  notes: 'Printed 150 copies.' },
  ];
  return base.map(e => ({ ...e, id: uid(), eventId, createdAt: new Date().toISOString() }));
}

function createDemoTasks(eventId) {
  const eventDate = addDays(today(), 30);
  const tasks = [
    { name: 'Confirm caterer appointment',     category: 'Catering',   owner: 'Aman',  backup: 'Priya',  deadline: addDays(today(), 3),  priority: 'urgent',  status: 'pending',   notes: 'Call Annapurna by Friday' },
    { name: 'Collect flowers from market',     category: 'Decoration', owner: 'Riya',  backup: 'Sunita', deadline: addDays(today(), 29), priority: 'normal',  status: 'pending',   notes: 'Marigold and rose garlands' },
    { name: 'Arrange elderly seating area',    category: 'Guest care', owner: 'Neha',  backup: 'Raj',    deadline: addDays(today(), 28), priority: 'high',    status: 'pending',   notes: 'Near entrance, chairs with armrests' },
    { name: 'Confirm photographer schedule',   category: 'Photography',owner: 'Riya',  backup: 'Aman',   deadline: addDays(today(), 7),  priority: 'high',    status: 'completed', notes: 'Moments Photography confirmed' },
    { name: 'Print welcome signs',             category: 'Decoration', owner: 'Sunita',backup: 'Neha',   deadline: addDays(today(), 15), priority: 'normal',  status: 'pending',   notes: 'Name board + directional signs' },
    { name: 'Arrange emergency transport',     category: 'Transport',  owner: 'Raj',   backup: 'Aman',   deadline: addDays(today(), 25), priority: 'normal',  status: 'pending',   notes: 'Keep one vehicle on standby' },
    { name: 'Finalize guest list',             category: 'Admin',      owner: 'Priya', backup: 'Sunita', deadline: addDays(today(), 10), priority: 'high',    status: 'completed', notes: '120 confirmed, 15 maybes' },
    { name: 'Send digital invitations',        category: 'Admin',      owner: 'Priya', backup: '',       deadline: addDays(today(), 5),  priority: 'urgent',  status: 'completed', notes: 'WhatsApp + email group' },
    { name: 'Book backup generator',           category: 'Venue',      owner: 'Aman',  backup: 'Raj',    deadline: addDays(today(), 20), priority: 'normal',  status: 'pending',   notes: 'In case of power cut' },
    { name: 'Prepare volunteer duty chart',    category: 'Admin',      owner: 'Neha',  backup: '',       deadline: addDays(today(), 14), priority: 'normal',  status: 'pending',   notes: 'Assign zones to 12 volunteers' },
    { name: 'Confirm sound system rental',     category: 'Venue',      owner: 'Raj',   backup: 'Aman',   deadline: addDays(today(), 18), priority: 'normal',  status: 'pending',   notes: 'Microphone + speakers needed' },
    { name: 'Arrange wheelchair ramp',         category: 'Guest care', owner: 'Neha',  backup: '',       deadline: addDays(today(), 27), priority: 'high',    status: 'pending',   notes: 'Check with venue manager' },
  ];
  return tasks.map(t => ({ ...t, id: uid(), eventId, createdAt: new Date().toISOString() }));
}

function createDemoVendors(eventId) {
  const vendors = [
    { name: 'Annapurna Catering Services', category: 'Caterer',        contact: '9876543210', quoted: 80000, advance: 0,     confirmed: false, backup: 'Shyam Catering 9876501234',     notes: 'Vegetarian thali + snacks for 120' },
    { name: 'Rangoli Decor Studio',        category: 'Decorator',      contact: '9812345678', quoted: 25000, advance: 5000,  confirmed: true,  backup: '',                              notes: 'Marigold + fairy light theme' },
    { name: 'Moments Photography',         category: 'Photographer',   contact: '9898765432', quoted: 20000, advance: 5000,  confirmed: true,  backup: '',                              notes: '1 photographer + 1 videographer' },
    { name: 'CityRide Transport',          category: 'Transport',      contact: '9900112233', quoted: 10000, advance: 0,     confirmed: false, backup: 'FastWheels 9900445566',          notes: 'Shuttle for 30 outstation guests' },
    { name: 'Shri Sai Mahal',              category: 'Venue',          contact: '0522-2345678',quoted:40000, advance: 20000, confirmed: true,  backup: '',                              notes: 'Hall capacity 200, AC included' },
    { name: 'Soundwave Events',            category: 'Sound & Lights', contact: '9811223344', quoted: 8000,  advance: 0,     confirmed: false, backup: '',                              notes: '2 speakers, 2 mics, stage lights' },
  ];
  return vendors.map(v => ({ ...v, id: uid(), eventId, createdAt: new Date().toISOString() }));
}

function createDemoTimeline(eventId) {
  const eventDate = addDays(today(), 30);
  const phases = [
    { phase: '30 days before', daysOffset: 0,   items: [
      { task: 'Confirm all vendor bookings',       owner: 'Aman',  status: 'pending' },
      { task: 'Finalise guest list',               owner: 'Priya', status: 'completed' },
      { task: 'Send digital invitations',          owner: 'Priya', status: 'completed' },
      { task: 'Collect all vendor quotes',         owner: 'Raj',   status: 'completed' },
    ]},
    { phase: '14 days before', daysOffset: 16, items: [
      { task: 'Pay venue balance advance',         owner: 'Raj',   status: 'pending' },
      { task: 'Finalise decoration theme',         owner: 'Riya',  status: 'pending' },
      { task: 'Prepare volunteer duty roster',     owner: 'Neha',  status: 'pending' },
      { task: 'Confirm caterer menu',              owner: 'Aman',  status: 'pending' },
    ]},
    { phase: '7 days before',  daysOffset: 23, items: [
      { task: 'Print physical invitations',        owner: 'Sunita',status: 'pending' },
      { task: 'Do venue site visit',               owner: 'Aman',  status: 'pending' },
      { task: 'Test sound system',                 owner: 'Raj',   status: 'pending' },
      { task: 'Book backup generator',             owner: 'Aman',  status: 'pending' },
    ]},
    { phase: '3 days before',  daysOffset: 27, items: [
      { task: 'Collect flowers and fresh décor',   owner: 'Riya',  status: 'pending' },
      { task: 'Final volunteer briefing',          owner: 'Neha',  status: 'pending' },
      { task: 'Confirm transport timings',         owner: 'Raj',   status: 'pending' },
    ]},
    { phase: '1 day before',   daysOffset: 29, items: [
      { task: 'Set up decoration',                 owner: 'Riya',  status: 'pending' },
      { task: 'Arrange seating layout',            owner: 'Neha',  status: 'pending' },
      { task: 'Check welcome area & signage',      owner: 'Sunita',status: 'pending' },
    ]},
    { phase: 'Event day',      daysOffset: 30, items: [
      { task: 'Welcome guests at gate',            owner: 'Raj',   status: 'pending' },
      { task: 'Coordinate with caterer',           owner: 'Aman',  status: 'pending' },
      { task: 'Manage photographer schedule',      owner: 'Riya',  status: 'pending' },
      { task: 'Assist elderly and wheelchair guests', owner: 'Neha', status: 'pending' },
    ]},
    { phase: 'After event',    daysOffset: 32, items: [
      { task: 'Pay remaining vendor balances',     owner: 'Raj',   status: 'pending' },
      { task: 'Collect photos from photographer',  owner: 'Priya', status: 'pending' },
      { task: 'Send thank-you messages',           owner: 'Priya', status: 'pending' },
      { task: 'Return borrowed equipment',         owner: 'Aman',  status: 'pending' },
    ]},
  ];

  const items = [];
  phases.forEach(phase => {
    phase.items.forEach(item => {
      items.push({
        id: uid(),
        eventId,
        phase: phase.phase,
        date: addDays(today(), phase.daysOffset),
        task: item.task,
        owner: item.owner,
        status: item.status,
        createdAt: new Date().toISOString(),
      });
    });
  });
  return items;
}

// ─── Generate Initial Data From Form ─────────────────────────
function generateTasksForEvent(event) {
  const tasks = [
    { name: 'Confirm venue booking',        category: 'Venue',      owner: '',  backup: '', deadline: addDays(today(), 3),               priority: 'urgent',  status: 'pending', notes: '' },
    { name: 'Finalise guest list',          category: 'Admin',      owner: '',  backup: '', deadline: addDays(today(), 7),               priority: 'high',    status: 'pending', notes: '' },
    { name: 'Send invitations',             category: 'Admin',      owner: '',  backup: '', deadline: addDays(today(), 10),              priority: 'high',    status: 'pending', notes: '' },
    { name: 'Confirm caterer',              category: 'Catering',   owner: '',  backup: '', deadline: addDays(today(), 5),               priority: 'urgent',  status: 'pending', notes: '' },
    { name: 'Book photographer',            category: 'Photography',owner: '',  backup: '', deadline: addDays(today(), 7),               priority: 'high',    status: 'pending', notes: '' },
    { name: 'Arrange decoration',           category: 'Decoration', owner: '',  backup: '', deadline: addDays(event.date, -2),           priority: 'normal',  status: 'pending', notes: '' },
    { name: 'Organise transport',           category: 'Transport',  owner: '',  backup: '', deadline: addDays(event.date, -3),           priority: 'normal',  status: 'pending', notes: '' },
    { name: 'Volunteer briefing',           category: 'Admin',      owner: '',  backup: '', deadline: addDays(event.date, -1),           priority: 'normal',  status: 'pending', notes: '' },
  ];
  return tasks.map(t => ({ ...t, id: uid(), eventId: event.id, createdAt: new Date().toISOString() }));
}

function generateExpensesForEvent(event) {
  const budget = event.budget;
  const expenses = [
    { category: 'Venue',       name: 'Venue booking',       amount: Math.round(budget * 0.25), status: 'pending', dueDate: addDays(today(), 7),  notes: '' },
    { category: 'Catering',    name: 'Catering services',   amount: Math.round(budget * 0.35), status: 'pending', dueDate: addDays(today(), 14), notes: '' },
    { category: 'Decoration',  name: 'Decoration package',  amount: Math.round(budget * 0.12), status: 'pending', dueDate: addDays(today(), 10), notes: '' },
    { category: 'Photography', name: 'Photography package', amount: Math.round(budget * 0.10), status: 'pending', dueDate: addDays(today(), 7),  notes: '' },
    { category: 'Transport',   name: 'Transport',           amount: Math.round(budget * 0.05), status: 'pending', dueDate: addDays(today(), 20), notes: '' },
    { category: 'Emergency',   name: 'Emergency reserve',   amount: Math.round(budget * 0.08), status: 'optional',dueDate: '',                   notes: 'Keep aside' },
    { category: 'Other',       name: 'Miscellaneous',       amount: Math.round(budget * 0.05), status: 'pending', dueDate: '',                   notes: '' },
  ];
  return expenses.map(e => ({ ...e, id: uid(), eventId: event.id, createdAt: new Date().toISOString() }));
}

function generateVendorsForEvent(event) {
  const budget = event.budget;
  const vendors = [
    { name: '', category: 'Venue',          contact: '', quoted: Math.round(budget*0.25), advance: 0, confirmed: false, backup: '', notes: '' },
    { name: '', category: 'Caterer',        contact: '', quoted: Math.round(budget*0.35), advance: 0, confirmed: false, backup: '', notes: '' },
    { name: '', category: 'Decorator',      contact: '', quoted: Math.round(budget*0.12), advance: 0, confirmed: false, backup: '', notes: '' },
    { name: '', category: 'Photographer',   contact: '', quoted: Math.round(budget*0.10), advance: 0, confirmed: false, backup: '', notes: '' },
    { name: '', category: 'Transport',      contact: '', quoted: Math.round(budget*0.05), advance: 0, confirmed: false, backup: '', notes: '' },
  ];
  return vendors.map(v => ({ ...v, id: uid(), eventId: event.id, createdAt: new Date().toISOString() }));
}

function generateTimelineForEvent(event) {
  const phases = [
    { phase: '30 days before', daysOffset: 0,   items: ['Confirm all vendors', 'Finalise guest list', 'Send invitations'] },
    { phase: '14 days before', daysOffset: 16,  items: ['Pay advance payments', 'Finalise decoration', 'Prepare volunteer roster'] },
    { phase: '7 days before',  daysOffset: 23,  items: ['Site visit', 'Confirm menus', 'Test equipment'] },
    { phase: '3 days before',  daysOffset: 27,  items: ['Final briefing', 'Collect decoration items'] },
    { phase: '1 day before',   daysOffset: 29,  items: ['Set up venue', 'Arrange seating'] },
    { phase: 'Event day',      daysOffset: 30,  items: ['Welcome guests', 'Manage schedule', 'Photography coordination'] },
    { phase: 'After event',    daysOffset: 32,  items: ['Clear dues', 'Send thank-you messages'] },
  ];
  const items = [];
  const eventDays = daysFrom(event.date);
  phases.forEach(phase => {
    phase.items.forEach(task => {
      items.push({
        id: uid(), eventId: event.id, phase: phase.phase,
        date: addDays(today(), Math.max(0, eventDays - 30 + phase.daysOffset)),
        task, owner: '', status: 'pending', createdAt: new Date().toISOString(),
      });
    });
  });
  return items;
}

// ─── Crisis Rescue Plans (Deterministic Fallback) ─────────────
const CRISIS_PLANS = {
  'caterer_delayed': (details, event) => ({
    title: 'Caterer Delayed',
    situation: `The caterer is delayed${details.extra ? ' — ' + details.extra : ' by approximately 90 minutes'}. Guests are present and expecting refreshments.`,
    first15: [
      'Call the caterer immediately to confirm revised arrival time.',
      'Inform the venue manager to keep guests seated comfortably.',
      'Activate the backup snack arrangement (fruits, biscuits, water).',
      'Assign a volunteer specifically to manage the waiting area.',
    ],
    next60: [
      'Contact backup food vendor or nearby restaurant for quick snacks.',
      'Serve welcome drinks, chai, and light snacks to all guests.',
      'Shift the main meal timeline by 45–60 minutes.',
      'Update programme anchors about the revised schedule.',
      'Prepare a brief guest announcement.',
    ],
    assignments: [
      { name: event?.volunteers >= 1 ? 'Volunteer 1' : 'Designated Person', task: 'Call caterer and confirm updated ETA' },
      { name: event?.volunteers >= 2 ? 'Volunteer 2' : 'Second Contact', task: 'Inform venue manager, set up waiting area' },
      { name: event?.volunteers >= 3 ? 'Volunteer 3' : 'Helper', task: 'Arrange and distribute welcome snacks' },
      { name: 'Event Organiser', task: 'Approve emergency snack spending from reserve' },
    ],
    budgetImpact: [
      { item: 'Emergency snacks and beverages', amount: 3500 },
      { item: 'Backup food vendor advance (if needed)', amount: 5000 },
    ],
    timelineImpact: 'Main meal delayed by 45–60 minutes. All subsequent events shift accordingly.',
    guestMessage: 'Dear guests, warm welcome refreshments are being served while the main meal is being finalised. We appreciate your patience and joy. 🙏',
    backupOption: 'Contact a nearby vegetarian restaurant for a quick thali delivery for 30–40 guests as a contingency.',
    tasks: [
      { name: 'Contact caterer for revised ETA',        category: 'Catering',   priority: 'urgent', owner: '' },
      { name: 'Set up emergency welcome snack station', category: 'Catering',   priority: 'urgent', owner: '' },
      { name: 'Inform venue manager of delay',          category: 'Venue',      priority: 'high',   owner: '' },
      { name: 'Serve welcome drinks to all guests',     category: 'Guest care', priority: 'high',   owner: '' },
    ],
    expenses: [
      { name: 'Emergency welcome snacks',      category: 'Catering',   amount: 3500, status: 'paid' },
      { name: 'Backup food vendor advance',    category: 'Emergency',  amount: 5000, status: 'promised' },
    ],
  }),
  'vendor_cancelled': (details, event) => ({
    title: 'Vendor Cancelled',
    situation: `A key vendor has cancelled${details.extra ? ' — ' + details.extra : ''}. Immediate replacement or contingency required.`,
    first15: [
      'Confirm the cancellation in writing and note their reason.',
      'Check if any backup vendor was identified during planning.',
      'Search for emergency replacements in your city immediately.',
      'Inform core team of the situation without panicking guests.',
    ],
    next60: [
      'Contact at least three alternative vendors with your requirements.',
      'If decoration vendor cancelled, delegate to volunteers with DIY setup.',
      'If photographer cancelled, check for local freelancers online.',
      'Adjust budget for potential premium on last-minute booking.',
      'Update vendor checklist and document the incident.',
    ],
    assignments: [
      { name: 'Event Lead', task: 'Reach out to 3 backup vendors immediately' },
      { name: 'Finance Person', task: 'Authorise emergency spending from reserve' },
      { name: 'Volunteer Team', task: 'Manage the affected area manually' },
    ],
    budgetImpact: [
      { item: 'Premium for last-minute vendor booking', amount: 5000 },
      { item: 'Potential DIY material cost', amount: 2000 },
    ],
    timelineImpact: 'Possible 1–2 hour delay in the relevant ceremony segment.',
    guestMessage: 'Dear guests, there is a small change to our programme. We will update you shortly. Thank you for celebrating with us! 🙏',
    backupOption: 'Ask trusted community members or volunteers to fill in for non-critical vendor roles.',
    tasks: [
      { name: 'Find and confirm replacement vendor',   category: 'Admin',    priority: 'urgent', owner: '' },
      { name: 'Reassign volunteers to cover gap',      category: 'Admin',    priority: 'urgent', owner: '' },
      { name: 'Adjust programme schedule',             category: 'Admin',    priority: 'high',   owner: '' },
    ],
    expenses: [
      { name: 'Emergency replacement vendor fee', category: 'Emergency', amount: 5000, status: 'pending' },
    ],
  }),
  'heavy_rain': (details, event) => ({
    title: 'Heavy Rain Expected',
    situation: `Heavy rain has been forecast for the event day${details.extra ? ' — ' + details.extra : ''}. Outdoor arrangements may be at risk.`,
    first15: [
      'Check weather forecast across 2–3 reliable apps.',
      'Contact venue manager about indoor shift possibility.',
      'Identify which parts of the programme are outdoors.',
      'Brief volunteers on rain contingency stations.',
    ],
    next60: [
      'Shift outdoor programme elements indoors if possible.',
      'Arrange rain shelters, umbrellas, and covered walkways.',
      'Inform guests of entry arrangements via WhatsApp.',
      'Protect decorations and electronics from moisture.',
      'Move food serving counters under covered area.',
    ],
    assignments: [
      { name: 'Venue Coordinator', task: 'Negotiate indoor space with venue manager' },
      { name: 'Decoration Team', task: 'Weatherproof or shift decorations inside' },
      { name: 'Volunteer Team', task: 'Set up covered walkways and entry shelters' },
    ],
    budgetImpact: [
      { item: 'Umbrella/tarpaulin rental', amount: 2000 },
      { item: 'Extra venue charges for indoor space', amount: 5000 },
    ],
    timelineImpact: 'Programme may shift 30–45 minutes due to guest arrival delays.',
    guestMessage: 'Dear guests, due to expected rain today, please use the covered entrance on the east side. Umbrellas are available at the gate. Looking forward to celebrating with you! 🙏',
    backupOption: 'Hire a waterproof tent/shamiana as emergency cover for outdoor section.',
    tasks: [
      { name: 'Arrange rain shelters at entry points', category: 'Venue',      priority: 'urgent', owner: '' },
      { name: 'Move outdoor décor items inside',       category: 'Decoration', priority: 'urgent', owner: '' },
      { name: 'Inform guests about entry changes',     category: 'Admin',      priority: 'high',   owner: '' },
      { name: 'Protect sound equipment from rain',     category: 'Venue',      priority: 'high',   owner: '' },
    ],
    expenses: [
      { name: 'Rain shelter / tarpaulin rental', category: 'Emergency', amount: 2000, status: 'pending' },
      { name: 'Extra indoor space charges',      category: 'Venue',     amount: 5000, status: 'pending' },
    ],
  }),
  'power_failure': (details, event) => ({
    title: 'Electricity Failure',
    situation: `Power has failed at the venue${details.extra ? ' — ' + details.extra : ''}. Emergency lighting and equipment are required.`,
    first15: [
      'Check if it is a local outage or venue-specific issue.',
      'Contact venue electrician or manager immediately.',
      'Switch on generator if available — check with venue.',
      'Use phone torches and portable lights to maintain visibility.',
    ],
    next60: [
      'Hire a portable generator on emergency basis.',
      'Prioritise power for sound system and lighting.',
      'Shift to natural light areas of venue if daytime event.',
      'Keep food warm using portable equipment.',
      'Ensure safety of elderly and mobility-impaired guests.',
    ],
    assignments: [
      { name: 'Venue Coordinator', task: 'Contact venue electrician and venue manager' },
      { name: 'Technical Team', task: 'Set up emergency portable generator' },
      { name: 'Volunteer Team', task: 'Assist guests, especially elderly, safely' },
    ],
    budgetImpact: [
      { item: 'Emergency generator hire', amount: 4000 },
      { item: 'Portable lighting hire', amount: 1500 },
    ],
    timelineImpact: 'Programme paused for 20–40 minutes until power is restored.',
    guestMessage: 'Dear guests, we are experiencing a brief power interruption. Our team is resolving it right away. Please stay comfortable — refreshments are still being served. Thank you! 🙏',
    backupOption: 'Contact a local generator hire service for immediate delivery.',
    tasks: [
      { name: 'Contact venue electrician',           category: 'Venue',    priority: 'urgent', owner: '' },
      { name: 'Arrange portable generator hire',     category: 'Venue',    priority: 'urgent', owner: '' },
      { name: 'Distribute emergency lighting',       category: 'Venue',    priority: 'high',   owner: '' },
      { name: 'Ensure elderly guest safety',         category: 'Guest care', priority: 'high', owner: '' },
    ],
    expenses: [
      { name: 'Emergency generator hire',  category: 'Venue',     amount: 4000, status: 'paid' },
      { name: 'Portable lighting hire',    category: 'Emergency', amount: 1500, status: 'paid' },
    ],
  }),
  'extra_guests': (details, event) => ({
    title: 'More Guests Arrived',
    situation: `More guests have arrived than planned${details.extra ? ' — ' + details.extra : '. Approximately 15–25 extra guests.'}`,
    first15: [
      'Count additional guests accurately — assign a volunteer to the gate.',
      'Inform the caterer immediately about extra headcount.',
      'Check if venue can accommodate extra seating.',
      'Send a volunteer to arrange additional chairs and plates.',
    ],
    next60: [
      'Order extra food — contact caterer for immediate addition.',
      'Rearrange seating layout to fit more guests comfortably.',
      'Increase welcome snacks and beverages immediately.',
      'Brief serving volunteers about the increased count.',
    ],
    assignments: [
      { name: 'Gate Volunteer', task: 'Count and note all additional arrivals' },
      { name: 'Catering Coordinator', task: 'Call caterer and order extra food' },
      { name: 'Seating Volunteer', task: 'Arrange extra chairs and table settings' },
    ],
    budgetImpact: [
      { item: 'Extra food per head (₹600 × 20 guests)', amount: 12000 },
      { item: 'Extra seating and tableware', amount: 3000 },
    ],
    timelineImpact: 'Seating arrangement may cause 15–20 minute delay in food service.',
    guestMessage: 'We are so grateful for everyone who joined us today! We are quickly arranging for everyone — please enjoy the welcome refreshments while we get everything set up. 🙏',
    backupOption: 'Order from a nearby restaurant for the extra guests if caterer cannot scale up immediately.',
    tasks: [
      { name: 'Count and register extra guests',     category: 'Admin',      priority: 'urgent', owner: '' },
      { name: 'Call caterer for extra food order',   category: 'Catering',   priority: 'urgent', owner: '' },
      { name: 'Arrange extra chairs and seating',    category: 'Venue',      priority: 'high',   owner: '' },
      { name: 'Increase beverage supply',            category: 'Catering',   priority: 'high',   owner: '' },
    ],
    expenses: [
      { name: 'Extra food for additional guests',    category: 'Catering',  amount: 12000, status: 'promised' },
      { name: 'Extra seating and tableware',         category: 'Venue',     amount: 3000,  status: 'pending' },
    ],
  }),
  'budget_reduced': (details, event) => ({
    title: 'Budget Reduced',
    situation: `Available budget has been reduced unexpectedly${details.extra ? ' — ' + details.extra : ''}. Cost optimisation is needed immediately.`,
    first15: [
      'Determine exact new budget and the shortfall amount.',
      'List all pending unpaid expenses immediately.',
      'Identify which expenses can be deferred or removed.',
      'Call a quick core team meeting to align on priorities.',
    ],
    next60: [
      'Renegotiate with vendors — most prefer reduced payment to cancellation.',
      'Reduce optional items: extra decoration, printed materials.',
      'Consider DIY alternatives for non-critical elements.',
      'Explore community support — family contributions.',
      'Adjust menu to lower-cost but dignified options.',
    ],
    assignments: [
      { name: 'Finance Lead', task: 'Calculate exact shortfall and new budget breakdown' },
      { name: 'Vendor Coordinator', task: 'Call vendors to renegotiate terms' },
      { name: 'Event Lead', task: 'Decide which items are truly non-negotiable' },
    ],
    budgetImpact: [
      { item: 'Estimated savings from vendor renegotiation', amount: -8000 },
      { item: 'Estimated savings from optional item removal', amount: -5000 },
    ],
    timelineImpact: 'No timeline impact expected if handled today.',
    guestMessage: 'No guest communication required at this stage — the celebration continues as planned.',
    backupOption: 'Community contribution model — let close family members contribute a specific item each.',
    tasks: [
      { name: 'List and prioritise all pending expenses', category: 'Admin',    priority: 'urgent', owner: '' },
      { name: 'Renegotiate with top 3 vendors',          category: 'Admin',    priority: 'urgent', owner: '' },
      { name: 'Remove optional expense items',           category: 'Admin',    priority: 'high',   owner: '' },
    ],
    expenses: [],
  }),
  'vip_late': (details, event) => ({
    title: 'Important Guest is Late',
    situation: `An important guest is running late${details.extra ? ' — ' + details.extra : ''}. Key ceremonies may need to be rescheduled.`,
    first15: [
      'Confirm the guest\'s current location and revised ETA.',
      'Decide which ceremonies absolutely require their presence.',
      'Brief the programme anchor about the schedule flexibility.',
      'Keep other guests engaged with music and refreshments.',
    ],
    next60: [
      'Rearrange programme to move non-essential items first.',
      'Keep the ceremony requiring the guest\'s presence for after arrival.',
      'Send a volunteer to receive the guest at the gate.',
      'Prepare a brief but warm welcome acknowledgement.',
    ],
    assignments: [
      { name: 'Programme Anchor', task: 'Adjust running order gracefully' },
      { name: 'Gate Volunteer', task: 'Receive the guest on arrival with warmth' },
      { name: 'Host / Organiser', task: 'Keep guests entertained and relaxed' },
    ],
    budgetImpact: [],
    timelineImpact: 'Ceremony rearranged by approximately 30–60 minutes.',
    guestMessage: 'We are delighted to have so many of you here! We are making a small change to the programme order to make the celebration even more special. 🙏',
    backupOption: 'Begin the secondary programme items and schedule the main ceremony as the guest arrives.',
    tasks: [
      { name: 'Confirm VIP guest ETA',               category: 'Guest care', priority: 'urgent', owner: '' },
      { name: 'Adjust programme running order',      category: 'Admin',      priority: 'urgent', owner: '' },
      { name: 'Assign reception volunteer for guest',category: 'Guest care', priority: 'high',   owner: '' },
    ],
    expenses: [],
  }),
  'custom': (details, event) => ({
    title: 'Custom Emergency',
    situation: details.extra || 'An unexpected situation has arisen that requires immediate attention.',
    first15: [
      'Gather all relevant information about the situation.',
      'Identify the immediate impact on guests and programme.',
      'Assemble the core response team.',
      'Take one decisive action in the first 5 minutes.',
    ],
    next60: [
      'Implement the primary fix or workaround.',
      'Keep guests informed if needed — use calm, reassuring language.',
      'Document what happened for the incident log.',
      'Identify what backup resources are available.',
    ],
    assignments: [
      { name: 'Event Lead', task: 'Take command and coordinate response' },
      { name: 'Volunteer Team', task: 'Execute immediate physical tasks' },
      { name: 'Communication Lead', task: 'Manage guest communication if needed' },
    ],
    budgetImpact: [
      { item: 'Emergency contingency (estimate)', amount: 5000 },
    ],
    timelineImpact: 'Assess after situation is controlled.',
    guestMessage: 'Dear guests, we are addressing a small situation — our team is on it. Please continue to enjoy yourself. Thank you for your patience! 🙏',
    backupOption: 'Use emergency reserve fund and volunteer team for rapid response.',
    tasks: [
      { name: 'Assess and contain the situation',    category: 'Admin',    priority: 'urgent', owner: '' },
      { name: 'Brief core team on action plan',      category: 'Admin',    priority: 'urgent', owner: '' },
      { name: 'Document the incident',               category: 'Admin',    priority: 'normal', owner: '' },
    ],
    expenses: [
      { name: 'Emergency contingency spending', category: 'Emergency', amount: 5000, status: 'pending' },
    ],
  }),
};

function generateRescuePlan(crisisType, details, event) {
  const fn = CRISIS_PLANS[crisisType] || CRISIS_PLANS['custom'];
  return fn(details, event);
}

// ─── Message Templates (Fallback) ────────────────────────────
const MESSAGE_TEMPLATES = {
  vendor_reminder: {
    en: (data) => `Dear ${data.recipient || 'Vendor'},\n\nThis is a friendly reminder regarding our event "${data.eventName}" scheduled for ${data.eventDate}.\n\nWe would appreciate your confirmation of the arrangement as agreed. Kindly reply at your earliest convenience.\n\nThank you for your services.\n\nWarm regards,\n${data.organiser || 'Event Organiser'}`,
    hi: (data) => `प्रिय ${data.recipient || 'विक्रेता'},\n\nयह "${data.eventName}" कार्यक्रम (${data.eventDate}) के संबंध में एक विनम्र अनुस्मारक है।\n\nकृपया हमारी व्यवस्था की पुष्टि करें।\n\nधन्यवाद।\n${data.organiser || 'कार्यक्रम आयोजक'}`,
    hinglish: (data) => `Dear ${data.recipient || 'Vendor'},\n\nYeh "${data.eventName}" (${data.eventDate}) ke baare mein ek reminder hai.\n\nKripya apni confirmation jaldi bhejein — sabkuch set karna hai!\n\nShukriya 🙏\n${data.organiser || 'Event Organiser'}`,
  },
  guest_invitation: {
    en: (data) => `Dear ${data.recipient || 'Guest'},\n\nWe joyfully invite you to celebrate "${data.eventName}" on ${data.eventDate} in ${data.city || 'our city'}.\n\nYour presence will make this occasion truly special. Please join us and share in our happiness.\n\nLooking forward to seeing you!\n\nWith love and warmth,\n${data.organiser || 'The Family'}`,
    hi: (data) => `प्रिय ${data.recipient || 'अतिथि'},\n\n"${data.eventName}" के अवसर पर ${data.eventDate} को ${data.city || ''} में आपको सादर आमंत्रित किया जाता है।\n\nआपकी उपस्थिति हमारे लिए अत्यंत महत्वपूर्ण है।\n\nसस्नेह,\n${data.organiser || 'परिवार'}`,
    hinglish: (data) => `${data.recipient || 'Aap'}!\n\nHumari "${data.eventName}" mein aapka dil se swagat hai! 🎉\n\nDate: ${data.eventDate}\nJagah: ${data.city || 'Details to follow'}\n\nAana zaroor — aapke bina adhoori hai yeh khushi!\n\nPyaar ke saath,\n${data.organiser || 'Parivaar'}`,
  },
  delay_notification: {
    en: (data) => `Dear ${data.recipient || 'Guests'},\n\nWe wanted to let you know that "${data.eventName}" will begin approximately ${data.extra || '30 minutes'} later than scheduled.\n\nWe apologise for the inconvenience and thank you for your patience. The celebration is absolutely on — we will make sure it is worth the wait!\n\nThank you,\n${data.organiser || 'Event Team'}`,
    hi: (data) => `प्रिय ${data.recipient || 'अतिथि'},\n\n"${data.eventName}" में लगभग ${data.extra || '30 मिनट'} की देरी हो रही है।\n\nआपकी समझ के लिए धन्यवाद।\n\n${data.organiser || 'आयोजन समिति'}`,
    hinglish: (data) => `Namaste ${data.recipient || 'Sabhi'}! 🙏\n\nThodi si delay ho rahi hai — "${data.eventName}" ${data.extra || '30 minute'} baad shuru hogi.\n\nAap comfortable rahein, refreshments serve ho rahe hain. Shukriya!\n\n${data.organiser || 'Team Sahaay'}`,
  },
  volunteer_assignment: {
    en: (data) => `Hi ${data.recipient || 'Volunteer'},\n\nThank you for being part of "${data.eventName}" on ${data.eventDate}.\n\nYour assigned role: ${data.extra || 'General assistance'}\n\nPlease arrive 2 hours before the event and check in with the coordination team.\n\nWe are grateful for your support!\n\nWarm regards,\n${data.organiser || 'Event Team'}`,
    hinglish: (data) => `Hi ${data.recipient || 'Volunteer'}! 👋\n\n"${data.eventName}" mein tumhara swagat hai!\n\nTumhari duty: ${data.extra || 'General help'}\n\n${data.eventDate} ko event se 2 ghante pehle pahuncho. Check-in karo coordination team ke saath.\n\nTumhari help ke bina yeh event adhoora hai. Shukriya! 🙏\n\n${data.organiser || 'Team'}`,
  },
  payment_reminder: {
    en: (data) => `Dear ${data.recipient || 'Vendor'},\n\nThis is a reminder that a payment of ${data.extra || 'the agreed amount'} is due for "${data.eventName}".\n\nKindly process the payment at the earliest to avoid any disruption to our arrangement.\n\nPlease confirm receipt of this message.\n\nThank you,\n${data.organiser || 'Event Organiser'}`,
    hinglish: (data) => `Dear ${data.recipient || 'Vendor'},\n\n"${data.eventName}" ke liye ${data.extra || 'payment'} pending hai.\n\nJaldi se confirm karein taki sab set rahe.\n\nShukriya 🙏\n${data.organiser || 'Organiser'}`,
  },
  thankyou: {
    en: (data) => `Dear ${data.recipient || 'Everyone'},\n\nFrom the bottom of our hearts — thank you for making "${data.eventName}" such a beautiful and memorable celebration.\n\nYour presence, support, and warmth meant everything to us. We are truly grateful.\n\nWith love and gratitude,\n${data.organiser || 'The Family'}`,
    hi: (data) => `प्रिय ${data.recipient || 'सभी'},\n\n"${data.eventName}" को इतना यादगार बनाने के लिए हृदय से आभार।\n\nआपका प्यार और सहयोग हमारे लिए अमूल्य है।\n\nसादर,\n${data.organiser || 'परिवार'}`,
    hinglish: (data) => `${data.recipient || 'Aap sabhi'} ❤️\n\n"${data.eventName}" mein aapka saath raha — bas yahi chahiye tha!\n\nAapka pyaar aur presence se yeh celebration complete hua. Dil se shukriya! 🙏\n\n${data.organiser || 'Hum sab'}`,
  },
  emergency_announcement: {
    en: (data) => `Dear Guests,\n\nOur team is handling a small situation at "${data.eventName}". Please remain comfortable where you are.\n\n${data.extra || 'We will update you shortly.'}\n\nThank you for your patience and understanding. 🙏\n\n${data.organiser || 'Event Team'}`,
    hinglish: (data) => `Saare mehman,\n\nHumari team ek chhoti si situation handle kar rahi hai. Aap relax karein! 🙏\n\n${data.extra || 'Hum jald hi update denge.'}\n\nAapka shukriya!\n\n${data.organiser || 'Team'}`,
  },
};

function generateMessage(type, lang, data) {
  const templates = MESSAGE_TEMPLATES[type];
  if (!templates) return `Message type not found. Please try another type.`;
  const langKey = lang === 'Hindi' ? 'hi' : lang === 'Hinglish' ? 'hinglish' : 'en';
  const fn = templates[langKey] || templates['en'] || templates['hinglish'];
  if (!fn) return `Template not available in ${lang}.`;
  return fn(data);
}

// ─── Task Extraction from Text ───────────────────────────────
function extractTasksFromText(text) {
  const tasks = [];
  const sentences = text.split(/[.!?।]+/).map(s => s.trim()).filter(s => s.length > 5);

  const actionWords = ['collect', 'confirm', 'arrange', 'contact', 'book', 'handle', 'manage',
    'prepare', 'send', 'call', 'check', 'finalize', 'finalise', 'complete', 'do', 'get',
    'setup', 'set up', 'pick', 'bring', 'meet', 'coordinate', 'ensure', 'take care of'];

  const timePatterns = [
    { re: /by\s+(\d+\s*(?:am|pm|AM|PM))/i, label: 'by $1' },
    { re: /before\s+(\d+\s*(?:am|pm|AM|PM))/i, label: 'before $1' },
    { re: /at\s+(\d+\s*(?:am|pm|AM|PM))/i, label: 'at $1' },
  ];

  sentences.forEach(sentence => {
    const hasAction = actionWords.some(a => sentence.toLowerCase().includes(a));
    if (!hasAction) return;

    // Try to extract a person name (capitalized word near start or after 'can'/'should'/'will')
    let owner = '';
    const nameMatch = sentence.match(/^([A-Z][a-z]+)\s+(can|should|will|must|needs? to)/i)
      || sentence.match(/\b([A-Z][a-z]+)\s+(can|should|will|must|needs? to)/);
    if (nameMatch) owner = nameMatch[1];

    // Extract time
    let deadline = addDays(today(), 7);
    for (const p of timePatterns) {
      const m = sentence.match(p.re);
      if (m) { deadline = addDays(today(), 0); break; }
    }

    // Build task name — strip the person name, keep action
    let taskName = sentence
      .replace(/^[A-Z][a-z]+\s+(can|should|will|must|needs? to)\s+/i, '')
      .replace(/^(can|should|will|must|needs? to)\s+/i, '')
      .trim();
    if (!taskName || taskName.length < 4) return;
    taskName = taskName.charAt(0).toUpperCase() + taskName.slice(1);

    tasks.push({
      name: taskName,
      owner,
      deadline,
      priority: 'normal',
      category: 'Extracted',
      status: 'pending',
      notes: 'Extracted from message: "' + sentence.substring(0, 60) + (sentence.length > 60 ? '…' : '') + '"',
    });
  });

  return tasks;
}

// ─── Budget Calculations ──────────────────────────────────────
function calcBudgetStats(event, expenses) {
  const total = event ? Number(event.budget) || 0 : 0;
  const committed = expenses.filter(e => ['paid','promised'].includes(e.status)).reduce((s,e)=>s+Number(e.amount||0),0);
  const paid      = expenses.filter(e => e.status === 'paid').reduce((s,e)=>s+Number(e.amount||0),0);
  const pending   = expenses.filter(e => e.status === 'pending').reduce((s,e)=>s+Number(e.amount||0),0);
  const optional  = expenses.filter(e => e.status === 'optional').reduce((s,e)=>s+Number(e.amount||0),0);
  const reserve   = expenses.filter(e => e.category === 'Emergency' || e.category === 'emergency').reduce((s,e)=>s+Number(e.amount||0),0);
  const remaining = Math.max(0, total - committed - pending);
  const overBudget = (committed + pending) > total;
  return { total, committed, paid, pending, optional, reserve, remaining, overBudget };
}

// ─── What-If Simulation ───────────────────────────────────────
function simulateWhatIf(event, expenses, changes) {
  const base = calcBudgetStats(event, expenses);
  let impact = 0;
  const breakdown = [];

  if (changes.extraGuests && changes.extraGuests > 0) {
    const perHead = 600;
    const foodIncrease = changes.extraGuests * perHead;
    const seatingIncrease = changes.extraGuests * 150;
    impact += foodIncrease + seatingIncrease;
    breakdown.push({ label: `Extra food (${changes.extraGuests} guests × ₹${perHead})`, amount: foodIncrease });
    breakdown.push({ label: `Extra seating (${changes.extraGuests} × ₹150)`, amount: seatingIncrease });
  }

  if (changes.unexpectedExpense && changes.unexpectedExpense > 0) {
    impact += changes.unexpectedExpense;
    breakdown.push({ label: 'Unexpected expense', amount: changes.unexpectedExpense });
  }

  if (changes.budgetReduction && changes.budgetReduction > 0) {
    impact += changes.budgetReduction;
    breakdown.push({ label: `Budget reduced by ${formatINR(changes.budgetReduction)}`, amount: -changes.budgetReduction });
  }

  const newTotal = base.total - (changes.budgetReduction || 0);
  const newRemaining = Math.max(0, newTotal - base.committed - base.pending - impact + (changes.budgetReduction||0));
  const cuts = [];
  if (newRemaining < 0) {
    cuts.push('Reduce optional decorations by 20%');
    cuts.push('Shift some paper invitations to digital only');
    cuts.push('Negotiate caterer for smaller portion size');
  }

  return { impact, breakdown, newTotal, newRemaining, overBudget: newRemaining < 0, cuts };
}

// Export to global scope
window.SahaayData = {
  KEYS, Store, uid, addDays, today, daysFrom, esc, formatINR, sanitizeText,
  createDemoEvent, createDemoExpenses, createDemoTasks, createDemoVendors, createDemoTimeline,
  generateTasksForEvent, generateExpensesForEvent, generateVendorsForEvent, generateTimelineForEvent,
  generateRescuePlan, generateMessage, extractTasksFromText,
  calcBudgetStats, simulateWhatIf,
};
})();

