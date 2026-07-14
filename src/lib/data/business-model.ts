import type { DatasetCategory } from "@/lib/data/dataset-category"
import { normalizeCountry } from "@/lib/geo/normalize-country"

export const businessModels = [
  "local_retail",
  "ecommerce",
  "saas",
  "startup",
  "investor",
  "marketplace",
  "generic",
] as const

export type BusinessModel = (typeof businessModels)[number]

export type BusinessModelResolutionInput = {
  explicit?: string | null
  uploadSource?: string | null
  datasetType?: string | null
  columns?: string[] | null
  datasetName?: string | null
  analysis?: unknown
}

export type BusinessModelRouteInput = {
  datasetType: DatasetCategory
  businessModel: BusinessModel
  datasetId: string
}

const businessModelSet = new Set<string>(businessModels)

const businessModelLabels: Record<BusinessModel, string> = {
  local_retail: "Local Retail",
  ecommerce: "E-Commerce",
  saas: "SaaS",
  startup: "Startup",
  investor: "Investor",
  marketplace: "Marketplace",
  generic: "Generic",
}

const modelKeywordPatterns: Record<Exclude<BusinessModel, "generic">, RegExp[]> = {
  local_retail: [
    /\bstore\b|\bbranch\b|\bshop\b|\bpos\b|\btill\b|\bcashier\b/,
    /\binventory\b|\bstock\b|\breorder\b|\bsell[\s_-]?through\b|\bdead[\s_-]?stock\b/,
    /\bsku\b|\bbarcode\b|\bsupplier\b|\bunit[\s_-]?cost\b/,
  ],
  ecommerce: [
    /\border\b|\border[\s_-]?id\b|\bcart\b|\bcheckout\b|\bshopify\b|\bwoocommerce\b|\bonline[\s_-]?shop\b/,
    /\bcountry\b|\bcountry[\s_-]?code\b|\bshipping\b|\breturn\b|\brefund\b|\bchannel\b/,
    /\bcustomer\b|\brepeat[\s_-]?customer\b|\bconversion\b|\baov\b/,
  ],
  saas: [
    /\bmrr\b|\barr\b|\brecurring\b|\bsubscription\b|\bplan\b|\bseat\b/,
    /\bchurn\b|\bretention\b|\brenewal\b|\btrial\b|\bactivation\b/,
    /\bcac\b|\bltv\b|\barpa\b|\bactive[\s_-]?user\b/,
  ],
  startup: [
    /\brunway\b|\bburn[\s_-]?rate\b|\bcash[\s_-]?burn\b|\bfunding\b|\braise\b/,
    /\bcac\b|\bltv\b|\bactive[\s_-]?user\b|\bmonthly[\s_-]?active\b/,
    /\bvaluation\b|\binvestor\b|\bcohort\b/,
  ],
  investor: [
    /\bportfolio\b|\bportfolio[\s_-]?company\b|\binvested[\s_-]?capital\b/,
    /\bvaluation\b|\bownership\b|\bstage\b|\bsector\b|\bfund\b|\birr\b|\bmoic\b/,
  ],
  marketplace: [
    /\bmarketplace\b|\bgmv\b|\bcommission\b|\btake[\s_-]?rate\b/,
    /\bseller\b|\bbuyer\b|\bvendor\b|\blisting\b|\bmerchant\b/,
  ],
}

export function normalizeBusinessModel(value?: string | null): BusinessModel | null {
  const normalized = (value || "").trim().toLowerCase().replace(/[\s-]+/g, "_")
  if (!normalized) return null
  if (businessModelSet.has(normalized)) return normalized as BusinessModel
  if (normalized === "retail" || normalized === "brick_and_mortar" || normalized === "physical_store") return "local_retail"
  if (normalized === "online_shop" || normalized === "online_store" || normalized === "e_commerce") return "ecommerce"
  if (normalized === "software_as_a_service" || normalized === "subscription") return "saas"
  if (normalized === "venture" || normalized === "early_stage") return "startup"
  if (normalized === "portfolio" || normalized === "vc" || normalized === "private_equity") return "investor"
  return null
}

export function getBusinessModelLabel(value?: string | null) {
  const normalized = normalizeBusinessModel(value) || "generic"
  return businessModelLabels[normalized]
}

export function resolveBusinessModel(input: BusinessModelResolutionInput): BusinessModel {
  const explicit = normalizeBusinessModel(input.explicit)
  if (explicit) return explicit

  const analysisModel = extractBusinessModelFromAnalysis(input.analysis)
  if (analysisModel) return analysisModel

  const uploadModel = detectBusinessModelFromUploadSource(input.uploadSource, input.datasetType)
  if (uploadModel) return uploadModel

  const schemaModel = detectBusinessModelFromColumns(input.columns || [], input.datasetName || "")
  if (schemaModel !== "generic") return schemaModel

  const datasetModel = normalizeBusinessModel(input.datasetType)
  return datasetModel || "generic"
}

export function detectBusinessModelFromColumns(columns: string[], datasetName = ""): BusinessModel {
  const text = [datasetName, ...columns].join(" ").toLowerCase()
  const ranked = Object.entries(modelKeywordPatterns)
    .map(([model, patterns]) => ({
      model: model as Exclude<BusinessModel, "generic">,
      score: patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)

  const best = ranked[0]
  if (!best || best.score === 0) return "generic"

  const ecommerceGeo = /country|country_code|shipping|channel|online|shopify|woocommerce|order/.test(text)
  const localInventory = /store|branch|pos|inventory|stock|reorder|sku|supplier/.test(text)
  if (best.model === "ecommerce" && localInventory && !ecommerceGeo) return "local_retail"
  if (best.model === "local_retail" && ecommerceGeo && !/store|branch|pos|inventory|stock|reorder/.test(text)) return "ecommerce"

  return best.model
}

export function getBusinessModelRedirect(input: BusinessModelRouteInput) {
  switch (input.datasetType) {
    case "retail":
      return `/app/retail?datasetId=${input.datasetId}`
    case "profitability":
      return `/app/profitability?datasetId=${input.datasetId}`
    case "accountancy":
      return `/app/accountancy?datasetId=${input.datasetId}`
    case "prebookkeeping":
      return `/app/prebookkeeping?datasetId=${input.datasetId}`
    default:
      return `/app/datasets/${input.datasetId}/analyze?businessModel=${input.businessModel}`
  }
}

export function getBusinessModelPromptContext(model: BusinessModel) {
  switch (model) {
    case "local_retail":
      return "business_model = local_retail. Use store, branch, inventory, low stock, dead stock, reorder risk, sell-through, product, category, and local store performance context. Do not assume country-level ecommerce geography unless valid multi-location coordinates exist."
    case "ecommerce":
      return "business_model = ecommerce. Use country, region, orders, average order value, conversion, returns, shipping, repeat customer, and channel performance context only when those fields exist."
    case "saas":
      return "business_model = saas. Use MRR, ARR, churn, CAC, LTV, runway, burn rate, active users, subscriptions, cohorts, and retention context. Do not apply retail inventory logic."
    case "startup":
      return "business_model = startup. Use runway, burn rate, funding, active users, CAC, LTV, growth, and operating metrics. Do not apply retail inventory or ecommerce geography automatically."
    case "investor":
      return "business_model = investor. Use portfolio companies, sector, stage, invested capital, valuation, ownership, geography when supported, and portfolio performance context."
    case "marketplace":
      return "business_model = marketplace. Use GMV, commission, take rate, sellers, buyers, listings, vendors, and marketplace liquidity context."
    default:
      return "business_model = generic. Use only metrics directly supported by the dataset columns and do not infer retail, ecommerce, SaaS, startup, or investor context without evidence."
  }
}

export function getBusinessModelKpiNames(model: BusinessModel): string[] {
  switch (model) {
    case "local_retail":
      return ["Revenue", "Store Performance", "Inventory Value", "Low Stock", "Dead Stock", "Sell-through"]
    case "ecommerce":
      return ["Revenue", "Orders", "Average Order Value", "Customers", "Returns", "Channels"]
    case "saas":
      return ["MRR", "ARR", "Churn", "CAC", "LTV", "Active Users"]
    case "startup":
      return ["Runway", "Burn Rate", "Revenue", "Active Users", "CAC", "LTV"]
    case "investor":
      return ["Portfolio Companies", "Invested Capital", "Valuation", "Ownership", "Stage", "Sector"]
    case "marketplace":
      return ["GMV", "Take Rate", "Commission", "Sellers", "Buyers", "Listings"]
    default:
      return ["Revenue", "Profit", "Profit Margin", "Active Datasets"]
  }
}

export function shouldRenderWorldMapForBusinessModel(input: {
  businessModel: BusinessModel
  mappedLocations: {
    name?: string | null
    countryCode?: string | null
    countryName?: string | null
    latitude?: number | null
    longitude?: number | null
  }[]
}) {
  const validCoordinateCount = input.mappedLocations.filter(
    (location) => Number.isFinite(location.latitude) && Number.isFinite(location.longitude),
  ).length
  const validCountryCount = input.mappedLocations.filter((location) =>
    normalizeCountry(location.countryCode || location.countryName || location.name || null),
  ).length

  if (input.businessModel === "local_retail") return validCoordinateCount >= 2
  if (input.businessModel === "ecommerce" || input.businessModel === "marketplace" || input.businessModel === "investor") {
    return validCoordinateCount > 0 || validCountryCount > 0
  }
  return false
}

function extractBusinessModelFromAnalysis(analysis: unknown): BusinessModel | null {
  if (!analysis || typeof analysis !== "object") return null
  const record = analysis as Record<string, unknown>
  const direct = normalizeBusinessModel(record.businessModel as string | null)
  if (direct) return direct
  const snake = normalizeBusinessModel(record.business_model as string | null)
  if (snake) return snake
  return null
}

function detectBusinessModelFromUploadSource(uploadSource?: string | null, datasetType?: string | null): BusinessModel | null {
  const source = [uploadSource, datasetType].filter(Boolean).join(" ").toLowerCase()
  if (!source) return null
  if (source.includes("retail")) return "local_retail"
  if (source.includes("ecommerce") || source.includes("online_shop") || source.includes("online-store")) return "ecommerce"
  if (source.includes("saas")) return "saas"
  if (source.includes("startup")) return "startup"
  if (source.includes("investor") || source.includes("portfolio")) return "investor"
  if (source.includes("marketplace")) return "marketplace"
  return null
}
