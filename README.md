# Safe Device Settings Update

A clean, decoupled full-stack architecture implementing `apply_update(current, actor, request)` for learning devices, accompanied by a dedicated Node.js backend server and an interactive React + Vite frontend console.

---

## 1. Project Directory Structure

```text
TinkerBell Labs/
├── backend/
│   ├── .env                      # Local server configuration (PORT=5001)
│   ├── .env.example              # Environment variables template
│   ├── .gitignore                # Backend ignore rules
│   ├── package.json              # Backend scripts and metadata
│   ├── server.js                 # Standalone Node.js HTTP REST API
│   ├── src/
│   │   ├── applyUpdate.js        # Core PRD validation engine & business logic
│   │   └── example.js            # Standalone CLI demonstration runner
│   └── test/
│       └── applyUpdate.test.js   # 45 automated unit tests (node:test)
│
├── frontend/
│   ├── .env                      # Local frontend configuration (VITE_API_URL)
│   ├── .env.example              # Frontend environment template
│   ├── .gitignore                # Frontend ignore rules
│   ├── index.html                # Entry HTML document
│   ├── package.json              # React & Vite dependencies
│   ├── vite.config.js            # Vite configuration with /api proxy
│   └── src/
│       ├── App.jsx               # Interactive React settings console & simulator
│       ├── index.css             # Design system styling & modern theme
│       └── main.jsx              # React DOM mounting
│
├── .gitignore                    # Monorepo root ignore rules
├── package.json                  # Root orchestrator scripts
├── AI_INSTRUCTIONS.md            # Guidelines, constraints & review checklist
├── IMPLEMENTATION_PLAN.md        # Technical architecture & design plan
├── PRD.md                        # Product requirements document
├── PROGRESS_LOG.md               # Execution log and verification records
└── README.md                     # Documentation & setup guide
```

---

## 2. Quick Start & Execution

### Option A: From Root Workspace
```bash
# Run all 45 backend automated tests
npm test

# Run terminal demonstration
npm run demo

# Start backend server (starts on http://localhost:5001)
npm run backend

# Start React frontend (starts on http://localhost:5173 / 5174)
npm run frontend
```

### Option B: Running Separately

#### 1. Backend Server
```bash
cd backend
npm install
npm test        # Runs 45 table-driven automated tests
npm start       # Starts server on http://localhost:5001
```

#### 2. React Frontend
```bash
cd frontend
npm install
npm run dev     # Starts Vite dev server with proxy to backend
```

---

## 3. Environment Variables

### Backend (`backend/.env`):
```env
PORT=5001
NODE_ENV=development
```

### Frontend (`frontend/.env`):
```env
VITE_API_URL=http://localhost:5001
VITE_PORT=5173
```

---

## 4. REST API Contract

- `GET /api/state`: Retrieves the current saved persistent record and simulated actor.
- `POST /api/update`: Calls `apply_update(current, actor, request)`.
  - **Success (200)**: Updates server record and returns `{ status: 200, record }`.
  - **Forbidden (403)**: Returns `{ status: 403, error: "FORBIDDEN" }`.
  - **Invalid Input (422)**: Returns `{ status: 422, error: "INVALID_INPUT" }`.
  - **Not Found (404)**: Returns `{ status: 404, error: "NOT_FOUND" }`.
  - **Conflict (409)**: Returns `{ status: 409, error: "CONFLICT" }`.
- `POST /api/simulate-conflict`: Increments server version behind the client to trigger 409 conflict.
- `POST /api/reset`: Resets server state to canonical PRD baseline (`v3`, `volume: 2`, `language: "en"`).

---

## 5. UI Save-Flow Requirements (8 Bullets)

- **Accessible Form Controls**: Form fields use explicit labels, ARIA descriptive bindings (`aria-describedby`), and support full keyboard navigation (Tab, Shift+Tab, Arrow keys, Enter).
- **Visual "Unsaved Changes" Indicator**: Modified fields display an "Unsaved" badge by continuously diffing active state against the last confirmed server snapshot.
- **Pending & Disabled State During Save**: The "Save Settings" button is disabled and displays an accessible spinner (`aria-busy="true"`) to prevent duplicate submits.
- **Client-Side Inline Validation**: Bounds checks (volume `0..5`, supported language `"en"|"hi"|"kn"`) display real-time inline alerts before network transmission.
- **No Premature Optimistic Success**: Unsaved badges remain and form state is never treated as confirmed until the server returns an HTTP 200 response.
- **Graceful Concurrency Conflict Handling (409)**: Upon receiving `409 CONFLICT`, the UI halts without data loss and opens a conflict resolution modal with a side-by-side diff.
- **Conflict Resolution Choices**: The user is provided two distinct actions: "Discard Mine & Load Server State" or "Adopt New Version & Overwrite".
- **Actionable Error Feedback**: Status rejections (`403 FORBIDDEN`, `422 INVALID_INPUT`, `404 NOT_FOUND`) surface clear toast notifications and raw inspector details.
- **Local Storage Audit Persistence**: Every request attempt, timestamp, execution latency, sent request payload, and server response is saved in the browser's `localStorage` (`safe_device_settings_audit_history`), surviving browser refreshes, with expandable payload inspectors and a "Clear History" button.

---

## 6. Time Spent & Disclosures

- **Time Spent**: ~60 minutes total.
- **Unfinished Work**: None.
- **AI Tools Used**: Antigravity AI assistant for architecture scaffolding and unit tests.
- **Personal Verification**: Validated all 45 automated unit tests, strict PRD precedence order, boolean rejection rules, and full end-to-end local integration between React and Node.js.
