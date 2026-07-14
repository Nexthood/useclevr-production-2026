import { debugError, debugLog, debugWarn } from "@/lib/utils/debug";

// app/api/reports/route.ts
// Report generation and management API

import { auth } from '@/lib/auth/auth';
import { isSuperAdminUserId } from '@/lib/auth/builtin-users';
import { getDb } from '@/lib/db';
import { datasets } from '@/lib/db/schema';
import { deleteReport, generateReport, getReport, listAllReports, listReports } from '@/lib/reports/report-generator';
import { and, eq } from 'drizzle-orm';
import * as fs from 'fs';
import { NextResponse } from 'next/server';

async function getSession() {
  const session = await auth();
  return session?.user?.id ? session : null;
}

async function canAccessDataset(userId: string, role: string | undefined, _email: string | null | undefined, datasetId: string) {
  const hasSuperAdminRole = role === 'superadmin' || role === 'admin' || isSuperAdminUserId(userId)
  if (hasSuperAdminRole) return true;

  const db = getDb();
  if (!db) return false;

  const dataset = await db.query.datasets.findFirst({
    where: and(eq(datasets.id, datasetId), eq(datasets.userId, userId)),
    columns: { id: true },
  });

  return Boolean(dataset);
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = await request.json();
    const { 
      datasetId, 
      datasetName, 
      visibility = 'private',
      includePredictions = true,
      includeAlerts = true,
      timezone,
      timezoneOffset,
      ...analysisData 
    } = body;
    
    debugLog('[REPORTS POST] Received request:', { datasetId, datasetName, visibility });
    
    if (!datasetId || !datasetName) {
      return NextResponse.json(
        { error: 'datasetId and datasetName are required' },
        { status: 400 }
      );
    }

    if (!(await canAccessDataset(session.user.id, session.user.role, session.user.email, datasetId))) {
      return forbidden();
    }
    
    const report = await generateReport(
      datasetId,
      datasetName,
      { visibility, includePredictions, includeAlerts, timezone, timezoneOffset },
      analysisData
    );
    
    debugLog('[REPORTS POST] Generated report:', report.id);
    
    return NextResponse.json({
      success: true,
      reportId: report.id,
      shareableLink: `/report/${report.id}`,
      visibility: report.visibility,
      createdAt: report.createdAt,
      localTime: report.localTime,
      timezone: report.timezone
    });
    
  } catch (error: any) {
    debugError('[REPORTS POST] Error:', error.message, error.stack);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  const datasetId = searchParams.get('datasetId');
  const listAll = searchParams.get('list');
  
  debugLog('[REPORTS API] GET called with:', { datasetId, listAll });
  
  // If list=true, return all reports
  if (listAll === 'true') {
    try {
      const allReports = listAllReports()
      const reports = []

      for (const report of allReports) {
        if (await canAccessDataset(session.user.id, session.user.role, session.user.email, report.datasetId)) {
          reports.push(report)
        }
      }

      debugLog('[REPORTS API] Returning all reports:', reports.length);
      return NextResponse.json({ reports });
    } catch (err) {
      debugError('[REPORTS API] Error listing reports:', err);
      return NextResponse.json({ reports: [], error: 'Failed to load reports' }, { status: 500 });
    }
  }
  
  if (datasetId) {
    if (!(await canAccessDataset(session.user.id, session.user.role, session.user.email, datasetId))) {
      return forbidden();
    }

    const reports = listReports(datasetId);
    return NextResponse.json({ reports });
  }
  
  return NextResponse.json({ error: 'datasetId required' }, { status: 400 });
}

// DELETE /api/reports?id=<reportId>
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const report = getReport(id)
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    if (!(await canAccessDataset(session.user.id, session.user.role, session.user.email, report.datasetId))) {
      return forbidden()
    }

    // Attempt to remove generated PDF file if present
    try {
      if (report.pdfPath && fs.existsSync(report.pdfPath)) {
        fs.unlinkSync(report.pdfPath)
      }
    } catch (fileErr) {
      debugWarn('[REPORTS DELETE] Failed to delete PDF file:', fileErr)
      // Continue; metadata should still be removed
    }

    const deleted = deleteReport(id)
    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    debugError('[REPORTS DELETE] Error:', err?.message || err)
    return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 })
  }
}
