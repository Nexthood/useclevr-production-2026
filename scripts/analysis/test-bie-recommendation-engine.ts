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
  DefaultRecommendationLibraryRegistry,
  UniversalBusinessRecommendationEngine,
  UniversalInsightGenerationEngine,
  UniversalKPIDiscoveryEngine,
  buildInsightProfile,
  buildKPIDatasetProfile,
  buildRecommendationProfile,
  type RecommendationLibraryPlugin,
  type RecommendationProfile,
} from "../../src/lib/data/bie";

function buildProfile(rawText: string, contextPatch: Partial<PipelineContext> = {}): RecommendationProfile {
  const context = {
    ...createPipelineContext({
      id: "bie_recommendation_test",
      fileName: "recommendations.csv",
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
  const insightProfile = buildInsightProfile({
    context,
    kpiProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessMaturityProfile,
    businessModel: context.businessModel,
  });

  return buildRecommendationProfile({
    context,
    kpiProfile,
    insightProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessMaturityProfile,
    businessModel: context.businessModel,
  });
}

async function testRevenueRecommendations() {
  const profile = buildProfile(generateRetailDataset(), {
    businessModel: { primaryModel: "retail" },
  });

  assertRecommendationCategory(profile, "Revenue Growth");
  assert.ok(profile.recommendations.every((recommendation) => recommendation.evidence.length > 0));
}

async function testInventoryRecommendations() {
  const profile = buildProfile(generateInventoryDataset(), {
    businessModel: { primaryModel: "inventory" },
  });

  assertRecommendationCategory(profile, "Inventory Optimization");
  assert.ok(profile.recommendations.some((recommendation) => recommendation.supportingKPIs.includes("inventory-turnover") || recommendation.supportingKPIs.includes("reorder-risk")));
}

async function testAccountingRecommendations() {
  const profile = buildProfile(generateAccountingDataset(), {
    businessModel: { primaryModel: "accounting" },
  });

  assertRecommendationCategory(profile, "Cash Flow Improvement");
  assert.ok(profile.recommendations.some((recommendation) => recommendation.supportingKPIs.includes("cash-flow")));
}

async function testMarketingRecommendations() {
  const profile = buildProfile(generateMarketingDataset(), {
    businessModel: { primaryModel: "saas" },
  });

  assertRecommendationCategory(profile, "Customer Acquisition");
  assert.ok(profile.recommendations.some((recommendation) => recommendation.category === "Marketing Optimization" || recommendation.category === "Customer Acquisition"));
}

async function testWarehouseRecommendations() {
  const profile = buildProfile(generateWarehouseDataset(), {
    businessModel: { primaryModel: "logistics" },
  });

  assertRecommendationCategory(profile, "Warehouse Optimization");
}

async function testRestaurantRecommendations() {
  const profile = buildProfile(generateRestaurantDataset(), {
    businessModel: { primaryModel: "restaurant" },
  });

  assert.ok(profile.recommendations.some((recommendation) => ["Sales Optimization", "Store Optimization", "Inventory Optimization"].includes(recommendation.category)));
}

async function testHealthcareRecommendations() {
  const profile = buildProfile(generateHealthcareDataset(), {
    businessModel: { primaryModel: "healthcare" },
  });

  assert.ok(profile.recommendations.some((recommendation) => recommendation.category === "Employee Productivity" || recommendation.category === "Automation Opportunities" || recommendation.category === "Business Health"));
}

async function testPriorityConfidenceAndStatistics() {
  const profile = buildProfile(generateRetailDataset(), {
    businessModel: { primaryModel: "retail" },
  });

  assert.equal(profile.version, "bie.recommendation-profile.v1");
  assert.ok(profile.statistics.recommendationCount > 0);
  assert.ok(profile.statistics.averageConfidence >= 0.5);
  assert.ok(profile.statistics.estimatedBusinessValue > 30);
  assert.ok(profile.statistics.qualityScore > 35);
  assert.ok(profile.prioritySummary.length > 0);
  assert.ok(profile.confidenceSummary.high + profile.confidenceSummary.medium + profile.confidenceSummary.low === profile.statistics.recommendationCount);
  assert.ok(profile.recommendations.some((recommendation) => ["High", "Medium", "Critical"].includes(recommendation.priority)));
}

async function testDependencyEngine() {
  const profile = buildProfile(generateInventoryDataset(), {
    businessModel: { primaryModel: "retail" },
  });

  assert.ok(profile.dependencies.length > 0);
  assert.ok(profile.dependencies.every((dependency) => dependency.confidence > 0));
  assert.ok(profile.recommendations.some((recommendation) => recommendation.category === "Supplier Optimization"));
}

async function testDuplicateDetection() {
  const plugin: RecommendationLibraryPlugin = {
    id: "duplicate-risk-pack",
    version: "1.0.0",
    register(library) {
      const riskRule = library.getDefinition("risk-reduction-action");

      assert.ok(riskRule);
      library.registerDefinition({ ...riskRule, id: "risk-reduction-action-copy" });
    },
  };
  const registry = new DefaultRecommendationLibraryRegistry();
  registry.registerPlugin(plugin);
  const context = createPipelineContext({
    id: "duplicate_recommendation_test",
    fileName: "duplicate.csv",
    rawText: generateInventoryDataset(),
  });
  const rows = parseRows(generateInventoryDataset());
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
    businessModel: { primaryModel: "retail" },
    rows,
  });
  const kpiProfile = buildKPIDatasetProfile({
    structureProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessMaturityProfile,
    businessModel: { primaryModel: "retail" },
  });
  const insightProfile = buildInsightProfile({
    context,
    kpiProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessMaturityProfile,
    businessModel: { primaryModel: "retail" },
  });
  const profile = buildRecommendationProfile({
    context,
    kpiProfile,
    insightProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessMaturityProfile,
    businessModel: { primaryModel: "retail" },
    library: registry,
  });

  assert.equal(registry.toLibrary().plugins[0].id, "duplicate-risk-pack");
  assert.ok(profile.duplicates.length > 0);
  assert.ok(profile.statistics.duplicateRecommendations > 0);
  assert.ok(profile.overlaps.length > 0);
}

async function testPipelineIntegration() {
  const context = createPipelineContext({
    id: "recommendation_pipeline_test",
    fileName: "recommendations.csv",
    rawText: generateRetailDataset(),
  });
  const pipeline = new DatasetAnalysisPipeline({
    pipelineId: "recommendation_pipeline",
    context,
    scanners: [
      new UniversalDatasetStructureScanner(),
      new UniversalSemanticIntelligenceScanner(),
      new UniversalEntityIntelligenceScanner(),
      new UniversalRelationshipIntelligenceScanner(),
      new UniversalBusinessMaturityIntelligenceScanner(),
      new UniversalKPIDiscoveryEngine(),
      new UniversalInsightGenerationEngine(),
      new UniversalBusinessRecommendationEngine(),
    ],
  });
  const result = await pipeline.run();

  assert.equal(result.report.status, "completed");
  assert.ok(result.context.semanticMap.recommendationProfile);
  assert.ok(
    result.report.executedScanners.some(
      (record) => record.scannerId === "bie.business-recommendation-engine.v1",
    ),
  );
}

function assertRecommendationCategory(profile: RecommendationProfile, category: string): void {
  assert.ok(profile.recommendations.some((recommendation) => recommendation.category === category), `${category} should be generated.`);
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
    "order_date,sku,product_name,category,inventory_quantity,quantity,cost,supplier,warehouse,revenue,status",
    "2026-01-01,SKU-1,Widget A,Hardware,20,4,700,Supplier A,WH-1,1200,active",
    "2026-01-02,SKU-2,Widget B,Hardware,4,2,420,Supplier B,WH-1,800,low",
    "2026-02-01,SKU-3,Widget C,Parts,0,0,150,Supplier B,WH-2,0,out",
  ].join("\n");
}

function generateAccountingDataset(): string {
  return [
    "invoice_number,payment,expense,customer_id,supplier,order_date,currency,status,tax",
    "INV-1,paid,400,C-1,Supplier One,2026-01-01,EUR,paid,80",
    "INV-2,open,300,C-2,Supplier Two,2026-02-01,EUR,open,60",
  ].join("\n");
}

function generateMarketingDataset(): string {
  return [
    "order_date,customer_id,customer_email,plan,status,revenue,cost,channel,currency",
    "2026-01-01,C-1,a@example.com,Pro,active,120,40,Referral,EUR",
    "2026-02-01,C-2,b@example.com,Enterprise,churned,400,120,LinkedIn Ads,EUR",
    "2026-03-01,C-1,a@example.com,Pro,active,120,30,Organic,EUR",
  ].join("\n");
}

function generateWarehouseDataset(): string {
  return [
    "order_date,sku,product_name,inventory_quantity,quantity,warehouse,cost,status",
    "2026-01-01,SKU-1,Part A,100,30,WH-1,500,complete",
    "2026-01-02,SKU-2,Part B,85,25,WH-2,450,complete",
  ].join("\n");
}

function generateRestaurantDataset(): string {
  return [
    "order_date,order_number,table_status,revenue,cost,quantity,product_name,category,store",
    "2026-01-01,T-1,seated,70,30,3,Dinner Menu,Food,Central",
    "2026-01-01,T-2,closed,90,42,4,Lunch Menu,Food,Central",
  ].join("\n");
}

function generateHealthcareDataset(): string {
  return [
    "visit_date,patient_email,status,region,revenue,employee_id,department,expense",
    "2026-01-01,p1@example.com,complete,North,200,E-1,Care,120",
    "2026-01-02,p2@example.com,scheduled,South,180,E-2,Care,110",
  ].join("\n");
}

async function run() {
  await testRevenueRecommendations();
  await testInventoryRecommendations();
  await testAccountingRecommendations();
  await testMarketingRecommendations();
  await testWarehouseRecommendations();
  await testRestaurantRecommendations();
  await testHealthcareRecommendations();
  await testPriorityConfidenceAndStatistics();
  await testDependencyEngine();
  await testDuplicateDetection();
  await testPipelineIntegration();

  process.stdout.write("BIE recommendation engine tests passed.\n");
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
