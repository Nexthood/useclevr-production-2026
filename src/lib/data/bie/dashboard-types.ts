import type { BusinessMaturityProfile, PipelineContext } from "../edie";
import type { KPIAvailability, KPICategory, KPIDatasetProfile } from "./kpi-types";

export type DashboardSectionType =
  | "Executive Summary"
  | "Financial Overview"
  | "Sales"
  | "Customers"
  | "Inventory"
  | "Operations"
  | "Marketing"
  | "Accounting"
  | "Cash Flow"
  | "Forecast"
  | "Departments"
  | "Products"
  | "Employees"
  | "Suppliers"
  | "Risk Indicators"
  | "Business Health"
  | "AI Insights"
  | "Recent Changes";

export type DashboardWidgetType =
  | "KPI Card"
  | "Line Chart"
  | "Bar Chart"
  | "Area Chart"
  | "Pie Chart"
  | "Donut Chart"
  | "Treemap"
  | "Heatmap"
  | "Geo Map"
  | "Table"
  | "Pivot Table"
  | "Top List"
  | "Bottom List"
  | "Trend Indicator"
  | "Forecast Chart"
  | "Distribution Chart"
  | "Correlation Chart"
  | "Scatter Chart"
  | "Timeline"
  | "Calendar"
  | "Gauge"
  | "Progress Indicator"
  | "Status Card"
  | "Relationship Graph Viewer"
  | "Knowledge Graph Viewer";

export type DashboardViewMode = "Executive View" | "Operational View" | "Compact View";

export type DashboardEvidenceType =
  | "kpi-availability"
  | "kpi-confidence"
  | "business-model"
  | "business-maturity"
  | "relationship-graph"
  | "time-series"
  | "cardinality"
  | "dataset-quality"
  | "widget-library"
  | "section-priority";

export interface DashboardEvidence {
  type: DashboardEvidenceType;
  score: number;
  weight: number;
  reason: string;
  source: string;
}

export interface WidgetDefinition {
  id: string;
  type: DashboardWidgetType;
  version: string;
  supportedKpiCategories: KPICategory[];
  supportedAvailability: KPIAvailability[];
  supportedUnits: string[];
  responsiveSpan: {
    desktop: number;
    tablet: number;
    mobile: number;
  };
  minConfidence: number;
  priority: number;
  evidenceSignals: DashboardEvidenceType[];
}

export interface WidgetLibraryPlugin {
  id: string;
  version: string;
  register(library: WidgetLibraryRegistry): void;
}

export interface WidgetLibrary {
  version: "bie.widget-library.v1";
  definitions: WidgetDefinition[];
  plugins: Array<{ id: string; version: string }>;
}

export interface WidgetLibraryRegistry {
  version: "bie.widget-library-registry.v1";
  registerDefinition(definition: WidgetDefinition): void;
  registerPlugin(plugin: WidgetLibraryPlugin): void;
  listDefinitions(): WidgetDefinition[];
  getDefinition(id: string): WidgetDefinition | undefined;
  toLibrary(): WidgetLibrary;
}

export interface DashboardWidget {
  id: string;
  title: string;
  type: DashboardWidgetType;
  sourceKPIs: string[];
  requiredData: string[];
  missingData: string[];
  confidence: number;
  evidence: DashboardEvidence[];
  reason: string;
  warnings: string[];
  priority: number;
  businessImportance: number;
  layout: {
    desktop: { columnSpan: number; rowSpan: number; order: number };
    tablet: { columnSpan: number; rowSpan: number; order: number };
    mobile: { columnSpan: number; rowSpan: number; order: number };
  };
  viewModes: DashboardViewMode[];
}

export interface DashboardSection {
  id: string;
  title: DashboardSectionType;
  widgets: DashboardWidget[];
  sourceKPIs: string[];
  confidence: number;
  evidence: DashboardEvidence[];
  reason: string;
  warnings: string[];
  priority: number;
  layout: {
    desktopColumns: number;
    tabletColumns: number;
    mobileColumns: number;
    order: number;
    spacing: "compact" | "comfortable";
  };
}

export interface DashboardLayoutProfile {
  version: "bie.dashboard-layout.v1";
  viewModes: DashboardViewMode[];
  sectionOrder: string[];
  widgetOrder: string[];
  responsiveBreakpoints: {
    desktop: { columns: number; minWidth: number };
    tablet: { columns: number; minWidth: number };
    mobile: { columns: number; minWidth: number };
  };
  density: "compact" | "balanced" | "detailed";
  complexity: "Low" | "Medium" | "High";
  grouping: Array<{ sectionId: string; widgetIds: string[]; reason: string }>;
}

export interface DashboardStatistics {
  totalWidgets: number;
  generatedSections: number;
  coveragePercent: number;
  missingInformation: Array<{ section: DashboardSectionType; missingData: string[] }>;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  dashboardComplexity: "Low" | "Medium" | "High";
  qualityScore: number;
  performanceScore: number;
}

export interface DashboardGenerationLog {
  generatedWidget: string | null;
  generatedSection: DashboardSectionType | null;
  confidence: number;
  executionTime: string;
  warnings: string[];
  errors: string[];
}

export interface DashboardProfile {
  version: "bie.dashboard-profile.v1";
  generatedAt: string;
  kpiProfileVersion: KPIDatasetProfile["version"];
  businessMaturityProfileVersion: BusinessMaturityProfile["version"] | null;
  sections: DashboardSection[];
  widgets: DashboardWidget[];
  layout: DashboardLayoutProfile;
  statistics: DashboardStatistics;
  confidence: number;
  warnings: string[];
  errors: string[];
  coveragePercent: number;
  qualityScore: number;
  logs: DashboardGenerationLog[];
  extensionPoints: {
    dashboardAiAssistant: boolean;
    interactiveDashboards: boolean;
    drillDown: boolean;
    crossFiltering: boolean;
    dashboardSharing: boolean;
    dashboardExport: boolean;
    pdfExport: boolean;
    excelExport: boolean;
    powerpointExport: boolean;
    scheduledReports: boolean;
    embeddedDashboards: boolean;
    liveDashboards: boolean;
    realTimeWidgets: boolean;
    collaboration: boolean;
    dashboardComments: boolean;
    dashboardTemplatesMarketplace: boolean;
    industryDashboardPacks: boolean;
    whiteLabelDashboards: boolean;
    mobileDashboards: boolean;
    arVrDashboards: boolean;
    roleBasedDashboards: boolean;
    userDefinedDashboards: boolean;
  };
}

export interface DashboardComposerInput {
  context?: PipelineContext;
  kpiProfile: KPIDatasetProfile;
  businessMaturityProfile?: BusinessMaturityProfile | null;
  businessModel?: Readonly<Record<string, unknown>> | null;
  library?: WidgetLibraryRegistry | WidgetLibrary;
  minimumConfidence?: number;
}
