/**
 * Driver Display Component
 * Shows the main drivers behind business metric changes
 */

"use client";

import React from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowRight, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DriverDetectionResult, MetricDriver, DriverContribution } from '@/lib/pipeline-types';

interface DriverDisplayProps {
  drivers: DriverDetectionResult;
  showDetails?: boolean;
}

export function DriverDisplay({ drivers, showDetails = true }: DriverDisplayProps) {
  if (!drivers || drivers.drivers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      {drivers.summary && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-500">Key Findings</h4>
              <p className="text-sm text-amber-400/80 mt-1">{drivers.summary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Driver Cards */}
      {drivers.drivers.map((driver, index) => (
        <DriverCard key={driver.metric} driver={driver} showDetails={showDetails} />
      ))}
    </div>
  );
}

function DriverCard({ driver, showDetails }: { driver: MetricDriver; showDetails: boolean }) {
  const directionIcon = driver.direction === 'up' 
    ? <TrendingUp className="h-5 w-5 text-emerald-500" />
    : driver.direction === 'down'
    ? <TrendingDown className="h-5 w-5 text-red-500" />
    : <Minus className="h-5 w-5 text-neutral-500" />;

  const directionColor = driver.direction === 'up'
    ? 'text-emerald-500'
    : driver.direction === 'down'
    ? 'text-red-500'
    : 'text-neutral-500';

  const metricLabel = {
    revenue: 'Revenue',
    profit: 'Profit',
    margin: 'Margin',
    growth: 'Growth Rate',
  }[driver.metric] || driver.metric;

  const significanceBadge = {
    high: { label: 'High Impact', color: 'bg-red-500/20 text-red-400' },
    medium: { label: 'Medium Impact', color: 'bg-amber-500/20 text-amber-400' },
    low: { label: 'Low Impact', color: 'bg-neutral-500/20 text-neutral-400' },
  }[driver.significance];

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {directionIcon}
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              {metricLabel}
              <span className={`text-sm font-normal ${directionColor}`}>
                {driver.changePercent >= 0 ? '+' : ''}{driver.changePercent.toFixed(1)}%
              </span>
            </CardTitle>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${significanceBadge.color}`}>
            {significanceBadge.label}
          </span>
        </div>
      </CardHeader>
      
      {showDetails && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            {driver.drivers.slice(0, 5).map((d, idx) => (
              <DriverRow key={idx} driver={d} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function DriverRow({ driver }: { driver: DriverContribution }) {
  const isNegative = driver.value < 0;
  const contributionColor = isNegative ? 'text-red-400' : 'text-emerald-400';
  
  const typeLabel = {
    region: 'Region',
    product: 'Product',
    category: 'Category',
    time_period: 'Period',
    customer_segment: 'Segment',
  }[driver.type] || driver.type;

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-1.5 h-1.5 rounded-full ${isNegative ? 'bg-red-500' : 'bg-emerald-500'}`} />
        <div>
          <span className="text-sm text-muted-foreground">{typeLabel}:</span>
          <span className="text-sm text-foreground ml-1">{driver.name}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-medium ${contributionColor}`}>
          {driver.percentage >= 0 ? '+' : ''}{driver.percentage.toFixed(1)}%
        </span>
        {isNegative && <TrendingDown className="h-3 w-3 text-red-500" />}
        {!isNegative && driver.value > 0 && <TrendingUp className="h-3 w-3 text-emerald-500" />}
      </div>
    </div>
  );
}

/**
 * Compact driver summary for inline display
 */
export function DriverSummary({ drivers }: { drivers: DriverDetectionResult }) {
  if (!drivers || drivers.drivers.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {drivers.drivers.slice(0, 3).map((driver) => {
        const topDriver = driver.drivers[0];
        if (!topDriver) return null;

        const isNegative = driver.direction === 'down';
        
        return (
          <div
            key={driver.metric}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              isNegative 
                ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}
          >
            {isNegative ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <TrendingUp className="h-3 w-3" />
            )}
            <span className="capitalize">{driver.metric}</span>
            <ArrowRight className="h-3 w-3 opacity-50" />
            <span className="font-medium">{topDriver.name}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Negative drivers highlight component
 */
export function NegativeDriversHighlight({ drivers }: { drivers: DriverDetectionResult }) {
  const negatives = drivers.drivers
    .filter(d => d.direction === 'down')
    .flatMap(d => d.drivers.filter(dr => dr.value < 0));

  if (negatives.length === 0) {
    return null;
  }

  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <h4 className="font-medium text-red-400 text-sm">Areas Requiring Attention</h4>
      </div>
      <div className="space-y-1">
        {negatives.slice(0, 5).map((driver, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm">
            <span className="text-neutral-300">
              {driver.name} ({driver.type})
            </span>
            <span className="text-red-400 font-medium">
              {driver.percentage.toFixed(1)}% contribution
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
