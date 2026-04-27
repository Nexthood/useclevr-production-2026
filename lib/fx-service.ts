// ============================================================================
// Exchange Rate Service for Multi-Currency Financial Processing
// ============================================================================

export interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: Date;
  source: string;
}

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  countries: string[];
}

// ISO 4217 valid currency codes
export const ISO_4217_CURRENCIES = new Set([
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP',
  'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'FOK', 'GBP', 'GEL', 'GGP', 'GHS',
  'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG', 'HUF',
  'IDR', 'ILS', 'IMP', 'INR', 'IQD', 'IRR', 'ISK', 'JEP', 'JMD', 'JOD',
  'JPY', 'KES', 'KGS', 'KHR', 'KID', 'KMF', 'KRW', 'KWD', 'KYD', 'KZT',
  'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD',
  'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN',
  'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK',
  'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR',
  'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP',
  'STN', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD',
  'TVD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VES', 'VND',
  'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWL'
]);

// Validate ISO 4217 currency code
export function isValidISOCurrency(code: string): boolean {
  return ISO_4217_CURRENCIES.has(code.toUpperCase());
}

// Country to Currency mapping
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  US: 'USD', CA: 'CAD', GB: 'GBP', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR',
  BE: 'EUR', AT: 'EUR', PT: 'EUR', FI: 'EUR', IE: 'EUR', GR: 'EUR', JP: 'JPY', CN: 'CNY',
  HK: 'HKD', SG: 'SGD', AU: 'AUD', NZ: 'NZD', CH: 'CHF', SE: 'SEK', NO: 'NOK',
  DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', BR: 'BRL', MX: 'MXN', IN: 'INR',
  KR: 'KRW', RU: 'RUB', ZA: 'ZAR', AE: 'AED', SA: 'SAR'
};

// Currency information lookup
export const CURRENCY_INFO: Record<string, CurrencyInfo> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', countries: ['US', 'CA', 'AU'] },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', countries: ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT', 'FI', 'IE', 'GR'] },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', countries: ['GB'] },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', countries: ['JP'] },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', countries: ['CA'] },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', countries: ['AU'] },
  CHF: { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc', countries: ['CH'] },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', countries: ['CN'] },
  HKD: { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', countries: ['HK'] },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', countries: ['SG'] },
  SEK: { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', countries: ['SE'] },
  NOK: { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', countries: ['NO'] },
  DKK: { code: 'DKK', symbol: 'kr', name: 'Danish Krone', countries: ['DK'] },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', countries: ['IN'] },
  MXN: { code: 'MXN', symbol: '$', name: 'Mexican Peso', countries: ['MX'] },
  BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', countries: ['BR'] },
  KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won', countries: ['KR'] },
  ZAR: { code: 'ZAR', symbol: 'R', name: 'South African Rand', countries: ['ZA'] },
  PLN: { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', countries: ['PL'] },
  NZD: { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', countries: ['NZ'] }
};

// Currency symbol detection regex patterns
const CURRENCY_SYMBOLS: Record<string, RegExp> = {
  USD: /\$/,
  EUR: /€/,
  GBP: /£/,
  JPY: /¥/,
  CHF: /Fr/,
  CAD: /C\$/,
  AUD: /A\$/,
  INR: /₹/,
  KRW: /₩/,
  BRL: /R\$/,
  MXN: /MX\$/,
  CNY: /¥/,
  HKD: /HK\$/,
  SGD: /S\$/,
  NZD: /NZ\$/
};

// Session cache for exchange rates (24-hour TTL)
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
let cachedRates: ExchangeRates | null = null;
let cachedRatesTimestamp: number = 0;
let sessionBaseCurrency: string = 'EUR'; // Default base currency: EUR

export function getSessionBaseCurrency(): string {
  return sessionBaseCurrency;
}

export function setSessionBaseCurrency(currency: string): void {
  sessionBaseCurrency = currency;
}

// Detect currency from column name (prioritizes explicit currency columns)
export function detectCurrencyFromColumn(columnName: string): string | null {
  const name = columnName.toLowerCase();
  
  // Check for explicit currency columns (highest priority)
  if (name === 'currency_code' || name === 'currency_code_iso' || name === 'currencycode' || name === 'currency') {
    return null; // Will be detected from values
  }
  
  // Check for currency symbol column
  if (name === 'currency_symbol' || name === 'currencysymbol' || name === 'symbol') {
    return null; // Will be detected from values
  }
  
  // Check for currency in column name
  const currencies = ['usd', 'eur', 'gbp', 'jpy', 'cad', 'aud', 'chf', 'cny', 'hkd', 'sgd'];
  for (const curr of currencies) {
    if (name.includes(curr)) {
      return curr.toUpperCase();
    }
  }
  
  return null;
}

// Find currency columns in dataset
export function findCurrencyColumns(columns: string[]): { codeColumn: string | null, symbolColumn: string | null } {
  let codeColumn: string | null = null;
  let symbolColumn: string | null = null;
  
  for (const col of columns) {
    const name = col.toLowerCase();
    
    // Currency code column (highest priority)
    if (!codeColumn && (name === 'currency_code' || name === 'currency_code_iso' || name === 'currencycode' || name === 'iso_currency')) {
      codeColumn = col;
    }
    
    // Currency symbol column
    if (!symbolColumn && (name === 'currency_symbol' || name === 'currencysymbol' || name === 'symbol')) {
      symbolColumn = col;
    }
  }
  
  return { codeColumn, symbolColumn };
}

// Detect currency from values (prioritizes codes over symbols)
export function detectCurrencyFromValues(values: string[]): string | null {
  const nonEmpty = values.filter(v => v && v.trim().length > 0);
  if (nonEmpty.length === 0) return null;
  
  // First: Check for ISO 4217 currency codes (highest priority)
  const codes = nonEmpty.filter(v => isValidISOCurrency(v.trim()));
  if (codes.length > nonEmpty.length * 0.3) {
    console.log(`[FX] Detected currency code: ${codes[0].toUpperCase()}`);
    return codes[0].toUpperCase();
  }
  
  // Second: Check for currency symbols
  for (const [currency, pattern] of Object.entries(CURRENCY_SYMBOLS)) {
    const matches = nonEmpty.filter(v => pattern.test(v));
    if (matches.length > nonEmpty.length * 0.3) {
      console.log(`[FX] Detected currency symbol: ${currency}`);
      return currency;
    }
  }
  
  return null;
}

// Fetch exchange rates from API with 24-hour caching
export async function fetchExchangeRates(baseCurrency: string = 'EUR'): Promise<ExchangeRates> {
  // Validate currency code against ISO 4217
  if (!isValidISOCurrency(baseCurrency)) {
    console.error(`[FX] Invalid currency code: ${baseCurrency}, using EUR as fallback`);
    baseCurrency = 'EUR';
  }

  // Check 24-hour cache first
  if (cachedRates && 
      cachedRates.base === baseCurrency && 
      Date.now() - cachedRatesTimestamp < CACHE_TTL) {
    console.log(`[FX] Using cached rates (age: ${Math.round((Date.now() - cachedRatesTimestamp) / 3600000)}h)`);
    return cachedRates;
  }

  // If we have cached rates but they're stale, try to refresh
  const useFallback = cachedRates && cachedRates.base === baseCurrency;
  
  try {
    // Using exchangerate-api.com free tier (no API key needed for basic usage)
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates');
    }
    
    const data = await response.json();
    
    cachedRates = {
      base: data.base,
      rates: data.rates,
      timestamp: new Date(),
      source: 'exchangerate-api.com'
    };
    cachedRatesTimestamp = Date.now();
    
    return cachedRates;
  } catch (error) {
    console.error('FX Rate fetch failed, using fallback rates:', error);
    return getFallbackRates(baseCurrency);
  }
}

// Fallback rates (approximate, used when API is unavailable)
function getFallbackRates(baseCurrency: string): ExchangeRates {
  const fallbackRates: Record<string, Record<string, number>> = {
    USD: { EUR: 0.92, GBP: 0.79, JPY: 149.5, CAD: 1.36, AUD: 1.53, CHF: 0.88, CNY: 7.24, HKD: 7.82, SGD: 1.34 },
    EUR: { USD: 1.09, GBP: 0.86, JPY: 162.8, CAD: 1.48, AUD: 1.67, CHF: 0.96, CNY: 7.89, HKD: 8.52, SGD: 1.46 },
    GBP: { USD: 1.27, EUR: 1.16, JPY: 189.5, CAD: 1.72, AUD: 1.94, CHF: 1.11, CNY: 9.17, HKD: 9.90, SGD: 1.70 }
  };
  
  const rates = fallbackRates[baseCurrency] || fallbackRates.USD;
  
  return {
    base: baseCurrency,
    rates,
    timestamp: new Date(),
    source: 'Fallback (cached)'
  };
}

// Convert amount between currencies
export function convertCurrency(
  amount: number, 
  fromCurrency: string, 
  toCurrency: string, 
  rates: ExchangeRates
): number | null {
  if (fromCurrency === toCurrency) return amount;
  
  // Convert to base first, then to target
  const fromRate = fromCurrency === rates.base ? 1 : (rates.rates[fromCurrency] || null);
  const toRate = toCurrency === rates.base ? 1 : (rates.rates[toCurrency] || null);
  
  if (!fromRate || !toRate) return null;
  
  // Convert: amount / fromRate * toRate (if base is USD)
  const inBase = amount / fromRate;
  return inBase * toRate;
}

// Format currency with symbol
export function formatCurrencySymbol(amount: number, currency: string): string {
  const info = CURRENCY_INFO[currency];
  const symbol = info ? info.symbol : currency;
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
