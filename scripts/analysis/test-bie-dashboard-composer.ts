import assert from "node:assert/strict";

import {
  DatasetAnalysisPipeline,
  UniversalBusinessMaturityIntelligenceScanner,
  UniversalDatasetStructureScanner,
  UniversalEntityIntelligenceScanner,
  UniversalRelationshipIntelligenceScanner,
  UniversalSemanticIntelligenceScanner,
  buildBusinessMaturityProfile,
  buildDatasetStructureProfile,
  buildEntityDatasetProfile,
  buildRelationshipDatasetProfile,
  buildSemanticDatasetProfile,
  createPipelineContext,
  type PipelineContext,
} from "../../src/lib/data/edie";
import {
  DefaultWidgetLibraryRegistry,
  UniversalIntelligentDashboardComposer,
  UniversalKPIDiscoveryEngine,
  buildDashboardProfile,
  buildKPIDatasetProfile,
  type DashboardProfile,
  type WidgetLibraryPlugin,
} from "../../src/lib/data/bie";

function buildProfile(rawText: string, contextPatch: Partial<PipelineContext> = {}): DashboardProfile {
  const context = {
    ...createPipelineContext({
      id: "bie_dashboard_test",
      fileName: "dashboard.csv",
      rawText,
    }),
    ...contextPatch,
  } as PipelineContext;
  const rows = parseRows(rawText);
  const structureProfile = buildDatasetStructureProfile(context);
  const semanticProfile = buildSemanticDatasetProfile({ structureProfile });
  const entityProfile = buildEntityDatasetProfile({ structureProfile, semanticProfile });
  const relationshipProfile = buildRelationshipDatasetProfile({
    structureProfile,
    semanticProfile,
    entityProfile,
    rows,
  });
  const businessMaturityProfile = buildBusinessMaturityProfile({
    structureProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessModel: context.businessModel,
    rows,
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

  return buildDashboardProfile({
    context,
    kpiProfile,
    businessMaturityProfile,
    businessModel: context.businessModel,
  });
}

async function testRetailDashboard() {
  const profile = buildProfile(generateRetailDataset(), {
    businessModel: { primaryModel: "retail" },
  });

  assertSection(profile, "Executive Summary");
  assertSection(profile, "Financial Overview");
  assertSection(profile, "Sales");
  assertSection(profile, "Inventory");
  assertWidget(profile, "KPI Card");
  assert.ok(profile.statistics.totalWidgets >= 6);
}

async function testRestaurantDashboard() {
  const profile = buildProfile(generateRestaurantDataset(), {
    businessModel: { primaryModel: "restaurant" },
  });

  assertSection(profile, "Operations");
  assert.ok(profile.widgets.some((widget) => ["Bar Chart", "Top List", "Trend Indicator", "KPI Card"].includes(widget.type)));
}

async function testAccountingDashboard() {
  const profile = buildProfile(generateAccountingDataset(), {
    businessModel: { primaryModel: "accounting" },
  });

  assertSection(profile, "Accounting");
  assertSection(profile, "Cash Flow");
  assert.ok(profile.widgets.some((widget) => widget.sourceKPIs.includes("cash-flow")));
}

async function testHealthcareDashboard() {
  const profile = buildProfile(generateHealthcareDataset(), {
    businessModel: { primaryModel: "healthcare" },
  });

  assertSection(profile, "Operations");
  assert.ok(profile.widgets.some((widget) => widget.title === "Patient Volume"));
}

async function testManufacturingDashboard() {
  const profile = buildProfile(generateManufacturingDataset(), {
    businessModel: { primaryModel: "manufacturing" },
  });

  assertSection(profile, "Operations");
  assert.ok(profile.widgets.some((widget) => widget.title === "Manufacturing Yield"));
}

async function testMarketplaceDashboard() {
  const profile = buildProfile(generateMarketplaceDataset(), {
    businessModel: { detectedModels: ["marketplace", "retail"] },
  });

  assertSection(profile, "Executive Summary");
  assertSection(profile, "Risk Indicators");
  assert.ok(profile.widgets.some((widget) => widget.sourceKPIs.includes("refund-rate")));
}

async function testSaasDashboard() {
  const profile = buildProfile(generateSaasDataset(), {
    businessModel: { primaryModel: "saas" },
  });

  assertSection(profile, "Sales");
  assert.ok(profile.widgets.some((widget) => widget.sourceKPIs.includes("monthly-recurring-revenue")));
}

async function testExecutiveAndOperationalViews() {
  const profile = buildProfile(generateRetailDataset(), {
    businessModel: { primaryModel: "retail" },
  });

  assert.ok(profile.layout.viewModes.includes("Executive View"));
  assert.ok(profile.layout.viewModes.includes("Operational View"));
  assert.ok(profile.widgets.some((widget) => widget.viewModes.includes("Executive View")));
  assert.ok(profile.widgets.some((widget) => widget.viewModes.includes("Operational View")));
}

async function testWidgetSelectionAndResponsiveLayout() {
  const profile = buildProfile(generateRetailDataset(), {
    businessModel: { primaryModel: "retail" },
  });
  const widget = profile.widgets[0];

  assert.ok(widget);
  assert.ok(widget.confidence >= 0.45);
  assert.ok(widget.evidence.length > 0);
  assert.ok(widget.layout.desktop.columnSpan >= 1);
  assert.equal(widget.layout.mobile.columnSpan, 1);
  assert.equal(profile.layout.responsiveBreakpoints.desktop.columns, 12);
  assert.equal(profile.layout.responsiveBreakpoints.tablet.columns, 2);
  assert.equal(profile.layout.responsiveBreakpoints.mobile.columns, 1);
}

async function testStatisticsAndConfidence() {
  const profile = buildProfile(generateRetailDataset(), {
    businessModel: { primaryModel: "retail" },
  });

  assert.equal(profile.version, "bie.dashboard-profile.v1");
  assert.ok(profile.statistics.generatedSections > 0);
  assert.ok(profile.statistics.totalWidgets > 0);
  assert.ok(profile.statistics.coveragePercent > 40);
  assert.ok(profile.statistics.qualityScore > 35);
  assert.ok(profile.statistics.performanceScore > 40);
  assert.ok(profile.confidence > 0.45);
  assert.ok(profile.logs.some((log) => log.generatedWidget));
  assert.equal(profile.extensionPoints.drillDown, true);
  assert.equal(profile.extensionPoints.dashboardAiAssistant, true);
}

async function testPluginLoading() {
  const plugin: WidgetLibraryPlugin = {
    id: "custom-widget-pack",
    version: "1.0.0",
    register(library) {
      library.registerDefinition({
        id: "custom-executive-pulse",
        type: "Status Card",
        version: "1.0.0",
        supportedKpiCategories: ["Financial KPIs", "Business Health KPIs"],
        supportedAvailability: ["Available", "Partially Available"],
        supportedUnits: ["money", "score"],
        responsiveSpan: { desktop: 3, tablet: 2, mobile: 1 },
        minConfidence: 0.4,
        priority: 130,
        evidenceSignals: ["kpi-availability", "kpi-confidence", "widget-library"],
      });
    },
  };
  const registry = new DefaultWidgetLibraryRegistry();
  registry.registerPlugin(plugin);
  const context = createPipelineContext({
    id: "plugin_dashboard_test",
    fileName: "plugin.csv",
    rawText: generateRetailDataset(),
  });
  const rows = parseRows(generateRetailDataset());
  const structureProfile = buildDatasetStructureProfile(context);
  const semanticProfile = buildSemanticDatasetProfile({ structureProfile });
  const entityProfile = buildEntityDatasetProfile({ structureProfile, semanticProfile });
  const relationshipProfile = buildRelationshipDatasetProfile({
    structureProfile,
    semanticProfile,
    entityProfile,
    rows,
  });
  const businessMaturityProfile = buildBusinessMaturityProfile({
    structureProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    rows,
  });
  const kpiProfile = buildKPIDatasetProfile({
    structureProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessMaturityProfile,
  });
  const profile = buildDashboardProfile({
    context,
    kpiProfile,
    businessMaturityProfile,
    library: registry,
  });

  assert.ok(profile.widgets.some((widget) => widget.id.includes("custom-executive-pulse")));
  assert.equal(registry.toLibrary().plugins[0].id, "custom-widget-pack");
}

async function testPipelineIntegration() {
  const context = createPipelineContext({
    id: "dashboard_pipeline_test",
    fileName: "dashboard.csv",
    rawText: generateRetailDataset(),
  });
  const pipeline = new DatasetAnalysisPipeline({
    pipelineId: "dashboard_pipeline",
    context,
    scanners: [
      new UniversalDatasetStructureScanner(),
      new UniversalSemanticIntelligenceScanner(),
      new UniversalEntityIntelligenceScanner(),
      new UniversalRelationshipIntelligenceScanner(),
      new UniversalBusinessMaturityIntelligenceScanner(),
      new UniversalKPIDiscoveryEngine(),
      new UniversalIntelligentDashboardComposer(),
    ],
  });
  const result = await pipeline.run();

  assert.equal(result.report.status, "completed");
  assert.ok(result.context.semanticMap.dashboardProfile);
  assert.ok(
    result.report.executedScanners.some(
      (record) => record.scannerId === "bie.dashboard-composer.v1",
    ),
  );
}

function assertSection(profile: DashboardProfile, title: string): void {
  assert.ok(profile.sections.some((section) => section.title === title), `${title} should be generated.`);
}

function assertWidget(profile: DashboardProfile, type: string): void {
  assert.ok(profile.widgets.some((widget) => widget.type === type), `${type} should be generated.`);
}

function parseRows(rawText: string): Array<Record<string, string>> {
  const [headerLine = "", ...lines] = rawText.trim().split(/\r?\n/);
  const delimiter = headerLine.includes(";") ? ";" : ",";
  const headers = headerLine.split(delimiter).map((header) => header.trim());

  return lines.map((line) => {
    const cells = line.split(delimiter).map((cell) => cell.trim());
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function generateRetailDataset(): string {
  return [
    "order_date,order_number,customer_id,customer_email,revenue,cost,sku,product_name,category,inventory_quantity,store,currency,status",
    "2026-01-01,O-1,C-1,a@example.com,1200,700,SKU-1,Widget A,Hardware,20,Amsterdam,EUR,paid",
    "2026-01-02,O-2,C-2,b@example.com,800,420,SKU-2,Widget B,Hardware,12,Rotterdam,EUR,paid",
    "2026-02-01,O-3,C-1,a@example.com,1600,900,SKU-1,Widget A,Hardware,8,Amsterdam,EUR,refunded",
  ].join("\n");
}

function generateRestaurantDataset(): string {
  return [
    "order_date,order_number,table_status,revenue,quantity,product_name,category,customer_id",
    "2026-01-01,T-1,seated,70,3,Dinner Menu,Food,C-1",
    "2026-01-01,T-2,closed,90,4,Lunch Menu,Food,C-2",
  ].join("\n");
}

function generateAccountingDataset(): string {
  return [
    "invoice_number,payment,expense,customer_id,supplier,order_date,currency,status",
    "INV-1,paid,400,C-1,Supplier One,2026-01-01,EUR,paid",
    "INV-2,open,300,C-2,Supplier Two,2026-02-01,EUR,open",
  ].join("\n");
}

function generateManufacturingDataset(): string {
  return [
    "production_date,sku,product_name,quantity,cost,status,warehouse",
    "2026-01-01,SKU-1,Part A,100,500,complete,WH-1",
    "2026-01-02,SKU-2,Part B,85,450,complete,WH-1",
  ].join("\n");
}

function generateHealthcareDataset(): string {
  return [
    "visit_date,patient_email,status,region,revenue",
    "2026-01-01,p1@example.com,complete,North,200",
    "2026-01-02,p2@example.com,scheduled,South,180",
  ].join("\n");
}

function generateSaasDataset(): string {
  return [
    "order_date,customer_id,customer_email,plan,status,revenue,currency",
    "2026-01-01,C-1,a@example.com,Pro,active,120,EUR",
    "2026-02-01,C-2,b@example.com,Enterprise,churned,400,EUR",
    "2026-03-01,C-1,a@example.com,Pro,active,120,EUR",
  ].join("\n");
}

function generateMarketplaceDataset(): string {
  return [
    "order_date,order_number,buyer_id,seller_id,gross_merchandise_value,platform_fee,refund_amount,country,currency,status",
    "2026-01-01,O-1,B-1,S-1,1200,120,0,NL,EUR,paid",
    "2026-02-01,O-2,B-2,S-2,800,80,50,DE,EUR,refunded",
  ].join("\n");
}

async function run() {
  await testRetailDashboard();
  await testRestaurantDashboard();
  await testAccountingDashboard();
  await testHealthcareDashboard();
  await testManufacturingDashboard();
  await testMarketplaceDashboard();
  await testSaasDashboard();
  await testExecutiveAndOperationalViews();
  await testWidgetSelectionAndResponsiveLayout();
  await testStatisticsAndConfidence();
  await testPluginLoading();
  await testPipelineIntegration();

  process.stdout.write("BIE dashboard composer tests passed.\n");
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
