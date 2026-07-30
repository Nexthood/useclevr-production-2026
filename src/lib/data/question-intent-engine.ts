export type QuestionIntent =
  | "metric.total_revenue"
  | "metric.average_order_value"
  | "metric.average_selling_price"
  | "metric.total_orders"
  | "metric.total_customers"
  | "analysis.sales_concentration"
  | "analysis.revenue_by_country"
  | "analysis.revenue_by_category"
  | "ranking.top_customers"
  | "ranking.top_products"
  | "ranking.top_regions"
  | "risk.revenue"
  | "risk.customer_concentration"
  | "trend.monthly_revenue"
  | "trend.customer_growth"
  | "forecast.revenue"
  | "comparison.segment"
  | "comparison.region"
  | "comparison.period"
  | "analysis.margin"
  | "unknown";

export type QuestionIntentClassification = {
  intent: QuestionIntent;
  confidence: number;
  extractedDimensions: string[];
  extractedMetrics: string[];
  requestedTimePeriod: string | null;
  requestedGrouping: string | null;
};

type IntentRule = {
  intent: Exclude<QuestionIntent, "unknown">;
  patterns: RegExp[];
  metrics: string[];
  dimensions: string[];
  grouping: string | null;
  confidence: number;
};

const INTENT_RULES: IntentRule[] = [
  rule("metric.average_order_value", [/average\s+order\s+value|\baov\b|avg\.?\s+order/i], ["average_order_value"], ["order"], "order"),
  rule("metric.average_selling_price", [/average\s+selling\s+price|\basp\b|average\s+price|avg\.?\s+price/i], ["average_selling_price"], ["product", "quantity"], null),
  rule("metric.total_revenue", [/total\s+revenue|revenue\s+total|how\s+much\s+revenue|sales\s+total|total\s+sales/i], ["revenue"], [], null),
  rule("metric.total_orders", [/total\s+orders|order\s+count|number\s+of\s+orders|how\s+many\s+orders/i], ["orders"], ["order"], "order"),
  rule("metric.total_customers", [/total\s+customers|customer\s+count|number\s+of\s+customers|how\s+many\s+customers/i], ["customers"], ["customer"], "customer"),
  rule("analysis.sales_concentration", [/sales\s+concentration|revenue\s+concentration|concentrated\s+sales|sales.*concentrated|revenue.*concentrated/i], ["revenue_share"], ["customer", "product", "region"], null),
  rule("analysis.revenue_by_country", [/revenue\s+by\s+country|sales\s+by\s+country|country.*revenue|country.*sales/i], ["revenue"], ["country"], "country"),
  rule("analysis.revenue_by_category", [/revenue\s+by\s+category|sales\s+by\s+category|category.*revenue|category.*sales/i], ["revenue"], ["category"], "category"),
  rule("analysis.margin", [/highest\s+margin|best\s+margin|margin\s+by|gross\s+margin|profit\s+margin|which.*margin|who.*margin|customer.*margin|product.*margin/i], ["margin"], ["customer", "product", "category", "region"], null),
  rule("ranking.top_customers", [/top\s+customers|best\s+customers|highest.*customers|customers.*most|who.*top.*customer|who.*highest.*customer/i], ["revenue"], ["customer"], "customer"),
  rule("ranking.top_products", [/top\s+products|best\s+products|highest.*products|products.*most|product.*perform/i], ["revenue"], ["product"], "product"),
  rule("ranking.top_regions", [/top\s+regions|best\s+regions|highest.*regions|regions.*most|top\s+countries|best\s+countries/i], ["revenue"], ["region", "country"], "region"),
  rule("risk.customer_concentration", [/customer\s+concentration|customer.*risk|risk.*customer/i], ["revenue_share"], ["customer"], "customer"),
  rule("risk.revenue", [/revenue\s+risk|sales\s+risk|biggest\s+revenue\s+risks|risk.*revenue|weak.*revenue|declin|drop|down|loss/i], ["revenue"], ["date", "segment"], null),
  rule("trend.monthly_revenue", [/monthly\s+revenue|revenue.*trend|sales.*trend|revenue.*over\s+time|sales.*over\s+time/i], ["revenue"], ["date"], "month"),
  rule("trend.customer_growth", [/customer\s+growth|customers.*trend|customer.*over\s+time/i], ["customers"], ["date", "customer"], "month"),
  rule("forecast.revenue", [/revenue\s+forecast|sales\s+forecast|forecast.*revenue|predict.*revenue|projection/i], ["revenue"], ["date"], "month"),
  rule("comparison.segment", [/compare.*segment|segment.*compare|plan.*compare|channel.*compare|category.*compare|compare.*category/i], ["revenue"], ["segment"], "segment"),
  rule("comparison.region", [/compare.*region|region.*compare|country.*compare|market.*compare/i], ["revenue"], ["region", "country"], "region"),
  rule("comparison.period", [/compare.*period|period.*compare|month.*compare|quarter.*compare|year.*compare/i], ["revenue"], ["date"], "period"),
];

export class QuestionIntentEngine {
  classify(question: string): QuestionIntentClassification {
    return classifyQuestionIntent(question);
  }
}

export function classifyQuestionIntent(question: string): QuestionIntentClassification {
  const text = question.trim();
  if (!text) return unknownIntent();

  const matched = INTENT_RULES.find((item) => item.patterns.some((pattern) => pattern.test(text)));
  if (!matched) return unknownIntent();

  return {
    intent: matched.intent,
    confidence: matched.confidence,
    extractedDimensions: matched.dimensions,
    extractedMetrics: matched.metrics,
    requestedTimePeriod: extractTimePeriod(text),
    requestedGrouping: extractGrouping(text) ?? matched.grouping,
  };
}

function rule(
  intent: Exclude<QuestionIntent, "unknown">,
  patterns: RegExp[],
  metrics: string[],
  dimensions: string[],
  grouping: string | null,
  confidence = 0.86,
): IntentRule {
  return { intent, patterns, metrics, dimensions, grouping, confidence };
}

function unknownIntent(): QuestionIntentClassification {
  return {
    intent: "unknown",
    confidence: 0,
    extractedDimensions: [],
    extractedMetrics: [],
    requestedTimePeriod: null,
    requestedGrouping: null,
  };
}

function extractTimePeriod(question: string) {
  const month = question.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/);
  if (month) return `${month[1]}-${month[2].padStart(2, "0")}`;
  const year = question.match(/\b(20\d{2})\b/);
  if (year) return year[1];
  if (/last\s+month/i.test(question)) return "last_month";
  if (/this\s+month/i.test(question)) return "this_month";
  if (/quarter|q[1-4]/i.test(question)) return "quarter";
  return null;
}

function extractGrouping(question: string) {
  if (/by\s+country|country/i.test(question)) return "country";
  if (/by\s+category|category/i.test(question)) return "category";
  if (/by\s+customer|customer/i.test(question)) return "customer";
  if (/by\s+product|product|sku/i.test(question)) return "product";
  if (/by\s+region|region|market/i.test(question)) return "region";
  if (/by\s+plan|plan/i.test(question)) return "plan";
  if (/by\s+channel|channel/i.test(question)) return "channel";
  return null;
}
