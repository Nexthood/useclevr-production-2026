import type {
  InsightCategory,
  InsightGroup,
  InsightLibrary,
  InsightLibraryPlugin,
  InsightLibraryRegistry,
  InsightRuleDefinition,
  InsightType,
} from "./insight-types";
import type { KPICategory } from "./kpi-types";

export class DefaultInsightLibraryRegistry implements InsightLibraryRegistry {
  readonly version = "bie.insight-library-registry.v1";
  private readonly definitions = new Map<string, InsightRuleDefinition>();
  private readonly plugins = new Map<string, { id: string; version: string }>();

  constructor(definitions: InsightRuleDefinition[] = defaultInsightDefinitions) {
    for (const definition of definitions) {
      this.registerDefinition(definition);
    }
  }

  registerDefinition(definition: InsightRuleDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Insight definition ${definition.id} is already registered.`);
    }

    this.definitions.set(definition.id, Object.freeze({ ...definition }));
  }

  registerPlugin(plugin: InsightLibraryPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Insight library plugin ${plugin.id} is already registered.`);
    }

    plugin.register(this);
    this.plugins.set(plugin.id, { id: plugin.id, version: plugin.version });
  }

  listDefinitions(): InsightRuleDefinition[] {
    return Array.from(this.definitions.values()).sort((first, second) =>
      first.priority === second.priority
        ? first.id.localeCompare(second.id)
        : second.priority - first.priority,
    );
  }

  getDefinition(id: string): InsightRuleDefinition | undefined {
    return this.definitions.get(id);
  }

  toLibrary(): InsightLibrary {
    return {
      version: "bie.insight-library.v1",
      definitions: this.listDefinitions(),
      plugins: Array.from(this.plugins.values()),
    };
  }
}

export function createDefaultInsightLibraryRegistry(
  plugins: InsightLibraryPlugin[] = [],
): DefaultInsightLibraryRegistry {
  const registry = new DefaultInsightLibraryRegistry();

  for (const plugin of plugins) {
    registry.registerPlugin(plugin);
  }

  return registry;
}

function define(
  id: string,
  titleTemplate: string,
  category: InsightCategory,
  group: InsightGroup,
  insightType: InsightType,
  supportedKpiCategories: KPICategory[],
  supportedKpiIds: string[],
  extra: Partial<InsightRuleDefinition> = {},
): InsightRuleDefinition {
  return {
    id,
    version: extra.version ?? "1.0.0",
    titleTemplate,
    descriptionTemplate:
      extra.descriptionTemplate ??
      "{{kpiName}} is supported by the detected dataset profile and should be monitored as a business signal.",
    category,
    group,
    insightType,
    supportedKpiCategories,
    supportedKpiIds,
    requiredSemanticCategories: extra.requiredSemanticCategories ?? [],
    businessModels: extra.businessModels ?? ["generic"],
    baseImpact: extra.baseImpact ?? 55,
    baseSeverity: extra.baseSeverity ?? "info",
    priority: extra.priority ?? 50,
    maxPerRule: extra.maxPerRule ?? 3,
    evidenceSignals: extra.evidenceSignals ?? ["kpi", "insight-rule", "dataset-quality"],
  };
}

export const defaultInsightDefinitions: InsightRuleDefinition[] = [
  define("revenue-visibility", "{{kpiName}} is visible for revenue analysis", "Revenue Insights", "Financial", "Positive Finding", ["Financial KPIs", "Sales KPIs"], ["revenue", "gross-revenue", "net-revenue", "sales-growth"], {
    requiredSemanticCategories: ["Revenue"],
    businessModels: ["retail", "marketplace", "saas", "restaurant", "finance", "generic"],
    baseImpact: 82,
    baseSeverity: "positive",
    priority: 100,
    descriptionTemplate: "{{kpiName}} has enough detected source fields to support revenue investigation.",
  }),
  define("profit-coverage-gap", "{{kpiName}} needs stronger profit evidence", "Profit Insights", "Financial", "Missing Information", ["Financial KPIs"], ["gross-profit", "net-profit", "margin", "profit-growth"], {
    requiredSemanticCategories: ["Profit", "Cost"],
    businessModels: ["retail", "marketplace", "manufacturing", "restaurant", "finance", "generic"],
    baseImpact: 76,
    baseSeverity: "warning",
    priority: 96,
    descriptionTemplate: "{{kpiName}} cannot be fully trusted until missing profit, cost, or margin fields are configured.",
  }),
  define("cost-monitoring", "{{kpiName}} creates cost control visibility", "Cost Insights", "Financial", "Performance Improvement", ["Financial KPIs", "Accounting KPIs"], ["cogs", "operating-expenses", "payroll-ratio"], {
    requiredSemanticCategories: ["Cost", "Expense"],
    businessModels: ["retail", "manufacturing", "restaurant", "accounting", "generic"],
    baseImpact: 72,
    baseSeverity: "notice",
    priority: 90,
  }),
  define("customer-signal", "{{kpiName}} identifies customer performance signals", "Customer Insights", "Customer", "Business Opportunity", ["Customer KPIs", "Marketing KPIs", "SaaS KPIs"], ["customer-lifetime-value", "customer-acquisition-cost", "order-frequency", "monthly-recurring-revenue"], {
    requiredSemanticCategories: ["Customer"],
    businessModels: ["crm", "saas", "retail", "marketplace", "restaurant", "generic"],
    baseImpact: 74,
    baseSeverity: "notice",
    priority: 88,
  }),
  define("inventory-risk", "{{kpiName}} exposes inventory risk", "Inventory Insights", "Inventory", "Potential Risk", ["Inventory KPIs", "Supply Chain KPIs"], ["inventory-turnover", "dead-stock", "stock-coverage", "reorder-risk", "inventory-value"], {
    requiredSemanticCategories: ["Inventory", "Quantity"],
    businessModels: ["retail", "inventory", "manufacturing", "restaurant", "logistics"],
    baseImpact: 80,
    baseSeverity: "warning",
    priority: 94,
  }),
  define("sales-performance", "{{kpiName}} supports sales performance analysis", "Sales Insights", "Commercial", "Positive Finding", ["Sales KPIs", "SaaS KPIs", "Startup KPIs"], ["average-order-value", "sales-growth", "average-basket-size", "monthly-recurring-revenue"], {
    requiredSemanticCategories: ["Revenue", "Order"],
    businessModels: ["retail", "marketplace", "pos", "saas", "startup", "generic"],
    baseImpact: 78,
    baseSeverity: "positive",
    priority: 92,
  }),
  define("product-performance", "{{kpiName}} links product data to performance", "Product Insights", "Commercial", "Business Opportunity", ["Product KPIs", "Inventory KPIs"], ["product-margin", "category-performance", "inventory-turnover", "dead-stock"], {
    requiredSemanticCategories: ["SKU", "Product Name", "Category"],
    businessModels: ["retail", "marketplace", "inventory", "manufacturing", "restaurant"],
    baseImpact: 70,
    baseSeverity: "notice",
    priority: 80,
  }),
  define("marketing-efficiency", "{{kpiName}} enables marketing efficiency review", "Marketing Insights", "Marketing", "Performance Improvement", ["Marketing KPIs", "SaaS KPIs"], ["customer-acquisition-cost", "conversion-rate", "marketing-roi"], {
    requiredSemanticCategories: ["Cost", "Customer"],
    businessModels: ["crm", "saas", "startup", "retail"],
    baseImpact: 68,
    baseSeverity: "notice",
    priority: 76,
  }),
  define("accounting-control", "{{kpiName}} supports accounting control checks", "Accounting Insights", "Accounting", "Potential Risk", ["Accounting KPIs", "Compliance KPIs"], ["cash-flow", "accounts-receivable", "accounts-payable", "current-ratio", "debt-ratio"], {
    requiredSemanticCategories: ["Invoice", "Payment"],
    businessModels: ["accounting", "finance", "retail", "manufacturing", "generic"],
    baseImpact: 82,
    baseSeverity: "warning",
    priority: 98,
  }),
  define("cash-flow-readiness", "{{kpiName}} gives cash flow readiness", "Cash Flow Insights", "Accounting", "Positive Finding", ["Accounting KPIs", "Financial KPIs"], ["cash-flow", "working-capital", "current-ratio"], {
    requiredSemanticCategories: ["Payment", "Date"],
    businessModels: ["accounting", "finance", "retail", "generic"],
    baseImpact: 84,
    baseSeverity: "positive",
    priority: 99,
  }),
  define("employee-operational-signal", "{{kpiName}} identifies workforce operating signals", "Employee Insights", "Operational", "Operational Bottleneck", ["HR KPIs", "Operational KPIs"], ["employee-productivity", "payroll-ratio"], {
    requiredSemanticCategories: ["Employee"],
    businessModels: ["hr", "healthcare", "manufacturing", "hospitality", "generic"],
    baseImpact: 62,
    baseSeverity: "notice",
    priority: 66,
  }),
  define("department-view", "{{kpiName}} supports department-level review", "Department Insights", "Operational", "Performance Improvement", ["Operational KPIs", "Accounting KPIs", "HR KPIs"], ["department-performance", "operating-expenses", "employee-productivity"], {
    requiredSemanticCategories: ["Department"],
    businessModels: ["accounting", "finance", "hr", "manufacturing", "generic"],
    baseImpact: 60,
    baseSeverity: "notice",
    priority: 62,
  }),
  define("operational-health", "{{kpiName}} strengthens operational health tracking", "Operational Insights", "Operational", "Positive Finding", ["Operational KPIs", "Manufacturing KPIs", "Restaurant KPIs", "Healthcare KPIs", "Hospitality KPIs", "Logistics KPIs"], [], {
    businessModels: ["manufacturing", "restaurant", "healthcare", "hospitality", "logistics", "generic"],
    baseImpact: 70,
    baseSeverity: "positive",
    priority: 72,
  }),
  define("business-health", "{{kpiName}} contributes to business health scoring", "Business Health Insights", "Executive", "Positive Finding", ["Business Health KPIs", "Executive KPIs"], ["business-health-score", "data-quality-score", "bi-readiness"], {
    businessModels: ["generic", "retail", "saas", "marketplace", "accounting"],
    baseImpact: 86,
    baseSeverity: "positive",
    priority: 102,
  }),
  define("risk-indicator", "{{kpiName}} should be investigated as a risk signal", "Risk Insights", "Risk", "Potential Risk", ["Risk KPIs", "Compliance KPIs", "Business Health KPIs"], ["return-rate", "refund-rate", "reorder-risk", "data-quality-score"], {
    businessModels: ["generic", "retail", "marketplace", "inventory", "finance"],
    baseImpact: 88,
    baseSeverity: "warning",
    priority: 104,
  }),
  define("growth-signal", "{{kpiName}} provides a growth signal", "Growth Insights", "Executive", "Emerging Trend", ["Sales KPIs", "Financial KPIs", "Startup KPIs", "SaaS KPIs"], ["sales-growth", "profit-growth", "monthly-recurring-revenue"], {
    requiredSemanticCategories: ["Date"],
    businessModels: ["saas", "startup", "retail", "marketplace", "generic"],
    baseImpact: 78,
    baseSeverity: "notice",
    priority: 86,
  }),
  define("forecast-readiness", "{{kpiName}} indicates forecast readiness", "Forecast Insights", "Forecast", "Missing Information", ["Financial KPIs", "Sales KPIs", "Operational KPIs"], ["sales-growth", "profit-growth", "stock-coverage"], {
    requiredSemanticCategories: ["Date"],
    businessModels: ["generic", "retail", "saas", "inventory", "manufacturing"],
    baseImpact: 58,
    baseSeverity: "info",
    priority: 58,
    descriptionTemplate: "{{kpiName}} can support forecasting only when date coverage and source metrics are strong enough.",
  }),
  define("executive-focus", "{{kpiName}} belongs in executive review", "Executive Insights", "Executive", "Positive Finding", ["Executive KPIs", "Business Health KPIs", "Financial KPIs", "Risk KPIs"], ["revenue", "gross-profit", "cash-flow", "business-health-score"], {
    businessModels: ["generic", "retail", "saas", "marketplace", "accounting", "manufacturing"],
    baseImpact: 90,
    baseSeverity: "positive",
    priority: 106,
  }),
];
