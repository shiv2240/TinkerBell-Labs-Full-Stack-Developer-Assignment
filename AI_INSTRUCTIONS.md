# AI Instructions and Usage Notes

## Objective

Use AI as a coding assistant for the Safe Device Settings Update exercise while preserving the exact behavior and validation order in `PRD.md`.

## Implementation constraints

- Implement `apply_update(current, actor, request)` as a small, runnable module.
- Use JavaScript with Node.js built-in modules unless the candidate deliberately chooses another language.
- Keep the implementation dependency-free where practical.
- Use a predictable result shape: `{ status, record }` for success and `{ status, error }` for failure.
- Do not mutate any input objects on success or failure.
- Apply checks in the precise order specified in `PRD.md`.
- Treat booleans as invalid for integer fields; JavaScript's `typeof true === "boolean"` must not accidentally pass numeric validation.
- Reject unexpected top-level request keys and unknown settings keys.
- Keep scope limited to the exercise. Do not add a server, database, UI, or unrelated abstractions.

## Required validation order

1. Permission: role is `editor` and actor site matches current site; otherwise `403 / FORBIDDEN`.
2. Request structure: exactly three required top-level keys; valid device ID, positive integer expected version, non-empty settings object; otherwise `422 / INVALID_INPUT`.
3. Settings: only `language` and `volume`; allowed values only; otherwise `422 / INVALID_INPUT`.
4. Identity/version: wrong device ID gives `404 / NOT_FOUND`; stale version gives `409 / CONFLICT`.
5. Success: clone the record and settings, merge supplied settings, increment version once, and return `200`.

## Testing expectations

- Use Node's built-in `node:test` and `node:assert/strict`, or an equivalent standard test runner if another language is selected.
- Include at least one success test for a partial update.
- Include at least one rejection test that deep-compares all inputs before and after the call.
- Prefer additional table-driven tests for authorization, malformed structure, invalid values, unknown keys, not found, and conflict.
- Verify the original saved settings and version remain unchanged on success.
- Verify the response does not expose or reuse a mutated input object.

## Documentation expectations

The README must include:
- One command to run the module/example.
- One command to run tests.
- Time spent.
- Unfinished work.
- One known limitation.
- Design choices.
- AI tools and outside code used, plus what the candidate verified personally.
- No more than eight bullets describing the UI save flow.

## Review checklist

Before submission:
- Compare the implementation against every requirement in `PRD.md`.
- Run all tests.
- Check validation precedence when multiple fields are invalid.
- Confirm unknown top-level keys are rejected.
- Confirm boolean values fail integer validation.
- Confirm partial updates preserve omitted settings.
- Confirm no mutation occurs for success and every failure path.
- Avoid claiming tests were run unless they were actually run.
- Record actual time spent and any unfinished work accurately.

## Integrity note

AI assistance is permitted by the exercise. Disclose its use briefly and honestly. Do not submit private chat history. The candidate should understand the implementation and be prepared to explain the expected behavior before running a change in the live review.
