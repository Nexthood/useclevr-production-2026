import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "tailwindcss";
import compiledWebpack from "next/dist/compiled/webpack/webpack.js";

// Component acceptance uses an isolated HTTP fixture server; no auth, database, or provider modules load.
if (process.argv.length > 2) throw new Error("Browser acceptance accepts no service targets");
const root = fileURLToPath(new URL("../../", import.meta.url));
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
  convertedCustomers: 2,
  verifiedSales: 3,
  customers: [
    {
      id: "relationship-fixture",
      signedUpAt: "2026-01-01T00:00:00Z",
      plan: "pro",
      status: "active",
      eligible: true,
    },
  ],
  sales: [
    {
      id: "sale-fixture",
      currency: "USD",
      netMinor: "10000",
      paidAt: "2026-01-01T00:00:00Z",
      adjustmentMinor: "1000",
      subscriptionStatus: "active",
    },
  ],
  trends: [{ month: "2026-01", currency: "USD", revenue: "9000", commission: "1350" }],
  monthlyReferrals: [{ month: "2026-01", referrals: 1 }],
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
const commercialTestAccount = {
  id: "commercial-delete-fixture",
  name: "Browser Commercial Test Account",
  country: "NL",
  market: null,
  status: "pending",
};
let commercialFixture = false;
let commercialDeleteFailure = true;
let commercialDeleted = false;
const commercialDeletionRequests = [];
let registrationFixture = false;
let registrationDeleted = false;
let deletionBlocked = true;
const deletionRequests = [];
let applicationFailure = false;
let applicationGate;
let savedIdentity;
let signingAvailability;
let identityFailure = false;
let signingRequests = 0;
let onboardingError = "incorrect_account";
let signoutReturn = null;
let nativeVerified = false;
let nativeSigned = false;
let nativeRole = "partner";
let nativeReviewRequests = 0;
const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.searchParams.has("native")) {
    nativeVerified = url.searchParams.has("stale");
    nativeReviewRequests = 0;
    nativeSigned = false;
    nativeRole = url.searchParams.has("company") ? "company" : "partner";
  }
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
    if (url.pathname === "/api/admin/partners" && url.searchParams.has("deletionPartnerId")) {
      const permitted = url.searchParams.get("deletionPartnerId") === commercialTestAccount.id;
      const partner = permitted ? commercialTestAccount : statement.partner;
      response.end(JSON.stringify({
        id: partner.id, name: partner.name, status: partner.status,
        email: permitted ? "commercial-deletion@example.invalid" : "active-partner@example.invalid",
        permitted, explanation: permitted ? null : "The account has retained financial history.",
        applicationCount: permitted ? 1 : 0, scope: "a".repeat(64),
      }));
      return;
    }
    if (url.pathname === "/api/admin/partners" && request.method === "DELETE") {
      let body = "";
      for await (const part of request) body += part;
      commercialDeletionRequests.push(JSON.parse(body));
      if (commercialDeleteFailure) {
        response.statusCode = 503;
        response.end(JSON.stringify({ error: "Could not delete the account. Try again." }));
      } else {
        commercialDeleted = true;
        response.end(JSON.stringify({ ok: true }));
      }
      return;
    }
    if (url.pathname === "/api/partners/contracts/native") {
      if (request.method === "GET") {
        nativeReviewRequests++;
        response.statusCode = nativeVerified ? 200 : 401;
        response.end(
          JSON.stringify(
            nativeVerified
              ? {
                  signed: nativeSigned,
                  contractId: "native-browser-fixture",
                  role: nativeRole,
                  email: "invited@example.invalid",
                  legalName: "Fixture Signer",
                  documentChecksum: "a".repeat(64),
                  text: "Complete immutable agreement\n\nParty schedule\n\nVersioned Commercial Schedule\nAll synthetic terms are displayed before signing.",
                  consentVersion: "fixture-consent-v1",
                  consentText:
                    "I consent to electronic records and signatures. This is not a qualified electronic signature.",
                  expiresAt: "2099-01-01T00:00:00Z",
                }
              : { error: "Verify your signing email." },
          ),
        );
        return;
      }
      let raw = "";
      for await (const part of request) raw += part;
      const body = JSON.parse(raw);
      if (body.operation === "request_code") response.end(JSON.stringify({ sent: true }));
      else if (body.operation === "verify") {
        nativeVerified = body.code === "123456";
        response.statusCode = nativeVerified ? 200 : 400;
        response.end(
          JSON.stringify(
            nativeVerified
              ? { verified: true }
              : { error: "The signing verification code is incorrect." },
          ),
        );
      } else {
        assert.ok(
          nativeVerified && body.signing.consent === true && body.signing.reviewed === true,
        );
        assert.equal(body.signing.legalName, "Fixture Signer");
        nativeSigned = true;
        response.end(JSON.stringify({ signed: true }));
      }
      return;
    }
    if (url.pathname === "/api/admin/partner-applications") {
      if (request.method === "DELETE") {
        let body = "";
        for await (const part of request) body += part;
        deletionRequests.push(JSON.parse(body));
        if (deletionBlocked) {
          response.statusCode = 409;
          response.end(JSON.stringify({ error: "This registration is protected by linked records." }));
        } else {
          registrationDeleted = true;
          response.end(JSON.stringify({ ok: true }));
        }
        return;
      }
      const status = url.searchParams.get("status");
      const applications =
        registrationFixture && ((status === "pending" && !registrationDeleted) || status === "approved")
          ? [{
              id: "delete-registration-fixture",
              fullName: "Browser Registration",
              email: "browser-deletion@example.invalid",
              category: "Referral Partner",
              country: "NL",
              program: "work_with_us",
              status,
              createdAt: "2026-11-21T12:00:00.000Z",
              canRequestDeletion: status === "pending",
              experience: "Synthetic application contents",
              audit: [],
              deliveries: [],
            }]
          : [];
      response.end(JSON.stringify({ applications, count: applications.length }));
      return;
    }
    if (url.pathname === "/api/admin/partner-contracts" && request.method === "GET") {
      response.end(JSON.stringify({ enabled: false }));
      return;
    }
    if (url.pathname === "/api/partners/contracts/sign") {
      signingRequests++;
      response.statusCode = 500;
      response.end(JSON.stringify({ error: "Unexpected signing request." }));
      return;
    }
    if (url.pathname === "/api/partners/contracts") {
      if (request.method === "POST") {
        let body = "";
        for await (const part of request) body += part;
        const action = JSON.parse(body);
        actions.push(action);
        if (identityFailure) {
          response.statusCode = 503;
          response.end(JSON.stringify({ error: "Could not save legal information." }));
          return;
        }
        savedIdentity = {
          id: "fixture-identity",
          applicationId: action.applicationId,
          identity: action.identity,
          reviewedAt: null,
        };
        response.end(JSON.stringify(savedIdentity));
        return;
      }
      response.end(
        JSON.stringify({
          enabled: true,
          applications: [
            {
              id: "fixture-application",
              fullName: "Fixture Partner",
              category: "Authorized Reseller",
              status: "approved",
              onboardedAt: "2026-11-21T12:00:00.000Z",
            },
          ],
          contracts: signingAvailability
            ? [
                {
                  id: "fixture-contract",
                  applicationId: "fixture-application",
                  revision: 1,
                  mode: "native",
                  status: "awaiting_partner_signature",
                  signingAvailability,
                },
              ]
            : [],
          profiles: savedIdentity ? [savedIdentity] : [],
          schedules: [],
        }),
      );
      return;
    }
    if (url.pathname === "/api/partners/profile") {
      if (request.method === "PATCH") {
        for await (const _part of request) {
        }
        response.end(JSON.stringify({ saved: true }));
      } else
        response.end(
          JSON.stringify({
            name: "Synthetic partner",
            email: "fixture@example.invalid",
            companyName: "Fixture",
            companyWebsite: "",
            communications: true,
          }),
        );
      return;
    }
    if (url.pathname === "/api/partner-applications/invitation") {
      let raw = "";
      for await (const part of request) raw += part;
      const b = JSON.parse(raw);
      assert.equal(b.email, "invited@example.invalid");
      if (b.action === "request_code") response.end(JSON.stringify({ sent: true }));
      else if (b.code === "123456") response.end(JSON.stringify({ verified: true }));
      else {
        response.statusCode = 400;
        response.end(
          JSON.stringify({
            error: "The verification code is incorrect. Check the six digits in your email.",
          }),
        );
      }
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
        if (applicationGate) await applicationGate;
        if (applicationFailure) {
          response.statusCode = 503;
          response.end(JSON.stringify({ error: "Could not save application." }));
          return;
        }
        response.statusCode = 201;
        response.end(JSON.stringify({ received: true, status: "pending" }));
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
            partners: commercialFixture && !commercialDeleted ? [statement.partner, commercialTestAccount] : [statement.partner],
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
            totals: { total: commercialFixture && !commercialDeleted ? 2 : 1, active: 1 },
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
const directory = mkdtempSync(path.join(os.tmpdir(), "useclevr-partner-browser-"));
let socket;
let chrome;
let chromeClosed;
try {
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
  const listening = once(server, "listening");
  server.listen(0, "127.0.0.1");
  await listening;
  const origin = `http://127.0.0.1:${server.address().port}`;
  chrome = spawn(
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
  chromeClosed = new Promise((resolve) => chrome.once("close", resolve));
  let startupTimeout;
  const endpoint = await new Promise((resolve, reject) => {
    let output = "";
    startupTimeout = setTimeout(() => reject(new Error("Chrome startup timed out")), 15000);
    chrome.once("error", reject);
    chromeClosed.then(() => reject(new Error("Chrome exited before DevTools started")));
    const onStartupOutput = (chunk) => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        chrome.stderr.off("data", onStartupOutput);
        chrome.stderr.resume();
        resolve(match[1]);
      }
    };
    chrome.stderr.on("data", onStartupOutput);
  }).finally(() => clearTimeout(startupTimeout));
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let sequence = 0;
  const pending = new Map();
  let onOverviewRequest;
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const callback = pending.get(message.id);
      pending.delete(message.id);
      message.error
        ? callback.reject(new Error(message.error.message))
        : callback.resolve(message.result);
    }
    if (message.method === "Fetch.requestPaused") onOverviewRequest?.(message.params);
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
  const overviewRequests = [];
  onOverviewRequest = ({ requestId, request }) => {
    overviewRequests.push(request.url);
    void command("Fetch.fulfillRequest", {
      requestId,
      responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "text/html" }],
      body: Buffer.from("<!doctype html><title>Overview fixture</title>").toString("base64"),
    });
  };
  await command("Fetch.enable", { patterns: [{ urlPattern: "https://useclevr.com/*" }] });
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
      if (await evaluate(`document.body !== null && (${expression})`)) return;
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
  registrationFixture = true;
  await command("Page.navigate", { url: `${origin}/?admin=1` });
  const registrations = 'document.querySelector("section[aria-labelledby=partner-application-admin-title]")';
  const registrationDialog = 'document.querySelector("[role=dialog]")';
  await waitFor(`${registrations}?.innerText.includes("Registrations in this status: 1")`);
  await evaluate(`${registrations}.querySelector("details").open = true`);
  const openDeletion = `[...${registrations}.querySelectorAll("button")].find(b => b.textContent === "Delete").click()`;
  await evaluate(openDeletion);
  await waitFor(`${registrationDialog}?.innerText.includes("Delete Partner Registration?")`);
  assert.equal(
    await evaluate(`["Browser Registration", "browser-deletion@example.invalid", "Referral Partner", "pending", "Please confirm that you want to continue."].every(value => ${registrationDialog}.textContent.includes(value))`),
    true,
  );
  assert.equal(await evaluate(`${registrationDialog}.querySelector("form").checkValidity()`), false);
  assert.equal(deletionRequests.length, 0);
  await evaluate(`[...${registrationDialog}.querySelectorAll("button")].find(b => b.textContent === "Cancel").click()`);
  await waitFor(`${registrationDialog} === null`);
  assert.equal(deletionRequests.length, 0);
  await evaluate(openDeletion);
  await waitFor(`${registrationDialog} !== null`);
  await evaluate(`${registrationDialog}.querySelector("[name=reason]").value = "test_registration"`);
  await evaluate(`${registrationDialog}.querySelector("form").requestSubmit()`);
  await waitFor(`${registrationDialog}?.querySelector("[role=alert]")?.innerText.includes("protected by linked records")`);
  assert.equal(await evaluate(`${registrations}.innerText.includes("Browser Registration")`), true);
  deletionBlocked = false;
  await evaluate(`${registrationDialog}.querySelector("form").requestSubmit()`);
  await waitFor(`${registrationDialog} === null && ${registrations}.innerText.includes("Partner registration deleted successfully.") && ${registrations}.innerText.includes("Registrations in this status: 0")`);
  assert.equal(await evaluate(`${registrations}.innerText.includes("Browser Registration")`), false);
  assert.deepEqual(deletionRequests, Array.from({ length: 2 }, () => ({
    id: "delete-registration-fixture",
    reason: "test_registration",
    confirm: true,
  })));
  await evaluate(`(() => { const filter = ${registrations}.querySelector("select"); filter.value = "approved"; filter.dispatchEvent(new Event("change", { bubbles: true })); })()`);
  await waitFor(`${registrations}.innerText.includes("Registrations in this status: 1")`);
  await evaluate(`${registrations}.querySelector("details").open = true`);
  assert.equal(await evaluate(`${registrations}.innerText.includes("This registration is protected")`), true);
  assert.equal(await evaluate(`[...${registrations}.querySelectorAll("button")].some(b => b.textContent === "Delete")`), false);
  passed++;
  console.log("PASS registration deletion confirmation, cancel, protected error, list refresh and count");
  commercialFixture = true;
  await command("Page.navigate", { url: `${origin}/?admin=1&theme=dark` });
  const partnerTable = 'Array.from(document.querySelectorAll("table")).find(table => table.querySelector("caption")?.textContent === "Partners")';
  const accountDialog = 'document.querySelector("[role=dialog]")';
  await waitFor(`${partnerTable}?.innerText.includes("Browser Commercial Test Account")`);
  assert.equal(await evaluate(`[...${partnerTable}.tBodies[0].rows].every(row => [...row.cells[4].querySelectorAll("button")].map(button => button.textContent).join(" ") === "View Delete")`), true);
  await evaluate(`${partnerTable}.tBodies[0].rows[0].querySelector("button[aria-label^='Delete']").click()`);
  await waitFor(`${accountDialog}?.innerText.includes("retained financial history")`);
  assert.equal(await evaluate(`${accountDialog}.innerText.includes("Blocked") && ${accountDialog}.innerText.includes("active-partner@example.invalid") && !${accountDialog}.querySelector("button[type=submit]")`), true);
  await evaluate(`[...${accountDialog}.querySelectorAll("button")].find(b => b.textContent === "View partner account").click()`);
  await waitFor('document.body.innerText.includes("Partner performance")');
  assert.equal(commercialDeletionRequests.length, 0);

  const openAccountDeletion = `${partnerTable}.querySelector('[aria-label="Delete Browser Commercial Test Account"]').click()`;
  await evaluate(openAccountDeletion);
  await waitFor(`${accountDialog}?.innerText.includes("Permitted")`);
  assert.equal(await evaluate(`${accountDialog}.innerText.includes("commercial-deletion@example.invalid") && ${accountDialog}.innerText.includes("1 eligible linked application") && !${accountDialog}.querySelector("form").checkValidity()`), true);
  await evaluate(`[...${accountDialog}.querySelectorAll("button")].find(b => b.textContent === "Cancel").click()`);
  await waitFor(`${accountDialog} === null`);
  assert.equal(commercialDeletionRequests.length, 0);
  await evaluate(openAccountDeletion);
  await waitFor(`${accountDialog}?.innerText.includes("Permitted")`);
  await evaluate(`${accountDialog}.querySelector("[name=reason]").value = "test_registration"`);
  await evaluate(`${accountDialog}.querySelector("form").requestSubmit()`);
  await waitFor(`${accountDialog}?.querySelector("[role=alert]")?.innerText.includes("Could not delete")`);
  assert.equal(await evaluate(`${partnerTable}.innerText.includes("Browser Commercial Test Account")`), true);
  commercialDeleteFailure = false;
  await evaluate(`${accountDialog}.querySelector("form").requestSubmit()`);
  await waitFor(`${accountDialog} === null && document.body.innerText.includes("Partner account deleted successfully.") && document.body.innerText.includes("Partners: 1")`);
  assert.equal(await evaluate(`${partnerTable}.innerText.includes("Browser Commercial Test Account")`), false);
  assert.deepEqual(commercialDeletionRequests, Array.from({length: 2}, () => ({
    partnerId: commercialTestAccount.id, reason: "test_registration", confirm: true, scope: "a".repeat(64),
  })));
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
  passed++;
  console.log("PASS table Delete actions, protected alternatives, confirmation, cancellation, errors and count refresh");
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
        const values = { fullName: "Browser applicant", email: "invalid-address", companyName: "Browser Company", country: "1L", experience: "I work with independent retailers on analytics and reporting." };
        for (const [key,value] of Object.entries(values)) document.querySelector('[name="'+key+'"]').value = value;
      })()`);
      assert.equal(
        await evaluate('document.querySelector("[name=email]").validity.typeMismatch'),
        true,
      );
      assert.equal(
        await evaluate('document.querySelector("[name=country]").validity.patternMismatch'),
        true,
      );
      assert.equal(
        await evaluate('document.querySelector("[name=privacyAccepted]").validity.valueMissing'),
        true,
      );
      await evaluate(`(() => {
        document.querySelector("[name=email]").value = "browser@example.invalid";
        document.querySelector("[name=country]").value = "NL";
        document.querySelector("[name=privacyAccepted]").click();
      })()`);
      assert.equal(await evaluate('document.querySelector("form").checkValidity()'), true);

      if (program === "work_with_us" && width === 1280) {
        applicationFailure = true;
        await evaluate('document.querySelector("form").requestSubmit()');
        await waitFor(
          'document.querySelector("[role=alert]")?.textContent.includes("Could not save application.")',
        );
        assert.equal(await evaluate('document.querySelector("[role=dialog]")'), null);
        assert.equal(
          await evaluate('document.querySelector("[name=email]").value'),
          "browser@example.invalid",
        );
        applicationFailure = false;
      }

      const postedBefore = actions.length;
      let releaseSubmission;
      applicationGate = new Promise((resolve) => {
        releaseSubmission = resolve;
      });
      await evaluate(`(() => {
        const form = document.querySelector("form");
        form.requestSubmit();
        form.requestSubmit();
      })()`);
      await waitFor('document.querySelector("form [type=submit]").disabled');
      assert.equal(
        await evaluate('document.querySelector("form [type=submit]").textContent'),
        "Submitting…",
      );
      assert.equal(await evaluate('document.querySelector("[role=dialog]")'), null);
      releaseSubmission();
      applicationGate = undefined;
      await waitFor(
        'document.querySelector("[role=dialog]")?.innerText.includes("Application Submitted Successfully!")',
      );
      await waitFor('document.activeElement.textContent === "Done"');
      assert.equal(actions.length, postedBefore + 1);
      assert.equal(actions.at(-1).program, program);
      assert.equal(actions.at(-1).category, partnershipType);
      assert.equal(actions.at(-1).privacyAccepted, true);
      assert.equal(actions.at(-1).country, "NL");
      assert.equal(actions.at(-1).website, "");
      assert.equal(await evaluate("location.pathname"), "/");
      assert.equal(await evaluate('document.querySelector("form").inert'), true);
      assert.equal(
        await evaluate(`(() => {
        const dialog = document.querySelector("[role=dialog]");
        return dialog.getAttribute("aria-modal") === "true" &&
          document.getElementById(dialog.getAttribute("aria-labelledby")).textContent === "Application Submitted Successfully!" &&
          document.getElementById(dialog.getAttribute("aria-describedby")).textContent.includes("We will contact you by email");
      })()`),
        true,
      );

      for (const [key, modifiers] of [
        ["Tab", 0],
        ["Tab", 8],
        ["Escape", 0],
      ]) {
        await command("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, modifiers });
        await command("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, modifiers });
        assert.equal(await evaluate("document.activeElement.textContent"), "Done");
      }
      if (width === 390) {
        await command("Emulation.setEmulatedMedia", {
          features: [{ name: "prefers-reduced-motion", value: "reduce" }],
        });
        assert.equal(
          await evaluate('getComputedStyle(document.querySelector("[role=dialog]")).animationName'),
          "none",
        );
        await command("Emulation.setEmulatedMedia", { features: [] });
      }
      const overview =
        program === "work_with_us"
          ? "https://useclevr.com/work-with-us"
          : "https://useclevr.com/resellers.html";
      const overviewCount = overviewRequests.length;
      await command("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: "Enter",
        code: "Enter",
        windowsVirtualKeyCode: 13,
        text: "\r",
      });
      await command("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "Enter",
        code: "Enter",
        windowsVirtualKeyCode: 13,
      });
      try {
        await waitFor('document.title === "Overview fixture"');
      } catch (error) {
        throw new Error(
          `Expected overview navigation to ${overview}. Intercepted: ${overviewRequests.slice(overviewCount).join(", ")}. Page: ${await evaluate("location.href")}`,
          { cause: error },
        );
      }
      assert.equal(overviewRequests[overviewCount], overview);
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
  await command("Page.navigate", { url: origin + "/partners/contracts" });
  await waitFor('document.body?.innerText.includes("Status: Legal Information Required")');
  assert.equal(await evaluate('document.querySelector("[name=registrationId]").required'), true);
  for (const field of [
    "legalName",
    "signerName",
    "signerTitle",
    "authorityConfirmed",
    "electronicRecordsConsent",
  ]) {
    assert.equal(
      await evaluate(`document.querySelector('[name="${field}"]').validity.valueMissing`),
      true,
    );
  }
  await evaluate(`(() => {
    const entity = document.querySelector("[name=entityType]");
    entity.value = "individual";
    entity.dispatchEvent(new Event("change", { bubbles: true }));
    const values = { legalName: "Fixture Applicant", address: "12 Synthetic Test Street", country: "nl", signerName: "Fixture Applicant", signerTitle: "Self" };
    for (const [key, value] of Object.entries(values)) document.querySelector('[name="'+key+'"]').value = value;
    document.querySelector("[name=authorityConfirmed]").click();
    document.querySelector("[name=electronicRecordsConsent]").click();
  })()`);
  assert.equal(await evaluate('document.querySelector("[name=registrationId]").required'), false);
  assert.equal(await evaluate('document.querySelector("form").checkValidity()'), true);
  identityFailure = true;
  await evaluate('document.querySelector("form").requestSubmit()');
  await waitFor(
    'document.querySelector("[role=alert]")?.textContent.includes("Could not save legal information.")',
  );
  assert.equal(await evaluate('document.querySelector("[role=dialog]")'), null);
  identityFailure = false;
  const identityRequests = actions.length;
  await evaluate(`(() => {
    const form = document.querySelector("form");
    form.requestSubmit();
    form.requestSubmit();
  })()`);
  await waitFor(
    'document.querySelector("[role=dialog]")?.innerText.includes("Information Submitted Successfully!")',
  );
  assert.equal(actions.length, identityRequests + 1);
  assert.deepEqual(actions.at(-1).identity, {
    legalName: "Fixture Applicant",
    entityType: "individual",
    address: "12 Synthetic Test Street",
    country: "NL",
    signerName: "Fixture Applicant",
    signerTitle: "Self",
    authorityConfirmed: true,
    electronicRecordsConsent: true,
  });
  await evaluate('document.querySelector("[role=dialog] button").click()');
  await waitFor(
    'document.querySelector("[role=dialog]") === null && document.activeElement.textContent.includes("Status: Pending Review")',
  );
  assert.equal(await evaluate("location.pathname"), "/partners/contracts");
  assert.equal(
    await evaluate('document.querySelector("[name=legalName]").value'),
    "Fixture Applicant",
  );
  await command("Page.reload", {});
  await waitFor('document.body?.innerText.includes("Status: Pending Review")');
  assert.equal(await evaluate('document.querySelector("[role=dialog]")'), null);
  passed++;
  console.log(
    "PASS legal identity validation, response handling, acknowledgment focus and persisted Pending Review",
  );

  savedIdentity.reviewedAt = "2026-11-22T12:00:00.000Z";
  for (const [availability, expected] of [
    ["approval_pending", "awaiting approval"],
    ["disabled", "Online signing is currently unavailable"],
    ["invitation_pending", "secure signing invitation is pending"],
    ["invitation_unavailable", "signing invitation is unavailable or expired"],
    ["delivery_issue", "could not confirm delivery"],
    ["invitation_ready", "Open the secure signing invitation in your email"],
  ]) {
    signingAvailability = availability;
    await evaluate(
      'Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Refresh agreement status").click()',
    );
    await waitFor(
      `document.querySelector("#agreement-status-fixture-application").textContent.includes(${JSON.stringify(expected)})`,
    );
  }
  assert.equal(signingRequests, 0);
  passed++;
  console.log("PASS agreement approval, configuration, delivery and valid invitation messaging");
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
  await command("Page.navigate", { url: origin + "/?guest=1" });
  await waitFor('document.body.innerText.includes("Send verification code")');
  assert.equal(await evaluate('document.body.innerText.includes("No customer signup")'), true);
  await evaluate(
    `(() => { const input=document.querySelector('input[type=email]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"invited@example.invalid"); input.dispatchEvent(new Event("input",{bubbles:true})); })()`,
  );
  await evaluate('document.querySelector("form").requestSubmit()');
  await waitFor('document.querySelector("input[autocomplete=one-time-code]") !== null');
  await evaluate(
    `(() => { const input=document.querySelector('input[autocomplete=one-time-code]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"000000"); input.dispatchEvent(new Event("input",{bubbles:true})); })()`,
  );
  await evaluate('document.querySelector("form").requestSubmit()');
  await waitFor('document.body.innerText.includes("verification code is incorrect")');
  await evaluate(
    `(() => { const input=document.querySelector('input[autocomplete=one-time-code]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"123456"); input.dispatchEvent(new Event("input",{bubbles:true})); })()`,
  );
  await evaluate('document.querySelector("form").requestSubmit()');
  await waitFor('location.pathname === "/partners/contracts"');
  passed++;
  console.log(
    "PASS account-free invitation code, actionable incorrect-code error and agreement navigation",
  );
  for (const width of [1280, 390])
    for (const theme of ["light", "dark"]) {
      await command("Emulation.setDeviceMetricsOverride", {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: width < 500,
      });
      await command("Page.navigate", { url: `${origin}/?portal=1&theme=${theme}` });
      await waitFor('document.querySelector("nav") !== null');
      for (const [section, expected] of [
        ["My Customers", "relationship-fixture"],
        ["Sales", "sale-fixture"],
        ["Commissions", "Commission history"],
        ["My Contracts", "Review your legal identity"],
        ["Referral Links", "Share your referral link"],
        ["Performance", "2026-01"],
        ["Payouts", "Payouts"],
        ["Profile", "Contact profile"],
      ]) {
        await evaluate(
          `Array.from(document.querySelectorAll("nav button")).find(b=>b.textContent === ${JSON.stringify(section)}).click()`,
        );
        await waitFor(`document.body.innerText.includes(${JSON.stringify(expected)})`);
        assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
      }
      passed++;
      console.log(
        `PASS partner portal navigation, scoped projections and responsive ${width}px ${theme} layout`,
      );
    }
  for (const role of ["partner", "company"])
    for (const [width, theme] of [
      [1280, "light"],
      [390, "dark"],
    ]) {
      await command("Emulation.setDeviceMetricsOverride", {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: width < 500,
      });
      await command("Page.navigate", {
        url: `${origin}/?native=1&stale=1&theme=${theme}${role === "company" ? "&company=1" : ""}#token=${"n".repeat(43)}`,
      });
      await waitFor('document.querySelector("input[type=email]") !== null');
      assert.equal(await evaluate('location.hash === ""'), true);
      assert.equal(
        nativeReviewRequests,
        0,
        "a new invitation requires its own email proof before loading a prior browser session",
      );
      await evaluate(
        `(() => { const input=document.querySelector('input[type=email]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"invited@example.invalid"); input.dispatchEvent(new Event("input",{bubbles:true})); })()`,
      );
      await evaluate('document.querySelector("form").requestSubmit()');
      await waitFor('document.querySelector("input[autocomplete=one-time-code]") !== null');
      await evaluate(
        `(() => { const input=document.querySelector('input[autocomplete=one-time-code]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"123456"); input.dispatchEvent(new Event("input",{bubbles:true})); })()`,
      );
      await evaluate('document.querySelector("form").requestSubmit()');
      await waitFor('document.querySelector("article") !== null');
      assert.equal(
        await evaluate(
          'document.querySelector("article").innerText.includes("All synthetic terms are displayed before signing")',
        ),
        true,
      );
      assert.equal(
        await evaluate('document.querySelector("button[type=submit],form button").disabled'),
        true,
      );
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
      await evaluate(
        'document.querySelectorAll("input[type=checkbox]").forEach(input => input.click())',
      );
      await evaluate(
        `(() => { const input=document.querySelector('input[autocomplete=name]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"Fixture Signer"); input.dispatchEvent(new Event("input",{bubbles:true})); })()`,
      );
      await evaluate('document.querySelector("form").requestSubmit()');
      await waitFor('document.body.innerText.includes("Your signing action is recorded")');
      assert.equal(nativeSigned, true);
      const priorReviews = nativeReviewRequests;
      await evaluate(`location.hash = "token=" + "m".repeat(43)`);
      await waitFor('document.querySelector("input[type=email]") !== null');
      assert.equal(await evaluate('location.hash === ""'), true);
      assert.equal(
        nativeReviewRequests,
        priorReviews,
        "same-tab invitation changes require fresh email verification",
      );
      assert.equal(await evaluate('document.querySelector("article") === null'), true);
      passed++;
      console.log(
        `PASS native ${role} email verification, full review, consent, fragment removal and ${width}px ${theme} signing`,
      );
    }
  console.log(`${passed} browser acceptance groups passed.`);
  console.log(
    "Scope: real components and design-system CSS with synthetic HTTP responses. Full application login, attribution navigation, and production hosting are not exercised.",
  );
} finally {
  socket?.close();
  if (chrome) {
    chrome.kill("SIGTERM");
    await chromeClosed;
  }
  if (server.listening) {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
  rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
}
