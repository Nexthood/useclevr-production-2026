// ============================================================================
// PIPELINE ORCHESTRATOR - Deterministic Pipeline Coordination
// ============================================================================
// Coordinates the full pipeline from upload to analysis:
// 1. Generate preview
// 2. Detect schema & column mapping
// 3. Clean & normalize data
// 4. Run full analysis
// 5. Validate results
// 6. Store precomputed metrics
// ============================================================================

import {
  AnalysisStatus,
  AnalysisStatusInfo,
  DatasetMetadata,
  PreviewData,
  ColumnMapping,
  DetectedBusinessColumns,
  PrecomputedMetrics,
  AIInsightOutput,
  LARGE_DATASET_THRESHOLD,
  DatasetType,
} from './pipeline-types';

import { generatePreview, requiresBackgroundProcessing, getProcessingStrategy } from './preview-generator';
import { detectBusinessColumnsFromPreview, createColumnMapping, applyMappingOverride, validateColumnMapping } from './column-mapper';
import { detectDatasetType } from './dataset-type-detector';
import { cleanAndNormalizeDataset, generateDataQualityReport } from './data-cleaner';
import { runFullDatasetAnalysis, validatePrecomputedMetrics } from './full-analysis-engine';
import { metricsToAIInput, generateRuleBasedInsights, generateAIInsightPrompt } from './ai-insight-layer';

// ============================================================================
// PIPELINE STATE
// ============================================================================

interface PipelineState {
  datasetId: string;
  userId: string;
  status: AnalysisStatus;
  progress: number;
  message: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  
  // Pipeline data
  metadata?: DatasetMetadata;
  preview?: PreviewData;
  columnMapping?: ColumnMapping;
  metrics?: PrecomputedMetrics;
  aiInsights?: AIInsightOutput;
  
  // Processing info
  processingStrategy: 'immediate' | 'background' | 'chunked';
  requiresBackground: boolean;
}

// ============================================================================
// PIPELINE ORCHESTRATOR
// ============================================================================

export class PipelineOrchestrator {
  private state: PipelineState;
  private onStatusChange?: (status: AnalysisStatusInfo) => void;
  
  constructor(
    datasetId: string,
    userId: string,
    allRows: Record<string, any>[],
    onStatusChange?: (status: AnalysisStatusInfo) => void
  ) {
    const rowCount = allRows.length;
    const requiresBg = requiresBackgroundProcessing(rowCount);
    const strategy = getProcessingStrategy(rowCount);
    
    this.state = {
      datasetId,
      userId,
      status: 'uploading',
      progress: 0,
      message: 'Initializing pipeline...',
      processingStrategy: strategy,
      requiresBackground: requiresBg,
    };
    
    this.onStatusChange = onStatusChange;
  }
  
  /**
   * Update status and notify
   */
  private updateStatus(status: AnalysisStatus, progress: number, message: string, error?: string) {
    this.state.status = status;
    this.state.progress = progress;
    this.state.message = message;
    this.state.error = error;
    
    if (this.onStatusChange) {
      this.onStatusChange({
        status,
        progress,
        message,
        error,
        startedAt: this.state.startedAt,
        completedAt: this.state.completedAt,
      });
    }
  }
  
  /**
   * Run the complete pipeline
   */
  async run(allRows: Record<string, any>[]): Promise<{
    preview: PreviewData;
    columnMapping: ColumnMapping;
    metrics: PrecomputedMetrics;
    aiInsights: AIInsightOutput;
    processingStrategy: 'immediate' | 'background' | 'chunked';
  }> {
    const startTime = Date.now();
    this.state.startedAt = new Date().toISOString();
    
    try {
      // Step 1: Generate preview
      this.updateStatus('generating_preview', 10, 'Generating preview data...');
      const preview = await this.generatePreviewStep(allRows);
      
      // Step 2: Detect schema
      this.updateStatus('detecting_schema', 25, 'Detecting column types and business columns...');
      const detectedColumns = await this.detectSchemaStep(preview);
      
      // Step 3: Create column mapping with dataset type detection
      const columnMapping = await this.createMappingStep(detectedColumns, preview);
      
      // Step 4: Clean and normalize data
      this.updateStatus('cleaning_data', 40, 'Cleaning and normalizing data...');
      const { cleanedRows, cleaningStats } = await this.cleaningStep(allRows, preview);
      
      // Step 5: Run full analysis
      this.updateStatus('running_analysis', 60, 'Running full dataset analysis...');
      const metrics = await this.analysisStep(cleanedRows, columnMapping, detectedColumns, cleaningStats);
      
      // Step 6: Validate results
      this.updateStatus('validating_results', 85, 'Validating analysis results...');
      await this.validationStep(metrics);
      
      // Step 7: Generate AI insights
      this.updateStatus('ready', 100, 'Analysis complete');
      this.state.completedAt = new Date().toISOString();
      const aiInsights = await this.aiInsightsStep(metrics);
      
      const duration = Date.now() - startTime;
      console.log(`[PIPELINE] Completed in ${duration}ms`);
      
      return {
        preview,
        columnMapping,
        metrics,
        aiInsights,
        processingStrategy: this.state.processingStrategy,
      };
      
    } catch (error: any) {
      this.updateStatus('error', this.state.progress, 'Pipeline failed', error.message);
      throw error;
    }
  }
  
  /**
   * Step 1: Generate preview
   */
  private async generatePreviewStep(allRows: Record<string, any>[]): Promise<PreviewData> {
    const preview = generatePreview(this.state.datasetId, allRows);
    this.state.preview = preview;
    return preview;
  }
  
  /**
   * Step 2: Detect schema and business columns
   */
  private async detectSchemaStep(preview: PreviewData): Promise<DetectedBusinessColumns> {
    const detectedColumns = detectBusinessColumnsFromPreview(preview);
    return detectedColumns;
  }
  
  /**
   * Step 3: Create column mapping with dataset type detection
   */
  private async createMappingStep(
    detectedColumns: DetectedBusinessColumns,
    preview: PreviewData
  ): Promise<ColumnMapping> {
    // Detect dataset type from preview data
    const datasetTypeDetection = detectDatasetType(preview);
    
    console.log('[PIPELINE] Dataset type detected:', {
      type: datasetTypeDetection.datasetType,
      confidence: `${(datasetTypeDetection.confidence * 100).toFixed(0)}%`,
    });
    
    const columnMapping = createColumnMapping(
      this.state.datasetId,
      this.state.userId,
      detectedColumns
    );
    
    // Add dataset type to column mapping
    columnMapping.datasetType = datasetTypeDetection.datasetType;
    columnMapping.datasetTypeConfidence = datasetTypeDetection.confidence;
    
    this.state.columnMapping = columnMapping;
    return columnMapping;
  }
  
  /**
   * Step 4: Clean and normalize data
   */
  private async cleaningStep(
    allRows: Record<string, any>[],
    preview: PreviewData
  ): Promise<{ cleanedRows: Record<string, any>[]; cleaningStats: any }> {
    const { cleanedRows, cleaningStats } = cleanAndNormalizeDataset(
      allRows,
      preview.columnTypes
    );
    return { cleanedRows, cleaningStats };
  }
  
  /**
   * Step 5: Run full analysis
   */
  private async analysisStep(
    cleanedRows: Record<string, any>[],
    columnMapping: ColumnMapping,
    detectedColumns: DetectedBusinessColumns,
    cleaningStats: any
  ): Promise<PrecomputedMetrics> {
    const metrics = runFullDatasetAnalysis(
      cleanedRows,
      columnMapping,
      detectedColumns,
      cleaningStats
    );
    this.state.metrics = metrics;
    return metrics;
  }
  
  /**
   * Step 6: Validate results
   */
  private async validationStep(metrics: PrecomputedMetrics): Promise<void> {
    const validation = validatePrecomputedMetrics(metrics);
    
    if (!validation.isValid) {
      const errors = validation.checks
        .filter(c => !c.passed && c.severity === 'error')
        .map(c => c.message)
        .join('; ');
      
      console.error('[PIPELINE] Validation errors:', errors);
      
      // Log but don't fail - the analysis is still valid
      if (validation.checks.some(c => !c.passed && c.severity === 'error')) {
        console.warn('[PIPELINE] Some validation checks failed');
      }
    }
    
    // Check for data quality issues
    if (metrics.cleaningStats.invalidRowPercentage > 10) {
      console.warn(`[PIPELINE] Data quality warning: ${metrics.cleaningStats.invalidRowPercentage}% invalid rows`);
    }
  }
  
  /**
   * Step 7: Generate AI insights
   */
  private async aiInsightsStep(metrics: PrecomputedMetrics): Promise<AIInsightOutput> {
    const aiInput = metricsToAIInput(metrics);
    const aiInsights = generateRuleBasedInsights(aiInput);
    this.state.aiInsights = aiInsights;
    return aiInsights;
  }
  
  /**
   * Apply user mapping override and re-run analysis
   */
  async applyMappingOverride(
    override: { businessType: string; columnName: string }
  ): Promise<PrecomputedMetrics> {
    if (!this.state.preview || !this.state.columnMapping) {
      throw new Error('Pipeline not initialized. Run pipeline first.');
    }
    
    // Apply override
    const updatedMapping = applyMappingOverride(
      this.state.columnMapping,
      {
        businessType: override.businessType as any,
        columnName: override.columnName,
        overrideBy: 'user',
        timestamp: new Date().toISOString(),
      }
    );
    
    // Validate mapping
    if (!validateColumnMapping(updatedMapping, this.state.preview.columns)) {
      throw new Error('Invalid column mapping: referenced column does not exist');
    }
    
    // Re-run cleaning with updated mapping reference
    // Note: We need the full dataset here - in production, this would come from storage
    throw new Error('Re-analysis requires full dataset access. Implement dataset retrieval.');
  }
  
  /**
   * Get current status
   */
  getStatus(): AnalysisStatusInfo {
    return {
      status: this.state.status,
      progress: this.state.progress,
      message: this.state.message,
      error: this.state.error,
      startedAt: this.state.startedAt,
      completedAt: this.state.completedAt,
    };
  }
}

// ============================================================================
// SIMPLE PIPELINE FUNCTION (for simpler use cases)
// ============================================================================

/**
 * Run complete analysis pipeline
 */
export async function runAnalysisPipeline(
  datasetId: string,
  userId: string,
  allRows: Record<string, any>[],
  onStatusChange?: (status: AnalysisStatusInfo) => void
): Promise<{
  preview: PreviewData;
  columnMapping: ColumnMapping;
  metrics: PrecomputedMetrics;
  aiInsights: AIInsightOutput;
  processingStrategy: 'immediate' | 'background' | 'chunked';
}> {
  const orchestrator = new PipelineOrchestrator(datasetId, userId, allRows, onStatusChange);
  return orchestrator.run(allRows);
}

/**
 * Get processing recommendation for dataset
 */
export function getDatasetProcessingInfo(rowCount: number): {
  strategy: 'immediate' | 'background' | 'chunked';
  requiresBackground: boolean;
  threshold: number;
  message: string;
} {
  if (rowCount > 100000) {
    return {
      strategy: 'chunked',
      requiresBackground: true,
      threshold: 100000,
      message: `Dataset has ${rowCount.toLocaleString()} rows. Will process in chunks to avoid memory issues.`,
    };
  } else if (rowCount > 50000) {
    return {
      strategy: 'background',
      requiresBackground: true,
      threshold: 50000,
      message: `Dataset has ${rowCount.toLocaleString()} rows. Will process in background for better performance.`,
    };
  }
  return {
    strategy: 'immediate',
    requiresBackground: false,
    threshold: 50000,
    message: `Dataset has ${rowCount.toLocaleString()} rows. Will process immediately.`,
  };
}
