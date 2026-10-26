# Sahaay — Plan the Celebration. Control the Chaos.

> AI-powered celebration operations assistant for Indian weddings, birthdays, festivals, and community events.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![No Build Required](https://img.shields.io/badge/Build-None%20Required-blue.svg)]()
[![Works Offline](https://img.shields.io/badge/Offline-Ready-orange.svg)]()
[![Accessibility](https://img.shields.io/badge/WCAG-2.1%20AA-purple.svg)]()

---

## 1. Chosen Vertical

**Vertical: Event Management & Celebration Operations**

Sahaay targets the **Indian celebration management** segment — a high-frequency, high-stakes context where event organisers (families, community committees, professional coordinators) must manage:

- **Multi-vendor coordination** across caterers, decorators, photographers, transport, and venue
- **Budget control** with real-money commitments in rupees, tracking paid vs promised vs pending
- **Responsibility delegation** across 5–20 volunteers or family members
- **Crisis management** when something goes wrong on the day of the event

This vertical was chosen because Indian celebrations are uniquely complex: they involve large guest counts (100–500+), multi-day preparations, shared family responsibility, and no tolerance for failure. Existing tools (WhatsApp groups, Excel sheets) create chaos rather than calm. Sahaay fills this gap.

---

## 2. Approach and Logic

### Design Philosophy

Sahaay is built around four operational questions every event organiser faces:

1. **What changed?** — Change log, timeline tracker, incident log
2. **What will it cost?** — Live budget calculations with "What if?" simulation
3. **Who needs to act?** — Responsibility board with owners, backup contacts, deadlines
4. **What should we do next?** — The Crisis Switch generates step-by-step rescue plans

### Architecture Decision: No-Server, No-Build

The application is a **zero-dependency, single-page vanilla JavaScript app**. This choice was deliberate:

- **Works without internet** after first load (Google Fonts is the only CDN dependency, with fallbacks)
- **No setup friction** for non-technical users — just open `index.html`
- **Deployable to GitHub Pages** with zero configuration
- **No server costs** — localStorage keeps data in the browser
- **Portable** — export/import as JSON to share or back up

### AI Approach: Demo Mode First, Real AI Optional

Sahaay uses a **layered AI architecture**:

```
User Request → Try AI (if endpoint configured) → Fall back to deterministic logic
```

The fallback layer is comprehensive and works entirely offline:

| Feature | Demo Mode Logic |
|---|---|
| Crisis rescue plans | 8 deterministic, detailed plans in `data.js` |
| Message templates | Language-aware templates (English / Hindi / Hinglish) |
| Task extraction | NLP pattern matching — names + action verbs + time expressions |
| Budget suggestions | Event-type–calibrated category percentages |
| What-if simulation | Real-time arithmetic with per-guest cost factors |

A real Gemini AI endpoint can be connected to `callAI()` in `app.js` for richer responses, while always falling back to demo mode on failure.

### Module Separation

| Module | Responsibility |
|---|---|
| `data.js` | Data layer: storage, seed data, calculations, AI fallback logic |
| `app.js` | UI controller: rendering, CRUD operations, navigation, modals |
| `index.html` | Structure: semantic HTML, ARIA roles, accessible landmarks |
| `styles.css` | Design system: CSS variables, components, responsive layout |

---

## 3. How the Solution Works

### Core Features

#### 3.1 Event Setup (Onboarding)
Users fill in a form specifying: event name, type (Wedding / Birthday / Festival / Community), date, city, guest count, total budget, food preference, preferred language, accessibility requirements, and number of volunteers. Sahaay then auto-generates a starter set of expenses, tasks, vendors, and a timeline appropriate to the event type.

#### 3.2 Budget Command Center
- **Expense tracking** with categories: Venue, Catering, Decoration, Photography, Transport, Invitations, Guest support, Emergency, Other
- **Status tracking**: paid / promised / pending / optional — mapped to financial commitment levels
- **Visual budget bar** — real-time segmented bar showing committed vs pending vs remaining
- **Category summary** — proportional bar chart per category
- **"What if?" Calculator** — simulates adding extra guests, unexpected expenses, or budget cuts; shows impact and suggests cuts if over budget

#### 3.3 Responsibility Board
- **Task cards** with owner, backup, deadline, priority (urgent / high / normal), category, notes
- **One-click completion** with visual state changes
- **Filter bar** — All / Urgent / Pending / Completed
- **Task extraction from text** — paste a WhatsApp message; Sahaay extracts names, actions, and deadlines using JavaScript NLP

#### 3.4 Timeline & Countdown
- Phase-based timeline (30 days before → Event day → After event)
- Live countdown timer (days : hours : minutes : seconds) to the event
- Phase progress tracking with check marks

#### 3.5 Vendor Checklist
- Vendor cards with: name, category, contact, quoted amount, advance paid, confirmed status, backup vendor
- One-click contact copy to clipboard
- Confirmation toggle with visual indicator

#### 3.6 Crisis Switch ⚡
The Crisis Switch is Sahaay's signature feature. In 3 steps:
1. Select a crisis type (Caterer Delayed, Power Failure, Key Person Absent, Rain/Weather, Vendor No-show, Budget Shortfall, Medical Emergency, Crowd Management)
2. Describe what happened (optional detail)
3. Select urgency

Sahaay generates a **step-by-step rescue plan** including:
- Immediate actions (0–30 minutes)
- Short-term actions (30 minutes – 3 hours)
- Contingency contacts and vendor alternatives
- A guest communication message
- Auto-added rescue tasks and emergency expenses

#### 3.7 Message Studio
Generates contextually appropriate messages for 7 types:
- Guest arrival notice, Delay notice, Vendor briefing, Volunteer instructions, Thank you message, Reschedule notice, Emergency alert

Messages adapt to language preference (English / Hindi / Hinglish) and tone (warm / formal / direct).

#### 3.8 Data Management
- **Export** — Downloads all data as a JSON file
- **Import** — Restores from a JSON export
- **Demo mode** — Pre-loaded realistic data for Asha & Rohan's community wedding

---

## 4. Assumptions Made

1. **Single-organiser, single-device workflow** — Sahaay is designed for one lead organiser. Multi-user collaboration requires a backend, which is out of scope for this version.

2. **Indian context** — Currency is Indian Rupee (₹). Guest counts, budget ranges, and vendor categories are calibrated for Indian events (100–500 guests, ₹50,000–₹5,00,000 budget).

3. **No server required** — localStorage is sufficient for the MVP. Users are instructed to export data before clearing the browser.

4. **API keys belong server-side** — The `callAI()` function is intentionally a stub. Embedding a Gemini API key in client-side JavaScript would expose it to anyone who opens DevTools. The README documents how to connect a secure backend.

5. **Browser Clipboard API is available** — Copy-to-clipboard features use `navigator.clipboard.writeText()`, available in all modern browsers over HTTPS or localhost.

6. **Event date is always in the future** — The onboarding form enforces a future date. The countdown timer handles the edge case where the event has passed (shows "Concluded").

7. **Font CDN may be unavailable offline** — Google Fonts (`DM Sans`, `Playfair Display`) are loaded via CDN. CSS fallbacks (`system-ui`, `sans-serif`) are defined so the app remains usable without internet.

8. **Demo mode is the default** — Without an AI backend endpoint, all AI features use deterministic fallback logic. This is a feature, not a limitation — it makes the app reliable and offline-capable.

---

## 5. How to Run

### Option 1 — Open Directly (Simplest)

```
double-click index.html
```

No installation, no build step, no server.

### Option 2 — Local Static Server

```bash
# Python 3
python -m http.server 8080

# Node.js
npx -y serve .

# Then open http://localhost:8080
```

### Option 3 — VS Code Live Server

Install the **Live Server** extension → right-click `index.html` → **Open with Live Server**.

---

## 6. File Structure

```
sahaay/
├── index.html          # Application shell — semantic HTML, ARIA roles
├── styles.css          # Design system — CSS vars, components, responsive layout
├── app.js              # Application controller — navigation, CRUD, crisis, messages
├── data.js             # Data layer — localStorage, seed data, AI fallback, calculations
├── qa_test_suite.js    # Node.js QA test runner — end-to-end tests with mock DOM
├── test_qa_static.js   # Static analysis tests — security checks, HTML validation
├── README.md           # This file
└── .gitignore          # Standard Git ignores
```

---

## 7. Running Tests

```bash
# Full QA test suite (requires Node.js 18+)
node qa_test_suite.js

# Static analysis tests
node test_qa_static.js
```

Tests cover:
- Onboarding form validation (empty, invalid, boundary values)
- Demo event loading
- CRUD operations: add / edit / delete expenses, tasks, vendors, timeline items
- Budget calculations and what-if simulation
- Crisis plan generation
- Message generation
- Export / import data round-trip
- Accessibility attributes
- Security: XSS prevention, no API key exposure
- Navigation and state management

---

## 8. Deployment

### GitHub Pages (Free, Recommended)

1. Push all files to a public GitHub repository.
2. Go to **Settings → Pages**.
3. Set source to `main` branch, root `/`.
4. Your site is live at `https://yourusername.github.io/yourrepo/`.

No build step needed.

### Netlify

1. Drag and drop the project folder to [Netlify Drop](https://app.netlify.com/drop).
2. Or connect your GitHub repo and set publish directory to `/`.

---

## 9. Connecting an Optional AI Backend (Gemini)

> **Never put an API key directly in client-side JavaScript.** Keys in browser code are visible to anyone who opens DevTools.

### Step 1 — Create a secure backend endpoint

```js
// Example: /api/ai (Vercel / Netlify Function / Firebase Function)
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  const { prompt } = req.body;
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // env var only
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  const result = await model.generateContent(prompt);
  res.json({ text: result.response.text() });
}
```

### Step 2 — Connect `callAI()` in `app.js`

```js
async function callAI(prompt) {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) throw new Error('AI endpoint error');
  const data = await response.json();
  return data.text;
}
```

If the AI call fails for any reason, the app automatically falls back to demo mode. The user sees: **"AI service unavailable. Sahaay switched to reliable demo mode."**

---

## 10. APIs Used

| API | Purpose | Required? |
|---|---|---|
| Google Gemini API | Richer crisis plans, message generation | ❌ Optional |
| Google Fonts CDN | Typography (DM Sans, Playfair Display) | ❌ Optional (CSS fallbacks included) |
| Browser Clipboard API | Copy buttons | ✅ Browser built-in |
| localStorage | All data persistence | ✅ Browser built-in |

---

## 11. Data Storage

All data is stored in `localStorage` under these keys:

| Key | Contents |
|---|---|
| `sahaay_event` | Event details (name, date, budget, etc.) |
| `sahaay_expenses` | All expense records |
| `sahaay_tasks` | All responsibility/task records |
| `sahaay_vendors` | All vendor records |
| `sahaay_timeline` | All timeline items |
| `sahaay_incidents` | Crisis incident log |
| `sahaay_settings` | User preferences |

Use **Settings → Export Event Data** to save a JSON backup.

---

## 12. Known Limitations

- **No server-side storage** — data is stored in the browser. Clearing browser data or using incognito mode will lose data. Use Export before clearing.
- **No multi-user sync** — Sahaay is designed for one organiser or device. Use Export / Import to share data.
- **No real-time collaboration** — for shared editing, a backend with WebSockets is required.
- **No actual SMS/email sending** — Message Studio generates copy-ready messages for manual sending via WhatsApp, email, etc.
- **Gemini integration** — requires a separate backend (see Section 9). Direct browser key usage is intentionally unsupported.

---

## 13. Brand & Design

Sahaay uses a modern Indian celebration palette:

| Token | Colour | Use |
|---|---|---|
| Deep Maroon | `#641C32` | Primary navigation, brand identity |
| Saffron Orange | `#E88932` | Primary actions, CTAs |
| Warm Gold | `#D6A84F` | Highlights, accents |
| Cream | `#FFF8EE` | Page background |
| Emerald | `#2E7D68` | Success, completion states |

Typography: **Playfair Display** for headings, **DM Sans** for body text.

---

## 14. Accessibility

Sahaay is built with accessibility as a core design constraint, not an afterthought:

- **Skip to content** link at the top of every page
- **ARIA roles and labels** on all interactive elements, landmarks, and live regions
- **Keyboard navigation** — full keyboard accessibility with visible focus styles
- **`prefers-reduced-motion`** — all animations are disabled for users who prefer reduced motion
- **Colour contrast** — all text meets WCAG 2.1 AA contrast ratios
- **Screen reader support** — `aria-live` regions for toast notifications, rescue plans, and stat cards
- **Semantic HTML** — `<nav>`, `<main>`, `<header>`, `<section>`, `<article>` used throughout

---

## 15. Security

- **No API keys in client code** — `callAI()` is a stub; real keys go server-side via environment variables
- **XSS prevention** — all user-provided strings are HTML-escaped via the `esc()` function before rendering
- **No `eval()` or `innerHTML` with unsanitised content** — all dynamic HTML uses escaped values
- **Content Security Policy** — meta tag restricts script execution to same-origin only
- **No third-party tracking or analytics** — no external data collection
- **localStorage only** — no cookies, no cross-origin requests

---

*Sahaay — because celebrations deserve calm, not chaos.*
