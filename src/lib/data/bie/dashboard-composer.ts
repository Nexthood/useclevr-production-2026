import {
  buildBusinessMaturityProfile,
  buildDatasetStructureProfile,
  buildEntityDatasetProfile,
  buildRelationshipDatasetProfile,
  buildSemanticDatasetProfile,
  type BusinessMaturityProfile,
  type PipelineContext,
  type AnalysisResult,
  type Scanner,
  type ScannerExecutionOptions,
} from "../edie";
import { buildKPIDatasetProfile } from "./kpi-discovery-engine";
import { DefaultWidgetLibraryRegistry } from "./widget-library";
import type {
  DashboardComposerInput,
  DashboardEvidence,
  DashboardLayoutProfile,
  DashboardProfile,
  DashboardSection,
  DashboardSectionType,
  DashboardStatistics,
  DashboardViewMode,
  DashboardWidget,
  DashboardWidgetType,
  WidgetDefinition,
  WidgetLibrary,
  WidgetLibraryRegistry,
} from "./dashboard-types";
import type { DetectedKPI, KPIAvailability, KPICategory, KPIDatasetProfile } from "./kpi-types";

const DEFAULT_MINIMUM_CONFIDENCE = 0.45;

const sectionPriority: DashboardSectionType[] = [
  "Executive Summary",
  "Business Health",
  "Financial Overview",
  "Sales",
  "Customers",
  "Inventory",
  "Operations",
  "Accounting",
  "Cash Flow",
  "Marketing",
  "Products",
  "Departments",
  "Employees",
  "Suppliers",
  "Risk Indicators",
  "Forecast",
  "AI Insights",
  "Recent Changes",
];

const categorySections: Record<KPICategory, DashboardSectionType> = {
  "Financial KPIs": "Financial Overview",
  "Sales KPIs": "Sales",
  "Customer KPIs": "Customers",
  "Inventory KPIs": "Inventory",
  "Marketing KPIs": "Marketing",
  "Operational KPIs": "Operations",
  "Product KPIs": "Products",
  "Accounting KPIs": "Accounting",
  "Supply Chain KPIs": "Operations",
  "HR KPIs": "Employees",
  "Manufacturing KPIs": "Operations",
  "Restaurant KPIs": "Operations",
  "Healthcare KPIs": "Operations",
  "Hospitality KPIs": "Operations",
  "Logistics KPIs": "Operations",
  "SaaS KPIs": "Sales",
  "Startup KPIs": "Executive Summary",
  "Executive KPIs": "Executive Summary",
  "Risk KPIs": "Risk Indicators",
  "Compliance KPIs": "Risk Indicators",
  "AI Readiness KPIs": "AI Insights",
  "Business Health KPIs": "Business Health",
};

export class UniversalIntelligentDashboardComposer implements Scanner {
  constructor(private readonly library: WidgetLibraryRegistry | WidgetLibrary = new DefaultWidgetLibraryRegistry()) {}

  id(): string {
    return "bie.dashboard-composer.v1";
  }

  name(): string {
    return "Universal Intelligent Dashboard Composer";
  }

  version(): string {
    return "1.0.0";
  }

  priority(): number {
    return 70;
  }

  supports(context: PipelineContext): boolean {
    return Boolean(
      context.semanticMap.kpiProfile ||
        context.kpis.length ||
        context.semanticMap.businessMaturityProfile ||
        context.dataset.rawText ||
        context.dataset.rawBuffer ||
        context.dataset.rows?.length,
    );
  }

  validate(context: PipelineContext) {
    const valid = this.supports(context);
    const warnings: string[] = [];

    if (!context.semanticMap.kpiProfile) {
      warnings.push("Dashboard composer will build a KPI profile before dashboard composition.");
    }

    return {
      valid,
      warnings,
      errors: valid ? [] : ["Dashboard composer requires KPI discovery output or dataset source content."],
    };
  }

  execute(context: PipelineContext, options: ScannerExecutionOptions): AnalysisResult {
    const startedAtMs = Date.now();

    if (options.signal.aborted) {
      return {
        scannerId: this.id(),
        status: "cancelled",
        confidence: 0,
        duration: Date.now() - startedAtMs,
        warnings: [],
        errors: ["Scanner execution was cancelled before dashboard composition."],
        metadata: {},
        executionTime: new Date().toISOString(),
        scannerVersion: this.version(),
      };
    }

    const { kpiProfile, businessMaturityProfile } = resolveProfiles(context);
    const dashboardProfile = buildDashboardProfile({
      context,
      kpiProfile,
      businessMaturityProfile,
      businessModel: context.businessModel,
      library: this.library,
    });

    return {
      scannerId: this.id(),
      status: "completed",
      confidence: dashboardProfile.confidence,
      duration: Date.now() - startedAtMs,
      warnings: dashboardProfile.warnings,
      errors: dashboardProfile.errors,
      metadata: {
        dashboardProfile,
        totalWidgets: dashboardProfile.statistics.totalWidgets,
        generatedSections: dashboardProfile.statistics.generatedSections,
        coveragePercent: dashboardProfile.coveragePercent,
        qualityScore: dashboardProfile.qualityScore,
      },
      executionTime: new Date().toISOString(),
      scannerVersion: this.version(),
      contextPatch: {
        semanticMap: { kpiProfile, businessMaturityProfile, dashboardProfile },
        confidence: { [this.id()]: dashboardProfile.confidence },
        warnings: dashboardProfile.warnings,
      },
    };
  }
}

export function buildDashboardProfile(input: DashboardComposerInput): DashboardProfile {
  const startedAt = new Date().toISOString();
  const library = normalizeLibrary(input.library);
  const minimumConfidence = input.minimumConfidence ?? DEFAULT_MINIMUM_CONFIDENCE;
  const businessModel = extractBusinessModel(input.businessModel);
  const sectionCandidates = groupKpisBySection(input.kpiProfile.detectedKPIs);
  const sections = sectionPriority
    .map((sectionType, sectionIndex) =>
      buildSection(sectionType, sectionCandidates.get(sectionType) ?? [], sectionIndex, library, input, businessModel),
    )
    .filter((section): section is DashboardSection => Boolean(section && section.confidence >= minimumConfidence));
  const widgets = sections.flatMap((section) => section.widgets);
  const layout = buildLayout(sections, widgets);
  const statistics = buildStatistics(sections, widgets, input.kpiProfile, input.businessMaturityProfile);
  const confidence = roundConfidence(average(sections.map((section) => section.confidence)));
  const qualityScore = roundScore(
    statistics.qualityScore * 0.45 +
      statistics.coveragePercent * 0.25 +
      confidence * 100 * 0.3,
  );
  const warnings = buildWarnings(sections, widgets, input.kpiProfile);

  return {
    version: "bie.dashboard-profile.v1",
    generatedAt: new Date().toISOString(),
    kpiProfileVersion: input.kpiProfile.version,
    businessMaturityProfileVersion: input.businessMaturityProfile?.version ?? null,
    sections,
    widgets,
    layout,
    statistics,
    confidence,
    warnings,
    errors: [],
    coveragePercent: statistics.coveragePercent,
    qualityScore,
    logs: [
      ...sections.map((section) => ({
        generatedWidget: null,
        generatedSection: section.title,
        confidence: section.confidence,
        executionTime: startedAt,
        warnings: section.warnings,
        errors: [],
      })),
      ...widgets.map((widget) => ({
        generatedWidget: widget.title,
        generatedSection: findSectionForWidget(sections, widget.id),
        confidence: widget.confidence,
        executionTime: startedAt,
        warnings: widget.warnings,
        errors: [],
      })),
    ],
    extensionPoints: {
      dashboardAiAssistant: true,
      interactiveDashboards: true,
      drillDown: true,
      crossFiltering: true,
      dashboardSharing: true,
      dashboardExport: true,
      pdfExport: true,
      excelExport: true,
      powerpointExport: true,
      scheduledReports: true,
      embeddedDashboards: true,
      liveDashboards: true,
      realTimeWidgets: true,
      collaboration: true,
      dashboardComments: true,
      dashboardTemplatesMarketplace: true,
      industryDashboardPacks: true,
      whiteLabelDashboards: true,
      mobileDashboards: true,
      arVrDashboards: true,
      roleBasedDashboards: true,
      userDefinedDashboards: true,
    },
  };
}

function buildSection(
  title: DashboardSectionType,
  kpis: DetectedKPI[],
  order: number,
  library: WidgetLibrary,
  input: DashboardComposerInput,
  businessModel: string | null,
): DashboardSection | null {
  const eligibleKpis = kpis
    .filter((kpi) => kpi.calculationAvailability !== "Unavailable")
    .sort((first, second) => second.businessRelevance + second.confidence * 100 - (first.businessRelevance + first.confidence * 100))
    .slice(0, title === "Executive Summary" ? 6 : 5);

  if (eligibleKpis.length === 0) {
    return null;
  }

  const widgets = eligibleKpis
    .map((kpi, index) => selectWidget(kpi, title, index, library, input, businessModel))
    .filter((widget): widget is DashboardWidget => Boolean(widget));
  const executiveWidget = buildExecutiveWidget(title, eligibleKpis, widgets.length, input);

  if (executiveWidget) {
    widgets.unshift(executiveWidget);
  }

  if (widgets.length === 0) {
    return null;
  }

  const evidence = uniqueEvidence(widgets.flatMap((widget) => widget.evidence));
  const confidence = roundConfidence(average(widgets.map((widget) => widget.confidence)));
  const warnings = unique(widgets.flatMap((widget) => widget.warnings));

  return {
    id: sectionId(title),
    title,
    widgets: widgets.map((widget, index) => ({
      ...widget,
      layout: withOrder(widget.layout, index),
    })),
    sourceKPIs: unique(eligibleKpis.map((kpi) => kpi.id)),
    confidence,
    evidence,
    reason: `${title} is generated from ${eligibleKpis.length} supported KPI candidate${eligibleKpis.length === 1 ? "" : "s"}.`,
    warnings,
    priority: sectionPriority.length - order,
    layout: {
      desktopColumns: 12,
      tabletColumns: 2,
      mobileColumns: 1,
      order,
      spacing: title === "Executive Summary" ? "comfortable" : "compact",
    },
  };
}

function selectWidget(
  kpi: DetectedKPI,
  section: DashboardSectionType,
  order: number,
  library: WidgetLibrary,
  input: DashboardComposerInput,
  businessModel: string | null,
): DashboardWidget | null {
  const candidates = library.definitions
    .filter((definition) => supportsKpi(definition, kpi))
    .map((definition) => ({
      definition,
      score: scoreWidgetDefinition(definition, kpi, section, input, businessModel),
    }))
    .filter((candidate) => candidate.score >= candidate.definition.minConfidence)
    .sort((first, second) => second.score - first.score || second.definition.priority - first.definition.priority);
  const selected = candidates[0]?.definition;

  if (!selected) {
    return null;
  }

  const evidence = buildWidgetEvidence(selected, kpi, section, input, businessModel);
  const confidence = roundConfidence(weightedAverage(evidence));
  const missingData = unique(kpi.missingFields.map(String));

  return {
    id: `${sectionId(section)}-${selected.id}-${kpi.id}`,
    title: kpi.name,
    type: selected.type,
    sourceKPIs: [kpi.id],
    requiredData: unique(kpi.requiredFields.map(String)),
    missingData,
    confidence,
    evidence,
    reason: `${selected.type} is selected for ${kpi.name} because the KPI category, unit, availability, and dataset evidence match.`,
    warnings: [
      ...kpi.warnings,
      ...(missingData.length > 0 ? [`${kpi.name} has missing dashboard data: ${missingData.join(", ")}.`] : []),
    ],
    priority: selected.priority + kpi.businessRelevance,
    businessImportance: roundScore(kpi.businessRelevance),
    layout: {
      desktop: { columnSpan: selected.responsiveSpan.desktop, rowSpan: rowSpanFor(selected.type), order },
      tablet: { columnSpan: selected.responsiveSpan.tablet, rowSpan: rowSpanFor(selected.type), order },
      mobile: { columnSpan: selected.responsiveSpan.mobile, rowSpan: rowSpanFor(selected.type), order },
    },
    viewModes: viewModesFor(section, selected.type),
  };
}

function buildExecutiveWidget(
  section: DashboardSectionType,
  kpis: DetectedKPI[],
  order: number,
  input: DashboardComposerInput,
): DashboardWidget | null {
  if (section !== "Executive Summary" && section !== "Business Health") {
    return null;
  }

  const sourceKpis = kpis.slice(0, 4);
  const evidence = [
    evidenceItem("section-priority", 0.9, 0.25, `${section} has executive dashboard priority.`, section),
    evidenceItem("kpi-confidence", average(sourceKpis.map((kpi) => kpi.confidence)), 0.3, "Executive widget uses the strongest available KPIs.", sourceKpis.map((kpi) => kpi.id).join(", ")),
    evidenceItem("business-maturity", (input.businessMaturityProfile?.statistics.businessHealthScore ?? 50) / 100, 0.25, "Business maturity profile supports executive summary composition.", "business maturity profile"),
    evidenceItem("dataset-quality", input.kpiProfile.qualityScore / 100, 0.2, "KPI profile quality supports dashboard composition.", "KPI profile"),
  ];
  const confidence = roundConfidence(weightedAverage(evidence));

  return {
    id: `${sectionId(section)}-executive-status`,
    title: section === "Executive Summary" ? "Executive dashboard summary" : "Business health status",
    type: section === "Executive Summary" ? "Status Card" : "Gauge",
    sourceKPIs: sourceKpis.map((kpi) => kpi.id),
    requiredData: unique(sourceKpis.flatMap((kpi) => kpi.requiredFields.map(String))),
    missingData: unique(sourceKpis.flatMap((kpi) => kpi.missingFields.map(String))),
    confidence,
    evidence,
    reason: `${section} uses the strongest available KPI candidates for a compact leadership view.`,
    warnings: [],
    priority: 120,
    businessImportance: 100,
    layout: {
      desktop: { columnSpan: 6, rowSpan: 1, order },
      tablet: { columnSpan: 2, rowSpan: 1, order },
      mobile: { columnSpan: 1, rowSpan: 1, order },
    },
    viewModes: ["Executive View", "Compact View"],
  };
}

function groupKpisBySection(kpis: DetectedKPI[]): Map<DashboardSectionType, DetectedKPI[]> {
  const groups = new Map<DashboardSectionType, DetectedKPI[]>();
  const available = kpis.filter((kpi) => kpi.calculationAvailability !== "Unavailable");
  const executive = available
    .filter((kpi) => ["Financial KPIs", "Sales KPIs", "Business Health KPIs", "Risk KPIs", "AI Readiness KPIs"].includes(kpi.category))
    .sort((first, second) => second.businessRelevance - first.businessRelevance)
    .slice(0, 8);

  if (executive.length > 0) {
    groups.set("Executive Summary", executive);
  }

  for (const kpi of available) {
    const section = sectionForKpi(kpi);
    groups.set(section, [...(groups.get(section) ?? []), kpi]);
  }

  if (available.some((kpi) => kpi.id.includes("forecast") || kpi.name.toLowerCase().includes("growth"))) {
    groups.set(
      "Forecast",
      available.filter((kpi) => kpi.id.includes("forecast") || kpi.name.toLowerCase().includes("growth")),
    );
  }

  return groups;
}

function sectionForKpi(kpi: DetectedKPI): DashboardSectionType {
  if (["cash-flow", "working-capital", "current-ratio"].includes(kpi.id)) {
    return "Cash Flow";
  }

  if (["payroll-ratio", "employee-productivity"].includes(kpi.id)) {
    return "Employees";
  }

  if (["accounts-payable"].includes(kpi.id)) {
    return "Suppliers";
  }

  return categorySections[kpi.category];
}

function buildLayout(sections: DashboardSection[], widgets: DashboardWidget[]): DashboardLayoutProfile {
  const complexity = widgets.length >= 18 ? "High" : widgets.length >= 9 ? "Medium" : "Low";

  return {
    version: "bie.dashboard-layout.v1" as const,
    viewModes: ["Executive View", "Operational View", "Compact View"],
    sectionOrder: sections.map((section) => section.id),
    widgetOrder: widgets.map((widget) => widget.id),
    responsiveBreakpoints: {
      desktop: { columns: 12, minWidth: 1024 },
      tablet: { columns: 2, minWidth: 640 },
      mobile: { columns: 1, minWidth: 0 },
    },
    density: complexity === "High" ? "detailed" : complexity === "Medium" ? "balanced" : "compact",
    complexity,
    grouping: sections.map((section) => ({
      sectionId: section.id,
      widgetIds: section.widgets.map((widget) => widget.id),
      reason: `${section.title} widgets share KPI category and business purpose.`,
    })),
  };
}

function buildStatistics(
  sections: DashboardSection[],
  widgets: DashboardWidget[],
  kpiProfile: KPIDatasetProfile,
  maturityProfile: BusinessMaturityProfile | null | undefined,
): DashboardStatistics {
  const totalSupportedKpis = kpiProfile.detectedKPIs.filter((kpi) => kpi.calculationAvailability !== "Unavailable").length;
  const coveredKpis = new Set(widgets.flatMap((widget) => widget.sourceKPIs)).size;
  const coveragePercent = totalSupportedKpis === 0 ? 0 : roundScore((coveredKpis / totalSupportedKpis) * 100);
  const missingInformation = sections
    .map((section) => ({
      section: section.title,
      missingData: unique(section.widgets.flatMap((widget) => widget.missingData)),
    }))
    .filter((item) => item.missingData.length > 0);
  const dashboardComplexity = widgets.length >= 18 ? "High" : widgets.length >= 9 ? "Medium" : "Low";
  const averageConfidence = average(widgets.map((widget) => widget.confidence));
  const performanceScore = roundScore(Math.max(20, 100 - widgets.length * 0.9 - sections.length * 1.1));
  const qualityScore = roundScore(
    coveragePercent * 0.3 +
      averageConfidence * 100 * 0.25 +
      kpiProfile.qualityScore * 0.25 +
      (maturityProfile?.statistics.biReadiness ?? 50) * 0.2,
  );

  return {
    totalWidgets: widgets.length,
    generatedSections: sections.length,
    coveragePercent,
    missingInformation,
    confidenceDistribution: {
      high: widgets.filter((widget) => widget.confidence >= 0.75).length,
      medium: widgets.filter((widget) => widget.confidence >= 0.5 && widget.confidence < 0.75).length,
      low: widgets.filter((widget) => widget.confidence < 0.5).length,
    },
    dashboardComplexity,
    qualityScore,
    performanceScore,
  };
}

function scoreWidgetDefinition(
  definition: WidgetDefinition,
  kpi: DetectedKPI,
  section: DashboardSectionType,
  input: DashboardComposerInput,
  businessModel: string | null,
): number {
  const categoryFit = definition.supportedKpiCategories.includes(kpi.category) ? 0.24 : 0;
  const availabilityFit = definition.supportedAvailability.includes(kpi.calculationAvailability) ? 0.18 : 0;
  const unitFit = kpi.units.some((unit) => definition.supportedUnits.includes(unit)) ? 0.14 : 0;
  const confidenceFit = kpi.confidence * 0.18;
  const sectionFit = preferredWidgetTypes(section, kpi).includes(definition.type) ? 0.14 : 0;
  const maturityFit = Math.min(0.07, ((input.businessMaturityProfile?.statistics.biReadiness ?? 50) / 100) * 0.07);
  const modelFit = businessModel && businessModelAwareWidgetTypes(businessModel).includes(definition.type) ? 0.05 : 0;

  return roundConfidence(categoryFit + availabilityFit + unitFit + confidenceFit + sectionFit + maturityFit + modelFit);
}

function supportsKpi(definition: WidgetDefinition, kpi: DetectedKPI): boolean {
  return (
    definition.supportedKpiCategories.includes(kpi.category) &&
    definition.supportedAvailability.includes(kpi.calculationAvailability) &&
    kpi.units.some((unit) => definition.supportedUnits.includes(unit)) &&
    kpi.confidence >= definition.minConfidence * 0.75
  );
}

function buildWidgetEvidence(
  definition: WidgetDefinition,
  kpi: DetectedKPI,
  section: DashboardSectionType,
  input: DashboardComposerInput,
  businessModel: string | null,
): DashboardEvidence[] {
  return [
    evidenceItem("kpi-availability", availabilityScore(kpi.calculationAvailability), 0.2, `${kpi.name} is ${kpi.calculationAvailability}.`, kpi.id),
    evidenceItem("kpi-confidence", kpi.confidence, 0.22, `${kpi.name} confidence is ${kpi.confidence}.`, kpi.id),
    evidenceItem("widget-library", definition.priority / 100, 0.16, `${definition.type} supports ${kpi.category}.`, definition.id),
    evidenceItem("section-priority", sectionPriorityScore(section), 0.12, `${section} has generated dashboard priority.`, section),
    evidenceItem("dataset-quality", input.kpiProfile.qualityScore / 100, 0.14, `KPI profile quality is ${input.kpiProfile.qualityScore}.`, "KPI profile"),
    evidenceItem("business-maturity", (input.businessMaturityProfile?.statistics.biReadiness ?? 50) / 100, 0.1, "BI readiness supports dashboard layout complexity.", "business maturity profile"),
    evidenceItem("business-model", businessModel ? 0.72 : 0.38, 0.06, businessModel ? `Business model signal is ${businessModel}.` : "No business model signal is available.", businessModel ?? "unknown"),
  ];
}

function preferredWidgetTypes(section: DashboardSectionType, kpi: DetectedKPI): DashboardWidgetType[] {
  if (section === "Executive Summary") {
    return ["KPI Card", "Status Card", "Gauge", "Trend Indicator"];
  }

  if (section === "Inventory" || section === "Products") {
    return ["Bar Chart", "Top List", "Bottom List", "Table", "Treemap"];
  }

  if (section === "Risk Indicators" || section === "Business Health" || section === "AI Insights") {
    return ["Gauge", "Status Card", "Progress Indicator", "Trend Indicator"];
  }

  if (kpi.requiredFields.includes("Date") || kpi.optionalFields.includes("Date")) {
    return ["Line Chart", "Area Chart", "Trend Indicator", "Timeline"];
  }

  return ["KPI Card", "Bar Chart", "Table", "Top List"];
}

function businessModelAwareWidgetTypes(model: string): DashboardWidgetType[] {
  if (["retail", "marketplace", "restaurant"].includes(model)) {
    return ["Top List", "Bottom List", "Bar Chart", "Treemap"];
  }

  if (["saas", "startup"].includes(model)) {
    return ["Line Chart", "Trend Indicator", "Gauge"];
  }

  if (["manufacturing", "logistics", "healthcare", "hospitality"].includes(model)) {
    return ["Heatmap", "Timeline", "Status Card", "Table"];
  }

  return ["KPI Card", "Bar Chart", "Table"];
}

function viewModesFor(section: DashboardSectionType, type: DashboardWidgetType): DashboardViewMode[] {
  const modes: DashboardViewMode[] = ["Operational View"];

  if (["Executive Summary", "Business Health", "Financial Overview", "Risk Indicators", "AI Insights"].includes(section)) {
    modes.push("Executive View");
  }

  if (["KPI Card", "Gauge", "Status Card", "Progress Indicator", "Trend Indicator"].includes(type)) {
    modes.push("Compact View");
  }

  return unique(modes);
}

function resolveProfiles(context: PipelineContext): {
  kpiProfile: KPIDatasetProfile;
  businessMaturityProfile: BusinessMaturityProfile;
} {
  if (isKpiProfile(context.semanticMap.kpiProfile)) {
    const businessMaturityProfile = isBusinessMaturityProfile(context.semanticMap.businessMaturityProfile)
      ? context.semanticMap.businessMaturityProfile
      : buildFallbackBusinessMaturityProfile(context);

    return { kpiProfile: context.semanticMap.kpiProfile, businessMaturityProfile };
  }

  const businessMaturityProfile = isBusinessMaturityProfile(context.semanticMap.businessMaturityProfile)
    ? context.semanticMap.businessMaturityProfile
    : buildFallbackBusinessMaturityProfile(context);
  const structureProfile = buildDatasetStructureProfile(context);
  const semanticProfile = buildSemanticDatasetProfile({ structureProfile });
  const entityProfile = buildEntityDatasetProfile({ structureProfile, semanticProfile });
  const relationshipProfile = buildRelationshipDatasetProfile({
    structureProfile,
    semanticProfile,
    entityProfile,
    rows: resolveRows(context),
  });
  const kpiProfile = buildKPIDatasetProfile({
    structureProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessMaturityProfile,
    businessModel: context.businessModel,
    industry: context.industry,
  });

  return { kpiProfile, businessMaturityProfile };
}

function buildFallbackBusinessMaturityProfile(context: PipelineContext): BusinessMaturityProfile {
  const structureProfile = buildDatasetStructureProfile(context);
  const semanticProfile = buildSemanticDatasetProfile({ structureProfile });
  const entityProfile = buildEntityDatasetProfile({ structureProfile, semanticProfile });
  const relationshipProfile = buildRelationshipDatasetProfile({
    structureProfile,
    semanticProfile,
    entityProfile,
    rows: resolveRows(context),
  });

  return buildBusinessMaturityProfile({
    structureProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessModel: context.businessModel,
    rows: resolveRows(context),
  });
}

function normalizeLibrary(library: DashboardComposerInput["library"]): WidgetLibrary {
  if (!library) {
    return new DefaultWidgetLibraryRegistry().toLibrary();
  }

  if ("toLibrary" in library) {
    return library.toLibrary();
  }

  return library;
}

function extractBusinessModel(model: Readonly<Record<string, unknown>> | null | undefined): string | null {
  if (!model) {
    return null;
  }

  const value = model.primaryModel ?? model.businessModel ?? model.model ?? model.type;

  if (typeof value === "string") {
    return value.toLowerCase();
  }

  if (Array.isArray(model.detectedModels) && typeof model.detectedModels[0] === "string") {
    return model.detectedModels[0].toLowerCase();
  }

  return null;
}

function resolveRows(context: PipelineContext): ReadonlyArray<Readonly<Record<string, unknown>>> {
  if (context.dataset.rows?.length) {
    return context.dataset.rows;
  }

  if (typeof context.dataset.rawText !== "string" || !context.dataset.rawText.trim()) {
    return [];
  }

  const lines = context.dataset.rawText.trim().split(/\r?\n/);
  const delimiter = lines[0]?.includes(";") ? ";" : ",";
  const headers = splitLine(lines[0] ?? "", delimiter);

  return lines.slice(1).map((line) => {
    const cells = splitLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function splitLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

function rowSpanFor(type: DashboardWidgetType): number {
  if (["Table", "Pivot Table", "Relationship Graph Viewer", "Knowledge Graph Viewer"].includes(type)) {
    return 2;
  }

  return 1;
}

function withOrder(layout: DashboardWidget["layout"], order: number): DashboardWidget["layout"] {
  return {
    desktop: { ...layout.desktop, order },
    tablet: { ...layout.tablet, order },
    mobile: { ...layout.mobile, order },
  };
}

function findSectionForWidget(sections: DashboardSection[], widgetId: string): DashboardSectionType | null {
  return sections.find((section) => section.widgets.some((widget) => widget.id === widgetId))?.title ?? null;
}

function buildWarnings(sections: DashboardSection[], widgets: DashboardWidget[], kpiProfile: KPIDatasetProfile): string[] {
  const warnings: string[] = [];

  if (sections.length === 0) {
    warnings.push("Dashboard composer found no supported dashboard sections.");
  }

  if (widgets.length === 0) {
    warnings.push("Dashboard composer found no supported widgets.");
  }

  if (kpiProfile.statistics.coveragePercent < 40) {
    warnings.push("KPI coverage limits dashboard completeness.");
  }

  return warnings;
}

function isKpiProfile(value: unknown): value is KPIDatasetProfile {
  return Boolean(value && typeof value === "object" && (value as KPIDatasetProfile).version === "bie.kpi-profile.v1");
}

function isBusinessMaturityProfile(value: unknown): value is BusinessMaturityProfile {
  return Boolean(value && typeof value === "object" && (value as BusinessMaturityProfile).version === "edie.business-maturity.v1");
}

function sectionId(section: DashboardSectionType): string {
  return section.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function availabilityScore(availability: KPIAvailability): number {
  if (availability === "Available") {
    return 1;
  }

  if (availability === "Partially Available") {
    return 0.62;
  }

  if (availability === "Needs User Input") {
    return 0.52;
  }

  return 0;
}

function sectionPriorityScore(section: DashboardSectionType): number {
  const index = sectionPriority.indexOf(section);
  return roundConfidence(1 - index / sectionPriority.length);
}

function evidenceItem(
  type: DashboardEvidence["type"],
  score: number,
  weight: number,
  reason: string,
  source: string,
): DashboardEvidence {
  return {
    type,
    score: roundConfidence(score),
    weight,
    reason,
    source,
  };
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function uniqueEvidence(items: DashboardEvidence[]): DashboardEvidence[] {
  const seen = new Set<string>();
  const evidence: DashboardEvidence[] = [];

  for (const item of items) {
    const key = `${item.type}:${item.source}:${item.reason}`;

    if (!seen.has(key)) {
      seen.add(key);
      evidence.push(item);
    }
  }

  return evidence;
}

function weightedAverage(items: DashboardEvidence[]): number {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight === 0) {
    return 0;
  }

  return items.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundConfidence(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
}

function roundScore(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
}
