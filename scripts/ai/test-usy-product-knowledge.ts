import assert from "node:assert/strict"

import {
  buildUsyBillingOverviewAnswer,
  buildUsyRefundAnswer,
  buildUsySubscriptionStatusAnswer,
} from "@/lib/usy/billing-knowledge"
import {
  getPlanSummary,
  usyCreditCostFacts,
  usyDatasetIsolationFacts,
} from "@/lib/usy/knowledge-base"
import { buildUsyReply, buildUsyRequestContext } from "@/lib/usy/router"
import type { SupportedUsyLanguage, UsyContext, UsyUsageContext } from "@/lib/usy/types"

const languages: SupportedUsyLanguage[] = ["english", "german", "dutch", "spanish", "hungarian", "romanian"]

function contextFor(
  tier: string | null,
  overrides: Partial<UsyContext> = {},
  usageOverrides: Partial<UsyUsageContext> = {},
): UsyContext {
  return {
    audience: "dashboard",
    role: "user",
    route: "/app",
    isAuthenticated: true,
    plan: tier ?? undefined,
    usage: tier === null
      ? null
      : {
          subscriptionTier: tier,
          limitReached: false,
          ...usageOverrides,
        },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 1. ClevrSync access
// ---------------------------------------------------------------------------

function testFreeUserNeverToldClevrSyncIsAvailable() {
  const reply = buildUsyReply({
    question: "Is ClevrSync included in my plan?",
    context: contextFor("free"),
  })
  assert.equal(reply.intent, "getting_started")
  assert.match(reply.answer, /ClevrSync is not available on Free\./)
  assert.match(reply.answer, /Excel and CSV files can still be uploaded through the normal UseClevr upload flow/)
  assert.doesNotMatch(reply.answer, /ClevrSync is enabled/i)
  assert.doesNotMatch(reply.answer, /Available connector/i, "Free users never receive the available-connector list as an offer")
}

function testProAndBusinessClevrSyncEnabled() {
  for (const tier of ["pro", "business"] as const) {
    const reply = buildUsyReply({
      question: "Is ClevrSync included in my plan?",
      context: contextFor(tier),
    })
    assert.match(reply.answer, tier === "pro" ? /ClevrSync is enabled on Pro\./ : /ClevrSync is enabled on Business\./)
    assert.match(reply.answer, /Available connectors: Google Sheets\./)
  }
}

function testSuperadminClevrSyncIndependentOfSubscription() {
  const unlimitedUsage = buildUsyReply({
    question: "Is ClevrSync included in my plan?",
    context: contextFor("free", {}, { unlimited: true, unlimitedLabel: "Super admin" }),
  })
  assert.match(unlimitedUsage.answer, /regardless of subscription/)
  assert.match(unlimitedUsage.answer, /Available connectors: Google Sheets\./)

  const superadminRole = buildUsyReply({
    question: "Is ClevrSync included in my plan?",
    context: contextFor(null, { role: "superadmin", audience: "superadmin" }, { subscriptionTier: "free" }),
  })
  assert.match(superadminRole.answer, /regardless of subscription/)
}

// ---------------------------------------------------------------------------
// 2. ClevrSync connectors
// ---------------------------------------------------------------------------

function testConnectorsListGoogleSheetsAvailable() {
  const reply = buildUsyReply({
    question: "Which ClevrSync connectors can I use?",
    context: contextFor("pro"),
  })
  assert.match(reply.answer, /Available connectors: Google Sheets\./)
  assert.doesNotMatch(reply.answer, /coming soon/i)
  assert.match(
    reply.answer,
    /OneDrive and SharePoint are not part of the product\./,
    "OneDrive and SharePoint are stated as not part of the product",
  )
  assert.doesNotMatch(
    reply.answer,
    /Available connectors: [^.]*OneDrive|Available connectors: [^.]*SharePoint/i,
    "OneDrive and SharePoint never appear in the available-connector list",
  )
  assert.doesNotMatch(reply.answer, /Microsoft/i, "Microsoft-specific capabilities are never mentioned")
  assert.match(
    reply.answer,
    /Excel and CSV files can be uploaded directly through UseClevr\. ClevrSync is used for connecting external data sources such as Google Sheets\./,
  )
  assert.doesNotMatch(reply.answer, /Excel connector|connect Excel through ClevrSync/i)
  assert.match(
    reply.answer,
    /ClevrSync discovery and preview do not consume analysis credits/,
    "all connectors keep discovery and preview credit-free",
  )
}

function testExcelIsNotAClevrSyncConnector() {
  const reply = buildUsyReply({
    question: "Is Excel a ClevrSync connector?",
    context: contextFor("pro"),
  })
  assert.equal(reply.intent, "getting_started")
  assert.match(reply.answer, /Excel and CSV files can be uploaded directly through UseClevr/)
  assert.match(reply.answer, /ClevrSync is used for connecting external data sources such as Google Sheets/)
  assert.doesNotMatch(reply.answer, /connects external data sources like Google Sheets and Excel/i)
}

// ---------------------------------------------------------------------------
// Required connector questions: final product state
// ---------------------------------------------------------------------------

function testRequiredConnectorQuestionsReturnFinalProductState() {
  const notPartOfProduct = /OneDrive and SharePoint are not part of the product\./
  const microsoftBan = /Microsoft Graph|Microsoft OAuth|Microsoft account|connect your Microsoft|connect a Microsoft/i

  // "What connectors do you support?" routes to ClevrSync knowledge.
  const connectors = buildUsyReply({
    question: "What connectors do you support?",
    context: contextFor("pro"),
  })
  assert.equal(connectors.intent, "getting_started", "connector questions route to ClevrSync knowledge")
  assert.match(connectors.answer, /Available connectors: Google Sheets\./)
  assert.match(connectors.answer, notPartOfProduct)
  assert.doesNotMatch(connectors.answer, /coming soon/i)
  assert.doesNotMatch(connectors.answer, /Microsoft/i, "Microsoft is never mentioned")
  assert.doesNotMatch(connectors.answer, /Available connectors: [^.]*OneDrive|Available connectors: [^.]*SharePoint/i)

  // "Can I connect OneDrive?" / "Can I connect SharePoint?" state the product boundary.
  for (const question of ["Can I connect OneDrive?", "Can I connect SharePoint?"]) {
    const reply = buildUsyReply({ question, context: contextFor("pro") })
    assert.equal(reply.intent, "getting_started", `${question} routes to ClevrSync knowledge instead of the contact flow`)
    assert.match(reply.answer, notPartOfProduct)
    assert.match(reply.answer, /Available connectors: Google Sheets\./)
    assert.doesNotMatch(reply.answer, /coming soon/i)
    assert.doesNotMatch(reply.answer, microsoftBan, `${question} never suggests a Microsoft connection`)
    assert.doesNotMatch(reply.answer, /Available connectors: [^.]*OneDrive|Available connectors: [^.]*SharePoint/i)

    const freeReply = buildUsyReply({ question, context: contextFor("free") })
    assert.match(freeReply.answer, /ClevrSync is not available on Free\./)
    assert.match(freeReply.answer, notPartOfProduct)
    assert.doesNotMatch(freeReply.answer, /Available connectors/i, "Free users never receive the available-connector list as an offer")
  }

  // "Can I upload Excel?" points at the normal upload flow, not a connector.
  const excel = buildUsyReply({ question: "Can I upload Excel?", context: contextFor("free") })
  assert.equal(excel.intent, "getting_started", "Excel upload questions route to upload knowledge")
  assert.match(excel.answer, /UseClevr accepts/)
  assert.match(excel.answer, /\.xlsx/)
  assert.doesNotMatch(excel.answer, /ClevrSync is enabled|connector/i)
  assert.doesNotMatch(excel.answer, /OneDrive|SharePoint|Microsoft/i)
  assert.doesNotMatch(excel.answer, /upload blocked|cannot be processed/i, "Excel upload questions never route to upload troubleshooting")

  // "Can I connect Google Sheets?" follows the plan entitlement.
  const sheetsFree = buildUsyReply({ question: "Can I connect Google Sheets?", context: contextFor("free") })
  assert.equal(sheetsFree.intent, "getting_started")
  assert.match(sheetsFree.answer, /ClevrSync is not available on Free\./)
  assert.doesNotMatch(sheetsFree.answer, /Available connectors/i)

  const sheetsPro = buildUsyReply({ question: "Can I connect Google Sheets?", context: contextFor("pro") })
  assert.equal(sheetsPro.intent, "getting_started")
  assert.match(sheetsPro.answer, /ClevrSync is enabled on Pro\./)
  assert.match(sheetsPro.answer, /Available connectors: Google Sheets\./)
  assert.match(sheetsPro.answer, /Connect Google → Select spreadsheet → Select worksheet → Preview → Connect & Analyze/)
  assert.doesNotMatch(sheetsPro.answer, microsoftBan)
}

// ---------------------------------------------------------------------------
// 3. Google Sheets flow
// ---------------------------------------------------------------------------

function testGoogleSheetsFlowSteps() {
  const reply = buildUsyReply({
    question: "How does the Google Sheets connection work?",
    context: contextFor("pro"),
  })
  assert.match(
    reply.answer,
    /Connect Google → Select spreadsheet → Select worksheet → Preview → Connect & Analyze → UseClevr creates or updates the dataset → Analysis opens for the selected dataset/,
  )
  assert.match(reply.answer, /Manual Google Sheet URL entry is only a fallback/)
  assert.match(reply.answer, /discovery and preview do not consume analysis credits/i)
}

// ---------------------------------------------------------------------------
// 4. Dataset isolation
// ---------------------------------------------------------------------------

function testReportsUseSelectedDatasetOnly() {
  const reply = buildUsyReply({
    question: "What does a UseClevr report include?",
    context: contextFor("pro"),
  })
  assert.equal(reply.intent, "product_information")
  assert.match(reply.answer, new RegExp(usyDatasetIsolationFacts.selectedDatasetOnly, "i"))
  assert.match(reply.answer, new RegExp(usyDatasetIsolationFacts.noCrossDatasetAggregation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
  assert.match(reply.answer, /never automatically aggregated across all datasets/i)
}

function testDashboardMetricsDoNotAggregateAcrossDatasets() {
  const reply = buildUsyReply({
    question: "Explain my dashboard metrics",
    context: contextFor("pro"),
  })
  assert.equal(reply.intent, "getting_started")
  assert.match(reply.answer, /selected dataset only/i)
  assert.match(reply.answer, /does not automatically aggregate all datasets when a specific dataset is selected/i)
}

function testDatasetQuestionsRouteToAiAssistant() {
  const reply = buildUsyReply({
    question: "Why is my revenue down this quarter?",
    context: contextFor("pro"),
  })
  assert.equal(reply.intent, "ai_analysis_request")
  assert.match(reply.answer, /needs the AI Assistant/i)
  assert.ok(reply.followUps.includes("Open AI Assistant"))
}

// ---------------------------------------------------------------------------
// 5. Report knowledge
// ---------------------------------------------------------------------------

function testReportSectionsAndMissingDataDisclosure() {
  const reply = buildUsyReply({
    question: "What is included in a UseClevr report?",
    context: contextFor("pro"),
  })
  assert.equal(reply.intent, "product_information")
  for (const section of [
    "Executive Summary",
    "AOV",
    "COGS",
    "Gross Profit",
    "Gross Margin",
    "Business Balanced Scorecard",
    "Recommendations",
    "Data confidence",
    "Provenance",
    "Results Summary",
    "Missing-data disclosure",
  ]) {
    assert.ok(reply.answer.includes(section), `report answer lists ${section}`)
  }
  assert.match(reply.answer, /Metrics are only presented when the dataset supports them\./)
  assert.match(
    reply.answer,
    /Missing information stays explicitly unavailable instead of being invented; for example, Return Rate is marked unavailable/,
  )
}

function testReportCreditCosts() {
  const reply = buildUsyReply({
    question: "Do reports cost credits to download?",
    context: contextFor("pro"),
  })
  assert.match(reply.answer, /Generating or regenerating a report costs 3 credits/)
  assert.match(reply.answer, /downloading an already-generated report costs 0 credits/)
}

// ---------------------------------------------------------------------------
// 6. Retail profitability semantics
// ---------------------------------------------------------------------------

function testRetailProfitabilityMappingWithoutExampleValues() {
  const reply = buildUsyReply({
    question: "How do revenue, cost, and profit map in retail profitability?",
    context: contextFor("pro"),
  })
  assert.equal(reply.intent, "product_information")
  assert.match(reply.answer, /revenue maps to the source revenue field\./i)
  assert.match(reply.answer, /Cost maps to COGS when valid retail-sales semantics are established\./)
  assert.match(reply.answer, /Profit maps to Gross Profit when valid retail-sales semantics are established\./)
  assert.match(reply.answer, /Gross Margin is derived from valid Revenue\/COGS\/Profit inputs\./)
  assert.doesNotMatch(reply.answer, /99\.2K|55\.7K|43\.5K|43\.9%/, "no example dataset values leak into product knowledge")
}

// ---------------------------------------------------------------------------
// 7. Subscription knowledge
// ---------------------------------------------------------------------------

function testRefundedInvoiceDoesNotCancelSubscription() {
  const reply = buildUsyReply({
    question: "My invoice was refunded. Is my subscription still active?",
    context: contextFor("pro"),
  })
  assert.equal(reply.intent, "billing")
  assert.match(reply.answer, /a refunded subscription invoice does not automatically cancel the subscription/i)
  assert.match(reply.answer, /you remain Pro or Business until it actually terminates/i)
  assert.doesNotMatch(reply.answer, /has been approved|will be refunded|was approved/i)

  const refund = buildUsyRefundAnswer(contextFor("pro").usage, "english")
  assert.match(refund, /a refunded subscription invoice does not automatically cancel the subscription/i)
  assert.match(refund, /your purchased credits are preserved/i)
}

function testSubscriptionStatusDistinguishesTheFourConcepts() {
  const answer = buildUsySubscriptionStatusAnswer(contextFor("pro").usage, "english")
  assert.match(answer, /Subscription status and invoice\/payment status are separate/)
  assert.match(answer, /Included plan credits and purchased\/top-up credits are tracked separately/)
  assert.match(answer, /included credits consumed before purchased credits/i)
  assert.match(answer, /does not automatically cancel the subscription/)
  assert.match(answer, /never invent billing events/i)

  for (const language of languages) {
    const localized = buildUsySubscriptionStatusAnswer(contextFor("pro").usage, language)
    assert.match(localized, /Pro/, `${language}: subscription-status answer names Pro`)
    assert.match(localized, /Business/, `${language}: subscription-status answer names Business`)
  }
}

function testRefundAnswersPreservePurchasedCreditsRule() {
  for (const language of languages) {
    const answer = buildUsyRefundAnswer(contextFor("pro").usage, language)
    assert.doesNotMatch(
      answer,
      /removes? purchased credits|elimina los créditos comprados|entfernt gekaufte Credits|verwijdert gekochte credits|eltávolítja a megvásárolt krediteket|elimină creditele cumpărate/i,
      `${language}: refund answers never claim purchased credits are removed`,
    )
  }
  const overview = buildUsyBillingOverviewAnswer(contextFor("pro").usage, "english")
  assert.match(overview, /purchase additional credit top-ups at any time/i)
}

// ---------------------------------------------------------------------------
// 8. Current plan knowledge
// ---------------------------------------------------------------------------

function testFreePlanKnowledge() {
  const reply = buildUsyReply({
    question: "What are your pricing plans?",
    context: contextFor("free"),
  })
  assert.equal(reply.intent, "billing")
  assert.match(reply.answer, /Free includes 2 AI credits and up to 2 datasets/)
  assert.match(reply.answer, /no ClevrSync and no new credit top-ups/)
}

function testProAndBusinessPlanKnowledge() {
  const pro = buildUsyReply({
    question: "What does the Pro plan include?",
    context: contextFor("free"),
  })
  assert.match(pro.answer, /Pro is €40\/month with 500 AI credits and up to 25 datasets/)
  assert.match(pro.answer, /ClevrSync enabled and top-ups enabled/)

  const business = buildUsyReply({
    question: "How many datasets does Business allow?",
    context: contextFor("pro"),
  })
  assert.match(business.answer, /Business is €420\/month with 1,500 AI credits, up to 100 datasets/)
  assert.match(business.answer, /ClevrSync enabled/)

  const summary = getPlanSummary()
  assert.equal(summary.free.clevrSyncEnabled, false)
  assert.equal(summary.free.topUpsEnabled, false)
  assert.equal(summary.pro.clevrSyncEnabled, true)
  assert.equal(summary.business.clevrSyncEnabled, true)
  assert.equal(summary.superadmin.clevrSyncEnabled, true)
}

function testMarketPricingIsNotHardcodedToEur() {
  const gbp = buildUsyReply({
    question: "How much does Pro cost per month?",
    context: contextFor("free", { currency: "GBP" }),
  })
  assert.match(gbp.answer, /UseClevr Pro costs £39\/month\./)
  assert.doesNotMatch(gbp.answer, /€40\/month/)

  const plansGbp = buildUsyReply({
    question: "What are your pricing plans?",
    context: contextFor("free", { currency: "GBP" }),
  })
  assert.match(plansGbp.answer, /£39\/month/)
  assert.doesNotMatch(plansGbp.answer, /€40\/month/)

  // EUR stays the default answer when no market is supplied.
  const eur = buildUsyReply({
    question: "How much does Pro cost per month?",
    context: contextFor("free"),
  })
  assert.match(eur.answer, /€40\/month/)
}

function testGuestCurrencyIsDroppedAtBoundary() {
  const context = buildUsyRequestContext({
    audience: "public",
    role: "public",
    route: "/pricing",
    isAuthenticated: false,
    clientCurrency: "GBP",
  })
  assert.equal(context.currency, undefined)

  const reply = buildUsyReply({
    question: "How much does Pro cost per month?",
    context,
  })
  assert.match(reply.answer, /€40\/month/)
}

// ---------------------------------------------------------------------------
// 9. Credit costs
// ---------------------------------------------------------------------------

function testCreditCostsAnswer() {
  const reply = buildUsyReply({
    question: "Explain my AI credits",
    context: contextFor("pro"),
  })
  assert.equal(reply.intent, "account_help")
  assert.match(reply.answer, /upload with standard analysis 10 credits/)
  assert.match(reply.answer, /AI Analyst\/Assistant message 1 credit/)
  assert.match(reply.answer, /report generation or regeneration 3 credits/)
  assert.match(reply.answer, /forecast 3 credits/)
  assert.match(reply.answer, /profitability\/complex analysis 15 credits/)
  assert.match(reply.answer, /downloading an already-generated report 0 credits/)
  assert.match(reply.answer, /Internal processing that belongs to the same bundled operation is not charged as an additional user cost\./)

  assert.equal(usyCreditCostFacts.uploadWithStandardAnalysis, 10)
  assert.equal(usyCreditCostFacts.aiAssistantMessage, 1)
  assert.equal(usyCreditCostFacts.reportGeneration, 3)
  assert.equal(usyCreditCostFacts.forecast, 3)
  assert.equal(usyCreditCostFacts.profitabilityAnalysis, 15)
  assert.equal(usyCreditCostFacts.existingReportDownload, 0)
}

// ---------------------------------------------------------------------------
// 10. Response behavior
// ---------------------------------------------------------------------------

function testClevrSyncAnswersStayLocalized() {
  const localizedFree: Record<SupportedUsyLanguage, RegExp> = {
    english: /not available on Free/,
    german: /nicht verfügbar/,
    dutch: /niet beschikbaar op Free/,
    spanish: /no está disponible en Free/,
    hungarian: /nem érhető el Free/,
    romanian: /nu este disponibil pe Free/,
  }

  const germanFree = buildUsyReply({
    question: "Was ist ClevrSync und wie verbinde ich Google Sheets?",
    context: contextFor("free"),
  })
  assert.equal(germanFree.language, "german")
  assert.match(germanFree.answer, localizedFree.german)
  assert.match(germanFree.answer, /normalen UseClevr-Upload/)
  assert.doesNotMatch(germanFree.answer, /aktiviert/)

  const germanPro = buildUsyReply({
    question: "Was ist ClevrSync und wie verbinde ich Google Sheets?",
    context: contextFor("pro"),
  })
  assert.equal(germanPro.language, "german")
  assert.match(germanPro.answer, /ClevrSync ist in deinem Plan aktiviert\./)
  assert.match(germanPro.answer, /Verfügbare Connectors: Google Sheets\./)
  assert.doesNotMatch(germanPro.answer, /kommen bald/)
  assert.match(germanPro.answer, /OneDrive und SharePoint sind nicht Teil des Produkts\./)
  assert.match(germanPro.answer, /Google-Sheets-Ablauf/)

  const englishPro = buildUsyReply({ question: "ClevrSync", context: contextFor("pro") })
  assert.match(englishPro.answer, /ClevrSync is enabled on Pro\./)
  assert.notEqual(englishPro.answer, germanPro.answer, "German and English ClevrSync answers differ")

  const dutchFree = buildUsyReply({ question: "ClevrSync", context: contextFor("free") })
  assert.doesNotMatch(dutchFree.answer, /geactiveerd|actief in jouw plan/)

  const localizedNotPartOfProduct: Record<SupportedUsyLanguage, RegExp> = {
    english: /OneDrive and SharePoint are not part of the product\./,
    german: /OneDrive und SharePoint sind nicht Teil des Produkts\./,
    dutch: /OneDrive en SharePoint maken geen deel uit van het product\./,
    spanish: /OneDrive y SharePoint no forman parte del producto\./,
    hungarian: /A OneDrive és a SharePoint nem része a terméknek\./,
    romanian: /OneDrive și SharePoint nu fac parte din produs\./,
  }
  const localizedConnectorQuestions: Record<SupportedUsyLanguage, string> = {
    english: "ClevrSync",
    german: "Was ist ClevrSync?",
    dutch: "Wat is ClevrSync?",
    spanish: "¿Qué es ClevrSync?",
    hungarian: "Mi az ClevrSync?",
    romanian: "Ce este ClevrSync?",
  }
  for (const language of languages) {
    const reply = buildUsyReply({ question: localizedConnectorQuestions[language], context: contextFor("pro") })
    assert.equal(reply.language, language, `${language}: connector question is answered in ${language}`)
    assert.match(
      reply.answer,
      localizedNotPartOfProduct[language],
      `${language}: ClevrSync answer states OneDrive and SharePoint are not part of the product`,
    )
    assert.doesNotMatch(reply.answer, /coming soon|kommen bald|binnenkort|próximamente|hamarosan|în curând/i, `${language}: connector status is never coming soon`)
  }
}

const tests = [
  { name: "Free users are never told ClevrSync is available and get the upload path", fn: testFreeUserNeverToldClevrSyncIsAvailable },
  { name: "Pro and Business users get ClevrSync enabled answers", fn: testProAndBusinessClevrSyncEnabled },
  { name: "Superadmin keeps ClevrSync regardless of subscription", fn: testSuperadminClevrSyncIndependentOfSubscription },
  { name: "Connector list names Google Sheets as the available connector and never advertises Microsoft", fn: testConnectorsListGoogleSheetsAvailable },
  { name: "Required connector questions return the final product state", fn: testRequiredConnectorQuestionsReturnFinalProductState },
  { name: "Excel is not a ClevrSync connector", fn: testExcelIsNotAClevrSyncConnector },
  { name: "Google Sheets flow, URL fallback, and credit-free discovery/preview", fn: testGoogleSheetsFlowSteps },
  { name: "Reports state selected-dataset-only isolation", fn: testReportsUseSelectedDatasetOnly },
  { name: "Dashboard metrics never aggregate across datasets", fn: testDashboardMetricsDoNotAggregateAcrossDatasets },
  { name: "Dataset-specific analytical questions route to the AI Assistant", fn: testDatasetQuestionsRouteToAiAssistant },
  { name: "Report sections, supported-metrics-only, and missing-data disclosure", fn: testReportSectionsAndMissingDataDisclosure },
  { name: "Report generation costs 3 credits and downloads cost 0", fn: testReportCreditCosts },
  { name: "Retail profitability mapping stays rule-based without example values", fn: testRetailProfitabilityMappingWithoutExampleValues },
  { name: "Refunded invoices do not cancel active subscriptions", fn: testRefundedInvoiceDoesNotCancelSubscription },
  { name: "Subscription status answers separate the four billing concepts", fn: testSubscriptionStatusDistinguishesTheFourConcepts },
  { name: "Refund answers never claim purchased credits are removed", fn: testRefundAnswersPreservePurchasedCreditsRule },
  { name: "Free plan knowledge names 2 credits, 2 datasets, no ClevrSync, no top-ups", fn: testFreePlanKnowledge },
  { name: "Pro and Business plan knowledge matches the catalog with ClevrSync flags", fn: testProAndBusinessPlanKnowledge },
  { name: "Plan pricing follows the market currency instead of hardcoded EUR", fn: testMarketPricingIsNotHardcodedToEur },
  { name: "Guest currency claims are dropped at the context boundary", fn: testGuestCurrencyIsDroppedAtBoundary },
  { name: "Credit costs answer uses the authoritative feature costs", fn: testCreditCostsAnswer },
  { name: "ClevrSync answers stay localized across all six languages", fn: testClevrSyncAnswersStayLocalized },
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
  console.log(failures === 0 ? `All ${tests.length} Usy product knowledge tests passed.` : `${failures} test(s) failed.`)
  if (failures > 0) process.exitCode = 1
})()
