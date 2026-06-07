const path = require("node:path");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

function ensureNextDistBuild(nextDir) {
  const buildDir = path.join(nextDir, "dist", "build");
  if (fs.existsSync(path.join(buildDir, "output", "log.js"))) return;
  const logPath = path.join(buildDir, "output", "log.js");
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(
    logPath,
    `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _picocolors = require("../../lib/picocolors");
const _lrucache = require("../../server/lib/lru-cache");
const prefixes = { wait: (0, _picocolors.white)((0, _picocolors.bold)("○")), error: (0, _picocolors.red)((0, _picocolors.bold)("⨯")), warn: (0, _picocolors.yellow)((0, _picocolors.bold)("⚠")), ready: "▲", info: (0, _picocolors.white)((0, _picocolors.bold)(" ")), event: (0, _picocolors.green)((0, _picocolors.bold)("✓")), trace: (0, _picocolors.magenta)((0, _picocolors.bold)("»")) };
const LOGGING_METHOD = { log: "log", warn: "warn", error: "error" };
function prefixedLog(prefixType, ...message) { if ((message[0] === "" || message[0] === undefined) && message.length === 1) message.shift(); const m = prefixType in LOGGING_METHOD ? LOGGING_METHOD[prefixType] : "log"; const p = prefixes[prefixType]; if (message.length === 0) console[m](""); else if (message.length === 1 && typeof message[0] === "string") console[m](p + " " + message[0]); else console[m](p, ...message); }
function bootstrap(m) { console.log(m); }
function wait(...m) { prefixedLog("wait", ...m); }
function error(...m) { prefixedLog("error", ...m); }
function warn(...m) { prefixedLog("warn", ...m); }
function ready(...m) { prefixedLog("ready", ...m); }
function info(...m) { prefixedLog("info", ...m); }
function event(...m) { prefixedLog("event", ...m); }
function trace(...m) { prefixedLog("trace", ...m); }
const wc = new _lrucache.LRUCache(1e4, v => v.length);
function warnOnce(...m) { const k = m.join(" "); if (!wc.has(k)) { wc.set(k, k); warn(...m); } }
const ec = new _lrucache.LRUCache(1e4, v => v.length);
function errorOnce(...m) { const k = m.join(" "); if (!ec.has(k)) { ec.set(k, k); error(...m); } }
exports.bootstrap = bootstrap; exports.error = error; exports.errorOnce = errorOnce; exports.event = event; exports.info = info; exports.prefixes = prefixes; exports.ready = ready; exports.trace = trace; exports.wait = wait; exports.warn = warn; exports.warnOnce = warnOnce;
`
  );
  console.log("Patched missing next/dist/build/output/log.js");
}

function findAndPatchNextBuild() {
  const cwd = process.cwd();
  const nmDir = path.join(cwd, "node_modules");
  if (!fs.existsSync(nmDir)) return;
  // pnpm: check .pnpm/next@*/node_modules/next/
  const pnpmDir = path.join(nmDir, ".pnpm");
  if (fs.existsSync(pnpmDir)) {
    for (const entry of fs.readdirSync(pnpmDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith("next@")) {
        ensureNextDistBuild(path.join(pnpmDir, entry.name, "node_modules", "next"));
      }
    }
  }
  // flat: check next/ directly
  const flatNext = path.join(nmDir, "next");
  if (fs.existsSync(path.join(flatNext, "package.json"))) {
    ensureNextDistBuild(flatNext);
  }
}

findAndPatchNextBuild();

const port = process.env.PORT || "8080";
const serverTarget = process.env.USECLEVR_SERVER_TARGET || process.env.SERVER_TARGET || "";

process.env.NEXT_TELEMETRY_DISABLED ||= "1";
process.env.AUTH_TRUST_HOST ||= "true";
process.env.PORT = port;

if (process.env.RAILWAY_ENVIRONMENT_ID || serverTarget === "railway") {
  if (process.env.USECLEVR_AUTH_URL_STRICT !== "true") {
    delete process.env.AUTH_URL;
  }
  process.env.HOSTNAME = "0.0.0.0";
} else if (process.env.VERCEL || serverTarget === "vercel") {
  if (!process.env.AUTH_URL && process.env.VERCEL_URL) {
    process.env.AUTH_URL = `https://${process.env.VERCEL_URL}`;
  }
  process.env.HOSTNAME = "0.0.0.0";
} else {
  const localAuthUrl = `http://localhost:${port}`;
  if (!isLocalHttpUrl(process.env.AUTH_URL)) {
    process.env.AUTH_URL = localAuthUrl;
  } else {
    process.env.AUTH_URL ||= localAuthUrl;
  }
  process.env.HOSTNAME ||= "127.0.0.1";
}

function isLocalHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

const nextBuildDir = path.join(process.cwd(), ".next");
const nextBuildRestoreDir = path.join(process.cwd(), "next-build");
if (!fs.existsSync(nextBuildDir) && fs.existsSync(nextBuildRestoreDir)) {
  fs.cpSync(nextBuildRestoreDir, nextBuildDir, { recursive: true });
}

const serverCandidates = [
  path.join(process.cwd(), "server.js"),
  path.join(process.cwd(), "dist", "server.js"),
  path.join(process.cwd(), ".next", "standalone", "server.js"),
];
const serverPath = serverCandidates.find((candidate) => fs.existsSync(candidate));

if (!serverPath) {
  console.error(
    "Could not find a generated Next standalone server. Run the production build first.",
  );
  process.exit(1);
}

const result = spawnSync(process.execPath, [serverPath], {
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
