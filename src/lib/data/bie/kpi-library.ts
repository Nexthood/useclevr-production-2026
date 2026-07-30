import type {
  KPIDefinition,
  KPILibrary,
  KPILibraryPlugin,
  KPILibraryRegistry,
  KPICategory,
} from "./kpi-types";

export class DefaultKPILibraryRegistry implements KPILibraryRegistry {
  readonly version = "bie.kpi-library-registry.v1";
  private readonly definitions = new Map<string, KPIDefinition>();
  private readonly plugins = new Map<string, { id: string; version: string }>();

  constructor(definitions: KPIDefinition[] = defaultKPIDefinitions) {
    for (const definition of definitions) {
      this.registerDefinition(definition);
    }
  }

  registerDefinition(definition: KPIDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`KPI definition ${definition.id} is already registered.`);
    }

    this.definitions.set(definition.id, Object.freeze({ ...definition }));
  }

  registerPlugin(plugin: KPILibraryPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`KPI library plugin ${plugin.id} is already registered.`);
    }

    plugin.register(this);
    this.plugins.set(plugin.id, { id: plugin.id, version: plugin.version });
  }

  listDefinitions(): KPIDefinition[] {
    return Array.from(this.definitions.values()).sort((first, second) =>
      first.name.localeCompare(second.name),
    );
  }

  getDefinition(id: string): KPIDefinition | undefined {
    return this.definitions.get(id);
  }

  toLibrary(): KPILibrary {
    return {
      version: "bie.kpi-library.v1",
      definitions: this.listDefinitions(),
      plugins: Array.from(this.plugins.values()),
    };
  }
}

export function createDefaultKPILibraryRegistry(
  plugins: KPILibraryPlugin[] = [],
): DefaultKPILibraryRegistry {
  const registry = new DefaultKPILibraryRegistry();

  for (const plugin of plugins) {
    registry.registerPlugin(plugin);
  }

  return registry;
}

const allModels = [
  "retail",
  "marketplace",
  "pos",
  "inventory",
  "accounting",
  "crm",
  "saas",
  "manufacturing",
  "healthcare",
  "finance",
  "hr",
  "restaurant",
  "hospitality",
  "logistics",
  "startup",
  "generic",
];

const byCategory: Record<KPICategory, string[]> = {
  "Financial KPIs": ["retail", "marketplace", "accounting", "finance", "saas", "manufacturing", "generic"],
  "Sales KPIs": ["retail", "marketplace", "pos", "crm", "saas", "restaurant", "hospitality", "generic"],
  "Customer KPIs": ["retail", "marketplace", "crm", "saas", "restaurant", "hospitality", "generic"],
  "Inventory KPIs": ["retail", "inventory", "manufacturing", "restaurant", "hospitality", "logistics"],
  "Marketing KPIs": ["crm", "saas", "retail", "marketplace", "startup"],
  "Operational KPIs": allModels,
  "Product KPIs": ["retail", "marketplace", "inventory", "manufacturing", "saas", "restaurant"],
  "Accounting KPIs": ["accounting", "finance", "retail", "manufacturing", "generic"],
  "Supply Chain KPIs": ["inventory", "manufacturing", "logistics", "retail", "restaurant"],
  "HR KPIs": ["hr", "manufacturing", "hospitality", "healthcare", "generic"],
  "Manufacturing KPIs": ["manufacturing"],
  "Restaurant KPIs": ["restaurant", "hospitality"],
  "Healthcare KPIs": ["healthcare"],
  "Hospitality KPIs": ["hospitality", "restaurant"],
  "Logistics KPIs": ["logistics", "supply-chain"],
  "SaaS KPIs": ["saas", "startup"],
  "Startup KPIs": ["startup", "saas"],
  "Executive KPIs": allModels,
  "Risk KPIs": allModels,
  "Compliance KPIs": ["accounting", "finance", "healthcare", "hr", "manufacturing", "generic"],
  "AI Readiness KPIs": allModels,
  "Business Health KPIs": allModels,
};

function define(
  id: string,
  name: string,
  category: KPICategory,
  requiredFields: KPIDefinition["requiredFields"],
  optionalFields: KPIDefinition["optionalFields"],
  dependencies: string[],
  extra: Partial<KPIDefinition> = {},
): KPIDefinition {
  return {
    id,
    name,
    category,
    description: extra.description ?? `${name} measures a relevant ${category.toLowerCase()} signal when source data supports it.`,
    businessModels: extra.businessModels ?? byCategory[category],
    industries: extra.industries ?? byCategory[category],
    formula: {
      expression: extra.formula?.expression ?? name,
      dependsOn: dependencies,
      requiredSemanticCategories: requiredFields,
      optionalSemanticCategories: optionalFields,
      requiresUserInput: extra.formula?.requiresUserInput,
    },
    dependencies,
    requiredFields,
    optionalFields,
    visualizationRecommendations: extra.visualizationRecommendations ?? ["scorecard", "trend"],
    thresholds: extra.thresholds ?? [],
    units: extra.units ?? ["count"],
    supportedCurrencies: extra.supportedCurrencies ?? [],
    version: extra.version ?? "1.0.0",
    relevanceSignals: {
      semanticCategories: extra.relevanceSignals?.semanticCategories ?? [...requiredFields, ...optionalFields],
      entityTypes: extra.relevanceSignals?.entityTypes ?? [],
      relationshipTypes: extra.relevanceSignals?.relationshipTypes ?? [],
      maturityDimensions: extra.relevanceSignals?.maturityDimensions ?? [],
      vocabulary: extra.relevanceSignals?.vocabulary ?? [],
    },
  };
}

export const defaultKPIDefinitions: KPIDefinition[] = [
  define("revenue", "Revenue", "Financial KPIs", ["Revenue"], ["Date", "Currency"], [], {
    units: ["money"],
    visualizationRecommendations: ["scorecard", "line-chart", "bar-chart"],
  }),
  define("gross-revenue", "Gross Revenue", "Financial KPIs", ["Revenue"], ["Discount", "Status", "Date"], ["revenue"], {
    units: ["money"],
  }),
  define("net-revenue", "Net Revenue", "Financial KPIs", ["Revenue"], ["Discount", "Tax", "Date"], ["revenue"], {
    units: ["money"],
  }),
  define("gross-profit", "Gross Profit", "Financial KPIs", ["Revenue", "Cost"], ["Date", "Currency"], ["revenue"], {
    units: ["money"],
  }),
  define("net-profit", "Net Profit", "Financial KPIs", ["Revenue", "Cost", "Expense"], ["Tax", "Date"], ["gross-profit"], {
    units: ["money"],
  }),
  define("margin", "Margin", "Financial KPIs", ["Revenue", "Cost"], ["Profit"], ["gross-profit"], {
    units: ["percentage"],
  }),
  define("cogs", "COGS", "Financial KPIs", ["Cost"], ["SKU", "Product Name"], [], {
    units: ["money"],
    businessModels: ["retail", "manufacturing", "restaurant", "inventory", "generic"],
  }),
  define("average-order-value", "Average Order Value", "Sales KPIs", ["Revenue", "Order"], ["Customer", "Date"], ["revenue"], {
    units: ["money"],
    relevanceSignals: { semanticCategories: ["Revenue", "Order"], entityTypes: ["Order"], relationshipTypes: ["Customer -> Order"], maturityDimensions: ["Sales Maturity"], vocabulary: ["basket", "order"] },
  }),
  define("sales-growth", "Sales Growth", "Sales KPIs", ["Revenue", "Date"], ["Region", "Store"], ["revenue"], {
    units: ["percentage"],
  }),
  define("profit-growth", "Profit Growth", "Financial KPIs", ["Profit", "Date"], ["Revenue", "Cost"], ["gross-profit"], {
    units: ["percentage"],
  }),
  define("customer-lifetime-value", "Customer Lifetime Value", "Customer KPIs", ["Customer", "Revenue", "Date"], ["Order"], ["revenue"], {
    units: ["money"],
  }),
  define("customer-acquisition-cost", "Customer Acquisition Cost", "Marketing KPIs", ["Cost", "Customer"], ["Date"], [], {
    units: ["money"],
  }),
  define("conversion-rate", "Conversion Rate", "Marketing KPIs", ["Status"], ["Customer", "Date"], [], {
    units: ["percentage"],
    formula: { expression: "converted / total", dependsOn: [], requiredSemanticCategories: ["Status"], optionalSemanticCategories: ["Customer", "Date"], requiresUserInput: true },
  }),
  define("order-frequency", "Order Frequency", "Customer KPIs", ["Customer", "Order", "Date"], ["Revenue"], ["average-order-value"], {
    units: ["ratio"],
  }),
  define("average-basket-size", "Average Basket Size", "Sales KPIs", ["Order", "Quantity"], ["Revenue", "SKU"], ["average-order-value"], {
    units: ["count"],
  }),
  define("return-rate", "Return Rate", "Risk KPIs", ["Status", "Order"], ["Revenue", "Date"], [], {
    units: ["percentage"],
  }),
  define("refund-rate", "Refund Rate", "Risk KPIs", ["Status", "Revenue"], ["Date", "Order"], ["revenue"], {
    units: ["percentage"],
  }),
  define("inventory-turnover", "Inventory Turnover", "Inventory KPIs", ["Inventory", "Quantity"], ["Revenue", "Cost", "SKU"], ["cogs"], {
    units: ["ratio"],
    relevanceSignals: { semanticCategories: ["Inventory", "Quantity", "SKU"], entityTypes: ["Inventory Item", "Product"], relationshipTypes: ["Warehouse -> Inventory", "Store -> Inventory"], maturityDimensions: ["Inventory Maturity"], vocabulary: ["stock", "inventory"] },
  }),
  define("dead-stock", "Dead Stock", "Inventory KPIs", ["Inventory", "SKU"], ["Date", "Quantity", "Product Name"], ["inventory-turnover"], {
    units: ["count"],
  }),
  define("stock-coverage", "Stock Coverage", "Inventory KPIs", ["Inventory", "Quantity"], ["Date", "SKU"], ["inventory-turnover"], {
    units: ["days"],
  }),
  define("reorder-risk", "Reorder Risk", "Inventory KPIs", ["Inventory", "Quantity"], ["SKU", "Warehouse", "Store"], ["stock-coverage"], {
    units: ["score"],
  }),
  define("operating-expenses", "Operating Expenses", "Accounting KPIs", ["Expense"], ["Department", "Date", "Currency"], [], {
    units: ["money"],
  }),
  define("payroll-ratio", "Payroll Ratio", "HR KPIs", ["Employee", "Expense"], ["Revenue", "Department"], ["operating-expenses"], {
    units: ["percentage"],
  }),
  define("cash-flow", "Cash Flow", "Accounting KPIs", ["Payment", "Date"], ["Revenue", "Expense"], [], {
    units: ["money"],
  }),
  define("working-capital", "Working Capital", "Accounting KPIs", ["Payment"], ["Invoice", "Expense", "Date"], ["cash-flow"], {
    units: ["money"],
  }),
  define("accounts-receivable", "Accounts Receivable", "Accounting KPIs", ["Invoice", "Payment"], ["Customer", "Date"], [], {
    units: ["money"],
  }),
  define("accounts-payable", "Accounts Payable", "Accounting KPIs", ["Invoice", "Supplier"], ["Payment", "Date"], [], {
    units: ["money"],
  }),
  define("current-ratio", "Current Ratio", "Accounting KPIs", ["Payment"], ["Expense", "Invoice"], ["working-capital"], {
    units: ["ratio"],
  }),
  define("debt-ratio", "Debt Ratio", "Financial KPIs", ["Expense"], ["Payment", "Revenue"], [], {
    units: ["ratio"],
    formula: { expression: "debt / assets", dependsOn: [], requiredSemanticCategories: ["Expense"], optionalSemanticCategories: ["Payment", "Revenue"], requiresUserInput: true },
  }),
  define("inventory-value", "Inventory Value", "Inventory KPIs", ["Inventory"], ["Cost", "SKU", "Warehouse"], [], {
    units: ["money"],
  }),
  define("employee-productivity", "Employee Productivity", "Operational KPIs", ["Employee"], ["Revenue", "Department", "Date"], [], {
    units: ["ratio"],
  }),
  define("warehouse-utilization", "Warehouse Utilization", "Supply Chain KPIs", ["Warehouse", "Inventory"], ["Quantity", "SKU"], ["inventory-value"], {
    units: ["percentage"],
  }),
  define("store-performance", "Store Performance", "Operational KPIs", ["Store", "Revenue"], ["Employee", "Inventory", "Date"], ["revenue"], {
    units: ["money", "score"],
  }),
  define("department-performance", "Department Performance", "Operational KPIs", ["Department"], ["Revenue", "Expense", "Employee"], [], {
    units: ["score"],
  }),
  define("project-profitability", "Project Profitability", "Financial KPIs", ["Revenue", "Expense"], ["Employee", "Date"], ["net-profit"], {
    units: ["money", "percentage"],
  }),
  define("forecast-accuracy", "Forecast Accuracy", "Business Health KPIs", ["Date"], ["Revenue", "Quantity", "Inventory"], [], {
    units: ["percentage"],
    formula: { expression: "actual / forecast", dependsOn: [], requiredSemanticCategories: ["Date"], optionalSemanticCategories: ["Revenue", "Quantity", "Inventory"], requiresUserInput: true },
  }),
  define("monthly-recurring-revenue", "Monthly Recurring Revenue", "SaaS KPIs", ["Revenue", "Date"], ["Customer", "Status"], ["revenue"], {
    units: ["money"],
    businessModels: ["saas", "startup"],
    relevanceSignals: { semanticCategories: ["Revenue", "Date", "Customer", "Status"], entityTypes: ["Subscription", "Customer"], relationshipTypes: ["Subscription -> Customer"], maturityDimensions: ["Sales Maturity"], vocabulary: ["subscription", "plan", "mrr", "monthly"] },
  }),
  define("annual-recurring-revenue", "Annual Recurring Revenue", "SaaS KPIs", ["Revenue", "Date"], ["Customer", "Status"], ["monthly-recurring-revenue"], {
    units: ["money"],
    businessModels: ["saas", "startup"],
  }),
  define("churn", "Churn", "SaaS KPIs", ["Customer", "Status", "Date"], ["Revenue"], ["monthly-recurring-revenue"], {
    units: ["percentage"],
    businessModels: ["saas", "startup"],
  }),
  define("retention", "Retention", "Customer KPIs", ["Customer", "Date"], ["Status", "Revenue"], ["churn"], {
    units: ["percentage"],
  }),
  define("manufacturing-yield", "Manufacturing Yield", "Manufacturing KPIs", ["Quantity"], ["Product Name", "Cost", "Status"], [], {
    units: ["percentage"],
    businessModels: ["manufacturing"],
  }),
  define("patient-volume", "Patient Volume", "Healthcare KPIs", ["Customer", "Date"], ["Status", "Region"], [], {
    units: ["count"],
    businessModels: ["healthcare"],
  }),
  define("occupancy-rate", "Occupancy Rate", "Hospitality KPIs", ["Status", "Date"], ["Revenue", "Customer"], [], {
    units: ["percentage"],
    businessModels: ["hospitality"],
  }),
  define("table-turnover", "Table Turnover", "Restaurant KPIs", ["Order", "Date"], ["Revenue", "Customer"], [], {
    units: ["ratio"],
    businessModels: ["restaurant"],
  }),
  define("delivery-performance", "Delivery Performance", "Logistics KPIs", ["Status", "Date"], ["Order", "Region"], [], {
    units: ["percentage"],
    businessModels: ["logistics"],
  }),
  define("business-health-score", "Business Health Score", "Business Health KPIs", ["Revenue"], ["Cost", "Date", "Customer", "Inventory"], [], {
    units: ["score"],
    relevanceSignals: { semanticCategories: ["Revenue", "Cost", "Date", "Customer", "Inventory"], entityTypes: ["Customer", "Product"], relationshipTypes: [], maturityDimensions: ["Business Intelligence Maturity", "Data Quality Maturity"], vocabulary: ["health", "risk"] },
  }),
  define("ai-readiness-score", "AI Readiness Score", "AI Readiness KPIs", [], ["Date", "Customer", "Revenue", "Status"], [], {
    units: ["score"],
    formula: { expression: "profile.aiReadiness", dependsOn: [], requiredSemanticCategories: [], optionalSemanticCategories: ["Date", "Customer", "Revenue", "Status"], requiresUserInput: false },
    relevanceSignals: { semanticCategories: ["Date", "Customer", "Revenue", "Status"], entityTypes: ["Customer", "Order"], relationshipTypes: [], maturityDimensions: ["AI Adoption Readiness"], vocabulary: ["automation", "ai", "workflow"] },
  }),
];
