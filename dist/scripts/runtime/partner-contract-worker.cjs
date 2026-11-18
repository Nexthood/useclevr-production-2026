"use strict";
// Separate child process: no provider credentials in requests, no tokens in logs.
if (
  process.env.PARTNER_CONTRACTS_ENABLED !== "true" ||
  process.env.PARTNER_CONTRACT_WORKER_ENABLED !== "true" ||
  !process.env.PARTNER_CONTRACT_WORKER_SECRET ||
  process.env.PARTNER_CONTRACT_WORKER_SECRET.length < 32
)
  process.exit(0);
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) process.exit(1);
let stopped = false;
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    stopped = true;
    process.exit(0);
  });
async function tick() {
  if (stopped) return;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/internal/partner-contracts/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.PARTNER_CONTRACT_WORKER_SECRET}` },
      signal: AbortSignal.timeout(115000),
    });
    if (!r.ok) console.error("[partner-contract-worker] batch unavailable", { status: r.status });
  } catch {
    console.error("[partner-contract-worker] batch unavailable");
  }
  if (!stopped) setTimeout(tick, 60000).unref();
}
setTimeout(tick, 30000);
// Parent termination also stops a worker whose last timer is unreferenced.
setInterval(() => {
  if (process.ppid === 1) process.exit(0);
}, 15000);
