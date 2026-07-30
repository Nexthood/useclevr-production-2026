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
  DefaultInsightLibraryRegistry,
  UniversalInsightGenerationEngine,
  UniversalKPIDiscoveryEngine,
  buildInsightProfile,
  buildKPIDatasetProfile,
  type InsightLibraryPlugin,
  type InsightProfile,
} from "../../src/lib/data/bie";

function buildProfile(rawText: string, contextPatch: Partial<PipelineContext> = {}): InsightProfile {
  const context = {
    ...createPipelineContext({
      id: "bie_insight_test",
      fileName: "insights.csv",
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

  return buildInsightProfile({
    context,
    kpiProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessMaturityProfile,
    businessModel: context.businessModel,
  });
}

async function testRevenueInsightGeneration() {
  const profile = buildProfile(generateRetailDataset(), {
    businessModel: { primaryModel: "retail" },
  });

  assertInsightCategory(profile, "Revenue Insights");
  assert.ok(profile.insights.some((insight) => insight.supportingKPIs.includes("revenue")));
  assert.ok(profile.insights.every((insight) => insight.evidence.length > 0));
}

async function testInventoryInsightGeneration() {
  const profile = buildProfile(generateInventoryDataset(), {
    businessModel: { primaryModel: "inventory" },
  });

  assertInsightCategory(profile, "Inventory Insights");
  assert.ok(profile.insights.some((insight) => insight.group === "Inventory"));
}

async function testCustomerInsightGeneration() {
  const profile = buildProfile(generateSaasDataset(), {
    businessModel: { primaryModel: "saas" },
  });

  assertInsightCategory(profile, "Customer Insights");
  assert.ok(profile.insights.some((insight) => insight.supportingKPIs.includes("monthly-recurring-revenue")));
}

async function testAccountingInsightGeneration() {
  const profile = buildProfile(generateAccountingDataset(), {
    businessModel: { primaryModel: "accounting" },
  });

  assertInsightCategory(profile, "Accounting Insights");
  assert.ok(profile.insights.some((insight) => insight.supportingKPIs.includes("cash-flow")));
}

async function testOperationalInsightGeneration() {
  const profile = buildProfile(generateManufacturingDataset(), {
    businessModel: { primaryModel: "manufacturing" },
  });

  assertInsightCategory(profile, "Operational Insights");
  assert.ok(profile.insights.some((insight) => insight.group === "Operational"));
}

async function testPriorityClassificationAndEvidence() {
  const profile = buildProfile(generateRetailDataset(), {
    businessModel: { primaryModel: "retail" },
  });
  const highImpact = profile.insights.find((insight) => insight.priority === "High" || insight.priority === "Critical");

  assert.ok(highImpact, "At least one high-impact insight should be prioritized.");
  assert.ok(highImpact.businessImpact >= 60);
  assert.ok(highImpact.confidence >= 0.45);
  assert.ok(highImpact.evidence.some((item) => item.type === "kpi"));
  assert.ok(highImpact.recommendedInvestigation.length > 0);
}

async function testDuplicateInsightDetection() {
  const plugin: InsightLibraryPlugin = {
    id: "duplicate-revenue-pack",
    version: "1.0.0",
    register(library) {
      const revenueRule = library.getDefinition("revenue-visibility");

      assert.ok(revenueRule);
      library.registerDefinition({ ...revenueRule, id: "revenue-visibility-copy" });
    },
  };
  const registry = new DefaultInsightLibraryRegistry();
  registry.registerPlugin(plugin);
  const context = createPipelineContext({
    id: "duplicate_insight_test",
    fileName: "duplicate.csv",
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
  const profile = buildInsightProfile({
    context,
    kpiProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessMaturityProfile,
    library: registry,
  });

  assert.equal(registry.toLibrary().plugins[0].id, "duplicate-revenue-pack");
  assert.ok(profile.duplicates.length > 0);
  assert.ok(profile.statistics.duplicateInsights > 0);
  assert.ok(profile.overlaps.length > 0);
  assert.ok(profile.logs.length >= profile.insights.length);
}

async function testStatisticsAndConfidence() {
  const profile = buildProfile(generateRetailDataset(), {
    businessModel: { primaryModel: "retail" },
  });

  assert.equal(profile.version, "bie.insight-profile.v1");
  assert.ok(profile.statistics.insightCount > 0);
  assert.ok(profile.statistics.averageConfidence >= 0.45);
  assert.ok(profile.statistics.coveragePercent > 40);
  assert.ok(profile.statistics.businessHealthImpact > 30);
  assert.ok(profile.statistics.qualityScore > 35);
  assert.ok(profile.confidence > 0.45);
  assert.equal(profile.extensionPoints.rootCauseAnalysis, true);
  assert.equal(profile.extensionPoints.recommendationEngine, true);
}

async function testGroupedInsightProfile() {
  const profile = buildProfile(generateRetailDataset(), {
    businessModel: { primaryModel: "retail" },
  });

  assert.ok(profile.groups.some((group) => group.group === "Financial"));
  assert.ok(profile.groups.some((group) => group.group === "Executive" || group.group === "Risk"));
  assert.ok(profile.groups.every((group) => group.insightIds.length > 0));
}

async function testPipelineIntegration() {
  const context = createPipelineContext({
    id: "insight_pipeline_test",
    fileName: "insights.csv",
    rawText: generateRetailDataset(),
  });
  const pipeline = new DatasetAnalysisPipeline({
    pipelineId: "insight_pipeline",
    context,
    scanners: [
      new UniversalDatasetStructureScanner(),
      new UniversalSemanticIntelligenceScanner(),
      new UniversalEntityIntelligenceScanner(),
      new UniversalRelationshipIntelligenceScanner(),
      new UniversalBusinessMaturityIntelligenceScanner(),
      new UniversalKPIDiscoveryEngine(),
      new UniversalInsightGenerationEngine(),
    ],
  });
  const result = await pipeline.run();

  assert.equal(result.report.status, "completed");
  assert.ok(result.context.semanticMap.insightProfile);
  assert.ok(
    result.report.executedScanners.some(
      (record) => record.scannerId === "bie.insight-generation-engine.v1",
    ),
  );
}

function assertInsightCategory(profile: InsightProfile, category: string): void {
  assert.ok(profile.insights.some((insight) => insight.category === category), `${category} should be generated.`);
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

function generateInventoryDataset(): string {
  return [
    "sku,product_name,category,inventory_quantity,quantity,cost,warehouse,status",
    "SKU-1,Widget A,Hardware,20,4,700,WH-1,active",
    "SKU-2,Widget B,Hardware,4,2,420,WH-1,low",
    "SKU-3,Widget C,Parts,0,0,150,WH-2,out",
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

function generateAccountingDataset(): string {
  return [
    "invoice_number,payment,expense,customer_id,supplier,order_date,currency,status",
    "INV-1,paid,400,C-1,Supplier One,2026-01-01,EUR,paid",
    "INV-2,open,300,C-2,Supplier Two,2026-02-01,EUR,open",
  ].join("\n");
}

function generateManufacturingDataset(): string {
  return [
    "production_date,sku,product_name,quantity,cost,status,warehouse,employee_id,department",
    "2026-01-01,SKU-1,Part A,100,500,complete,WH-1,E-1,Assembly",
    "2026-01-02,SKU-2,Part B,85,450,complete,WH-1,E-2,Assembly",
  ].join("\n");
}

async function run() {
  await testRevenueInsightGeneration();
  await testInventoryInsightGeneration();
  await testCustomerInsightGeneration();
  await testAccountingInsightGeneration();
  await testOperationalInsightGeneration();
  await testPriorityClassificationAndEvidence();
  await testDuplicateInsightDetection();
  await testStatisticsAndConfidence();
  await testGroupedInsightProfile();
  await testPipelineIntegration();

  process.stdout.write("BIE insight generation engine tests passed.\n");
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
