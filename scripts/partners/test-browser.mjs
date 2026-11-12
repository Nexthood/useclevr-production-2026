import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "tailwindcss";
import compiledWebpack from "next/dist/compiled/webpack/webpack.js";

// Component acceptance uses an isolated HTTP fixture server; no auth, database, or provider modules load.
if (process.argv.length > 2) throw new Error("Browser acceptance accepts no service targets");
const root = fileURLToPath(new URL("../../", import.meta.url));
const directory = mkdtempSync(path.join(os.tmpdir(), "useclevr-partner-browser-"));
compiledWebpack.init?.();
await new Promise((resolve, reject) => {
  compiledWebpack.webpack(
    {
      mode: "development",
      optimization: { minimize: false, minimizer: [] },
      // Match Next's browser process shim when exercising the real Auth.js client.
      plugins: [
        new compiledWebpack.webpack.ProvidePlugin({
          process: "next/dist/build/polyfills/process.js",
        }),
      ],
      context: root,
      entry: path.join(root, "scripts/partners/browser-fixture.tsx"),
      output: { path: directory, filename: "bundle.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": path.join(root, "src") } },
      module: {
        rules: [
          {
            test: /\.tsx?$/,
            exclude: /node_modules/,
            use: path.join(root, "scripts/partners/browser-loader.cjs"),
          },
        ],
      },
    },
    (error, stats) =>
      error || stats?.hasErrors()
        ? reject(error || new Error(stats.toString({ all: false, errors: true })))
        : resolve(),
  );
});
const css = await postcss([tailwind({ config: path.join(root, "tailwind.config.ts") })]).process(
  readFileSync(path.join(root, "src/assets/styles/globals.css"), "utf8"),
  { from: path.join(root, "src/assets/styles/globals.css") },
);
writeFileSync(path.join(directory, "styles.css"), css.css);
const config = {
  enabled: false,
  standardBps: 1500,
  premiumBps: 2000,
  silverCustomers: 25,
  goldCustomers: 100,
  platinumUsdMinor: "10000000",
  diamondUsdMinor: "30000000",
  eligibilityAnchor: "first_payment",
  suspendedAccrual: "hold",
  terminatedAccrual: "stop",
  downgradeGraceDays: 30,
  relatedParty: "exclude",
  waitingDays: 30,
  minimumPayoutMinor: { USD: "5000", EUR: "5000" },
  postPayoutRefund: "offset",
};
const statement = {
  partner: {
    id: "fixture-partner",
    name: "Synthetic partner",
    country: "NL",
    market: "Fixture market",
    status: "active",
    code: "uc-fixture",
    level: "silver",
    agreement: "Synthetic agreement",
    payoutHold: false,
    notes: "Fixture notes",
  },
  rateBps: 1500,
  activeCustomers: 25,
  totalCustomers: 27,
  rollingUsdMinor: "100000",
  referralLink: "http://localhost/signup?ref=uc-fixture",
  progress: {
    level: "gold",
    unit: "customers",
    current: "25",
    target: "100",
    remaining: "75",
    percent: 25,
  },
  balances: {
    USD: {
      revenue: "100000",
      earned: "15000",
      pending: "5000",
      approved: "5000",
      paid: "5000",
      adjustments: "0",
      liability: "10000",
      settlement: "5000",
    },
  },
  commissions: [
    {
      id: "fixture-commission",
      paymentId: "fixture-payment",
      state: "pending",
      earnedAt: "2026-01-01T00:00:00Z",
      rateBps: 1500,
      amountMinor: "5000",
      adjustedMinor: "0",
      settledMinor: "0",
      dueMinor: "5000",
      currency: "USD",
    },
  ],
  payouts: [],
  adjustments: [],
  attributions: [{ id: "fixture-attribution", relatedParty: "unknown" }],
  audit: [],
  offset: 0,
  nextOffset: null,
};
const actions = [];
let onboardingError = "incorrect_account";
let signoutReturn = null;
const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/bundle.js" || url.pathname === "/styles.css") {
    response.setHeader(
      "Content-Type",
      url.pathname.endsWith("js") ? "text/javascript" : "text/css",
    );
    response.end(readFileSync(path.join(directory, url.pathname.slice(1))));
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    response.setHeader("Content-Type", "application/json");
    if (url.pathname === "/api/admin/partner-applications" && request.method === "GET") {
      response.end(JSON.stringify({ applications: [] }));
      return;
    }
    if (url.pathname === "/api/admin/partner-contracts" && request.method === "GET") {
      response.end(JSON.stringify({ enabled: false }));
      return;
    }
    if (url.pathname === "/api/auth/csrf") {
      response.end(JSON.stringify({ csrfToken: "synthetic-browser-csrf" }));
      return;
    }
    if (url.pathname === "/api/auth/signout" && request.method === "POST") {
      let body = "";
      for await (const part of request) body += part;
      const fields = new URLSearchParams(body);
      assert.equal(fields.get("csrfToken"), "synthetic-browser-csrf");
      signoutReturn = fields.get("callbackUrl");
      response.end(JSON.stringify({ url: signoutReturn }));
      return;
    }
    if (url.pathname === "/api/partner-applications/onboard" && request.method === "POST") {
      for await (const _part of request) {
        /* Consume only; invitation tokens are never logged. */
      }
      response.statusCode = onboardingError
        ? onboardingError === "authentication_required"
          ? 401
          : 403
        : 200;
      const messages = {
        incorrect_account:
          "You are signed in with a different account. Sign in with the verified email address that received this invitation.",
        email_verification_required: "Verify your UseClevr account email before continuing.",
        authentication_required:
          "Sign in with the account that received this invitation to continue.",
      };
      response.end(
        JSON.stringify(
          onboardingError
            ? { code: onboardingError, error: messages[onboardingError] }
            : { ok: true },
        ),
      );
      return;
    }
    if (request.method === "POST") {
      let body = "";
      for await (const part of request) body += part;
      const action = JSON.parse(body);
      actions.push(action);
      if (url.pathname === "/api/partner-applications") {
        response.statusCode = 201;
        response.end(JSON.stringify({ ok: true, status: "pending" }));
        return;
      }
      if (action.action === "approve") statement.commissions[0].state = "approved";
      if (action.action === "payout")
        statement.payouts.push({
          id: "fixture-settlement",
          createdAt: new Date().toISOString(),
          amountMinor: action.amountMinor,
          currency: action.currency,
          reference: action.reference,
        });
      response.end(JSON.stringify({ success: true }));
      return;
    }
    const result =
      url.pathname === "/api/partners" || url.searchParams.has("partnerId")
        ? statement
        : {
            partners: [statement.partner],
            config,
            configId: "fixture-disabled",
            configurations: [
              { id: "fixture-disabled", config, effectiveAt: "2026-01-01T00:00:00Z" },
            ],
            heldEvents: [
              {
                id: "fixture-held",
                objectId: "fixture-invoice",
                reason: "suspended_hold",
                evidence: { kind: "payment" },
              },
            ],
            liabilities: [{ currency: "USD", amountMinor: "10000" }],
            totals: { total: 1, active: 1 },
            nextOffset: null,
          };
    response.end(JSON.stringify(result));
    return;
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body class="bg-background"><div id="root"></div><script src="/bundle.js"></script></body></html>',
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn(
  "google-chrome",
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-sync",
    "--no-first-run",
    "--remote-debugging-port=0",
    `--user-data-dir=${directory}/profile`,
    "about:blank",
  ],
  {
    env: { PATH: process.env.PATH, HOME: directory, LANG: "C.UTF-8" },
    stdio: ["ignore", "ignore", "pipe"],
  },
);
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error("Chrome startup timed out")), 15000);
    chrome.on("error", reject);
    chrome.stderr.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const callback = pending.get(message.id);
      pending.delete(message.id);
      message.error
        ? callback.reject(new Error(message.error.message))
        : callback.resolve(message.result);
    }
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const command = (method, params) => send(method, params, sessionId);
  const evaluate = async (expression) => {
    const r = await command("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const waitFor = async (expression) => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Browser condition failed: ${expression}`);
  };
  let passed = 0;
  for (const width of [1280, 390])
    for (const theme of ["light", "dark"]) {
      await command("Emulation.setDeviceMetricsOverride", {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: width < 500,
      });
      await command("Page.navigate", { url: `${origin}/?theme=${theme}` });
      await waitFor('document.body?.innerText.includes("Commission history")');
      assert.equal(
        await evaluate(
          'document.body.innerText.includes("15%") && document.body.innerText.includes("75 customers") && document.querySelector("#partner-link").value.includes("uc-fixture")',
        ),
        true,
      );
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
      const colors = await evaluate(
        '({background:getComputedStyle(document.body).backgroundColor,foreground:getComputedStyle(document.querySelector("main")).color})',
      );
      const image = await command("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      writeFileSync(
        path.join(directory, `partner-${width}-${theme}.png`),
        Buffer.from(image.data, "base64"),
      );
      assert.notEqual(colors.background, colors.foreground);
      if (theme === "dark")
        assert.equal(await evaluate('document.documentElement.classList.contains("dark")'), true);
      await command("Page.navigate", { url: `${origin}/?admin=1&theme=${theme}` });
      await waitFor('document.body?.innerText.includes("Register a partner")');
      await waitFor(
        'Array.from(document.querySelectorAll("button")).some(b=>b.textContent==="View")',
      );
      await evaluate(
        'Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="View").click()',
      );
      await waitFor('document.body?.innerText.includes("Partner performance")');
      assert.equal(
        await evaluate(
          'document.body.innerText.includes("Financial review decision") && document.body.innerText.includes("Approve commissions and record settlements")',
        ),
        true,
      );
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
      const adminImage = await command("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      writeFileSync(
        path.join(directory, `admin-${width}-${theme}.png`),
        Buffer.from(adminImage.data, "base64"),
      );
      console.log(
        `PASS partner/admin components, ${width}px, ${theme} theme, scoped table overflow`,
      );
      passed++;
    }
  await evaluate(
    `(() => { const input = Array.from(document.querySelectorAll("label")).find(l=>l.textContent.includes("Audit reason for changes")).querySelector("input"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"Synthetic browser approval"); input.dispatchEvent(new Event("input",{bubbles:true})); document.querySelectorAll("details").forEach(d=>d.open=true); })()`,
  );
  await evaluate(
    'Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Approve").click()',
  );
  await waitFor('document.body?.innerText.includes("Saved.")');
  assert.equal(
    actions.some((a) => a.action === "approve" && a.reason === "Synthetic browser approval"),
    true,
  );
  await waitFor(
    'Array.from(document.querySelectorAll("button")).some(b=>b.textContent.includes("Record manual payout") && !b.disabled)',
  );
  await evaluate(
    `(() => { const input = document.querySelector('input[name="reference"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"fixture-browser-settlement"); input.dispatchEvent(new Event("input",{bubbles:true})); Array.from(document.querySelectorAll("button")).find(b=>b.textContent.includes("Record manual payout")).click(); })()`,
  );
  for (let i = 0; i < 100 && !actions.some((a) => a.action === "payout"); i++)
    await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(
    actions.some((a) => a.action === "payout" && a.currency === "USD" && a.amountMinor === "5000"),
    true,
  );
  console.log(
    "PASS approval and manual settlement forms submit separate, reasoned actions to fixture transport",
  );
  passed++;
  for (const [partnershipType, program] of [
    ["Independent Sales Partner", "work_with_us"],
    ["Authorized Reseller", "reseller_enterprise"],
  ]) {
    for (const width of [1280, 390]) {
      await command("Emulation.setDeviceMetricsOverride", {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: width < 500,
      });
      await command("Page.navigate", {
        url: origin + "/?apply=1&partnershipType=" + encodeURIComponent(partnershipType),
      });
      await waitFor('document.body?.innerText.includes("Submit partner application")');
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
      assert.equal(await evaluate('document.querySelector("form").checkValidity()'), false);
      assert.equal(
        await evaluate('document.querySelectorAll("input[type=checkbox]:checked").length'),
        0,
      );
      await evaluate(`(() => {
        const values = { fullName: "Browser applicant", email: "browser@example.invalid", companyName: "Browser Company", country: "NL", experience: "I work with independent retailers on analytics and reporting." };
        for (const [key,value] of Object.entries(values)) { const input = document.querySelector('[name="'+key+'"]'); input.value=value; input.dispatchEvent(new Event("input",{bubbles:true})); }
        document.querySelector('input[name="privacyAccepted"]').click();
        if (!document.querySelector("form").checkValidity()) throw new Error("Public application fixture is invalid");
        document.querySelector("form").requestSubmit();
      })()`);
      await waitFor('document.body?.innerText.includes("Application received")');
      assert.equal(actions.at(-1).program, program);
      assert.equal(actions.at(-1).category, partnershipType);
      assert.equal(actions.at(-1).privacyAccepted, true);
      assert.equal(actions.at(-1).country, "NL");
      assert.equal(actions.at(-1).website, "");
      assert.equal(await evaluate('document.querySelector("form") === null'), true);
      assert.equal(await evaluate('document.querySelector("#partner-link") === null'), true);
      assert.equal(
        await evaluate(
          'document.body.innerText.includes("No UseClevr customer account is needed")',
        ),
        true,
      );
      passed++;
      console.log(
        "PASS public " +
          program +
          " application validation, privacy consent and confirmation at " +
          width +
          "px",
      );
    }
  }
  for (const code of [
    "incorrect_account",
    "email_verification_required",
    "authentication_required",
  ]) {
    onboardingError = code;
    signoutReturn = null;
    await command("Page.navigate", { url: origin + "/?onboard=1" });
    await waitFor('document.querySelector("input[type=checkbox]") !== null');
    await evaluate('document.querySelector("input[type=checkbox]").click()');
    await evaluate(
      'Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Complete onboarding").click()',
    );
    await waitFor('document.querySelector("[role=alert]") !== null');
    assert.equal(
      await evaluate(
        'document.body.innerText.includes("verified email address") || document.body.innerText.includes("Verify your UseClevr") || document.body.innerText.includes("Sign in with the account")',
      ),
      true,
    );
    let destination;
    if (code === "authentication_required") {
      destination = await evaluate('document.querySelector("a").getAttribute("href")');
    } else {
      const label =
        code === "incorrect_account" ? "Sign in with invited account" : "Verify email and sign in";
      await evaluate(
        'Array.from(document.querySelectorAll("button")).find(b => b.textContent === ' +
          JSON.stringify(label) +
          ").click()",
      );
      await waitFor('location.pathname === "/login"');
      destination = signoutReturn;
    }
    const login = new URL(destination, origin);
    const callback = new URL(login.searchParams.get("callbackUrl"), origin);
    assert.equal(login.origin, origin);
    assert.equal(login.pathname, "/login");
    assert.equal(callback.pathname, "/partners/onboard");
    assert.ok(
      callback.searchParams.get("token") === "synthetic-browser-invitation-32-bytes-only",
      "recovery preserves the invitation without logging it",
    );
    passed++;
    console.log(
      "PASS onboarding recovery for " +
        code +
        " preserves the invitation through same-origin sign-in",
    );
  }
  onboardingError = null;
  await command("Page.navigate", { url: origin + "/?onboard=1" });
  await waitFor('document.querySelector("input[type=checkbox]") !== null');
  await evaluate('document.querySelector("input[type=checkbox]").click()');
  await evaluate(
    'Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Complete onboarding").click()',
  );
  await waitFor('document.body.innerText.includes("Onboarding complete")');
  assert.equal(await evaluate('document.body.innerText.includes("remain inactive")'), true);
  passed++;
  console.log("PASS onboarding success states separate administrator activation");
  console.log(`${passed} browser acceptance groups passed. Artifacts: ${directory}`);
  console.log(
    "Scope: real components and design-system CSS with synthetic HTTP responses. Full application login, attribution navigation, and production hosting are not exercised.",
  );
} finally {
  socket?.close();
  chrome.kill("SIGTERM");
  server.close();
}
