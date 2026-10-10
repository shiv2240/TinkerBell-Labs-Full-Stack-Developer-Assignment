/**
 * Runnable Example for Safe Device Settings Update
 */

const { apply_update } = require("./applyUpdate");

console.log("==================================================");
console.log("Safe Device Settings Update - Demonstration Runner");
console.log("==================================================\n");

// 1. Initial State
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

console.log("Initial Saved Record:");
console.dir(current, { depth: null });
console.log("\nActor Performing Update:");
console.dir(actor, { depth: null });
console.log("\nIncoming Partial Update Request:");
console.dir(request, { depth: null });

// Execute Update
const result = apply_update(current, actor, request);

console.log("\n--------------------------------------------------");
console.log("Result of apply_update(current, actor, request):");
console.dir(result, { depth: null });
console.log("--------------------------------------------------");

// Verify Immutability
console.log("\nVerification of Immutability:");
console.log("Original record version unchanged (expected 3):", current.version);
console.log("Original record volume unchanged (expected 2):", current.settings.volume);
console.log("Was 'current' mutated?", current.version !== 3 || current.settings.volume !== 2 ? "YES (FAIL)" : "NO (SAFE)");

// Concurrency Conflict Demonstration
console.log("\n--------------------------------------------------");
console.log("Testing Optimistic Concurrency Conflict (expectedVersion: 2 vs current: 3):");
const conflictRequest = {
  deviceId: "D01",
  expectedVersion: 2,
  settings: {
    volume: 5,
  },
};
const conflictResult = apply_update(current, actor, conflictRequest);
console.dir(conflictResult, { depth: null });

// Permission Rejection Demonstration
console.log("\n--------------------------------------------------");
console.log("Testing Forbidden Actor (role: viewer):");
const viewerActor = { siteId: "S01", role: "viewer" };
const forbiddenResult = apply_update(current, viewerActor, request);
console.dir(forbiddenResult, { depth: null });

console.log("\nDemonstration complete.");
