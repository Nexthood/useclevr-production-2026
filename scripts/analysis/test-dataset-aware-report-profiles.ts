import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import { parseCSVStreaming } from "../../src/lib/data/csvLoader"
import type { ReportProfileId } from "../../src/lib/reports/report-profiles"
import type { EcommerceReportAnalysis, InvestorReportAnalysis, MarketplaceReportAnalysis, ReportDiagnostics, ReportSemanticContext, SaasReportAnalysis } from "../../src/lib/reports/report-generator"

type DatasetInput = Parameters<typeof import("../../src/lib/reports/dataset-report-builder").buildDatasetReportInput>[0]
type DatasetReportInput = Awaited<ReturnType<typeof import("../../src/lib/reports/dataset-report-builder")["buildDatasetReportInput"]>>
type BuildDatasetReportInput = typeof import("../../src/lib/reports/dataset-report-builder")["buildDatasetReportInput"]
type GenerateReport = typeof import("../../src/lib/reports/report-generator")["generateReport"]
type DeleteReport = typeof import("../../src/lib/reports/report-generator")["deleteReport"]
type GeneratePdfReport = typeof import("../../src/lib/reports/pdf-report-generator")["generatePdfReport"]
type GetReportProfile = typeof import("../../src/lib/reports/report-profiles")["getReportProfile"]
type EcommerceReportInput = DatasetReportInput & {
  ecommerceAnalysis?: EcommerceReportAnalysis
  saasAnalysis?: SaasReportAnalysis
  semanticContext?: ReportSemanticContext
  diagnostics?: ReportDiagnostics
}
type MarketplaceReportInput = DatasetReportInput & {
  marketplaceAnalysis?: MarketplaceReportAnalysis
  semanticContext?: ReportSemanticContext
  diagnostics?: ReportDiagnostics
}
type InvestorReportInput = DatasetReportInput & {
  investorAnalysis?: InvestorReportAnalysis
  semanticContext?: ReportSemanticContext
  diagnostics?: ReportDiagnostics
}

type FixtureCase = {
  family: string
  baseName: string
  businessModel: string
  expectedProfile: ReportProfileId
}

const availableFixtures: FixtureCase[] = [
  { family: "local_retail", baseName: "01_local_retail", businessModel: "local_retail", expectedProfile: "local_retail" },
  { family: "ecommerce", baseName: "02_ecommerce", businessModel: "ecommerce", expectedProfile: "ecommerce" },
  { family: "saas_startup", baseName: "03_saas_startup", businessModel: "saas", expectedProfile: "saas_startup" },
  { family: "marketplace_startup", baseName: "04_marketplace_startup", businessModel: "marketplace", expectedProfile: "marketplace_startup" },
  { family: "investor_portfolio", baseName: "investor-portfolio", businessModel: "investor", expectedProfile: "investor_portfolio" },
  { family: "business_consulting", baseName: "business-consulting", businessModel: "generic", expectedProfile: "business_consulting" },
]

const requiredFixtureNames = [
  "01_local_retail",
  "02_ecommerce",
  "03_saas_startup",
  "04_marketplace_startup",
  "05_investor_portfolio",
  "06_business_consulting",
  "07_professional_services",
  "08_generic_business",
  "09_profitability_pnl",
  "10_accountancy_ledger",
]

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function nearlyEqual(actual: number | null | undefined, expected: number | null | undefined, message: string, tolerance = 0.02) {
  assert(typeof actual === "number" && typeof expected === "number" && Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`)
}

async function main() {
  process.env.TEMP_DIR = "/tmp/useclevr-dataset-aware-report-profile-test"
  fs.rmSync(process.env.TEMP_DIR, { recursive: true, force: true })
  fs.mkdirSync(process.env.TEMP_DIR, { recursive: true })

  const { buildDatasetReportInput } = await import("../../src/lib/reports/dataset-report-builder")
  const { REPORT_RUNTIME_VERSION, deleteReport, generateReport } = await import("../../src/lib/reports/report-generator")
  const { generatePdfReport } = await import("../../src/lib/reports/pdf-report-generator")
  const { getReportProfile, listReportProfiles } = await import("../../src/lib/reports/report-profiles")
  assert(REPORT_RUNTIME_VERSION === "report-runtime-v5", "report runtime must invalidate pre-AOV-provenance reports")

  const profileIds = listReportProfiles().map((profile) => profile.id).sort()
  for (const expected of [
    "local_retail",
    "ecommerce",
    "saas_startup",
    "marketplace_startup",
    "investor_portfolio",
    "business_consulting",
    "professional_services",
    "generic_business",
    "profitability_pnl",
    "accountancy_ledger",
  ] satisfies ReportProfileId[]) {
    assert(profileIds.includes(expected), `Missing report profile: ${expected}`)
  }

  const fixtureRoot = path.join(process.cwd(), "test-fixtures", "business-models")
  const results: Array<{ fixture: string; profile: string; rows: number; pdfVerified?: boolean }> = []
  const retailParity: Record<string, { revenue: number | null; cogs: number | null; grossProfit: number | null; grossMargin: number | null; aovStatus?: string; inventoryValue: number | null; reorderRequiredCount: number | null }> = {}
  const ecommerceParity: Record<string, {
    rows: number
    revenue: number | null
    cogs: number | null
    grossProfit: number | null
    grossMargin: number | null
    orders: number | null
    aov: number | null
    customers: number | null
    shippingCost: number | null
    returnRate: number | null
    channelCount: number
    categoryCount: number
    trendCount: number
  }> = {}
  const saasParity: Record<string, {
    rows: number
    mrr: number | null
    arr: number | null
    customers: number | null
    newCustomers: number | null
    churnedCustomers: number | null
    churnRate: number | null
    expansionMrr: number | null
    contractionMrr: number | null
    netExpansionMrr: number | null
    cac: number | null
    ltv: number | null
    ltvToCac: number | null
    activeUsers: number | null
    supportTickets: number | null
    burn: number | null
    cashBalance: number | null
    runwayMonths: number | null
    planCount: number
    geographyCount: number
    trendCount: number
    dataConfidence: number | null
  }> = {}
  const marketplaceParity: Record<string, {
    rows: number
    gmv: number | null
    revenue: number | null
    commission: number | null
    takeRate: number | null
    transactions: number | null
    buyers: number | null
    sellers: number | null
    refunds: number | null
    refundRate: number | null
    activeSellers: number | null
    listings: number | null
    activeSellersAggregation: string
    listingsAggregation: string
    refundTrendValues: number[]
  }> = {}

  for (const fixture of availableFixtures) {
    for (const extension of ["csv", "xlsx"] as const) {
      const filePath = path.join(fixtureRoot, `${fixture.baseName}.${extension}`)
      assert(fs.existsSync(filePath), `Missing available fixture ${filePath}`)
      const parsed = await parseFixture(filePath)
      const dataset = buildDataset({
        id: `profile_${fixture.family}_${extension}`,
        filePath,
        rowCount: parsed.rowCount,
        columns: parsed.columns,
        rows: parsed.previewRows,
        businessModel: fixture.businessModel,
      })
      const reportInput = await buildDatasetReportInput(dataset)
      assert(reportInput.reportProfile?.id === fixture.expectedProfile, `${fixture.family}.${extension}: expected ${fixture.expectedProfile}, received ${reportInput.reportProfile?.id}`)
      assert(reportInput.rowCount === parsed.rowCount, `${fixture.family}.${extension}: report row count mismatch`)

      if (fixture.family === "local_retail") {
        assert(reportInput.reportProfile.title === "Retail Executive Report", "local retail must use Retail Executive Report")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Gross Profit"), "local retail must include Gross Profit")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Gross Margin"), "local retail must include Gross Margin")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Units Sold"), "local retail must include Units Sold")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Current Stock"), "local retail must include Current Stock")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Inventory Value"), "local retail must include Inventory Value")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Products / SKUs"), "local retail must include Products / SKUs")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Reorder Required"), "local retail must include Reorder Required")
        assert(reportInput.financials?.revenue === 4455, "local retail revenue must match fixture")
        assert(reportInput.financials?.cogs === 2180, "local retail COGS must use fixture cost field")
        assert(reportInput.financials?.grossProfit === 2275, "local retail gross profit must be revenue minus cost")
        assert(reportInput.financials?.grossMargin === 51.07, "local retail gross margin must match fixture")
        assertRetailCategoryReconciliation(reportInput, `${fixture.baseName}.${extension}`)
        assert(reportInput.retailAnalysis?.averageOrderValue?.status === "not_available", "local retail fixture without order ID must not show AOV")
        retailParity[extension] = {
          revenue: reportInput.financials?.revenue ?? null,
          cogs: reportInput.financials?.cogs ?? null,
          grossProfit: reportInput.financials?.grossProfit ?? null,
          grossMargin: reportInput.financials?.grossMargin ?? null,
          aovStatus: reportInput.retailAnalysis?.averageOrderValue?.status,
          inventoryValue: reportInput.retailAnalysis?.inventoryValue ?? null,
          reorderRequiredCount: reportInput.retailAnalysis?.reorderRequiredCount ?? null,
        }
        const recommendationText = reportInput.recommendations?.map((item) => `${item.issue} ${item.recommendedAction}`).join(" ") || ""
        assert(!/interest|tax|operating expenses/i.test(recommendationText), "local retail recommendations must not lead with generic P&L missing-field advice")
      }

      if (fixture.family === "ecommerce") {
        const ecommerceInput = reportInput as EcommerceReportInput
        const ecommerce = ecommerceInput.ecommerceAnalysis
        assert(ecommerceInput.reportProfile.title === "E-commerce Performance Report", "ecommerce must use E-commerce Performance Report")
        assert(ecommerceInput.rowCount === 220, "ecommerce fixture must analyze all 220 rows")
        nearlyEqual(ecommerceInput.financials?.revenue, 87419.2, "ecommerce revenue must match fixture", 0.01)
        assert(ecommerceInput.financials?.cogs === null, "ecommerce shipping_cost must not map to COGS")
        assert(ecommerceInput.financials?.grossProfit === null, "ecommerce gross profit must be unavailable without COGS")
        assert(ecommerceInput.financials?.grossMargin === null, "ecommerce gross margin must be unavailable without COGS")
        assert(ecommerceInput.semanticContext?.mappings.cogs === null, "ecommerce semantic context must not map shipping_cost to COGS")
        assert(ecommerceInput.semanticContext?.mappings.expenseCategory === null, "ecommerce category must not map to expense category")
        assert(ecommerceInput.diagnostics?.expenseCategoryField === null, "ecommerce diagnostics must not expose product category as expense category")
        if (!ecommerce) throw new Error("ecommerce analysis must be present")
        assert(ecommerce.orderField === "order_id", "ecommerce orders must use order_id")
        assert(ecommerce.orders === 220, "ecommerce orders must be distinct order_id")
        nearlyEqual(ecommerce.averageOrderValue, 397.36, "ecommerce AOV must divide revenue by distinct order_id", 0.01)
        assert(ecommerce.customers === 96, "ecommerce customers must use distinct customer_id")
        assert(ecommerce.ordersPerCustomer !== null, "ecommerce orders per customer must be available")
        assert(ecommerce.revenuePerCustomer !== null, "ecommerce revenue per customer must be available")
        assert(ecommerce.unitsSold !== null && ecommerce.unitsSold > 0, "ecommerce units sold must be available")
        assert(ecommerce.products === 12, "ecommerce products must use distinct product_id")
        assert(ecommerce.shippingCost === 3000, "ecommerce shipping cost must be analyzed separately")
        nearlyEqual(ecommerce.shippingCostRate, 3.43, "ecommerce shipping cost rate must use revenue denominator", 0.01)
        assert(ecommerce.discounts !== null && ecommerce.discounts > 0, "ecommerce discounts must be available")
        assert(ecommerce.returnRate !== null && ecommerce.returnRate > 0, "ecommerce returns must be available")
        assert(ecommerce.returnStatus === "available", "ecommerce return status must be available when values normalize")
        assert(ecommerce.returnedOrders === 13, "ecommerce returned orders must count only positive return statuses")
        assert(ecommerce.eligibleReturnOrders === 220, "ecommerce eligible return denominator must use normalized order statuses")
        nearlyEqual(ecommerce.returnRate, 5.91, "ecommerce return rate must use returned orders over eligible orders", 0.01)
        assert(ecommerce.revenueTrend.length === 4, "ecommerce revenue trend must group order_date revenue by month")
        assert(ecommerceInput.diagnostics?.trendAvailable === true, "ecommerce diagnostics must mark revenue trend available without requiring net profit")
        assert(ecommerce?.channelPerformance.length === 5, "ecommerce channel performance must be available")
        assert(ecommerce?.categoryPerformance.length === 6, "ecommerce category performance must be product/category performance")
        assert(ecommerce?.geography.length === 5, "ecommerce geography must be available")
        const recommendationText = reportInput.recommendations?.map((item) => `${item.issue} ${item.recommendedAction}`).join(" ") || ""
        assert(!/^Add COGS, operating expenses, interest and tax/i.test(recommendationText), "ecommerce recommendations must not lead with generic P&L missing-field advice")
        assert(!/Return rate is 5\.9%|Return rate is 100\.0%/i.test(recommendationText), "ecommerce recommendations must not overstate normal return-rate signals")
        ecommerceParity[extension] = {
          rows: ecommerceInput.rowCount,
          revenue: ecommerceInput.financials?.revenue ?? null,
          cogs: ecommerceInput.financials?.cogs ?? null,
          grossProfit: ecommerceInput.financials?.grossProfit ?? null,
          grossMargin: ecommerceInput.financials?.grossMargin ?? null,
          orders: ecommerce?.orders ?? null,
          aov: ecommerce?.averageOrderValue ?? null,
          customers: ecommerce?.customers ?? null,
          shippingCost: ecommerce?.shippingCost ?? null,
          returnRate: ecommerce?.returnRate ?? null,
          channelCount: ecommerce?.channelPerformance.length ?? 0,
          categoryCount: ecommerce?.categoryPerformance.length ?? 0,
          trendCount: ecommerce?.revenueTrend.length ?? 0,
        }
      }

      if (fixture.family === "saas_startup") {
        const saasInput = reportInput as EcommerceReportInput
        const saas = saasInput.saasAnalysis
        assert(saasInput.reportProfile.title === "SaaS Executive Report", "saas startup must use SaaS Executive Report")
        assert(saasInput.rowCount === 144, "saas startup fixture must analyze all 144 rows")
        if (!saas) throw new Error("saas analysis must be present")
        assert(saas.periodField === "month", "saas period must map from month")
        assert(saas.customerField === "customer_id", "saas customers must use customer_id")
        assert(saas.mrrField === "mrr", "saas MRR must map from mrr")
        assert(saas.arrField === "arr", "saas ARR must map from arr")
        assert(saas.newCustomerField === "new_customer", "saas new customers must map from new_customer")
        assert(saas.churnField === "churned", "saas churn must map from churned")
        assert(saas.expansionMrrField === "expansion_mrr", "saas expansion MRR must map from expansion_mrr")
        assert(saas.contractionMrrField === "contraction_mrr", "saas contraction MRR must map from contraction_mrr")
        assert(saas.cacField === "cac", "saas CAC must map from cac")
        assert(saas.ltvField === "ltv", "saas LTV must map from ltv")
        assert(saas.activeUsersField === "active_users", "saas active users must map from active_users")
        assert(saas.supportTicketsField === "support_tickets", "saas support tickets must map from support_tickets")
        assert(saas.burnField === "burn", "saas burn must map from burn")
        assert(saas.cashBalanceField === "cash_balance", "saas cash balance must map from cash_balance")
        assert(saas.runwayField === "runway_months", "saas runway must map from runway_months")
        assert(saas.mrr !== null && saas.mrr > 0, "saas MRR must be available")
        assert(saas.arr !== null && saas.arr > 0, "saas ARR must be available")
        assert(saas.customers !== null && saas.customers > 0, "saas customers must be available")
        assert(saas.newCustomers !== null && saas.newCustomers > 0, "saas new customers must be available")
        assert(saas.churnedCustomers !== null && saas.churnedCustomers > 0, "saas churned customers must be available")
        assert(saas.churnRate !== null && saas.churnRate > 0, "saas churn rate must be available")
        assert(saas.expansionMrr !== null && saas.expansionMrr >= 0, "saas expansion MRR must be available")
        assert(saas.contractionMrr !== null && saas.contractionMrr >= 0, "saas contraction MRR must be available")
        assert(saas.netExpansionMrr !== null, "saas net expansion MRR must be derived")
        assert(saas.cac !== null && saas.cac > 0, "saas CAC must be available")
        assert(saas.ltv !== null && saas.ltv > 0, "saas LTV must be available")
        assert(saas.ltvToCac !== null && saas.ltvToCac > 0, "saas LTV/CAC must be available")
        assert(saas.activeUsers !== null && saas.activeUsers > 0, "saas active users must be available")
        assert(saas.supportTickets !== null && saas.supportTickets >= 0, "saas support tickets must be available")
        assert(saas.burn !== null && saas.burn > 0, "saas burn must be available")
        assert(saas.cashBalance !== null && saas.cashBalance > 0, "saas cash balance must be available")
        assert(saas.runwayMonths !== null && saas.runwayMonths > 0, "saas runway must be available")
        assert(saas.planPerformance.length > 0, "saas plan intelligence must be available")
        assert(saas.geography.length > 0, "saas geography must be available")
        assert(saas.mrrTrend.length >= 2, "saas MRR trend must be available")
        assert(saas.dataConfidence > 0, "saas data confidence must not be zero")
        assert(saasInput.diagnostics?.trendAvailable === true, "saas diagnostics must mark trend available without net profit")
        const recommendationText = reportInput.recommendations?.map((item) => `${item.issue} ${item.recommendedAction}`).join(" ") || ""
        assert(!/^Add COGS, operating expenses, interest and tax/i.test(recommendationText), "saas recommendations must not lead with generic P&L missing-field advice")
        saasParity[extension] = {
          rows: saasInput.rowCount,
          mrr: saas.mrr,
          arr: saas.arr,
          customers: saas.customers,
          newCustomers: saas.newCustomers,
          churnedCustomers: saas.churnedCustomers,
          churnRate: saas.churnRate,
          expansionMrr: saas.expansionMrr,
          contractionMrr: saas.contractionMrr,
          netExpansionMrr: saas.netExpansionMrr,
          cac: saas.cac,
          ltv: saas.ltv,
          ltvToCac: saas.ltvToCac,
          activeUsers: saas.activeUsers,
          supportTickets: saas.supportTickets,
          burn: saas.burn,
          cashBalance: saas.cashBalance,
          runwayMonths: saas.runwayMonths,
          planCount: saas.planPerformance.length,
          geographyCount: saas.geography.length,
          trendCount: saas.mrrTrend.length,
          dataConfidence: saas.dataConfidence,
         }
       }

      if (fixture.family === "marketplace_startup") {
        const marketplaceInput = reportInput as MarketplaceReportInput
        const marketplace = marketplaceInput.marketplaceAnalysis
        assert(reportInput.reportProfile.title === "Marketplace Performance Report", "marketplace must use Marketplace Performance Report")
        assert(reportInput.rowCount === 180, "marketplace fixture must analyze all 180 rows")
        if (!marketplace) throw new Error("marketplace analysis must be present")
        nearlyEqual(marketplace.gmv, 83778.17, "marketplace GMV must match fixture", 0.02)
        nearlyEqual(marketplace.marketplaceRevenue, 11049.51, "marketplace revenue must match fixture", 0.02)
        nearlyEqual(marketplace.takeRate, 13.19, "marketplace take rate must be marketplace revenue / GMV", 0.02)
        assert(marketplace.transactions === 180, "marketplace transactions must use distinct transaction_id")
        assert(marketplace.buyers === 100, "marketplace buyers must use distinct buyer_id")
        assert(marketplace.sellers === 58, "marketplace sellers must use distinct seller_id")
        nearlyEqual(marketplace.refunds, 1660.33, "marketplace refunds must match fixture", 0.02)
        nearlyEqual(marketplace.refundRate, 1.98, "marketplace refund rate must be refunds / GMV", 0.02)
         nearlyEqual(marketplace.averageTransactionValue, 465.43, "marketplace ATV must be GMV / transactions", 0.02)
         assert(marketplace.gmvField === "gross_merchandise_value", "marketplace GMV field must be gross_merchandise_value")
         assert(marketplace.marketplaceRevenueField === "platform_fee", "marketplace revenue field must be platform_fee")
         assert(reportInput.financials?.revenue === null, "marketplace must null generic revenue so GMV is not labeled Revenue")
         assert(marketplace.newBuyers === 40, "marketplace new buyers must count distinct positive new_buyer rows from source: 40")
         assert(marketplace.newSellers === 20, "marketplace new sellers must count distinct positive new_seller rows from source: 20")
         assert(marketplace.newBuyerField === "new_buyer", "marketplace new buyer field must be new_buyer")
         assert(marketplace.newSellerField === "new_seller", "marketplace new seller field must be new_seller")
         assert(marketplace.activeSellers === 5, "marketplace active sellers must use latest snapshot, not row sum: source cycles 1-5 across 180 rows")
         assert(marketplace.activeSellersAggregation === "latest_snapshot", "marketplace active sellers must be detected as snapshot, not summed")
         assert(marketplace.activeSellersField === "active_sellers", "marketplace active sellers field must be active_sellers")
         assert(marketplace.listings === 10, "marketplace listings must use latest snapshot, not row sum: source cycles 1-10 across 180 rows")
         assert(marketplace.listingsAggregation === "latest_snapshot", "marketplace listings must be detected as snapshot, not summed")
         assert(marketplace.listingsField === "listing_count", "marketplace listing count field must be listing_count")
          assert(marketplace.refundTrend.length === 4, "marketplace refund trend must group by month")
          assert(marketplace.refundTrend[0].value > 0, "marketplace refund trend January must be non-zero: source truth is $414.90")
          assert(marketplace.refundTrend.every((t) => t.value > 0), "marketplace refund trend must not report $0 for any month with refunds in source")
          assert(marketplace.refundTrend[3].value > 0, "marketplace refund trend April (partial month) must be non-zero: source truth is ~$415.35")
        assert(reportInput.financials?.revenue === null, "marketplace must null generic revenue so GMV is not labeled Revenue")
        assert(!reportInput.kpis.some((kpi) => kpi.title === "Revenue"), "marketplace KPIs must not include generic Revenue")
        assert(reportInput.kpis.some((kpi) => kpi.title === "GMV"), "marketplace KPIs must include GMV")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Marketplace Revenue"), "marketplace KPIs must include Marketplace Revenue")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Take Rate"), "marketplace KPIs must include Take Rate")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Transactions"), "marketplace KPIs must include Transactions")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Buyers"), "marketplace KPIs must include Buyers")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Sellers"), "marketplace KPIs must include Sellers")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Refund Rate"), "marketplace KPIs must include Refund Rate")
        assert(reportInput.bbsc?.perspectives.financial.kpis?.some((kpi) => kpi.label === "GMV"), "marketplace BBSC financial perspective must include GMV")
        assert(!reportInput.bbsc?.perspectives.financial.kpis?.some((kpi) => kpi.label === "Revenue"), "marketplace BBSC financial perspective must not include generic Revenue")
        assert(reportInput.bbsc?.perspectives.financial.kpis?.some((kpi) => kpi.label === "Marketplace Revenue"), "marketplace BBSC financial perspective must include Marketplace Revenue")
        marketplaceParity[extension] = {
          rows: reportInput.rowCount,
          gmv: marketplace.gmv,
          revenue: marketplace.marketplaceRevenue,
          commission: marketplace.marketplaceRevenue,
          takeRate: marketplace.takeRate,
          transactions: marketplace.transactions,
          buyers: marketplace.buyers,
          sellers: marketplace.sellers,
          refunds: marketplace.refunds,
          refundRate: marketplace.refundRate,
          activeSellers: marketplace.activeSellers,
          listings: marketplace.listings,
          activeSellersAggregation: marketplace.activeSellersAggregation,
          listingsAggregation: marketplace.listingsAggregation,
          refundTrendValues: marketplace.refundTrend.map((t) => t.value),
        }
      }

      if (fixture.family === "local_retail" && extension === "xlsx") {
        const report = await generateReport(dataset.id, "01_local_retail.xlsx", {
          visibility: "private",
          status: "ready",
          reportType: reportInput.reportType,
          businessModel: reportInput.businessModel,
          userId: "synthetic_user",
          workspaceId: "synthetic_user",
          idempotencyKey: "dataset-aware-retail-profile",
        }, reportInput)
        assert(Boolean(report.pdfPath && fs.existsSync(report.pdfPath)), "local retail PDF must generate")
        const { text: pdfText } = assertPdfLayoutBasics(report.pdfPath!, "RETAIL EXECUTIVE REPORT")
        assertResultsSummaryPage(pdfText, "RETAIL RESULTS SUMMARY", ["MRR", "ARR", "Churn Rate"], "retail", { requireKeyResults: true, requireActions: true })
        assertRetailResultsSummaryFindings(pdfText)
        assert(pdfText.includes("RETAIL EXECUTIVE REPORT"), "local retail PDF must identify the retail report")
        assert(pdfText.includes("SALES & MARGIN PERFORMANCE"), "local retail PDF must include sales and margin page")
        assert(pdfText.includes("INVENTORY INTELLIGENCE"), "local retail PDF must include inventory page")
        assert(pdfText.includes("PRODUCT / CATEGORY / SUPPLIER INTELLIGENCE"), "local retail PDF must include product/category/supplier page")
        assert(pdfText.includes("RETAIL RECOMMENDATIONS + PROVENANCE"), "local retail PDF must include retail recommendations page")
        assert(!pdfText.includes("Interest Expense"), "local retail PDF must not render generic interest expense row")
        assert(!pdfText.includes("Tax Expense"), "local retail PDF must not render generic tax expense row")
        assert(!pdfText.includes("COST INTELLIGENCE"), "local retail PDF must not render generic cost intelligence page")
        assert(!pdfText.includes("$443"), "local retail PDF must not display row-count revenue as Average Order Value")
        assert(pdfText.includes("No reliable order identifier"), "local retail PDF must explain unavailable AOV semantics")
        if (report.pdfPath) fs.unlinkSync(report.pdfPath)
        deleteReport(report.id)
        results.push({ fixture: `${fixture.baseName}.${extension}`, profile: reportInput.reportProfile.id, rows: reportInput.rowCount, pdfVerified: true })
      } else if (fixture.family === "ecommerce" && extension === "xlsx") {
        const report = await generateReport(dataset.id, "02_ecommerce.xlsx", {
          visibility: "private",
          status: "ready",
          reportType: reportInput.reportType,
          businessModel: reportInput.businessModel,
          userId: "synthetic_user",
          workspaceId: "synthetic_user",
          idempotencyKey: "dataset-aware-ecommerce-profile",
        }, reportInput)
        assert(Boolean(report.pdfPath && fs.existsSync(report.pdfPath)), "ecommerce PDF must generate")
        const { text: pdfText } = assertPdfLayoutBasics(report.pdfPath!, "E-COMMERCE PERFORMANCE REPORT")
        assertResultsSummaryPage(pdfText, "E-COMMERCE RESULTS SUMMARY", ["MRR", "ARR", "Churn Rate"], "ecommerce", { requireKeyResults: true, requireActions: true })
        assertProfileResultsSummaryFindings(pdfText, "ecommerce", /order|customer|category|channel|shipping|return|cogs|gross margin|revenue trend/i, /sku|reorder|stockout/i)
        const normalizedPdfText = pdfText.toLowerCase()
        assert(pdfText.includes("E-COMMERCE PERFORMANCE REPORT"), "ecommerce PDF must identify the e-commerce report")
        assert(pdfText.includes("Rows Analyzed"), "ecommerce PDF must include row provenance")
        assert(pdfText.includes("220"), "ecommerce PDF must show all 220 rows")
        assert(pdfText.includes("$87.4K") || pdfText.includes("$87,419"), "ecommerce PDF must show recognized revenue")
        assert(pdfText.includes("SALES PERFORMANCE"), "ecommerce PDF must include sales performance page")
        assert(pdfText.includes("CUSTOMER / CHANNEL / COMMERCIAL INTELLIGENCE"), "ecommerce PDF must include customer/channel/commercial page")
        assert(pdfText.includes("Average Order Value"), "ecommerce PDF must include AOV")
        assert(pdfText.includes("$397"), "ecommerce PDF must show AOV from distinct orders")
        assert(pdfText.includes("COGS"), "ecommerce PDF must disclose COGS")
        assert(pdfText.includes("Not available"), "ecommerce PDF must mark unsupported financial metrics unavailable")
        assert(!pdfText.includes("Directly from source field: shipping_cost"), "ecommerce PDF must not source COGS from shipping_cost")
        assert(!pdfText.includes("Expense Category"), "ecommerce PDF must not treat product category as expense category")
        assert(!pdfText.includes("96.6%"), "ecommerce PDF must not show false gross margin")
        assert(normalizedPdfText.includes("revenue trend"), "ecommerce PDF must include revenue trend")
        assert(pdfText.includes("Shipping / Fulfillment Cost"), "ecommerce PDF must analyze shipping separately")
        assert(normalizedPdfText.includes("returns") || normalizedPdfText.includes("return rate"), "ecommerce PDF must include returns")
        assert(!pdfText.includes("100.0%"), "ecommerce PDF must not show every non-empty return status as returned")
        assert(normalizedPdfText.includes("channel performance"), "ecommerce PDF must include channel intelligence")
        assert(pdfText.includes("E-COMMERCE RECOMMENDATIONS + PROVENANCE"), "ecommerce PDF must include e-commerce recommendations")
        if (report.pdfPath) fs.unlinkSync(report.pdfPath)
        deleteReport(report.id)
        results.push({ fixture: `${fixture.baseName}.${extension}`, profile: reportInput.reportProfile.id, rows: reportInput.rowCount, pdfVerified: true })
      } else if (fixture.family === "saas_startup" && extension === "xlsx") {
        const report = await generateReport(dataset.id, "03_saas_startup.xlsx", {
          visibility: "private",
          status: "ready",
          reportType: reportInput.reportType,
          businessModel: reportInput.businessModel,
          userId: "synthetic_user",
          workspaceId: "synthetic_user",
          idempotencyKey: "dataset-aware-saas-profile",
        }, reportInput)
        assert(Boolean(report.pdfPath && fs.existsSync(report.pdfPath)), "saas PDF must generate")
        const { text: pdfText } = assertPdfLayoutBasics(report.pdfPath!, "SAAS EXECUTIVE REPORT")
        assertResultsSummaryPage(pdfText, "SAAS RESULTS SUMMARY", ["AOV", "Average Order Value", "Orders"], "saas", { requireKeyResults: true, requireActions: true })
        assertProfileResultsSummaryFindings(pdfText, "saas", /mrr|arr|customer|churn|cac|ltv|runway|burn|plan|recurring/i, /sku|reorder|stockout|average order value/i)
        assert(pdfText.includes("SAAS EXECUTIVE REPORT"), "saas PDF must identify the SaaS report")
        assert(pdfText.includes("Rows Analyzed"), "saas PDF must include row provenance")
        assert(pdfText.includes("144"), "saas PDF must show all 144 rows")
        assertSectionHasMeaningfulContent(
          pdfText,
          "KEY FINANCIAL / BUSINESS HIGHLIGHTS",
          ["MRR", "ARR", "Customers", "New Customers", "Churn Rate", "CAC", "LTV", "Runway", "Data Confidence"],
          "saas overview highlights heading must stay with its KPI cards",
        )
        assert(pdfText.includes("MRR"), "saas PDF must include MRR")
        assert(pdfText.includes("ARR"), "saas PDF must include ARR")
        assert(pdfText.includes("Customers"), "saas PDF must include customers")
        assert(pdfText.includes("New Customers"), "saas PDF must include new customers")
        assert(pdfText.includes("Churn"), "saas PDF must include churn")
        assert(pdfText.includes("Expansion MRR"), "saas PDF must include expansion MRR")
        assert(pdfText.includes("Contraction MRR"), "saas PDF must include contraction MRR")
        assert(pdfText.includes("CAC"), "saas PDF must include CAC")
        assert(pdfText.includes("LTV"), "saas PDF must include LTV")
        assert(pdfText.includes("Active Users"), "saas PDF must include active users")
        assert(pdfText.includes("Support Tickets"), "saas PDF must include support tickets")
        assert(pdfText.includes("Burn"), "saas PDF must include burn")
        assert(pdfText.includes("Cash Balance"), "saas PDF must include cash balance")
        assert(pdfText.includes("Runway"), "saas PDF must include runway")
        assert(pdfText.includes("RECURRING REVENUE & GROWTH"), "saas PDF must include recurring revenue page")
        assert(pdfText.includes("CUSTOMER & UNIT ECONOMICS"), "saas PDF must include customer economics page")
        assert(pdfText.includes("CASH / STARTUP HEALTH"), "saas PDF must include cash health page")
        assert(pdfText.includes("PLAN PERFORMANCE"), "saas PDF must include plan intelligence")
        assert(pdfText.includes("Country") || pdfText.includes("COUNTRY SEGMENTATION"), "saas PDF must include geography")
        assert(!pdfText.includes("COST INTELLIGENCE"), "saas PDF must not render generic cost intelligence as the default SaaS page")
        assert(!pdfText.includes("Recognized financial-field coverage"), "saas PDF must not use generic financial-field confidence wording")
        if (report.pdfPath) fs.unlinkSync(report.pdfPath)
        deleteReport(report.id)
        results.push({ fixture: `${fixture.baseName}.${extension}`, profile: reportInput.reportProfile.id, rows: reportInput.rowCount, pdfVerified: true })
      } else if (fixture.family === "marketplace_startup" && extension === "xlsx") {
        const report = await generateReport(dataset.id, "04_marketplace_startup.xlsx", {
          visibility: "private",
          status: "ready",
          reportType: reportInput.reportType,
          businessModel: reportInput.businessModel,
          userId: "synthetic_user",
          workspaceId: "synthetic_user",
          idempotencyKey: "dataset-aware-marketplace-profile",
        }, reportInput)
        assert(Boolean(report.pdfPath && fs.existsSync(report.pdfPath)), "marketplace PDF must generate")
        const { text: pdfText } = assertPdfLayoutBasics(report.pdfPath!, "MARKETPLACE PERFORMANCE REPORT")
        assertResultsSummaryPage(pdfText, "MARKETPLACE RESULTS SUMMARY", ["MRR", "ARR", "Churn Rate", "AOV", "Average Order Value"], "marketplace", { requireKeyResults: true, requireActions: true })
        assertProfileResultsSummaryFindings(pdfText, "marketplace", /gmv|take rate|marketplace revenue|commission|transaction|buyer|seller|refund/i, /reorder|stockout|average order value|churn rate|mrr/i)
        assert(pdfText.includes("MARKETPLACE PERFORMANCE REPORT"), "marketplace PDF must identify the marketplace report")
        assert(pdfText.includes("MARKETPLACE ECONOMICS"), "marketplace PDF must include marketplace economics page")
        assert(pdfText.includes("GMV TREND") || pdfText.includes("GMV"), "marketplace PDF must include GMV")
        assert(pdfText.includes("$83.8K") || pdfText.includes("$83,8"), "marketplace PDF must show recognized GMV value")
        assert(pdfText.includes("Marketplace Revenue"), "marketplace PDF must include marketplace revenue")
        assert(pdfText.includes("Take Rate"), "marketplace PDF must include take rate")
        assert(pdfText.includes("Transactions"), "marketplace PDF must include transactions")
        assert(pdfText.includes("Average Transaction Value"), "marketplace PDF must include average transaction value")
        assert(pdfText.includes("Buyers"), "marketplace PDF must include buyers")
        assert(pdfText.includes("Sellers"), "marketplace PDF must include sellers")
        assert(pdfText.includes("Refund Rate"), "marketplace PDF must include refund rate")
        assert(pdfText.includes("New Buyers"), "marketplace PDF must include new buyers")
        assert(pdfText.includes("New Sellers"), "marketplace PDF must include new sellers")
        assert(pdfText.includes("Active Sellers"), "marketplace PDF must include active sellers")
        assert(pdfText.includes("Listings"), "marketplace PDF must include listings")
        assert(pdfText.includes("BUYER & SELLER INTELLIGENCE"), "marketplace PDF must include buyer & seller intelligence page")
        assert(pdfText.includes("CATEGORY & GEOGRAPHY PERFORMANCE"), "marketplace PDF must include category & geography page")
        assert(pdfText.includes("MARKETPLACE RECOMMENDATIONS + PROVENANCE"), "marketplace PDF must include marketplace recommendations")
        assert(!pdfText.includes("FINANCIAL PERFORMANCE"), "marketplace PDF must not render generic Financial Performance page")
        assert(!pdfText.includes("PROFIT AND MARGIN TREND"), "marketplace PDF must not render generic Profit and Margin Trend page")
        assert(!pdfText.includes("COST INTELLIGENCE"), "marketplace PDF must not render generic Cost Intelligence page")
        assert(!pdfText.includes("TOP COST CATEGORIES"), "marketplace PDF must not render generic Top Cost Categories")
        assert(!pdfText.includes("$83.8K\n\n\nMARKETPLACE REVENUE"), "marketplace PDF must not show GMV value directly under Marketplace Revenue label")
        assert(pdfText.includes("Latest snapshot"), "marketplace PDF must show latest snapshot provenance for active sellers")
        assert(pdfText.includes("Sum of") === false || pdfText.includes("Sum of active_sellers.") === false, "marketplace PDF must not say 'Sum of active_sellers' for snapshot metrics")
        assert(pdfText.includes("Refund Trend"), "marketplace PDF must include refund trend in results summary")
        assert(!pdfText.includes("Refund Trend: 2026-01 leads at $0"), "marketplace PDF must not report $0 for refund trend when source has refunds")
assert(pdfText.includes("GMV"), "marketplace PDF must include GMV label")
assert(pdfText.includes("$83.8K"), "marketplace PDF must show GMV value $83.8K")
        if (report.pdfPath) fs.unlinkSync(report.pdfPath)
        deleteReport(report.id)
        results.push({ fixture: `${fixture.baseName}.${extension}`, profile: reportInput.reportProfile.id, rows: reportInput.rowCount, pdfVerified: true })
      } else if (fixture.family === "investor_portfolio") {
        const investorInput = reportInput as unknown as InvestorReportInput
        const investor = investorInput.investorAnalysis
        assert(reportInput.reportProfile.title === "Investor Portfolio Report", "investor must use Investor Portfolio Report")
        assert(reportInput.rowCount === 5, "investor fixture must analyze all 5 rows")
        assert(investor !== undefined, "investor analysis must be present")
        const report = await generateReport(dataset.id, path.basename(filePath), {
          visibility: "private",
          status: "ready",
          reportType: reportInput.reportType,
          businessModel: reportInput.businessModel,
          userId: "synthetic_user",
          workspaceId: "synthetic_user",
          idempotencyKey: `dataset-aware-investor-profile`,
        }, reportInput)
        assert(Boolean(report.pdfPath && fs.existsSync(report.pdfPath)), "investor PDF must generate")
        const { text: pdfText } = assertPdfLayoutBasics(report.pdfPath!, "INVESTOR PORTFOLIO REPORT")
        assert(!pdfText.includes("FINANCIAL PERFORMANCE"), "investor PDF must not render generic Financial Performance page")
        assert(!pdfText.includes("PROFIT AND MARGIN TREND"), "investor PDF must not render generic Profit and Margin Trend page")
        assert(!pdfText.includes("COST INTELLIGENCE"), "investor PDF must not render generic Cost Intelligence page")
        assert(!pdfText.includes("TOP COST CATEGORIES"), "investor PDF must not render generic Top Cost Categories")
        assert(pdfText.includes("INVESTMENT & VALUATION PERFORMANCE"), "investor PDF must include Investment & Valuation Performance page")
        assert(pdfText.includes("PORTFOLIO COMPANY PERFORMANCE"), "investor PDF must include Portfolio Company Performance page")
        assert(pdfText.includes("SECTOR & STAGE ALLOCATION"), "investor PDF must include Sector & Stage Allocation page")
        assert(pdfText.includes("INVESTOR RECOMMENDATIONS"), "investor PDF must include Investor Recommendations")
        if (report.pdfPath) fs.unlinkSync(report.pdfPath)
        deleteReport(report.id)
        results.push({ fixture: `${fixture.baseName}.${extension}`, profile: reportInput.reportProfile.id, rows: reportInput.rowCount, pdfVerified: true })
      } else {
        const report = await generateReport(dataset.id, path.basename(filePath), {
          visibility: "private",
          status: "ready",
          reportType: reportInput.reportType,
          businessModel: reportInput.businessModel,
          userId: "synthetic_user",
          workspaceId: "synthetic_user",
          idempotencyKey: `dataset-aware-${fixture.family}-${extension}-profile`,
        }, reportInput)
        assert(Boolean(report.pdfPath && fs.existsSync(report.pdfPath)), `${fixture.family}.${extension} PDF must generate`)
        const { text: pdfText } = assertPdfLayoutBasics(report.pdfPath!, reportInput.reportProfile.title.toUpperCase())
        assertResultsSummaryPage(pdfText, expectedResultsSummaryTitle(reportInput.reportProfile.id), [], fixture.family, { requireKeyResults: true })
        if (report.pdfPath) fs.unlinkSync(report.pdfPath)
        deleteReport(report.id)
        results.push({ fixture: `${fixture.baseName}.${extension}`, profile: reportInput.reportProfile.id, rows: reportInput.rowCount, pdfVerified: true })
      }
    }
  }

  assert(JSON.stringify(retailParity.csv) === JSON.stringify(retailParity.xlsx), "local retail CSV and XLSX outputs must match for financials, AOV status, inventory value, and reorder metrics")
  assert(JSON.stringify(ecommerceParity.csv) === JSON.stringify(ecommerceParity.xlsx), "ecommerce CSV and XLSX outputs must match for semantic KPI results")
  assert(JSON.stringify(saasParity.csv) === JSON.stringify(saasParity.xlsx), "saas startup CSV and XLSX outputs must match for semantic KPI results")
  assert(JSON.stringify(marketplaceParity.csv) === JSON.stringify(marketplaceParity.xlsx), "marketplace CSV and XLSX outputs must match for semantic KPI results")
  await assertRetailUnitCostAndAovRegressions(buildDatasetReportInput, generateReport, deleteReport, generatePdfReport)
  await assertEcommerceReturnStatusRegressions(buildDatasetReportInput)
  await assertSharedPdfPaginationRegression(generatePdfReport, getReportProfile)
  const syntheticMandatoryPdfResults = await assertMissingRequiredProfilePdfRegressions(generatePdfReport, getReportProfile)

  const missingRequiredFixtures = requiredFixtureNames.flatMap((name) => {
    return ["csv", "xlsx"].map((extension) => `${name}.${extension}`).filter((fileName) => !fs.existsSync(path.join(fixtureRoot, fileName)))
  })

  fs.rmSync(process.env.TEMP_DIR, { recursive: true, force: true })

  console.log(JSON.stringify({
    implementedProfiles: profileIds,
    availableFixtureResults: results,
    exactRequiredFixtureMatrix: {
      expected: requiredFixtureNames.length * 2,
      found: requiredFixtureNames.length * 2 - missingRequiredFixtures.length,
      missing: missingRequiredFixtures,
    },
    syntheticMandatoryPdfResults,
  }, null, 2))
}

async function assertEcommerceReturnStatusRegressions(buildDatasetReportInput: BuildDatasetReportInput) {
  const rows = [
    { order_id: "ORD-1", order_date: "2026-01-01", customer_id: "C1", product_id: "P1", product_name: "Lamp", category: "Home", quantity: 1, revenue: 100, return_status: "Returned", channel: "Shopify" },
    { order_id: "ORD-1", order_date: "2026-01-01", customer_id: "C1", product_id: "P2", product_name: "Cable", category: "Home", quantity: 1, revenue: 25, return_status: "returned", channel: "Shopify" },
    { order_id: "ORD-2", order_date: "2026-01-02", customer_id: "C2", product_id: "P3", product_name: "Mat", category: "Office", quantity: 2, revenue: 80, return_status: "Not Returned", channel: "Email" },
    { order_id: "ORD-3", order_date: "2026-01-03", customer_id: "C3", product_id: "P4", product_name: "Bottle", category: "Sports", quantity: 1, revenue: 40, return_status: "False", channel: "Amazon" },
    { order_id: "ORD-4", order_date: "2026-01-04", customer_id: "C4", product_id: "P5", product_name: "Serum", category: "Beauty", quantity: 1, revenue: 55, return_status: "Completed", channel: "Shopify" },
    { order_id: "ORD-5", order_date: "2026-01-05", customer_id: "C5", product_id: "P6", product_name: "Scale", category: "Kitchen", quantity: 1, revenue: 60, return_status: "unexpected text", channel: "Google Shopping" },
    { order_id: "ORD-6", order_date: "2026-01-06", customer_id: "C6", product_id: "P7", product_name: "Block", category: "Sports", quantity: 1, revenue: 35, return_status: "", channel: "Amazon" },
    { order_id: "ORD-7", order_date: "2026-01-07", customer_id: "C7", product_id: "P8", product_name: "Stand", category: "Office", quantity: 1, revenue: 90, return_status: "return approved", channel: "Email" },
  ]
  const reportInput = await buildDatasetReportInput(buildDataset({
    id: "profile_ecommerce_return_status_semantics",
    filePath: path.join(process.cwd(), "test-fixtures", "business-models", "02_ecommerce.csv"),
    rowCount: rows.length,
    columns: Object.keys(rows[0] ?? {}),
    rows,
    businessModel: "ecommerce",
  })) as EcommerceReportInput
  const ecommerce = reportInput.ecommerceAnalysis
  if (!ecommerce) throw new Error("ecommerce return regression analysis must be present")
  assert(ecommerce.returnedOrders === 2, "return status normalization must count only returned and return-approved orders")
  assert(ecommerce.eligibleReturnOrders === 5, "return denominator must exclude unknown statuses and avoid duplicate line-item counts")
  nearlyEqual(ecommerce.returnRate, 40, "return rate must use order-level returned over eligible orders", 0.01)

  const unknownRows = rows.map((row, index) => ({ ...row, order_id: `UNK-${index}`, return_status: index % 2 === 0 ? "" : "maybe later" }))
  const unknownInput = await buildDatasetReportInput(buildDataset({
    id: "profile_ecommerce_unknown_return_status",
    filePath: path.join(process.cwd(), "test-fixtures", "business-models", "02_ecommerce.csv"),
    rowCount: unknownRows.length,
    columns: Object.keys(unknownRows[0] ?? {}),
    rows: unknownRows,
    businessModel: "ecommerce",
  })) as EcommerceReportInput
  assert(unknownInput.ecommerceAnalysis?.returnStatus === "not_available", "unknown return statuses must not fabricate availability")
  assert(unknownInput.ecommerceAnalysis?.returnRate === null, "unknown return statuses must not produce a return-rate percentage")
}

async function assertSharedPdfPaginationRegression(generatePdfReport: GeneratePdfReport, getReportProfile: GetReportProfile) {
  const report = {
    id: "shared-pagination-regression",
    datasetId: "profile_shared_pdf_pagination",
    datasetName: "shared_pdf_pagination.csv",
    createdAt: new Date().toISOString(),
    status: "ready",
    reportType: "executive-bi-report",
    businessModel: "generic",
    userId: "synthetic_user",
    workspaceId: "synthetic_user",
    runtimeVersion: "report-runtime-v5",
    templateName: "Executive BI Report",
    reportProfile: getReportProfile("generic"),
    timezone: "Europe/Amsterdam",
    timezoneOffset: 0,
    localTime: "2026-08-15 12:00",
    visibility: "private",
    summary: "Synthetic report used to validate shared PDF pagination for long tables.",
    financials: {
      reportingPeriod: "Synthetic",
      dataConfidence: 100,
      revenue: 100000,
      cogs: 40000,
      grossProfit: 60000,
      operatingExpenses: 25000,
      operatingProfit: 35000,
      interestExpense: 1000,
      taxExpense: 5000,
      netProfit: 29000,
      grossMargin: 60,
      operatingMargin: 35,
      netMargin: 29,
      topCostCategories: Array.from({ length: 55 }, (_, index) => ({
        name: `Overflow Category ${String(index + 1).padStart(3, "0")}`,
        value: 1000 + index,
      })),
      periodTrends: [
        { period: "2026-01", revenue: 20000, grossProfit: 12000, operatingProfit: 7000, netProfit: 6000 },
        { period: "2026-02", revenue: 22000, grossProfit: 13200, operatingProfit: 7600, netProfit: 6400 },
        { period: "2026-03", revenue: 25000, grossProfit: 15000, operatingProfit: 8900, netProfit: 7200 },
      ],
    },
    findings: [],
    kpis: [],
    charts: [],
    aiInsights: [],
    predictions: [],
    recommendations: [],
    alerts: [],
    rowCount: 55,
    columnCount: 4,
  } as Parameters<GeneratePdfReport>[0]

  const pdfPath = await generatePdfReport(report)
  const { pages, text } = assertPdfLayoutBasics(pdfPath, "EXECUTIVE BI REPORT")
  assert(pages >= 5, "shared pagination regression must create continuation pages")
  assert(text.includes("Overflow Category 055"), "long PDF table must preserve the final row instead of clipping or dropping it")
  const pagesWithRepeatedCostHeader = text
    .split("\f")
    .filter((pageText) => pageText.includes("Category") && pageText.includes("Amount") && pageText.includes("Share") && pageText.includes("Notes"))
    .length
  assert(pagesWithRepeatedCostHeader >= 2, "long PDF table continuation pages must repeat the table header")
  fs.unlinkSync(pdfPath)
}

async function assertMissingRequiredProfilePdfRegressions(generatePdfReport: GeneratePdfReport, getReportProfile: GetReportProfile) {
  const syntheticProfiles = [
    { baseName: "04_marketplace_startup", model: "marketplace" },
    { baseName: "05_investor_portfolio", model: "investor" },
    { baseName: "06_business_consulting", model: "business_consulting" },
    { baseName: "07_professional_services", model: "professional_services" },
    { baseName: "08_generic_business", model: "generic" },
    { baseName: "09_profitability_pnl", model: "profitability" },
    { baseName: "10_accountancy_ledger", model: "accountancy" },
  ]
  const results: Array<{ fixture: string; title: string; pages: number }> = []
  for (const profile of syntheticProfiles) {
    for (const extension of ["csv", "xlsx"] as const) {
      const reportProfile = getReportProfile(profile.model)
      const report = {
        id: `synthetic-${profile.baseName}-${extension}`,
        datasetId: `profile_${profile.baseName}_${extension}`,
        datasetName: `${profile.baseName}.${extension}`,
        createdAt: new Date().toISOString(),
        status: "ready",
        reportType: "executive-bi-report",
        businessModel: profile.model,
        userId: "synthetic_user",
        workspaceId: "synthetic_user",
        runtimeVersion: "report-runtime-v5",
        templateName: reportProfile.title,
        reportProfile,
        timezone: "Europe/Amsterdam",
        timezoneOffset: 0,
        localTime: "2026-08-15 12:00",
        visibility: "private",
        summary: `${profile.baseName} synthetic layout report validates shared PDF pagination only.`,
        financials: {
          reportingPeriod: "Synthetic",
          dataConfidence: 80,
          revenue: 50000,
          cogs: 20000,
          grossProfit: 30000,
          operatingExpenses: 12000,
          operatingProfit: 18000,
          interestExpense: 500,
          taxExpense: 3000,
          netProfit: 14500,
          grossMargin: 60,
          operatingMargin: 36,
          netMargin: 29,
          topCostCategories: Array.from({ length: 14 }, (_, index) => ({
            name: `${profile.baseName} Category ${String(index + 1).padStart(2, "0")}`,
            value: 500 + index * 25,
          })),
          periodTrends: [
            { period: "2026-01", revenue: 14000, grossProfit: 8400, operatingProfit: 4800, netProfit: 3600 },
            { period: "2026-02", revenue: 16000, grossProfit: 9600, operatingProfit: 5600, netProfit: 4200 },
            { period: "2026-03", revenue: 20000, grossProfit: 12000, operatingProfit: 7600, netProfit: 5200 },
          ],
        },
        findings: [],
        kpis: [],
        charts: [],
        aiInsights: [],
        predictions: [],
        recommendations: [],
        alerts: [],
        rowCount: 14,
        columnCount: 4,
      } as Parameters<GeneratePdfReport>[0]
      const pdfPath = await generatePdfReport(report)
      const { pages, text } = assertPdfLayoutBasics(pdfPath, reportProfile.title.toUpperCase())
      assertResultsSummaryPage(text, expectedResultsSummaryTitle(reportProfile.id), [], profile.baseName, { requireKeyResults: false, requireActions: false })
      fs.unlinkSync(pdfPath)
      results.push({ fixture: `${profile.baseName}.${extension}`, title: reportProfile.title, pages })
    }
  }
  return results
}

function assertPdfLayoutBasics(pdfPath: string, expectedTitle: string) {
  const info = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" })
  const pagesMatch = info.match(/^Pages:\s+(\d+)/m)
  const pages = pagesMatch ? Number(pagesMatch[1]) : 0
  assert(pages > 0, `${path.basename(pdfPath)} must have at least one PDF page`)
  const text = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" })
  const expectedTitlePrefix = expectedTitle.slice(0, 28)
  assert(text.includes(expectedTitle) || text.includes(expectedTitlePrefix), `${path.basename(pdfPath)} must include ${expectedTitle}`)
  assert(text.includes(`Page 1 of ${pages}`), `${path.basename(pdfPath)} must include first-page numbering`)
  assert(text.includes(`Page ${pages} of ${pages}`), `${path.basename(pdfPath)} must include final-page numbering`)
  assert(!/\bundefined\b|\bNaN\b/.test(text), `${path.basename(pdfPath)} must not render undefined or NaN layout text`)
  return { pages, text }
}

function assertResultsSummaryPage(
  text: string,
  expectedTitle: string,
  forbiddenTerms: string[],
  label: string,
  options: { requireKeyResults?: boolean; requireActions?: boolean } = {},
) {
  const finalPage = lastPdfPageText(text)
  assert(finalPage.includes(expectedTitle), `${label}: final PDF page must be ${expectedTitle}`)
  if (options.requireKeyResults !== false) {
    assert(finalPage.includes("KEY RESULTS"), `${label}: results summary must include key results`)
  }
  assert(finalPage.includes("BUSINESS HEALTH"), `${label}: results summary must include business health`)
  if (options.requireActions !== false) {
    assert(finalPage.includes("PRIORITY ACTIONS"), `${label}: results summary must include priority actions`)
  }
  assert(!/\bundefined\b|\bNaN\b/.test(finalPage), `${label}: results summary must not render undefined or NaN`)
  for (const term of forbiddenTerms) {
    assert(!finalPage.includes(term), `${label}: results summary must not include cross-profile metric ${term}`)
  }
}

function lastPdfPageText(text: string) {
  const pages = text.split("\f").map((pageText) => pageText.trim()).filter(Boolean)
  return pages[pages.length - 1] || ""
}

function expectedResultsSummaryTitle(profileId: ReportProfileId) {
  if (profileId === "local_retail") return "RETAIL RESULTS SUMMARY"
  if (profileId === "ecommerce") return "E-COMMERCE RESULTS SUMMARY"
  if (profileId === "saas_startup") return "SAAS RESULTS SUMMARY"
  if (profileId === "marketplace_startup") return "MARKETPLACE RESULTS SUMMARY"
  if (profileId === "investor_portfolio") return "PORTFOLIO RESULTS SUMMARY"
  if (profileId === "professional_services") return "PROFESSIONAL SERVICES RESULTS SUMMARY"
  if (profileId === "profitability_pnl") return "PROFITABILITY RESULTS SUMMARY"
  if (profileId === "accountancy_ledger") return "ACCOUNTANCY RESULTS SUMMARY"
  return "BUSINESS RESULTS SUMMARY"
}

function assertRetailResultsSummaryFindings(text: string) {
  const finalPage = lastPdfPageText(text)
  const topFindings = sectionText(finalPage, "TOP FINDINGS", "PRIORITY ACTIONS")
  assert(topFindings.length > 0, "retail results summary must include a Top Findings section")
  assert(!/loaded rows|recognized source field|retail KPIs prioritize|selected dataset only/i.test(topFindings), "retail results summary top findings must not prioritize parser or provenance observations")
  assert(/reorder|stockout|inventory value|supplier|category|product/i.test(topFindings), "retail results summary top findings must prioritize business findings")
}

function assertProfileResultsSummaryFindings(text: string, label: string, requiredBusinessSignal: RegExp, forbiddenProfileSignal: RegExp) {
  const finalPage = lastPdfPageText(text)
  const topFindings = sectionText(finalPage, "TOP FINDINGS", "PRIORITY ACTIONS")
  assert(topFindings.length > 0, `${label}: results summary must include a Top Findings section`)
  assert(!/loaded rows|recognized source field|selected dataset only|classified as|kpis prioritize/i.test(topFindings), `${label}: results summary top findings must suppress technical metadata`)
  assert(requiredBusinessSignal.test(topFindings), `${label}: results summary top findings must prioritize profile business findings`)
  assert(!forbiddenProfileSignal.test(topFindings), `${label}: results summary top findings must not contain cross-profile findings`)
}

function sectionText(text: string, startHeading: string, endHeading: string) {
  const start = text.indexOf(startHeading)
  if (start < 0) return ""
  const end = text.indexOf(endHeading, start + startHeading.length)
  return (end < 0 ? text.slice(start) : text.slice(start, end)).trim()
}

function assertSectionHasMeaningfulContent(text: string, heading: string, requiredContent: string[], message: string) {
  const pageTexts = text.split("\f")
  const pageText = pageTexts.find((candidate) => candidate.includes(heading))
  assert(Boolean(pageText), `${message}: missing heading ${heading}`)
  assert(
    requiredContent.some((content) => pageText?.includes(content)),
    `${message}: heading appears without required following content on the same page`,
  )
}

function assertRetailCategoryReconciliation(reportInput: DatasetReportInput, label: string) {
  const margins = reportInput.retailAnalysis?.grossMarginByCategory || []
  assert(margins.length > 0, `${label}: category gross margin rows must be available`)
  const revenue = margins.reduce((total, item) => total + item.revenue, 0)
  const cogs = margins.reduce((total, item) => total + item.cogs, 0)
  const grossProfit = margins.reduce((total, item) => total + item.grossProfit, 0)
  nearlyEqual(revenue, reportInput.financials?.revenue ?? null, `${label}: category revenue must reconcile`, 0.01)
  nearlyEqual(cogs, reportInput.financials?.cogs ?? null, `${label}: category COGS must reconcile`, 0.01)
  nearlyEqual(grossProfit, reportInput.financials?.grossProfit ?? null, `${label}: category gross profit must reconcile`, 0.01)
  const weightedMargin = revenue > 0 ? (grossProfit / revenue) * 100 : null
  nearlyEqual(weightedMargin, reportInput.financials?.grossMargin ?? null, `${label}: weighted category margin must reconcile`, 0.02)
}

async function assertRetailUnitCostAndAovRegressions(
  buildDatasetReportInput: BuildDatasetReportInput,
  generateReport: GenerateReport,
  deleteReport: DeleteReport,
  generatePdfReport: typeof import("../../src/lib/reports/pdf-report-generator")["generatePdfReport"],
) {
  const rows = buildSyntheticRetailRows()
  const columns = Object.keys(rows[0] ?? {})
  const unitCostDataset = buildDataset({
    id: "profile_01_local_retail_unit_cost",
    filePath: path.join(process.cwd(), "test-fixtures", "business-models", "01_local_retail.xlsx"),
    rowCount: rows.length,
    columns,
    rows,
    businessModel: "local_retail",
  })
  const reportInput = await buildDatasetReportInput(unitCostDataset)
  assert(reportInput.rowCount === 180, "synthetic local retail regression must analyze 180 rows")
  nearlyEqual(reportInput.financials?.revenue, 79800, "unit-cost retail revenue must match fixture")
  nearlyEqual(reportInput.financials?.cogs, 48100, "unit-cost retail COGS must multiply unit cost by units sold")
  nearlyEqual(reportInput.financials?.grossProfit, 31700, "unit-cost retail gross profit must match fixture")
  nearlyEqual(reportInput.financials?.grossMargin, 39.72, "unit-cost retail gross margin must match fixture", 0.03)
  assert(reportInput.retailAnalysis?.productCount === 35, "unit-cost retail fixture must preserve product/SKU count")
  assert(reportInput.retailAnalysis?.reorderRequiredCount === 10, "unit-cost retail fixture must preserve reorder count")
  assert(reportInput.retailAnalysis?.averageOrderValue?.status === "not_available", "retail rows without order semantics must mark AOV unavailable")
  assert(!reportInput.kpis.some((kpi) => kpi.title === "AOV"), "retail rows without order semantics must not expose an AOV KPI")
  assertRetailCategoryReconciliation(reportInput, "unit-cost retail")
  assert(reportInput.retailAnalysis!.grossMarginByCategory.every((item) => item.grossMargin < 60), "unit-cost retail category margins must not show impossible unit-cost percentages")
  assert(reportInput.retailAnalysis!.grossMarginByCategory.every((item) => item.cogsSource === "unit_cost x units_sold"), "unit-cost retail category rows must expose COGS provenance")

  const report = await generateReport(unitCostDataset.id, "01_local_retail.xlsx", {
    visibility: "private",
    status: "ready",
    reportType: reportInput.reportType,
    businessModel: reportInput.businessModel,
    userId: "synthetic_user",
    workspaceId: "synthetic_user",
    idempotencyKey: "retail-unit-cost-aov-regression",
  }, reportInput)
  assert(Boolean(report.pdfPath && fs.existsSync(report.pdfPath)), "unit-cost retail PDF must generate")
  const pdfText = execFileSync("pdftotext", [report.pdfPath!, "-"], { encoding: "utf8" })
  assert(pdfText.includes("RETAIL EXECUTIVE REPORT"), "unit-cost retail PDF must identify the retail report")
  assert(pdfText.includes("INVENTORY INTELLIGENCE"), "unit-cost retail PDF must keep inventory intelligence")
  assert(pdfText.includes("RETAIL RECOMMENDATIONS + PROVENANCE"), "unit-cost retail PDF must keep retail recommendations and provenance")
  assert(!pdfText.includes("$443"), "unit-cost retail PDF must not display revenue per row as AOV")
  assert(pdfText.includes("Average Order Value"), "unit-cost retail PDF must include the AOV row")
  assert(pdfText.includes("Not available"), "unit-cost retail PDF must render unavailable AOV")
  assert(!/9[0-2]\.[0-9]%/.test(pdfText), "unit-cost retail PDF must not render impossible 90-92% category margins")
  const staleReport = {
    ...report,
    id: `${report.id}-stale-aov`,
    retailAnalysis: {
      ...report.retailAnalysis!,
      averageOrderValue: {
        metric: "average_order_value",
        value: 443.33,
        status: "available",
        calculationMethod: "total_revenue / distinct_order_id",
        sourceFields: ["revenue"],
        confidence: "high",
      },
    },
  } as Parameters<typeof generatePdfReport>[0]
  const stalePdfPath = await generatePdfReport(staleReport)
  const stalePdfText = execFileSync("pdftotext", [stalePdfPath, "-"], { encoding: "utf8" })
  assert(!stalePdfText.includes("$443"), "PDF renderer must not display stale AOV without order-count provenance")
  assert(stalePdfText.includes("No reliable order identifier"), "PDF renderer must explain suppressed stale AOV")
  fs.unlinkSync(stalePdfPath)
  if (report.pdfPath) fs.unlinkSync(report.pdfPath)
  deleteReport(report.id)

  const orderRows = [
    { order_id: "ORDER-001", revenue: 50, unit_cost: 10, units_sold: 1, category: "Coffee", product_id: "SKU-1" },
    { order_id: "ORDER-001", revenue: 30, unit_cost: 12, units_sold: 1, category: "Coffee", product_id: "SKU-2" },
    { order_id: "ORDER-002", revenue: 100, unit_cost: 16, units_sold: 1, category: "Food", product_id: "SKU-3" },
    { order_id: "ORDER-003", revenue: 20, unit_cost: 20, units_sold: 1, category: "Home", product_id: "SKU-4" },
    { order_id: "ORDER-003", revenue: 40, unit_cost: 22, units_sold: 1, category: "Home", product_id: "SKU-5" },
  ]
  const orderReport = await buildDatasetReportInput(buildDataset({
    id: "profile_retail_distinct_order_aov",
    filePath: path.join(process.cwd(), "test-fixtures", "business-models", "01_local_retail.csv"),
    rowCount: orderRows.length,
    columns: Object.keys(orderRows[0] ?? {}),
    rows: orderRows,
    businessModel: "local_retail",
  }))
  const aov = orderReport.retailAnalysis?.averageOrderValue
  assert(aov?.status === "available", "retail fixture with order ID must calculate AOV")
  nearlyEqual(aov?.value, 80, "retail AOV must divide revenue by distinct order count")
  assert(aov?.aovStatus === "available", "retail AOV must expose renderable status provenance")
  assert(aov?.orderCount === 3, "retail AOV must expose the distinct order denominator")
  assert(aov?.orderCountSource === "distinct_order_id", "retail AOV must expose the order count source")
  assert(aov?.calculationMethod === "total_revenue / distinct_order_id", "retail AOV must expose distinct-order provenance")

  const unsafeIdRows = orderRows.map((row, index) => ({
    record_id: `ROW-${index + 1}`,
    transaction_date: "2026-07-01",
    product_id: row.product_id,
    sku: row.product_id,
    revenue: row.revenue,
    unit_cost: row.unit_cost,
    units_sold: row.units_sold,
    category: row.category,
  }))
  const unsafeIdReport = await buildDatasetReportInput(buildDataset({
    id: "profile_retail_unsafe_id_aov",
    filePath: path.join(process.cwd(), "test-fixtures", "business-models", "01_local_retail.csv"),
    rowCount: unsafeIdRows.length,
    columns: Object.keys(unsafeIdRows[0] ?? {}),
    rows: unsafeIdRows,
    businessModel: "local_retail",
  }))
  const unsafeAov = unsafeIdReport.retailAnalysis?.averageOrderValue
  assert(unsafeAov?.status === "not_available", "generic row IDs and product IDs must not count as order IDs")
  assert(unsafeAov?.value === null, "generic row IDs must not produce an AOV value")
  assert(!unsafeIdReport.kpis.some((kpi) => kpi.title === "AOV"), "generic row IDs must not expose an AOV KPI")
}

function buildSyntheticRetailRows() {
  const categories = [
    { name: "Beauty", cogs: 7900 },
    { name: "Sports", cogs: 8050 },
    { name: "Electronics", cogs: 8150 },
    { name: "Office", cogs: 8000 },
    { name: "Food", cogs: 8100 },
    { name: "Home", cogs: 7900 },
  ]
  const rows: Record<string, unknown>[] = []
  for (let index = 0; index < 180; index += 1) {
    const category = categories[Math.floor(index / 30)]
    const productIndex = index % 35
    rows.push({
      date: "2026-07-01",
      store_id: `STORE-${(index % 3) + 1}`,
      product_id: `SKU-${String(productIndex + 1).padStart(3, "0")}`,
      category: category.name,
      units_sold: 10,
      revenue: 13300 / 30,
      unit_cost: category.cogs / 30 / 10,
      stock_on_hand: productIndex < 10 ? 3 : 20,
      reorder_point: 5,
      supplier: `Supplier ${(productIndex % 7) + 1}`,
      location: "Amsterdam",
    })
  }
  return rows
}

async function parseFixture(filePath: string) {
  const buffer = fs.readFileSync(filePath)
  const file = new File([buffer], path.basename(filePath), { type: mimeTypeForFile(filePath) })
  return parseCSVStreaming(file, 1000)
}

function buildDataset(input: {
  id: string
  filePath: string
  rowCount: number
  columns: string[]
  rows: Record<string, unknown>[]
  businessModel: string
}): DatasetInput {
  return {
    id: input.id,
    userId: "synthetic_user",
    name: path.basename(input.filePath),
    fileName: path.basename(input.filePath),
    fileSize: fs.statSync(input.filePath).size,
    mimeType: mimeTypeForFile(input.filePath),
    storageKey: null,
    checksum: null,
    rowCount: input.rowCount,
    columnCount: input.columns.length,
    columns: input.columns,
    data: input.rows,
    columnTypes: null,
    previewRowCount: null,
    previewGenerated: null,
    fullAnalysisCompleted: null,
    analysisStatus: "ready",
    analysisProgress: null,
    analysisMessage: null,
    analysisError: null,
    invalidRowCount: null,
    missingValueCounts: null,
    precomputedMetrics: null,
    columnMapping: null,
    detectedColumns: null,
    aiInsights: null,
    status: "ready",
    analysis: {},
    datasetType: "standard",
    businessModel: input.businessModel,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as DatasetInput
}

function mimeTypeForFile(filePath: string) {
  return filePath.endsWith(".xlsx")
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "text/csv"
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
