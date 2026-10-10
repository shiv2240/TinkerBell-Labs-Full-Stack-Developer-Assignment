# Product Requirements Document: Safe Device Settings Update

## 1. Purpose

Implement a small, runnable module that safely applies partial settings updates to a saved learning-device record. The module must enforce authorization, validate untrusted request data, detect stale edits, and avoid mutating any input object.

This is a simulated exercise using synthetic data. Server, database, and UI setup are out of scope.

## 2. Scope

### In scope
- Implement `apply_update(current, actor, request)`.
- Return an HTTP-style status and either an updated record or an error code.
- Apply validation checks in the exact order defined below.
- Merge only the settings supplied in the request.
- Increment the record version exactly once on success.
- Preserve `current`, `actor`, and `request` on both success and failure.
- Add automated tests, including a successful partial update and a rejected update that proves input state is unchanged.
- Document a UI save flow in at most eight README bullets.
- Provide a README with run/test commands, time spent, unfinished work, one known limitation, design choices, and AI/outside-code disclosure.

### Out of scope
- HTTP server, database, authentication implementation, UI implementation, deployment, and production persistence.
- Real device data or personal information.

## 3. Inputs

`current` is a valid saved record and is trusted:
```json
{
  "deviceId": "D01",
  "siteId": "S01",
  "version": 3,
  "settings": {
    "language": "en",
    "volume": 2
  }
}
```

`actor` is a trusted, server-authenticated identity:
```json
{
  "siteId": "S01",
  "role": "editor"
}
```

`request` is untrusted parsed JSON and represents a partial settings update:
```json
{
  "deviceId": "D01",
  "expectedVersion": 3,
  "settings": {
    "volume": 4
  }
}
```

## 4. Functional requirements

Evaluate checks in this exact order:

1. **Permission**
   - `actor.role` must equal `"editor"`.
   - `actor.siteId` must equal `current.siteId`.
   - Otherwise return `403 / FORBIDDEN`.

2. **Request structure**
   - Request must contain exactly `deviceId`, `expectedVersion`, and `settings`; no missing or extra top-level keys.
   - `deviceId` must be a non-empty string.
   - `expectedVersion` must be a positive integer and must not be a boolean.
   - `settings` must be a non-empty object.
   - Otherwise return `422 / INVALID_INPUT`.

3. **Settings validation**
   - Only `language` and `volume` are allowed.
   - `language` must be one of `"en"`, `"hi"`, or `"kn"`.
   - `volume` must be an integer from `0` through `5`, inclusive, and must not be a boolean.
   - Unknown keys or invalid values return `422 / INVALID_INPUT`.

4. **Identity and version**
   - If `request.deviceId` differs from `current.deviceId`, return `404 / NOT_FOUND`.
   - If `request.expectedVersion` differs from `current.version`, return `409 / CONFLICT`.

5. **Success**
   - Return `200` and a new record.
   - Merge only supplied settings into the saved settings.
   - Increment `version` once.
   - Do not mutate any input object.

## 5. Acceptance criteria

- The supplied sample returns status `200`, version `4`, and settings `{ "language": "en", "volume": 4 }`.
- The original saved record remains at version `3` with volume `2`.
- A request with `expectedVersion: 2` returns `409 / CONFLICT` and does not mutate inputs.
- An actor with role `"viewer"` returns `403 / FORBIDDEN`.
- Cross-site actors receive `403 / FORBIDDEN`.
- Missing or extra request keys receive `422 / INVALID_INPUT`.
- Empty settings, unknown setting keys, invalid language values, and invalid volume values receive `422 / INVALID_INPUT`.
- Booleans are rejected where integers are required.
- A wrong device ID returns `404 / NOT_FOUND` after permission and validation checks pass.
- A successful partial update preserves every setting not supplied by the request.
- Tests verify no input mutation for both successful and rejected calls.

## 6. Response shape

Use a consistent, small result structure, for example:

Success:
```json
{
  "status": 200,
  "record": {
    "deviceId": "D01",
    "siteId": "S01",
    "version": 4,
    "settings": {
      "language": "en",
      "volume": 4
    }
  }
}
```

Failure:
```json
{
  "status": 409,
  "error": "CONFLICT"
}
```

The implementation may use equivalent field names only if they remain consistent and are clearly documented.

## 7. UI save-flow requirements for README

In no more than eight bullets, describe:
- Accessible labels and keyboard operation.
- Pending/disabled state during save.
- Inline validation errors.
- Conflict recovery by refreshing or comparing the latest saved version.
- How the UI distinguishes an edited/unsaved value from a successfully saved value.
- Avoiding a false success state before the server confirms the update.

## 8. Constraints and assumptions

- Use synthetic data only.
- The function receives `current` as a valid saved record and `actor` as trusted identity, as specified by the exercise.
- Request JSON is untrusted and must be validated.
- Do not mutate `current`, `actor`, or `request`.
- The assessment is a time-boxed exercise. Record time spent and unfinished work honestly.
