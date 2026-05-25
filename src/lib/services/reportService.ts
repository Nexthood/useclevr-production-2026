/**
 * Report service - handles report generation orchestration
 * P-292: Service layer extraction for report generation
 */

import * as reportGenerator from '../reports/report-generator'

export class ReportService {
  async generateDatasetReport(datasetId: string, options: Record<string, unknown>) {
    return reportGenerator.generateReport(datasetId, '', options, { rowCount: 0, columns: [] })
  }

  async getReportStatus(reportId: string) {
    return reportGenerator.getReport(reportId)
  }
}

export const reportService = new ReportService()