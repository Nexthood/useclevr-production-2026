import { debugLog, debugError, debugWarn } from "@/lib/debug"
/**
 * Auto Question Engine
 * 
 * Generates 5 high-impact business questions based on dataset structure.
 * Triggered immediately after CSV upload.
 */

import { analyzeCSV, DatasetRecord } from './csv-analyzer';

export interface ColumnInfo {
  name: string;
  type: 'date' | 'number' | 'string' | 'currency' | 'percentage';
}

export interface AutoQuestionResult {
  suggestedQuestions: string[];
  metadata: {
    rowCount: number;
    columnCount: number;
    columns: ColumnInfo[];
  };
}

/**
 * Analyze column and detect its type
 */
function detectColumnType(sampleValues: any[]): ColumnInfo['type'] {
  if (!sampleValues || sampleValues.length === 0) return 'string';
  
  const firstValid = sampleValues.find(v => v !== null && v !== undefined && v !== '');
  if (!firstValid) return 'string';
  
  const strValue = String(firstValid).toLowerCase();
  
  // Check for date patterns
  if (!isNaN(Date.parse(strValue)) || 
      /^\d{4}-\d{2}-\d{2}/.test(strValue) ||
      /^\d{2}\/\d{2}\/\d{4}/.test(strValue) ||
      /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/.test(strValue)) {
    return 'date';
  }
  
  // Check for currency
  if (/^[$€£¥₹CCHF]/.test(strValue) || 
      strValue.includes('usd') || 
      strValue.includes('eur')) {
    return 'currency';
  }
  
  // Check for percentage
  if (strValue.includes('%') || strValue.includes('percent')) {
    return 'percentage';
  }
  
  // Check for number
  const numValue = parseFloat(strValue.replace(/[^0-9.-]/g, ''));
  if (!isNaN(numValue) && isFinite(numValue)) {
    return 'number';
  }
  
  return 'string';
}

/**
 * Detect key business columns from common naming patterns
 */
function detectBusinessColumns(columns: ColumnInfo[]): {
  revenue: string | null;
  profit: string | null;
  quantity: string | null;
  region: string | null;
  product: string | null;
  category: string | null;
  channel: string | null;
  customer: string | null;
  date: string | null;
  cost: string | null;
} {
  const revenuePatterns = ['revenue', 'sales', 'amount', 'total', 'order_value', 'net_revenue', 'gross_sales'];
  const profitPatterns = ['profit', 'margin', 'net_income', 'earnings'];
  const quantityPatterns = ['quantity', 'qty', 'units', 'units_sold', 'order_quantity'];
  const regionPatterns = ['region', 'country', 'nation', 'market', 'territory', 'area', 'zone'];
  const productPatterns = ['product', 'item', 'sku', 'goods', 'merchandise', 'product_name'];
  const channelPatterns = ['channel', 'source', 'medium', 'utm_source', 'campaign', 'traffic_source'];
  const customerPatterns = ['customer', 'client', 'user', 'buyer', 'segment'];
  const datePatterns = ['date', 'month', 'year', 'period', 'time', 'created_at', 'order_date'];
  const costPatterns = ['cost', 'cogs', 'expense', 'unit_cost', 'shipping_cost'];
  const categoryPatterns = ['category', 'type', 'segment', 'industry', 'class'];
  
  const columnNames = columns.map(c => c.name.toLowerCase());
  
  return {
    revenue: columns.find(c => revenuePatterns.some(p => c.name.toLowerCase().includes(p)))?.name || null,
    profit: columns.find(c => profitPatterns.some(p => c.name.toLowerCase().includes(p)))?.name || null,
    quantity: columns.find(c => quantityPatterns.some(p => c.name.toLowerCase().includes(p)))?.name || null,
    region: columns.find(c => regionPatterns.some(p => c.name.toLowerCase().includes(p)))?.name || null,
    product: columns.find(c => productPatterns.some(p => c.name.toLowerCase().includes(p)))?.name || null,
    category: columns.find(c => categoryPatterns.some(p => c.name.toLowerCase().includes(p)))?.name || null,
    channel: columns.find(c => channelPatterns.some(p => c.name.toLowerCase().includes(p)))?.name || null,
    customer: columns.find(c => customerPatterns.some(p => c.name.toLowerCase().includes(p)))?.name || null,
    date: columns.find(c => datePatterns.some(p => c.name.toLowerCase().includes(p)))?.name || null,
    cost: columns.find(c => costPatterns.some(p => c.name.toLowerCase().includes(p)))?.name || null,
  };
}

/**
 * Generate 5 high-impact business questions based on dataset structure
 */
export async function generateAutoQuestions(
  columns: string[],
  sampleData: Record<string, any>[],
  rowCount: number,
  columnCount: number
): Promise<AutoQuestionResult> {
  // Detect column types
  const columnInfos: ColumnInfo[] = columns.map(col => ({
    name: col,
    type: detectColumnType(sampleData.map(row => row[col]))
  }));
  
  // Detect business columns
  const business = detectBusinessColumns(columnInfos);
  
  const questions: string[] = [];
  
  // Question 1: Revenue/Profit drivers (highest priority)
  if (business.revenue || business.profit) {
    if (business.region) {
      questions.push(`Which region has the highest ${business.profit ? 'profit' : 'revenue'} right now?`);
    } else if (business.product) {
      questions.push(`Which product is driving the most ${business.profit ? 'profit' : 'revenue'}?`);
    } else if (business.channel) {
      questions.push(`Which acquisition channel has the best ${business.profit ? 'profit' : 'revenue'}?`);
    } else {
      questions.push(`What's the total ${business.profit ? 'profit' : 'revenue'} across all data?`);
    }
  } else if (business.quantity) {
    questions.push(`Which product or category has the highest ${business.quantity}?`);
  }
  
  // Question 2: Growth trends & anomalies
  if (business.date && (business.revenue || business.profit || business.quantity)) {
    const metric = business.profit || business.revenue || business.quantity;
    const metricName = business.profit ? 'profit' : business.revenue ? 'revenue' : 'sales';
    questions.push(`What caused the ${metricName} ${business.quantity ? 'and quantity ' : ''}change last month compared to the previous period?`);
  } else if (business.product || business.category) {
    questions.push(`Which products are growing fastest compared to last period?`);
  } else {
    questions.push(`What are the top 3 performing items by ${business.quantity || 'value'}?`);
  }
  
  // Question 3: Customer/Geography/Product performance
  if (business.customer) {
    questions.push(`Which customer segment is most valuable for our business?`);
  } else if (business.region) {
    questions.push(`Which geography should we focus investment in for next quarter?`);
  } else if (business.product) {
    questions.push(`Which product category has the highest growth potential?`);
  } else {
    questions.push(`What patterns can we identify in our top performing records?`);
  }
  
  // Question 4: Channel & acquisition efficiency
  if (business.channel) {
    questions.push(`Which acquisition channel has the best ROAS or conversion efficiency?`);
  } else if (business.customer) {
    questions.push(`What's the acquisition cost trend for new customers?`);
  } else {
    questions.push(`Where should we allocate more budget based on current performance?`);
  }
  
  // Question 5: Risk & opportunity signals
  if (business.profit || business.revenue) {
    const metric = business.profit || business.revenue;
    if (business.region) {
      questions.push(`Which region is underperforming and needs immediate attention?`);
    } else if (business.product) {
      questions.push(`Which products are losing money or have declining margins?`);
    } else {
      questions.push(`What's the profit margin trend and what should we do about it?`);
    }
  } else if (business.quantity) {
    questions.push(`Which areas show declining performance that need investigation?`);
  } else {
    questions.push(`What are 3 immediate actions we should take based on this data?`);
  }
  
  // Ensure we have exactly 5 questions
  while (questions.length < 5) {
    questions.push(`What insights can we derive from the ${columns[0]} column?`);
  }
  
  return {
    suggestedQuestions: questions.slice(0, 5),
    metadata: {
      rowCount,
      columnCount,
      columns: columnInfos
    }
  };
}

/**
 * Generate questions using AI for more sophisticated analysis
 * (fallback when pattern matching isn't sufficient)
 */
export async function generateAIQuestions(
  columns: string[],
  sampleData: Record<string, any>[],
  rowCount: number,
  columnCount: number
): Promise<AutoQuestionResult> {
  const columnNames = columns.join(', ');
  const sampleJson = JSON.stringify(sampleData.slice(0, 5), null, 2);
  
  const prompt = `Analyze this dataset structure and generate exactly 5 high-impact business questions.
  
Dataset Info:
- Columns: ${columnNames}
- Rows: ${rowCount}
- Columns: ${columnCount}

Sample Data:
${sampleJson}

Requirements:
1. Short, clear, natural-language, business-focused questions
2. Never generic ("analyze data", "what is in this dataset")  
3. Never technical ("group by", "sum revenue")
4. Decision-oriented (e.g. "Which channel should I double down on?")
5. If possible, include time-based or comparative phrasing (e.g. "last month", "compared to...")

Prioritize by potential business impact:
1. Revenue & profit drivers (highest priority)
2. Growth trends & anomalies
3. Customer / geography / product performance
4. Channel & acquisition efficiency
5. Risk & opportunity signals

Output format (exactly):
Suggested Questions:
1. [Question 1]
2. [Question 2]
3. [Question 3]
4. [Question 4]
5. [Question 5]`;

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        columns,
        sampleData: sampleData.slice(0, 5),
        rowCount
      })
    });
    
    if (response.ok) {
      const text = await response.text();
      // Extract questions from response
      const questionMatch = text.match(/Suggested Questions:\n([\s\S]*)/i);
      if (questionMatch) {
        const questions = questionMatch[1]
          .split('\n')
          .map((q: string) => q.replace(/^\d+[\.\)]\s*/, '').trim())
          .filter((q: string) => q.length > 10 && q.length < 200);
        
        if (questions.length >= 5) {
          return {
            suggestedQuestions: questions.slice(0, 5),
            metadata: {
              rowCount,
              columnCount,
              columns: columns.map(col => ({
                name: col,
                type: detectColumnType(sampleData.map(row => row[col]))
              }))
            }
          };
        }
      }
    }
  } catch (error) {
    debugWarn('[AUTO_QUESTIONS] AI generation failed, using fallback:', error);
  }
  
  // Fallback to pattern-based generation
  return generateAutoQuestions(columns, sampleData, rowCount, columnCount);
}
