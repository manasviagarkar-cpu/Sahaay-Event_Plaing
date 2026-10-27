const fs = require('fs');
const path = require('path');
const vm = require('vm');

const baseDir = typeof __dirname !== 'undefined' ? __dirname : path.resolve('.');
const dataCode = fs.readFileSync(path.join(baseDir, 'data.js'), 'utf8');
const appCode = fs.readFileSync(path.join(baseDir, 'app.js'), 'utf8');
const htmlCode = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');

// Lightweight Mock DOM
class MockElement {
  constructor(tag, id = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.className = '';
    this.classList = {
      _classes: new Set(),
      add: (...cls) => cls.forEach(c => this.classList._classes.add(c)),
      remove: (...cls) => cls.forEach(c => this.classList._classes.delete(c)),
      toggle: (c, force) => {
        if (force === undefined) {
          if (this.classList._classes.has(c)) this.classList._classes.delete(c);
          else this.classList._classes.add(c);
        } else if (force) {
          this.classList._classes.add(c);
        } else {
          this.classList._classes.delete(c);
        }
      },
      contains: (c) => this.classList._classes.has(c)
    };
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.value = '';
    this.textContent = '';
    this._innerHTML = '';
    this.checked = false;
    this.disabled = false;
    this.listeners = {};
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = val;
    const tagRegex = /<([a-z0-9]+)\b([^>]*)>/gi;
    let m;
    while ((m = tagRegex.exec(val)) !== null) {
      const attrs = m[2];
      const idM = attrs.match(/id=["']([^"']+)["']/);
      if (idM) {
        const el = mockDocument.elementsById[idM[1]] || new MockElement(m[1], idM[1]);
        const valM = attrs.match(/value=["']([^"']*)["']/);
        if (valM) el.value = valM[1];
        mockDocument.elementsById[idM[1]] = el;
      }
    }
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
    if (name.startsWith('data-')) {
      const camel = name.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
      this.dataset[camel] = value;
    }
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  removeEventListener(event, fn) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(f => f !== fn);
    }
  }

  dispatchEvent(event) {
    const type = typeof event === 'string' ? event : event.type;
    const fns = this.listeners[type] || [];
    const evObj = typeof event === 'string' ? { type: event, target: this, defaultPrevented: false, preventDefault: () => { evObj.defaultPrevented = true; } } : event;
    fns.forEach(fn => fn.call(this, evObj));
    return !evObj.defaultPrevented;
  }

  click() {
    return this.dispatchEvent({ type: 'click', target: this, stopPropagation: () => {} });
  }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    if (child.id) mockDocument.elementsById[child.id] = child;
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter(c => c !== this);
    }
    if (this.id) delete mockDocument.elementsById[this.id];
  }

  querySelector(selector) {
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      return mockDocument.elementsById[id] || null;
    }
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      return this._findChild(el => el.classList.contains(cls));
    }
    return new MockElement('div');
  }

  querySelectorAll(selector) {
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      const results = [];
      this._findAll(el => el.classList.contains(cls), results);
      return results;
    }
    return [];
  }

  closest(selector) {
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      let curr = this;
      while (curr) {
        if (curr.classList && curr.classList.contains(cls)) return curr;
        curr = curr.parentNode;
      }
    }
    return this;
  }

  focus() {}
  scrollIntoView() {}

  _findChild(pred) {
    for (const child of this.children) {
      if (pred(child)) return child;
      const f = child._findChild(pred);
      if (f) return f;
    }
    return null;
  }

  _findAll(pred, acc) {
    for (const child of this.children) {
      if (pred(child)) acc.push(child);
      child._findAll(pred, acc);
    }
  }
}

// Extract IDs from index.html to pre-populate mockDocument
const idMatches = [...htmlCode.matchAll(/id=["']([^"']+)["']/g)].map(m => m[1]);
const mockDocument = {
  elementsById: {},
  body: new MockElement('body'),
  createElement: (tag) => new MockElement(tag),
  getElementById: (id) => {
    if (!mockDocument.elementsById[id]) {
      mockDocument.elementsById[id] = new MockElement('div', id);
    }
    return mockDocument.elementsById[id];
  },
  querySelectorAll: (selector) => {
    if (selector === '.view') {
      return Object.values(mockDocument.elementsById).filter(el => el.id && el.id.startsWith('view-'));
    }
    if (selector === '.nav-item') {
      return Object.values(mockDocument.elementsById).filter(el => el.classList.contains('nav-item'));
    }
    if (selector === '.bottom-nav-item') {
      return Object.values(mockDocument.elementsById).filter(el => el.classList.contains('bottom-nav-item'));
    }
    if (selector === '[data-view]') {
      return Object.values(mockDocument.elementsById).filter(el => el.dataset.view !== undefined);
    }
    if (selector === '[data-expense-filter]') {
      return Object.values(mockDocument.elementsById).filter(el => el.dataset.expenseFilter !== undefined);
    }
    if (selector === '[data-task-filter]') {
      return Object.values(mockDocument.elementsById).filter(el => el.dataset.taskFilter !== undefined);
    }
    if (selector === '.crisis-card-btn') {
      return Object.values(mockDocument.elementsById).filter(el => el.classList.contains('crisis-card-btn'));
    }
    if (selector === '.message-type-btn') {
      return Object.values(mockDocument.elementsById).filter(el => el.classList.contains('message-type-btn'));
    }
    if (selector === '#ob-accessibility input[type=checkbox]') {
      return Object.values(mockDocument.elementsById).filter(el => el.id && el.id.startsWith('ob-access-'));
    }
    if (selector === '.checkbox-item') {
      return Object.values(mockDocument.elementsById).filter(el => el.classList.contains('checkbox-item'));
    }
    return [];
  },
  addEventListener: (event, fn) => {
    if (!mockDocument._listeners) mockDocument._listeners = {};
    if (!mockDocument._listeners[event]) mockDocument._listeners[event] = [];
    mockDocument._listeners[event].push(fn);
  },
  removeEventListener: (event, fn) => {
    if (mockDocument._listeners && mockDocument._listeners[event]) {
      mockDocument._listeners[event] = mockDocument._listeners[event].filter(f => f !== fn);
    }
  }
};

// Populate elements from index.html
idMatches.forEach(id => {
  mockDocument.elementsById[id] = new MockElement('div', id);
});

// Setup specialized elements with datasets and classes based on index.html
const parseTagDetails = () => {
  const dataViewRegex = /<([a-z0-9]+)\b([^>]*data-view=["']([^"']+)["'][^>]*)>/gi;
  let m;
  while ((m = dataViewRegex.exec(htmlCode)) !== null) {
    const attrs = m[2];
    const view = m[3];
    const idMatch = attrs.match(/id=["']([^"']+)["']/);
    const classMatch = attrs.match(/class=["']([^"']+)["']/);
    const el = idMatch ? mockDocument.getElementById(idMatch[1]) : new MockElement(m[1]);
    el.dataset.view = view;
    if (classMatch) {
      classMatch[1].split(/\s+/).forEach(c => el.classList.add(c));
    }
    if (!idMatch) {
      const tempId = `anon-view-${view}-${Math.random().toString(36).substr(2, 5)}`;
      el.id = tempId;
      mockDocument.elementsById[tempId] = el;
    }
  }

  const expFilterRegex = /<([a-z0-9]+)\b([^>]*data-expense-filter=["']([^"']+)["'][^>]*)>/gi;
  while ((m = expFilterRegex.exec(htmlCode)) !== null) {
    const attrs = m[2];
    const filter = m[3];
    const idMatch = attrs.match(/id=["']([^"']+)["']/);
    const classMatch = attrs.match(/class=["']([^"']+)["']/);
    const el = idMatch ? mockDocument.getElementById(idMatch[1]) : new MockElement(m[1]);
    el.dataset.expenseFilter = filter;
    if (classMatch) classMatch[1].split(/\s+/).forEach(c => el.classList.add(c));
    const tempId = `anon-ef-${filter}-${Math.random().toString(36).substr(2, 5)}`;
    mockDocument.elementsById[tempId] = el;
  }

  const taskFilterRegex = /<([a-z0-9]+)\b([^>]*data-task-filter=["']([^"']+)["'][^>]*)>/gi;
  while ((m = taskFilterRegex.exec(htmlCode)) !== null) {
    const attrs = m[2];
    const filter = m[3];
    const idMatch = attrs.match(/id=["']([^"']+)["']/);
    const classMatch = attrs.match(/class=["']([^"']+)["']/);
    const el = idMatch ? mockDocument.getElementById(idMatch[1]) : new MockElement(m[1]);
    el.dataset.taskFilter = filter;
    if (classMatch) classMatch[1].split(/\s+/).forEach(c => el.classList.add(c));
    const tempId = `anon-tf-${filter}-${Math.random().toString(36).substr(2, 5)}`;
    mockDocument.elementsById[tempId] = el;
  }
};
parseTagDetails();

// Mock localStorage
const mockStorage = {};
const mockLocalStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

// Mock clipboard
let copiedClipboardText = '';
const mockNavigator = {
  clipboard: {
    writeText: async (text) => {
      copiedClipboardText = text;
      return Promise.resolve();
    }
  }
};

// Mock FileReader
class MockFileReader {
  readAsText(file) {
    if (file && typeof file.text === 'function') {
      file.text().then(t => {
        this.result = t;
        if (this.onload) this.onload({ target: this });
      });
    } else {
      this.result = (file && file.content) ? file.content : '';
      if (this.onload) this.onload({ target: this });
    }
  }
}

// Sandbox context
const windowListeners = {};
const sandbox = {
  console,
  setTimeout: (fn) => { fn(); return 1; },
  clearTimeout: () => {},
  setInterval: (fn) => { fn(); return 2; },
  clearInterval: () => {},
  document: mockDocument,
  innerWidth: 1200,
  addEventListener: (event, fn) => {
    if (!windowListeners[event]) windowListeners[event] = [];
    windowListeners[event].push(fn);
  },
  removeEventListener: (event, fn) => {
    if (windowListeners[event]) {
      windowListeners[event] = windowListeners[event].filter(f => f !== fn);
    }
  },
  location: {
    reload: () => {
      mockDocument.getElementById('onboarding-screen').style.display = 'flex';
      mockDocument.getElementById('app').style.display = 'none';
    }
  },
  FileReader: MockFileReader,
  localStorage: mockLocalStorage,
  navigator: mockNavigator,
  Date,
  Math,
  parseInt,
  parseFloat,
  String,
  Number,
  Boolean,
  Array,
  Object,
  JSON,
  Blob: class { constructor(parts) { this.parts = parts; } },
  URL: { createObjectURL: () => 'blob://mock-url', revokeObjectURL: () => {} }
};
sandbox.window = sandbox;

// Run data.js
vm.createContext(sandbox);
vm.runInContext(dataCode, sandbox);

// Run app.js
vm.runInContext(appCode, sandbox);

// QA Test Suite Runner
const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, pass: true });
    console.log(`[PASS] ${name}`);
  } catch (err) {
    results.push({ name, pass: false, error: err.message });
    console.error(`[FAIL] ${name}: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

console.log('\n========================================');
console.log('   STARTING SAHAAY FULL QA TEST SUITE   ');
console.log('========================================\n');

// Trigger initial DOM listeners
if (mockDocument._listeners && mockDocument._listeners['DOMContentLoaded']) {
  mockDocument._listeners['DOMContentLoaded'].forEach(fn => fn());
}

// Helper to access current app state
const state = () => sandbox.SahaayApp.getState();

// 1. Onboarding Test
test('1. Onboarding Form - Validation on Empty/Invalid Input', () => {
  sandbox.document.getElementById('ob-event-name').value = '';
  sandbox.document.getElementById('ob-budget').value = '500'; // Under min 1000
  sandbox.SahaayApp.submitOnboardingForm();
  assert(!sandbox.localStorage.getItem('sahaay_event'), 'Event should not be saved on invalid input');
  assert(sandbox.document.getElementById('err-event-name').classList.contains('visible'), 'Event name error should show');
  assert(sandbox.document.getElementById('err-budget').classList.contains('visible'), 'Budget error should show');
});

test('1b. Onboarding Form - Successful Submission', () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 45);
  const dateStr = futureDate.toISOString().split('T')[0];

  sandbox.document.getElementById('ob-event-name').value = 'Diwali Grand Gala';
  sandbox.document.getElementById('ob-event-type').value = 'festival';
  sandbox.document.getElementById('ob-date').value = dateStr;
  sandbox.document.getElementById('ob-city').value = 'Jaipur';
  sandbox.document.getElementById('ob-guests').value = '350';
  sandbox.document.getElementById('ob-budget').value = '750000';
  sandbox.document.getElementById('ob-food').value = 'Vegetarian';
  sandbox.document.getElementById('ob-language').value = 'Hindi';
  sandbox.document.getElementById('ob-volunteers').value = '12';

  sandbox.SahaayApp.submitOnboardingForm();

  const savedEvt = JSON.parse(sandbox.localStorage.getItem('sahaay_event'));
  assert(savedEvt && savedEvt.name === 'Diwali Grand Gala', 'Event should be saved in localStorage');
  assert(savedEvt.budget === 750000, 'Budget should match input');
  assert(savedEvt.guests === 350, 'Guests should match input');

  // Verify starter datasets generated
  const exp = JSON.parse(sandbox.localStorage.getItem('sahaay_expenses') || '[]');
  const tsk = JSON.parse(sandbox.localStorage.getItem('sahaay_tasks') || '[]');
  const vnd = JSON.parse(sandbox.localStorage.getItem('sahaay_vendors') || '[]');
  const tl = JSON.parse(sandbox.localStorage.getItem('sahaay_timeline') || '[]');
  assert(exp.length > 0, 'Starter expenses should be generated');
  assert(tsk.length > 0, 'Starter tasks should be generated');
  assert(vnd.length > 0, 'Starter vendors should be generated');
  assert(tl.length > 0, 'Starter timeline should be generated');
});

// 2. Demo Event Loading Test
test('2. Demo Event Loading', () => {
  sandbox.SahaayApp.loadDemoEvent();
  const demoEvt = JSON.parse(sandbox.localStorage.getItem('sahaay_event'));
  assert(demoEvt && demoEvt.name.includes('Asha'), 'Demo event should be Asha & Rohan wedding');
  const exp = JSON.parse(sandbox.localStorage.getItem('sahaay_expenses'));
  const tsk = JSON.parse(sandbox.localStorage.getItem('sahaay_tasks'));
  assert(exp.length >= 7, 'Demo should include comprehensive expenses');
  assert(tsk.length >= 7, 'Demo should include comprehensive tasks');
});

// 3. Expense Operations: Add, Edit, Delete, Filter
test('3. Expenses - Add, Edit, Delete & Filter', () => {
  sandbox.SahaayApp.navigateTo('budget');
  const initialCount = state().currentExpenses.length;

  // Add expense
  sandbox.SahaayApp.openAddExpenseModal();
  sandbox.document.getElementById('exp-name').value = 'Test Dhol Troupe';
  sandbox.document.getElementById('exp-amount').value = '25000';
  sandbox.document.getElementById('exp-category').value = 'Entertainment';
  sandbox.document.getElementById('exp-status').value = 'promised';
  sandbox.document.getElementById('exp-due').value = '2026-11-15';
  sandbox.document.getElementById('exp-notes').value = '5 drummers included';
  
  // Click save
  sandbox.document.getElementById('modal-save-btn').click();
  assert(state().currentExpenses.length === initialCount + 1, 'Expense count should increment');
  const added = state().currentExpenses.find(e => e.name === 'Test Dhol Troupe');
  assert(added && added.amount === 25000 && added.status === 'promised', 'Added expense properties correct');

  // Edit expense
  sandbox.SahaayApp.openEditExpenseModal(added.id);
  sandbox.document.getElementById('exp-amount').value = '28000';
  sandbox.document.getElementById('exp-status').value = 'paid';
  sandbox.document.getElementById('modal-save-btn').click();
  const edited = state().currentExpenses.find(e => e.id === added.id);
  assert(edited.amount === 28000 && edited.status === 'paid', 'Edited expense updated');

  // Delete expense
  sandbox.SahaayApp.deleteExpense(added.id);
  sandbox.document.getElementById('modal-confirm-btn').click();
  assert(!state().currentExpenses.find(e => e.id === added.id), 'Deleted expense should be removed');
  assert(state().currentExpenses.length === initialCount, 'Expense count should return to initial');
});

// 4. What-If Budget Calculator
test('4. What-If Budget Calculator', () => {
  sandbox.SahaayApp.navigateTo('budget');
  sandbox.document.getElementById('wi-guests').value = '40';
  sandbox.document.getElementById('wi-expense').value = '25000';
  sandbox.document.getElementById('wi-budget-cut').value = '0';
  sandbox.SahaayApp.runWhatIf();
  const resultDiv = sandbox.document.getElementById('wi-result');
  assert(resultDiv.style.display === 'block', 'What-if result card should be visible');
  assert(resultDiv.innerHTML.includes('Impact') || resultDiv.innerHTML.includes('₹'), 'What-if result should calculate financial impact');
});

// 5. Tasks: Add, Complete, Reopen, Delete, Extract
test('5. Tasks - Add, Complete, Reopen, Delete & Extract', () => {
  sandbox.SahaayApp.navigateTo('tasks');
  const initialCount = state().currentTasks.length;

  // Add Task
  sandbox.SahaayApp.openAddTaskModal();
  sandbox.document.getElementById('task-name-inp').value = 'Test Floral Garlands';
  sandbox.document.getElementById('task-category-inp').value = 'Decoration';
  sandbox.document.getElementById('task-priority-inp').value = 'urgent';
  sandbox.document.getElementById('task-owner-inp').value = 'Uncle Sanjay';
  sandbox.document.getElementById('task-backup-inp').value = 'Rohan';
  sandbox.document.getElementById('task-deadline-inp').value = '10:00 AM';
  sandbox.document.getElementById('task-notes-inp').value = 'Fresh jasmine';
  sandbox.document.getElementById('modal-save-btn').click();

  assert(state().currentTasks.length === initialCount + 1, 'Task count should increment');
  const added = state().currentTasks.find(t => t.name === 'Test Floral Garlands');
  assert(added && added.priority === 'urgent' && added.status === 'pending', 'Added task pending');

  // Complete task
  sandbox.SahaayApp.completeTask(added.id);
  assert(added.status === 'completed', 'Task status should be completed');

  // Reopen task
  sandbox.SahaayApp.reopenTask(added.id);
  assert(added.status === 'pending', 'Task status should be reopened to pending');

  // Delete task
  sandbox.SahaayApp.deleteTask(added.id);
  sandbox.document.getElementById('modal-confirm-btn').click();
  assert(!state().currentTasks.find(t => t.id === added.id), 'Deleted task should be removed');

  // Extract tasks from text
  sandbox.document.getElementById('extract-input').value = 'Call Pandit ji for timing, purchase 10kg motichoor laddoos, double check tent anchors';
  sandbox.SahaayApp.runExtractTasks();
  const preview = sandbox.document.getElementById('extract-preview');
  assert(preview.style.display === 'block', 'Extract preview should become visible');
  
  // Confirm extracted tasks
  sandbox.SahaayApp.confirmExtractedTasks(3);
  const hasExtracted = state().currentTasks.some(t => t.name.toLowerCase().includes('pandit') || t.name.toLowerCase().includes('laddoo') || t.category === 'Extracted');
  assert(hasExtracted, 'Extracted tasks should be imported into currentTasks');
});

// 6. Vendors: Add, Edit, Confirm, Copy Contact, Delete
test('6. Vendors - Add, Edit, Confirm, Copy Contact, Delete', () => {
  sandbox.SahaayApp.navigateTo('vendors');
  const initialCount = state().currentVendors.length;

  // Add Vendor
  sandbox.SahaayApp.openAddVendorModal();
  sandbox.document.getElementById('v-name').value = 'Grand Royal Decorators';
  sandbox.document.getElementById('v-category').value = 'Decoration';
  sandbox.document.getElementById('v-quoted').value = '200000';
  sandbox.document.getElementById('v-advance').value = '50000';
  sandbox.document.getElementById('v-contact').value = '9811122233';
  sandbox.document.getElementById('v-backup').value = '9899988877';
  sandbox.document.getElementById('v-notes').value = 'Stage and mandap flowers';
  sandbox.document.getElementById('modal-save-btn').click();

  assert(state().currentVendors.length === initialCount + 1, 'Vendor count should increment');
  const added = state().currentVendors.find(v => v.name === 'Grand Royal Decorators');
  assert(added && added.quoted === 200000, 'Vendor details saved');

  // Confirm vendor
  sandbox.SahaayApp.confirmVendor(added.id);
  assert(added.confirmed === true, 'Vendor status should toggle to confirmed');

  // Copy contact
  sandbox.SahaayApp.copyContact(added.contact, added.name);
  assert(copiedClipboardText.includes('9811122233'), 'Copied vendor contact number into clipboard');

  // Edit vendor
  sandbox.SahaayApp.openEditVendorModal(added.id);
  sandbox.document.getElementById('v-quoted').value = '220000';
  sandbox.document.getElementById('modal-save-btn').click();
  const updated = state().currentVendors.find(v => v.id === added.id);
  assert(updated && updated.quoted === 220000, 'Vendor quote updated');

  // Delete vendor
  sandbox.SahaayApp.deleteVendor(added.id);
  sandbox.document.getElementById('modal-confirm-btn').click();
  assert(!state().currentVendors.find(v => v.id === added.id), 'Vendor deleted successfully');
});

// 7. Timeline: Add, Toggle Complete, Delete
test('7. Timeline - Add, Toggle Complete, Delete', () => {
  sandbox.SahaayApp.navigateTo('timeline');
  const initialCount = state().currentTimeline.length;

  sandbox.document.getElementById('tl-time').value = '11:30';
  sandbox.document.getElementById('tl-task').value = 'Groom Barat Arrival';
  sandbox.document.getElementById('tl-owner').value = 'Karan';
  sandbox.document.getElementById('tl-day').value = 'Day of event';
  sandbox.SahaayApp.addTimelineItem();

  assert(state().currentTimeline.length === initialCount + 1, 'Timeline count should increment');
  const added = state().currentTimeline.find(t => t.task === 'Groom Barat Arrival');
  assert(added && added.status !== 'completed', 'Timeline item added in pending state');

  // Toggle completion
  sandbox.SahaayApp.toggleTimelineItem(added.id);
  assert(added.status === 'completed', 'Timeline item marked completed');

  // Delete milestone
  sandbox.SahaayApp.deleteTimelineItem(added.id);
  sandbox.document.getElementById('modal-confirm-btn').click();
  assert(!state().currentTimeline.find(t => t.id === added.id), 'Timeline item removed');
});

// 8. Crisis Switch: Test ALL 8 scenarios
test('8. Crisis Switch - All 8 Scenarios Generate Valid Plans', () => {
  sandbox.SahaayApp.navigateTo('crisis');
  const scenarios = [
    'caterer_delayed',
    'vendor_cancelled',
    'heavy_rain',
    'power_failure',
    'extra_guests',
    'budget_reduced',
    'vip_late',
    'custom'
  ];

  scenarios.forEach(sc => {
    sandbox.SahaayApp.selectCrisis(sc);
    assert(state().selectedCrisisType === sc, `Crisis type should be selected: ${sc}`);
    if (sc === 'custom') {
      sandbox.document.getElementById('crisis-description').value = 'Sound system generator burnt';
    }
    sandbox.SahaayApp.generatePlan();
    const plan = state().rescuePlanData;
    assert(plan, `Rescue plan must be generated for ${sc}`);
    assert(plan.situation, `Plan should have situation for ${sc}`);
    assert(plan.first15 && plan.first15.length > 0, `Plan must have first15 actions for ${sc}`);
    assert(plan.assignments && plan.assignments.length > 0, `Plan must have assignments for ${sc}`);
    assert(plan.guestMessage, `Plan must have guest message for ${sc}`);
  });
});

// 9. Apply Rescue Plan
test('9. Apply Rescue Plan - Task Injection, Cost & Incident Logging', () => {
  sandbox.SahaayApp.selectCrisis('heavy_rain');
  sandbox.SahaayApp.generatePlan();
  const prevTasksCount = state().currentTasks.length;
  const prevIncidentsCount = state().currentIncidents.length;

  sandbox.SahaayApp.applyRescuePlan();

  assert(state().currentTasks.length > prevTasksCount, 'Emergency rescue tasks should be injected');
  const rescueTask = state().currentTasks.find(t => t.name.includes('[RESCUE]'));
  assert(rescueTask, 'Rescue task should have [RESCUE] tag');
  assert(state().currentIncidents.length === prevIncidentsCount + 1, 'Incident must be logged in history');
});

// 10. Message Studio: Generation, Language, Copy
test('10. Message Studio - Generate, Multilingual & Clipboard Copy', () => {
  sandbox.SahaayApp.navigateTo('messages');
  const msgTypes = ['invitation_reminder', 'delay_update', 'venue_change', 'thank_you', 'parking_info', 'dietary_check', 'dress_code'];
  
  msgTypes.forEach(type => {
    sandbox.SahaayApp.selectMessageType(type);
    sandbox.document.getElementById('msg-language').value = 'Hinglish';
    sandbox.document.getElementById('msg-tone').value = 'warm';
    sandbox.SahaayApp.doGenerateMessage();
    const out = sandbox.document.getElementById('message-output').value;
    assert(out && out.length > 10, `Message output should be generated for ${type}`);
  });

  // Test copy
  sandbox.SahaayApp.copyMessage();
  assert(copiedClipboardText.length > 10, 'Message copied to clipboard');
});

// 11. Export & Import JSON
test('11. Data Export & Import Integrity', () => {
  sandbox.SahaayApp.navigateTo('settings');
  
  const currentEvt = state().currentEvent;
  const exportPayload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    event: currentEvt,
    expenses: state().currentExpenses,
    tasks: state().currentTasks,
    vendors: state().currentVendors,
    timeline: state().currentTimeline,
    incidents: state().currentIncidents
  };

  const jsonStr = JSON.stringify(exportPayload);
  
  // Simulate import
  const mockFile = {
    content: jsonStr
  };

  sandbox.SahaayApp.importData(mockFile);
  sandbox.document.getElementById('modal-confirm-btn').click();
  
  const reloaded = JSON.parse(sandbox.localStorage.getItem('sahaay_event'));
  assert(reloaded && reloaded.id === currentEvt.id, 'Imported event matches exported event');
});

// 12. Reset All Data
test('12. Reset All Data', () => {
  sandbox.SahaayApp.resetAllData();
  sandbox.document.getElementById('modal-confirm-btn').click();

  assert(!sandbox.localStorage.getItem('sahaay_event'), 'Event should be cleared');
  assert(!sandbox.localStorage.getItem('sahaay_expenses'), 'Expenses should be cleared');
  assert(sandbox.document.getElementById('onboarding-screen').style.display === 'flex', 'Should return to onboarding screen');
});

// 13. Mobile Navigation & Responsive Sidebar
test('13. Mobile Navigation & Responsive Sidebar', () => {
  sandbox.SahaayApp.openMobileSidebar();
  assert(sandbox.document.getElementById('sidebar').classList.contains('mobile-open'), 'Sidebar open on mobile');
  assert(sandbox.document.getElementById('sidebar-overlay').classList.contains('visible'), 'Overlay visible');

  sandbox.SahaayApp.closeMobileSidebar();
  assert(!sandbox.document.getElementById('sidebar').classList.contains('mobile-open'), 'Sidebar closed on mobile');
  assert(!sandbox.document.getElementById('sidebar-overlay').classList.contains('visible'), 'Overlay hidden');

  // Verify navigation to every view
  const views = ['dashboard', 'budget', 'tasks', 'timeline', 'vendors', 'crisis', 'messages', 'settings'];
  views.forEach(v => {
    sandbox.SahaayApp.navigateTo(v);
    assert(state().currentView === v, `Current view must be ${v}`);
    const vEl = sandbox.document.getElementById('view-' + v);
    assert(vEl && vEl.classList.contains('active'), `view-${v} must have active class`);
  });
});

console.log('\n========================================');
const total = results.length;
const passed = results.filter(r => r.pass).length;
const failed = total - passed;
console.log(`QA SUMMARY: Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL QA SUITE TESTS PASSED WITH ZERO ERRORS!\n');
}
