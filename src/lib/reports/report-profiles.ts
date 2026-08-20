export type ReportProfileId =
  | "local_retail"
  | "ecommerce"
  | "saas_startup"
  | "marketplace_startup"
  | "investor_portfolio"
  | "business_consulting"
  | "professional_services"
  | "generic_business"
  | "profitability_pnl"
  | "accountancy_ledger"

export type ReportSectionDefinition = {
  id: string
  title: string
  requiresAny?: string[]
}

export type ReportProfile = {
  id: ReportProfileId
  title: string
  primaryMetrics: string[]
  secondaryMetrics: string[]
  sections: ReportSectionDefinition[]
}

const profiles: Record<ReportProfileId, ReportProfile> = {
  local_retail: {
    id: "local_retail",
    title: "Retail Executive Report",
    primaryMetrics: ["Revenue", "Gross Profit", "Gross Margin", "Units Sold", "Inventory Value", "Low Stock", "Reorder Risk", "Products / SKUs"],
    secondaryMetrics: ["Current Stock", "Out of Stock", "Average Transaction Value", "Supplier Count"],
    sections: [
      { id: "retail-summary", title: "Retail Executive Summary" },
      { id: "sales-margin-performance", title: "Sales & Margin Performance", requiresAny: ["revenue", "cost", "cogs", "gross_profit"] },
      { id: "inventory-intelligence", title: "Inventory Intelligence", requiresAny: ["stock", "stock_on_hand", "inventory", "reorder_point"] },
      { id: "product-category-supplier", title: "Product / Category / Supplier Intelligence", requiresAny: ["product", "product_id", "sku", "category", "supplier", "vendor"] },
      { id: "retail-recommendations", title: "Retail Recommendations + Provenance" },
    ],
  },
  ecommerce: {
    id: "ecommerce",
    title: "E-commerce Performance Report",
    primaryMetrics: ["Revenue", "Orders", "Units", "AOV", "Customers", "Products", "Categories", "Returns"],
    secondaryMetrics: ["Geography", "Revenue Trend", "Top Products", "Customer Concentration"],
    sections: [
      { id: "ecommerce-summary", title: "E-commerce Executive Summary" },
      { id: "order-product-performance", title: "Order & Product Performance" },
      { id: "customer-channel-geography", title: "Customer, Channel & Geography" },
      { id: "ecommerce-recommendations", title: "E-commerce Recommendations + Provenance" },
    ],
  },
  saas_startup: {
    id: "saas_startup",
    title: "SaaS Executive Report",
    primaryMetrics: ["Revenue", "MRR", "ARR", "Customers", "Plans", "ARPU", "Growth", "Churn"],
    secondaryMetrics: ["CAC", "LTV", "Runway", "Burn", "Geography"],
    sections: [
      { id: "saas-summary", title: "SaaS Executive Summary" },
      { id: "recurring-revenue", title: "Recurring Revenue Performance" },
      { id: "customer-growth-retention", title: "Customer Growth & Retention" },
      { id: "saas-recommendations", title: "SaaS Recommendations + Provenance" },
    ],
  },
  marketplace_startup: {
    id: "marketplace_startup",
    title: "Marketplace Performance Report",
    primaryMetrics: ["GMV", "Marketplace Revenue", "Take Rate", "Merchant Payouts", "Refunds", "Customers", "Merchants", "Transactions"],
    secondaryMetrics: ["Product Category", "Geography", "Growth"],
    sections: [
      { id: "marketplace-summary", title: "Marketplace Executive Summary" },
      { id: "liquidity-revenue", title: "Marketplace Revenue & Liquidity" },
      { id: "merchant-customer-mix", title: "Merchant & Customer Mix" },
      { id: "marketplace-recommendations", title: "Marketplace Recommendations + Provenance" },
    ],
  },
  investor_portfolio: {
    id: "investor_portfolio",
    title: "Investor Portfolio Report",
    primaryMetrics: ["Portfolio Companies", "Invested Capital", "Estimated Stake Value", "MOIC", "Entry vs Latest Valuation", "Revenue Growth"],
    secondaryMetrics: ["Burn Rate", "Runway", "Stage Exposure", "Sector Exposure", "Country Exposure", "Watchlist"],
    sections: [
      { id: "investor-summary", title: "Investor Portfolio Summary" },
      { id: "portfolio-performance", title: "Portfolio Performance" },
      { id: "exposure-risk", title: "Exposure & Concentration Risk" },
      { id: "investor-recommendations", title: "Investor Recommendations + Provenance" },
    ],
  },
  business_consulting: {
    id: "business_consulting",
    title: "Business Consulting Performance Report",
    primaryMetrics: ["Revenue", "Gross Profit", "Gross Margin", "Projects", "Clients", "Consultants", "Billable Hours", "Average Hourly Rate"],
    secondaryMetrics: ["Revenue by Client", "Revenue by Consultant", "Profitability by Project", "Margin by Client", "Project Status", "Pipeline Stage"],
    sections: [
      { id: "consulting-summary", title: "Consulting Executive Summary" },
      { id: "financial-performance", title: "Consulting Financial Performance" },
      { id: "client-project-performance", title: "Client & Project Performance" },
      { id: "consulting-recommendations", title: "Consulting Recommendations + Provenance" },
    ],
  },
  professional_services: {
    id: "professional_services",
    title: "Professional Services Performance Report",
    primaryMetrics: ["Revenue", "Gross Profit", "Gross Margin", "Campaigns", "Clients", "Hours", "Leads", "Conversions"],
    secondaryMetrics: ["Revenue by Client", "Revenue by Campaign", "Revenue by Service Line", "Revenue by Channel", "Cost per Lead", "Conversion Rate"],
    sections: [
      { id: "professional-services-summary", title: "Professional Services Executive Summary" },
      { id: "financial-performance", title: "Professional Services Financials" },
      { id: "client-campaign-performance", title: "Client & Campaign Performance" },
      { id: "professional-services-recommendations", title: "Professional Services Recommendations + Provenance" },
    ],
  },
  generic_business: {
    id: "generic_business",
    title: "Executive BI Report",
    primaryMetrics: ["Revenue", "Orders", "AOV", "Customers", "Units Sold", "Products", "Cost", "Profit", "Profit Margin"],
    secondaryMetrics: ["Gross Profit", "Gross Margin", "Trends", "Categories", "Recommendations"],
    sections: [
      { id: "executive-summary", title: "Executive Summary" },
      { id: "financial-performance", title: "Financial Performance" },
      { id: "cost-intelligence", title: "Cost Intelligence" },
      { id: "recommendations-provenance", title: "Executive Recommendations + Provenance" },
    ],
  },
  profitability_pnl: {
    id: "profitability_pnl",
    title: "Profitability & P&L Report",
    primaryMetrics: ["Revenue", "COGS", "Gross Profit", "Gross Margin", "Operating Expenses", "Operating Profit", "Operating Margin", "Net Profit", "Net Margin"],
    secondaryMetrics: ["Interest", "Tax", "Expense Categories", "Trends"],
    sections: [
      { id: "pnl-summary", title: "Profitability & P&L Summary" },
      { id: "financial-performance", title: "Detailed Financial Performance" },
      { id: "cost-intelligence", title: "Expense Category Intelligence" },
      { id: "pnl-recommendations", title: "P&L Recommendations + Provenance" },
    ],
  },
  accountancy_ledger: {
    id: "accountancy_ledger",
    title: "Accountancy Ledger Report",
    primaryMetrics: ["Transactions", "Debit", "Credit", "Balances", "VAT / Tax", "Receivables", "Payables"],
    secondaryMetrics: ["Counterparties", "Transaction Categories", "Unusual Transactions", "Period Movements"],
    sections: [
      { id: "ledger-summary", title: "Ledger Executive Summary" },
      { id: "ledger-movements", title: "Ledger Movements" },
      { id: "counterparty-tax", title: "Counterparty & Tax Intelligence" },
      { id: "ledger-recommendations", title: "Ledger Recommendations + Provenance" },
    ],
  },
}

export function getReportProfile(model: string): ReportProfile {
  if (model === "local_retail" || model === "retail") return profiles.local_retail
  if (model === "ecommerce") return profiles.ecommerce
  if (model === "saas" || model === "startup") return profiles.saas_startup
  if (model === "marketplace") return profiles.marketplace_startup
  if (model === "investor") return profiles.investor_portfolio
  if (model === "business_consulting") return profiles.business_consulting
  if (model === "professional_services") return profiles.professional_services
  if (model === "profitability") return profiles.profitability_pnl
  if (model === "accountancy" || model === "prebookkeeping") return profiles.accountancy_ledger
  return profiles.generic_business
}

export function listReportProfiles() {
  return Object.values(profiles)
}
