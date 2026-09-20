import assert from "node:assert/strict"

import {
  buildUsyBillingOverviewAnswer,
  buildUsyCancellationAnswer,
  buildUsyDowngradeAnswer,
  buildUsyPurchasedRulesAnswer,
  buildUsyRefundAnswer,
  buildUsyTopUpAnswer,
  buildUsyZeroCreditsAnswer,
  resolveUsyBillingState,
} from "@/lib/usy/billing-knowledge"
import { buildUsyReply } from "@/lib/usy/router"
import type { SupportedUsyLanguage, UsyContext, UsyUsageContext } from "@/lib/usy/types"

function contextFor(tier: string | null, overrides: Partial<UsyContext["usage"]> = {}): UsyContext {
  return {
    audience: "dashboard",
    role: "user",
    route: "/app",
    plan: tier ?? undefined,
    usage: tier === null
      ? null
      : {
          subscriptionTier: tier,
          analysisCount: 63,
          total: 600,
          limitReached: false,
          ...overrides,
        },
  }
}

const languages: SupportedUsyLanguage[] = ["english", "german", "dutch", "spanish", "hungarian", "romanian"]

function testFreeCannotPurchaseTopUps() {
  for (const language of languages) {
    const answer = buildUsyTopUpAnswer(contextFor("free").usage, language)
    assert.match(answer, /Pro|Business/, `${language}: Free top-up answer names the paid plans`)
  }
  const reply = buildUsyReply({
    question: "Can I buy credit top-ups on Free?",
    context: contextFor("free"),
  })
  assert.equal(reply.intent, "account_help")
  assert.match(reply.answer, /Pro and Business plans only|Pro and Business/i)
  assert.doesNotMatch(reply.answer, /you can purchase|buy them on Free/i)
}

function testProAndBusinessCanPurchaseTopUps() {
  for (const tier of ["pro", "business"]) {
    const state = resolveUsyBillingState(contextFor(tier).usage)
    assert.equal(state.canPurchaseTopUps, true, `${tier} can purchase top-ups`)
    for (const language of languages) {
      const answer = buildUsyTopUpAnswer(contextFor(tier).usage, language)
      assert.match(answer, /Add Credits|credits aan te kopen|Credits kaufen|Add Credits|Add Credits|Add Credits/, `${language}: paid answer names Add Credits`)
    }
  }
  const reply = buildUsyReply({
    question: "Can I buy more credits on Pro?",
    context: contextFor("pro"),
  })
  assert.equal(reply.intent, "account_help")
  assert.match(reply.answer, /Add Credits|billing/i)
}

function testPurchasedCreditsNeverExpire() {
  for (const language of languages) {
    const rules = buildUsyPurchasedRulesAnswer(language)
    assert.match(
      rules,
      /do not expire|verfallen nicht|vervallen niet|no caducan|nem járnak le|nu expiră/,
      `${language}: purchased credits never expire`,
    )
  }
}

function testPurchasedCreditsSurviveDowngrade() {
  for (const language of languages) {
    const answer = buildUsyDowngradeAnswer(contextFor("free").usage, language)
    assert.match(
      answer,
      /preserved|erhalten|bewaard|conservan|megmaradnak|păstrează/,
      `${language}: purchased credits survive a downgrade`,
    )
    assert.match(
      answer,
      /until|bis|tot|hasta|amíg|până/,
      `${language}: purchased credits remain usable until exhausted`,
    )
  }
  const reply = buildUsyReply({
    question: "What happens to my purchased credits after I am downgraded to Free?",
    context: contextFor("free"),
  })
  assert.equal(reply.intent, "account_help")
  assert.match(reply.answer, /preserved/i)
  assert.match(reply.answer, /cannot purchase credit top-ups/i)
}

function testIncludedBeforePurchased() {
  for (const language of languages) {
    const rules = buildUsyPurchasedRulesAnswer(language)
    assert.match(
      rules,
      /Included credits are consumed before purchased credits|Enthaltene Credits werden vor gekauften|Inbegrepen credits worden vóór|Los créditos incluidos se consumen antes|Az inkluzív kreditek a megvásároltak előtt|Creditele incluse sunt consumate înaintea/,
      `${language}: included credits are consumed before purchased credits`,
    )
  }
}

function testCancellationKeepsPaidPlanUntilPeriodEnd() {
  for (const language of languages) {
    const answer = buildUsyCancellationAnswer(contextFor("pro").usage, language)
    assert.match(
      answer,
      /end of the already-paid billing period|bereits bezahlten Abrechnungsperiode|reeds betaalde factuurperiode|periodo ya pagado|már kifizetett számlázási időszak|perioadei deja plătite/,
      `${language}: cancellation keeps the paid plan until period end`,
    )
    assert.match(
      answer,
      /different operations|unterschiedliche Vorgänge|verschillende handelingen|operaciones distintas|különböző műveletek|operațiuni diferite/,
      `${language}: cancellation and refund are distinct operations`,
    )
  }
}

function testRefundAnswersNeverPromiseApproval() {
  for (const language of languages) {
    const answer = buildUsyRefundAnswer(contextFor("pro").usage, language)
    assert.doesNotMatch(
      answer,
      /has been approved|is approved|will be refunded|was approved|wurde genehmigt|wurde erstattet|fue aprobado|a fost aprobată|jóváhagyva|goedgekeurd/i,
      `${language}: refund answers must never claim an approved refund`,
    )
    assert.match(
      answer,
      /reviewed centrally|zentral von UseClevr geprüft|centraal door UseClevr beoordeeld|las revisa centralmente|központilag a UseClevr bírálja|analizate central de UseClevr/,
      `${language}: refund requests are reviewed centrally by UseClevr`,
    )
    assert.match(
      answer,
      /different operations|unterschiedliche Vorgänge|verschillende handelingen|operaciones distintas|különböző műveletek|operațiuni diferite/,
      `${language}: cancellation and refund are distinct operations`,
    )
  }
  const reply = buildUsyReply({
    question: "I want a refund for my last payment.",
    context: contextFor("pro"),
  })
  assert.equal(reply.intent, "billing")
  assert.match(reply.answer, /never promise|not self-service/i)
  assert.doesNotMatch(reply.answer, /your refund has been approved/i)
}

function testZeroCreditsGuidanceIsTierAware() {
  // Free: upgrade guidance, top-ups only after upgrading.
  const freeZero = buildUsyZeroCreditsAnswer(contextFor("free", { limitReached: true }).usage, "english")
  assert.match(freeZero, /Upgrade to Pro or Business/i)
  assert.match(freeZero, /after the upgrade|can be purchased on those plans/i)

  // Pro/Business: Add Credits guidance.
  const paidZero = buildUsyZeroCreditsAnswer(contextFor("pro", { limitReached: true }).usage, "english")
  assert.match(paidZero, /Add Credits/i)

  for (const tier of ["pro", "business"]) {
    const answer = buildUsyZeroCreditsAnswer(contextFor(tier, { limitReached: true }).usage, "english")
    assert.match(answer, /Add Credits/i)
  }

  // The router surfaces the tier-aware guidance for exhausted upload credits.
  const freeReply = buildUsyReply({
    question: "I ran out of upload credits and need to upload.",
    context: contextFor("free", { limitReached: true, analysisCount: 2, total: 2 }),
  })
  assert.match(freeReply.answer, /Upgrade to Pro or Business/i)

  const paidReply = buildUsyReply({
    question: "I ran out of upload credits and need to upload.",
    context: contextFor("pro", { limitReached: true, analysisCount: 500, total: 500 }),
  })
  assert.match(paidReply.answer, /Add Credits/i)
}

function testOverviewUsesActualStateAndNeverInvents() {
  // Free overview states the purchase restriction; paid overview states purchase availability.
  const freeOverview = buildUsyBillingOverviewAnswer(contextFor("free").usage, "english")
  assert.match(freeOverview, /cannot purchase credit top-ups/i)
  const paidOverview = buildUsyBillingOverviewAnswer(contextFor("business").usage, "english")
  assert.match(paidOverview, /purchase additional credit top-ups/i)

  // Unknown state: no invented balances or statuses.
  const unknownOverview = buildUsyBillingOverviewAnswer(null, "english")
  assert.match(unknownOverview, /cannot see your live plan or credit state/i)
  assert.doesNotMatch(unknownOverview, /\d+ credits/i)

  const unknownReply = buildUsyReply({
    question: "How many credits do I have left?",
    context: contextFor(null),
  })
  assert.doesNotMatch(unknownReply.answer, /\d+\/\d+|\d+ credits left|balance is \d+/i)
}

function testConsistencyAcrossLanguages() {
  // The same deterministic billing state produces equivalent rule content in
  // every supported language: top-up gating, purchased preservation, and
  // included-before-purchased ordering.
  for (const language of languages) {
    const freeTopUp = buildUsyTopUpAnswer(contextFor("free").usage, language)
    const paidTopUp = buildUsyTopUpAnswer(contextFor("business").usage, language)
    assert.notEqual(freeTopUp, paidTopUp, `${language}: Free and paid top-up answers differ`)
    assert.match(freeTopUp, /Pro/, `${language}: Free top-up answer names Pro`)
    assert.match(paidTopUp, /Add Credits/i, `${language}: paid top-up answer names Add Credits`)

    const downgrade = buildUsyDowngradeAnswer(contextFor("free").usage, language)
    assert.match(downgrade, /do not expire|verfallen nicht|verlopen niet|no expiran|nem járnak le|nu expiră/, `${language}: purchased credits do not expire`)
    assert.match(downgrade, /Pro or Business|Pro oder Business|Pro of Business|Pro o Business|Pro vagy Business|Pro sau Business/, `${language}: purchasing requires Pro/Business`)

    const cancellation = buildUsyCancellationAnswer(contextFor("pro").usage, language)
    assert.match(cancellation, /different|unterschiedliche|verschillende|distintas|különböző|diferite/, `${language}: cancellation ≠ refund`)
  }
}

function testBusinessPlanCreditsAnswer() {
  const reply = buildUsyReply({
    question: "How many credits does Business include?",
    context: contextFor("pro"),
  })
  assert.match(reply.answer, /Business/)
  assert.match(reply.answer, /1,500/, "Business must answer with 1,500 AI credits")
  assert.doesNotMatch(reply.answer, /5,000|5000|5\.000/)
}

function testBusinessPlanDatasetsAnswer() {
  const reply = buildUsyReply({
    question: "How many datasets can I have on Business?",
    context: contextFor("pro"),
  })
  assert.match(reply.answer, /Business is €420\/month with 1,500 AI credits, up to 100 datasets/)
  assert.match(reply.answer, /up to 100 datasets/)
  assert.match(reply.answer, /Business is €420\/month with 1,500 AI credits/)
  assert.doesNotMatch(reply.answer, /250 datasets|250 Datasets|up to 250/i)
}

function testProPlanCreditsAnswer() {
  const reply = buildUsyReply({
    question: "How many credits does Pro include?",
    context: contextFor("free"),
  })
  assert.match(reply.answer, /Pro is €40\/month with 500 AI credits and up to 25 datasets/)
  assert.doesNotMatch(reply.answer, /5,000|5000/)
}

function testGermanBusinessPlanAnswer() {
  const reply = buildUsyReply({
    question: "Was enthält der Business Plan?",
    context: contextFor("free"),
  })
  assert.equal(reply.intent, "billing")
  assert.equal(reply.language, "german")
  assert.match(reply.answer, /Business kostet €420\/Monat/)
  assert.match(reply.answer, /1\.500 AI-Credits/)
  assert.match(reply.answer, /bis zu 100 Datasets/)
  assert.doesNotMatch(reply.answer, /5\.000|5000|250 Datasets/)
}

function testPlanComparisonAnswer() {
  const reply = buildUsyReply({
    question: "Compare Free vs Pro vs Business credits and datasets.",
    context: contextFor("free"),
  })
  assert.equal(reply.intent, "billing")
  assert.match(reply.answer, /Free includes 2 AI credits and up to 2 datasets/)
  assert.match(reply.answer, /Pro is €40\/month with 500 AI credits and up to 25 datasets/)
  assert.match(reply.answer, /Business is €420\/month with 1,500 AI credits, up to 100 datasets/)
}

function testNoStaleBusinessNumbersAcrossLanguages() {
  const questions = [
    "How many credits does Business include?",
    "How many datasets can I have on Business?",
    "Was enthält der Business Plan?",
    "¿Cuántos créditos incluye Business?",
    "Câte credite include Business?",
    "Hány kreditet tartalmaz a Business?",
    "Hoeveel credits bevat Business?",
    "Compare Free vs Pro vs Business",
  ]
  for (const question of questions) {
    const reply = buildUsyReply({
      question,
      context: contextFor("pro"),
    })
    assert.doesNotMatch(
      reply.answer,
      /5,000|5000|5\.000|up to 250|250 Datasets|250 datasets|250 datensets|250 datsets/i,
      `${question} must not answer with stale Business numbers`,
    )
    assert.match(reply.answer, /1,?500|1\.500/, `${question} must surface the 1,500 Business credits`)
  }
}

const tests = [
  { name: "Free accounts cannot purchase top-ups; Usy explains the paid-plan gating", fn: testFreeCannotPurchaseTopUps },
  { name: "Pro and Business accounts can purchase additional credits via Add Credits", fn: testProAndBusinessCanPurchaseTopUps },
  { name: "Purchased credits never expire", fn: testPurchasedCreditsNeverExpire },
  { name: "Purchased credits survive a downgrade and cannot be repurchased on Free", fn: testPurchasedCreditsSurviveDowngrade },
  { name: "Included credits are consumed before purchased credits", fn: testIncludedBeforePurchased },
  { name: "Normal cancellation keeps the paid plan until the paid period ends", fn: testCancellationKeepsPaidPlanUntilPeriodEnd },
  { name: "Refund answers are central-handling only and never promise approval", fn: testRefundAnswersNeverPromiseApproval },
  { name: "Zero-credit guidance is tier-aware: Free upgrades, paid uses Add Credits", fn: testZeroCreditsGuidanceIsTierAware },
  { name: "Overview answers use the actual state and never invent balances", fn: testOverviewUsesActualStateAndNeverInvents },
  { name: "Business plan answers use 1,500 credits and 100 datasets", fn: testBusinessPlanCreditsAnswer },
  { name: "Business dataset limits answer with 100 datasets", fn: testBusinessPlanDatasetsAnswer },
  { name: "Pro plan answers with 500 credits and 25 datasets", fn: testProPlanCreditsAnswer },
  { name: "German Business plan answer includes 1,500 credits and 100 datasets", fn: testGermanBusinessPlanAnswer },
  { name: "Plan comparison answers include all three plans with the new limits", fn: testPlanComparisonAnswer },
  { name: "No business/plan answer across languages states 5,000 credits or 250 datasets", fn: testNoStaleBusinessNumbersAcrossLanguages },
  { name: "Answers stay deterministic and consistent across EN, DE, NL, ES, HU, RO", fn: testConsistencyAcrossLanguages },
]

void (async () => {
  let failures = 0
  for (const test of tests) {
    try {
      await test.fn()
      console.log(`ok - ${test.name}`)
    } catch (error) {
      failures += 1
      console.error(`FAIL - ${test.name}`)
      console.error(error instanceof Error ? error.message : error)
    }
  }
  console.log("")
  console.log(failures === 0 ? `All ${tests.length} Usy billing knowledge tests passed.` : `${failures} test(s) failed.`)
  if (failures > 0) process.exitCode = 1
})()
