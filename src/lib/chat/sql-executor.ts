import type { DatasetRecord } from '@/lib/data/csv-analyzer';
import { db } from '@/lib/db';
import { datasets } from '@/lib/db/schema';
import { debugLog, debugError } from '@/lib/utils/debug';
import {
  aggregateData,
  findColumn,
  formatCurrencyValue,
  formatPercentValue,
  normalizeCurrencyValue,
} from '@/lib/query/engine';
import { eq } from 'drizzle-orm';

export async function executeStrictSQL(datasetId: string, question: string): Promise<{
  success: boolean;
  sql?: string;
  result?: any;
  error?: string;
}> {
  debugLog('[STRICT_SQL] Generating SQL for question:', question);

  const dataset = await db!.query.datasets.findFirst({
    where: eq(datasets.id, datasetId),
  });

  if (!dataset) {
    return { success: false, error: 'Dataset not found' };
  }

  const data = (dataset.data as Record<string, any>[]) || [];
  const columns = (dataset.columns as string[]) || [];

  if (data.length === 0) {
    return { success: false, error: 'Dataset has no data' };
  }

  debugLog('[STRICT_SQL] Dataset:', dataset.name, '- Rows:', data.length, '- Columns:', columns.length);

  const q = question.toLowerCase();
  let sql = '';
  let result: any = null;

  try {
    if (q.includes('how many row') || q.includes('count row') || q.includes('number of row')) {
      sql = `SELECT COUNT(*) as count FROM dataset`;
      result = { count: data.length, operation: 'count' };
    } else if (q.includes('total') || q.includes('sum') || q.includes('revenue') || q.includes('sales')) {
      const valueCol = findColumn(columns, ['revenue', 'sales', 'amount', 'total', 'price', 'cost']);
      if (valueCol) {
        const total = data.reduce((sum, row) => sum + (parseFloat(row[valueCol]) || 0), 0);
        sql = `SELECT SUM(${valueCol}) as total FROM dataset`;
        result = { total, column: valueCol, operation: 'sum' };
      }
    } else if (q.includes('average') || q.includes('avg') || q.includes('mean')) {
      const valueCol = findColumn(columns, ['revenue', 'sales', 'amount', 'price', 'cost', 'profit']);
      if (valueCol) {
        const values = data.map(r => parseFloat(r[valueCol]) || 0);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        sql = `SELECT AVG(${valueCol}) as average FROM dataset`;
        result = { average: avg, column: valueCol, operation: 'avg' };
      }
    } else if (q.includes('region') || q.includes('country') || q.includes('product') ||
             q.includes('channel') || q.includes('segment') || q.includes('category') ||
             q.includes('highest') || q.includes('lowest') || q.includes('most') || q.includes('top') ||
             q.includes('best') || q.includes('worst') || q.includes('least') ||
             q.includes('brings') || q.includes('generates') || q.includes('produces')) {
      let groupCol = findColumn(columns, ['region', 'country', 'product', 'category', 'segment', 'channel', 'source', 'medium', 'campaign', 'customer', 'industry', 'area', 'zone']);
      const valueCol = findColumn(columns, ['revenue', 'sales', 'profit', 'amount', 'total', 'value', 'income']);

      debugLog('[STRICT_SQL] GROUP BY - groupCol:', groupCol, 'valueCol:', valueCol);

      if (groupCol && valueCol) {
        const grouped = aggregateData(data, groupCol, valueCol);
        sql = `SELECT ${groupCol}, SUM(${valueCol}) as total FROM dataset GROUP BY ${groupCol}`;
        result = {
          type: 'group_by',
          groupBy: groupCol,
          value: valueCol,
          data: grouped,
          operation: 'group_by'
        };
      }
    } else if (q.includes('minimum') || q.includes('maximum') || q.includes('lowest') || q.includes('highest')) {
      const valueCol = findColumn(columns, ['revenue', 'sales', 'profit', 'amount', 'price', 'cost', 'quantity', 'units']);
      if (valueCol) {
        const values = data.map(r => parseFloat(r[valueCol]) || 0);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const isMin = q.includes('minimum') || q.includes('lowest');
        sql = `SELECT ${isMin ? 'MIN' : 'MAX'}(${valueCol}) as result FROM dataset`;
        result = {
          [isMin ? 'minimum' : 'maximum']: isMin ? min : max,
          column: valueCol,
          operation: isMin ? 'min' : 'max'
        };
      }
    } else if (q.includes('profit') && (q.includes('margin') || q.includes('percentage'))) {
      const revenueCol = findColumn(columns, ['revenue', 'sales', 'amount']);
      const costCol = findColumn(columns, ['cost', 'unit_cost']);
      if (revenueCol && costCol) {
        let totalRevenue = 0;
        let totalCost = 0;
        for (const row of data) {
          totalRevenue += parseFloat(row[revenueCol]) || 0;
          totalCost += parseFloat(row[costCol]) || 0;
        }
        const margin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
        sql = `SELECT ((SUM(revenue) - SUM(cost)) / SUM(revenue)) * 100 as margin FROM dataset`;
        result = { profitMargin: margin, revenue: totalRevenue, cost: totalCost, operation: 'margin' };
      }
    }

    debugLog('[STRICT_SQL] Generated SQL:', sql);
    debugLog('[STRICT_SQL] Result:', JSON.stringify(result)?.slice(0, 200));

    if (!sql || !result) {
      return { success: false, error: 'Could not generate SQL for this question type' };
    }

    return { success: true, sql, result };
  } catch (err: any) {
    debugError('[STRICT_SQL] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export function generateAggregatedContext(data: any[], columns: string[]): string {
  const context: string[] = [];

  const countryCol = findColumn(columns, ['country', 'nation', 'market']);
  const regionCol = findColumn(columns, ['region', 'continent', 'area', 'zone']);
  const productCol = findColumn(columns, ['product', 'item', 'sku', 'goods']);
  const channelCol = findColumn(columns, ['channel', 'source', 'medium', 'platform']);
  const revenueCol = findColumn(columns, ['revenue', 'sales', 'amount', 'total', 'income', 'value']);

  if (!revenueCol) return '';

  if (countryCol) {
    const byCountry = aggregateData(data, countryCol, revenueCol);
    if (byCountry.length > 0) {
      const top = byCountry[0];
      context.push(`TOP COUNTRY: ${top.name} - ${formatCurrencyValue(top.value)} (${formatPercentValue(top.pct)} of total)`);
      context.push(`Country rankings: ${byCountry.slice(0, 5).map((r, i) => `${i + 1}. ${r.name}: ${formatCurrencyValue(r.value)}`).join(', ')}`);
    }
  }

  if (regionCol) {
    const byRegion = aggregateData(data, regionCol, revenueCol);
    if (byRegion.length > 0) {
      const top = byRegion[0];
      context.push(`TOP REGION: ${top.name} - ${formatCurrencyValue(top.value)} (${formatPercentValue(top.pct)} of total)`);
      context.push(`Region rankings: ${byRegion.slice(0, 5).map((r, i) => `${i + 1}. ${r.name}: ${formatCurrencyValue(r.value)}`).join(', ')}`);
    }
  }

  if (productCol) {
    const byProduct = aggregateData(data, productCol, revenueCol);
    if (byProduct.length > 0) {
      const top = byProduct[0];
      context.push(`TOP PRODUCT: ${top.name} - ${formatCurrencyValue(top.value)} (${formatPercentValue(top.pct)} of total)`);
      context.push(`Product rankings: ${byProduct.slice(0, 5).map((r, i) => `${i + 1}. ${r.name}: ${formatCurrencyValue(r.value)}`).join(', ')}`);
    }
  }

  if (channelCol) {
    const byChannel = aggregateData(data, channelCol, revenueCol);
    if (byChannel.length > 0) {
      const top = byChannel[0];
      context.push(`TOP CHANNEL: ${top.name} - ${formatCurrencyValue(top.value)} (${formatPercentValue(top.pct)} of total)`);
    }
  }

  return context.join('\n');
}

export function normalizeDataset(data: DatasetRecord[]): DatasetRecord[] {
  if (!data || data.length === 0) return data;

  const sampleRow = data[0];
  const columns = Object.keys(sampleRow);
  const monetaryPatterns = /price|amount|revenue|cost|total|profit|sales|value|qty|quantity/i;

  const monetaryColumns = columns.filter(col => monetaryPatterns.test(col));

  debugLog('[NORMALIZE] Detected monetary columns:', monetaryColumns);

  return data.map(row => {
    const normalized: DatasetRecord = { ...row };

    for (const col of monetaryColumns) {
      const value = row[col];
      if (typeof value === 'string' && /[€$¥£C$A₹CHF₽]/.test(value)) {
        normalized[col] = normalizeCurrencyValue(value);
        debugLog(`[NORMALIZE] ${col}: "${value}" -> ${normalized[col]}`);
      }
    }

    return normalized;
  });
}
