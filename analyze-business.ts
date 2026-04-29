import { debugLog, debugError, debugWarn } from "./lib/debug"

// Full business analysis - using query builder
import { db } from './lib/db';
import { datasets } from './lib/db/schema';
import { desc } from 'drizzle-orm';

async function main() {
  // Use query builder like the debug script
  const result = await db.query.datasets.findMany({
    orderBy: [desc(datasets.createdAt)],
    limit: 1,
  });
  
  const dataset = result[0];
  
  if (!dataset) {
    debugLog('No dataset found');
    return;
  }
  
  // Data is stored in the JSONB column
  const data = (dataset as any).data || [];
  debugLog('Total rows:', data.length);
  debugLog('Dataset name:', dataset.name);
  
  if (data.length === 0) {
    debugLog('No data in dataset');
    return;
  }
  
  // Revenue by plan
  const revenueByPlan: Record<string, number> = {};
  const customersByPlan: Record<string, number> = {};
  
  data.forEach((row: any) => {
    const plan = row.plan || 'Unknown';
    revenueByPlan[plan] = (revenueByPlan[plan] || 0) + (row.revenue || 0);
    customersByPlan[plan] = (customersByPlan[plan] || 0) + 1;
  });
  
  debugLog('\n=== REVENUE BY PLAN ===');
  Object.entries(revenueByPlan)
    .sort((a: any, b: any) => b[1] - a[1])
    .forEach(([plan, revenue]: [string, number]) => {
      debugLog(`${plan}: $${revenue.toLocaleString()} (${customersByPlan[plan]} customers)`);
    });
  
  // Revenue by region
  const revenueByRegion: Record<string, number> = {};
  data.forEach((row: any) => {
    const region = row.region || 'Unknown';
    revenueByRegion[region] = (revenueByRegion[region] || 0) + (row.revenue || 0);
  });
  
  debugLog('\n=== REVENUE BY REGION ===');
  Object.entries(revenueByRegion)
    .sort((a: any, b: any) => b[1] - a[1])
    .forEach(([region, revenue]: [string, number]) => {
      debugLog(`${region}: $${revenue.toLocaleString()}`);
    });
  
  // Revenue by channel
  const revenueByChannel: Record<string, number> = {};
  data.forEach((row: any) => {
    const channel = row.acquisition_channel || 'Unknown';
    revenueByChannel[channel] = (revenueByChannel[channel] || 0) + (row.revenue || 0);
  });
  
  debugLog('\n=== REVENUE BY ACQUISITION CHANNEL ===');
  Object.entries(revenueByChannel)
    .sort((a: any, b: any) => b[1] - a[1])
    .forEach(([channel, revenue]: [string, number]) => {
      debugLog(`${channel}: $${revenue.toLocaleString()}`);
    });
  
  // Top countries
  const revenueByCountry: Record<string, number> = {};
  data.forEach((row: any) => {
    const country = row.country || 'Unknown';
    revenueByCountry[country] = (revenueByCountry[country] || 0) + (row.revenue || 0);
  });
  
  debugLog('\n=== TOP COUNTRIES BY REVENUE ===');
  Object.entries(revenueByCountry)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([country, revenue]: [string, number]) => {
      debugLog(`${country}: $${revenue.toLocaleString()}`);
    });
  
  // Profit margin by plan
  debugLog('\n=== PROFIT MARGIN BY PLAN ===');
  const profitByPlan: Record<string, { revenue: number; profit: number }> = {};
  data.forEach((row: any) => {
    const plan = row.plan || 'Unknown';
    if (!profitByPlan[plan]) profitByPlan[plan] = { revenue: 0, profit: 0 };
    profitByPlan[plan].revenue += row.revenue || 0;
    profitByPlan[plan].profit += row.profit || 0;
  });
  
  Object.entries(profitByPlan)
    .sort((a: any, b: any) => (b[1].profit/b[1].revenue) - (a[1].profit/a[1].revenue))
    .forEach(([plan, vals]: [string, { revenue: number; profit: number }]) => {
      const margin = (vals.profit / vals.revenue * 100).toFixed(1);
      debugLog(`${plan}: ${margin}% margin (Revenue: $${vals.revenue.toLocaleString()}, Profit: $${vals.profit.toLocaleString()})`);
    });
  
  // Startup stage
  const byStage: Record<string, { revenue: number; count: number }> = {};
  data.forEach((row: any) => {
    const stage = row.startup_stage || 'Unknown';
    if (!byStage[stage]) byStage[stage] = { revenue: 0, count: 0 };
    byStage[stage].revenue += row.revenue || 0;
    byStage[stage].count += 1;
  });
  
  debugLog('\n=== REVENUE BY STARTUP STAGE ===');
  Object.entries(byStage)
    .sort((a: any, b: any) => b[1].revenue - a[1].revenue)
    .forEach(([stage, vals]: [string, { revenue: number; count: number }]) => {
      debugLog(`${stage}: $${vals.revenue.toLocaleString()} (${vals.count} orders)`);
    });
  
  // Totals
  const totalRevenue = data.reduce((sum: number, row: any) => sum + (row.revenue || 0), 0);
  const totalCost = data.reduce((sum: number, row: any) => sum + (row.cost || 0), 0);
  const totalProfit = data.reduce((sum: number, row: any) => sum + (row.profit || 0), 0);
  const totalUsers = data.reduce((sum: number, row: any) => sum + (row.users || 0), 0);
  
  debugLog('\n=== TOTAL METRICS ===');
  debugLog(`Total Revenue: $${totalRevenue.toLocaleString()}`);
  debugLog(`Total Cost: $${totalCost.toLocaleString()}`);
  debugLog(`Total Profit: $${totalProfit.toLocaleString()}`);
  debugLog(`Total Users: ${totalUsers.toLocaleString()}`);
  debugLog(`Overall Margin: ${(totalProfit/totalRevenue*100).toFixed(1)}%`);
  debugLog(`Average Revenue Per Order: $${(totalRevenue/data.length).toFixed(2)}`);
}

main().catch(debugError);
