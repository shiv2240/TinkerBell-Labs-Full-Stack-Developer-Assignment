# Safe Device Settings Update

An implementation of `apply_update(current, actor, request)` for learning devices adhering to strict validation ordering, optimistic concurrency control, and zero in-place mutations.

**Repository URL**: [https://github.com/shiv2240/TinkerBell-Labs-Full-Stack-Developer-Assignment.git](https://github.com/shiv2240/TinkerBell-Labs-Full-Stack-Developer-Assignment.git)

> **Scope & Primary Deliverable Note**:
> * **Core Assessment (Primary Deliverable)**: The pure function [`apply_update(current, actor, request)`](backend/src/applyUpdate.js) and its table-driven automated test suite [`applyUpdate.test.js`](backend/test/applyUpdate.test.js). It is completely standalone, has zero external production dependencies, and strictly satisfies the 60-minute task handout.
> * **Supplementary Full-Stack Harness**: The backend REST server (`backend/server.js`) and React dashboard (`frontend/`) serve as an optional, secondary visual evaluation harness to demonstrate full-stack integration and interactive scenario verification.

---

## 1. Core Module Evaluation (Primary Scope)

To evaluate the core assignment without launching any servers or UI:

```bash
# 1. Run all 47 table-driven automated unit tests (using Node.js built-in test runner)
node --test backend/test/applyUpdate.test.js

# 2. Run standalone terminal demonstration
node backend/src/example.js

# 3. Optional: Run genuine c8 code coverage analysis (100% statement/branch/line coverage)
npm run test:coverage --prefix backend
```

---

## 2. Project Directory Structure

```text
TinkerBell Labs/
├── backend/
│   ├── .env                      # Local server configuration (PORT=5001)
│   ├── .env.example              # Environment variables template
│   ├── .gitignore                # Backend ignore rules
│   ├── package.json              # Backend scripts and metadata
│   ├── server.js                 # Supplementary Node.js HTTP REST API
│   ├── src/
│   │   ├── applyUpdate.js        # [CORE DELIVERABLE] Pure validation engine & business logic
│   │   └── example.js            # Standalone CLI demonstration runner
│   └── test/
│       └── applyUpdate.test.js   # [CORE DELIVERABLE] 47 automated unit tests (node:test)
│
├── frontend/
│   ├── .env                      # Local frontend configuration (VITE_API_URL)
│   ├── .env.example              # Frontend environment template
│   ├── .gitignore                # Frontend ignore rules
│   ├── index.html                # Entry HTML document
│   ├── package.json              # React & Vite dependencies
│   ├── vite.config.js            # Vite configuration with @tailwindcss/vite
│   └── src/
│       ├── App.jsx               # Supplementary React settings console & validation panel
│       ├── index.css             # Tailwind CSS v4 design system
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

## 3. Quick Start & Execution Commands

### Option A: From Root Workspace
```bash
# Run all 47 backend automated unit tests
npm test

# Run automated tests with genuine c8 code coverage
npm run test:coverage

# Run terminal demonstration
npm run demo

# Start supplementary backend server (runs on http://localhost:5001)
npm run backend

# Start supplementary React frontend (runs on http://localhost:5173 or 5174)
npm run frontend
```

### Option B: Running Separately

#### 1. Backend Server
```bash
cd backend
npm install
npm test              # Runs 47 table-driven automated tests
npm run test:coverage # Runs c8 code coverage analysis
npm start             # Starts server on http://localhost:5001
```

#### 2. React Frontend
```bash
cd frontend
npm install
npm run build         # Production build verification (Vite)
npm run dev           # Starts Vite dev server with proxy to backend
```

---

## 4. Real API Validation Dashboard

The supplementary UI includes a compact **Validation Scenarios** dashboard on the right panel. Reviewers can click **"Run All Scenarios"** (or trigger individual scenarios via **"Run"**) to execute live HTTP requests against the backend without mocking.

### Executable Scenarios:
1. **Valid Partial Settings Update** (`HTTP 200`): Submits partial volume change for an authorized editor. Server increments version and preserves existing language.
2. **Unauthorized Actor** (`HTTP 403`): Submits request with viewer role and site mismatch (`S99`). Rejection occurs in Step 1 of validation hierarchy.
3. **Malformed Request Structure** (`HTTP 422`): Submits extra top-level field and illegal setting keys. Rejection occurs in Steps 2 & 3.
4. **Non-Existent Device ID** (`HTTP 404`): Submits request targeting `D_NON_EXISTENT_99`. Identity check rejects before concurrency checks.
5. **Stale Expected Version** (`HTTP 409`): Genuinely submits an outdated version (`current.version - 1`). Optimistic concurrency rejects update to prevent lost writes.
6. **Invalid Volume** (`HTTP 422`): Submits fractional float (`2.5`) or boolean (`true`). Rejection occurs via integer and range constraints.
7. **Input Immutability Guarantee** (`CLI Unit Test - Offline Reference`): Network HTTP boundaries serialize JSON copies into separate memory objects. In-memory object immutability is proven via `Object.freeze` and deep comparison in the automated test suite (`backend/test/applyUpdate.test.js`).

Each live scenario displays expected status, actual status, pass/fail state, and an **"Inspect"** toggle showing the sent payload, server response, latency, and explanation. Application state is protected using isolated synthetic test fixtures (`dryRun: true`).

---

## 5. REST API Contract

- `GET /api/state`: Retrieves current in-memory record and active actor.
- `POST /api/update`: Calls `apply_update(current, actor, request)`.
  - **Success (200)**: Updates in-memory record and returns `{ status: 200, record }`.
  - **Forbidden (403)**: Returns `{ status: 403, error: "FORBIDDEN" }`.
  - **Invalid Input (422)**: Returns `{ status: 422, error: "INVALID_INPUT" }`.
  - **Not Found (404)**: Returns `{ status: 404, error: "NOT_FOUND" }`.
  - **Conflict (409)**: Returns `{ status: 409, error: "CONFLICT" }`.
  - Supports `dryRun: true` and `fixture` parameters to run non-destructive validation checks.
- `POST /api/simulate-conflict`: Increments server version behind client to trigger 409 conflict.
- `POST /api/reset`: Resets in-memory state to canonical PRD baseline (`v3`, `volume: 2`, `language: "en"`).

---

## 6. UI Save-Flow Requirements (8 Bullets)

1. **Accessible Form Controls**: Form fields use explicit labels, ARIA descriptive bindings (`aria-describedby`), and support full keyboard navigation (Tab, Arrow keys, Enter).
2. **Visual "Unsaved Changes" Indicator**: Modified fields display an amber "Unsaved" badge by continuously diffing active form state against the last confirmed server snapshot.
3. **Pending & Disabled State During Save**: The "Save Settings" button disables and displays an accessible spinner (`aria-busy="true"`) to prevent duplicate submits.
4. **Client-Side Inline Validation**: Strict bounds checks (volume `0..5` via `Number.isInteger`, language `"en"|"hi"|"kn"`) display real-time inline alerts before network transmission.
5. **Zero Premature Optimistic Success**: Unsaved badges remain and form state is never treated as confirmed until the server returns an HTTP 200 response with the updated record.
6. **Graceful Concurrency Conflict Handling (409)**: Upon receiving `409 CONFLICT`, the UI halts without data loss and opens a conflict resolution modal with a side-by-side diff table.
7. **Conflict Resolution Choices**: The user is provided two distinct actions: "Discard Mine & Load Server State" or "Adopt New Version & Overwrite".
8. **Comprehensive Audit Persistence & Feedback**: Rejection statuses trigger clear toasts; all requests, latencies, payloads, and responses are saved to browser `localStorage` with date filtering and pagination.

---

## 7. Known Limitations

- **In-Memory Ephemeral Storage**: In strict accordance with the 60-minute assessment scope, the backend stores state in memory (`serverState`) rather than a persistent external database. State resets upon server restart or via `POST /api/reset`.
- **Single-Device Focus**: The backend model is configured around the primary learning device (`D01` on site `S01`). Supporting a fleet of devices would require routing by device ID in a persistent store.

---

## 8. Actual Verification Results & Disclosures

- **Automated Unit Tests**: 47 table-driven tests passed in `185ms` (`npm test`).
- **Code Coverage**: Generated with `c8` (`npm run test:coverage`), achieving **100% Statements, 100% Branches, 100% Functions, and 100% Lines** coverage on `applyUpdate.js`.
- **Frontend Production Build**: `npm run build` compiled cleanly via Vite in `1.45s` (`dist/index.html`, `dist/assets/`).
- **Design Choices**: Decoupled architecture; pure dependency-free Node.js backend; modern Tailwind CSS v4 reactive UI; non-color-reliant status badges for accessibility.
- **Time Spent**: ~60 minutes core preparation and implementation.
- **Unfinished Work**: None.
- **AI & Outside Code Disclosure**: Antigravity AI pair programming assistant utilized for boilerplate generation and test suite authoring. All validation hierarchy, concurrency mechanics, and styling verified by author.
