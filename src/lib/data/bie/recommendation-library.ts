import type {
  RecommendationCategory,
  RecommendationLibrary,
  RecommendationLibraryPlugin,
  RecommendationLibraryRegistry,
  RecommendationRuleDefinition,
  RecommendationType,
} from "./recommendation-types";
import type { KPICategory } from "./kpi-types";
import type { InsightType } from "./insight-types";

export class DefaultRecommendationLibraryRegistry implements RecommendationLibraryRegistry {
  readonly version = "bie.recommendation-library-registry.v1";
  private readonly definitions = new Map<string, RecommendationRuleDefinition>();
  private readonly plugins = new Map<string, { id: string; version: string }>();

  constructor(definitions: RecommendationRuleDefinition[] = defaultRecommendationDefinitions) {
    for (const definition of definitions) {
      this.registerDefinition(definition);
    }
  }

  registerDefinition(definition: RecommendationRuleDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Recommendation definition ${definition.id} is already registered.`);
    }

    this.definitions.set(definition.id, Object.freeze({ ...definition }));
  }

  registerPlugin(plugin: RecommendationLibraryPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Recommendation library plugin ${plugin.id} is already registered.`);
    }

    plugin.register(this);
    this.plugins.set(plugin.id, { id: plugin.id, version: plugin.version });
  }

  listDefinitions(): RecommendationRuleDefinition[] {
    return Array.from(this.definitions.values()).sort((first, second) =>
      first.priority === second.priority
        ? first.id.localeCompare(second.id)
        : second.priority - first.priority,
    );
  }

  getDefinition(id: string): RecommendationRuleDefinition | undefined {
    return this.definitions.get(id);
  }

  toLibrary(): RecommendationLibrary {
    return {
      version: "bie.recommendation-library.v1",
      definitions: this.listDefinitions(),
      plugins: Array.from(this.plugins.values()),
    };
  }
}

export function createDefaultRecommendationLibraryRegistry(
  plugins: RecommendationLibraryPlugin[] = [],
): DefaultRecommendationLibraryRegistry {
  const registry = new DefaultRecommendationLibraryRegistry();

  for (const plugin of plugins) {
    registry.registerPlugin(plugin);
  }

  return registry;
}

function define(
  id: string,
  titleTemplate: string,
  category: RecommendationCategory,
  type: RecommendationType,
  supportedInsightTypes: InsightType[],
  supportedKpiCategories: KPICategory[],
  supportedKpiIds: string[],
  extra: Partial<RecommendationRuleDefinition> = {},
): RecommendationRuleDefinition {
  return {
    id,
    version: extra.version ?? "1.0.0",
    titleTemplate,
    descriptionTemplate:
      extra.descriptionTemplate ??
      "Use {{insightTitle}} and supporting KPI evidence to decide the next business action.",
    category,
    type,
    supportedInsightTypes,
    supportedInsightCategories: extra.supportedInsightCategories ?? [],
    supportedKpiCategories,
    supportedKpiIds,
    requiredSemanticCategories: extra.requiredSemanticCategories ?? [],
    businessModels: extra.businessModels ?? ["generic"],
    baseImpact: extra.baseImpact ?? 55,
    baseDifficulty: extra.baseDifficulty ?? "Medium",
    baseBenefit: extra.baseBenefit ?? "Medium",
    estimatedTimeToImplement: extra.estimatedTimeToImplement ?? "2-4 weeks",
    dependsOn: extra.dependsOn ?? [],
    priority: extra.priority ?? 50,
    maxPerRule: extra.maxPerRule ?? 2,
    evidenceSignals: extra.evidenceSignals ?? [
      "recommendation-rule",
      "supporting-insight",
      "supporting-kpi",
      "dataset-quality",
    ],
  };
}

const positiveInsights: InsightType[] = [
  "Positive Finding",
  "Business Opportunity",
  "Performance Improvement",
  "Emerging Trend",
];
const riskInsights: InsightType[] = [
  "Potential Risk",
  "Data Quality Warning",
  "Missing Information",
  "Operational Bottleneck",
  "Negative Finding",
];

export const defaultRecommendationDefinitions: RecommendationRuleDefinition[] = [
  define("revenue-growth-action", "Expand analysis for {{insightTitle}}", "Revenue Growth", "Growth Opportunity", positiveInsights, ["Financial KPIs", "Sales KPIs", "SaaS KPIs"], ["revenue", "sales-growth", "average-order-value", "monthly-recurring-revenue"], {
    requiredSemanticCategories: ["Revenue"],
    businessModels: ["retail", "marketplace", "saas", "restaurant", "startup", "generic"],
    baseImpact: 84,
    baseBenefit: "Very High",
    baseDifficulty: "Medium",
    estimatedTimeToImplement: "2-6 weeks",
    priority: 106,
  }),
  define("profit-optimization-action", "Improve margin evidence for {{insightTitle}}", "Profit Optimization", "Financial Improvement", [...positiveInsights, ...riskInsights], ["Financial KPIs"], ["gross-profit", "net-profit", "margin", "profit-growth"], {
    requiredSemanticCategories: ["Revenue", "Cost"],
    businessModels: ["retail", "marketplace", "manufacturing", "restaurant", "finance", "generic"],
    baseImpact: 82,
    baseBenefit: "High",
    baseDifficulty: "Medium",
    estimatedTimeToImplement: "2-5 weeks",
    priority: 104,
  }),
  define("cost-reduction-action", "Create cost controls from {{insightTitle}}", "Cost Reduction", "Cost Saving Opportunity", [...positiveInsights, ...riskInsights], ["Financial KPIs", "Accounting KPIs", "HR KPIs"], ["cogs", "operating-expenses", "payroll-ratio"], {
    requiredSemanticCategories: ["Cost", "Expense"],
    businessModels: ["retail", "manufacturing", "restaurant", "accounting", "generic"],
    baseImpact: 76,
    baseBenefit: "High",
    baseDifficulty: "Medium",
    estimatedTimeToImplement: "1-4 weeks",
    priority: 96,
  }),
  define("inventory-optimization-action", "Prioritize inventory action for {{insightTitle}}", "Inventory Optimization", "Operational Improvement", riskInsights, ["Inventory KPIs", "Supply Chain KPIs"], ["inventory-turnover", "dead-stock", "stock-coverage", "reorder-risk", "inventory-value"], {
    requiredSemanticCategories: ["Inventory", "Quantity"],
    businessModels: ["retail", "inventory", "manufacturing", "restaurant", "logistics"],
    baseImpact: 86,
    baseBenefit: "High",
    baseDifficulty: "Medium",
    estimatedTimeToImplement: "1-3 weeks",
    dependsOn: ["supplier-optimization-action", "pricing-optimization-action"],
    priority: 108,
  }),
  define("pricing-optimization-action", "Review price bands for {{insightTitle}}", "Pricing Optimization", "Short-Term Improvement", positiveInsights, ["Financial KPIs", "Product KPIs", "Sales KPIs"], ["revenue", "average-order-value", "product-margin", "category-performance"], {
    requiredSemanticCategories: ["Revenue", "Product Name"],
    businessModels: ["retail", "marketplace", "restaurant", "saas", "generic"],
    baseImpact: 74,
    baseBenefit: "High",
    baseDifficulty: "Medium",
    estimatedTimeToImplement: "2-4 weeks",
    dependsOn: ["inventory-optimization-action"],
    priority: 90,
  }),
  define("promotion-optimization-action", "Tune promotions around {{insightTitle}}", "Promotion Optimization", "Quick Win", positiveInsights, ["Marketing KPIs", "Sales KPIs", "Product KPIs"], ["conversion-rate", "sales-growth", "category-performance"], {
    requiredSemanticCategories: ["Revenue", "Category"],
    businessModels: ["retail", "marketplace", "restaurant", "saas"],
    baseImpact: 68,
    baseBenefit: "Medium",
    baseDifficulty: "Low",
    estimatedTimeToImplement: "1-2 weeks",
    priority: 82,
  }),
  define("customer-retention-action", "Protect customer value behind {{insightTitle}}", "Customer Retention", "Short-Term Improvement", [...positiveInsights, ...riskInsights], ["Customer KPIs", "SaaS KPIs"], ["customer-lifetime-value", "order-frequency", "monthly-recurring-revenue"], {
    requiredSemanticCategories: ["Customer"],
    businessModels: ["crm", "saas", "retail", "marketplace", "restaurant", "generic"],
    baseImpact: 80,
    baseBenefit: "High",
    estimatedTimeToImplement: "2-6 weeks",
    priority: 100,
  }),
  define("customer-acquisition-action", "Refine acquisition from {{insightTitle}}", "Customer Acquisition", "Growth Opportunity", positiveInsights, ["Customer KPIs", "Marketing KPIs", "SaaS KPIs"], ["customer-acquisition-cost", "conversion-rate", "monthly-recurring-revenue"], {
    requiredSemanticCategories: ["Customer"],
    businessModels: ["crm", "saas", "startup", "retail", "generic"],
    baseImpact: 76,
    baseBenefit: "High",
    estimatedTimeToImplement: "2-5 weeks",
    priority: 92,
  }),
  define("marketing-optimization-action", "Improve marketing efficiency for {{insightTitle}}", "Marketing Optimization", "Business Process Improvement", [...positiveInsights, ...riskInsights], ["Marketing KPIs", "SaaS KPIs"], ["customer-acquisition-cost", "conversion-rate", "marketing-roi"], {
    requiredSemanticCategories: ["Cost", "Customer"],
    businessModels: ["crm", "saas", "startup", "retail"],
    baseImpact: 70,
    baseBenefit: "Medium",
    estimatedTimeToImplement: "2-4 weeks",
    priority: 84,
  }),
  define("sales-optimization-action", "Focus sales review on {{insightTitle}}", "Sales Optimization", "Short-Term Improvement", positiveInsights, ["Sales KPIs", "SaaS KPIs", "Startup KPIs"], ["average-order-value", "sales-growth", "average-basket-size", "monthly-recurring-revenue"], {
    requiredSemanticCategories: ["Revenue"],
    businessModels: ["retail", "marketplace", "pos", "saas", "startup", "generic"],
    baseImpact: 78,
    baseBenefit: "High",
    estimatedTimeToImplement: "1-4 weeks",
    priority: 98,
  }),
  define("cash-flow-action", "Improve cash flow controls from {{insightTitle}}", "Cash Flow Improvement", "Financial Improvement", [...positiveInsights, ...riskInsights], ["Accounting KPIs", "Financial KPIs"], ["cash-flow", "working-capital", "current-ratio"], {
    requiredSemanticCategories: ["Payment", "Date"],
    businessModels: ["accounting", "finance", "retail", "generic"],
    baseImpact: 88,
    baseBenefit: "Very High",
    estimatedTimeToImplement: "1-4 weeks",
    priority: 110,
  }),
  define("accounting-improvement-action", "Strengthen accounting controls for {{insightTitle}}", "Accounting Improvements", "Compliance Improvement", riskInsights, ["Accounting KPIs", "Compliance KPIs"], ["accounts-receivable", "accounts-payable", "current-ratio", "debt-ratio"], {
    requiredSemanticCategories: ["Invoice", "Payment"],
    businessModels: ["accounting", "finance", "retail", "manufacturing", "generic"],
    baseImpact: 80,
    baseBenefit: "High",
    estimatedTimeToImplement: "2-6 weeks",
    priority: 102,
  }),
  define("tax-preparation-action", "Prepare tax context from {{insightTitle}}", "Tax Preparation", "Compliance Improvement", riskInsights, ["Accounting KPIs", "Compliance KPIs"], ["operating-expenses", "accounts-receivable", "accounts-payable"], {
    requiredSemanticCategories: ["Tax", "Invoice"],
    businessModels: ["accounting", "finance", "retail", "generic"],
    baseImpact: 62,
    baseBenefit: "Medium",
    estimatedTimeToImplement: "2-4 weeks",
    priority: 68,
  }),
  define("supplier-optimization-action", "Review supplier actions for {{insightTitle}}", "Supplier Optimization", "Operational Improvement", riskInsights, ["Supply Chain KPIs", "Inventory KPIs", "Accounting KPIs"], ["accounts-payable", "inventory-turnover", "reorder-risk"], {
    requiredSemanticCategories: ["Supplier"],
    businessModels: ["retail", "inventory", "manufacturing", "restaurant", "logistics"],
    baseImpact: 72,
    baseBenefit: "High",
    estimatedTimeToImplement: "2-5 weeks",
    priority: 88,
  }),
  define("procurement-optimization-action", "Improve procurement from {{insightTitle}}", "Procurement Optimization", "Cost Saving Opportunity", riskInsights, ["Supply Chain KPIs", "Inventory KPIs"], ["inventory-turnover", "stock-coverage", "inventory-value"], {
    requiredSemanticCategories: ["Inventory", "Supplier"],
    businessModels: ["retail", "inventory", "manufacturing", "restaurant", "logistics"],
    baseImpact: 70,
    baseBenefit: "High",
    estimatedTimeToImplement: "2-6 weeks",
    priority: 86,
  }),
  define("employee-productivity-action", "Improve workforce productivity from {{insightTitle}}", "Employee Productivity", "Operational Improvement", [...positiveInsights, ...riskInsights], ["HR KPIs", "Operational KPIs"], ["employee-productivity", "payroll-ratio"], {
    requiredSemanticCategories: ["Employee"],
    businessModels: ["hr", "healthcare", "manufacturing", "hospitality", "generic"],
    baseImpact: 64,
    baseBenefit: "Medium",
    estimatedTimeToImplement: "3-8 weeks",
    priority: 74,
  }),
  define("warehouse-optimization-action", "Improve warehouse operations from {{insightTitle}}", "Warehouse Optimization", "Operational Improvement", riskInsights, ["Supply Chain KPIs", "Inventory KPIs"], ["warehouse-utilization", "stock-coverage", "inventory-turnover"], {
    requiredSemanticCategories: ["Warehouse", "Inventory"],
    businessModels: ["inventory", "manufacturing", "logistics", "retail"],
    baseImpact: 72,
    baseBenefit: "High",
    estimatedTimeToImplement: "2-6 weeks",
    priority: 84,
  }),
  define("store-optimization-action", "Improve store execution from {{insightTitle}}", "Store Optimization", "Operational Improvement", [...positiveInsights, ...riskInsights], ["Operational KPIs", "Sales KPIs"], ["store-performance", "sales-growth"], {
    requiredSemanticCategories: ["Store", "Revenue"],
    businessModels: ["retail", "restaurant", "hospitality"],
    baseImpact: 72,
    baseBenefit: "High",
    estimatedTimeToImplement: "2-4 weeks",
    priority: 86,
  }),
  define("forecast-improvement-action", "Improve forecast readiness for {{insightTitle}}", "Forecast Improvement", "Missing Data Suggestion", riskInsights, ["Financial KPIs", "Sales KPIs", "Operational KPIs"], ["sales-growth", "profit-growth", "stock-coverage"], {
    requiredSemanticCategories: ["Date"],
    businessModels: ["generic", "retail", "saas", "inventory", "manufacturing"],
    baseImpact: 58,
    baseBenefit: "Medium",
    baseDifficulty: "Low",
    estimatedTimeToImplement: "1-3 weeks",
    priority: 64,
  }),
  define("business-health-action", "Prioritize business health review for {{insightTitle}}", "Business Health", "Strategic Improvement", positiveInsights, ["Business Health KPIs", "Executive KPIs"], ["business-health-score", "data-quality-score", "bi-readiness"], {
    businessModels: ["generic", "retail", "saas", "marketplace", "accounting", "manufacturing"],
    baseImpact: 84,
    baseBenefit: "Very High",
    estimatedTimeToImplement: "2-6 weeks",
    priority: 105,
  }),
  define("ai-readiness-action", "Prepare AI readiness work from {{insightTitle}}", "AI Readiness", "Automation Suggestion", [...positiveInsights, ...riskInsights], ["AI Readiness KPIs", "Business Health KPIs"], ["bi-readiness", "data-quality-score"], {
    businessModels: ["generic", "retail", "saas", "accounting", "manufacturing"],
    baseImpact: 60,
    baseBenefit: "Medium",
    baseDifficulty: "Low",
    estimatedTimeToImplement: "1-3 weeks",
    priority: 66,
  }),
  define("automation-opportunity-action", "Automate the process behind {{insightTitle}}", "Automation Opportunities", "Automation Suggestion", ["Performance Improvement", "Operational Bottleneck", "Missing Information"], ["Operational KPIs", "Accounting KPIs", "Business Health KPIs"], ["employee-productivity", "operating-expenses", "data-quality-score"], {
    businessModels: ["generic", "accounting", "retail", "manufacturing", "healthcare"],
    baseImpact: 66,
    baseBenefit: "Medium",
    estimatedTimeToImplement: "3-8 weeks",
    priority: 70,
  }),
  define("data-quality-action", "Fix data quality gaps behind {{insightTitle}}", "Data Quality Improvements", "Missing Data Suggestion", riskInsights, ["Business Health KPIs", "AI Readiness KPIs"], ["data-quality-score", "bi-readiness"], {
    businessModels: ["generic", "retail", "saas", "accounting", "manufacturing"],
    baseImpact: 68,
    baseBenefit: "High",
    baseDifficulty: "Low",
    estimatedTimeToImplement: "1-2 weeks",
    priority: 94,
  }),
  define("risk-reduction-action", "Reduce risk indicated by {{insightTitle}}", "Risk Reduction", "Risk Mitigation", riskInsights, ["Risk KPIs", "Compliance KPIs", "Business Health KPIs"], ["return-rate", "refund-rate", "reorder-risk", "data-quality-score"], {
    businessModels: ["generic", "retail", "marketplace", "inventory", "finance"],
    baseImpact: 88,
    baseBenefit: "Very High",
    estimatedTimeToImplement: "1-4 weeks",
    priority: 112,
  }),
  define("compliance-improvement-action", "Improve compliance evidence for {{insightTitle}}", "Compliance Improvements", "Compliance Improvement", riskInsights, ["Compliance KPIs", "Accounting KPIs"], ["accounts-receivable", "accounts-payable", "debt-ratio"], {
    requiredSemanticCategories: ["Invoice", "Tax"],
    businessModels: ["accounting", "finance", "healthcare", "hr", "manufacturing", "generic"],
    baseImpact: 70,
    baseBenefit: "High",
    estimatedTimeToImplement: "2-6 weeks",
    priority: 78,
  }),
];
