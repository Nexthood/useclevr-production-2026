// ============================================================================
// International Number and Currency Formatting Utilities
// ============================================================================

// Common currency symbols and codes
const CURRENCY_MAP: Record<string, string> = {
  usd: '$', eur: '€', gbp: '£', jpy: '¥', cny: '¥', inr: '₹',
  aud: 'A$', cad: 'C$', chf: 'CHF', krw: '₩', rub: '₽', brl: 'R$', mxn: 'MX$',
};

// Detect currency from column name
export function detectCurrencyFromColumn(columnName: string): string {
  const lower = columnName.toLowerCase();
  for (const [code, symbol] of Object.entries(CURRENCY_MAP)) {
    if (lower.includes(code) || lower.includes(symbol.toLowerCase())) {
      return code.toUpperCase();
    }
  }
  return 'USD';
}

// Get currency symbol from code
export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_MAP[currencyCode.toLowerCase()] || '$';
}

// Simple currency format - $1,234 or $1,234.50 (uses Intl.NumberFormat)
export function formatCurrencySimple(value: number, currency = 'USD'): string {
  if (value === null || value === undefined || isNaN(value)) return 'No data available';
  try {
    // Use 0 decimals for whole numbers, 2 for decimals
    const decimals = value % 1 === 0 ? 0 : 2;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    const decimals = value % 1 === 0 ? 0 : 2;
    return `${value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: 2 })}`;
  }
}

// Simple percentage format - 88% (rounded to whole number)
export function formatPercentSimple(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return `${Math.round(value)}%`;
}

// Format currency for KPIs - intelligent formatting for large numbers
// For values >= 100M, uses compact format (e.g. $160.4M)
// For smaller values, uses full format (e.g. $1,234,567)
export function formatCurrencyForKPI(value: number, currencySymbol = '$'): string {
  if (value === null || value === undefined || isNaN(value)) return 'No data available';
  
  // For very large numbers (>= 100 million), use compact format
  if (value >= 100000000) {
    return `${currencySymbol}${(value / 1000000).toFixed(1)}M`;
  }
  // For large numbers (>= 10 million), use compact with one decimal
  if (value >= 10000000) {
    return `${currencySymbol}${(value / 1000000).toFixed(2)}M`;
  }
  // For millions (>= 1 million), use compact format
  if (value >= 1000000) {
    return `${currencySymbol}${(value / 1000000).toFixed(2)}M`;
  }
  // For thousands (>= 10 thousand), use compact format
  if (value >= 10000) {
    return `${currencySymbol}${(value / 1000).toFixed(1)}K`;
  }
  // For smaller values, use full format with commas
  return `${currencySymbol}${Math.round(value).toLocaleString('en-US')}`;
}

// Compact format for charts - $1.2M, $450K, $27.8M
// Handles very large numbers appropriately - used in charts
export function formatCurrencyCompact(value: number, currencySymbol = '$'): string {
  if (value === null || value === undefined || isNaN(value)) return `${currencySymbol}0`;
  
  // For billions
  if (value >= 1000000000) {
    return `${currencySymbol}${(value / 1000000000).toFixed(1)}B`;
  }
  // For hundreds of millions
  if (value >= 100000000) {
    return `${currencySymbol}${(value / 1000000).toFixed(1)}M`;
  }
  // For millions
  if (value >= 1000000) {
    return `${currencySymbol}${(value / 1000000).toFixed(1)}M`;
  }
  // For hundreds of thousands
  if (value >= 100000) {
    return `${currencySymbol}${(value / 1000).toFixed(1)}K`;
  }
  // For thousands
  if (value >= 1000) {
    return `${currencySymbol}${(value / 1000).toFixed(1)}K`;
  }
  return `${currencySymbol}${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// Format currency with decimals - $1,234.50
export function formatCurrencyWithDecimals(value: number, currencySymbol = '$'): string {
  if (value === null || value === undefined || isNaN(value)) return 'No data available';
  return `${currencySymbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Format with conversion label - $451,137.50 (converted from EUR)
export function formatCurrencyWithLabel(value: number, originalCurrency: string, convertedValue?: number): string {
  const symbol = getCurrencySymbol(originalCurrency);
  const formatted = formatCurrencyWithDecimals(value, symbol);
  if (convertedValue !== undefined && originalCurrency.toUpperCase() !== 'USD') {
    return `${formatted} (converted from ${originalCurrency.toUpperCase()})`;
  }
  return formatted;
}

// Percentage with sign - +7% or -12% (whole number)
export function formatPercentage(value: number, showSign = true): string {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${Math.round(value)}%`;
}

export interface UserFormattingPreferences {
  preferredCurrency: string; baseCurrency: string; numberFormat: 'auto' | 'manual'; manualLocale?: string;
}

export function normalizeNumberString(value: string): string {
  if (!value || typeof value !== 'string') return '0.00';
  const cleaned = value.replace(/[^\d.,]/g, '');
  if (cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
    const parts = cleaned.split(',');
    if (parts.length === 2) return `${parts[0].replace(/\./g, '')}.${parts[1].substring(0, 2).padEnd(2, '0')}`;
  }
  if (cleaned.includes('.') && cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',')) {
    const parts = cleaned.split('.');
    if (parts.length >= 2) return `${parts[0].replace(/,/g, '')}.${parts[1].substring(0, 2).padEnd(2, '0')}`;
  }
  return `${cleaned.replace(/[.,]/g, '')}.00`;
}

export function parseNormalizedNumber(value: string): number {
  return parseFloat(normalizeNumberString(value));
}

export function formatNumber(value: number, preferences: UserFormattingPreferences, options: Intl.NumberFormatOptions = {}): string {
  const locale = preferences.numberFormat === 'auto' ? (typeof navigator !== 'undefined' ? navigator.language : 'en-US') : (preferences.manualLocale || 'en-US');
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, ...options }).format(value);
}

export function formatCurrency(value: number, preferences: UserFormattingPreferences, currency?: string): string {
  const locale = preferences.numberFormat === 'auto' ? (typeof navigator !== 'undefined' ? navigator.language : 'en-US') : (preferences.manualLocale || 'en-US');
  const currencyCode = currency || preferences.preferredCurrency;
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function getDefaultPreferences(): UserFormattingPreferences {
  return { preferredCurrency: 'EUR', baseCurrency: 'EUR', numberFormat: 'auto' };
}

export function isValidCurrency(currency: string): boolean {
  try { new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(0); return true; } catch { return false; }
}

export function isValidLocale(locale: string): boolean {
  try { new Intl.NumberFormat(locale).format(0); return true; } catch { return false; }
}
