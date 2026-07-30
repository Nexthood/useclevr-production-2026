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
  type BusinessMaturityProfile,
  type CompanyGrowthStage,
} from "../../src/lib/data/edie";

function buildProfile(rawText: string): BusinessMaturityProfile {
  const context = createPipelineContext({
    id: "maturity_test",
    fileName: "maturity.csv",
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

  return buildBusinessMaturityProfile({
    structureProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    rows,
  });
}

async function testStartupDetection() {
  const profile = buildProfile(
    [
      "product_name,status,founder_note,order_date",
      "Prototype,testing,founder interview,2026-01-01",
      "Prototype,active,early roadmap,2026-02-01",
      "Launch Plan,planned,market hypothesis,2026-03-01",
    ].join("\n"),
  );

  assertStage(profile, ["MVP", "Pre-Revenue Startup", "Early Customers"]);
  assert.ok(profile.growthStage.confidence >= 0.5);
  assert.ok(profile.unknownAreas.length >= 0);
}

async function testSmeDetection() {
  const profile = buildProfile(generateCommercialDataset(240, { customers: 48, products: 18 }));

  assertStage(profile, ["Product-Market Fit", "Growth", "Early Customers"]);
  assert.ok(profile.statistics.overallMaturityScore > 35);
  assert.ok(profile.complexityIndicators.numberOfCustomers >= 40);
  assert.ok(profile.healthIndicators.reportingReadiness > 30);
}

async function testEnterpriseDetection() {
  const profile = buildProfile(
    generateCommercialDataset(9000, {
      customers: 1400,
      products: 640,
      employees: 420,
      stores: 7,
      warehouses: 4,
      departments: 9,
    }),
  );

  assertStage(profile, ["Scaling", "Regional Enterprise", "National Enterprise"]);
  assert.ok(profile.companySize.score > 65);
  assert.ok(profile.operationalComplexity.score > 45);
  assert.ok(profile.statistics.businessHealthScore > 40);
}

async function testFranchiseDetection() {
  const profile = buildProfile(
    generateCommercialDataset(420, {
      customers: 120,
      products: 35,
      stores: 8,
      brand: "FranchiseBrand",
      extraHeader: "franchisee_id",
      extraValue: (index) => `FR-${(index % 6) + 1}`,
    }),
  );

  assert.equal(profile.growthStage.stage, "Franchise");
  assert.ok(profile.growthStage.evidence.some((item) => item.type === "business-vocabulary"));
}

async function testHoldingAndInternationalDetection() {
  const holding = buildProfile(
    [
      "holding_company,subsidiary,legal_entity,country,currency,department,employee_id,invoice_number,revenue,order_date",
      "Parent Group,North Subsidiary,Legal Entity NL,NL,EUR,Finance,EMP-1,INV-1,1000,2025-01-01",
      "Parent Group,South Subsidiary,Legal Entity DE,DE,EUR,Operations,EMP-2,INV-2,2000,2025-02-01",
      "Parent Group,West Subsidiary,Legal Entity BE,BE,EUR,Sales,EMP-3,INV-3,3000,2025-03-01",
    ].join("\n"),
  );
  const international = buildProfile(
    generateCommercialDataset(500, {
      customers: 180,
      products: 60,
      countries: ["NL", "DE", "FR", "ES"],
      currencies: ["EUR", "EUR", "EUR", "EUR"],
    }),
  );

  assert.equal(holding.growthStage.stage, "Holding Company");
  assert.equal(international.growthStage.stage, "International Enterprise");
  assert.ok(international.statistics.dimensionScores["International Presence"] > 60);
}

async function testUnknownMaturity() {
  const profile = buildProfile(["opaque_value", "x"].join("\n"));

  assert.equal(profile.growthStage.stage, "Unknown");
  assert.ok(profile.unknownAreas.length > 0);
  assert.ok(profile.warnings.some((warning) => warning.includes("needs review")));
}

async function testReadinessStatisticsAndConfidence() {
  const profile = buildProfile(generateCommercialDataset(360, { customers: 80, products: 25 }));

  assert.equal(profile.version, "edie.business-maturity.v1");
  assert.equal(profile.dimensionScores.length, 17);
  assert.ok(profile.statistics.coveragePercent > 70);
  assert.ok(profile.statistics.aiReadiness > 30);
  assert.ok(profile.statistics.biReadiness > 30);
  assert.ok(profile.aiReadiness.evidence.length > 0);
  assert.ok(profile.biReadiness.evidence.length > 0);
  assert.ok(profile.confidence > 0.4);
  assert.ok(profile.qualityScore > 35);
  assert.equal(profile.extensionPoints.kpiDiscovery, true);
  assert.equal(profile.extensionPoints.humanReviewWorkflow, true);
}

async function testPipelineIntegration() {
  const context = createPipelineContext({
    id: "maturity_pipeline_test",
    fileName: "maturity.csv",
    rawText: generateCommercialDataset(120, { customers: 24, products: 12 }),
  });
  const pipeline = new DatasetAnalysisPipeline({
    pipelineId: "maturity_pipeline",
    context,
    scanners: [
      new UniversalBusinessMaturityIntelligenceScanner(),
      new UniversalDatasetStructureScanner(),
      new UniversalSemanticIntelligenceScanner(),
      new UniversalEntityIntelligenceScanner(),
      new UniversalRelationshipIntelligenceScanner(),
    ],
  });
  const result = await pipeline.run();

  assert.equal(result.report.status, "completed");
  assert.ok(result.context.semanticMap.businessMaturityProfile);
  assert.ok(
    result.report.executedScanners.some(
      (record) => record.scannerId === "edie.business-maturity-scanner.v1",
    ),
  );
}

function assertStage(profile: BusinessMaturityProfile, stages: CompanyGrowthStage[]): void {
  assert.ok(
    stages.includes(profile.growthStage.stage),
    `Expected ${profile.growthStage.stage} to be one of ${stages.join(", ")}`,
  );
}

function generateCommercialDataset(
  rows: number,
  options: {
    customers?: number;
    products?: number;
    employees?: number;
    stores?: number;
    warehouses?: number;
    departments?: number;
    countries?: string[];
    currencies?: string[];
    brand?: string;
    extraHeader?: string;
    extraValue?: (index: number) => string;
  } = {},
): string {
  const customers = options.customers ?? 12;
  const products = options.products ?? 8;
  const employees = options.employees ?? 6;
  const stores = options.stores ?? 2;
  const warehouses = options.warehouses ?? 1;
  const departments = options.departments ?? 3;
  const countries = options.countries ?? ["NL"];
  const currencies = options.currencies ?? ["EUR"];
  const headers = [
    "customer_id",
    "customer_email",
    "order_number",
    "invoice_number",
    "payment_amount",
    "revenue",
    "cost",
    "sku",
    "product_name",
    "category",
    "brand",
    "store",
    "warehouse",
    "department",
    "employee_id",
    "country",
    "currency",
    "order_date",
    ...(options.extraHeader ? [options.extraHeader] : []),
  ];
  const lines = [headers.join(",")];

  for (let index = 0; index < rows; index += 1) {
    const date = new Date(Date.UTC(2024 + Math.floor(index / 360), index % 12, (index % 27) + 1));
    lines.push(
      [
        `CUST-${(index % customers) + 1}`,
        `customer${(index % customers) + 1}@example.com`,
        `ORD-${1000 + index}`,
        `INV-${1000 + index}`,
        String(100 + (index % 80)),
        String(150 + (index % 120)),
        String(45 + (index % 30)),
        `SKU-${(index % products) + 1}`,
        `Product ${(index % products) + 1}`,
        `Category ${(index % 5) + 1}`,
        options.brand ?? `Brand ${(index % 4) + 1}`,
        `Store ${(index % stores) + 1}`,
        `Warehouse ${(index % warehouses) + 1}`,
        `Department ${(index % departments) + 1}`,
        `EMP-${(index % employees) + 1}`,
        countries[index % countries.length],
        currencies[index % currencies.length],
        date.toISOString().slice(0, 10),
        ...(options.extraHeader && options.extraValue ? [options.extraValue(index)] : []),
      ].join(","),
    );
  }

  return lines.join("\n");
}

function parseRows(rawText: string): Array<Record<string, string>> {
  const [headerLine, ...lines] = rawText.split(/\r?\n/).filter(Boolean);
  const headers = headerLine.split(",");

  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

async function run() {
  await testStartupDetection();
  await testSmeDetection();
  await testEnterpriseDetection();
  await testFranchiseDetection();
  await testHoldingAndInternationalDetection();
  await testUnknownMaturity();
  await testReadinessStatisticsAndConfidence();
  await testPipelineIntegration();
  console.warn("EDIE business maturity intelligence engine tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
