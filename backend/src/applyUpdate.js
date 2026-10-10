/**
 * Safe Device Settings Update
 *
 * Safely applies partial settings updates to a saved learning-device record
 * while enforcing permissions, validating untrusted payload data, maintaining
 * optimistic concurrency control, and strictly preventing in-place mutations.
 */

const ALLOWED_LANGUAGES = new Set(["en", "hi", "kn"]);

/**
 * Applies a partial settings update to a saved device record.
 *
 * @param {Object} current - Trusted saved record from persistent storage.
 * @param {Object} actor - Trusted authenticated actor performing the action.
 * @param {Object} request - Untrusted incoming update payload.
 * @returns {{ status: number, record?: Object, error?: string }}
 */
function apply_update(current, actor, request) {
  // 1. Permission Check
  // - actor.role must equal "editor"
  // - actor.siteId must equal current.siteId
  if (
    !actor ||
    !current ||
    actor.role !== "editor" ||
    actor.siteId !== current.siteId
  ) {
    return { status: 403, error: "FORBIDDEN" };
  }

  // 2. Request Structure Validation
  // - Request must be a plain, non-null, non-array object
  if (
    typeof request !== "object" ||
    request === null ||
    Array.isArray(request)
  ) {
    return { status: 422, error: "INVALID_INPUT" };
  }

  // - Request must contain exactly deviceId, expectedVersion, settings (no extra or missing keys)
  const topKeys = Object.keys(request);
  if (
    topKeys.length !== 3 ||
    !topKeys.includes("deviceId") ||
    !topKeys.includes("expectedVersion") ||
    !topKeys.includes("settings")
  ) {
    return { status: 422, error: "INVALID_INPUT" };
  }

  // - deviceId must be a non-empty string
  if (typeof request.deviceId !== "string" || request.deviceId.trim().length === 0) {
    return { status: 422, error: "INVALID_INPUT" };
  }

  // - expectedVersion must be a positive integer and must not be a boolean
  if (
    typeof request.expectedVersion !== "number" ||
    !Number.isInteger(request.expectedVersion) ||
    request.expectedVersion <= 0
  ) {
    return { status: 422, error: "INVALID_INPUT" };
  }

  // - settings must be a non-empty object (non-null, non-array, at least 1 key)
  if (
    typeof request.settings !== "object" ||
    request.settings === null ||
    Array.isArray(request.settings) ||
    Object.keys(request.settings).length === 0
  ) {
    return { status: 422, error: "INVALID_INPUT" };
  }

  // 3. Settings Validation
  // - Only "language" and "volume" are allowed
  const settingKeys = Object.keys(request.settings);
  for (const key of settingKeys) {
    if (key !== "language" && key !== "volume") {
      return { status: 422, error: "INVALID_INPUT" };
    }
  }

  // - language validation (if present)
  if (Object.prototype.hasOwnProperty.call(request.settings, "language")) {
    if (
      typeof request.settings.language !== "string" ||
      !ALLOWED_LANGUAGES.has(request.settings.language)
    ) {
      return { status: 422, error: "INVALID_INPUT" };
    }
  }

  // - volume validation (if present): integer between 0 and 5 inclusive, cannot be boolean
  if (Object.prototype.hasOwnProperty.call(request.settings, "volume")) {
    if (
      typeof request.settings.volume !== "number" ||
      !Number.isInteger(request.settings.volume) ||
      request.settings.volume < 0 ||
      request.settings.volume > 5
    ) {
      return { status: 422, error: "INVALID_INPUT" };
    }
  }

  // 4. Identity and Concurrency Check
  // - If request.deviceId differs from current.deviceId -> 404 / NOT_FOUND
  if (request.deviceId !== current.deviceId) {
    return { status: 404, error: "NOT_FOUND" };
  }

  // - If request.expectedVersion differs from current.version -> 409 / CONFLICT
  if (request.expectedVersion !== current.version) {
    return { status: 409, error: "CONFLICT" };
  }

  // 5. Success
  // - Return 200 with new record
  // - Merge only supplied settings into current settings
  // - Increment version once
  // - Do not mutate any input object
  const newRecord = {
    deviceId: current.deviceId,
    siteId: current.siteId,
    version: current.version + 1,
    settings: {
      ...current.settings,
      ...request.settings,
    },
  };

  return {
    status: 200,
    record: newRecord,
  };
}

module.exports = {
  apply_update,
  applyUpdate: apply_update,
};
