import { debugError, debugLog, debugWarn } from "@/lib/utils/debug";

// app/api/reports/route.ts
// Report generation and management API

import { auth } from '@/lib/auth/auth';
import { isSuperAdminUserId } from '@/lib/auth/builtin-users';
import { finalizeCredits, isUnlimitedCreditRole, releaseCredits, reserveCredits } from '@/lib/billing/credit-engine';
import { emptyProviderUsage } from '@/lib/billing/provider-usage';
import { checkActionEnforcement, logAiCost } from '@/lib/billing/usage-enforcement';
import { findAccessibleDataset } from '@/lib/data/dataset-access';
import { getDb } from '@/lib/db';
import { profiles, datasets } from '@/lib/db/schema';
import { buildDatasetReportInput } from '@/lib/reports/dataset-report-builder';
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
    
    if (!datasetId) {
      return NextResponse.json(
        { error: 'datasetId is required' },
        { status: 400 }
      );
    }

    if (!(await canAccessDataset(session.user.id, session.user.role, session.user.email, datasetId))) {
      return forbidden();
    }

    const idempotencyKey = request.headers.get('idempotency-key') || (typeof body.idempotencyKey === 'string' ? body.idempotencyKey : null);
    if (idempotencyKey) {
      const existing = listReports(datasetId).find((report) => report.idempotencyKey === idempotencyKey);
      if (existing) {
        return NextResponse.json({
          success: true,
          reportId: existing.id,
          status: existing.status || 'ready',
          shareableLink: `/report/${existing.id}`,
          redirectUrl: `/app/reports/${existing.id}`,
          downloadUrl: `/api/reports/download?id=${existing.id}&format=pdf`,
          downloadsUrl: '/app/downloads',
          previewUrl: `/report/${existing.id}`,
          idempotent: true,
        });
      }
    }

    const role = session.user.role ?? null;
    const isUnlimited = isUnlimitedCreditRole(role);
    const operationId = `report:${session.user.id}:${idempotencyKey || crypto.randomUUID()}`;
    const profile = await getDb()?.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
      columns: { subscriptionTier: true },
    }).catch(() => null);
    const subscriptionTier = isUnlimited ? role || 'superadmin' : profile?.subscriptionTier || 'free';
    const reservation = isUnlimited
      ? null
      : await reserveCredits({
          userId: session.user.id,
          operationId,
          idempotencyKey: operationId,
          estimatedCredits: 1,
          feature: 'report_generation',
          source: 'api',
          role,
          email: session.user.email ?? null,
          metadata: { datasetId },
        });

    if (reservation && !reservation.success) {
      await logAiCost({
        userId: session.user.id,
        subscriptionPlan: subscriptionTier,
        provider: 'system',
        model: 'report-generator',
        actionType: 'report_generation',
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostEur: 0,
        creditsCharged: 0,
        requestStatus: 'blocked',
        errorMessage: reservation.error,
      });
      return NextResponse.json({ success: false, error: reservation.error || 'No credits remaining. Please upgrade to generate reports.' }, { status: 402 });
    }

    const enforcementCheck = await checkActionEnforcement(session.user.id, 'report_generation', role, session.user.email ?? null);
    if (!enforcementCheck.allowed) {
      if (reservation) await releaseCredits(operationId, 'usage_limit_blocked');
      await logAiCost({
        userId: session.user.id,
        subscriptionPlan: subscriptionTier,
        provider: 'system',
        model: 'report-generator',
        actionType: 'report_generation',
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostEur: 0,
        creditsCharged: 0,
        requestStatus: 'blocked',
        errorMessage: enforcementCheck.reason,
      });
      return NextResponse.json({ success: false, error: enforcementCheck.upgradeMessage || enforcementCheck.reason || 'Your plan has reached a usage limit.' }, { status: 402 });
    }

    let report;
    try {
      let reportInput = analysisData;
      let resolvedDatasetName = datasetName;
      if (!resolvedDatasetName || !analysisData.rowCount || !Array.isArray(analysisData.columns)) {
        const access = await findAccessibleDataset(datasetId, session.user.id, session.user.role);
        if (access.dbUnavailable) {
          if (reservation) await releaseCredits(operationId, 'database_unavailable');
          return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
        }
        if (!access.dataset) {
          if (reservation) await releaseCredits(operationId, 'dataset_not_found');
          return NextResponse.json({ success: false, error: 'Dataset not found' }, { status: 404 });
        }
        resolvedDatasetName = access.dataset.name;
        reportInput = await buildDatasetReportInput(access.dataset);
      }

      report = await generateReport(
        datasetId,
        resolvedDatasetName,
        { visibility, includePredictions, includeAlerts, timezone, timezoneOffset },
        {
          ...reportInput,
          status: 'ready',
          idempotencyKey: idempotencyKey || undefined,
          userId: session.user.id,
          workspaceId: null,
        }
      );
    } catch (generationError) {
      if (reservation) await releaseCredits(operationId, 'report_generation_failed');
      throw generationError;
    }

    if (reservation) {
      const settlement = await finalizeCredits({
        operationId,
        actualCredits: 1,
        actualUsage: emptyProviderUsage('system', 'report-generator'),
        metadata: { datasetId, reportId: report.id },
      });
      if (!settlement.success) {
        await releaseCredits(operationId, 'report_charge_failed');
        return NextResponse.json({ success: false, error: settlement.error || 'Unable to finalize report credits.' }, { status: 402 });
      }
    }
    
    debugLog('[REPORTS POST] Generated report:', report.id);
    
    return NextResponse.json({
      success: true,
      reportId: report.id,
      status: report.status || 'ready',
      shareableLink: `/report/${report.id}`,
      redirectUrl: `/app/reports/${report.id}`,
      previewUrl: `/report/${report.id}`,
      downloadUrl: `/api/reports/download?id=${report.id}&format=pdf`,
      excelDownloadUrl: `/api/reports/download?id=${report.id}&format=csv`,
      downloadsUrl: '/app/downloads',
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
