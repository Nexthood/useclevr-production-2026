import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { buildUsyReply, buildUsyRequestContext, isUsyContextAuthenticated, roleFromAudience } from "@/lib/usy/router"
import type { UsyContext, UsyUsageContext } from "@/lib/usy/types"
import { checkRateLimit, resetRateLimit } from "@/lib/utils/rate-limiter"

const repoRoot = resolve(import.meta.dirname, "../..")

function guestContext(overrides: Partial<UsyContext> = {}): UsyContext {
  return {
    audience: "public",
    role: "public",
    route: "/pricing",
    usage: null,
    isAuthenticated: false,
    ...overrides,
  }
}

function authenticatedContext(overrides: Partial<UsyContext> = {}): UsyContext {
  return {
    audience: "dashboard",
    role: "user",
    route: "/app",
    usage: {
      subscriptionTier: "free",
      availableCredits: 2,
      limitReached: false,
    },
    isAuthenticated: true,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Guest: public product questions succeed without any session
// ---------------------------------------------------------------------------

function testGuestPublicQuestionsSucceed() {
  const whatIsUseClevr = buildUsyReply({ question: "What is UseClevr?", context: guestContext() })
  assert.equal(whatIsUseClevr.source, "knowledge")
  assert.equal(whatIsUseClevr.intent, "product_information")
  assert.match(whatIsUseClevr.answer, /UseClevr/)

  const creditSystem = buildUsyReply({ question: "Explain the credit system", context: guestContext() })
  assert.match(creditSystem.answer, /AI credits control included AI-powered actions/)
  assert.match(creditSystem.answer, /Free 2, Pro 500\/month/, "credit answer derives plan facts from configuration")

  const businessCredits = buildUsyReply({ question: "How many credits does Business include?", context: guestContext() })
  assert.match(businessCredits.answer, /1,500/, "Business includes 1,500 AI credits")
  assert.doesNotMatch(businessCredits.answer, /5,000/, "regression guard: Business no longer advertises 5,000 credits")

  const businessDatasets = buildUsyReply({ question: "How many datasets does Business allow?", context: guestContext() })
  assert.match(businessDatasets.answer, /100/, "Business allows up to 100 datasets")
  assert.doesNotMatch(businessDatasets.answer, /250/, "regression guard: Business no longer allows 250 datasets")

  const pricing = buildUsyReply({ question: "What are your pricing plans?", context: guestContext() })
  assert.match(pricing.answer, /Free includes 2 AI credits/)
  assert.match(pricing.answer, /€40\/month/)
  assert.match(pricing.answer, /€420\/month/)

  const fileFormats = buildUsyReply({ question: "Which file formats are supported?", context: guestContext() })
  assert.match(fileFormats.answer, /\.csv/i)
  assert.match(fileFormats.answer, /\.xlsx/i)

  const proPrice = buildUsyReply({ question: "How much does Pro cost per month?", context: guestContext() })
  assert.match(proPrice.answer, /€40\/month/)

  const sales = buildUsyReply({ question: "I want to talk to Sales", context: guestContext() })
  assert.equal(sales.intent, "contact_request")
}

// ---------------------------------------------------------------------------
// Guest: private account questions get a deterministic sign-in requirement
// ---------------------------------------------------------------------------

function testGuestPersonalQuestionsRequireSignIn() {
  const personalQuestions = [
    "How many credits do I have?",
    "What is my subscription?",
    "Show my datasets",
    "Why did my payment fail?",
    "Show my invoices",
    "What is my current plan?",
    "Show my billing history",
  ]

  for (const question of personalQuestions) {
    const reply = buildUsyReply({ question, context: guestContext() })
    assert.equal(reply.source, "knowledge", `${question}: answered as knowledge, not an auth error`)
    assert.match(reply.answer, /Please sign in to access information about your account/, `${question}: asks the visitor to sign in`)
    assert.doesNotMatch(reply.answer, /expired/i, `${question}: never framed as a session failure`)
  }
}

function testGuestPersonalQuestionsStayLocalized() {
  const german = buildUsyReply({ question: "Zeige mir meine Rechnungen", context: guestContext() })
  assert.equal(german.language, "german")
  assert.match(german.answer, /Bitte melde dich an/)

  const spanish = buildUsyReply({ question: "Mis facturas, ¿dónde están?", context: guestContext() })
  assert.equal(spanish.language, "spanish")
  assert.match(spanish.answer, /Inicia sesión/)

  const romanian = buildUsyReply({ question: "Câte credite am?", context: guestContext() })
  assert.equal(romanian.language, "romanian")
  assert.match(romanian.answer, /Autentifică-te/)

  const hungarian = buildUsyReply({ question: "Hol vannak a számláim?", context: guestContext() })
  assert.equal(hungarian.language, "hungarian")
  assert.match(hungarian.answer, /Jelentkezz be/)

  const dutch = buildUsyReply({ question: "Waar kan ik mijn factuur zien?", context: guestContext() })
  assert.equal(dutch.language, "dutch")
  assert.match(dutch.answer, /Log in om informatie over je account te zien/)
}

function testGuestNeverReceivesPrivateUsageData() {
  // Even if a malicious client sends account-shaped usage data, the guest
  // request context must strip it before any answer is built.
  const forgedUsage: UsyContext["usage"] = {
    subscriptionTier: "business",
    availableCredits: 777,
    purchasedBalance: 555,
    limitReached: false,
  }
  const context = buildUsyRequestContext({
    audience: "dashboard",
    role: "public",
    route: "/app/billing",
    isAuthenticated: false,
    clientPlan: "business",
    clientUsage: forgedUsage,
  })
  assert.equal(context.usage, null, "guest request context drops client usage")
  assert.equal(context.plan, undefined, "guest request context drops client plan")
  assert.equal(context.isAuthenticated, false)

  const credits = buildUsyReply({ question: "How many credits do I have?", context })
  assert.match(credits.answer, /Please sign in to access information about your account/)
  assert.doesNotMatch(credits.answer, /777|555/, "no forged credit balance leaks into the guest answer")

  const planQuestion = buildUsyReply({ question: "What is my subscription?", context })
  assert.doesNotMatch(planQuestion.answer, /Business/, "no forged subscription tier leaks into the guest answer")
}

// ---------------------------------------------------------------------------
// Authenticated: existing account-aware behavior is preserved
// ---------------------------------------------------------------------------

function testAuthenticatedPathPreserved() {
  const context = authenticatedContext()
  const credits = buildUsyReply({ question: "Explain AI credits", context })
  assert.match(credits.answer, /2 credits available/, "authenticated usage context reaches the credit answer")
  assert.doesNotMatch(credits.answer, /Please sign in/, "authenticated personal questions are answered, not blocked")

  const requestContext = buildUsyRequestContext({
    audience: "dashboard",
    role: "user",
    route: "/app",
    isAuthenticated: true,
    clientPlan: "pro",
    clientUsage: { subscriptionTier: "pro", availableCredits: 480 },
  })
  assert.equal(requestContext.plan, "pro", "authenticated request context keeps the plan")
  assert.deepEqual(requestContext.usage, { subscriptionTier: "pro", availableCredits: 480 }, "authenticated request context keeps usage")
  assert.equal(requestContext.isAuthenticated, true)

  const proCredits = buildUsyReply({ question: "Explain AI credits", context: requestContext })
  assert.match(proCredits.answer, /480 credits available/)
}

function testIdentityComesOnlyFromServerSession() {
  // Anonymous visitors can never elevate their role by claiming an audience.
  assert.equal(roleFromAudience("superadmin", null), "public", "anonymous superadmin audience claim stays public")
  assert.equal(roleFromAudience("dashboard", null), "public", "anonymous dashboard audience claim stays public")
  assert.equal(roleFromAudience("public", null), "public")
  assert.equal(roleFromAudience("dashboard", "user"), "user")
  assert.equal(roleFromAudience("superadmin", "admin"), "admin", "audience cannot elevate an admin to superadmin")
  assert.equal(roleFromAudience("superadmin", "superadmin"), "superadmin")
  assert.equal(roleFromAudience("public", "admin"), "admin", "verified session role wins over public audience")

  assert.equal(isUsyContextAuthenticated(guestContext()), false)
  assert.equal(isUsyContextAuthenticated(authenticatedContext()), true)
  assert.equal(isUsyContextAuthenticated({ audience: "dashboard", role: "user", route: "/app" }), true, "role falls back for legacy contexts without the flag")
  assert.equal(isUsyContextAuthenticated({ audience: "public", role: "public", route: "/" }), false)
}

// ---------------------------------------------------------------------------
// Security: proxy allowlist + guest rate limiting
// ---------------------------------------------------------------------------

function testProxyAllowsUsyGuestEndpointsOnly() {
  const proxySource = readProjectFile("src/proxy.ts")
  assert.ok(proxySource.includes('"/api/usy/chat"'), "proxy allowlists the Usy chat endpoint for guests")
  assert.ok(proxySource.includes('"/api/usy/contact"'), "proxy allowlists the Usy contact handoff for guests")
  assert.ok(!proxySource.includes('"/api/usy"'), "proxy does not allowlist the whole /api/usy prefix")
  assert.ok(!proxySource.includes('"/api/datasets"'), "protected dataset APIs stay behind auth")
  assert.ok(!proxySource.includes('"/api/usage"'), "protected usage APIs stay behind auth")
  assert.ok(!proxySource.includes('"/api/upload"'), "protected upload APIs stay behind auth")
}

function testGuestRateLimitingWorks() {
  resetRateLimit("usy-guest-test:ip:203.0.113.7")
  for (let index = 0; index < 30; index += 1) {
    assert.equal(checkRateLimit("usy-guest-test:ip:203.0.113.7", 30, 60_000), true, `request ${index + 1} passes`)
  }
  assert.equal(checkRateLimit("usy-guest-test:ip:203.0.113.7", 30, 60_000), false, "31st guest request in the window is blocked")
  assert.equal(checkRateLimit("usy-guest-test:ip:203.0.113.8", 30, 60_000), true, "another guest IP is unaffected")

  const routeSource = readProjectFile("src/app/api/usy/chat/route.ts")
  assert.ok(routeSource.includes("checkRateLimit"), "Usy chat route enforces the rate limit")
  assert.ok(routeSource.includes("`ip:${ip}`"), "guest requests are rate limited per IP")
  assert.ok(routeSource.includes("buildUsyRequestContext"), "Usy chat route builds the request context at the boundary")
  assert.ok(routeSource.includes("isAuthenticated"), "Usy chat route distinguishes guest and authenticated modes")
}

function testRouteStripsAccountDataForGuests() {
  const routerSource = readProjectFile("src/lib/usy/router.ts")
  assert.ok(
    routerSource.includes("plan: input.isAuthenticated ? input.clientPlan || input.clientUsage?.subscriptionTier : undefined"),
    "guest request context drops the client plan",
  )
  assert.ok(
    routerSource.includes("usage: input.isAuthenticated ? input.clientUsage ?? null : null"),
    "guest request context drops the client usage",
  )
}

testGuestPublicQuestionsSucceed()
testGuestPersonalQuestionsRequireSignIn()
testGuestPersonalQuestionsStayLocalized()
testGuestNeverReceivesPrivateUsageData()
testAuthenticatedPathPreserved()
testIdentityComesOnlyFromServerSession()
testProxyAllowsUsyGuestEndpointsOnly()
testGuestRateLimitingWorks()
testRouteStripsAccountDataForGuests()

console.warn("Usy guest mode tests passed")

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8")
}
