import { debugError, debugLog, debugWarn } from "@/lib/utils/debug";

// app/api/reports/route.ts
// Report generation and management API

import { auth } from '@/lib/auth/auth';
import { isSuperAdminUserId } from '@/lib/auth/builtin-users';
import { finalizeCredits, isUnlimitedCreditRole, releaseCredits, reserveCredits } from '@/lib/billing/credit-engine';
import { checkSpendingLimits } from '@/lib/billing/credit-account-service';
import { emptyProviderUsage } from '@/lib/billing/provider-usage';
import { checkActionEnforcement, logAiCost } from '@/lib/billing/usage-enforcement';
import { findAccessibleDataset } from '@/lib/data/dataset-access';
import { getDb } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import { buildDatasetReportInput } from '@/lib/reports/dataset-report-builder';
import { deleteReport, findReportByIdempotencyKey, generateReport, getReport, listAllReports, listReports } from '@/lib/reports/report-generator';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import { NextResponse } from 'next/server';

async function getSession() {
  const session = await auth();
  return session?.user?.id ? session : null;
}

async function canAccessDataset(userId: string, role: string | undefined, _email: string | null | undefined, datasetId: string) {
  const hasSuperAdminRole = role === 'superadmin' || role === 'admin' || isSuperAdminUserId(userId)
  if (hasSuperAdminRole) return true;

  const result = await findAccessibleDataset(datasetId, userId, role);
  return Boolean(result.dataset);
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

type ReportCostLogInput = Parameters<typeof logAiCost>[0];

async function safeLogReportAiCost(input: ReportCostLogInput, context: string) {
  try {
    await logAiCost(input);
  } catch (error) {
    debugError('[REPORTS POST] AI cost logging failed:', {
      context,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function POST(request: Request) {
  let operationId: string | null = null;
  let reservationCreated = false;

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
      idempotencyKey: bodyIdempotencyKey,
      ...analysisData 
    } = body;
    const userId = session.user.id;
    const headerIdempotencyKey = request.headers.get('idempotency-key') || request.headers.get('x-idempotency-key');
    const idempotencyKey = String(bodyIdempotencyKey || headerIdempotencyKey || `report:${datasetId || 'missing'}:${crypto.randomUUID()}`);
    
    debugLog('[REPORTS POST] Received request:', { datasetId, datasetName, visibility });
    
    if (!datasetId) {
      return NextResponse.json(
        { success: false, error: 'datasetId is required' },
        { status: 400 }
      );
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
      columns: { role: true, subscriptionTier: true },
    });
    const resolvedRole = session.user.role || profile?.role || (isSuperAdminUserId(userId) ? 'superadmin' : undefined);
    const subscriptionTier = isUnlimitedCreditRole(resolvedRole) ? resolvedRole : profile?.subscriptionTier || 'free';
    const access = await findAccessibleDataset(datasetId, userId, resolvedRole);

    if (access.dbUnavailable) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    if (!access.dataset) {
      return forbidden();
    }

    const existingReport = findReportByIdempotencyKey(datasetId, idempotencyKey);
    if (existingReport) {
      return NextResponse.json({
        success: true,
        reportId: existingReport.id,
        status: existingReport.status || 'ready',
        datasetId: existingReport.datasetId,
        datasetName: existingReport.datasetName,
        reportType: existingReport.reportType,
        businessModel: existingReport.businessModel,
        redirectUrl: `/app/downloads?reportId=${existingReport.id}`,
        downloadUrl: `/api/reports/download?id=${existingReport.id}&format=pdf`,
        excelDownloadUrl: `/api/reports/download?id=${existingReport.id}&format=csv`,
        shareableLink: `/report/${existingReport.id}`,
        visibility: existingReport.visibility,
        createdAt: existingReport.createdAt,
        localTime: existingReport.localTime,
        timezone: existingReport.timezone,
        idempotent: true,
      });
    }

    operationId = `report:${userId}:${idempotencyKey}`;
    const isUnlimited = isUnlimitedCreditRole(resolvedRole) || isSuperAdminUserId(userId);
    if (!isUnlimited) {
      const spendingLimitCheck = await checkSpendingLimits(userId)
      if (spendingLimitCheck.blocked) {
        await safeLogReportAiCost({
          userId,
          subscriptionPlan: subscriptionTier,
          provider: 'system',
          model: 'report-generator',
          actionType: 'report_generation',
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostEur: 0,
          creditsCharged: 0,
          requestStatus: 'blocked',
          errorMessage: spendingLimitCheck.reason,
          datasetId,
        }, 'spending_limit_blocked');
        return NextResponse.json(
          { success: false, error: spendingLimitCheck.reason || 'Spending limit reached.' },
          { status: 402 }
        );
      }
    }

    const reservation = isUnlimited
      ? null
      : await reserveCredits({
          userId,
          operationId,
          idempotencyKey,
          feature: 'report_generation',
          source: 'dashboard',
          role: resolvedRole,
          email: session.user.email ?? null,
          metadata: { datasetId },
        });

    if (reservation && !reservation.success) {
      await safeLogReportAiCost({
        userId,
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
        datasetId,
      }, 'credit_reservation_blocked');
      return NextResponse.json(
        { success: false, error: reservation.error || 'No credits remaining. Please upgrade to generate reports.' },
        { status: 402 }
      );
    }
    reservationCreated = Boolean(reservation);

    const enforcementCheck = await checkActionEnforcement(userId, 'report_generation', resolvedRole, session.user.email ?? null);
    if (!enforcementCheck.allowed) {
      if (reservationCreated && operationId) await releaseCredits(operationId, 'usage_limit_blocked');
      await safeLogReportAiCost({
        userId,
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
        datasetId,
      }, 'usage_limit_blocked');
      return NextResponse.json(
        { success: false, error: enforcementCheck.upgradeMessage || enforcementCheck.reason || 'Your plan has reached a usage limit.' },
        { status: 402 }
      );
    }

    const reportInput = datasetName
      ? {
          ...analysisData,
          rowCount: typeof analysisData.rowCount === 'number' ? analysisData.rowCount : access.dataset.rowCount || 0,
          columns: Array.isArray(analysisData.columns) ? analysisData.columns : (Array.isArray(access.dataset.columns) ? access.dataset.columns : []),
        }
      : await buildDatasetReportInput(access.dataset);
    
    const report = await generateReport(
      datasetId,
      datasetName || access.dataset.name,
      {
        visibility,
        includePredictions,
        includeAlerts,
        timezone,
        timezoneOffset,
        status: 'ready',
        reportType: reportInput.reportType,
        businessModel: reportInput.businessModel,
        userId,
        workspaceId: userId,
        idempotencyKey,
      },
      reportInput
    );

    let creditsRemaining: number | null = null;
    if (reservationCreated && operationId) {
      const deduction = await finalizeCredits({
        operationId,
        actualCredits: reservation?.reservedCredits,
        actualUsage: emptyProviderUsage('system', 'report-generator'),
        metadata: {
          datasetId,
          reportId: report.id,
          reportType: report.reportType,
          businessModel: report.businessModel,
        },
      });

      if (!deduction.success) {
        await releaseCredits(operationId, 'report_charge_failed');
        deleteReport(report.id);
        return NextResponse.json({ success: false, error: deduction.error || 'Unable to finalize report credits.' }, { status: 402 });
      }

      creditsRemaining = deduction.remainingCredits;
    }

    await safeLogReportAiCost({
      userId,
      subscriptionPlan: subscriptionTier,
      provider: 'system',
      model: 'report-generator',
      actionType: 'report_generation',
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostEur: 0,
      creditsCharged: reservation?.reservedCredits || 0,
      requestStatus: 'success',
      datasetId,
      metadata: { reportId: report.id, businessModel: report.businessModel, reportType: report.reportType },
    }, 'report_generated');
    
    debugLog('[REPORTS POST] Generated report:', report.id);
    
    return NextResponse.json({
      success: true,
      reportId: report.id,
      status: report.status || 'ready',
      datasetId: report.datasetId,
      datasetName: report.datasetName,
      reportType: report.reportType,
      businessModel: report.businessModel,
      redirectUrl: `/app/downloads?reportId=${report.id}`,
      downloadUrl: `/api/reports/download?id=${report.id}&format=pdf`,
      excelDownloadUrl: `/api/reports/download?id=${report.id}&format=csv`,
      shareableLink: `/report/${report.id}`,
      visibility: report.visibility,
      createdAt: report.createdAt,
      localTime: report.localTime,
      timezone: report.timezone,
      creditsRemaining,
    });
    
  } catch (error) {
    if (reservationCreated && operationId) {
      await releaseCredits(operationId, 'report_generation_failed');
    }
    debugError(
      '[REPORTS POST] Error:',
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error.stack : undefined,
    );
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
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
