const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { apply_update } = require("../src/applyUpdate");

// Helper function to create standard fixtures
function getFixtures() {
  const current = {
    deviceId: "D01",
    siteId: "S01",
    version: 3,
    settings: {
      language: "en",
      volume: 2,
    },
  };

  const actor = {
    siteId: "S01",
    role: "editor",
  };

  const request = {
    deviceId: "D01",
    expectedVersion: 3,
    settings: {
      volume: 4,
    },
  };

  return { current, actor, request };
}

describe("Safe Device Settings Update - apply_update", () => {
  describe("1. Success Cases & Partial Updates", () => {
    test("successfully updates single setting (volume), increments version, and preserves other settings", () => {
      const { current, actor, request } = getFixtures();
      const currentSnapshot = JSON.parse(JSON.stringify(current));
      const actorSnapshot = JSON.parse(JSON.stringify(actor));
      const requestSnapshot = JSON.parse(JSON.stringify(request));

      const result = apply_update(current, actor, request);

      assert.deepEqual(result, {
        status: 200,
        record: {
          deviceId: "D01",
          siteId: "S01",
          version: 4,
          settings: {
            language: "en",
            volume: 4,
          },
        },
      });

      // Assert inputs were not mutated
      assert.deepEqual(current, currentSnapshot);
      assert.deepEqual(actor, actorSnapshot);
      assert.deepEqual(request, requestSnapshot);
    });

    test("successfully updates language, preserving volume", () => {
      const { current, actor } = getFixtures();
      const request = {
        deviceId: "D01",
        expectedVersion: 3,
        settings: {
          language: "hi",
        },
      };

      const result = apply_update(current, actor, request);
      assert.equal(result.status, 200);
      assert.equal(result.record.version, 4);
      assert.deepEqual(result.record.settings, {
        language: "hi",
        volume: 2,
      });
    });

    test("successfully updates both settings at once", () => {
      const { current, actor } = getFixtures();
      const request = {
        deviceId: "D01",
        expectedVersion: 3,
        settings: {
          language: "kn",
          volume: 0,
        },
      };

      const result = apply_update(current, actor, request);
      assert.equal(result.status, 200);
      assert.equal(result.record.version, 4);
      assert.deepEqual(result.record.settings, {
        language: "kn",
        volume: 0,
      });
    });

    test("returned record is a detached object (modifications do not affect input current)", () => {
      const { current, actor, request } = getFixtures();
      const result = apply_update(current, actor, request);

      assert.equal(result.status, 200);
      // Mutate returned record and its settings
      result.record.version = 999;
      result.record.settings.volume = 99;

      // Ensure input current remains intact
      assert.equal(current.version, 3);
      assert.equal(current.settings.volume, 2);
    });
  });

  describe("2. Step 1: Authorization & Permission Checks", () => {
    test("rejects when actor role is not editor (viewer)", () => {
      const { current, request } = getFixtures();
      const actor = { siteId: "S01", role: "viewer" };
      const result = apply_update(current, actor, request);
      assert.deepEqual(result, { status: 403, error: "FORBIDDEN" });
    });

    test("rejects when actor siteId does not match current siteId", () => {
      const { current, request } = getFixtures();
      const actor = { siteId: "S02", role: "editor" };
      const result = apply_update(current, actor, request);
      assert.deepEqual(result, { status: 403, error: "FORBIDDEN" });
    });

    test("rejects when actor is null or undefined", () => {
      const { current, request } = getFixtures();
      assert.deepEqual(apply_update(current, null, request), { status: 403, error: "FORBIDDEN" });
      assert.deepEqual(apply_update(current, undefined, request), { status: 403, error: "FORBIDDEN" });
    });

    test("permission check has precedence over malformed request or wrong deviceId", () => {
      const { current } = getFixtures();
      const badActor = { siteId: "WRONG", role: "viewer" };
      // Completely invalid request payload
      const malformedRequest = { invalid: true };

      const result = apply_update(current, badActor, malformedRequest);
      assert.deepEqual(result, { status: 403, error: "FORBIDDEN" });
    });
  });

  describe("3. Step 2: Request Structure Validation", () => {
    const { current, actor } = getFixtures();

    const structureTestCases = [
      { name: "null request", req: null },
      { name: "undefined request", req: undefined },
      { name: "non-object (string)", req: "request" },
      { name: "array request", req: [] },
      {
        name: "missing deviceId",
        req: { expectedVersion: 3, settings: { volume: 3 } },
      },
      {
        name: "missing expectedVersion",
        req: { deviceId: "D01", settings: { volume: 3 } },
      },
      {
        name: "missing settings",
        req: { deviceId: "D01", expectedVersion: 3 },
      },
      {
        name: "extra top-level key",
        req: { deviceId: "D01", expectedVersion: 3, settings: { volume: 3 }, extra: 123 },
      },
      {
        name: "empty string deviceId",
        req: { deviceId: "", expectedVersion: 3, settings: { volume: 3 } },
      },
      {
        name: "whitespace-only deviceId",
        req: { deviceId: "   ", expectedVersion: 3, settings: { volume: 3 } },
      },
      {
        name: "non-string deviceId (number)",
        req: { deviceId: 101, expectedVersion: 3, settings: { volume: 3 } },
      },
      {
        name: "expectedVersion is boolean true",
        req: { deviceId: "D01", expectedVersion: true, settings: { volume: 3 } },
      },
      {
        name: "expectedVersion is boolean false",
        req: { deviceId: "D01", expectedVersion: false, settings: { volume: 3 } },
      },
      {
        name: "expectedVersion is float",
        req: { deviceId: "D01", expectedVersion: 3.5, settings: { volume: 3 } },
      },
      {
        name: "expectedVersion is zero",
        req: { deviceId: "D01", expectedVersion: 0, settings: { volume: 3 } },
      },
      {
        name: "expectedVersion is negative",
        req: { deviceId: "D01", expectedVersion: -1, settings: { volume: 3 } },
      },
      {
        name: "expectedVersion is string",
        req: { deviceId: "D01", expectedVersion: "3", settings: { volume: 3 } },
      },
      {
        name: "empty settings object",
        req: { deviceId: "D01", expectedVersion: 3, settings: {} },
      },
      {
        name: "settings is null",
        req: { deviceId: "D01", expectedVersion: 3, settings: null },
      },
      {
        name: "settings is an array",
        req: { deviceId: "D01", expectedVersion: 3, settings: [] },
      },
    ];

    for (const { name, req } of structureTestCases) {
      test(`rejects with 422 INVALID_INPUT when ${name}`, () => {
        const result = apply_update(current, actor, req);
        assert.deepEqual(result, { status: 422, error: "INVALID_INPUT" });
      });
    }
  });

  describe("4. Step 3: Settings Validation", () => {
    const { current, actor } = getFixtures();

    const invalidSettingsCases = [
      {
        name: "unknown settings key",
        settings: { brightness: 10 },
      },
      {
        name: "valid setting plus unknown setting",
        settings: { volume: 3, theme: "dark" },
      },
      {
        name: "invalid language (not en/hi/kn)",
        settings: { language: "es" },
      },
      {
        name: "language is a number",
        settings: { language: 1 },
      },
      {
        name: "language is empty string",
        settings: { language: "" },
      },
      {
        name: "volume is boolean true",
        settings: { volume: true },
      },
      {
        name: "volume is boolean false",
        settings: { volume: false },
      },
      {
        name: "volume is float",
        settings: { volume: 2.5 },
      },
      {
        name: "volume is below range (< 0)",
        settings: { volume: -1 },
      },
      {
        name: "volume is above range (> 5)",
        settings: { volume: 6 },
      },
      {
        name: "volume is string",
        settings: { volume: "4" },
      },
    ];

    for (const { name, settings } of invalidSettingsCases) {
      test(`rejects with 422 INVALID_INPUT when ${name}`, () => {
        const request = {
          deviceId: "D01",
          expectedVersion: 3,
          settings,
        };
        const result = apply_update(current, actor, request);
        assert.deepEqual(result, { status: 422, error: "INVALID_INPUT" });
      });
    }

    test("settings validation has precedence over device ID or version mismatch", () => {
      // Both setting is invalid AND deviceId does not match current
      const request = {
        deviceId: "NON_EXISTENT",
        expectedVersion: 999,
        settings: { volume: 100 }, // Invalid volume
      };
      const result = apply_update(current, actor, request);
      assert.deepEqual(result, { status: 422, error: "INVALID_INPUT" });
    });
  });

  describe("5. Step 4: Identity & Optimistic Concurrency Checks", () => {
    test("returns 404 NOT_FOUND when deviceId does not match current record", () => {
      const { current, actor } = getFixtures();
      const request = {
        deviceId: "D99", // Different device ID
        expectedVersion: 3,
        settings: { volume: 4 },
      };
      const result = apply_update(current, actor, request);
      assert.deepEqual(result, { status: 404, error: "NOT_FOUND" });
    });

    test("returns 409 CONFLICT when expectedVersion does not match current version", () => {
      const { current, actor } = getFixtures();
      const request = {
        deviceId: "D01",
        expectedVersion: 2, // Stale version (current is 3)
        settings: { volume: 4 },
      };
      const result = apply_update(current, actor, request);
      assert.deepEqual(result, { status: 409, error: "CONFLICT" });
    });

    test("identity check (404) takes precedence over version conflict (409)", () => {
      const { current, actor } = getFixtures();
      const request = {
        deviceId: "D99", // wrong device ID
        expectedVersion: 2, // AND wrong version
        settings: { volume: 4 },
      };
      const result = apply_update(current, actor, request);
      assert.deepEqual(result, { status: 404, error: "NOT_FOUND" });
    });
  });

  describe("6. Immutability Guarantee across All Execution Paths", () => {
    test("rejection does not mutate inputs (deep comparison)", () => {
      const { current, actor } = getFixtures();
      const conflictRequest = {
        deviceId: "D01",
        expectedVersion: 1, // trigger 409
        settings: { volume: 5 },
      };

      const currentBefore = JSON.parse(JSON.stringify(current));
      const actorBefore = JSON.parse(JSON.stringify(actor));
      const requestBefore = JSON.parse(JSON.stringify(conflictRequest));

      const result = apply_update(current, actor, conflictRequest);

      assert.equal(result.status, 409);
      assert.deepEqual(current, currentBefore);
      assert.deepEqual(actor, actorBefore);
      assert.deepEqual(conflictRequest, requestBefore);
    });

    test("frozen inputs do not throw errors (proves no assignment occurs)", () => {
      const { current, actor, request } = getFixtures();
      Object.freeze(current);
      Object.freeze(current.settings);
      Object.freeze(actor);
      Object.freeze(request);
      Object.freeze(request.settings);

      // Should succeed without TypeError: Cannot assign to read only property
      const result = apply_update(current, actor, request);
      assert.equal(result.status, 200);
      assert.equal(result.record.version, 4);
    });
  });
});
