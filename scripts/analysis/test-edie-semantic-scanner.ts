import assert from "node:assert/strict";

import {
  DatasetAnalysisPipeline,
  UniversalDatasetStructureScanner,
  UniversalSemanticIntelligenceScanner,
  buildDatasetStructureProfile,
  buildSemanticDatasetProfile,
  clearSemanticProfileCache,
  createPipelineContext,
  createSemanticDictionaryIndex,
  defaultSemanticDictionary,
  normalizeSemanticTerm,
  type SemanticCategory,
  type SemanticColumnProfile,
  type SemanticDatasetProfile,
} from "../../src/lib/data/edie";

function buildProfile(rawText: string): SemanticDatasetProfile {
  const structureProfile = buildDatasetStructureProfile(
    createPipelineContext({
      id: "semantic_test",
      fileName: "semantic.csv",
      mimeType: "text/csv",
      rawText,
      importedAt: "2026-07-29T00:00:00.000Z",
    }),
  );

  return buildSemanticDatasetProfile({ structureProfile });
}

function findColumn(profile: SemanticDatasetProfile, columnName: string): SemanticColumnProfile {
  const column = profile.semanticColumns.find((candidate) => candidate.columnName === columnName);

  assert.ok(column, `Expected semantic column ${columnName}`);
  return column;
}

function assertSemantic(
  profile: SemanticDatasetProfile,
  columnName: string,
  category: SemanticCategory,
  minimumConfidence = 0.62,
): void {
  const column = findColumn(profile, columnName);

  assert.equal(column.semanticCategory, category, `${columnName} should map to ${category}`);
  assert.ok(
    column.confidence >= minimumConfidence,
    `${columnName} confidence ${column.confidence} should be at least ${minimumConfidence}`,
  );
  assert.ok(column.evidence.length > 0, `${columnName} should include semantic evidence`);
}

async function testRevenueAliasesAndCoreCategories() {
  clearSemanticProfileCache();
  const profile = buildProfile(
    [
      "sales_amount,gmv,gross_merchandise_value,qty,sku,cust_id,order_date,customer_email",
      "1200.50,1400.00,1400.00,3,SKU-100,CUST-1,2026-01-01,buyer@example.com",
      "900.00,1000.00,1000.00,2,SKU-101,CUST-2,2026-01-02,owner@example.com",
    ].join("\n"),
  );

  assertSemantic(profile, "sales_amount", "Revenue", 0.7);
  assertSemantic(profile, "gmv", "Revenue", 0.68);
  assertSemantic(profile, "gross_merchandise_value", "Revenue", 0.7);
  assertSemantic(profile, "qty", "Quantity", 0.68);
  assertSemantic(profile, "sku", "SKU", 0.68);
  assertSemantic(profile, "cust_id", "Customer", 0.68);
  assertSemantic(profile, "order_date", "Date", 0.62);
  assertSemantic(profile, "customer_email", "Email", 0.62);
  assert.ok(profile.coveragePercent >= 80);
  assert.ok(profile.qualityScore >= 70);
  assert.ok(
    profile.dictionaryHits.some((hit) => hit.alias === "gmv" && hit.category === "Revenue"),
  );
}

async function testMultilingualRevenueAliases() {
  clearSemanticProfileCache();
  const profile = buildProfile(
    [
      "Umsatz,omzet,ventes,ingresos,arbevetel,venituri,ricavi,receita",
      "100,110,120,130,140,150,160,170",
      "200,210,220,230,240,250,260,270",
    ].join("\n"),
  );

  for (const columnName of [
    "Umsatz",
    "omzet",
    "ventes",
    "ingresos",
    "arbevetel",
    "venituri",
    "ricavi",
    "receita",
  ]) {
    assertSemantic(profile, columnName, "Revenue", 0.66);
  }
}

async function testUnknownAndMisspelledHeaders() {
  clearSemanticProfileCache();
  const profile = buildProfile(
    ["mystery_blob,quanity,random_notes", "alpha,10,free text", "beta,20,other text"].join("\n"),
  );
  const unknown = findColumn(profile, "mystery_blob");

  assert.equal(unknown.semanticCategory, "Unknown");
  assert.equal(unknown.needsReview, true);
  assert.ok(profile.unknownFields.some((field) => field.columnName === "mystery_blob"));
  assertSemantic(profile, "quanity", "Quantity", 0.62);
}

async function testDictionaryIndexAndCaching() {
  clearSemanticProfileCache();
  const index = createSemanticDictionaryIndex(defaultSemanticDictionary);
  const normalizedRevenue = normalizeSemanticTerm("gross_merchandise_value");

  assert.ok(
    index.aliasesByNormalizedTerm.get(normalizedRevenue)?.some((hit) => hit.category === "Revenue"),
  );

  const structureProfile = buildDatasetStructureProfile(
    createPipelineContext({
      id: "semantic_cache_test",
      fileName: "cache.csv",
      rawText: "sales_amount,qty\n100,2\n200,4",
    }),
  );
  const first = buildSemanticDatasetProfile({ structureProfile });
  const second = buildSemanticDatasetProfile({ structureProfile });

  assert.equal(first.cache.hit, false);
  assert.equal(second.cache.hit, true);
  assert.deepEqual(
    second.semanticColumns.map((column) => [column.columnName, column.semanticCategory]),
    first.semanticColumns.map((column) => [column.columnName, column.semanticCategory]),
  );
}

async function testPipelineIntegration() {
  clearSemanticProfileCache();
  const structureScanner = new UniversalDatasetStructureScanner();
  const semanticScanner = new UniversalSemanticIntelligenceScanner();
  const pipeline = new DatasetAnalysisPipeline({
    pipelineId: "edie_semantic_pipeline_test",
    context: createPipelineContext({
      id: "pipeline_semantic_test",
      fileName: "pipeline-semantic.csv",
      rawText: "sales_amount,qty,sku\n100,2,SKU-1\n250,5,SKU-2",
    }),
    scanners: [semanticScanner, structureScanner],
  });
  const result = await pipeline.run();
  const semanticResult = result.results.find(
    (candidate) => candidate.scannerId === semanticScanner.id(),
  );

  assert.ok(semanticResult);
  assert.equal(semanticResult.status, "completed");
  assert.ok(result.context.semanticMap.semanticProfile);
  assertSemantic(
    result.context.semanticMap.semanticProfile as SemanticDatasetProfile,
    "sales_amount",
    "Revenue",
    0.7,
  );
  assert.ok(
    result.report.logs.some(
      (event) => event.scannerId === semanticScanner.id() && event.event === "scanner.finished",
    ),
  );
}

async function main() {
  await testRevenueAliasesAndCoreCategories();
  await testMultilingualRevenueAliases();
  await testUnknownAndMisspelledHeaders();
  await testDictionaryIndexAndCaching();
  await testPipelineIntegration();

  process.stdout.write("EDIE universal semantic intelligence scanner tests passed.\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
