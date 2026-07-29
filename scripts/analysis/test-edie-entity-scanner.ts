import assert from "node:assert/strict";

import {
  DatasetAnalysisPipeline,
  UniversalDatasetStructureScanner,
  UniversalEntityIntelligenceScanner,
  UniversalSemanticIntelligenceScanner,
  buildDatasetStructureProfile,
  buildEntityDatasetProfile,
  buildSemanticDatasetProfile,
  createDefaultEntityRegistry,
  createPipelineContext,
  prepareEntityResolutionCandidate,
  type EntityDatasetProfile,
  type EntityPatternType,
  type EntityProfile,
  type EntityType,
} from "../../src/lib/data/edie";

const ENTITY_FIXTURE = [
  [
    "customer_id",
    "customer_email",
    "customer_phone",
    "supplier_id",
    "supplier_email",
    "invoice_number",
    "order_number",
    "sku",
    "product_name",
    "category",
    "brand",
    "employee_id",
    "employee_email",
    "department",
    "store",
    "warehouse",
    "region",
    "country",
    "currency",
    "tax_id",
  ].join(","),
  [
    "CUST-1",
    "buyer@example.com",
    "+1 555 100 2000",
    "SUP-1",
    "vendor@example.com",
    "INV-1001",
    "ORD-9001",
    "SKU-100",
    "Launch Kit",
    "Hardware",
    "Acme",
    "EMP-1",
    "worker@example.com",
    "Sales",
    "Amsterdam Store",
    "AMS Warehouse",
    "North",
    "NL",
    "EUR",
    "NL123456789B01",
  ].join(","),
  [
    "CUST-1",
    "buyer@example.com",
    "+1 555 100 2000",
    "SUP-2",
    "supplier@example.com",
    "INV-1002",
    "ORD-9002",
    "SKU-101",
    "Growth Kit",
    "Hardware",
    "Acme",
    "EMP-2",
    "owner@example.com",
    "Operations",
    "Berlin Store",
    "BER Warehouse",
    "West",
    "DE",
    "EUR",
    "DE123456789",
  ].join(","),
].join("\n");

function buildProfile(rawText = ENTITY_FIXTURE): EntityDatasetProfile {
  const context = createPipelineContext({
    id: "entity_test",
    fileName: "entities.csv",
    rawText,
  });
  const structureProfile = buildDatasetStructureProfile(context);
  const semanticProfile = buildSemanticDatasetProfile({ structureProfile });

  return buildEntityDatasetProfile({ structureProfile, semanticProfile });
}

function findEntity(profile: EntityDatasetProfile, entityType: EntityType): EntityProfile {
  const entity = profile.entityProfiles.find((candidate) => candidate.entityType === entityType);

  assert.ok(entity, `Expected ${entityType} entity`);
  return entity;
}

function assertEntity(
  profile: EntityDatasetProfile,
  entityType: EntityType,
  minimumConfidence = 0.62,
): EntityProfile {
  const entity = findEntity(profile, entityType);

  assert.equal(entity.entityType, entityType);
  assert.ok(
    entity.confidence >= minimumConfidence,
    `${entityType} confidence ${entity.confidence} should be at least ${minimumConfidence}`,
  );
  assert.ok(entity.evidence.length > 0, `${entityType} should include evidence`);
  assert.ok(entity.entityId.startsWith("entity_"), `${entityType} should include an entity ID`);
  return entity;
}

async function testCoreEntityDetection() {
  const profile = buildProfile();

  assertEntity(profile, "Customer", 0.72);
  assertEntity(profile, "Supplier", 0.62);
  assertEntity(profile, "Invoice", 0.62);
  assertEntity(profile, "Order", 0.62);
  assertEntity(profile, "Product", 0.72);
  assertEntity(profile, "Employee", 0.62);
  assertEntity(profile, "Store", 0.62);
  assertEntity(profile, "Warehouse", 0.62);
  assertEntity(profile, "Tax", 0.62);
  assertEntity(profile, "Currency", 0.62);
  assert.ok(profile.entities.length >= 8);
  assert.ok(profile.coveragePercent > 50);
  assert.ok(profile.qualityScore > 50);
}

async function testPatternRecognitionAndRegistry() {
  const registry = createDefaultEntityRegistry();
  const samples: Array<[string, EntityPatternType]> = [
    ["buyer@example.com", "Email"],
    ["+44 20 7946 0958", "Phone"],
    ["GB82WEST12345698765432", "IBAN"],
    ["DEUTDEFF", "SWIFT"],
    ["NL123456789B01", "VAT Number"],
    ["550e8400-e29b-41d4-a716-446655440000", "UUID"],
    ["INV-1001", "Invoice Number"],
    ["ORD-9001", "Order Number"],
    ["SKU-100", "SKU Pattern"],
    ["5901234123457", "EAN"],
    ["NL", "Country Code"],
    ["EUR", "ISO Currency"],
    ["52.3676, 4.9041", "GPS Coordinates"],
    ["AB-123-CD", "License Plate"],
  ];

  for (const [value, patternType] of samples) {
    assert.ok(
      registry.matchPatterns(value).some((match) => match.patternType === patternType),
      `${value} should match ${patternType}`,
    );
  }

  assert.ok(registry.listEntityTypes().some((entry) => entry.entityType === "Customer"));
  assert.ok(registry.listPatterns().some((pattern) => pattern.id === "VAT Number"));
}

async function testCrossColumnValidationAndProfiles() {
  const profile = buildProfile();
  const customer = assertEntity(profile, "Customer", 0.72);
  const product = assertEntity(profile, "Product", 0.72);

  assert.ok(customer.evidence.some((evidence) => evidence.type === "cross-column-validation"));
  assert.ok(product.evidence.some((evidence) => evidence.type === "cross-column-validation"));
  assert.ok(customer.columns.some((column) => column.semanticCategory === "Customer"));
  assert.ok(customer.columns.some((column) => column.semanticCategory === "Email"));
  assert.ok(product.columns.some((column) => column.semanticCategory === "SKU"));
  assert.ok(product.columns.some((column) => column.semanticCategory === "Product Name"));
  assert.ok(customer.sampleValues.includes("CUST-1"));
  assert.ok(
    profile.logs.some(
      (log) => log.entityType === "Customer" && log.patternMatches.includes("Email"),
    ),
  );
}

async function testDuplicateAndUnknownEntities() {
  const profile = buildProfile();

  assert.ok(
    profile.statistics.duplicateCandidates.some((candidate) => candidate.entityType === "Customer"),
  );
  assert.ok(
    profile.statistics.duplicateCandidates.some(
      (candidate) => candidate.key.includes("cust1") || candidate.key.includes("buyerexamplecom"),
    ),
  );

  const unknownProfile = buildProfile(
    ["mystery_blob,opaque_value", "alpha,lorem", "beta,ipsum"].join("\n"),
  );
  assert.equal(unknownProfile.statistics.entityCount, 0);
  assert.equal(unknownProfile.statistics.unknownEntities >= 0, true);
  assert.ok(unknownProfile.coveragePercent <= 100);
}

async function testStatisticsAndFutureResolutionInterface() {
  const profile = buildProfile();
  const customer = assertEntity(profile, "Customer");
  const resolutionCandidate = prepareEntityResolutionCandidate(customer);

  assert.equal(profile.version, "edie.entity.v1");
  assert.equal(profile.registryVersion, "edie.entity-registry.v1");
  assert.ok(profile.confidenceSummary.averageConfidence > 0);
  assert.ok(
    profile.statistics.confidenceDistribution.high +
      profile.statistics.confidenceDistribution.medium >
      0,
  );
  assert.equal(profile.extensionPoints.knowledgeGraph, true);
  assert.equal(resolutionCandidate.status, "not-implemented");
  assert.equal(resolutionCandidate.localEntityId, customer.entityId);
}

async function testPipelineIntegration() {
  const structureScanner = new UniversalDatasetStructureScanner();
  const semanticScanner = new UniversalSemanticIntelligenceScanner();
  const entityScanner = new UniversalEntityIntelligenceScanner();
  const pipeline = new DatasetAnalysisPipeline({
    pipelineId: "edie_entity_pipeline_test",
    context: createPipelineContext({
      id: "entity_pipeline_test",
      fileName: "entity-pipeline.csv",
      rawText: ENTITY_FIXTURE,
    }),
    scanners: [entityScanner, semanticScanner, structureScanner],
  });
  const result = await pipeline.run();
  const entityResult = result.results.find(
    (candidate) => candidate.scannerId === entityScanner.id(),
  );

  assert.ok(entityResult);
  assert.equal(entityResult.status, "completed");
  assert.ok(result.context.semanticMap.entityProfile);
  assert.ok(result.context.entities.length > 0);
  assert.ok(
    result.report.logs.some(
      (event) => event.scannerId === entityScanner.id() && event.event === "scanner.finished",
    ),
  );
}

async function main() {
  await testCoreEntityDetection();
  await testPatternRecognitionAndRegistry();
  await testCrossColumnValidationAndProfiles();
  await testDuplicateAndUnknownEntities();
  await testStatisticsAndFutureResolutionInterface();
  await testPipelineIntegration();

  process.stdout.write("EDIE universal entity intelligence scanner tests passed.\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
