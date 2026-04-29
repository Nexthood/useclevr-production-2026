import { debugLog, debugError, debugWarn } from "@/lib/debug"

// ============================================================================
// DATA CLEANER & NORMALIZER - Deterministic Data Cleaning
// ============================================================================
// Normalizes dataset before full analysis:
// - Remove currency symbols
// - Normalize decimal separators
// - Parse numeric values safely
// - Standardize date formats
// - Convert dates to ISO
// - Detect and handle missing/null/placeholder values
// - Detect invalid rows
// ============================================================================

import {
  CleaningStats,
  DataQualityReport,
  ColumnType,
} from './pipeline-types';

// ============================================================================
// CONSTANTS
// ============================================================================

const CURRENCY_SYMBOLS = ['$', '€', '£', '¥', '₹', 'C$', 'A$', 'CHF', '₽', 'R$', '₩', '₪'];

const DATE_PATTERNS = [
  { regex: /^\d{4}-\d{2}-\d{2}$/, format: 'iso' },
  { regex: /^\d{2}\/\d{2}\/\d{4}$/, format: 'us' },
  { regex: /^\d{2}-\d{2}-\d{4}$/, format: 'eu' },
  { regex: /^\d{2}\.\d{2}\.\d{4}$/, format: 'german' },
  { regex: /^\d{4}\/\d{2}\/\d{2}$/, format: 'alt' },
  { regex: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, format: 'iso-datetime' },
];

const PLACEHOLDER_VALUES = [
  'n/a', 'na', 'n/a', 'null', 'none', 'undefined', 'missing',
  '-', '—', '–', '.', '...', 'xxxx', 'xxxxx', 'tbd', 'tbc',
  'unknown', 'unspecified', 'not available', 'not applicable'
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if value is a placeholder
 */
function isPlaceholderValue(value: string): boolean {
  const normalized = value.toLowerCase().trim();
  return PLACEHOLDER_VALUES.includes(normalized);
}

/**
 * Check if value is null or undefined
 */
function isNullish(value: any): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * Clean currency/numeric value
 */
function cleanNumericValue(value: any): { cleaned: number | null; wasCleaned: boolean } {
  if (isNullish(value)) {
    return { cleaned: null, wasCleaned: false };
  }

  let strValue = String(value).trim();

  // Check for placeholders
  if (isPlaceholderValue(strValue)) {
    return { cleaned: null, wasCleaned: false };
  }

  // Remove currency symbols (prefix and suffix)
  for (const symbol of CURRENCY_SYMBOLS) {
    if (strValue.startsWith(symbol)) {
      strValue = strValue.slice(symbol.length).trim();
      break;
    }
    if (strValue.endsWith(symbol)) {
      strValue = strValue.slice(0, -symbol.length).trim();
      break;
    }
  }

  // Handle accounting format: (100) = -100
  if (strValue.startsWith('(') && strValue.endsWith(')')) {
    strValue = '-' + strValue.slice(1, -1);
  }

  // Remove thousand separators (comma, space)
  strValue = strValue.replace(/[, ]/g, '');

  // Handle percentage (convert to decimal)
  const isPercent = strValue.endsWith('%');
  if (isPercent) {
    strValue = strValue.slice(0, -1);
  }

  const num = parseFloat(strValue);
  if (isNaN(num)) {
    return { cleaned: null, wasCleaned: false };
  }

  return { cleaned: isPercent ? num / 100 : num, wasCleaned: true };
}

/**
 * Parse date value to ISO string
 */
function parseDateToISO(value: any): { parsed: string | null; wasCleaned: boolean } {
  if (isNullish(value)) {
    return { parsed: null, wasCleaned: false };
  }

  const strValue = String(value).trim();

  // Check for placeholders
  if (isPlaceholderValue(strValue)) {
    return { parsed: null, wasCleaned: false };
  }

  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}/.test(strValue)) {
    const d = new Date(strValue);
    if (!isNaN(d.getTime())) {
      return { parsed: d.toISOString().split('T')[0], wasCleaned: true };
    }
  }

  // US: MM/DD/YYYY
  const usMatch = strValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (usMatch) {
    const d = new Date(parseInt(usMatch[3]), parseInt(usMatch[1]) - 1, parseInt(usMatch[2]));
    if (!isNaN(d.getTime())) {
      return { parsed: d.toISOString().split('T')[0], wasCleaned: true };
    }
  }

  // EU: DD-MM-YYYY or DD.MM.YYYY
  const euMatch = strValue.match(/^(\d{2})[-.](\d{2})[-.](\d{4})$/);
  if (euMatch) {
    const d = new Date(parseInt(euMatch[3]), parseInt(euMatch[2]) - 1, parseInt(euMatch[1]));
    if (!isNaN(d.getTime())) {
      return { parsed: d.toISOString().split('T')[0], wasCleaned: true };
    }
  }

  // Try native Date parsing as fallback
  const d = new Date(strValue);
  if (!isNaN(d.getTime())) {
    return { parsed: d.toISOString().split('T')[0], wasCleaned: true };
  }

  return { parsed: null, wasCleaned: false };
}

/**
 * Check if row is valid (has at least one non-null numeric or date value)
 */
function isValidRow(row: Record<string, any>, columnTypes: Record<string, ColumnType>): boolean {
  const values = Object.values(row);
  
  // Check if at least one value is valid
  for (const value of values) {
    if (isNullish(value)) continue;
    
    const strValue = String(value).trim();
    if (isPlaceholderValue(strValue)) continue;
    
    // Check if it's a valid number
    const { cleaned } = cleanNumericValue(value);
    if (cleaned !== null) return true;
    
    // Check if it's a valid date
    const { parsed } = parseDateToISO(value);
    if (parsed !== null) return true;
  }
  
  return false;
}

// ============================================================================
// MAIN CLEANING FUNCTION
// ============================================================================

/**
 * Clean and normalize dataset
 * @param rows - Raw dataset rows
 * @param columnTypes - Detected column types
 * @returns Cleaned rows and cleaning statistics
 */
export function cleanAndNormalizeDataset(
  rows: Record<string, any>[],
  columnTypes: Record<string, ColumnType>
): {
  cleanedRows: Record<string, any>[];
  cleaningStats: CleaningStats;
} {
  debugLog(`[CLEAN] Starting cleaning for ${rows.length} rows`);

  const stats: CleaningStats = {
    originalRowCount: rows.length,
    validRowCount: 0,
    invalidRowCount: 0,
    invalidRowPercentage: 0,
    missingValueCounts: {},
    cleanedValues: {},
    dateStandardizedCount: 0,
    numericParsedCount: 0,
    warnings: [],
  };

  // Initialize missing value counts
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  for (const col of columns) {
    stats.missingValueCounts[col] = 0;
    stats.cleanedValues[col] = 0;
  }

  const cleanedRows: Record<string, any>[] = [];

  // Process each row
  for (const row of rows) {
    const cleanedRow: Record<string, any> = {};
    let rowHasValidData = false;

    for (const column of columns) {
      const value = row[column];
      const columnType = columnTypes[column];

      // Track missing values
      if (isNullish(value) || isPlaceholderValue(String(value))) {
        stats.missingValueCounts[column] = (stats.missingValueCounts[column] || 0) + 1;
        cleanedRow[column] = null;
        continue;
      }

      // Process based on column type
      switch (columnType) {
        case 'currency':
        case 'numeric':
        case 'percentage': {
          const { cleaned, wasCleaned } = cleanNumericValue(value);
          if (cleaned !== null) {
            cleanedRow[column] = cleaned;
            rowHasValidData = true;
            if (wasCleaned) {
              stats.cleanedValues[column] = (stats.cleanedValues[column] || 0) + 1;
              stats.numericParsedCount++;
            }
          } else {
            cleanedRow[column] = String(value); // Keep original if parsing fails
          }
          break;
        }

        case 'date': {
          const { parsed, wasCleaned } = parseDateToISO(value);
          if (parsed !== null) {
            cleanedRow[column] = parsed;
            rowHasValidData = true;
            if (wasCleaned) {
              stats.cleanedValues[column] = (stats.cleanedValues[column] || 0) + 1;
              stats.dateStandardizedCount++;
            }
          } else {
            cleanedRow[column] = String(value); // Keep original if parsing fails
          }
          break;
        }

        default:
          cleanedRow[column] = String(value).trim();
          if (cleanedRow[column]) rowHasValidData = true;
      }
    }

    // Only add rows with valid data
    if (rowHasValidData) {
      cleanedRows.push(cleanedRow);
      stats.validRowCount++;
    } else {
      stats.invalidRowCount++;
    }
  }

  // Calculate invalid row percentage
  stats.invalidRowPercentage = Math.round((stats.invalidRowCount / stats.originalRowCount) * 1000) / 10;

  // Generate warnings
  if (stats.invalidRowPercentage > 10) {
    stats.warnings.push(
      `Warning: ${stats.invalidRowPercentage}% of rows (${stats.invalidRowCount}) are invalid. This may affect analysis accuracy.`
    );
  }

  if (stats.invalidRowPercentage > 20) {
    stats.warnings.push(
      `Critical: Over 20% of rows are invalid. Please review your data quality.`
    );
  }

  // Log cleaning results
  debugLog('[CLEAN] Cleaning complete:', {
    originalRows: stats.originalRowCount,
    validRows: stats.validRowCount,
    invalidRows: stats.invalidRowCount,
    invalidPercentage: stats.invalidRowPercentage,
    numericParsed: stats.numericParsedCount,
    dateStandardized: stats.dateStandardizedCount,
  });

  return { cleanedRows, cleaningStats: stats };
}

/**
 * Generate data quality report
 * @param datasetId - Dataset ID
 * @param cleaningStats - Cleaning statistics
 * @returns Data quality report
 */
export function generateDataQualityReport(
  datasetId: string,
  cleaningStats: CleaningStats
): DataQualityReport {
  const hasDataQualityIssues = cleaningStats.invalidRowPercentage > 10;

  return {
    datasetId,
    cleaningStats,
    hasDataQualityIssues,
    needsAttention: hasDataQualityIssues,
    generatedAt: new Date().toISOString(),
  };
}
