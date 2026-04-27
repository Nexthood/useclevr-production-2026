// ============================================================================
// PREVIEW GENERATOR - Deterministic Preview Extraction
// ============================================================================
// Generates preview data from the first 500-2000 rows for:
// - Schema detection
// - Column inference
// - UI preview
// - Mapping suggestions
//
// IMPORTANT: Preview MUST NOT be used for:
// - KPI calculations
// - Chart calculations
// - Totals, averages, percentages
// - Executive summary metrics
// - AI metric generation
// ============================================================================

import {
  PreviewData,
  ColumnType,
  ColumnSchema,
  PREVIEW_ROW_COUNT,
  MAX_PREVIEW_ROWS,
  MIN_PREVIEW_ROWS
} from './pipeline-types';

// ============================================================================
// CONSTANTS
// ============================================================================

const CURRENCY_SYMBOLS = ['$', '€', '£', '¥', '₹', 'C$', 'A$', 'CHF', '₽', 'R$', '₩', '₪'];

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/,                    // ISO: 2024-01-15
  /^\d{2}\/\d{2}\/\d{4}$/,                  // US: 01/15/2024
  /^\d{2}-\d{2}-\d{4}$/,                    // EU: 15-01-2024
  /^\d{2}\.\d{2}\.\d{4}$/,                  // German: 15.01.2024
  /^\d{4}\/\d{2}\/\d{2}$/,                  // Alt: 2024/01/15
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,   // ISO datetime
];

// ============================================================================
// TYPE DETECTION FUNCTIONS
// ============================================================================

/**
 * Check if value is a date
 */
function isDateValue(value: string): boolean {
  if (!value) return false;
  return DATE_PATTERNS.some(pattern => pattern.test(value.trim()));
}

/**
 * Check if value is a plain numeric value
 */
function isPlainNumeric(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value.trim());
}

/**
 * Check if value contains currency symbol
 */
function hasCurrencySymbol(value: string): boolean {
  const trimmed = value.trim();
  return CURRENCY_SYMBOLS.some(s => trimmed.startsWith(s) || trimmed.endsWith(s));
}

/**
 * Check if value is a percentage
 */
function isPercentage(value: string): boolean {
  return value.trim().endsWith('%');
}

/**
 * Detect column type based on sample values
 */
function detectColumnType(values: string[]): ColumnType {
  const samples = values.filter(v => v && v.trim() !== '').slice(0, 100);
  if (samples.length === 0) return 'text';

  let currencyCount = 0;
  let numericCount = 0;
  let dateCount = 0;
  let percentageCount = 0;
  let booleanCount = 0;

  for (const val of samples) {
    const trimmed = val.trim();
    
    // Check boolean
    if (/^(true|false|yes|no|0|1)$/i.test(trimmed)) {
      booleanCount++;
      continue;
    }
    
    // Check currency first (has symbol)
    if (hasCurrencySymbol(trimmed)) {
      currencyCount++;
      continue;
    }
    
    // Check percentage
    if (isPercentage(trimmed)) {
      percentageCount++;
      continue;
    }
    
    // Check plain number
    if (isPlainNumeric(trimmed)) {
      numericCount++;
      continue;
    }
    
    // Check date
    if (isDateValue(trimmed)) {
      dateCount++;
      continue;
    }
  }

  const threshold = samples.length * 0.5;

  if (currencyCount > threshold) return 'currency';
  if (percentageCount > threshold) return 'percentage';
  if (numericCount > threshold) return 'numeric';
  if (dateCount > threshold) return 'date';
  if (booleanCount > threshold) return 'boolean';
  return 'text';
}

/**
 * Check if column has nullable values
 */
function isNullable(values: any[]): boolean {
  const nullishCount = values.filter(v => v === null || v === undefined || v === '').length;
  return nullishCount > 0;
}

/**
 * Count unique values
 */
function countUnique(values: any[]): number {
  const unique = new Set(values.filter(v => v !== null && v !== undefined && v !== ''));
  return unique.size;
}

// ============================================================================
// MAIN PREVIEW GENERATOR
// ============================================================================

/**
 * Generate preview data from full dataset
 * @param datasetId - The dataset ID
 * @param allRows - Full dataset rows
 * @param customPreviewSize - Optional custom preview size (default: PREVIEW_ROW_COUNT)
 * @returns PreviewData object with extracted preview rows
 */
export function generatePreview(
  datasetId: string,
  allRows: Record<string, any>[],
  customPreviewSize?: number
): PreviewData {
  // Validate input
  if (!allRows || allRows.length === 0) {
    throw new Error('No rows provided for preview generation');
  }

  // Determine preview size
  const previewSize = Math.min(
    Math.max(customPreviewSize || PREVIEW_ROW_COUNT, MIN_PREVIEW_ROWS),
    Math.min(MAX_PREVIEW_ROWS, allRows.length)
  );

  console.log(`[PREVIEW] Generating preview with ${previewSize} rows from ${allRows.length} total rows`);

  // Extract preview rows
  const previewRows = allRows.slice(0, previewSize);
  const columns = Object.keys(allRows[0] || {});

  // Detect column types from preview
  const columnTypes: Record<string, ColumnType> = {};
  const columnSchemas: ColumnSchema[] = [];

  for (const column of columns) {
    const values = previewRows.map(row => {
      const val = row[column];
      if (val === null || val === undefined) return '';
      return String(val);
    });

    const type = detectColumnType(values);
    columnTypes[column] = type;

    // Collect sample values (first 10 non-null)
    const sampleValues = values.filter(v => v && v.trim() !== '').slice(0, 10);

    columnSchemas.push({
      name: column.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      originalName: column,
      type,
      isNullable: isNullable(previewRows.map(r => r[column])),
      sampleValues,
      uniqueCount: countUnique(previewRows.map(r => r[column])),
      nullCount: previewRows.filter(r => r[column] === null || r[column] === undefined || r[column] === '').length,
    });
  }

  // Log preview generation
  console.log('[PREVIEW] Column types detected:', JSON.stringify(columnTypes));
  console.log('[PREVIEW] Preview generated at:', new Date().toISOString());

  return {
    datasetId,
    rows: previewRows,
    rowCount: previewRows.length,
    columns,
    columnTypes,
    generatedAt: new Date().toISOString(),
    isPreview: true,
  };
}

/**
 * Determine if dataset requires background processing
 * @param rowCount - Total number of rows
 * @returns true if dataset should be processed in background
 */
export function requiresBackgroundProcessing(rowCount: number): boolean {
  // Use 50k threshold as per requirements
  return rowCount > 50000;
}

/**
 * Get recommended processing strategy
 * @param rowCount - Total number of rows
 * @returns Processing strategy recommendation
 */
export function getProcessingStrategy(rowCount: number): 'immediate' | 'background' | 'chunked' {
  if (rowCount > 100000) {
    return 'chunked';
  } else if (rowCount > 50000) {
    return 'background';
  }
  return 'immediate';
}
