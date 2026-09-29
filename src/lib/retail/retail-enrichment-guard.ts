import {
  RETAIL_DEAD_STOCK_AFTER_DAYS,
  RETAIL_DEFAULT_REORDER_POINT,
  RETAIL_SLOW_MOVER_AFTER_DAYS,
} from "@/lib/retail/retail-record-engine";
import type { RetailAnalyticsSnapshot } from "@/lib/retail/retail-snapshot";

/**
 * Retail AI-enrichment guard.
 *
 * The Retail dashboard summary is deterministic: every headline, finding, and
 * fallback recommendation comes from the RetailAnalyticsSnapshot. AI
 * enrichment may only restate those findings in human-readable language. This
 * module validates a candidate enrichment line against the deterministic
 * grounding and rejects everything the Retail UI must never display:
 *
 * - generic dataset-ranking headlines ("{x} dominates the category",
 *   "{x} leads with ...", "Analyze what drives {x} ...")
 * - raw product/SKU identifiers when a human-readable product name exists
 * - numbers that no deterministic Retail finding supplies
 * - counts that contradict the deterministic findings
 * - metrics that the Retail grounding does not contain
 *
 * A rejected enrichment never blocks the section: the caller displays the
 * deterministic Retail fallback instead.
 */

export type RetailEnrichmentGrounding = {
  allowedNumbers: Set<number>;
  /** Deterministic count nouns mapped to their authoritative values. */
  counts: {
    inventoryItems: number | null;
    products: number | null;
    locations: number | null;
    orders: number | null;
    customers: number | null;
    lowStockAlerts: number | null;
    deadStock: number | null;
    slowMovers: number | null;
  };
  metrics: {
    hasSalesData: boolean;
    hasProfitData: boolean;
    hasInventoryValue: boolean;
    hasStockOnHand: boolean;
  };
  productNames: string[];
  storeValues: string[];
  /** Known identifier tokens (SKU/ID values) mapped to their display name. */
  identifierNames: Map<string, string>;
  hasProductDisplayNames: boolean;
};

export type RetailEnrichmentVerdict =
  | { ok: true; text: string }
  | { ok: false; reason: string };

/** Generic ranking/fallback language that must never reach the Retail UI. */
const FORBIDDEN_PHRASES: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /dominates/i, reason: "generic dataset ranking headline" },
  { pattern: /leads with/i, reason: "generic dataset ranking explanation" },
  { pattern: /analyze what drives/i, reason: "generic dataset recommendation" },
  { pattern: /majority of revenue/i, reason: "generic dataset ranking headline" },
  { pattern: /increase focus on/i, reason: "generic dataset recommendation" },
  { pattern: /capitalize on growth momentum/i, reason: "generic dataset recommendation" },
  { pattern: /review all segments/i, reason: "generic dataset recommendation" },
  { pattern: /review the data/i, reason: "generic filler recommendation" },
  { pattern: /try (?:a different question|again with|rephrasing)/i, reason: "generic error text" },
  { pattern: /found \d+ data points/i, reason: "generic dataset statistics" },
  { pattern: /\b(?:select|group\s+by|limit\s+\d+)\b.*\b(?:from|by)\b/i, reason: "technical query text" },
];

/** Tokens shaped like product/SKU identifiers (P-6001, SKU-A102, RTM-01). */
const ID_TOKEN_PATTERN = /\b[A-Z][A-Z0-9]{0,5}-[A-Z0-9]{1,10}\b/g;

const DATE_PATTERNS: RegExp[] = [
  /\b\d{4}-\d{1,2}-\d{1,2}\b/g,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi,
];

const MAX_ENRICHMENT_LENGTH = 1200;

const COUNT_PATTERNS: Array<{ pattern: RegExp; key: keyof RetailEnrichmentGrounding["counts"] }> = [
  { pattern: /(\d[\d.,]*)\s+dead[-\s]?stock/i, key: "deadStock" },
  { pattern: /(\d[\d.,]*)\s+slow[-\s]?movers?/i, key: "slowMovers" },
  { pattern: /(\d[\d.,]*)\s+slow[-\s]?moving/i, key: "slowMovers" },
  { pattern: /(\d[\d.,]*)\s+items?\s+(?:are|is)\s+at or below/i, key: "lowStockAlerts" },
  { pattern: /(\d[\d.,]*)\s+(?:reorder|low[-\s]?stock)\s+(?:alerts?|items?)/i, key: "lowStockAlerts" },
  { pattern: /(\d[\d.,]*)\s+(?:product\/location|inventory)\s+items?/i, key: "inventoryItems" },
  { pattern: /(\d[\d.,]*)\s+(?:canonical\s+)?products?\b/i, key: "products" },
  { pattern: /(\d[\d.,]*)\s+(?:distinct\s+)?orders?\b/i, key: "orders" },
  { pattern: /(\d[\d.,]*)\s+(?:distinct\s+)?customers?\b/i, key: "customers" },
  { pattern: /(\d[\d.,]*)\s+locations?\b/i, key: "locations" },
];

const NEGATION_PATTERNS: Array<{ pattern: RegExp; key: keyof RetailEnrichmentGrounding["counts"]; label: string }> = [
  { pattern: /\bno\s+dead[-\s]?stock\b/i, key: "deadStock", label: "dead stock" },
  { pattern: /\bno\s+slow[-\s]?movers?\b|\bno\s+slow[-\s]?moving\b/i, key: "slowMovers", label: "slow movers" },
  { pattern: /\bno\s+(?:reorder\s+alerts?|low[-\s]?stock\s+(?:alerts?|items?))\b/i, key: "lowStockAlerts", label: "reorder alerts" },
];

/**
 * Builds the deterministic grounding for enrichment validation from the same
 * snapshot that drives the visible Retail dashboard.
 */
export function buildRetailEnrichmentGrounding(snapshot: RetailAnalyticsSnapshot): RetailEnrichmentGrounding {
  const allowedNumbers = new Set<number>();
  const addNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return;
    allowedNumbers.add(roundTo(value, 6));
  };

  if (snapshot.source.type === "dataset") {
    addNumber(snapshot.source.rowCount);
    addNumber(snapshot.source.columnCount);
  }
  const kpis = snapshot.kpis;
  addNumber(kpis.productCount);
  addNumber(kpis.inventoryItemCount);
  addNumber(kpis.variantCount);
  addNumber(kpis.locationCount);
  addNumber(kpis.orderCount);
  addNumber(kpis.customerCount);
  addNumber(kpis.totalOnHand);
  addNumber(kpis.inventoryValue);
  addNumber(kpis.netSales);
  addNumber(kpis.unitsSold);
  addNumber(kpis.averageOrderValue);
  // True uncapped classification counts the deterministic summary states.
  addNumber(snapshot.lowStock.alertCount);
  addNumber(snapshot.deadStock.deadCount);
  addNumber(snapshot.deadStock.slowMoverCount);

  for (const item of snapshot.lowStock.items) {
    addNumber(item.stock);
    addNumber(item.reorderPoint);
    addNumber(item.unitsSold);
    addNumber(item.revenue);
    addNumber(item.grossProfit);
    addNumber(item.margin);
  }
  for (const item of snapshot.deadStock.items) {
    addNumber(item.stock);
    addNumber(item.reorderPoint);
    addNumber(item.unitsSold);
    addNumber(item.revenue);
    addNumber(item.grossProfit);
    addNumber(item.margin);
    addNumber(item.daysSinceLastSale);
    addNumber(item.stockValue);
  }
  for (const item of snapshot.topProfit.items) {
    addNumber(item.stock);
    addNumber(item.reorderPoint);
    addNumber(item.unitsSold);
    addNumber(item.profit);
    addNumber(item.margin);
    addNumber(item.revenue);
    addNumber(item.cost);
  }
  for (const item of snapshot.topSellers.items) {
    addNumber(item.unitsSold);
    addNumber(item.revenue);
    addNumber(item.orderCount);
  }
  // Deterministic rule constants the AI may legitimately restate.
  addNumber(RETAIL_DEAD_STOCK_AFTER_DAYS);
  addNumber(RETAIL_SLOW_MOVER_AFTER_DAYS);
  addNumber(RETAIL_DEFAULT_REORDER_POINT);

  const productNames = collectUnique([
    ...snapshot.lowStock.items.map((item) => item.product),
    ...snapshot.deadStock.items.map((item) => item.product),
    ...snapshot.topProfit.items.map((item) => item.product),
    ...snapshot.topSellers.items.map((item) => item.product),
  ]);
  const storeValues = collectUnique(
    [...snapshot.lowStock.items, ...snapshot.deadStock.items, ...snapshot.topProfit.items]
      .map((item) => item.store)
      .filter((store): store is string => Boolean(store && store !== "Not provided")),
  );

  const identifierNames = new Map<string, string>();
  for (const item of [...snapshot.lowStock.items, ...snapshot.deadStock.items, ...snapshot.topProfit.items]) {
    const sku = item.sku?.trim();
    if (sku && sku !== "Not provided") identifierNames.set(sku.toLowerCase(), item.product);
  }

  return {
    allowedNumbers,
    counts: {
      inventoryItems: kpis.inventoryItemCount,
      products: kpis.productCount,
      locations: kpis.locationCount,
      orders: kpis.orderCount,
      customers: kpis.customerCount,
      lowStockAlerts: snapshot.lowStock.alertCount,
      deadStock: snapshot.deadStock.deadCount,
      slowMovers: snapshot.deadStock.slowMoverCount,
    },
    metrics: {
      hasSalesData: kpis.netSales !== null || kpis.unitsSold !== null,
      hasProfitData: snapshot.topProfit.items.length > 0,
      hasInventoryValue: kpis.inventoryValue !== null,
      hasStockOnHand: kpis.totalOnHand !== null,
    },
    productNames,
    storeValues,
    identifierNames,
    hasProductDisplayNames: productNames.length > 0,
  };
}

/**
 * Validates one AI enrichment line (explanation or recommendation) against
 * the deterministic Retail grounding.
 */
export function validateRetailEnrichment(
  candidate: unknown,
  grounding: RetailEnrichmentGrounding,
): RetailEnrichmentVerdict {
  if (typeof candidate !== "string") {
    return { ok: false, reason: "enrichment is not text" };
  }
  const text = candidate.replace(/\s+/g, " ").trim();
  if (!text) {
    return { ok: false, reason: "enrichment is empty" };
  }
  if (text.length > MAX_ENRICHMENT_LENGTH) {
    return { ok: false, reason: "enrichment exceeds the display length limit" };
  }

  for (const forbidden of FORBIDDEN_PHRASES) {
    if (forbidden.pattern.test(text)) {
      return { ok: false, reason: `generic dataset language: ${forbidden.reason}` };
    }
  }

  const idVerdict = validateIdentifierTokens(text, grounding);
  if (!idVerdict.ok) return idVerdict;

  const numberVerdict = validateNumbers(text, grounding);
  if (!numberVerdict.ok) return numberVerdict;

  const conflictVerdict = validateCountConflicts(text, grounding);
  if (!conflictVerdict.ok) return conflictVerdict;

  const metricVerdict = validateMetricClaims(text, grounding);
  if (!metricVerdict.ok) return metricVerdict;

  return { ok: true, text };
}

/**
 * Single source of truth for the displayed Retail AI Insights Summary.
 *
 * The headline always comes from the deterministic snapshot. The explanation
 * and recommendation use AI enrichment only when it passes the guard;
 * otherwise the deterministic Retail fallback is displayed.
 */
export function resolveRetailDisplayedInsights(input: {
  snapshot: RetailAnalyticsSnapshot;
  aiInsight?: unknown;
  aiExplanation?: unknown;
  aiRecommendation?: unknown;
}): {
  summary: string;
  explanation: string;
  recommendation: string;
  aiExplanationUsed: boolean;
  aiRecommendationUsed: boolean;
  rejections: string[];
} {
  const { snapshot } = input;
  const grounding = buildRetailEnrichmentGrounding(snapshot);

  const summary = snapshot.summary.insight;

  const explanationVerdict = validateRetailEnrichment(input.aiExplanation, grounding);
  const recommendationVerdict = validateRetailEnrichment(input.aiRecommendation, grounding);

  const rejections: string[] = [];
  if (!explanationVerdict.ok) rejections.push(`explanation: ${explanationVerdict.reason}`);
  if (!recommendationVerdict.ok) rejections.push(`recommendation: ${recommendationVerdict.reason}`);

  return {
    summary,
    explanation: explanationVerdict.ok ? explanationVerdict.text : snapshot.summary.explanation,
    recommendation: recommendationVerdict.ok ? recommendationVerdict.text : snapshot.summary.recommendation,
    aiExplanationUsed: explanationVerdict.ok,
    aiRecommendationUsed: recommendationVerdict.ok,
    rejections,
  };
}

function validateIdentifierTokens(text: string, grounding: RetailEnrichmentGrounding): RetailEnrichmentVerdict {
  const tokens = text.match(ID_TOKEN_PATTERN) ?? [];
  if (tokens.length === 0) return { ok: true, text };

  const haystack = text.toLowerCase();
  for (const token of tokens) {
    const tokenLower = token.toLowerCase();
    // Part of a real product display name (for example "USB-C" inside
    // "USB-C Cable 2m") is a human-readable reference, not a raw ID.
    if (grounding.productNames.some((name) => name.toLowerCase().includes(tokenLower))) continue;
    // The deterministic location label (store codes such as RTM-01) is the
    // only location naming the snapshot provides.
    if (grounding.storeValues.some((store) => store.toLowerCase() === tokenLower)) continue;

    const mappedName = grounding.identifierNames.get(tokenLower);
    if (mappedName) {
      // Known identifier: acceptable only when the human-readable product
      // name is available and also referenced.
      if (grounding.hasProductDisplayNames && !haystack.includes(mappedName.toLowerCase())) {
        return {
          ok: false,
          reason: `references identifier ${token} while the product name is available`,
        };
      }
      continue;
    }
    return { ok: false, reason: `references identifier ${token} that no Retail finding supplies` };
  }
  return { ok: true, text };
}

function validateNumbers(text: string, grounding: RetailEnrichmentGrounding): RetailEnrichmentVerdict {
  let rest = text;
  for (const pattern of DATE_PATTERNS) {
    rest = rest.replace(pattern, " ");
  }
  // Allowed literal tokens may legitimately contain digits (product names,
  // store codes, SKU values); remove them before auditing bare numbers.
  for (const allowed of [...grounding.productNames, ...grounding.storeValues, ...grounding.identifierNames.keys()]) {
    if (!allowed) continue;
    rest = rest.split(allowed).join(" ");
    rest = rest.split(allowed.toLowerCase()).join(" ");
    rest = rest.split(allowed.toUpperCase()).join(" ");
  }

  const matches = rest.match(/-?\d[\d.,]*/g) ?? [];
  for (const raw of matches) {
    const normalized = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(normalized)) {
      return { ok: false, reason: `unexplained number "${raw}"` };
    }
    if (!numberIsGrounded(normalized, grounding.allowedNumbers)) {
      return { ok: false, reason: `unexplained number "${raw}"` };
    }
  }
  return { ok: true, text };
}

function numberIsGrounded(value: number, allowed: Set<number>): boolean {
  if (allowed.has(roundTo(value, 6))) return true;
  // Human rounding of a deterministic value (money and percentages).
  for (const precision of [0, 1, 2]) {
    if (allowed.has(roundTo(value, precision))) return true;
    if (containsRounded(allowed, value, precision)) return true;
  }
  return false;
}

function containsRounded(allowed: Set<number>, value: number, precision: number): boolean {
  const rounded = roundTo(value, precision);
  if (allowed.has(rounded)) return true;
  // The grounding value rounded to this precision equals the candidate.
  for (const candidate of allowed) {
    if (roundTo(candidate, precision) === rounded) return true;
  }
  return false;
}

function validateCountConflicts(text: string, grounding: RetailEnrichmentGrounding): RetailEnrichmentVerdict {
  for (const rule of COUNT_PATTERNS) {
    const match = text.match(rule.pattern);
    if (!match) continue;
    const expected = grounding.counts[rule.key];
    if (expected === null || expected === undefined) continue;
    const claimed = Number((match[1] ?? "").replace(/,/g, ""));
    if (!Number.isFinite(claimed)) continue;
    if (roundTo(claimed, 6) !== roundTo(expected, 6)) {
      return {
        ok: false,
        reason: `claims ${claimed} for ${String(rule.key)} while the deterministic finding is ${expected}`,
      };
    }
  }
  for (const rule of NEGATION_PATTERNS) {
    const expected = grounding.counts[rule.key];
    if (expected !== null && expected > 0 && rule.pattern.test(text)) {
      return {
        ok: false,
        reason: `denies ${rule.label} while the deterministic finding reports ${expected}`,
      };
    }
  }
  return { ok: true, text };
}

function validateMetricClaims(text: string, grounding: RetailEnrichmentGrounding): RetailEnrichmentVerdict {
  const { metrics } = grounding;
  // Dataset Retail snapshots compute point-in-time findings, never trend or
  // growth deltas, so growth/change claims are always ungrounded.
  if (/\b(?:grew|growth|grows|increased|increase|decreased|decrease|declined|decline|rose|fell|dropped|spiked)\b[^.]{0,24}?\d/i.test(text)) {
    return { ok: false, reason: "claims a trend change no deterministic Retail finding supplies" };
  }
  if (!metrics.hasProfitData && /\b(?:profit|margin)\b/i.test(text)) {
    return { ok: false, reason: "claims profit or margin without a deterministic profit finding" };
  }
  if (!metrics.hasSalesData && /\b(?:revenue|net\s+sales|total\s+sales)\b/i.test(text)) {
    return { ok: false, reason: "claims revenue without deterministic sales findings" };
  }
  if (!metrics.hasInventoryValue && /\binventory\s+value\b/i.test(text)) {
    return { ok: false, reason: "claims inventory value without a deterministic finding" };
  }
  if (!metrics.hasStockOnHand && /\b(?:stock\s+on\s+hand|on[-\s]hand)\b/i.test(text)) {
    return { ok: false, reason: "claims stock on hand without a deterministic finding" };
  }
  return { ok: true, text };
}

function collectUnique(values: string[]): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || trimmed === "Not provided" || trimmed === "Unknown product") continue;
    seen.add(trimmed);
  }
  return [...seen];
}

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
