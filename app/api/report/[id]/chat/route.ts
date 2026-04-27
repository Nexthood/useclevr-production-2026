// app/api/report/[id]/chat/route.ts
// Interactive AI chat for report pages - only uses report snapshot context

import { NextResponse } from 'next/server';
import { getReport } from '@/lib/report-generator';
import { answerReportQuestion } from '@/lib/report-ai-chat';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { question } = await request.json();
    
    if (!question) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }
    
    console.log('[REPORT-CHAT] Question for report:', id);
    
    // Get the report
    const report = getReport(id);
    
    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }
    
    // Answer question using only report context
    const result = await answerReportQuestion(report, question);
    
    return NextResponse.json({
      success: true,
      response: result.response,
      sources: result.sources
    });
    
  } catch (error: any) {
    console.error('[REPORT-CHAT] Error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
