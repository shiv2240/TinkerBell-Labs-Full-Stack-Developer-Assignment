# Implementation Plan

## Chosen approach

Use plain JavaScript on Node.js with no external dependencies. Use ES modules or CommonJS consistently; the simplest route is CommonJS plus Node's built-in test runner. Keep the function isolated so it can be imported into tests and a small runnable example.

## Proposed file layout

```text
safe-device-settings-update/
├── package.json
├── src/
│   └── applyUpdate.js
├── test/
│   └── applyUpdate.test.js
├── README.md
├── PRD.md
├── AI_INSTRUCTIONS.md
├── IMPLEMENTATION_PLAN.md
└── PROGRESS_LOG.md
```

## Steps

1. **Set up the minimal project**
   - Create `package.json` with a test script using `node --test`.
   - Confirm the Node.js version supports the built-in test runner.

2. **Define the response contract**
   - Success: `{ status: 200, record: newRecord }`.
   - Failure: `{ status: <status>, error: <code> }`.
   - Keep error codes exactly as specified: `FORBIDDEN`, `INVALID_INPUT`, `NOT_FOUND`, `CONFLICT`.

3. **Implement permission check**
   - Check role and site match first.
   - Return `403 / FORBIDDEN` immediately on failure.

4. **Validate request structure**
   - Ensure the request is a non-null, non-array object.
   - Ensure the exact key set is `deviceId`, `expectedVersion`, and `settings`.
   - Require a non-empty string `deviceId`.
   - Require `expectedVersion` to be a positive integer and not a boolean.
   - Require `settings` to be a non-null, non-array object with at least one own key.

5. **Validate settings**
   - Reject keys other than `language` and `volume`.
   - Validate `language` against `en`, `hi`, `kn`.
   - Validate `volume` as an integer from 0 through 5, inclusive.
   - Ensure booleans are rejected as volume values.

6. **Check device identity and optimistic concurrency**
   - Compare requested device ID with the current record's ID.
   - Compare expected version with the current record's version.
   - Preserve the specified error precedence: not found before conflict.

7. **Return a new record**
   - Clone the current record and its nested settings.
   - Merge only the supplied settings.
   - Set version to `current.version + 1`.
   - Never write to any input object.

8. **Add tests**
   - Successful partial update preserves omitted language and does not mutate `current`.
   - Stale version returns conflict and all inputs remain unchanged.
   - Permission failures return forbidden.
   - Invalid request shape and invalid settings return invalid input.
   - Wrong device ID returns not found.
   - Test validation precedence where practical.

9. **Write README**
   - Include run/test commands, time spent, unfinished work, known limitation, design choices, AI disclosure, and up to eight UI save-flow bullets.

10. **Final verification**
    - Run the test command.
    - Review every required behavior against the PRD.
    - Ensure all examples use synthetic data.
    - Zip the submission and confirm the archive contains the intended files.

## Risks and mitigations

- **Validation-order drift:** keep checks in the same sequence as the specification and add precedence tests.
- **Accidental mutation:** use object spread to construct new objects and compare snapshots in tests.
- **JavaScript boolean/integer confusion:** use `Number.isInteger` and explicit range checks; booleans will fail `Number.isInteger`.
- **Unexpected payload fields:** compare the exact top-level key set and explicitly validate setting keys.
- **Overbuilding:** avoid adding a server, database, framework, or dependencies within the time box.
