import { debugError, debugLog } from "@/lib/utils/debug";

// app/api/query/route.ts - Direct SQL execution for analytical questions
import { processQuestion } from '@/lib/ai/ai-query-generator';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db';
import { datasetRows, datasets } from '@/lib/db/schema';
import { aggregateData, findColumn } from '@/lib/data/queryEngine';
import { queryRequestSchema, validateOrError } from '@/lib/validation';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  debugLog('========== QUERY REQUEST START ==========');
  
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = validateOrError(queryRequestSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { datasetId, question } = validation.data;

    debugLog('Query:', question);
    debugLog('DatasetID:', datasetId);

    // 2. Get dataset
    const dataset = await db.query.datasets.findFirst({
      where: and(eq(datasets.id, datasetId), eq(datasets.userId, session.user.id)),
    });

    if (!dataset) {
      debugLog('ERROR: Dataset not found:', datasetId);
      return NextResponse.json(
        { error: "No active dataset selected" },
        { status: 400 }
      );
    }

    // 3. Get data from datasets.data column
    let data = (dataset.data as Record<string, any>[]) || [];
    const columns = (dataset.columns as string[]) || [];

    if (data.length === 0) {
      const rows = await db.query.datasetRows.findMany({
        where: eq(datasetRows.datasetId, datasetId),
        columns: { data: true },
        orderBy: (rows, { asc }) => [asc(rows.rowIndex)],
      });
      data = rows.map((row) => row.data as Record<string, any>);
    }
    
    debugLog('Dataset:', dataset.name, '- Rows:', data.length, '- Columns:', columns.length);

    if (data.length === 0) {
      debugLog('ERROR: Dataset has no data');
      return NextResponse.json(
        { error: "Dataset has no data", datasetId },
        { status: 400 }
      );
    }

    // 4. Generate and execute SQL based on question
    const q = (question || '').toLowerCase();
    let generatedSql = '';
    let result: any = null;
    let content = '';

    try {
      // COUNT ROWS
      if (q.includes('how many') || q.includes('count row') || q.includes('number of row')) {
        generatedSql = `SELECT COUNT(*) as count FROM dataset`;
        result = { count: data.length, operation: 'count' };
        debugLog('Generated SQL:', generatedSql);
        debugLog('SQL Result:', result);
      }
      // TOTAL / SUM (revenue, sales, etc)
      else if (q.includes('total') || q.includes('sum') || q.includes('revenue') || q.includes('sales')) {
        const valueCol = findColumn(columns, ['revenue', 'sales', 'amount', 'total', 'price', 'cost', 'profit']);
        if (valueCol) {
          const total = data.reduce((sum, row) => sum + (parseFloat(String(row[valueCol]).replace(/[^0-9.-]/g, '')) || 0), 0);
          generatedSql = `SELECT SUM(${valueCol}) as total FROM dataset`;
          result = { total, column: valueCol, operation: 'sum' };
          debugLog('Generated SQL:', generatedSql);
          debugLog('SQL Result:', result);
        } else {
          debugLog('ERROR: No numeric column found for sum');
          result = { error: 'No numeric column found', availableColumns: columns };
        }
      }
      // PROFIT CALCULATION - try to compute if no direct profit column
      else if (q.includes('profit') || q.includes('loss') || q.includes('profitable') || q.includes('profitability')) {
        // Try to find columns for profit calculation
        // Keywords match actual dataset columns (case insensitive)
        const revenueCol = findColumn(columns, ['revenue', 'sales', 'amount', 'order_total', 'total', 'order_value']);
        const costCol = findColumn(columns, ['cost', 'unit_cost', 'cogs', 'cost_of_goods']);
        const profitCol = findColumn(columns, ['profit', 'net_profit', 'gross_profit', 'earnings']);
        
        debugLog('Profit calculation - found columns:', { revenueCol, costCol, profitCol });
        
        // Get grouping column
        const groupCol = findColumn(columns, ['product', 'product_id', 'product_name', 'region', 'country', 'category', 'segment', 'channel', 'customer_segment']);

        if (!profitCol && !(revenueCol && costCol)) {
          result = {
            error: 'Profit calculation requires a profit column or both revenue and cost columns',
            availableColumns: columns,
            missingColumns: ['profit or revenue + cost'],
          };
        } else if (groupCol) {
          // Group by product/region and calculate profit
          const agg: Record<string, number> = {};
          for (const row of data) {
            const key = row[groupCol] || 'Unknown';
            let profit = 0;
            
            if (profitCol) {
              profit = parseFloat(String(row[profitCol]).replace(/[^0-9.-]/g, '')) || 0;
            } else if (revenueCol && costCol) {
              const revenue = parseFloat(String(row[revenueCol]).replace(/[^0-9.-]/g, '')) || 0;
              const cost = parseFloat(String(row[costCol]).replace(/[^0-9.-]/g, '')) || 0;
              profit = revenue - cost;
            }
            
            agg[key] = (agg[key] || 0) + profit;
          }
          
          // Check if looking for negative/positive
          const isNegative = q.includes('negative') || q.includes('loss') || q.includes('<');
          const isMost = q.includes('most') || q.includes('highest') || q.includes('top') || q.includes('best');
          const isLeast = q.includes('least') || q.includes('lowest') || q.includes('worst');
          const is2nd = /2nd|second|3rd|third/.test(q);
          
          const grouped = Object.entries(agg)
            .map(([name, value]) => ({ name, profit: value }))
            .sort((a, b) => {
              if (isNegative) return a.profit - b.profit; // Most negative first
              if (isMost) return b.profit - a.profit; // Highest first
              if (isLeast) return a.profit - b.profit; // Lowest first
              return b.profit - a.profit; // Default: highest first
            });
          
          // Determine position for ranking questions
          let returnIndex = 0;
          if (is2nd) {
            if (/2nd|second/.test(q)) returnIndex = 1;
            else if (/3rd|third/.test(q)) returnIndex = 2;
            else returnIndex = 1;
          }
          if (returnIndex >= grouped.length) returnIndex = grouped.length - 1;
          
          generatedSql = `SELECT ${groupCol}, computed_profit FROM dataset GROUP BY ${groupCol}`;
          result = { 
            type: 'profit_analysis', 
            groupBy: groupCol, 
            data: grouped, 
            rankPosition: returnIndex + 1,
            operation: 'profit' 
          };
          debugLog('Generated SQL:', generatedSql);
          debugLog('SQL Result:', JSON.stringify(grouped).slice(0, 200));
        } else {
          // No grouping - just calculate total profit
          let totalProfit = 0;
          for (const row of data) {
            if (profitCol) {
              totalProfit += parseFloat(String(row[profitCol]).replace(/[^0-9.-]/g, '')) || 0;
            } else if (revenueCol && costCol) {
              const revenue = parseFloat(String(row[revenueCol]).replace(/[^0-9.-]/g, '')) || 0;
              const cost = parseFloat(String(row[costCol]).replace(/[^0-9.-]/g, '')) || 0;
              totalProfit += revenue - cost;
            }
          }
          generatedSql = `SELECT computed_profit FROM dataset`;
          result = { totalProfit, operation: 'profit' };
          debugLog('Generated SQL:', generatedSql);
          debugLog('SQL Result:', result);
        }
      }
      // AVERAGE
      else if (q.includes('average') || q.includes('avg') || q.includes('mean') || q.includes('spend')) {
        const valueCol = findColumn(columns, ['revenue', 'sales', 'amount', 'price', 'cost', 'profit', 'spend']);
        if (valueCol) {
          const values = data.map(r => parseFloat(String(r[valueCol]).replace(/[^0-9.-]/g, '')) || 0);
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          generatedSql = `SELECT AVG(${valueCol}) as average FROM dataset`;
          result = { average: avg, column: valueCol, operation: 'avg' };
          debugLog('Generated SQL:', generatedSql);
          debugLog('SQL Result:', result);
        } else {
          debugLog('ERROR: No numeric column found for average');
          result = { error: 'No numeric column found', availableColumns: columns };
        }
      }
      // GROUP BY - regions, products, etc with highest/lowest/most
      // DEBUG: Log question parsing for diagnostic purposes
      const has2ndPlace = /2nd|second|3rd|third|4th|fourth|5th|fifth|rank|position|place/i.test(q);
      const hasCountry = /country|nation/i.test(q);
      const hasRegion = /region|area|zone/i.test(q);
      const hasHighest = /highest|top|most|best|first|rank.*1/i.test(q);
      const hasLowest = /lowest|worst|bottom|last|minimum/i.test(q);
      
      debugLog('=== DEBUG: Question Analysis ===');
      debugLog('Has 2nd place keywords:', has2ndPlace);
      debugLog('Has country keywords:', hasCountry);
      debugLog('Has region keywords:', hasRegion);
      debugLog('Has highest keywords:', hasHighest);
      debugLog('Has lowest keywords:', hasLowest);
      debugLog('Question:', q);
      
      if (q.includes('region') || q.includes('country') || q.includes('product') || q.includes('category') ||
               q.includes('highest') || q.includes('lowest') || q.includes('most') || q.includes('top') || q.includes('best')) {
        // Determine grouping column based on USER INTENT, not fixed priority
        let groupCol = findColumn(columns, ['region', 'country', 'product', 'category', 'segment', 'channel']);
        
        // If user specifically asked about country, prioritize country column
        if (hasCountry) {
          const countryCol = findColumn(columns, ['country', 'nation']);
          if (countryCol) groupCol = countryCol;
          debugLog('DEBUG: User asked for country, using column:', groupCol);
        }
        // If user specifically asked about region, prioritize region column  
        if (hasRegion) {
          const regionCol = findColumn(columns, ['region', 'area', 'zone']);
          if (regionCol) groupCol = regionCol;
          debugLog('DEBUG: User asked for region, using column:', groupCol);
        }
        const valueCol = findColumn(columns, ['revenue', 'sales', 'profit', 'amount', 'total']);
        
        if (groupCol && valueCol) {
          const sortDescending = !(hasLowest || q.includes('lowest') || q.includes('worst') || q.includes('bottom') || q.includes('least'));
          const grouped = aggregateData(data, groupCol, valueCol, sortDescending);
          
          // DEBUG: Log the sorted results
          debugLog('DEBUG: Sorted grouped results (first 5):', grouped.slice(0, 5).map((g: any) => `${g.name}: ${g.value}`));
          
          // Determine which position to return based on user question
          let returnIndex = 0; // Default: 1st place
          if (has2ndPlace) {
            // Check for specific ordinal keywords
            if (/2nd|second/.test(q)) returnIndex = 1;  // 2nd position (index 1)
            else if (/3rd|third/.test(q)) returnIndex = 2; // 3rd position (index 2)
            else if (/4th|fourth/.test(q)) returnIndex = 3;
            else if (/5th|fifth/.test(q)) returnIndex = 4;
            else returnIndex = 1; // Default to 2nd for "2nd place" questions
          }
          
          // Ensure we don't go out of bounds
          if (returnIndex >= grouped.length) {
            returnIndex = grouped.length - 1;
          }
          
          const rankedResult = grouped[returnIndex];
          debugLog('DEBUG: Returning position', returnIndex + 1, ':', rankedResult);
          
          generatedSql = `SELECT ${groupCol}, SUM(${valueCol}) as total FROM dataset GROUP BY ${groupCol}`;
          result = { 
            type: 'group_by', 
            groupBy: groupCol, 
            value: valueCol, 
            data: grouped, 
            rankPosition: returnIndex + 1, // 1-based position (1st, 2nd, 3rd, etc.)
            operation: 'group_by' 
          };
          debugLog('Generated SQL:', generatedSql);
          debugLog('SQL Result:', JSON.stringify(grouped).slice(0, 200));
        } else {
          debugLog('ERROR: Could not identify group/value columns');
          result = { error: 'Could not identify columns', groupCol, valueCol, availableColumns: columns };
        }
      }
      // MIN/MAX
      else if (q.includes('minimum') || q.includes('maximum') || q.includes('lowest') || q.includes('highest')) {
        const minMaxCol = findColumn(columns, ['revenue', 'sales', 'profit', 'amount', 'price', 'cost', 'quantity', 'units']);
        if (minMaxCol) {
          const values = data.map(r => parseFloat(String(r[minMaxCol]).replace(/[^0-9.-]/g, '')) || 0);
          const minVal = Math.min(...values);
          const maxVal = Math.max(...values);
          const isMin = q.includes('minimum') || q.includes('lowest');
          generatedSql = `SELECT ${isMin ? 'MIN' : 'MAX'}(${minMaxCol}) as result FROM dataset`;
          result = { [isMin ? 'minimum' : 'maximum']: isMin ? minVal : maxVal, column: minMaxCol, operation: isMin ? 'min' : 'max' };
          debugLog('Generated SQL:', generatedSql);
          debugLog('SQL Result:', result);
        } else {
          debugLog('ERROR: No numeric column found');
          result = { error: 'No numeric column found', availableColumns: columns };
        }
      }
      // PROFIT MARGIN
      else if ((q.includes('profit') || q.includes('margin')) && (q.includes('percent') || q.includes('%'))) {
        const revenueCol = findColumn(columns, ['revenue', 'sales', 'amount', 'order_total', 'total', 'order_value', 'net_revenue']);
        const costCol = findColumn(columns, ['cost', 'unit_cost', 'cogs', 'cost_of_goods']);
        const profitCol = findColumn(columns, ['profit', 'net_profit', 'gross_profit', 'earnings']);
        
        if (revenueCol && (profitCol || costCol)) {
          let totalRevenue = 0;
          let totalCost = 0;
          let totalProfit = 0;
          
          for (const row of data) {
            const revenue = parseFloat(String(row[revenueCol]).replace(/[^0-9.-]/g, '')) || 0;
            totalRevenue += revenue;
            
            if (profitCol) {
              totalProfit += parseFloat(String(row[profitCol]).replace(/[^0-9.-]/g, '')) || 0;
            } else if (costCol) {
              const cost = parseFloat(String(row[costCol]).replace(/[^0-9.-]/g, '')) || 0;
              totalCost += cost;
            }
          }
          
          const finalProfit = profitCol ? totalProfit : totalRevenue - totalCost;
          const margin = totalRevenue > 0 ? (finalProfit / totalRevenue) * 100 : 0;
          
          generatedSql = profitCol
            ? `SELECT (SUM(${profitCol}) / SUM(${revenueCol})) * 100 as margin FROM dataset`
            : `SELECT ((SUM(${revenueCol}) - SUM(${costCol})) / SUM(${revenueCol})) * 100 as margin FROM dataset`;
          result = { 
            profitMargin: margin, 
            revenue: totalRevenue, 
            profit: finalProfit,
            cost: costCol ? totalCost : undefined,
            estimated: false,
            operation: 'margin' 
          };
          debugLog('Generated SQL:', generatedSql);
          debugLog('Margin calculation:', result);
        } else {
          debugLog('ERROR: Could not find revenue column');
          result = {
            error: 'Profit margin requires revenue plus either profit or cost columns',
            availableColumns: columns,
            missingColumns: ['revenue', 'profit or cost'],
          };
        }
      }
      // ROAS CALCULATION
      else if (q.includes('ROAS') || q.includes('roas') || q.includes('return on ad spend')) {
        const revenueCol = findColumn(columns, ['revenue', 'sales', 'amount', 'order_total']);
        const channelCol = findColumn(columns, ['channel', 'utm_source', 'source', 'medium', 'campaign', 'traffic_source']);
        const costCol = findColumn(columns, ['ad_spend', 'advertising_cost', 'marketing_cost', 'spend']);
        
        if (revenueCol && channelCol && costCol) {
          // Group by channel and calculate ROAS
          const channelData: Record<string, { revenue: number; cost: number }> = {};
          
          for (const row of data) {
            const channel = row[channelCol] || 'Unknown';
            const revenue = parseFloat(String(row[revenueCol]).replace(/[^0-9.-]/g, '')) || 0;
            const cost = parseFloat(String(row[costCol]).replace(/[^0-9.-]/g, '')) || 0;
            
            if (!channelData[channel]) {
              channelData[channel] = { revenue: 0, cost: 0 };
            }
            channelData[channel].revenue += revenue;
            channelData[channel].cost += cost;
          }
          
          // Calculate ROAS for each channel
          const roasData = Object.entries(channelData).map(([channel, vals]) => {
            const roas = vals.cost > 0 ? vals.revenue / vals.cost : 0;
            return { channel, revenue: vals.revenue, cost: vals.cost, roas, estimated: false };
          }).sort((a, b) => b.roas - a.roas);
          
          generatedSql = `SELECT ${channelCol}, SUM(${revenueCol}) / SUM(${costCol}) as roas FROM dataset GROUP BY ${channelCol}`;
          result = { type: 'roas_analysis', data: roasData, operation: 'roas' };
          debugLog('ROAS calculation:', result);
        } else {
          result = {
            error: 'ROAS calculation requires revenue, channel, and ad spend columns',
            availableColumns: columns,
            missingColumns: ['revenue', 'channel', 'ad_spend'],
          };
        }
      }
      // Default - try AI for complex queries
      else {
        debugLog('No keyword match, trying AI query generator...');
        let aiExplanation = '';
        try {
          const aiResult = await processQuestion(question, data);
          debugLog('AI Generated SQL:', aiResult.sql);
          debugLog('AI Result:', aiResult.result);
          
          generatedSql = aiResult.sql;
          result = aiResult.result;
          
          // Store AI explanation
          aiExplanation = aiResult.explanation;
          
          // Add explanation to result for debugging
          (result as any).explanation = aiResult.explanation;
        } catch (aiError: any) {
          debugLog('AI Query failed, returning sample:', aiError.message);
          generatedSql = `SELECT * FROM dataset LIMIT 10`;
          result = { sample: data.slice(0, 10), rowCount: data.length, columns, operation: 'sample' };
          aiExplanation = `Dataset has ${result.rowCount} rows with columns: ${result.columns.join(', ')}`;
        }
        
        // Use AI explanation as content
        content = aiExplanation;
      }

      // 5. If SQL execution failed
      if (!generatedSql || !result || result.error) {
        debugLog('ERROR: SQL generation failed:', result?.error);
        return NextResponse.json(
          { 
            error: "Query failed", 
            reason: result?.error || "Could not generate SQL for this question",
            sql: generatedSql || "N/A",
            suggestion: "Try rephrasing your question or select a different dataset"
          },
          { status: 400 }
        );
      }

      // 6. Format response for display (skip if AI already provided explanation)
      const hasAIExplanation = typeof result === 'object' && 'explanation' in result;
      if (!hasAIExplanation) {
        if (result.count !== undefined) {
          content = `The dataset contains ${result.count} rows.`;
        } else if (result.total !== undefined) {
          content = `Total ${result.column}: ${result.total.toLocaleString()}`;
        } else if (result.average !== undefined) {
          content = `Average ${result.column}: ${result.average.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        } else if (result.minimum !== undefined) {
          content = `Minimum ${result.column}: ${result.minimum.toLocaleString()}`;
        } else if (result.maximum !== undefined) {
          content = `Maximum ${result.column}: ${result.maximum.toLocaleString()}`;
        } else if (result.profitMargin !== undefined) {
          content = `Profit margin: ${result.profitMargin.toFixed(2)}%`;
        } else if (result.totalProfit !== undefined) {
          content = `Total computed profit: ${result.totalProfit.toLocaleString()}`;
        } else if (result.data && result.data.length > 0) {
          if (result.type === 'profit_analysis') {
            // Show products with negative profit first
            const rankPos = result.rankPosition || 1;
            const negative = result.data.filter((p: any) => p.profit < 0);
            if (negative.length > 0 && (q.includes('negative') || q.includes('loss'))) {
              const negIndex = rankPos - 1;
              const item = negative[negIndex] || negative[0];
              content = `Product ${item.name} has negative profit: -${Math.abs(item.profit).toLocaleString()}`;
            } else {
              const top = result.data[rankPos - 1];
              const ordinal = rankPos === 1 ? 'highest' : rankPos === 2 ? '2nd highest' : rankPos === 3 ? '3rd highest' : `${rankPos}th highest`;
              content = `${ordinal} profit: ${top.name} with ${top.profit.toLocaleString()}`;
            }
          } else {
            const rankPos = result.rankPosition || 1;
            const top = result.data[rankPos - 1]; // Adjust for 0-based index
            const ordinal = rankPos === 1 ? 'top' : rankPos === 2 ? '2nd' : rankPos === 3 ? '3rd' : `${rankPos}th`;
            content = `${ordinal} ${result.groupBy}: ${top.name} with ${top.value.toLocaleString()} (${top.pct.toFixed(2)}% of total)`;
          }
        } else if (result.sample) {
          content = `Dataset has ${result.rowCount} rows with columns: ${result.columns.join(', ')}`;
        }
      }

      debugLog('========== QUERY REQUEST END ==========');

      return NextResponse.json({
        success: true,
        content,
        datasetId,
        datasetName: dataset.name,
        question,
        sql: generatedSql,
        result,
        // Include AI explanation if available
        explanation: typeof result === 'object' && 'explanation' in result ? (result as any).explanation : undefined,
      });

    } catch (sqlError: any) {
      debugError('SQL Execution error:', sqlError.message);
      return NextResponse.json(
        { 
          error: "Query failed", 
          reason: sqlError.message?.slice(0, 200) || "Unknown error", 
          sql: generatedSql || "N/A" 
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    debugError('Error:', error.message);
    return NextResponse.json(
      { error: "Query failed", reason: error.message?.slice(0, 200) || "Unknown error" },
      { status: 500 }
    );
  }
}

// Debug endpoint
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const datasetId = searchParams.get('datasetId');

  if (!datasetId) {
    return NextResponse.json({ error: 'datasetId query parameter required' }, { status: 400 });
  }

  try {
    const dataset = await db.query.datasets.findFirst({
      where: and(eq(datasets.id, datasetId), eq(datasets.userId, session.user.id)),
    });

    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
    }

    const data = (dataset.data as Record<string, any>[]) || [];
    const columns = (dataset.columns as string[]) || [];
    const sampleRow = data.length > 0 ? data[0] : null;

    return NextResponse.json({
      datasetId: dataset.id,
      name: dataset.name,
      rowCount: data.length,
      columns,
      sampleRow,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
