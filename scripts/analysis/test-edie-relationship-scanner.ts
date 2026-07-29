import assert from "node:assert/strict";

import {
  DatasetAnalysisPipeline,
  UniversalDatasetStructureScanner,
  UniversalEntityIntelligenceScanner,
  UniversalRelationshipIntelligenceScanner,
  UniversalSemanticIntelligenceScanner,
  buildDatasetStructureProfile,
  buildEntityDatasetProfile,
  buildRelationshipDatasetProfile,
  buildSemanticDatasetProfile,
  createDefaultRelationshipRegistry,
  createPipelineContext,
  type CardinalityType,
  type KeyType,
  type RelationshipDatasetProfile,
  type RelationshipProfile,
  type RelationshipType,
} from "../../src/lib/data/edie";

const RELATIONSHIP_FIXTURE = [
  [
    "customer_id",
    "customer_email",
    "order_number",
    "invoice_number",
    "payment_id",
    "payment_amount",
    "sku",
    "product_name",
    "category",
    "brand",
    "warehouse",
    "inventory_on_hand",
    "store",
    "region",
    "country",
    "employee_id",
    "department",
    "currency",
    "tax_id",
    "tax_amount",
  ].join(","),
  [
    "CUST-1",
    "buyer@example.com",
    "ORD-1001",
    "INV-1001",
    "550e8400-e29b-41d4-a716-446655440000",
    "121.00",
    "SKU-100",
    "Launch Kit",
    "Hardware",
    "Acme",
    "AMS Warehouse",
    "12",
    "Amsterdam Store",
    "North",
    "NL",
    "EMP-1",
    "Sales",
    "EUR",
    "NL123456789B01",
    "21.00",
  ].join(","),
  [
    "CUST-1",
    "buyer@example.com",
    "ORD-1002",
    "INV-1002",
    "550e8400-e29b-41d4-a716-446655440001",
    "114.00",
    "SKU-101",
    "Growth Kit",
    "Hardware",
    "Acme",
    "AMS Warehouse",
    "8",
    "Amsterdam Store",
    "North",
    "NL",
    "EMP-2",
    "Sales",
    "EUR",
    "NL123456789B01",
    "14.00",
  ].join(","),
  [
    "CUST-2",
    "second@example.com",
    "ORD-1003",
    "INV-1003",
    "550e8400-e29b-41d4-a716-446655440002",
    "108.00",
    "SKU-100",
    "Launch Kit",
    "Hardware",
    "Acme",
    "BER Warehouse",
    "5",
    "Berlin Store",
    "West",
    "DE",
    "EMP-3",
    "Operations",
    "EUR",
    "DE123456789",
    "8.00",
  ].join(","),
].join("\n");

function buildProfile(rawText = RELATIONSHIP_FIXTURE): RelationshipDatasetProfile {
  const context = createPipelineContext({
    id: "relationship_test",
    fileName: "relationships.csv",
    rawText,
  });
  const structureProfile = buildDatasetStructureProfile(context);
  const semanticProfile = buildSemanticDatasetProfile({ structureProfile });
  const entityProfile = buildEntityDatasetProfile({ structureProfile, semanticProfile });

  return buildRelationshipDatasetProfile({
    structureProfile,
    semanticProfile,
    entityProfile,
    rows: parseRows(rawText),
  });
}

function findRelationship(
  profile: RelationshipDatasetProfile,
  relationshipType: RelationshipType,
): RelationshipProfile {
  const relationship = profile.relationshipProfiles.find(
    (candidate) => candidate.relationshipType === relationshipType,
  );

  assert.ok(relationship, `Expected ${relationshipType} relationship`);
  return relationship;
}

function assertAcceptedRelationship(
  profile: RelationshipDatasetProfile,
  relationshipType: RelationshipType,
  minimumConfidence = 0.62,
): RelationshipProfile {
  const relationship = findRelationship(profile, relationshipType);

  assert.equal(relationship.status, "Accepted");
  assert.ok(
    relationship.confidence >= minimumConfidence,
    `${relationshipType} confidence ${relationship.confidence} should be at least ${minimumConfidence}`,
  );
  assert.ok(relationship.evidence.length >= 3, `${relationshipType} should include evidence`);
  assert.ok(relationship.relatedColumns.length >= 2, `${relationshipType} should include columns`);
  return relationship;
}

async function testSupportedRelationships() {
  const profile = buildProfile();

  assertAcceptedRelationship(profile, "Customer -> Order");
  assertAcceptedRelationship(profile, "Order -> Invoice");
  assertAcceptedRelationship(profile, "Invoice -> Payment");
  assertAcceptedRelationship(profile, "Product -> Category");
  assertAcceptedRelationship(profile, "Product -> Brand");
  assertAcceptedRelationship(profile, "Product -> Warehouse");
  assertAcceptedRelationship(profile, "Store -> Employee");
  assertAcceptedRelationship(profile, "Warehouse -> Inventory");
  assertAcceptedRelationship(profile, "Invoice -> Tax");
  assertAcceptedRelationship(profile, "Invoice -> Currency");
  assert.ok(profile.statistics.totalRelationships >= 8);
  assert.ok(profile.coveragePercent > 40);
}

async function testKeyDetection() {
  const profile = buildProfile();

  assertKey(profile, "Primary Key", "order_number");
  assertKey(profile, "Primary Key", "invoice_number");
  assertKey(profile, "Generated Key", "payment_id");
  assertKey(profile, "Foreign Key", "customer_id");
  assert.ok(
    profile.keyProfiles.some((key) => key.keyType === "Composite Key"),
    "Expected composite key candidate",
  );
  assert.ok(
    profile.keyProfiles.some((key) => key.keyType === "Natural Key" && key.columns.includes("sku")),
    "Expected SKU natural key",
  );
}

async function testCardinalityDetection() {
  const profile = buildProfile();

  assertCardinality(profile, "Customer -> Order", "One-to-Many");
  assertCardinality(profile, "Product -> Category", "Many-to-One");
  assertCardinality(profile, "Employee -> Department", "Many-to-One");

  const orderItem = findRelationship(profile, "Order -> Order Item");
  assert.equal(orderItem.status, "Accepted");

  const productWarehouse = findRelationship(profile, "Product -> Warehouse");
  assert.equal(productWarehouse.cardinality.type, "Many-to-Many");
}

async function testBrokenRelationshipsAndGraph() {
  const profile = buildProfile(
    [
      "customer_id,customer_email,order_number,loose_value",
      "CUST-1,buyer@example.com,ORD-1001,A",
      "CUST-1,buyer@example.com,ORD-1002,B",
    ].join("\n"),
  );

  assertAcceptedRelationship(profile, "Customer -> Order");
  assert.ok(
    profile.relationshipProfiles.some((relationship) => relationship.status === "Needs Review") ||
      profile.warnings.some((warning) => warning.includes("disconnected")),
    "Expected incomplete graph warnings or review relationships",
  );
  assert.equal(profile.relationshipGraph.version, "edie.relationship-graph.v1");
  assert.equal(profile.relationshipGraph.export.format, "edie.relationship-graph.v1");
  assert.ok(profile.relationshipGraph.nodes.length >= 2);
  assert.ok(profile.relationshipGraph.edges.length >= 1);
  assert.ok(profile.statistics.graphHealthScore > 0);
}

async function testRegistryAndConfidence() {
  const registry = createDefaultRelationshipRegistry();
  const profile = buildProfile();
  const customerOrder = assertAcceptedRelationship(profile, "Customer -> Order");

  assert.equal(registry.version(), "edie.relationship-registry.v1");
  assert.ok(registry.listRelationshipTypes().length >= 20);
  assert.ok(customerOrder.evidence.some((evidence) => evidence.type === "detected-entity"));
  assert.ok(customerOrder.evidence.some((evidence) => evidence.type === "semantic-cooccurrence"));
  assert.ok(customerOrder.evidence.some((evidence) => evidence.type === "cross-validation"));
  assert.ok(customerOrder.matchedKeys.length > 0);
  assert.equal(profile.confidenceSummary.relationshipCount, profile.relationshipProfiles.length);
  assert.ok(profile.qualityScore > 50);
}

async function testPipelineIntegration() {
  const context = createPipelineContext({
    id: "relationship_pipeline_test",
    fileName: "relationships.csv",
    rawText: RELATIONSHIP_FIXTURE,
  });
  const pipeline = new DatasetAnalysisPipeline({
    pipelineId: "relationship_pipeline",
    context,
    scanners: [
      new UniversalRelationshipIntelligenceScanner(),
      new UniversalDatasetStructureScanner(),
      new UniversalEntityIntelligenceScanner(),
      new UniversalSemanticIntelligenceScanner(),
    ],
  });
  const result = await pipeline.run();

  assert.equal(result.report.status, "completed");
  assert.ok(result.context.schema.structureProfile);
  assert.ok(result.context.semanticMap.semanticProfile);
  assert.ok(result.context.semanticMap.entityProfile);
  assert.ok(result.context.semanticMap.relationshipProfile);
  assert.ok(result.context.relationships.length > 0);
  assert.ok(
    result.report.executedScanners.some(
      (record) => record.scannerId === "edie.relationship-scanner.v1",
    ),
  );
}

function assertKey(
  profile: RelationshipDatasetProfile,
  keyType: KeyType,
  columnName: string,
): void {
  assert.ok(
    profile.keyProfiles.some((key) => key.keyType === keyType && key.columns.includes(columnName)),
    `Expected ${columnName} to be a ${keyType}`,
  );
}

function assertCardinality(
  profile: RelationshipDatasetProfile,
  relationshipType: RelationshipType,
  cardinality: CardinalityType,
): void {
  const relationship = assertAcceptedRelationship(profile, relationshipType);

  assert.equal(relationship.cardinality.type, cardinality);
  assert.ok(relationship.cardinality.confidence > 0);
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
  await testSupportedRelationships();
  await testKeyDetection();
  await testCardinalityDetection();
  await testBrokenRelationshipsAndGraph();
  await testRegistryAndConfidence();
  await testPipelineIntegration();
  console.warn("EDIE universal relationship intelligence engine tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
