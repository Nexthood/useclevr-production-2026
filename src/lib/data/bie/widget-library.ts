import type {
  DashboardWidgetType,
  WidgetDefinition,
  WidgetLibrary,
  WidgetLibraryPlugin,
  WidgetLibraryRegistry,
} from "./dashboard-types";
import type { KPICategory } from "./kpi-types";

export class DefaultWidgetLibraryRegistry implements WidgetLibraryRegistry {
  readonly version = "bie.widget-library-registry.v1";
  private readonly definitions = new Map<string, WidgetDefinition>();
  private readonly plugins = new Map<string, { id: string; version: string }>();

  constructor(definitions: WidgetDefinition[] = defaultWidgetDefinitions) {
    for (const definition of definitions) {
      this.registerDefinition(definition);
    }
  }

  registerDefinition(definition: WidgetDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Widget definition ${definition.id} is already registered.`);
    }

    this.definitions.set(definition.id, Object.freeze({ ...definition }));
  }

  registerPlugin(plugin: WidgetLibraryPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Widget library plugin ${plugin.id} is already registered.`);
    }

    plugin.register(this);
    this.plugins.set(plugin.id, { id: plugin.id, version: plugin.version });
  }

  listDefinitions(): WidgetDefinition[] {
    return Array.from(this.definitions.values()).sort((first, second) => second.priority - first.priority);
  }

  getDefinition(id: string): WidgetDefinition | undefined {
    return this.definitions.get(id);
  }

  toLibrary(): WidgetLibrary {
    return {
      version: "bie.widget-library.v1",
      definitions: this.listDefinitions(),
      plugins: Array.from(this.plugins.values()),
    };
  }
}

export function createDefaultWidgetLibraryRegistry(
  plugins: WidgetLibraryPlugin[] = [],
): DefaultWidgetLibraryRegistry {
  const registry = new DefaultWidgetLibraryRegistry();

  for (const plugin of plugins) {
    registry.registerPlugin(plugin);
  }

  return registry;
}

const allCategories: KPICategory[] = [
  "Financial KPIs",
  "Sales KPIs",
  "Customer KPIs",
  "Inventory KPIs",
  "Marketing KPIs",
  "Operational KPIs",
  "Product KPIs",
  "Accounting KPIs",
  "Supply Chain KPIs",
  "HR KPIs",
  "Manufacturing KPIs",
  "Restaurant KPIs",
  "Healthcare KPIs",
  "Hospitality KPIs",
  "Logistics KPIs",
  "SaaS KPIs",
  "Startup KPIs",
  "Executive KPIs",
  "Risk KPIs",
  "Compliance KPIs",
  "AI Readiness KPIs",
  "Business Health KPIs",
];

function defineWidget(
  id: string,
  type: DashboardWidgetType,
  supportedKpiCategories: KPICategory[],
  supportedUnits: string[],
  priority: number,
  span: { desktop: number; tablet: number; mobile: number },
): WidgetDefinition {
  return {
    id,
    type,
    version: "1.0.0",
    supportedKpiCategories,
    supportedAvailability: ["Available", "Partially Available", "Needs User Input"],
    supportedUnits,
    responsiveSpan: span,
    minConfidence: 0.45,
    priority,
    evidenceSignals: [
      "kpi-availability",
      "kpi-confidence",
      "dataset-quality",
      "widget-library",
    ],
  };
}

export const defaultWidgetDefinitions: WidgetDefinition[] = [
  defineWidget("kpi-card", "KPI Card", allCategories, ["money", "percentage", "count", "ratio", "days", "score"], 100, { desktop: 3, tablet: 2, mobile: 1 }),
  defineWidget("trend-indicator", "Trend Indicator", ["Financial KPIs", "Sales KPIs", "Customer KPIs", "SaaS KPIs", "Business Health KPIs"], ["money", "percentage", "count", "ratio", "score"], 95, { desktop: 3, tablet: 2, mobile: 1 }),
  defineWidget("line-chart", "Line Chart", ["Financial KPIs", "Sales KPIs", "Customer KPIs", "SaaS KPIs", "Accounting KPIs", "Business Health KPIs"], ["money", "percentage", "count", "ratio", "score"], 90, { desktop: 6, tablet: 2, mobile: 1 }),
  defineWidget("bar-chart", "Bar Chart", allCategories, ["money", "percentage", "count", "ratio", "score"], 85, { desktop: 6, tablet: 2, mobile: 1 }),
  defineWidget("area-chart", "Area Chart", ["Financial KPIs", "Sales KPIs", "Accounting KPIs", "SaaS KPIs"], ["money", "count", "percentage"], 80, { desktop: 6, tablet: 2, mobile: 1 }),
  defineWidget("pie-chart", "Pie Chart", ["Customer KPIs", "Product KPIs", "Marketing KPIs", "Accounting KPIs"], ["percentage", "count", "money"], 70, { desktop: 4, tablet: 2, mobile: 1 }),
  defineWidget("donut-chart", "Donut Chart", ["Customer KPIs", "Product KPIs", "Marketing KPIs", "Inventory KPIs"], ["percentage", "count", "money"], 70, { desktop: 4, tablet: 2, mobile: 1 }),
  defineWidget("treemap", "Treemap", ["Product KPIs", "Inventory KPIs", "Sales KPIs"], ["money", "count", "score"], 65, { desktop: 6, tablet: 2, mobile: 1 }),
  defineWidget("heatmap", "Heatmap", ["Operational KPIs", "Inventory KPIs", "Supply Chain KPIs", "Manufacturing KPIs", "Healthcare KPIs", "Hospitality KPIs"], ["percentage", "count", "score"], 65, { desktop: 6, tablet: 2, mobile: 1 }),
  defineWidget("geo-map", "Geo Map", ["Sales KPIs", "Customer KPIs", "Operational KPIs", "Risk KPIs"], ["money", "count", "score"], 62, { desktop: 6, tablet: 2, mobile: 1 }),
  defineWidget("table", "Table", allCategories, ["money", "percentage", "count", "ratio", "days", "score"], 76, { desktop: 6, tablet: 2, mobile: 1 }),
  defineWidget("pivot-table", "Pivot Table", ["Financial KPIs", "Sales KPIs", "Inventory KPIs", "Accounting KPIs", "Operational KPIs"], ["money", "percentage", "count", "ratio"], 66, { desktop: 8, tablet: 2, mobile: 1 }),
  defineWidget("top-list", "Top List", ["Sales KPIs", "Customer KPIs", "Inventory KPIs", "Product KPIs", "Operational KPIs"], ["money", "count", "score"], 78, { desktop: 4, tablet: 2, mobile: 1 }),
  defineWidget("bottom-list", "Bottom List", ["Risk KPIs", "Inventory KPIs", "Sales KPIs", "Operational KPIs"], ["money", "count", "percentage", "score"], 74, { desktop: 4, tablet: 2, mobile: 1 }),
  defineWidget("forecast-chart", "Forecast Chart", ["Financial KPIs", "Sales KPIs", "Business Health KPIs"], ["money", "percentage", "count"], 68, { desktop: 6, tablet: 2, mobile: 1 }),
  defineWidget("distribution-chart", "Distribution Chart", ["Customer KPIs", "Product KPIs", "HR KPIs", "Healthcare KPIs"], ["count", "money", "score"], 64, { desktop: 6, tablet: 2, mobile: 1 }),
  defineWidget("correlation-chart", "Correlation Chart", ["Financial KPIs", "Sales KPIs", "Marketing KPIs", "Operational KPIs"], ["money", "percentage", "count", "ratio"], 62, { desktop: 6, tablet: 2, mobile: 1 }),
  defineWidget("scatter-chart", "Scatter Chart", ["Sales KPIs", "Marketing KPIs", "Operational KPIs", "Manufacturing KPIs"], ["money", "percentage", "count", "ratio"], 60, { desktop: 6, tablet: 2, mobile: 1 }),
  defineWidget("timeline", "Timeline", ["Sales KPIs", "Accounting KPIs", "Operational KPIs", "Business Health KPIs"], ["money", "count", "percentage", "score"], 67, { desktop: 6, tablet: 2, mobile: 1 }),
  defineWidget("calendar", "Calendar", ["Operational KPIs", "Sales KPIs", "Healthcare KPIs", "Hospitality KPIs"], ["count", "score"], 55, { desktop: 6, tablet: 2, mobile: 1 }),
  defineWidget("gauge", "Gauge", ["Business Health KPIs", "AI Readiness KPIs", "Risk KPIs", "Compliance KPIs"], ["percentage", "score"], 82, { desktop: 3, tablet: 2, mobile: 1 }),
  defineWidget("progress-indicator", "Progress Indicator", ["AI Readiness KPIs", "Business Health KPIs", "Compliance KPIs", "Operational KPIs"], ["percentage", "score"], 80, { desktop: 3, tablet: 2, mobile: 1 }),
  defineWidget("status-card", "Status Card", ["Risk KPIs", "Compliance KPIs", "Business Health KPIs", "Operational KPIs"], ["score", "percentage", "count"], 84, { desktop: 3, tablet: 2, mobile: 1 }),
  defineWidget("relationship-graph-viewer", "Relationship Graph Viewer", ["Operational KPIs", "Customer KPIs", "Inventory KPIs", "Supply Chain KPIs"], ["score", "count"], 72, { desktop: 8, tablet: 2, mobile: 1 }),
  defineWidget("knowledge-graph-viewer", "Knowledge Graph Viewer", ["Operational KPIs", "Customer KPIs", "Inventory KPIs", "Business Health KPIs"], ["score", "count"], 58, { desktop: 8, tablet: 2, mobile: 1 }),
];
