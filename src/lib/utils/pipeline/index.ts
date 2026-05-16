// ============================================================================
// USELEVLR DETERMINISTIC PIPELINE - Main Export
// ============================================================================
// All modules for the deterministic business analysis architecture
// ============================================================================

// Core Types
export * from '../pipeline-types';

// Dataset Type Detection
export {
  detectDatasetType,
  getDatasetTypeDisplayName,
  getAllDatasetTypes,
} from '../../data/dataset-type-detector';

// Upload & Storage
export {
  getUploadConfig,
  uploadFile,
  getFileUrl,
  deleteFile,
  processUploadedFile,
  detectMimeType,
} from '../../data/upload-handler';

// Preview Generation
export { generatePreview, requiresBackgroundProcessing, getProcessingStrategy } from '../../utils/preview-generator';

// Semantic Column Mapping
export { 
  detectBusinessColumnsFromPreview, 
  createColumnMapping, 
  applyMappingOverride,
  validateColumnMapping,
  applyDatasetTypeOverride,
} from '../../business/column-mapper';

// Data Cleaning & Normalization
export { cleanAndNormalizeDataset, generateDataQualityReport } from '../../data/data-cleaner';

// Full Dataset Analysis
export { runFullDatasetAnalysis, validatePrecomputedMetrics } from '../../utils/full-analysis-engine';

// AI Insight Layer
export { 
  metricsToAIInput, 
  generateRuleBasedInsights, 
  generateAIInsightPrompt,
  parseLLMResponse 
} from '../../ai/ai-insight-layer';

// Pipeline Orchestrator
export { PipelineOrchestrator, runAnalysisPipeline, getDatasetProcessingInfo } from '../../utils/pipeline-orchestrator';

// Background Jobs
export { 
  createAnalysisJob, 
  getJob, 
  getJobsByDataset,
  getNextJob,
  completeJob,
  retryJob,
  cancelJob,
  getQueueStats,
  startJobProcessor,
  stopJobProcessor,
  shouldUseBackgroundProcessing,
  estimateProcessingTime,
  cleanupOldJobs
} from '../background-jobs';

// Metrics Storage
export { 
  storeMetrics, 
  getMetrics, 
  hasMetrics, 
  deleteMetrics,
  getAllMetricDatasetIds,
  storeAIInsights, 
  getAIInsights, 
  hasAIInsights,
  deleteAIInsights,
  storeAnalysisResults,
  getAnalysisResults,
  serializeMetrics,
  deserializeMetrics,
  serializeAIInsights,
  deserializeAIInsights,
  getCacheStats,
  clearAllCache,
  cleanupDataset,
  validateMetricsStructure,
  areMetricsStale
} from '../metrics-storage';
