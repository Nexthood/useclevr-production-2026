import { buildEntityDatasetProfile } from "./entity-intelligence-scanner";
import { buildRelationshipDatasetProfile } from "./relationship-intelligence-scanner";
import { buildSemanticDatasetProfile } from "./semantic-intelligence-scanner";
import { buildDatasetStructureProfile } from "./universal-structure-scanner";
import type { EntityDatasetProfile } from "./entity-types";
import type { RelationshipDatasetProfile } from "./relationship-types";
import type { SemanticColumnProfile, SemanticDatasetProfile } from "./semantic-types";
import type { DatasetStructureProfile } from "./structure-types";
import type { AnalysisResult, PipelineContext, Scanner, ScannerExecutionOptions } from "./types";
import type {
  BusinessHealthIndicators,
  BusinessMaturityDimension,
  BusinessMaturityProfile,
  BusinessMaturityScannerInput,
  BusinessMaturityStatistics,
  CompanyGrowthStage,
  ComplexityIndicators,
  MaturityDimensionScore,
  MaturityEvidence,
  MaturitySignalSummary,
} from "./business-maturity-types";

const MATURITY_DIMENSIONS: BusinessMaturityDimension[] = [
  "Company Size",
  "Business Complexity",
  "Operational Complexity",
  "Financial Maturity",
  "Sales Maturity",
  "Inventory Maturity",
  "Accounting Maturity",
  "Reporting Maturity",
  "Digital Maturity",
  "Automation Maturity",
  "Data Quality Maturity",
  "Business Intelligence Maturity",
  "AI Adoption Readiness",
  "Growth Stage",
  "International Presence",
  "Organizational Complexity",
  "Risk Level",
];

interface MaturitySourceProfiles {
  structureProfile: DatasetStructureProfile;
  semanticProfile: SemanticDatasetProfile;
  entityProfile: EntityDatasetProfile;
  relationshipProfile: RelationshipDatasetProfile;
}

export class UniversalBusinessMaturityIntelligenceScanner implements Scanner {
  id(): string {
    return "edie.business-maturity-scanner.v1";
  }

  name(): string {
    return "Universal Business Maturity Intelligence Engine";
  }

  version(): string {
    return "1.0.0";
  }

  priority(): number {
    return 50;
  }

  supports(context: PipelineContext): boolean {
    return Boolean(
      context.semanticMap.relationshipProfile ||
      context.semanticMap.entityProfile ||
      context.semanticMap.semanticProfile ||
      context.schema.structureProfile ||
      context.dataset.rawText ||
      context.dataset.rawBuffer ||
      context.dataset.rows?.length,
    );
  }

  validate(context: PipelineContext) {
    const valid = this.supports(context);
    const warnings: string[] = [];

    if (!context.schema.structureProfile) {
      warnings.push(
        "Business maturity scanner will build a structure profile before maturity analysis.",
      );
    }

    if (!context.semanticMap.semanticProfile) {
      warnings.push(
        "Business maturity scanner will build a semantic profile before maturity analysis.",
      );
    }

    if (!context.semanticMap.entityProfile) {
      warnings.push(
        "Business maturity scanner will build an entity profile before maturity analysis.",
      );
    }

    if (!context.semanticMap.relationshipProfile) {
      warnings.push(
        "Business maturity scanner will build a relationship profile before maturity analysis.",
      );
    }

    return {
      valid,
      warnings,
      errors: valid
        ? []
        : ["Business maturity scanner requires upstream EDIE profiles or dataset source content."],
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
        errors: ["Scanner execution was cancelled before business maturity analysis."],
        metadata: {},
        executionTime: new Date().toISOString(),
        scannerVersion: this.version(),
      };
    }

    const { structureProfile, semanticProfile, entityProfile, relationshipProfile } =
      resolveSourceProfiles(context);
    const maturityProfile = buildBusinessMaturityProfile({
      structureProfile,
      semanticProfile,
      entityProfile,
      relationshipProfile,
      businessModel: context.businessModel,
      rows: resolveRows(context),
    });

    return {
      scannerId: this.id(),
      status: "completed",
      confidence: maturityProfile.confidence,
      duration: Date.now() - startedAtMs,
      warnings: maturityProfile.warnings,
      errors: maturityProfile.errors,
      metadata: {
        maturityProfile,
        growthStage: maturityProfile.growthStage.stage,
        overallMaturityScore: maturityProfile.statistics.overallMaturityScore,
        aiReadiness: maturityProfile.statistics.aiReadiness,
        biReadiness: maturityProfile.statistics.biReadiness,
      },
      executionTime: new Date().toISOString(),
      scannerVersion: this.version(),
      contextPatch: {
        schema: { structureProfile },
        semanticMap: {
          semanticProfile,
          entityProfile,
          relationshipProfile,
          businessMaturityProfile: maturityProfile,
        },
        confidence: { [this.id()]: maturityProfile.confidence },
        warnings: maturityProfile.warnings,
      },
    };
  }
}

export function buildBusinessMaturityProfile(
  input: BusinessMaturityScannerInput,
): BusinessMaturityProfile {
  const rows = input.rows ?? [];
  const summary = summarizeSignals(input, rows);
  const dimensions = scoreDimensions(summary);
  const growthStage = detectGrowthStage(summary, input.businessModel);
  const complexityIndicators = buildComplexityIndicators(summary);
  const healthIndicators = buildHealthIndicators(summary, dimensions);
  const statistics = buildStatistics(dimensions, healthIndicators);
  const unknownAreas = dimensions
    .filter((dimension) => dimension.unknown)
    .map((dimension) => dimension.dimension);
  const warnings = buildWarnings(growthStage.stage, unknownAreas, summary);
  const evidence = uniqueEvidence([
    ...growthStage.evidence,
    ...dimensions.flatMap((dimension) => dimension.evidence),
    ...complexityIndicators.evidence,
    ...healthIndicators.evidence,
  ]);
  const confidence = average([
    growthStage.confidence,
    ...dimensions.map((dimension) => dimension.confidence),
  ]);
  const qualityScore = roundScore(
    statistics.overallMaturityScore * 0.45 +
      healthIndicators.decisionConfidence * 0.25 +
      confidence * 100 * 0.3,
  );
  const dimensionScores = Object.fromEntries(
    dimensions.map((dimension) => [dimension.dimension, dimension.score]),
  ) as Record<BusinessMaturityDimension, number>;

  return {
    version: "edie.business-maturity.v1",
    structureFingerprint: input.structureProfile.fingerprint,
    semanticProfileVersion: input.semanticProfile.version,
    entityProfileVersion: input.entityProfile.version,
    relationshipProfileVersion: input.relationshipProfile.version,
    generatedAt: new Date().toISOString(),
    growthStage,
    companySize: findDimension(dimensions, "Company Size"),
    operationalComplexity: findDimension(dimensions, "Operational Complexity"),
    financialComplexity: findDimension(dimensions, "Financial Maturity"),
    reportingMaturity: findDimension(dimensions, "Reporting Maturity"),
    aiReadiness: findDimension(dimensions, "AI Adoption Readiness"),
    biReadiness: findDimension(dimensions, "Business Intelligence Maturity"),
    automationScore: findDimension(dimensions, "Automation Maturity"),
    dimensionScores: dimensions,
    complexityIndicators,
    healthIndicators,
    statistics,
    qualityScore,
    confidence,
    evidence,
    warnings,
    errors: [],
    unknownAreas,
    logs: [
      {
        detectedStage: growthStage.stage,
        confidence,
        evidence,
        warnings,
        executionTime: new Date().toISOString(),
        dimensionScores,
      },
    ],
    extensionPoints: {
      kpiDiscovery: true,
      dashboardPersonalization: true,
      recommendationEngine: true,
      forecastEngine: true,
      aiContextBuilder: true,
      investorReadinessAssessment: true,
      operationalBenchmarking: true,
      industryBenchmarking: true,
      esgReadiness: true,
      ipoReadiness: true,
      mergerAcquisitionReadiness: true,
      complianceReadiness: true,
      businessRiskEngine: true,
      businessOpportunityEngine: true,
      activeLearning: true,
      humanReviewWorkflow: true,
    },
  };
}

function resolveSourceProfiles(context: PipelineContext): MaturitySourceProfiles {
  const structureProfile = isStructureProfile(context.schema.structureProfile)
    ? context.schema.structureProfile
    : buildDatasetStructureProfile(context);
  const semanticProfile = isSemanticProfile(context.semanticMap.semanticProfile)
    ? context.semanticMap.semanticProfile
    : buildSemanticDatasetProfile({ structureProfile });
  const entityProfile = isEntityProfile(context.semanticMap.entityProfile)
    ? context.semanticMap.entityProfile
    : buildEntityDatasetProfile({ structureProfile, semanticProfile });
  const relationshipProfile = isRelationshipProfile(context.semanticMap.relationshipProfile)
    ? context.semanticMap.relationshipProfile
    : buildRelationshipDatasetProfile({
        structureProfile,
        semanticProfile,
        entityProfile,
        rows: resolveRows(context),
      });

  return { structureProfile, semanticProfile, entityProfile, relationshipProfile };
}

function summarizeSignals(
  input: BusinessMaturityScannerInput,
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
): MaturitySignalSummary {
  const semanticColumns = input.semanticProfile.semanticColumns;
  const semanticCategories = new Set(semanticColumns.map((column) => column.semanticCategory));
  const entityTypes = new Set(input.entityProfile.entities.map((entity) => entity.entityType));
  const vocabulary = new Set(
    [
      ...semanticColumns.map((column) => column.columnName),
      ...rows.flatMap((row) => Object.values(row).map((value) => String(value ?? ""))),
    ]
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
  const rowCount = input.structureProfile.metadata.rows || rows.length;
  const dateSpanMonths = calculateDateSpanMonths(semanticColumns, rows);

  return {
    rowCount,
    columnCount: input.structureProfile.metadata.columns || input.structureProfile.columns.length,
    entityCount: input.entityProfile.statistics.entityCount,
    relationshipDensity: input.relationshipProfile.statistics.relationshipDensity,
    products: distinctCountFor(semanticColumns, rows, ["SKU", "Product Name"]),
    customers: distinctCountFor(semanticColumns, rows, ["Customer", "Email"]),
    employees: distinctCountFor(semanticColumns, rows, ["Employee", "Email"]),
    stores: distinctCountFor(semanticColumns, rows, ["Store"]),
    warehouses: distinctCountFor(semanticColumns, rows, ["Warehouse"]),
    departments: distinctCountFor(semanticColumns, rows, ["Department"]),
    invoices: distinctCountFor(semanticColumns, rows, ["Invoice"]),
    countries: distinctCountFor(semanticColumns, rows, ["Country"]),
    currencies: distinctCountFor(semanticColumns, rows, ["Currency"]),
    dateSpanMonths,
    semanticCategories,
    entityTypes,
    vocabulary,
    dataQualityScore: input.structureProfile.quality.score,
    relationshipQualityScore: input.relationshipProfile.qualityScore,
  };
}

function scoreDimensions(summary: MaturitySignalSummary): MaturityDimensionScore[] {
  return MATURITY_DIMENSIONS.map((dimension) => scoreDimension(dimension, summary));
}

function scoreDimension(
  dimension: BusinessMaturityDimension,
  summary: MaturitySignalSummary,
): MaturityDimensionScore {
  const evidence: MaturityEvidence[] = [];
  let score = 0;

  switch (dimension) {
    case "Company Size":
      score =
        scale(summary.rowCount, 50, 1000, 10000) * 55 +
        scale(summary.customers + summary.employees, 5, 100, 1000) * 45;
      evidence.push(datasetSizeEvidence(summary), entityCountEvidence(summary));
      break;
    case "Business Complexity":
      score =
        scale(summary.entityCount, 3, 10, 20) * 45 +
        scale(summary.relationshipDensity, 0.01, 0.06, 0.16) * 35 +
        scale(summary.columnCount, 8, 30, 80) * 20;
      evidence.push(entityCountEvidence(summary), relationshipDensityEvidence(summary));
      break;
    case "Operational Complexity":
      score =
        scale(summary.stores + summary.warehouses + summary.departments, 1, 8, 40) * 65 +
        scale(summary.rowCount, 100, 5000, 50000) * 35;
      evidence.push(
        storeEvidence(summary),
        warehouseEvidence(summary),
        departmentEvidence(summary),
      );
      break;
    case "Financial Maturity":
      score = semanticScore(
        summary,
        ["Revenue", "Cost", "Profit", "Margin", "Payment", "Tax", "Currency", "Invoice"],
        8,
      );
      evidence.push(financialEvidence(summary));
      break;
    case "Sales Maturity":
      score =
        semanticScore(summary, ["Customer", "Order", "Revenue", "Date", "Status"], 5) * 0.65 +
        scale(summary.customers, 3, 80, 1000) * 35;
      evidence.push(customerEvidence(summary), historicalEvidence(summary));
      break;
    case "Inventory Maturity":
      score = semanticScore(
        summary,
        ["Inventory", "SKU", "Product Name", "Warehouse", "Store", "Quantity"],
        6,
      );
      evidence.push(inventoryEvidence(summary));
      break;
    case "Accounting Maturity":
      score = semanticScore(
        summary,
        ["Invoice", "Payment", "Tax", "Currency", "Expense", "Date"],
        6,
      );
      evidence.push(financialEvidence(summary));
      break;
    case "Reporting Maturity":
      score =
        scale(summary.columnCount, 6, 25, 60) * 35 +
        scale(summary.dateSpanMonths, 1, 12, 36) * 35 +
        summary.dataQualityScore * 0.3;
      evidence.push(historicalEvidence(summary), dataQualityEvidence(summary));
      break;
    case "Digital Maturity":
      score =
        semanticScore(summary, ["Email", "Website", "Status", "Boolean Flag"], 4) * 0.45 +
        scale(summary.entityCount, 2, 10, 25) * 55;
      evidence.push(entityCountEvidence(summary));
      break;
    case "Automation Maturity":
      score =
        scale(
          vocabularyHits(summary, [
            "automation",
            "workflow",
            "api",
            "sync",
            "integration",
            "status",
          ]),
          1,
          3,
          6,
        ) *
          70 +
        semanticScore(summary, ["Status", "Boolean Flag"], 2) * 0.3;
      evidence.push(
        vocabularyEvidence(summary, [
          "automation",
          "workflow",
          "api",
          "sync",
          "integration",
          "status",
        ]),
      );
      break;
    case "Data Quality Maturity":
      score = summary.dataQualityScore;
      evidence.push(dataQualityEvidence(summary));
      break;
    case "Business Intelligence Maturity":
      score =
        scale(summary.dateSpanMonths, 1, 12, 36) * 35 +
        scale(summary.relationshipDensity, 0.01, 0.05, 0.14) * 35 +
        summary.dataQualityScore * 0.3;
      evidence.push(historicalEvidence(summary), relationshipDensityEvidence(summary));
      break;
    case "AI Adoption Readiness":
      score =
        summary.dataQualityScore * 0.4 +
        scale(summary.entityCount, 2, 8, 18) * 30 +
        scale(summary.relationshipDensity, 0.01, 0.05, 0.14) * 30;
      evidence.push(
        dataQualityEvidence(summary),
        entityCountEvidence(summary),
        relationshipDensityEvidence(summary),
      );
      break;
    case "Growth Stage":
      score =
        scale(summary.rowCount + summary.customers + summary.products, 5, 500, 10000) * 70 +
        scale(summary.dateSpanMonths, 1, 12, 36) * 30;
      evidence.push(datasetSizeEvidence(summary), historicalEvidence(summary));
      break;
    case "International Presence":
      score = scale(summary.countries + summary.currencies, 1, 4, 12) * 100;
      evidence.push(countryEvidence(summary), currencyEvidence(summary));
      break;
    case "Organizational Complexity":
      score =
        scale(summary.departments + summary.employees + summary.stores, 1, 20, 300) * 75 +
        scale(summary.relationshipDensity, 0.01, 0.05, 0.14) * 25;
      evidence.push(departmentEvidence(summary), entityCountEvidence(summary));
      break;
    case "Risk Level":
      score = Math.max(
        0,
        100 -
          summary.dataQualityScore * 0.65 -
          scale(summary.relationshipDensity, 0.01, 0.06, 0.16) * 35,
      );
      evidence.push(dataQualityEvidence(summary), relationshipDensityEvidence(summary));
      break;
  }

  const confidence = dimensionConfidence(score, evidence, summary);
  const unknown = isUnknownDimension(dimension, summary, confidence);

  return {
    dimension,
    score: roundScore(Math.max(0, Math.min(100, score))),
    confidence,
    evidence,
    reason: unknown
      ? `${dimension} lacks enough independent evidence.`
      : `${dimension} score is based on ${evidence.map((item) => item.type).join(", ")} evidence.`,
    warnings: unknown ? [`${dimension} needs review.`] : [],
    unknown,
  };
}

function detectGrowthStage(
  summary: MaturitySignalSummary,
  businessModel: Readonly<Record<string, unknown>> | null | undefined,
): BusinessMaturityProfile["growthStage"] {
  const candidates: Array<{
    stage: CompanyGrowthStage;
    confidence: number;
    reason: string;
    evidence: MaturityEvidence[];
  }> = [];
  const modelEvidence = businessModel
    ? evidence(
        "business-model-context",
        0.55,
        0.08,
        "Existing business-model context is available.",
        Object.keys(businessModel).join(", "),
      )
    : evidence(
        "business-model-context",
        0,
        0.08,
        "No business-model context is available.",
        "none",
      );

  candidates.push({
    stage: "Unknown",
    confidence: summary.rowCount < 2 && summary.entityCount < 2 ? 0.82 : 0.2,
    reason: "Maturity evidence is insufficient.",
    evidence: [datasetSizeEvidence(summary), entityCountEvidence(summary)],
  });

  if (vocabularyHits(summary, ["franchise", "franchisee", "franchisor"]) > 0) {
    candidates.push({
      stage: "Franchise",
      confidence: 0.86,
      reason: "Franchise vocabulary or multi-store branded operations are present.",
      evidence: [
        storeEvidence(summary),
        vocabularyEvidence(summary, ["franchise", "franchisee", "franchisor"]),
      ],
    });
  }

  if (
    vocabularyHits(summary, ["holding", "subsidiary", "parent", "group", "legal", "entity"]) >= 2
  ) {
    candidates.push({
      stage: "Holding Company",
      confidence: 0.84,
      reason: "Holding-company vocabulary is present.",
      evidence: [
        vocabularyEvidence(summary, [
          "holding",
          "subsidiary",
          "parent",
          "group",
          "legal",
          "entity",
        ]),
        countryEvidence(summary),
      ],
    });
  }

  if (summary.countries >= 8 || summary.currencies >= 5) {
    candidates.push({
      stage: "Global Enterprise",
      confidence: 0.9,
      reason: "Dataset spans many countries or currencies.",
      evidence: [countryEvidence(summary), currencyEvidence(summary)],
    });
  } else if (summary.countries >= 3 || summary.currencies >= 3) {
    candidates.push({
      stage: "International Enterprise",
      confidence: 0.84,
      reason: "Dataset spans multiple countries or currencies.",
      evidence: [countryEvidence(summary), currencyEvidence(summary)],
    });
  } else if (summary.stores >= 8 || summary.warehouses >= 4) {
    candidates.push({
      stage: "Regional Enterprise",
      confidence: 0.78,
      reason: "Dataset shows a larger physical operating footprint.",
      evidence: [storeEvidence(summary), warehouseEvidence(summary)],
    });
  }

  if (summary.rowCount >= 50000 || summary.customers >= 10000 || summary.employees >= 1000) {
    candidates.push({
      stage: "National Enterprise",
      confidence: 0.82,
      reason: "Dataset volume and entity counts indicate enterprise scale.",
      evidence: [
        datasetSizeEvidence(summary),
        customerEvidence(summary),
        entityCountEvidence(summary),
      ],
    });
  } else if (summary.rowCount >= 8000 || summary.customers >= 1000 || summary.products >= 500) {
    candidates.push({
      stage: "Scaling",
      confidence: 0.78,
      reason: "Dataset shows high transaction, customer, or product scale.",
      evidence: [
        datasetSizeEvidence(summary),
        customerEvidence(summary),
        inventoryEvidence(summary),
      ],
    });
  } else if (summary.rowCount >= 1000 || summary.customers >= 150) {
    candidates.push({
      stage: "Growth",
      confidence: 0.74,
      reason: "Dataset shows active customer or transaction growth.",
      evidence: [datasetSizeEvidence(summary), customerEvidence(summary)],
    });
  } else if (summary.customers >= 30 || summary.dateSpanMonths >= 6) {
    candidates.push({
      stage: "Product-Market Fit",
      confidence: 0.7,
      reason: "Dataset shows repeat customers or enough operating history.",
      evidence: [customerEvidence(summary), historicalEvidence(summary)],
    });
  } else if (summary.customers > 0 || summary.invoices > 0) {
    candidates.push({
      stage: "Early Customers",
      confidence: 0.68,
      reason: "Dataset includes early customer or invoice activity.",
      evidence: [customerEvidence(summary), financialEvidence(summary)],
    });
  } else if (summary.products > 0 || summary.semanticCategories.has("Status")) {
    candidates.push({
      stage: "MVP",
      confidence: 0.62,
      reason: "Dataset includes product or status signals without clear customer scale.",
      evidence: [inventoryEvidence(summary)],
    });
  } else if (
    !summary.semanticCategories.has("Revenue") &&
    !summary.semanticCategories.has("Payment")
  ) {
    candidates.push({
      stage: "Pre-Revenue Startup",
      confidence: 0.58,
      reason: "Dataset lacks revenue or payment signals.",
      evidence: [financialEvidence(summary)],
    });
  }

  const sorted = candidates
    .map((candidate) => ({
      ...candidate,
      confidence: roundScore(Math.min(1, candidate.confidence + (businessModel ? 0.02 : 0))),
      evidence: businessModel ? [...candidate.evidence, modelEvidence] : candidate.evidence,
    }))
    .sort((left, right) => right.confidence - left.confidence);
  const winner = sorted[0];

  return {
    stage: winner.stage,
    confidence: winner.confidence,
    evidence: winner.evidence,
    reason: winner.reason,
    alternatives: sorted.slice(1, 4).map((candidate) => ({
      stage: candidate.stage,
      confidence: candidate.confidence,
      reason: candidate.reason,
    })),
  };
}

function buildComplexityIndicators(summary: MaturitySignalSummary): ComplexityIndicators {
  const evidence = [
    datasetSizeEvidence(summary),
    customerEvidence(summary),
    inventoryEvidence(summary),
    storeEvidence(summary),
    warehouseEvidence(summary),
    departmentEvidence(summary),
    relationshipDensityEvidence(summary),
  ];

  return {
    numberOfProducts: summary.products,
    numberOfCustomers: summary.customers,
    numberOfEmployees: summary.employees,
    numberOfStores: summary.stores,
    numberOfWarehouses: summary.warehouses,
    numberOfDepartments: summary.departments,
    numberOfInvoices: summary.invoices,
    transactionVolume: summary.rowCount,
    relationshipDensity: summary.relationshipDensity,
    businessRuleComplexity: roundScore(
      scale(summary.entityCount + summary.relationshipDensity * 100, 4, 15, 40) * 100,
    ),
    reportingComplexity: roundScore(
      scale(summary.columnCount + summary.dateSpanMonths, 12, 50, 120) * 100,
    ),
    automationLevel: roundScore(
      scale(
        vocabularyHits(summary, ["automation", "workflow", "api", "sync", "integration", "status"]),
        1,
        3,
        8,
      ) * 100,
    ),
    confidence: average(evidence.map((item) => item.score)),
    evidence,
  };
}

function buildHealthIndicators(
  summary: MaturitySignalSummary,
  dimensions: MaturityDimensionScore[],
): BusinessHealthIndicators {
  const dataQuality = findDimension(dimensions, "Data Quality Maturity").score;
  const reporting = findDimension(dimensions, "Reporting Maturity").score;
  const ai = findDimension(dimensions, "AI Adoption Readiness").score;
  const bi = findDimension(dimensions, "Business Intelligence Maturity").score;
  const operational = findDimension(dimensions, "Operational Complexity").score;
  const evidence = [
    dataQualityEvidence(summary),
    historicalEvidence(summary),
    relationshipDensityEvidence(summary),
  ];

  return {
    operationalStability: roundScore(Math.max(0, 100 - Math.abs(operational - 55) * 0.55)),
    dataCompleteness: dataQuality,
    reportingReadiness: reporting,
    forecastReadiness: roundScore(
      scale(summary.dateSpanMonths, 2, 12, 36) * 65 + dataQuality * 0.35,
    ),
    aiReadiness: ai,
    biReadiness: bi,
    automationOpportunities: roundScore(
      Math.max(0, 100 - findDimension(dimensions, "Automation Maturity").score),
    ),
    dataQualityRisk: roundScore(Math.max(0, 100 - dataQuality)),
    reportingRisk: roundScore(Math.max(0, 100 - reporting)),
    decisionConfidence: roundScore(average([dataQuality, reporting, ai, bi])),
    confidence: average(evidence.map((item) => item.score)),
    evidence,
  };
}

function buildStatistics(
  dimensions: MaturityDimensionScore[],
  health: BusinessHealthIndicators,
): BusinessMaturityStatistics {
  const known = dimensions.filter((dimension) => !dimension.unknown);
  const dimensionScores = Object.fromEntries(
    dimensions.map((dimension) => [dimension.dimension, dimension.score]),
  ) as Record<BusinessMaturityDimension, number>;

  return {
    overallMaturityScore: average(known.map((dimension) => dimension.score)),
    dimensionScores,
    confidenceDistribution: {
      high: dimensions.filter((dimension) => dimension.confidence >= 0.8).length,
      medium: dimensions.filter(
        (dimension) => dimension.confidence >= 0.62 && dimension.confidence < 0.8,
      ).length,
      low: dimensions.filter((dimension) => dimension.confidence > 0 && dimension.confidence < 0.62)
        .length,
      unknown: dimensions.filter((dimension) => dimension.unknown).length,
    },
    unknownAreas: dimensions
      .filter((dimension) => dimension.unknown)
      .map((dimension) => dimension.dimension),
    coveragePercent: roundScore((known.length / dimensions.length) * 100),
    businessHealthScore: health.decisionConfidence,
    operationalReadiness: health.operationalStability,
    aiReadiness: health.aiReadiness,
    biReadiness: health.biReadiness,
  };
}

function distinctCountFor(
  semanticColumns: SemanticColumnProfile[],
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
  categories: string[],
): number {
  const columns = semanticColumns.filter((column) => categories.includes(column.semanticCategory));
  const values = new Set<string>();

  for (const column of columns) {
    for (const row of rows) {
      const value = normalizeValue(row[column.columnName]);

      if (value) {
        values.add(value);
      }
    }

    if (rows.length === 0) {
      column.aliases.concat(column.dictionaryHits).forEach((value) => values.add(value));
    }
  }

  return values.size;
}

function calculateDateSpanMonths(
  semanticColumns: SemanticColumnProfile[],
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
): number {
  const dateColumns = semanticColumns.filter((column) => column.semanticCategory === "Date");
  const dates = dateColumns
    .flatMap((column) => rows.map((row) => new Date(String(row[column.columnName] ?? ""))))
    .filter((date) => Number.isFinite(date.getTime()))
    .map((date) => date.getTime());

  if (dates.length < 2) {
    return 0;
  }

  return Math.max(
    1,
    Math.round((Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24 * 30)),
  );
}

function semanticScore(
  summary: MaturitySignalSummary,
  categories: string[],
  expected: number,
): number {
  const matched = categories.filter((category) =>
    summary.semanticCategories.has(category as never),
  ).length;

  return roundScore(Math.min(100, (matched / expected) * 100));
}

function dimensionConfidence(
  score: number,
  evidenceItems: MaturityEvidence[],
  summary: MaturitySignalSummary,
): number {
  const evidenceScore = average(evidenceItems.map((item) => item.score));
  const dataPresence = summary.rowCount > 0 || summary.entityCount > 0 ? 0.18 : 0;
  const scorePresence = score > 0 ? 0.1 : 0;

  return roundScore(Math.min(1, evidenceScore * 0.72 + dataPresence + scorePresence));
}

function isUnknownDimension(
  dimension: BusinessMaturityDimension,
  summary: MaturitySignalSummary,
  confidence: number,
): boolean {
  if (summary.rowCount < 2 && summary.entityCount < 2) {
    return true;
  }

  if (confidence < 0.38) {
    return true;
  }

  if (dimension === "Inventory Maturity") {
    return !["Inventory", "SKU", "Product Name", "Warehouse", "Store"].some((category) =>
      summary.semanticCategories.has(category as never),
    );
  }

  return false;
}

function findDimension(
  dimensions: MaturityDimensionScore[],
  dimension: BusinessMaturityDimension,
): MaturityDimensionScore {
  const score = dimensions.find((candidate) => candidate.dimension === dimension);

  if (!score) {
    throw new Error(`Missing maturity dimension: ${dimension}`);
  }

  return score;
}

function buildWarnings(
  growthStage: CompanyGrowthStage,
  unknownAreas: BusinessMaturityDimension[],
  summary: MaturitySignalSummary,
): string[] {
  const warnings: string[] = [];

  if (growthStage === "Unknown") {
    warnings.push("Growth stage needs review because maturity evidence is limited.");
  }

  if (unknownAreas.length > 0) {
    warnings.push(
      `${unknownAreas.length} maturity dimension${unknownAreas.length === 1 ? "" : "s"} need review.`,
    );
  }

  if (summary.dataQualityScore < 50) {
    warnings.push("Low data quality limits business maturity confidence.");
  }

  return warnings;
}

function resolveRows(context: PipelineContext): ReadonlyArray<Readonly<Record<string, unknown>>> {
  if (context.dataset.rows?.length) {
    return context.dataset.rows;
  }

  if (context.dataset.rawText) {
    return parseDelimitedRows(context.dataset.rawText);
  }

  return [];
}

function parseDelimitedRows(rawText: string): ReadonlyArray<Readonly<Record<string, unknown>>> {
  const lines = rawText.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length < 2) {
    return [];
  }

  const delimiter = detectDelimiter(lines.slice(0, 8));
  const headers = splitDelimitedLine(lines[0], delimiter).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = splitDelimitedLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (const character of line) {
    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (character === delimiter && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function detectDelimiter(lines: string[]): string {
  const delimiters = [",", ";", "\t", "|"];
  return (
    delimiters
      .map((delimiter) => ({
        delimiter,
        count: lines.reduce((sum, line) => sum + line.split(delimiter).length - 1, 0),
      }))
      .sort((left, right) => right.count - left.count)[0]?.delimiter ?? ","
  );
}

function datasetSizeEvidence(summary: MaturitySignalSummary): MaturityEvidence {
  return evidence(
    "dataset-size",
    scale(summary.rowCount, 10, 1000, 50000),
    0.16,
    "Dataset size contributes to maturity.",
    `${summary.rowCount} rows`,
  );
}

function entityCountEvidence(summary: MaturitySignalSummary): MaturityEvidence {
  return evidence(
    "entity-count",
    scale(summary.entityCount, 2, 10, 25),
    0.14,
    "Detected entity count contributes to maturity.",
    `${summary.entityCount} entities`,
  );
}

function relationshipDensityEvidence(summary: MaturitySignalSummary): MaturityEvidence {
  return evidence(
    "relationship-density",
    scale(summary.relationshipDensity, 0.01, 0.06, 0.16),
    0.14,
    "Relationship density contributes to maturity.",
    `${summary.relationshipDensity} density`,
  );
}

function financialEvidence(summary: MaturitySignalSummary): MaturityEvidence {
  return evidence(
    "financial-complexity",
    semanticScore(
      summary,
      ["Revenue", "Cost", "Profit", "Margin", "Payment", "Tax", "Currency", "Invoice"],
      8,
    ) / 100,
    0.14,
    "Financial semantic coverage contributes to maturity.",
    "financial columns",
  );
}

function inventoryEvidence(summary: MaturitySignalSummary): MaturityEvidence {
  return evidence(
    "inventory-complexity",
    semanticScore(
      summary,
      ["Inventory", "SKU", "Product Name", "Warehouse", "Store", "Quantity"],
      6,
    ) / 100,
    0.12,
    "Inventory semantic coverage contributes to maturity.",
    `${summary.products} products`,
  );
}

function storeEvidence(summary: MaturitySignalSummary): MaturityEvidence {
  return evidence(
    "store-count",
    scale(summary.stores, 1, 5, 25),
    0.1,
    "Store count contributes to operational maturity.",
    `${summary.stores} stores`,
  );
}

function warehouseEvidence(summary: MaturitySignalSummary): MaturityEvidence {
  return evidence(
    "warehouse-count",
    scale(summary.warehouses, 1, 3, 12),
    0.1,
    "Warehouse count contributes to operational maturity.",
    `${summary.warehouses} warehouses`,
  );
}

function departmentEvidence(summary: MaturitySignalSummary): MaturityEvidence {
  return evidence(
    "department-count",
    scale(summary.departments, 1, 6, 30),
    0.1,
    "Department count contributes to organizational maturity.",
    `${summary.departments} departments`,
  );
}

function customerEvidence(summary: MaturitySignalSummary): MaturityEvidence {
  return evidence(
    "entity-count",
    scale(summary.customers, 1, 100, 5000),
    0.12,
    "Customer count contributes to maturity.",
    `${summary.customers} customers`,
  );
}

function countryEvidence(summary: MaturitySignalSummary): MaturityEvidence {
  return evidence(
    "country-presence",
    scale(summary.countries, 1, 3, 10),
    0.12,
    "Country presence contributes to maturity.",
    `${summary.countries} countries`,
  );
}

function currencyEvidence(summary: MaturitySignalSummary): MaturityEvidence {
  return evidence(
    "currency-usage",
    scale(summary.currencies, 1, 3, 8),
    0.1,
    "Currency usage contributes to maturity.",
    `${summary.currencies} currencies`,
  );
}

function historicalEvidence(summary: MaturitySignalSummary): MaturityEvidence {
  return evidence(
    "historical-data",
    scale(summary.dateSpanMonths, 1, 12, 36),
    0.12,
    "Historical data availability contributes to maturity.",
    `${summary.dateSpanMonths} months`,
  );
}

function dataQualityEvidence(summary: MaturitySignalSummary): MaturityEvidence {
  return evidence(
    "data-quality",
    summary.dataQualityScore / 100,
    0.16,
    "Data quality contributes to readiness.",
    `${summary.dataQualityScore} quality score`,
  );
}

function vocabularyEvidence(summary: MaturitySignalSummary, terms: string[]): MaturityEvidence {
  const hits = vocabularyHits(summary, terms);
  return evidence(
    "business-vocabulary",
    scale(hits, 1, 3, 8),
    0.1,
    "Business vocabulary contributes to maturity.",
    `${hits} matching terms`,
  );
}

function evidence(
  type: MaturityEvidence["type"],
  score: number,
  weight: number,
  reason: string,
  source: string,
): MaturityEvidence {
  return {
    type,
    score: roundScore(Math.max(0, Math.min(1, score))),
    weight,
    reason,
    source,
  };
}

function vocabularyHits(summary: MaturitySignalSummary, terms: string[]): number {
  return terms.filter((term) => summary.vocabulary.has(term)).length;
}

function scale(value: number, low: number, medium: number, high: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value <= low) {
    return 0.22;
  }

  if (value <= medium) {
    return 0.45 + ((value - low) / Math.max(1, medium - low)) * 0.25;
  }

  return Math.min(1, 0.7 + ((value - medium) / Math.max(1, high - medium)) * 0.3);
}

function normalizeValue(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "");
}

function uniqueEvidence(items: MaturityEvidence[]): MaturityEvidence[] {
  const seen = new Set<string>();
  const unique: MaturityEvidence[] = [];

  for (const item of items) {
    const key = `${item.type}:${item.source}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  return unique;
}

function average(values: number[]): number {
  const valid = values.filter((value) => Number.isFinite(value));

  if (valid.length === 0) {
    return 0;
  }

  return roundScore(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function roundScore(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function isStructureProfile(value: unknown): value is DatasetStructureProfile {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as DatasetStructureProfile).version === "edie.structure.v1",
  );
}

function isSemanticProfile(value: unknown): value is SemanticDatasetProfile {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as SemanticDatasetProfile).version === "edie.semantic.v1",
  );
}

function isEntityProfile(value: unknown): value is EntityDatasetProfile {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as EntityDatasetProfile).version === "edie.entity.v1",
  );
}

function isRelationshipProfile(value: unknown): value is RelationshipDatasetProfile {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as RelationshipDatasetProfile).version === "edie.relationship.v1",
  );
}
