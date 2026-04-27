/**
 * Insight Chart Component
 * 
 * Renders charts based on insight data using Recharts.
 * Supports BarChart, LineChart, PieChart, and AreaChart.
 */

"use client";

import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';

interface InsightChartProps {
  data: { name: string; value: number }[];
  chartType?: 'bar' | 'line' | 'pie' | 'area' | 'auto';
  title?: string;
  height?: number;
  // Compact, card-friendly rendering: minimal chrome, no intrusive tooltip, no rotated labels
  compact?: boolean;
}

// Color palette
const COLORS = [
  '#a855f7', // Purple (primary)
  '#10b981', // Green
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
];

export function InsightChart({ 
  data, 
  chartType = 'bar',
  title,
  height = 300,
  compact = false,
}: InsightChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No data available for visualization
      </div>
    );
  }

  // Format large numbers
  const formatValue = (value: number): string => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toFixed(2);
  };

  // Calculate total for percentage
  const total = data.reduce((sum, item) => sum + item.value, 0);

  // Calculate left margin based on longest label
  const maxLabelLength = Math.max(...data.map(d => d.name.length));
  const leftMargin = Math.max(100, maxLabelLength * 8);

  // Custom tooltip with premium dark mode styling
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const share = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
      return (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 shadow-xl">
          <p className="font-semibold text-white text-sm mb-1">{label}</p>
          <p className="text-purple-400 font-medium">
            {formatValue(value)}
          </p>
          <p className="text-zinc-400 text-xs mt-1">
            {share}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  // Render based on chart type
  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return (
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis 
              tickFormatter={formatValue}
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#a855f7" 
              strokeWidth={2}
              dot={{ fill: '#a855f7', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              name="Value"
            />
          </LineChart>
        );

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(2)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        );

      case 'area':
        return (
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis 
              tickFormatter={formatValue}
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#a855f7" 
              fillOpacity={1} 
              fill="url(#colorValue)"
              name="Value"
            />
          </AreaChart>
        );

      case 'bar':
      default:
        if (compact) {
          // Compact, vertical layout: readable labels, no tooltip/legend, minimal chrome
          return (
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 80, bottom: 8 }}>
              {/* No grid for minimal look */}
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={80}
                tick={{ fontSize: 11, fill: '#a1a1aa' }}
              />
              {/* Tooltip/Legend removed to avoid intrusive hover UI in one-pager */}
              <Bar dataKey="value" radius={[4, 4, 4, 4]} barSize={18}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          );
        }
        return (
          <BarChart data={data} margin={{ top: 10, right: 30, left: leftMargin, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 11, fill: '#a1a1aa' }}
              stroke="hsl(var(--muted-foreground))"
              angle={-45}
              textAnchor="end"
              height={70}
              interval={0}
              minTickGap={40}
            />
            <YAxis 
              tickFormatter={formatValue}
              tick={{ fontSize: 11, fill: '#a1a1aa' }}
              stroke="hsl(var(--muted-foreground))"
              width={70}
            />
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} name="Revenue" barSize={32}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        );
    }
  };

  // Determine best chart type based on data
  const getChartType = (): 'bar' | 'line' | 'pie' | 'area' => {
    if (chartType && chartType !== 'auto') return chartType;
    
    // If data has many points, use line
    if (data.length > 10) return 'line';
    
    // If data is categorical with few items, use bar
    if (data.length <= 10) return 'bar';
    
    return 'bar';
  };

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold mb-4 text-foreground">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Determine chart type from question and data
 */
export function suggestChartType(question: string, data: { name: string; value: number }[]): 'bar' | 'line' | 'pie' | 'area' {
  const q = question.toLowerCase();
  
  // Trends over time
  if (q.includes('trend') || q.includes('over time') || q.includes('period') || q.includes('month') || q.includes('year')) {
    return 'line';
  }
  
  // Distribution
  if (q.includes('distribution') || q.includes('breakdown') || q.includes('share')) {
    return 'pie';
  }
  
  // Growth
  if (q.includes('growth') || q.includes('increase') || q.includes('accumulated')) {
    return 'area';
  }
  
  // Default to bar for comparisons
  return 'bar';
}
