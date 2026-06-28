"use client";

import type React from "react";

import useclevrWordmarkDark from "@/assets/images/logos/useclevr-wordmark-dark.png";
import useclevrWordmarkLight from "@/assets/images/logos/useclevr-wordmark-light.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BrainCircuit, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Users, Package, Factory, BarChart, LineChart, PieChart, Target, Rocket, Users as UsersIcon, UserCheck, CreditCard, Percent, Activity } from "lucide-react";
import { useState } from "react";

export interface BusinessVertical {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  metrics: string[];
  description: string;
}

export interface DatasetType {
  vertical: BusinessVertical;
  datasetProfile: DatasetProfile;
  adaptations: AnalysisAdaptation[];
}

export interface DatasetProfile {
  type: "retail" | "startup" | "saas" | "investor" | "consulting" | "financial" | "sales" | "operations";
  confidence: number;
  detectedColumns: DetectedColumns;
  businessContext?: BusinessContext;
}

export interface DetectedColumns {
  revenue: string | null;
  profit: string | null;
  quantity: string | null;
  date: string | null;
  category: string | null;
  product: string | null;
  customer: string | null;
  region: string | null;
  channel: string | null;
  mrr?: string | null;
  arr?: string | null;
  churn?: string | null;
  cac?: string | null;
  ltv?: string | null;
  runway?: string | null;
  burnRate?: string | null;
  growthRate?: string | null;
}

export interface BusinessContext {
  industry: string;
  companySize: "startup" | "small" | "medium" | "enterprise";
  businessModel: "b2c" | "b2b" | "hybrid";
  geography: "global" | "regional" | "local";
  stage: "seed" | "growth" | "mature" | "expansion";
}

export interface AnalysisAdaptation {
  section: string;
  priority: "high" | "medium" | "low";
  verticalSpecific: boolean;
  metrics: BusinessMetric[];
}

export interface BusinessMetric {
  id: string;
  name: string;
  category: "financial" | "operational" | "strategic";
  unit: string;
  description: string;
  benchmark?: number;
}

export const businessVerticals: BusinessVertical[] = [
  {
    id: "retail",
    name: "Retail",
    icon: Package,
    color: "from-emerald-500 to-teal-500",
    metrics: [
      "revenue", "profit", "inventory", "sku", "stock_levels", "turnover_rate",
      "gross_margin", "sales_velocity", "forecast_accuracy", "stockout_rate"
    ],
    description: "Retail operations and inventory management"
  },
  {
    id: "startup",
    name: "Startup",
    icon: Rocket,
    color: "from-purple-500 to-violet-500",
    metrics: [
      "mrr", "arr", "churn", "cac", "ltv", "runway", "burn_rate", "growth_rate",
      "customer_acquisition", "retention_rate", "viral_coefficient", "conversion_rate"
    ],
    description: "Early-stage growth metrics and unit economics"
  },
  {
    id: "saas",
    name: "SaaS",
    icon: UsersIcon,
    color: "from-blue-500 to-indigo-500",
    metrics: [
      "mrr", "arr", "churn", "cac", "ltv", "runway", "burn_rate", "growth_rate",
      "customer_acquisition", "retention_rate", "lifetime_value", "monthly_growth"
    ],
    description: "Subscription-based business metrics"
  },
  {
    id: "investor",
    name: "Investor",
    icon: TrendingUp,
    color: "from-amber-500 to-orange-500",
    metrics: [
      "revenue_growth", "profitability", "cash_efficiency", "market_traction",
      "risk_metrics", "unit_economics", "roe", "roe_variance", "portfolio_performance"
    ],
    description: "Investment analysis and risk assessment"
  },
  {
    id: "consulting",
    name: "Consulting",
    icon: BrainCircuit,
    color: "from-cyan-500 to-blue-500",
    metrics: [
      "kpis", "trends", "problem_areas", "opportunities", "cost_reduction",
      "revenue_growth", "efficiency_metrics", "benchmarking", "action_recommendations"
    ],
    description: "Business improvement and strategic consulting"
  },
  {
    id: "financial",
    name: "Financial",
    icon: CreditCard,
    color: "from-rose-500 to-pink-500",
    metrics: [
      "revenue", "profit", "margin", "cash_flow", "working_capital",
      "debt_to_equity", "roi", "roi_variance", "financial_health"
    ],
    description: "Financial performance and analysis"
  },
  {
    id: "sales",
    name: "Sales",
    icon: Target,
    color: "from-green-500 to-emerald-500",
    metrics: [
      "revenue", "growth_rate", "conversion_rate", "average_deal_size",
      "sales_velocity", "pipeline_health", "quota_attainment", "sales_efficiency"
    ],
    description: "Sales performance and pipeline analysis"
  },
  {
    id: "operations",
    name: "Operations",
    icon: Factory,
    color: "from-slate-500 to-gray-500",
    metrics: [
      "efficiency", "productivity", "quality_metrics", "throughput",
      "utilization", "downtime", "waste_reduction", "process_automation"
    ],
    description: "Operational performance and optimization"
  }
];

export function getBusinessVerticals(): BusinessVertical[] {
  return businessVerticals;
}

export function analyzeDatasetType(data: any[]): DatasetType {
  const profile = detectDatasetProfile(data);
  const vertical = detectBusinessVertical(profile, data);
  const adaptations = generateAdaptations(profile, vertical);
  
  return {
    vertical,
    datasetProfile: profile,
    adaptations
  };
}

export function detectDatasetProfile(data: any[]): DatasetProfile {
  const columns = Object.keys(data[0] || {});
  const detectedColumns: DetectedColumns = {
    revenue: null,
    profit: null,
    quantity: null,
    date: null,
    category: null,
    product: null,
    customer: null,
    region: null,
    channel: null,
    mrr: null,
    arr: null,
    churn: null,
    cac: null,
    ltv: null,
    runway: null,
    burnRate: null,
    growthRate: null
  };

  columns.forEach(col => {
    const lowerCol = col.toLowerCase();
    if (!detectedColumns.revenue && (lowerCol.includes('revenue') || lowerCol.includes('sales') || lowerCol.includes('total'))) detectedColumns.revenue = col;
    if (!detectedColumns.profit && (lowerCol.includes('profit') || lowerCol.includes('margin') || lowerCol.includes('earnings'))) detectedColumns.profit = col;
    if (!detectedColumns.quantity && (lowerCol.includes('quantity') || lowerCol.includes('count') || lowerCol.includes('units'))) detectedColumns.quantity = col;
    if (!detectedColumns.date && (lowerCol.includes('date') || lowerCol.includes('time') || lowerCol.includes('period') || lowerCol.includes('month') || lowerCol.includes('year'))) detectedColumns.date = col;
    if (!detectedColumns.category && (lowerCol.includes('category') || lowerCol.includes('segment') || lowerCol.includes('type'))) detectedColumns.category = col;
    if (!detectedColumns.product && (lowerCol.includes('product') || lowerCol.includes('item') || lowerCol.includes('sku'))) detectedColumns.product = col;
    if (!detectedColumns.customer && (lowerCol.includes('customer') || lowerCol.includes('client') || lowerCol.includes('user'))) detectedColumns.customer = col;
    if (!detectedColumns.region && (lowerCol.includes('region') || lowerCol.includes('country') || lowerCol.includes('territory'))) detectedColumns.region = col;
    if (!detectedColumns.channel && (lowerCol.includes('channel') || lowerCol.includes('source') || lowerCol.includes('medium'))) detectedColumns.channel = col;
    if (!detectedColumns.mrr && (lowerCol.includes('mrr') || lowerCol.includes('monthly recurring'))), detectedColumns.mrr = col;
    if (!detectedColumns.arr && (lowerCol.includes('arr') || lowerCol.includes('annual recurring'))), detectedColumns.arr = col;
    if (!detectedColumns.churn && (lowerCol.includes('churn') || lowerCol.includes('retention'))) detectedColumns.churn = col;
    if (!detectedColumns.cac && (lowerCol.includes('cac') || lowerCol.includes('acquisition cost'))) detectedColumns.cac = col;
    if (!detectedColumns.ltv && (lowerCol.includes('ltv') || lowerCol.includes('lifetime value'))) detectedColumns.ltv = col;
  });

  // Analyze data patterns to determine the most likely vertical
  const type: DatasetProfile['type'] = analyzeDataPattern(data, detectedColumns);
  
  return {
    type,
    confidence: calculateConfidence(data, type, detectedColumns),
    detectedColumns,
    businessContext: determineBusinessContext(data, columns)
  };
}

export function detectBusinessVertical(profile: DatasetProfile, data: any[]): BusinessVertical {
  const columnCorrelationScore = calculateCorrelationScore(data, profile.detectedColumns);
  const dataSize = data.length;
  
  let bestMatch: BusinessVertical = businessVerticals[0];
  let bestScore = 0;
  
  for (const vertical of businessVerticals) {
    const score = calculateVerticalScore(vertical, profile, dataSize, columnCorrelationScore);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = vertical;
    }
  }
  
  return bestMatch;
}

export function generateAdaptations(profile: DatasetProfile, vertical: BusinessVertical): AnalysisAdaptation[] {
  const adaptations: AnalysisAdaptation[] = [];
  
  // Core sections for all verticals
  adaptations.push({
    section: "overview",
    priority: "high",
    verticalSpecific: false,
    metrics: [
      { id: "revenue", name: "Revenue", category: "financial", unit: "USD", description: "Total revenue generated" },
      { id: "profit", name: "Profit", category: "financial", unit: "USD", description: "Net profit" },
      { id: "growth_rate", name: "Growth Rate", category: "strategic", unit: "%", description: "Period-over-period growth" }
    ]
  });
  
  // Vertical-specific sections
  switch (profile.type) {
    case "retail":
      adaptations.push({
        section: "inventory",
        priority: "high",
        verticalSpecific: true,
        metrics: [
          { id: "stock_levels", name: "Stock Levels", category: "operational", unit: "units", description: "Current inventory levels" },
          { id: "turnover_rate", name: "Turnover Rate", category: "operational", unit: "days", description: "Average stock turnover time" },
          { id: "stockout_rate", name: "Stockout Rate", category: "operational", unit: "%", description: "Percentage of items out of stock" }
        ]
      });
      break;
    
    case "startup":
    case "saas":
      adaptations.push({
        section: "unit_economics",
        priority: "high",
        verticalSpecific: true,
        metrics: [
          { id: "cac", name: "CAC", category: "financial", unit: "USD", description: "Customer acquisition cost" },
          { id: "ltv", name: "LTV", category: "financial", unit: "USD", description: "Lifetime value of customer" },
          { id: "churn", name: "Churn Rate", category: "operational", unit: "%", description: "Customer churn percentage" },
          { id: "runway", name: "Runway", category: "strategic", unit: "months", description: "Months of cash remaining" }
        ]
      });
      break;
    
    case "investor":
      adaptations.push({
        section: "risk_metrics",
        priority: "high",
        verticalSpecific: true,
        metrics: [
          { id: "cash_efficiency", name: "Cash Efficiency", category: "financial", unit: "ratio", description: "Cash conversion efficiency" },
          { id: "market_traction", name: "Market Traction", category: "strategic", unit: "%", description: "Market penetration" },
          { id: "unit_economics", name: "Unit Economics", category: "financial", unit: "USD", description: "Economics per unit" }
        ]
      });
      break;
    
    case "consulting":
      adaptations.push({
        section: "opportunities",
        priority: "high",
        verticalSpecific: true,
        metrics: [
          { id: "cost_reduction", name: "Cost Reduction", category: "financial", unit: "USD", description: "Potential cost savings" },
          { id: "revenue_growth", name: "Revenue Growth", category: "strategic", unit: "%", description: "Revenue growth opportunities" },
          { id: "problem_areas", name: "Problem Areas", category: "operational", unit: "%", description: "Areas needing improvement" }
        ]
      });
      break;
    
    case "financial":
      adaptations.push({
        section: "financial_health",
        priority: "high",
        verticalSpecific: true,
        metrics: [
          { id: "roi", name: "ROI", category: "financial", unit: "%", description: "Return on investment" },
          { id: "margin", name: "Profit Margin", category: "financial", unit: "%", description: "Profitability margin" },
          { id: "cash_flow", name: "Cash Flow", category: "financial", unit: "USD", description: "Cash flow analysis" }
        ]
      });
      break;
    
    case "sales":
      adaptations.push({
        section: "pipeline_health",
        priority: "high",
        verticalSpecific: true,
        metrics: [
          { id: "conversion_rate", name: "Conversion Rate", category: "operational", unit: "%", description: "Lead conversion rate" },
          { id: "average_deal_size", name: "Average Deal Size", category: "financial", unit: "USD", description: "Average transaction value" },
          { id: "pipeline_health", name: "Pipeline Health", category: "strategic", unit: "USD", description: "Pipeline value and health" }
        ]
      });
      break;
    
    case "operations":
      adaptations.push({
        section: "efficiency_metrics",
        priority: "high",
        verticalSpecific: true,
        metrics: [
          { id: "efficiency", name: "Efficiency", category: "operational", unit: "ratio", description: "Operational efficiency" },
          { id: "quality_metrics", name: "Quality Metrics", category: "operational", unit: "%", description: "Quality indicators" },
          { id: "throughput", name: "Throughput", category: "operational", unit: "units", description: "Production throughput" }
        ]
      });
      break;
  }
  
  return adaptations;
}

function calculateVerticalScore(vertical: BusinessVertical, profile: DatasetProfile, dataSize: number, correlationScore: number): number {
  let score = 0;
  
  // Check data size suitability
  if (dataSize < 10 && (vertical.id === "startup" || vertical.id === "saas")) {
    return 0; // Startups need more data
  }
  
  // Check column presence
  const columnMatches = profile.detectedColumns;
  let columnScore = 0;
  
  for (const metric of vertical.metrics) {
    const columnKey = metric.toLowerCase().replace('_', '');
    if (columnKey in columnMatches && columnMatches[columnKey as keyof DetectedColumns]) {
      columnScore += 10;
    } else if (metric === 'revenue' && columnMatches.revenue) {
      columnScore += 8;
    } else if (metric === 'profit' && columnMatches.profit) {
      columnScore += 8;
    } else if (metric === 'inventory' || metric === 'stock_levels') {
      columnScore += 5; // Will infer from quantity
    }
  }
  
  score += columnScore * 0.6;
  
  // Adjust for correlation
  score += correlationScore * 0.4;
  
  // Add confidence bonus
  score += profile.confidence * 0.5;
  
  return score;
}

function calculateCorrelationScore(data: any[], columns: DetectedColumns): number {
  const score = 0;
  // Calculate correlation between columns based on data patterns
  if (columns.revenue && columns.profit) {
    return Math.min(1, data.length / 100); // Assume positive correlation
  }
  return score;
}

function calculateConfidence(data: any[], type: DatasetProfile['type'], columns: DetectedColumns): number {
  // Simple confidence based on data size and column presence
  const dataScore = Math.min(1, data.length / 50);
  
  let columnScore = 0;
  const essentialColumns = ['revenue', 'date', 'category'];
  essentialColumns.forEach(col => {
    const columnKey = col as keyof DetectedColumns;
    if (columns[columnKey] || col === 'date' || col === 'category') {
      columnScore += 0.2;
    }
  });
  
  // Add type-specific confidence adjustments
  if (type === 'retail' && columns.revenue) {
    columnScore += 0.3;
  } else if ((type === 'startup' || type === 'saas') && columns.revenue) {
    columnScore += 0.2;
  }
  
  return Math.min(1, dataScore + columnScore);
}

function analyzeDataPattern(data: any[], columns: DetectedColumns): DatasetProfile['type'] {
  const dataScore: Record<string, number> = {};
  
  // Analyze data patterns to determine most likely business type
  const revenueData = data.map(row => {
    const revenue = columns.revenue && row[columns.revenue] ? parseFloat(row[columns.revenue]) : null;
    const profit = columns.profit && row[columns.profit] ? parseFloat(row[columns.profit]) : null;
    return { revenue, profit };
  }).filter(d => d.revenue !== null);
  
  if (revenueData.length > 0) {
    const avgRevenue = revenueData.reduce((sum, d) => sum + (d.revenue || 0), 0) / revenueData.length;
    
    // Calculate profit margin distribution
    const profitMargins = revenueData.filter(d => d.profit !== null && d.revenue && d.revenue > 0)
      .map(d => (d.profit || 0) / d.revenue);
    
    const avgProfitMargin = profitMargins.reduce((sum, margin) => sum + margin, 0) / profitMargins.length;
    
    // Pattern analysis
    if (avgRevenue > 100000) {
      dataScore.retail = (avgProfitMargin * 100) / 30; // Based on retail margins
      dataScore.financial = avgProfitMargin * 100;
      dataScore.consulting = 50 + Math.random() * 50;
    }
    
    if (avgRevenue < 10000 && profitMargins.length > 0 && avgProfitMargin > 0.5) {
      dataScore.startup = (data.length / 10) * 50;
      dataScore.saas = (data.length / 10) * 40;
    }
    
    if (avgRevenue < 50000 && data.length < 20) {
      dataScore.consulting = (data.length / 10) * 30;
    }
    
    if (profitMargins.length > 0) {
      const avgMargin = avgProfitMargin * 100;
      dataScore.investor = Math.min(100, avgMargin * 2); // Higher score for higher margins
      dataScore.financial = Math.min(100, avgMargin * 3);
    }
  }
  
  if (data.length > 50) {
    dataScore.investor = (dataScore.investor || 0) + 30;
    dataScore.financial = (dataScore.financial || 0) + 30;
  }
  
  if (columns.mrr || columns.cac || columns.ltv) {
    dataScore.startup = (dataScore.startup || 0) + 50;
    dataScore.saas = (dataScore.saas || 0) + 50;
  }
  
  // Normalize scores
  const maxScore = Math.max(...Object.values(dataScore), 0);
  const normalizedScores: Record<string, number> = {};
  
  Object.keys(dataScore).forEach(key => {
    normalizedScores[key as keyof typeof dataScore] = maxScore > 0 ? dataScore[key as keyof typeof dataScore] / maxScore * 100 : 0;
  });
  
  // Find type with highest score
  const type = Object.keys(normalizedScores).find(key => normalizedScores[key as keyof typeof normalizedScores] > 60) as DatasetProfile['type'] || 'retail';
  
  return type;
}

function determineBusinessContext(data: any[], columns: string[]): BusinessContext {
  // Simple heuristics for business context
  const revenue = columns.find(c => /revenue|sales|amount/.test(c.toLowerCase()));
  const profit = columns.find(c => /profit|margin/.test(c.toLowerCase()));
  const date = columns.find(c => /date|month|year/.test(c.toLowerCase()));
  
  const hasMultipleDatePeriods = data.length > 12;
  const hasProfitData = !!profit;
  const globalData = !columns.includes('region') && !columns.includes('country');
  
  let industry = 'general';
  if (columns.some(c => /retail|product|sku|inventory/.test(c.toLowerCase()))) {
    industry = 'retail';
  } else if (columns.some(c => /software|subscription|saas/.test(c.toLowerCase()))) {
    industry = 'technology';
  } else if (columns.some(c => /financial|bank|investment|stock/.test(c.toLowerCase()))) {
    industry = 'financial';
  }
  
  return {
    industry,
    companySize: hasProfitData ? 'small' : 'startup',
    businessModel: globalData ? 'b2c' : 'b2b',
    geography: globalData ? 'global' : 'regional',
    stage: hasMultipleDatePeriods ? 'growth' : 'seed'
  };
}

export function formatMetricDisplay(metric: BusinessMetric, value: number | null): string {
  if (value === null || value === undefined) return 'N/A';
  
  switch (metric.unit) {
    case 'USD':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    case '%':
      return `${value.toFixed(2)}%`;
    case 'months':
      return `${value.toFixed(1)} months`;
    case 'ratio':
      return value.toFixed(3);
    case 'units':
      return Math.round(value).toString();
    default:
      return value.toFixed(2);
  }
}

export default {
  getBusinessVerticals,
  analyzeDatasetType,
  formatMetricDisplay,
  BusinessContext
};