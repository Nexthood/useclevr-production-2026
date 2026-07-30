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
  DefaultForecastLibraryRegistry,
  UniversalBusinessRecommendationEngine,
  UniversalForecastScenarioIntelligenceEngine,
  UniversalInsightGenerationEngine,
  UniversalKPIDiscoveryEngine,
  buildForecastProfile,
  buildInsightProfile,
  buildKPIDatasetProfile,
  buildRecommendationProfile,
  type ForecastLibraryPlugin,
  type ForecastProfile,
} from "../../src/lib/data/bie";

function buildProfile(rawText: string, contextPatch: Partial<PipelineContext> = {}): ForecastProfile {
  const context = {
    ...createPipelineContext({
      id: "bie_forecast_test",
      fileName: "forecast.csv",
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
  const recommendationProfile = buildRecommendationProfile({
    context,
    kpiProfile,
    insightProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessMaturityProfile,
    businessModel: context.businessModel,
  });

  return buildForecastProfile({
    context,
    kpiProfile,
    insightProfile,
    recommendationProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessMaturityProfile,
    businessModel: context.businessModel,
    rows,
  });
}

async function testRevenueForecast() {
  const profile = buildProfile(generateRetailDataset(), {
    businessModel: { primaryModel: "retail" },
  });
  const forecast = profile.forecasts.find((item) => item.category === "Revenue Forecast");

  assert.ok(forecast, "Revenue Forecast should be generated.");
  assert.equal(forecast.modelUsed, "Linear Trend");
  assert.ok(forecast.prediction > 0);
  assert.ok(forecast.confidence >= 0.48);
  assert.ok(forecast.evidence.some((item) => item.type === "historical-data"));
}

async function testInventoryForecast() {
  const profile = buildProfile(generateInventoryDataset(), {
    businessModel: { primaryModel: "inventory" },
  });
  const forecast = profile.forecasts.find((item) => item.category === "Inventory Forecast");

  assert.ok(forecast, "Inventory Forecast should be generated.");
  assert.equal(forecast.modelUsed, "Exponential Smoothing");
  assert.ok(forecast.supportingKPIs.includes("inventory-turnover") || forecast.supportingKPIs.includes("stock-coverage"));
}

async function testDemandAndCashFlowForecasts() {
  const demandProfile = buildProfile(generateDemandDataset(), {
    businessModel: { primaryModel: "retail" },
  });
  const cashProfile = buildProfile(generateAccountingDataset(), {
    businessModel: { primaryModel: "accounting" },
  });

  assert.ok(demandProfile.forecasts.some((forecast) => forecast.category === "Demand Forecast"));
  assert.ok(cashProfile.forecasts.some((forecast) => forecast.category === "Cash Flow Forecast"));
}

async function testScenarioComparison() {
  const profile = buildProfile(generateRetailDataset(), {
    businessModel: { primaryModel: "retail" },
  });
  const scenario = profile.scenarios.find((item) => item.type === "Price Increase");

  assert.ok(scenario, "Price Increase scenario should be generated.");
  assert.ok(scenario.comparisonWithBaseline.baselineForecastId.startsWith("forecast-"));
  assert.notEqual(scenario.comparisonWithBaseline.delta, 0);
  assert.ok(scenario.evidence.some((item) => item.type === "scenario-rule"));
}

async function testConfidenceIntervalsAndStatistics() {
  const profile = buildProfile(generateRetailDataset(), {
    businessModel: { primaryModel: "retail" },
  });

  assert.equal(profile.version, "bie.forecast-profile.v1");
  assert.ok(profile.forecasts.length > 0);
  assert.ok(profile.forecasts.every((forecast) => forecast.confidenceInterval.lower <= forecast.prediction));
  assert.ok(profile.forecasts.every((forecast) => forecast.confidenceInterval.upper >= forecast.prediction));
  assert.ok(profile.forecasts.every((forecast) => forecast.confidenceInterval.level === 0.8));
  assert.ok(profile.statistics.forecastCount === profile.forecasts.length);
  assert.ok(profile.statistics.scenarioCount === profile.scenarios.length);
  assert.ok(profile.statistics.averageConfidence >= 0.48);
  assert.equal(profile.statistics.forecastAccuracy, null);
}

async function testForecastModels() {
  const retailProfile = buildProfile(generateRetailDataset(), {
    businessModel: { primaryModel: "retail" },
  });
  const inventoryProfile = buildProfile(generateInventoryDataset(), {
    businessModel: { primaryModel: "inventory" },
  });
  const accountingProfile = buildProfile(generateAccountingDataset(), {
    businessModel: { primaryModel: "accounting" },
  });
  const usedModels = new Set([
    ...retailProfile.forecasts.map((forecast) => forecast.modelUsed),
    ...inventoryProfile.forecasts.map((forecast) => forecast.modelUsed),
    ...accountingProfile.forecasts.map((forecast) => forecast.modelUsed),
  ]);

  assert.ok(usedModels.has("Linear Trend"));
  assert.ok(usedModels.has("Moving Average") || usedModels.has("Exponential Smoothing"));
  assert.ok(usedModels.has("Regression"));
}

async function testPluginLoading() {
  const plugin: ForecastLibraryPlugin = {
    id: "custom-risk-forecast-pack",
    version: "1.0.0",
    register(library) {
      library.registerModel({
        id: "custom-risk-profile-forecast",
        version: "1.0.0",
        name: "Hybrid Model",
        description: "Custom risk forecast model for test plugins.",
        supportedCategories: ["Risk Forecast"],
        supportedKpiCategories: ["Risk KPIs", "Business Health KPIs"],
        supportedKpiIds: [],
        requiredSemanticCategories: ["Date"],
        businessModels: ["generic", "retail"],
        minimumPeriods: 1,
        horizonPeriods: 1,
        baseConfidence: 0.7,
        priority: 130,
      });
    },
  };
  const registry = new DefaultForecastLibraryRegistry();
  registry.registerPlugin(plugin);

  const profile = buildProfileWithLibrary(generateRetailDataset(), registry);

  assert.equal(registry.toLibrary().plugins[0].id, "custom-risk-forecast-pack");
  assert.ok(profile.forecasts.some((forecast) => forecast.modelId === "custom-risk-profile-forecast"));
}

async function testPipelineIntegration() {
  const context = createPipelineContext({
    id: "forecast_pipeline_test",
    fileName: "forecast.csv",
    rawText: generateRetailDataset(),
  });
  const pipeline = new DatasetAnalysisPipeline({
    pipelineId: "forecast_pipeline",
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
      new UniversalForecastScenarioIntelligenceEngine(),
    ],
  });
  const result = await pipeline.run();

  assert.equal(result.report.status, "completed");
  assert.ok(result.context.semanticMap.forecastProfile);
  assert.ok(
    result.report.executedScanners.some(
      (record) => record.scannerId === "bie.forecast-scenario-intelligence-engine.v1",
    ),
  );
}

function buildProfileWithLibrary(
  rawText: string,
  library: DefaultForecastLibraryRegistry,
): ForecastProfile {
  const context = createPipelineContext({
    id: "forecast_plugin_test",
    fileName: "forecast-plugin.csv",
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
  const recommendationProfile = buildRecommendationProfile({
    context,
    kpiProfile,
    insightProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessMaturityProfile,
    businessModel: { primaryModel: "retail" },
  });

  return buildForecastProfile({
    context,
    kpiProfile,
    insightProfile,
    recommendationProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessMaturityProfile,
    businessModel: { primaryModel: "retail" },
    rows,
    library,
  });
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
    "order_date,order_number,customer_id,revenue,cost,quantity,sku,product_name,category,inventory_quantity,store,currency,status",
    "2026-01-01,O-1,C-1,1200,700,4,SKU-1,Widget A,Hardware,20,Amsterdam,EUR,paid",
    "2026-02-01,O-2,C-2,1400,820,5,SKU-2,Widget B,Hardware,18,Rotterdam,EUR,paid",
    "2026-03-01,O-3,C-3,1600,900,7,SKU-1,Widget A,Hardware,12,Amsterdam,EUR,paid",
    "2026-04-01,O-4,C-2,1900,1040,8,SKU-3,Widget C,Parts,10,Amsterdam,EUR,paid",
  ].join("\n");
}

function generateInventoryDataset(): string {
  return [
    "order_date,sku,product_name,category,inventory_quantity,quantity,cost,supplier,warehouse,revenue,status",
    "2026-01-01,SKU-1,Widget A,Hardware,40,6,700,Supplier A,WH-1,1200,active",
    "2026-02-01,SKU-2,Widget B,Hardware,26,8,820,Supplier B,WH-1,1400,active",
    "2026-03-01,SKU-3,Widget C,Parts,15,10,900,Supplier B,WH-2,1600,low",
  ].join("\n");
}

function generateDemandDataset(): string {
  return [
    "order_date,quantity,revenue,customer_id,product_name,category,currency",
    "2026-01-01,20,1000,C-1,Widget A,Hardware,EUR",
    "2026-02-01,24,1250,C-2,Widget B,Hardware,EUR",
    "2026-03-01,28,1480,C-3,Widget C,Parts,EUR",
  ].join("\n");
}

function generateAccountingDataset(): string {
  return [
    "order_date,invoice_number,payment,expense,revenue,cost,customer_id,supplier,currency,status,tax",
    "2026-01-01,INV-1,paid,400,1300,720,C-1,Supplier One,EUR,paid,80",
    "2026-02-01,INV-2,open,460,1420,780,C-2,Supplier Two,EUR,open,90",
    "2026-03-01,INV-3,paid,520,1560,830,C-3,Supplier Two,EUR,paid,95",
  ].join("\n");
}

async function run() {
  await testRevenueForecast();
  await testInventoryForecast();
  await testDemandAndCashFlowForecasts();
  await testScenarioComparison();
  await testConfidenceIntervalsAndStatistics();
  await testForecastModels();
  await testPluginLoading();
  await testPipelineIntegration();

  process.stdout.write("BIE forecast and scenario engine tests passed.\n");
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
