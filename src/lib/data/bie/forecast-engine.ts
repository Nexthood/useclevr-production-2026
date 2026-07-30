import {
  buildBusinessMaturityProfile,
  buildDatasetStructureProfile,
  buildEntityDatasetProfile,
  buildRelationshipDatasetProfile,
  buildSemanticDatasetProfile,
  type AnalysisResult,
  type BusinessMaturityProfile,
  type EntityDatasetProfile,
  type PipelineContext,
  type RelationshipDatasetProfile,
  type Scanner,
  type ScannerExecutionOptions,
  type SemanticCategory,
  type SemanticDatasetProfile,
} from "../edie";
import { buildInsightProfile } from "./insight-generation-engine";
import { buildKPIDatasetProfile } from "./kpi-discovery-engine";
import { buildRecommendationProfile } from "./recommendation-engine";
import { DefaultForecastLibraryRegistry } from "./forecast-library";
import type {
  BusinessForecast,
  BusinessScenario,
  ConfidenceInterval,
  ForecastCandidate,
  ForecastCategory,
  ForecastEvidence,
  ForecastGenerationInput,
  ForecastGenerationLog,
  ForecastLibrary,
  ForecastLibraryRegistry,
  ForecastModelDefinition,
  ForecastModelType,
  ForecastProfile,
  ForecastStatistics,
  HistoricalPoint,
  ScenarioDefinition,
} from "./forecast-types";
import type { InsightProfile } from "./insight-types";
import type { DetectedKPI, KPIDatasetProfile } from "./kpi-types";
import type { RecommendationProfile } from "./recommendation-types";

const DEFAULT_MINIMUM_CONFIDENCE = 0.48;

const allModels: ForecastModelType[] = [
  "Linear Trend",
  "Moving Average",
  "Exponential Smoothing",
  "Regression",
  "Machine Learning",
  "AI-assisted Forecasting",
  "Hybrid Model",
];

const allCategories: ForecastCategory[] = [
  "Revenue Forecast",
  "Profit Forecast",
  "Sales Forecast",
  "Demand Forecast",
  "Inventory Forecast",
  "Cash Flow Forecast",
  "Expense Forecast",
  "Payroll Forecast",
  "Growth Forecast",
  "Customer Forecast",
  "Subscription Forecast",
  "Churn Forecast",
  "Supplier Forecast",
  "Warehouse Forecast",
  "Marketing Forecast",
  "Business Health Forecast",
  "Risk Forecast",
  "AI Readiness Forecast",
];

interface ResolvedForecastProfiles {
  kpiProfile: KPIDatasetProfile;
  insightProfile: InsightProfile;
  recommendationProfile: RecommendationProfile;
  semanticProfile: SemanticDatasetProfile;
  entityProfile: EntityDatasetProfile;
  relationshipProfile: RelationshipDatasetProfile;
  businessMaturityProfile: BusinessMaturityProfile;
}

export class UniversalForecastScenarioIntelligenceEngine implements Scanner {
  constructor(
    private readonly library: ForecastLibraryRegistry | ForecastLibrary =
      new DefaultForecastLibraryRegistry(),
  ) {}

  id(): string {
    return "bie.forecast-scenario-intelligence-engine.v1";
  }

  name(): string {
    return "Universal Forecast & Scenario Intelligence Engine";
  }

  version(): string {
    return "1.0.0";
  }

  priority(): number {
    return 95;
  }

  supports(context: PipelineContext): boolean {
    return Boolean(
      context.semanticMap.kpiProfile ||
        context.semanticMap.recommendationProfile ||
        context.dataset.rows?.length ||
        context.dataset.rawText ||
        context.dataset.rawBuffer,
    );
  }

  validate(context: PipelineContext) {
    const valid = this.supports(context);
    const warnings: string[] = [];

    if (!context.semanticMap.kpiProfile) {
      warnings.push("Forecasting will build KPI output before creating forecasts.");
    }

    if (!context.semanticMap.recommendationProfile) {
      warnings.push("Forecasting will build recommendation output before scenario simulation.");
    }

    return {
      valid,
      warnings,
      errors: valid ? [] : ["Forecasting requires BIE/EDIE profiles or dataset source content."],
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
        errors: ["Scanner execution was cancelled before forecast generation."],
        metadata: {},
        executionTime: new Date().toISOString(),
        scannerVersion: this.version(),
      };
    }

    const profiles = resolveProfiles(context);
    const forecastProfile = buildForecastProfile({
      context,
      ...profiles,
      businessModel: context.businessModel,
      rows: resolveRows(context),
      library: this.library,
    });

    return {
      scannerId: this.id(),
      status: "completed",
      confidence: forecastProfile.confidence,
      duration: Date.now() - startedAtMs,
      warnings: forecastProfile.warnings,
      errors: forecastProfile.errors,
      metadata: {
        forecastProfile,
        forecastCount: forecastProfile.statistics.forecastCount,
        scenarioCount: forecastProfile.statistics.scenarioCount,
        averageConfidence: forecastProfile.statistics.averageConfidence,
        coveragePercent: forecastProfile.coveragePercent,
        qualityScore: forecastProfile.qualityScore,
      },
      executionTime: new Date().toISOString(),
      scannerVersion: this.version(),
      contextPatch: {
        semanticMap: {
          semanticProfile: profiles.semanticProfile,
          entityProfile: profiles.entityProfile,
          relationshipProfile: profiles.relationshipProfile,
          businessMaturityProfile: profiles.businessMaturityProfile,
          kpiProfile: profiles.kpiProfile,
          insightProfile: profiles.insightProfile,
          recommendationProfile: profiles.recommendationProfile,
          forecastProfile,
        },
        entities: profiles.entityProfile.entities,
        relationships: profiles.relationshipProfile.relationshipGraph.edges,
        kpis: profiles.kpiProfile.detectedKPIs,
        confidence: { [this.id()]: forecastProfile.confidence },
        warnings: forecastProfile.warnings,
      },
    };
  }
}

export function buildForecastProfile(input: ForecastGenerationInput): ForecastProfile {
  const startedAt = Date.now();
  const executionTime = new Date(startedAt).toISOString();
  const library = normalizeLibrary(input.library);
  const minimumConfidence = input.minimumConfidence ?? DEFAULT_MINIMUM_CONFIDENCE;
  const businessModel = extractBusinessModel(input.businessModel);
  const rows = input.rows ?? (input.context ? resolveRows(input.context) : []);
  const semanticCategories = new Set(
    input.semanticProfile?.semanticColumns
      .filter((column) => column.semanticCategory !== "Unknown" && !column.needsReview)
      .map((column) => column.semanticCategory) ?? [],
  );
  const candidates = buildForecastCandidates(input, library, rows, semanticCategories, businessModel)
    .filter((candidate) => candidate.confidence >= minimumConfidence)
    .sort((first, second) => second.model.priority - first.model.priority || second.confidence - first.confidence);
  const forecasts = candidates.map((candidate, index) =>
    buildForecast(candidate, input, executionTime, index),
  );
  const scenarios = buildScenarios(forecasts, input, library, semanticCategories, businessModel, executionTime);
  const statistics = buildStatistics(forecasts, scenarios, input);
  const confidence = roundConfidence(statistics.averageConfidence);
  const qualityScore = roundScore(
    statistics.qualityScore * 0.48 +
      statistics.coveragePercent * 0.24 +
      confidence * 100 * 0.28,
  );
  const warnings = buildWarnings(forecasts, scenarios, rows);
  const logs = buildLogs(forecasts, scenarios, executionTime, Date.now() - startedAt);

  return {
    version: "bie.forecast-profile.v1",
    generatedAt: new Date().toISOString(),
    kpiProfileVersion: input.kpiProfile.version,
    insightProfileVersion: input.insightProfile?.version ?? null,
    recommendationProfileVersion: input.recommendationProfile?.version ?? null,
    semanticProfileVersion: input.semanticProfile?.version ?? null,
    entityProfileVersion: input.entityProfile?.version ?? null,
    relationshipProfileVersion: input.relationshipProfile?.version ?? null,
    businessMaturityProfileVersion: input.businessMaturityProfile?.version ?? null,
    forecasts,
    scenarios,
    statistics,
    confidence,
    coveragePercent: statistics.coveragePercent,
    qualityScore,
    warnings,
    errors: [],
    logs,
    extensionPoints: {
      realTimeForecasting: true,
      monteCarloSimulation: true,
      digitalTwin: true,
      economicIndicators: true,
      weatherIntegration: true,
      competitorSignals: true,
      aiSelfLearning: true,
      externalApis: true,
      supplyChainEvents: true,
      dynamicPricing: true,
      investmentPlanning: true,
      capacityPlanning: true,
      workforcePlanning: true,
      multiYearForecasting: true,
      strategicPlanning: true,
    },
  };
}

function buildForecastCandidates(
  input: ForecastGenerationInput,
  library: ForecastLibrary,
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
  semanticCategories: Set<SemanticCategory>,
  businessModel: string | null,
): ForecastCandidate[] {
  const candidates: ForecastCandidate[] = [];

  for (const model of library.models) {
    if (!supportsBusinessModel(model.businessModels, businessModel)) {
      continue;
    }

    const missingSemanticData = model.requiredSemanticCategories.filter((category) => !semanticCategories.has(category));

    for (const category of model.supportedCategories) {
      const supportingKPIs = selectSupportingKpis(input.kpiProfile.detectedKPIs, model);
      const series = buildSeries(category, rows, input.semanticProfile);

      if (series.length < model.minimumPeriods && !canUseProfileFallback(category, input)) {
        continue;
      }

      const effectiveSeries = series.length >= model.minimumPeriods ? series : buildProfileFallbackSeries(category, input);

      if (effectiveSeries.length < model.minimumPeriods) {
        continue;
      }

      const prediction = runModel(model, effectiveSeries);
      const interval = buildConfidenceInterval(prediction, effectiveSeries, model);
      const evidence = buildEvidence(model, category, effectiveSeries, input, supportingKPIs, businessModel, missingSemanticData);
      const confidence = roundConfidence(weightedAverage(evidence));

      candidates.push({
        model,
        category,
        series: effectiveSeries,
        prediction,
        interval,
        confidence,
        evidence,
        supportingKPIs,
        warnings: missingSemanticData.map((categoryName) => `${model.id} has no detected ${categoryName} semantic field.`),
      });
    }
  }

  return dedupeCandidates(candidates);
}

function buildForecast(
  candidate: ForecastCandidate,
  input: ForecastGenerationInput,
  executionTime: string,
  order: number,
): BusinessForecast {
  const supportingInsights = (input.insightProfile?.insights ?? [])
    .filter((insight) => insight.supportingKPIs.some((kpiId) => candidate.supportingKPIs.some((kpi) => kpi.id === kpiId)))
    .slice(0, 4)
    .map((insight) => insight.id);
  const supportingRecommendations = (input.recommendationProfile?.recommendations ?? [])
    .filter((recommendation) => recommendation.supportingKPIs.some((kpiId) => candidate.supportingKPIs.some((kpi) => kpi.id === kpiId)))
    .slice(0, 4)
    .map((recommendation) => recommendation.id);

  return {
    id: `forecast-${slug(candidate.category)}-${slug(candidate.model.id)}-${order}`,
    name: `${candidate.category} using ${candidate.model.name}`,
    category: candidate.category,
    prediction: roundValue(candidate.prediction),
    confidence: candidate.confidence,
    confidenceInterval: candidate.interval,
    evidence: candidate.evidence,
    businessAssumptions: buildAssumptions(candidate, input),
    historicalCoverage: {
      periods: candidate.series.length,
      firstPeriod: candidate.series[0]?.period ?? null,
      lastPeriod: candidate.series.at(-1)?.period ?? null,
      values: candidate.series,
    },
    predictionHorizon: candidate.model.horizonPeriods,
    modelUsed: candidate.model.name,
    modelId: candidate.model.id,
    supportingKPIs: candidate.supportingKPIs.map((kpi) => kpi.id),
    supportingInsights,
    supportingRecommendations,
    warnings: candidate.warnings,
    executionTime,
  };
}

function buildScenarios(
  forecasts: BusinessForecast[],
  input: ForecastGenerationInput,
  library: ForecastLibrary,
  semanticCategories: Set<SemanticCategory>,
  businessModel: string | null,
  executionTime: string,
): BusinessScenario[] {
  const scenarios: BusinessScenario[] = [];

  for (const scenario of library.scenarios) {
    if (!supportsBusinessModel(scenario.businessModels, businessModel)) {
      continue;
    }

    const baseline = forecasts.find((forecast) => scenario.supportedForecastCategories.includes(forecast.category));

    if (!baseline) {
      continue;
    }

    const missingData = scenario.requiredSemanticCategories.filter((category) => !semanticCategories.has(category));
    const multiplier = scenarioMultiplier(scenario, baseline.category);
    const predictedOutcome = roundValue(baseline.prediction * multiplier);
    const delta = roundValue(predictedOutcome - baseline.prediction);
    const deltaPercent = baseline.prediction === 0 ? 0 : roundScore((delta / baseline.prediction) * 100);
    const confidence = roundConfidence(
      baseline.confidence * 0.66 +
        (1 - missingData.length / Math.max(1, scenario.requiredSemanticCategories.length + 1)) * 0.18 +
        (input.relationshipProfile?.confidence ?? 0.5) * 0.08 +
        (input.recommendationProfile?.confidence ?? 0.5) * 0.08,
    );
    const riskScore = roundScore(
      scenario.baseRiskScore +
        Math.abs(deltaPercent) * 0.35 +
        missingData.length * 6 -
        confidence * 8,
    );

    scenarios.push({
      id: `scenario-${slug(scenario.id)}-${slug(baseline.id)}`,
      name: scenario.name,
      type: scenario.type,
      changedVariables: scenario.changedVariables,
      predictedOutcome,
      affectedKPIs: unique([...scenario.affectedKpiIds, ...baseline.supportingKPIs]),
      businessImpact: roundScore(Math.abs(deltaPercent) + riskScore * 0.5),
      financialImpact: delta,
      riskScore,
      confidence,
      comparisonWithBaseline: {
        baselineForecastId: baseline.id,
        baselinePrediction: baseline.prediction,
        delta,
        deltaPercent,
      },
      warnings: missingData.map((category) => `${scenario.id} has no detected ${category} semantic field.`),
      evidence: [
        evidenceItem("scenario-rule", scenario.priority / 110, 0.2, `${scenario.id} scenario rule was selected.`, scenario.id),
        evidenceItem("model-fit", baseline.confidence, 0.28, `${baseline.modelUsed} baseline forecast supports this scenario.`, baseline.id),
        evidenceItem("supporting-kpi", baseline.supportingKPIs.length > 0 ? 0.72 : 0.38, 0.16, "Baseline supporting KPIs influence scenario confidence.", baseline.supportingKPIs.join(", ") || "none"),
        evidenceItem("relationship-graph", input.relationshipProfile?.confidence ?? 0.5, 0.12, "Relationship graph supports affected-variable interpretation.", "relationship profile"),
        evidenceItem("supporting-recommendation", input.recommendationProfile?.confidence ?? 0.5, 0.12, "Recommendation profile supports scenario context.", "recommendation profile"),
        evidenceItem("business-rule", missingData.length === 0 ? 0.72 : 0.42, 0.12, missingData.length === 0 ? "Required scenario data is present." : `Missing scenario data: ${missingData.join(", ")}.`, scenario.id),
      ],
      executionTime,
    });
  }

  return scenarios.slice(0, 12);
}

function buildStatistics(
  forecasts: BusinessForecast[],
  scenarios: BusinessScenario[],
  input: ForecastGenerationInput,
): ForecastStatistics {
  const averageConfidence = roundConfidence(average(forecasts.map((forecast) => forecast.confidence)));
  const coveragePercent = input.kpiProfile.detectedKPIs.length === 0
    ? 0
    : roundScore((new Set(forecasts.flatMap((forecast) => forecast.supportingKPIs)).size / input.kpiProfile.detectedKPIs.length) * 100);
  const businessImpact = roundScore(average(scenarios.map((scenario) => scenario.businessImpact)));
  const qualityScore = roundScore(
    averageConfidence * 100 * 0.34 +
      coveragePercent * 0.22 +
      (input.kpiProfile.qualityScore ?? 50) * 0.18 +
      (input.insightProfile?.qualityScore ?? 50) * 0.12 +
      (input.recommendationProfile?.qualityScore ?? 50) * 0.14,
  );

  return {
    forecastCount: forecasts.length,
    averageConfidence,
    predictionHorizon: Math.max(0, ...forecasts.map((forecast) => forecast.predictionHorizon)),
    scenarioCount: scenarios.length,
    businessImpact,
    forecastAccuracy: null,
    coveragePercent,
    qualityScore,
    modelDistribution: countByModel(forecasts),
    categoryDistribution: countByCategory(forecasts),
  };
}

function resolveProfiles(context: PipelineContext): ResolvedForecastProfiles {
  const structureProfile = buildDatasetStructureProfile(context);
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
  const businessMaturityProfile = isBusinessMaturityProfile(context.semanticMap.businessMaturityProfile)
    ? context.semanticMap.businessMaturityProfile
    : buildBusinessMaturityProfile({
        structureProfile,
        semanticProfile,
        entityProfile,
        relationshipProfile,
        businessModel: context.businessModel,
        rows: resolveRows(context),
      });
  const kpiProfile = isKpiProfile(context.semanticMap.kpiProfile)
    ? context.semanticMap.kpiProfile
    : buildKPIDatasetProfile({
        structureProfile,
        semanticProfile,
        entityProfile,
        relationshipProfile,
        businessMaturityProfile,
        businessModel: context.businessModel,
        industry: context.industry,
      });
  const insightProfile = isInsightProfile(context.semanticMap.insightProfile)
    ? context.semanticMap.insightProfile
    : buildInsightProfile({
        context,
        kpiProfile,
        semanticProfile,
        entityProfile,
        relationshipProfile,
        businessMaturityProfile,
        businessModel: context.businessModel,
      });
  const recommendationProfile = isRecommendationProfile(context.semanticMap.recommendationProfile)
    ? context.semanticMap.recommendationProfile
    : buildRecommendationProfile({
        context,
        kpiProfile,
        insightProfile,
        semanticProfile,
        entityProfile,
        relationshipProfile,
        businessMaturityProfile,
        businessModel: context.businessModel,
      });

  return {
    kpiProfile,
    insightProfile,
    recommendationProfile,
    semanticProfile,
    entityProfile,
    relationshipProfile,
    businessMaturityProfile,
  };
}

function selectSupportingKpis(kpis: DetectedKPI[], model: ForecastModelDefinition): DetectedKPI[] {
  return kpis
    .filter((kpi) => model.supportedKpiIds.includes(kpi.id) || model.supportedKpiCategories.includes(kpi.category))
    .sort((first, second) => second.businessRelevance - first.businessRelevance || second.confidence - first.confidence)
    .slice(0, 5);
}

function buildSeries(
  category: ForecastCategory,
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
  semanticProfile: SemanticDatasetProfile | null | undefined,
): HistoricalPoint[] {
  if (rows.length === 0) {
    return [];
  }

  const dateColumn = findColumn(["Date"], semanticProfile, rows);
  const valueColumn = findValueColumn(category, semanticProfile, rows);

  if (!dateColumn || !valueColumn) {
    return [];
  }

  const byPeriod = new Map<string, number>();

  for (const row of rows) {
    const period = toMonth(row[dateColumn]);
    const value = toNumber(row[valueColumn]);

    if (!period || value === null) {
      continue;
    }

    byPeriod.set(period, (byPeriod.get(period) ?? 0) + value);
  }

  return Array.from(byPeriod.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([period, value]) => ({ period, value: roundValue(value) }));
}

function findValueColumn(
  category: ForecastCategory,
  semanticProfile: SemanticDatasetProfile | null | undefined,
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
): string | null {
  const preferred = categorySemanticColumns(category);
  const semanticColumn = findColumn(preferred, semanticProfile, rows);

  if (semanticColumn) {
    return semanticColumn;
  }

  const headers = Object.keys(rows[0] ?? {});
  const terms = categoryHeaderTerms(category);

  return headers.find((header) => terms.some((term) => normalize(header).includes(term))) ?? null;
}

function categorySemanticColumns(category: ForecastCategory): SemanticCategory[] {
  if (["Revenue Forecast", "Sales Forecast", "Growth Forecast", "Subscription Forecast", "Marketing Forecast"].includes(category)) {
    return ["Revenue"];
  }

  if (category === "Profit Forecast") {
    return ["Profit", "Margin", "Revenue"];
  }

  if (["Demand Forecast", "Customer Forecast", "Churn Forecast"].includes(category)) {
    return ["Quantity", "Customer", "Revenue"];
  }

  if (["Inventory Forecast", "Warehouse Forecast", "Supplier Forecast"].includes(category)) {
    return ["Inventory", "Quantity", "Cost"];
  }

  if (["Cash Flow Forecast", "Expense Forecast", "Payroll Forecast"].includes(category)) {
    return ["Expense", "Cost", "Payment", "Revenue"];
  }

  return ["Revenue", "Quantity", "Cost"];
}

function categoryHeaderTerms(category: ForecastCategory): string[] {
  if (category.includes("Inventory") || category.includes("Warehouse") || category.includes("Supplier")) {
    return ["inventory", "stock", "quantity", "units", "cost"];
  }

  if (category.includes("Expense") || category.includes("Payroll") || category.includes("Cash Flow")) {
    return ["expense", "cost", "payroll", "payment", "cash"];
  }

  if (category.includes("Demand") || category.includes("Customer") || category.includes("Churn")) {
    return ["quantity", "units", "customer", "orders", "revenue"];
  }

  return ["revenue", "sales", "amount", "gmv", "income"];
}

function findColumn(
  categories: SemanticCategory[],
  semanticProfile: SemanticDatasetProfile | null | undefined,
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
): string | null {
  const semanticColumn = semanticProfile?.semanticColumns.find((column) => categories.includes(column.semanticCategory) && !column.needsReview);

  if (semanticColumn) {
    return semanticColumn.columnName;
  }

  const headers = Object.keys(rows[0] ?? {});

  return headers.find((header) => categories.some((category) => normalize(header).includes(normalize(category)))) ?? null;
}

function runModel(model: ForecastModelDefinition, series: HistoricalPoint[]): number {
  if (model.name === "Linear Trend" || model.name === "Regression") {
    return linearTrend(series, model.horizonPeriods);
  }

  if (model.name === "Exponential Smoothing") {
    return exponentialSmoothing(series, model.smoothingFactor ?? 0.45);
  }

  if (model.name === "Hybrid Model") {
    return roundValue(linearTrend(series, model.horizonPeriods) * 0.55 + movingAverage(series) * 0.45);
  }

  return movingAverage(series);
}

function linearTrend(series: HistoricalPoint[], horizon: number): number {
  if (series.length === 1) {
    return series[0].value;
  }

  const xs = series.map((_, index) => index + 1);
  const ys = series.map((point) => point.value);
  const xMean = average(xs);
  const yMean = average(ys);
  const numerator = xs.reduce((sum, x, index) => sum + (x - xMean) * (ys[index] - yMean), 0);
  const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;

  return roundValue(Math.max(0, intercept + slope * (series.length + horizon)));
}

function movingAverage(series: HistoricalPoint[]): number {
  const window = series.slice(Math.max(0, series.length - 3));

  return roundValue(Math.max(0, average(window.map((point) => point.value))));
}

function exponentialSmoothing(series: HistoricalPoint[], alpha: number): number {
  let smoothed = series[0]?.value ?? 0;

  for (const point of series.slice(1)) {
    smoothed = alpha * point.value + (1 - alpha) * smoothed;
  }

  return roundValue(Math.max(0, smoothed));
}

function buildConfidenceInterval(
  prediction: number,
  series: HistoricalPoint[],
  model: ForecastModelDefinition,
): ConfidenceInterval {
  const residuals = series.map((point) => Math.abs(point.value - average(series.map((item) => item.value))));
  const volatility = average(residuals) / Math.max(1, average(series.map((point) => point.value)));
  const uncertainty = Math.max(0.08, Math.min(0.55, volatility + (model.minimumPeriods / Math.max(series.length, model.minimumPeriods)) * 0.08));
  const spread = prediction * uncertainty;

  return {
    lower: roundValue(Math.max(0, prediction - spread)),
    upper: roundValue(prediction + spread),
    level: 0.8,
  };
}

function buildEvidence(
  model: ForecastModelDefinition,
  category: ForecastCategory,
  series: HistoricalPoint[],
  input: ForecastGenerationInput,
  kpis: DetectedKPI[],
  businessModel: string | null,
  missingData: SemanticCategory[],
): ForecastEvidence[] {
  const seasonalityScore = series.length >= 12 ? 0.72 : series.length >= 4 ? 0.54 : 0.34;

  return [
    evidenceItem("historical-data", Math.min(1, series.length / Math.max(1, model.minimumPeriods + 2)), 0.22, `${series.length} historical periods support ${category}.`, "dataset rows"),
    evidenceItem("supporting-kpi", average(kpis.map((kpi) => kpi.confidence)), 0.14, supportingKpiReason(kpis), kpis.map((kpi) => kpi.id).join(", ") || "none"),
    evidenceItem("business-model", businessModel ? 0.72 : 0.42, 0.08, businessModel ? `Business model signal is ${businessModel}.` : "No business model signal is available.", businessModel ?? "unknown"),
    evidenceItem("business-maturity", input.businessMaturityProfile?.confidence ?? 0.5, 0.08, "Business maturity supports forecasting context.", "business maturity profile"),
    evidenceItem("supporting-insight", input.insightProfile?.confidence ?? 0.5, 0.1, "Insight profile contributes context for forecast confidence.", "insight profile"),
    evidenceItem("supporting-recommendation", input.recommendationProfile?.confidence ?? 0.5, 0.1, "Recommendation profile contributes scenario readiness context.", "recommendation profile"),
    evidenceItem("relationship-graph", input.relationshipProfile?.confidence ?? 0.45, 0.08, "Relationship graph supports dependent-variable interpretation.", "relationship profile"),
    evidenceItem("seasonality", seasonalityScore, 0.08, series.length >= 12 ? "At least twelve periods support seasonality review." : "Limited periods restrict seasonality confidence.", "historical periods"),
    evidenceItem("business-rule", missingData.length === 0 ? 0.74 : 0.42, 0.08, missingData.length === 0 ? "Required forecast fields are present." : `Missing forecast fields: ${missingData.join(", ")}.`, model.id),
    evidenceItem("model-fit", model.baseConfidence, 0.12, `${model.name} is supported for ${category}.`, model.id),
  ];
}

function buildAssumptions(candidate: ForecastCandidate, input: ForecastGenerationInput): string[] {
  return unique([
    "Historical period structure remains comparable during the forecast horizon.",
    `${candidate.model.name} is used only because available evidence meets the model threshold.`,
    candidate.series.length < 4 ? "Short historical coverage reduces certainty." : "Recent historical periods remain representative.",
    input.businessModel ? "Business model context remains stable." : "No explicit business model change is assumed.",
  ]);
}

function buildWarnings(
  forecasts: BusinessForecast[],
  scenarios: BusinessScenario[],
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
): string[] {
  const warnings: string[] = [];

  if (forecasts.length === 0) {
    warnings.push("Forecast generation found no sufficiently supported predictions.");
  }

  if (rows.length === 0) {
    warnings.push("Forecasting used profile-level evidence because no row data was available.");
  }

  if (forecasts.some((forecast) => forecast.historicalCoverage.periods < 3)) {
    warnings.push("Some forecasts have limited historical coverage.");
  }

  if (scenarios.length === 0) {
    warnings.push("Scenario simulation found no supported baseline forecasts.");
  }

  return warnings;
}

function buildLogs(
  forecasts: BusinessForecast[],
  scenarios: BusinessScenario[],
  executionTime: string,
  durationMs: number,
): ForecastGenerationLog[] {
  return [
    ...forecasts.map((forecast) => ({
      generatedForecast: forecast.name,
      scenario: null,
      confidence: forecast.confidence,
      executionTime,
      durationMs,
      warnings: forecast.warnings,
      errors: [],
    })),
    ...scenarios.map((scenario) => ({
      generatedForecast: null,
      scenario: scenario.name,
      confidence: scenario.confidence,
      executionTime,
      durationMs,
      warnings: scenario.warnings,
      errors: [],
    })),
  ];
}

function canUseProfileFallback(category: ForecastCategory, input: ForecastGenerationInput): boolean {
  return ["Business Health Forecast", "Risk Forecast", "AI Readiness Forecast"].includes(category) &&
    Boolean(input.businessMaturityProfile || input.insightProfile || input.recommendationProfile);
}

function buildProfileFallbackSeries(category: ForecastCategory, input: ForecastGenerationInput): HistoricalPoint[] {
  const health = input.businessMaturityProfile?.statistics.businessHealthScore ?? input.insightProfile?.statistics.businessHealthImpact ?? 50;
  const readiness = input.businessMaturityProfile?.statistics.aiReadiness ?? 50;
  const risk = (input.insightProfile?.statistics.risks ?? 0) * 12 + (input.recommendationProfile?.statistics.riskRecommendations ?? 0) * 8;
  const value = category === "AI Readiness Forecast" ? readiness : category === "Risk Forecast" ? risk : health;

  return [
    { period: "profile-1", value: roundValue(value * 0.92) },
    { period: "profile-2", value: roundValue(value) },
  ];
}

function dedupeCandidates(candidates: ForecastCandidate[]): ForecastCandidate[] {
  const byCategory = new Map<ForecastCategory, ForecastCandidate>();

  for (const candidate of candidates) {
    const existing = byCategory.get(candidate.category);

    if (!existing || candidate.confidence > existing.confidence) {
      byCategory.set(candidate.category, candidate);
    }
  }

  return Array.from(byCategory.values());
}

function scenarioMultiplier(scenario: ScenarioDefinition, category: ForecastCategory): number {
  if (category.includes("Inventory") || category.includes("Warehouse")) {
    return 1 + (scenario.changedVariables.inventoryPercent ?? scenario.changedVariables.demandPercent ?? 0) / 100;
  }

  if (category.includes("Expense") || category.includes("Payroll")) {
    return 1 + (scenario.changedVariables.expensePercent ?? scenario.changedVariables.payrollPercent ?? scenario.changedVariables.costPercent ?? 0) / 100;
  }

  if (category.includes("Profit")) {
    return 1 + (scenario.changedVariables.profitPercent ?? scenario.changedVariables.revenuePercent ?? 0) / 100;
  }

  if (category.includes("Customer") || category.includes("Churn")) {
    return 1 + (scenario.changedVariables.customerPercent ?? scenario.changedVariables.churnPercent ?? scenario.changedVariables.demandPercent ?? 0) / 100;
  }

  return 1 + (scenario.changedVariables.revenuePercent ?? scenario.changedVariables.demandPercent ?? 0) / 100;
}

function normalizeLibrary(library: ForecastGenerationInput["library"]): ForecastLibrary {
  if (!library) {
    return new DefaultForecastLibraryRegistry().toLibrary();
  }

  if ("toLibrary" in library) {
    return library.toLibrary();
  }

  return library;
}

function resolveRows(context: PipelineContext): ReadonlyArray<Readonly<Record<string, unknown>>> {
  if (context.dataset.rows?.length) {
    return context.dataset.rows;
  }

  if (typeof context.dataset.rawText !== "string" || !context.dataset.rawText.trim()) {
    return [];
  }

  const lines = context.dataset.rawText.trim().split(/\r?\n/);
  const delimiter = lines[0]?.includes(";") ? ";" : ",";
  const headers = splitLine(lines[0] ?? "", delimiter);

  return lines.slice(1).map((line) => {
    const cells = splitLine(line, delimiter);

    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function splitLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

function toMonth(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 7);
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const parsed = new Date(String(value));

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 7);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/[^0-9,.-]/g, "").replace(/,(?=\d{3}\b)/g, "").replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function supportsBusinessModel(models: string[], businessModel: string | null): boolean {
  return models.includes("generic") || (businessModel ? models.includes(businessModel) : false);
}

function extractBusinessModel(model: Readonly<Record<string, unknown>> | null | undefined): string | null {
  if (!model) {
    return null;
  }

  const value = model.primaryModel ?? model.businessModel ?? model.model ?? model.type;

  if (typeof value === "string") {
    return value.toLowerCase();
  }

  if (Array.isArray(model.detectedModels) && typeof model.detectedModels[0] === "string") {
    return model.detectedModels[0].toLowerCase();
  }

  return null;
}

function supportingKpiReason(kpis: DetectedKPI[]): string {
  if (kpis.length === 0) {
    return "No direct KPI is attached to this forecast.";
  }

  return `Supporting KPIs: ${kpis.map((kpi) => kpi.name).join(", ")}.`;
}

function countByModel(forecasts: BusinessForecast[]): Record<ForecastModelType, number> {
  return Object.fromEntries(
    allModels.map((model) => [model, forecasts.filter((forecast) => forecast.modelUsed === model).length]),
  ) as Record<ForecastModelType, number>;
}

function countByCategory(forecasts: BusinessForecast[]): Record<ForecastCategory, number> {
  return Object.fromEntries(
    allCategories.map((category) => [category, forecasts.filter((forecast) => forecast.category === category).length]),
  ) as Record<ForecastCategory, number>;
}

function evidenceItem(
  type: ForecastEvidence["type"],
  score: number,
  weight: number,
  reason: string,
  source: string,
): ForecastEvidence {
  return {
    type,
    score: roundConfidence(score),
    weight,
    reason,
    source,
  };
}

function weightedAverage(evidence: ForecastEvidence[]): number {
  const totalWeight = evidence.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight === 0) {
    return 0;
  }

  return evidence.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function roundConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function roundScore(value: number): number {
  return Math.max(0, Math.min(100, Number(value.toFixed(1))));
}

function roundValue(value: number): number {
  return Number(value.toFixed(2));
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function isKpiProfile(value: unknown): value is KPIDatasetProfile {
  return Boolean(value && typeof value === "object" && (value as KPIDatasetProfile).version === "bie.kpi-profile.v1");
}

function isInsightProfile(value: unknown): value is InsightProfile {
  return Boolean(value && typeof value === "object" && (value as InsightProfile).version === "bie.insight-profile.v1");
}

function isRecommendationProfile(value: unknown): value is RecommendationProfile {
  return Boolean(value && typeof value === "object" && (value as RecommendationProfile).version === "bie.recommendation-profile.v1");
}

function isSemanticProfile(value: unknown): value is SemanticDatasetProfile {
  return Boolean(value && typeof value === "object" && (value as SemanticDatasetProfile).version === "edie.semantic.v1");
}

function isEntityProfile(value: unknown): value is EntityDatasetProfile {
  return Boolean(value && typeof value === "object" && (value as EntityDatasetProfile).version === "edie.entity.v1");
}

function isRelationshipProfile(value: unknown): value is RelationshipDatasetProfile {
  return Boolean(value && typeof value === "object" && (value as RelationshipDatasetProfile).version === "edie.relationship.v1");
}

function isBusinessMaturityProfile(value: unknown): value is BusinessMaturityProfile {
  return Boolean(value && typeof value === "object" && (value as BusinessMaturityProfile).version === "edie.business-maturity.v1");
}
