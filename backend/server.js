/**
 * Safe Device Settings Update - Backend REST Server
 * Built with pure Node.js built-in modules (zero external dependencies).
 */

const http = require("node:http");
const { apply_update } = require("./src/applyUpdate");

// Load .env configuration if present (Node.js built-in)
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {
    // .env is optional
  }
}

const PORT = process.env.PORT || 5001;

// Canonical initial state matching PRD
function getInitialState() {
  return {
    current: {
      deviceId: "D01",
      siteId: "S01",
      version: 3,
      settings: {
        language: "en",
        volume: 2,
      },
    },
    actor: {
      siteId: "S01",
      role: "editor",
    },
  };
}

let serverState = getInitialState();

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=UTF-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(body);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        if (!body.trim()) {
          resolve({});
        } else {
          resolve(JSON.parse(body));
        }
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return;
  }

  // GET /api/state -> Returns current saved record and active simulated actor
  if (pathname === "/api/state" && req.method === "GET") {
    return sendJson(res, 200, {
      current: serverState.current,
      actor: serverState.actor,
    });
  }

  // POST /api/update -> Executes apply_update(current, actor, request)
  if (pathname === "/api/update" && req.method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const { actor, request, dryRun, fixture } = body;

      const effectiveActor = actor || serverState.actor;
      // Protect normal application state: allow synthetic isolated fixture or dryRun
      const targetCurrent = fixture || serverState.current;
      const result = apply_update(targetCurrent, effectiveActor, request);

      // On 200, update in-memory record ONLY when not running in isolated/dry-run mode
      if (!dryRun && !fixture && result.status === 200 && result.record) {
        serverState.current = result.record;
      }

      return sendJson(res, result.status, result);
    } catch (err) {
      return sendJson(res, 400, {
        status: 400,
        error: "MALFORMED_JSON",
        message: err.message,
      });
    }
  }

  // POST /api/simulate-conflict -> Increments server version behind the client
  if (pathname === "/api/simulate-conflict" && req.method === "POST") {
    serverState.current = {
      ...serverState.current,
      version: serverState.current.version + 1,
      settings: {
        ...serverState.current.settings,
        volume: (serverState.current.settings.volume + 1) % 6,
      },
    };

    return sendJson(res, 200, {
      message: "Simulated concurrent update executed by another client",
      current: serverState.current,
    });
  }

  // POST /api/reset -> Resets state to canonical initial PRD fixture
  if (pathname === "/api/reset" && req.method === "POST") {
    serverState = getInitialState();
    return sendJson(res, 200, {
      message: "Server state reset to initial fixture values",
      ...serverState,
    });
  }

  return sendJson(res, 404, { status: 404, error: "ENDPOINT_NOT_FOUND" });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(` Safe Device Settings Backend Server`);
    console.log(` Running on: http://localhost:${PORT}`);
    console.log(` API State:  http://localhost:${PORT}/api/state`);
    console.log(` API Update: http://localhost:${PORT}/api/update`);
    console.log(`======================================================\n`);
  });
}

module.exports = { server, getInitialState };
