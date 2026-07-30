import type {
  ForecastCategory,
  ForecastLibrary,
  ForecastLibraryPlugin,
  ForecastLibraryRegistry,
  ForecastModelDefinition,
  ForecastModelType,
  ScenarioDefinition,
  ScenarioType,
} from "./forecast-types";
import type { KPICategory } from "./kpi-types";
import type { SemanticCategory } from "../edie";

export class DefaultForecastLibraryRegistry implements ForecastLibraryRegistry {
  readonly version = "bie.forecast-library-registry.v1";
  private readonly models = new Map<string, ForecastModelDefinition>();
  private readonly scenarios = new Map<string, ScenarioDefinition>();
  private readonly plugins = new Map<string, { id: string; version: string }>();

  constructor(
    models: ForecastModelDefinition[] = defaultForecastModels,
    scenarios: ScenarioDefinition[] = defaultScenarioDefinitions,
  ) {
    for (const model of models) {
      this.registerModel(model);
    }

    for (const scenario of scenarios) {
      this.registerScenario(scenario);
    }
  }

  registerModel(model: ForecastModelDefinition): void {
    if (this.models.has(model.id)) {
      throw new Error(`Forecast model ${model.id} is already registered.`);
    }

    this.models.set(model.id, Object.freeze({ ...model }));
  }

  registerScenario(scenario: ScenarioDefinition): void {
    if (this.scenarios.has(scenario.id)) {
      throw new Error(`Forecast scenario ${scenario.id} is already registered.`);
    }

    this.scenarios.set(scenario.id, Object.freeze({ ...scenario, changedVariables: { ...scenario.changedVariables } }));
  }

  registerPlugin(plugin: ForecastLibraryPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Forecast library plugin ${plugin.id} is already registered.`);
    }

    plugin.register(this);
    this.plugins.set(plugin.id, { id: plugin.id, version: plugin.version });
  }

  listModels(): ForecastModelDefinition[] {
    return Array.from(this.models.values()).sort((first, second) =>
      first.priority === second.priority ? first.id.localeCompare(second.id) : second.priority - first.priority,
    );
  }

  listScenarios(): ScenarioDefinition[] {
    return Array.from(this.scenarios.values()).sort((first, second) =>
      first.priority === second.priority ? first.id.localeCompare(second.id) : second.priority - first.priority,
    );
  }

  getModel(id: string): ForecastModelDefinition | undefined {
    return this.models.get(id);
  }

  getScenario(id: string): ScenarioDefinition | undefined {
    return this.scenarios.get(id);
  }

  toLibrary(): ForecastLibrary {
    return {
      version: "bie.forecast-library.v1",
      models: this.listModels(),
      scenarios: this.listScenarios(),
      plugins: Array.from(this.plugins.values()),
    };
  }
}

export function createDefaultForecastLibraryRegistry(
  plugins: ForecastLibraryPlugin[] = [],
): DefaultForecastLibraryRegistry {
  const registry = new DefaultForecastLibraryRegistry();

  for (const plugin of plugins) {
    registry.registerPlugin(plugin);
  }

  return registry;
}

function model(
  id: string,
  name: ForecastModelType,
  supportedCategories: ForecastCategory[],
  supportedKpiCategories: KPICategory[],
  supportedKpiIds: string[],
  requiredSemanticCategories: SemanticCategory[],
  extra: Partial<ForecastModelDefinition> = {},
): ForecastModelDefinition {
  return {
    id,
    version: extra.version ?? "1.0.0",
    name,
    description: extra.description ?? `${name} forecast model for supported business KPI series.`,
    supportedCategories,
    supportedKpiCategories,
    supportedKpiIds,
    requiredSemanticCategories,
    businessModels: extra.businessModels ?? ["generic"],
    minimumPeriods: extra.minimumPeriods ?? 2,
    horizonPeriods: extra.horizonPeriods ?? 1,
    smoothingFactor: extra.smoothingFactor,
    baseConfidence: extra.baseConfidence ?? 0.58,
    priority: extra.priority ?? 50,
  };
}

function scenario(
  id: string,
  name: string,
  type: ScenarioType,
  changedVariables: Record<string, number>,
  supportedForecastCategories: ForecastCategory[],
  extra: Partial<ScenarioDefinition> = {},
): ScenarioDefinition {
  return {
    id,
    version: extra.version ?? "1.0.0",
    name,
    type,
    changedVariables,
    supportedForecastCategories,
    affectedKpiIds: extra.affectedKpiIds ?? [],
    requiredSemanticCategories: extra.requiredSemanticCategories ?? [],
    businessModels: extra.businessModels ?? ["generic"],
    baseRiskScore: extra.baseRiskScore ?? 45,
    priority: extra.priority ?? 50,
  };
}

export const defaultForecastModels: ForecastModelDefinition[] = [
  model("linear-revenue-forecast", "Linear Trend", ["Revenue Forecast", "Growth Forecast", "Sales Forecast"], ["Financial KPIs", "Sales KPIs", "SaaS KPIs"], ["revenue", "sales-growth", "monthly-recurring-revenue"], ["Revenue", "Date"], {
    businessModels: ["retail", "marketplace", "saas", "startup", "restaurant", "generic"],
    minimumPeriods: 3,
    baseConfidence: 0.68,
    priority: 110,
  }),
  model("moving-average-demand-forecast", "Moving Average", ["Demand Forecast", "Sales Forecast", "Customer Forecast"], ["Sales KPIs", "Customer KPIs", "Product KPIs"], ["average-order-value", "order-frequency", "sales-growth"], ["Quantity", "Date"], {
    businessModels: ["retail", "marketplace", "inventory", "restaurant", "generic"],
    minimumPeriods: 2,
    baseConfidence: 0.62,
    priority: 96,
  }),
  model("inventory-smoothing-forecast", "Exponential Smoothing", ["Inventory Forecast", "Supplier Forecast", "Warehouse Forecast"], ["Inventory KPIs", "Supply Chain KPIs", "Logistics KPIs"], ["inventory-turnover", "stock-coverage", "reorder-risk", "inventory-value"], ["Inventory", "Date"], {
    businessModels: ["retail", "inventory", "manufacturing", "restaurant", "logistics"],
    minimumPeriods: 2,
    smoothingFactor: 0.45,
    baseConfidence: 0.6,
    priority: 104,
  }),
  model("cash-flow-regression-forecast", "Regression", ["Cash Flow Forecast", "Expense Forecast", "Profit Forecast"], ["Accounting KPIs", "Financial KPIs"], ["cash-flow", "working-capital", "operating-expenses", "gross-profit", "net-profit"], ["Revenue", "Expense", "Date"], {
    businessModels: ["accounting", "finance", "retail", "generic"],
    minimumPeriods: 2,
    baseConfidence: 0.59,
    priority: 102,
  }),
  model("hybrid-business-health-forecast", "Hybrid Model", ["Business Health Forecast", "Risk Forecast", "AI Readiness Forecast"], ["Business Health KPIs", "Risk KPIs", "AI Readiness KPIs", "Executive KPIs"], ["business-health-score", "ai-readiness-score"], ["Date"], {
    businessModels: ["retail", "marketplace", "saas", "accounting", "finance", "healthcare", "generic"],
    minimumPeriods: 1,
    baseConfidence: 0.54,
    priority: 78,
  }),
  model("subscription-churn-forecast", "Moving Average", ["Subscription Forecast", "Churn Forecast", "Customer Forecast"], ["SaaS KPIs", "Customer KPIs"], ["monthly-recurring-revenue", "customer-lifetime-value", "order-frequency"], ["Customer", "Date"], {
    businessModels: ["saas", "startup", "crm", "generic"],
    minimumPeriods: 2,
    baseConfidence: 0.61,
    priority: 100,
  }),
  model("marketing-hybrid-forecast", "Hybrid Model", ["Marketing Forecast", "Customer Forecast", "Growth Forecast"], ["Marketing KPIs", "Customer KPIs", "SaaS KPIs"], ["customer-acquisition-cost", "conversion-rate", "marketing-roi"], ["Customer", "Cost", "Date"], {
    businessModels: ["saas", "startup", "retail", "crm", "generic"],
    minimumPeriods: 2,
    baseConfidence: 0.58,
    priority: 92,
  }),
  model("payroll-expense-forecast", "Linear Trend", ["Payroll Forecast", "Expense Forecast"], ["HR KPIs", "Operational KPIs", "Financial KPIs"], ["payroll-ratio", "employee-productivity", "operating-expenses"], ["Employee", "Expense", "Date"], {
    businessModels: ["hr", "healthcare", "hospitality", "manufacturing", "generic"],
    minimumPeriods: 2,
    baseConfidence: 0.57,
    priority: 86,
  }),
];

export const defaultScenarioDefinitions: ScenarioDefinition[] = [
  scenario("price-increase-5", "Prices increase by 5%", "Price Increase", { pricePercent: 5, revenuePercent: 5, demandPercent: -1.5 }, ["Revenue Forecast", "Profit Forecast", "Sales Forecast", "Growth Forecast"], {
    affectedKpiIds: ["revenue", "average-order-value", "gross-profit", "net-profit"],
    requiredSemanticCategories: ["Revenue"],
    businessModels: ["retail", "marketplace", "saas", "restaurant", "generic"],
    baseRiskScore: 48,
    priority: 108,
  }),
  scenario("demand-drop-10", "Demand drops by 10%", "Demand Drop", { demandPercent: -10, revenuePercent: -10, inventoryPercent: 8 }, ["Revenue Forecast", "Sales Forecast", "Demand Forecast", "Inventory Forecast"], {
    affectedKpiIds: ["revenue", "sales-growth", "inventory-turnover", "stock-coverage"],
    requiredSemanticCategories: ["Revenue"],
    baseRiskScore: 72,
    priority: 106,
  }),
  scenario("inventory-doubles", "Inventory doubles", "Inventory Increase", { inventoryPercent: 100, cashPercent: -12, riskPercent: 10 }, ["Inventory Forecast", "Cash Flow Forecast", "Warehouse Forecast"], {
    affectedKpiIds: ["inventory-value", "stock-coverage", "cash-flow"],
    requiredSemanticCategories: ["Inventory"],
    businessModels: ["retail", "inventory", "manufacturing", "logistics", "restaurant"],
    baseRiskScore: 62,
    priority: 92,
  }),
  scenario("payroll-increase-8", "Payroll increases by 8%", "Payroll Increase", { payrollPercent: 8, expensePercent: 8, profitPercent: -5 }, ["Payroll Forecast", "Expense Forecast", "Profit Forecast", "Business Health Forecast"], {
    affectedKpiIds: ["payroll-ratio", "employee-productivity", "operating-expenses"],
    requiredSemanticCategories: ["Employee", "Expense"],
    baseRiskScore: 58,
    priority: 80,
  }),
  scenario("marketing-budget-plus-15", "Marketing budget changes by 15%", "Marketing Budget Change", { marketingPercent: 15, customerPercent: 6, revenuePercent: 4 }, ["Marketing Forecast", "Customer Forecast", "Revenue Forecast", "Growth Forecast"], {
    affectedKpiIds: ["customer-acquisition-cost", "conversion-rate", "marketing-roi"],
    requiredSemanticCategories: ["Customer"],
    businessModels: ["saas", "startup", "retail", "crm", "generic"],
    baseRiskScore: 52,
    priority: 86,
  }),
  scenario("supplier-cost-plus-7", "Supplier costs increase by 7%", "Supplier Cost Increase", { costPercent: 7, profitPercent: -7, riskPercent: 6 }, ["Supplier Forecast", "Profit Forecast", "Expense Forecast", "Inventory Forecast"], {
    affectedKpiIds: ["accounts-payable", "gross-profit", "inventory-value"],
    requiredSemanticCategories: ["Supplier", "Cost"],
    businessModels: ["retail", "inventory", "manufacturing", "restaurant", "logistics"],
    baseRiskScore: 68,
    priority: 100,
  }),
  scenario("new-store-opens", "A new store opens", "New Store", { storeCount: 1, revenuePercent: 12, expensePercent: 9 }, ["Revenue Forecast", "Sales Forecast", "Expense Forecast", "Business Health Forecast"], {
    affectedKpiIds: ["revenue", "sales-growth", "operating-expenses"],
    requiredSemanticCategories: ["Store"],
    businessModels: ["retail", "restaurant", "hospitality"],
    baseRiskScore: 56,
    priority: 78,
  }),
  scenario("warehouse-added", "Another warehouse is added", "Additional Warehouse", { warehouseCount: 1, inventoryPercent: 18, expensePercent: 6 }, ["Warehouse Forecast", "Inventory Forecast", "Expense Forecast"], {
    affectedKpiIds: ["stock-coverage", "inventory-value", "operating-expenses"],
    requiredSemanticCategories: ["Warehouse"],
    businessModels: ["retail", "inventory", "manufacturing", "logistics"],
    baseRiskScore: 54,
    priority: 76,
  }),
  scenario("employee-count-plus-5", "Employee count changes by 5", "Employee Count Change", { employeeCount: 5, payrollPercent: 10, capacityPercent: 8 }, ["Payroll Forecast", "Business Health Forecast", "Expense Forecast"], {
    affectedKpiIds: ["payroll-ratio", "employee-productivity"],
    requiredSemanticCategories: ["Employee"],
    baseRiskScore: 48,
    priority: 72,
  }),
  scenario("churn-decreases-3", "Churn decreases by 3 points", "Churn Decrease", { churnPercent: -3, customerPercent: 3, revenuePercent: 2 }, ["Churn Forecast", "Subscription Forecast", "Customer Forecast", "Revenue Forecast"], {
    affectedKpiIds: ["monthly-recurring-revenue", "customer-lifetime-value"],
    requiredSemanticCategories: ["Customer"],
    businessModels: ["saas", "startup", "crm", "generic"],
    baseRiskScore: 38,
    priority: 84,
  }),
];
