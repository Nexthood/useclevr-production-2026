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
  DefaultKPILibraryRegistry,
  UniversalKPIDiscoveryEngine,
  buildKPIDatasetProfile,
  type KPIDatasetProfile,
  type KPILibraryPlugin,
} from "../../src/lib/data/bie";

function buildProfile(rawText: string, contextPatch: Partial<PipelineContext> = {}): KPIDatasetProfile {
  const context = {
    ...createPipelineContext({
      id: "bie_kpi_test",
      fileName: "kpi.csv",
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

  return buildKPIDatasetProfile({
    structureProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessMaturityProfile,
    businessModel: context.businessModel,
    industry: context.industry,
  });
}

async function testRetailKpis() {
  const profile = buildProfile(generateRetailDataset(), {
    businessModel: { primaryModel: "retail" },
  });

  assertAvailable(profile, "revenue");
  assertAvailable(profile, "gross-profit");
  assertAvailable(profile, "margin");
  assertAvailable(profile, "average-order-value");
  assertDetected(profile, "inventory-turnover");
  assert.ok(profile.categories.includes("Inventory KPIs"));
  assert.ok(profile.statistics.availableKPIs >= 4);
}

async function testRestaurantKpis() {
  const profile = buildProfile(generateRestaurantDataset(), {
    businessModel: { primaryModel: "restaurant" },
  });

  assertDetected(profile, "table-turnover");
  assertDetected(profile, "average-basket-size");
  assert.ok(profile.statistics.categoryDistribution["Restaurant KPIs"] > 0);
}

async function testAccountingKpis() {
  const profile = buildProfile(generateAccountingDataset(), {
    businessModel: { primaryModel: "accounting" },
  });

  assertAvailable(profile, "cash-flow");
  assertAvailable(profile, "accounts-receivable");
  assertDetected(profile, "operating-expenses");
  assert.ok(profile.dependencies.nodes.some((node) => node.kpiId === "working-capital"));
}

async function testManufacturingKpis() {
  const profile = buildProfile(generateManufacturingDataset(), {
    businessModel: { primaryModel: "manufacturing" },
  });

  assertDetected(profile, "manufacturing-yield");
  assertDetected(profile, "cogs");
  assert.ok(profile.categories.includes("Manufacturing KPIs"));
}

async function testHealthcareKpis() {
  const profile = buildProfile(generateHealthcareDataset(), {
    businessModel: { primaryModel: "healthcare" },
  });

  assertDetected(profile, "patient-volume");
  assert.ok(profile.statistics.categoryDistribution["Healthcare KPIs"] > 0);
}

async function testHospitalityKpis() {
  const profile = buildProfile(generateHospitalityDataset(), {
    businessModel: { primaryModel: "hospitality" },
  });

  assertDetected(profile, "occupancy-rate");
  assert.ok(profile.statistics.categoryDistribution["Hospitality KPIs"] > 0);
}

async function testSaasKpis() {
  const profile = buildProfile(generateSaasDataset(), {
    businessModel: { primaryModel: "saas" },
  });

  assertAvailable(profile, "monthly-recurring-revenue");
  assertDetected(profile, "annual-recurring-revenue");
  assertDetected(profile, "churn");
  assert.ok(profile.statistics.categoryDistribution["SaaS KPIs"] > 0);
}

async function testMarketplaceAndHybridBusiness() {
  const profile = buildProfile(generateMarketplaceDataset(), {
    businessModel: { detectedModels: ["marketplace", "retail"] },
  });

  assertAvailable(profile, "revenue");
  assertDetected(profile, "refund-rate");
  assertDetected(profile, "customer-lifetime-value");
  assert.ok(profile.statistics.detectedKPIs > 10);
}

async function testMissingDataAndAlternatives() {
  const profile = buildProfile(["customer_id,status", "C-1,active", "C-2,churned"].join("\n"), {
    businessModel: { primaryModel: "saas" },
  });
  const revenue = getKpi(profile, "revenue");
  const mrr = getKpi(profile, "monthly-recurring-revenue");

  assert.equal(revenue.calculationAvailability, "Unavailable");
  assert.ok(mrr.missingFields.includes("Revenue"));
  assert.ok(mrr.recommendation);
  assert.ok(profile.missingData.some((item) => item.kpiId === "monthly-recurring-revenue"));
}

async function testDependencyGraphAndStatistics() {
  const profile = buildProfile(generateRetailDataset(), {
    businessModel: { primaryModel: "retail" },
  });
  const marginNode = profile.dependencies.nodes.find((node) => node.kpiId === "margin");

  assert.ok(marginNode);
  assert.ok(marginNode.dependencies.includes("gross-profit"));
  assert.ok(profile.dependencies.edges.some((edge) => edge.from === "gross-profit" && edge.to === "margin"));
  assert.ok(profile.statistics.coveragePercent > 40);
  assert.ok(profile.statistics.averageConfidence > 0.45);
  assert.ok(profile.statistics.qualityScore > 35);
}

async function testConfidenceEngine() {
  const rich = buildProfile(generateRetailDataset(), { businessModel: { primaryModel: "retail" } });
  const sparse = buildProfile(["customer_id,status", "C-1,active"].join("\n"), {
    businessModel: { primaryModel: "retail" },
  });

  assert.ok(getKpi(rich, "revenue").confidence > getKpi(sparse, "revenue").confidence);
  assert.ok(getKpi(rich, "revenue").evidence.some((item) => item.type === "semantic-field"));
  assert.ok(getKpi(rich, "revenue").evidence.some((item) => item.type === "business-model-fit"));
}

async function testPluginLoading() {
  const plugin: KPILibraryPlugin = {
    id: "test-custom-kpis",
    version: "1.0.0",
    register(library) {
      library.registerDefinition({
        id: "custom-ticket-resolution",
        name: "Custom Ticket Resolution",
        category: "Operational KPIs",
        description: "Measures ticket resolution when status and date fields are available.",
        businessModels: ["generic"],
        industries: ["generic"],
        formula: {
          expression: "resolved tickets / total tickets",
          dependsOn: [],
          requiredSemanticCategories: ["Status", "Date"],
          optionalSemanticCategories: ["Customer"],
        },
        dependencies: [],
        requiredFields: ["Status", "Date"],
        optionalFields: ["Customer"],
        visualizationRecommendations: ["bar-chart"],
        thresholds: [],
        units: ["percentage"],
        supportedCurrencies: [],
        version: "1.0.0",
        relevanceSignals: {
          semanticCategories: ["Status", "Date"],
          entityTypes: [],
          relationshipTypes: [],
          maturityDimensions: [],
          vocabulary: ["ticket", "resolution"],
        },
      });
    },
  };
  const registry = new DefaultKPILibraryRegistry();
  registry.registerPlugin(plugin);
  const profile = buildProfileWithLibrary(
    ["ticket_id,status,created_date,customer_id", "T-1,resolved,2026-01-01,C-1"].join("\n"),
    registry,
  );

  assertDetected(profile, "custom-ticket-resolution");
  assert.equal(registry.toLibrary().plugins[0].id, "test-custom-kpis");
}

async function testPipelineIntegration() {
  const context = createPipelineContext({
    id: "bie_pipeline_test",
    fileName: "kpi.csv",
    rawText: generateRetailDataset(),
  });
  const pipeline = new DatasetAnalysisPipeline({
    pipelineId: "bie_kpi_pipeline",
    context,
    scanners: [
      new UniversalDatasetStructureScanner(),
      new UniversalSemanticIntelligenceScanner(),
      new UniversalEntityIntelligenceScanner(),
      new UniversalRelationshipIntelligenceScanner(),
      new UniversalBusinessMaturityIntelligenceScanner(),
      new UniversalKPIDiscoveryEngine(),
    ],
  });
  const result = await pipeline.run();

  assert.equal(result.report.status, "completed");
  assert.ok(result.context.semanticMap.kpiProfile);
  assert.ok(result.context.kpis.length > 0);
  assert.ok(
    result.report.executedScanners.some(
      (record) => record.scannerId === "bie.kpi-discovery-engine.v1",
    ),
  );
}

function buildProfileWithLibrary(
  rawText: string,
  library: DefaultKPILibraryRegistry,
): KPIDatasetProfile {
  const context = createPipelineContext({
    id: "plugin_kpi_test",
    fileName: "plugin.csv",
    rawText,
  });
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
    rows,
  });

  return buildKPIDatasetProfile({
    structureProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessMaturityProfile,
    library,
  });
}

function assertDetected(profile: KPIDatasetProfile, id: string): void {
  assert.ok(profile.detectedKPIs.some((kpi) => kpi.id === id), `${id} should be detected.`);
}

function assertAvailable(profile: KPIDatasetProfile, id: string): void {
  const kpi = getKpi(profile, id);

  assert.equal(kpi.calculationAvailability, "Available", `${id} should be available.`);
}

function getKpi(profile: KPIDatasetProfile, id: string) {
  const kpi = profile.detectedKPIs.find((item) => item.id === id);

  assert.ok(kpi, `${id} should be present.`);
  return kpi;
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

function generateHospitalityDataset(): string {
  return [
    "booking_date,customer_id,status,revenue,region",
    "2026-01-01,C-1,occupied,180,North",
    "2026-01-02,C-2,vacant,0,South",
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
  await testRetailKpis();
  await testRestaurantKpis();
  await testAccountingKpis();
  await testManufacturingKpis();
  await testHealthcareKpis();
  await testHospitalityKpis();
  await testSaasKpis();
  await testMarketplaceAndHybridBusiness();
  await testMissingDataAndAlternatives();
  await testDependencyGraphAndStatistics();
  await testConfidenceEngine();
  await testPluginLoading();
  await testPipelineIntegration();

  process.stdout.write("BIE KPI discovery engine tests passed.\n");
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
