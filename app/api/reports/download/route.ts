/**
 * Download Report API Route
 * 
 * Generates downloadable reports (PDF/CSV) for analysis results
 * GET: Download a specific report by ID
 * POST: Generate CSV from analysis data (legacy)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getReport } from '@/lib/report-generator'
import type { Report, ReportChart } from '@/lib/report-generator'
import * as fs from 'fs'
import * as path from 'path'

// GET handler - Download a specific report by ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get('id')
    const format = searchParams.get('format') || 'pdf'

    if (!reportId) {
      return NextResponse.json(
        { success: false, error: 'Report ID is required' },
        { status: 400 }
      )
    }

    // Fetch the report from storage
    const report = getReport(reportId)
    
    if (!report) {
      return NextResponse.json(
        { success: false, error: 'Report not found. It may have expired or been deleted.' },
        { status: 404 }
      )
    }

    // Default to PDF if available
    const usePdf = format === 'pdf' || format === 'csv';
    
    // Check if PDF exists
    if (report.pdfPath && fs.existsSync(report.pdfPath)) {
      const fileBuffer = fs.readFileSync(report.pdfPath)
      const filename = report.pdfFilename || `${report.datasetName.replace(/[^a-z0-9]/gi, '_')}_report_${report.id}.pdf`
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }
    
    // Fallback to CSV if no PDF
    console.log('[DOWNLOAD] No PDF found, generating CSV');
    const csvContent = generateReportCSV(report)
    const filename = `${report.datasetName.replace(/[^a-z0-9]/gi, '_')}_report_${report.id}.csv`
    
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

  } catch (error) {
    console.error('[DOWNLOAD] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to download report' },
      { status: 500 }
    )
  }
}

// POST handler - Legacy: Generate CSV from analysis data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { analysisData, format = 'csv' } = body

    if (!analysisData) {
      return NextResponse.json(
        { success: false, error: 'Analysis data is required' },
        { status: 400 }
      )
    }

    // Generate report based on format
    if (format === 'csv') {
      const csvContent = generateCSV(analysisData)
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="analysis-report-${Date.now()}.csv"`,
        },
      })
    }

    // For PDF, we'd typically use a library like puppeteer or jsPDF
    // For simplicity, returning CSV format
    return NextResponse.json({
      success: false,
      error: 'PDF generation not implemented. Please use CSV format.',
    })

  } catch (error) {
    console.error('[DOWNLOAD] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}

/**
 * Generate CSV from a stored Report object
 */
function generateReportCSV(report: Report): string {
  const lines: string[] = []
  
  // Header
  lines.push('# ANALYSIS REPORT')
  lines.push(`# Dataset: ${report.datasetName}`)
  lines.push(`# Generated: ${report.localTime} (${report.timezone})`)
  lines.push(`# Report ID: ${report.id}`)
  lines.push('')
  
  // Summary section
  lines.push('# EXECUTIVE SUMMARY')
  lines.push(report.summary || 'No summary available.')
  lines.push('')
  
  // KPIs section
  if (report.kpis && report.kpis.length > 0) {
    lines.push('# KEY PERFORMANCE INDICATORS')
    for (const kpi of report.kpis) {
      lines.push(`${kpi.title}: ${kpi.value}`)
    }
    lines.push('')
  }
  
  // Findings / Recommendations
  if (report.findings && report.findings.length > 0) {
    lines.push('# KEY FINDINGS & RECOMMENDATIONS')
    for (let i = 0; i < report.findings.length; i++) {
      lines.push(`${i + 1}. ${report.findings[i]}`)
    }
    lines.push('')
  }
  
  // AI Insights
  if (report.aiInsights && report.aiInsights.length > 0) {
    lines.push('# AI INSIGHTS')
    for (const insight of report.aiInsights) {
      lines.push(`- ${insight}`)
    }
    lines.push('')
  }
  
  // Alerts
  if (report.alerts && report.alerts.length > 0) {
    lines.push('# ALERTS & NOTIFICATIONS')
    for (const alert of report.alerts) {
      lines.push(`[${alert.severity.toUpperCase()}] ${alert.type}: ${alert.message}`)
    }
    lines.push('')
  }
  
  // Charts data
  if (report.charts && report.charts.length > 0) {
    for (const chart of report.charts) {
      lines.push(`# ${chart.title.toUpperCase()}`)
      lines.push('Name,Value')
      for (const dataPoint of chart.data) {
        lines.push(`${escapeCSV(dataPoint.name)},${dataPoint.value}`)
      }
      lines.push('')
    }
  }
  
  // Metadata
  lines.push('# METADATA')
  lines.push(`Total Rows: ${report.rowCount}`)
  lines.push(`Total Columns: ${report.columnCount}`)
  lines.push(`Visibility: ${report.visibility}`)
  lines.push(`Created: ${report.createdAt}`)
  
  return lines.join('\n')
}

/**
 * Escape a value for CSV format
 */
function escapeCSV(value: string | number): string {
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Legacy CSV generation from analysis data
 */
function generateCSV(data: any): string {
  const lines: string[] = []
  
  // Add header info
  lines.push('# Analysis Report')
  lines.push(`# Generated: ${new Date().toISOString()}`)
  lines.push('')

  // Add insight
  if (data.insight) {
    lines.push('# Insight')
    lines.push(data.insight)
    lines.push('')
  }

  // Add explanation
  if (data.explanation) {
    lines.push('# Explanation')
    lines.push(data.explanation)
    lines.push('')
  }

  // Add recommendation
  if (data.recommendation) {
    lines.push('# Recommendation')
    lines.push(data.recommendation)
    lines.push('')
  }

  // Add data table
  if (data.data && Array.isArray(data.data) && data.data.length > 0) {
    const columns = Object.keys(data.data[0])
    
    // Header row
    lines.push('# Data')
    lines.push(columns.join(','))
    
    // Data rows
    for (const row of data.data) {
      const values = columns.map(col => {
        const value = row[col]
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value ?? ''
      })
      lines.push(values.join(','))
    }
  }

  return lines.join('\n')
}
