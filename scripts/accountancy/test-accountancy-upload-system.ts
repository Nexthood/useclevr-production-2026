import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import {
  AccountancyUploadError,
  parseAccountancyUploadBuffer,
  validateAccountancyUpload,
  type AccountancyUploadMeta,
  type AccountancyUploadType,
} from "../../src/lib/accountancy/upload-processing";
import {
  categorizePrebookkeepingRows,
  normalizePrebookkeepingCategorization,
} from "../../src/lib/accountancy/prebookkeeping-categorization";
import { answerPrebookkeepingQuestionDeterministically } from "../../src/lib/accountancy/prebookkeeping-ai-assistant";
import { buildPrebookkeepingExport, PrebookkeepingExportError } from "../../src/lib/accountancy/prebookkeeping-export";

const baseMeta = (uploadType: AccountancyUploadType, fileName: string, mimeType: string): AccountancyUploadMeta => ({
  fileName,
  mimeType,
  size: 100,
  uploadType,
  datasetType: "prebookkeeping",
});

async function run() {
  await testCommaCsv();
  await testSemicolonCsv();
  await testExcel();
  await testLegacyXls();
  await testMultiSheetExcel();
  await testExcelRejectsNonTabularFirstSheet();
  await testExcelMergedFormattedHeaderRows();
  await testSpreadsheetExportVariants();
  await testExcelNoValidSheetExplainsRejectedSheets();
  await testTextPdfInvoice();
  await testScannedPdf();
  await testImageReceipts();
  await testCsvBankExport();
  await testXlsxBankExport();
  await testXlsBankExport();
  await testOfxBankExport();
  await testQifBankExport();
  await testQfxBankExport();
  testPrebookkeepingCategorization();
  testPrebookkeepingExports();
  testPrebookkeepingAssistantFallback();
  testLegacyCategorizationReviewSummaryNormalization();
  testMalformedLegacyTransactionNormalization();
  testTwoHundredRowLedgerCategorization();
  testUnsupportedFiles();
  testUiWiring();
  testApiRouteWiring();
  console.log("Accountancy upload system regression tests passed.");
}

async function testCommaCsv() {
  const parsed = await parseAccountancyUploadBuffer(
    Buffer.from("date,description,amount\n2026-01-01,Software,12.50\n"),
    baseMeta("csv", "ledger.csv", "text/csv"),
  );
  assert.equal(parsed.route, "accountancy_csv_parser");
  assert.deepEqual(parsed.columns, ["date", "description", "amount"]);
  assert.equal(parsed.rowCount, 1);
}

async function testSemicolonCsv() {
  const parsed = await parseAccountancyUploadBuffer(
    Buffer.from("\uFEFFdate;description;amount\r\n2026-01-01;Office;12,50\r\n"),
    baseMeta("csv", "ledger.csv", "application/vnd.ms-excel"),
  );
  assert.equal(parsed.route, "accountancy_csv_parser");
  assert.deepEqual(parsed.columns, ["date", "description", "amount"]);
  assert.match(parsed.warnings.join(" "), /Detected ; delimiter/);
}

async function testExcel() {
  const parsed = await parseAccountancyUploadBuffer(
    workbookBuffer([["date", "description", "amount"], ["2026-01-01", "Software", 12.5]]),
    baseMeta("excel", "ledger.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
  );
  assert.equal(parsed.route, "accountancy_excel_workbook_parser");
  assert.equal(parsed.selectedSheet, "Sheet1");
  assert.equal(parsed.rowCount, 1);
  assert.deepEqual(parsed.columns, ["date", "description", "amount"]);
}

async function testLegacyXls() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Notes"], ["not data"]]), "Read me");
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["transaction_date", "description", "debit", "credit", "currency", "balance", "reference"],
      ["2026-01-01", "Office rent", 120, "", "EUR", 880, "INV-1"],
      ["2026-01-02", "Customer payment", "", 250, "EUR", 1130, "INV-2"],
    ]),
    "Ledger",
  );

  const parsed = await parseAccountancyUploadBuffer(
    XLSX.write(workbook, { type: "buffer", bookType: "xls" }) as Buffer,
    baseMeta("excel", "ledger.xls", "application/vnd.ms-excel"),
  );

  assert.equal(parsed.route, "accountancy_excel_workbook_parser");
  assert.equal(parsed.selectedSheet, "Ledger");
  assert.equal(parsed.rowCount, 2);
  assert.deepEqual(parsed.columns, ["transaction_date", "description", "debit", "credit", "currency", "balance", "reference"]);
}

async function testMultiSheetExcel() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Notes"], ["empty"]]), "Notes");
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Bank Export"],
      ["Generated"],
      ["date", "description", "amount"],
      ["2026-01-01", "Deposit", 100],
      ["2026-01-02", "Fee", -5],
    ]),
    "Transactions",
  );
  const parsed = await parseAccountancyUploadBuffer(
    XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer,
    baseMeta("excel", "multi.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
  );
  assert.equal(parsed.selectedSheet, "Transactions");
  assert.equal(parsed.rowCount, 2);
  assert.deepEqual(parsed.columns, ["date", "description", "amount"]);
}

async function testExcelRejectsNonTabularFirstSheet() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Accounting export"],
      ["Generated by finance"],
      ["No tabular data on this sheet"],
    ]),
    "Read me",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Client", "Invoice", "Amount"],
      ["ACME", "INV-1", 125],
      ["Beta", "INV-2", 230],
    ]),
    "Generic table",
  );

  const parsed = await parseAccountancyUploadBuffer(
    XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer,
    baseMeta("excel", "generic-table.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
  );

  assert.equal(parsed.selectedSheet, "Generic table");
  assert.deepEqual(parsed.columns, ["Client", "Invoice", "Amount"]);
  assert.match(parsed.warnings.join(" "), /Rejected worksheet "Read me"/);
}

async function testExcelMergedFormattedHeaderRows() {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Company XYZ", "", ""],
    ["Sales Report", "", ""],
    ["Customer", "Invoice", "Amount"],
    ["ACME", "INV-1", 125],
  ]);
  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Formatted");

  const parsed = await parseAccountancyUploadBuffer(
    XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer,
    baseMeta("excel", "formatted.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
  );

  assert.equal(parsed.selectedSheet, "Formatted");
  assert.deepEqual(parsed.columns, ["Customer", "Invoice", "Amount"]);
  assert.equal(parsed.rowCount, 1);
}

async function testSpreadsheetExportVariants() {
  const variants = [
    ["excel-export.xlsx", "Excel Export"],
    ["google-sheets-export.xlsx", "Google Sheets Export"],
    ["libreoffice-export.xlsx", "LibreOffice Export"],
  ] as const;

  for (const [fileName, sheetName] of variants) {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Account", "Reference", "Value"],
        ["Sales", "REF-1", 100],
      ]),
      sheetName,
    );
    const parsed = await parseAccountancyUploadBuffer(
      XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer,
      baseMeta("excel", fileName, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    );

    assert.equal(parsed.selectedSheet, sheetName);
    assert.deepEqual(parsed.columns, ["Account", "Reference", "Value"]);
  }
}

async function testExcelNoValidSheetExplainsRejectedSheets() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[]]), "Empty");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Notes"], ["Generated only"]]), "Notes");

  await assert.rejects(
    () =>
      parseAccountancyUploadBuffer(
        XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer,
        baseMeta("excel", "notes-only.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
      ),
    (error) =>
      error instanceof AccountancyUploadError &&
      error.code === "EXCEL_NO_DATA_SHEET" &&
      error.message.includes("Empty: Sheet is empty.") &&
      error.message.includes("Notes: No generic tabular region"),
  );
}

async function testTextPdfInvoice() {
  const pdf = Buffer.from(
    "%PDF-1.4\n(Supplier: ACME Ltd)\n(Invoice Number: INV-1001)\n(Date: 2026-01-31)\n(Currency: EUR)\n(Subtotal: 100.00)\n(VAT: 21.00)\n(Total: 121.00)\n(Item: Hosting 1 100.00)\n%%EOF",
  );
  const parsed = await parseAccountancyUploadBuffer(pdf, baseMeta("pdf", "invoice.pdf", "application/pdf"));
  assert.equal(parsed.route, "accountancy_pdf_document_processor");
  assert.equal(parsed.documentTextStatus, "embedded_text");
  assert.deepEqual(parsed.columns, ["transaction_date", "description", "supplier_customer", "amount", "currency", "vat_tax", "invoice_reference", "subtotal", "line_items"]);
  assert.equal(parsed.rows[0]?.transaction_date, "2026-01-31");
  assert.equal(parsed.rows[0]?.supplier_customer, "ACME Ltd");
  assert.equal(parsed.rows[0]?.invoice_reference, "INV-1001");
  assert.equal(parsed.rows[0]?.amount, 121);
  assert.equal(parsed.rows[0]?.currency, "EUR");
  assert.equal(parsed.rows[0]?.vat_tax, 21);
  assert.equal(parsed.rows[0]?.subtotal, 100);
  assert.ok(Array.isArray(parsed.rows[0]?.line_items));
  assert.equal((parsed.rows[0]?.line_items as Record<string, unknown>[])[0]?.description, "Hosting");
  assert.equal((parsed.rows[0]?.line_items as Record<string, unknown>[]).length, 1);
  assert.ok(parsed.extractedData.some((field) => field.field === "invoiceNumber" && field.value === "INV-1001"));
  assert.ok(parsed.extractedData.some((field) => field.field === "total" && field.value === "121.00"));
  assert.ok(parsed.extractedData.some((field) => field.field === "lineItems"));
  const categorization = categorizePrebookkeepingRows(parsed.rows);
  assert.equal(categorization.reviewSummary.totalCount, 1);
  assert.equal(categorization.vatTaxSummary.rowsWithTax, 1);
  assert.equal(categorization.vatTaxSummary.total, 21);
}

async function testScannedPdf() {
  const parsed = await parseAccountancyUploadBuffer(Buffer.from("%PDF-1.4\n%%EOF"), baseMeta("pdf", "scan.pdf", "application/pdf"));
  assert.equal(parsed.route, "receipt_document_scanner");
  assert.equal(parsed.documentTextStatus, "scanner_required");
}

async function testImageReceipts() {
  const jpg = await parseAccountancyUploadBuffer(Buffer.from([255, 216, 255, 217]), baseMeta("receipt", "receipt.jpg", "image/jpeg"));
  assert.equal(jpg.route, "receipt_invoice_document_scanner");
  assert.equal(jpg.documentTextStatus, "image_scanner");

  const png = await parseAccountancyUploadBuffer(Buffer.from([137, 80, 78, 71]), baseMeta("receipt", "receipt.png", "image/png"));
  assert.equal(png.route, "receipt_invoice_document_scanner");
  assert.equal(png.documentTextStatus, "image_scanner");

  const webp = await parseAccountancyUploadBuffer(Buffer.from("RIFF....WEBP"), baseMeta("receipt", "receipt.webp", "image/webp"));
  assert.equal(webp.route, "receipt_invoice_document_scanner");
  assert.equal(webp.documentTextStatus, "image_scanner");
}

async function testCsvBankExport() {
  const parsed = await parseAccountancyUploadBuffer(
    Buffer.from("date,description,debit,credit,currency,balance,reference\n2026-01-01,Fee,5,,EUR,95,ABC\n2026-01-02,Sale,,25,EUR,120,DEF\n"),
    baseMeta("bank", "bank.csv", "text/csv"),
  );
  assert.equal(parsed.route, "bank_transaction_parser");
  assert.equal(parsed.rows[0]?.normalizedAmount, -5);
  assert.equal(parsed.rows[1]?.normalizedAmount, 25);
}

async function testXlsxBankExport() {
  const parsed = await parseAccountancyUploadBuffer(
    workbookBuffer([["date", "description", "amount"], ["2026-01-01", "Deposit", 250]]),
    baseMeta("bank", "bank.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
  );
  assert.equal(parsed.route, "bank_transaction_parser");
  assert.equal(parsed.rows[0]?.normalizedAmount, 250);
}

async function testXlsBankExport() {
  const parsed = await parseAccountancyUploadBuffer(
    workbookBuffer([["date", "description", "debit", "credit", "currency", "balance", "reference"], ["2026-01-01", "Bank fee", 9.99, "", "EUR", 90, "FEE-1"]], "xls"),
    baseMeta("bank", "bank.xls", "application/vnd.ms-excel"),
  );
  assert.equal(parsed.route, "bank_transaction_parser");
  assert.equal(parsed.rows[0]?.normalizedAmount, -9.99);
  assert.equal(parsed.rows[0]?.transactionDate, "2026-01-01");
  assert.equal(parsed.rows[0]?.transactionDescription, "Bank fee");
  assert.equal(parsed.rows[0]?.transactionCurrency, "EUR");
  assert.equal(parsed.rows[0]?.transactionBalance, 90);
  assert.equal(parsed.rows[0]?.transactionReference, "FEE-1");
}

async function testOfxBankExport() {
  const ofx = Buffer.from("<OFX><BANKTRANLIST><STMTTRN><DTPOSTED>20260101<TRNAMT>-9.99<FITID>1<NAME>Bank fee</BANKTRANLIST></OFX>");
  const parsed = await parseAccountancyUploadBuffer(ofx, baseMeta("bank", "bank.ofx", "application/octet-stream"));
  assert.equal(parsed.route, "bank_transaction_parser");
  assert.equal(parsed.rows[0]?.normalizedAmount, -9.99);
}

async function testQifBankExport() {
  const qif = Buffer.from("D01/01/2026\nT-9.99\nPBank fee\nNFEE-1\n^");
  const parsed = await parseAccountancyUploadBuffer(qif, baseMeta("bank", "bank.qif", "application/octet-stream"));
  assert.equal(parsed.route, "bank_transaction_parser");
  assert.equal(parsed.rows[0]?.normalizedAmount, -9.99);
  assert.equal(parsed.rows[0]?.transactionDescription, "Bank fee");
  assert.equal(parsed.rows[0]?.transactionReference, "FEE-1");
}

async function testQfxBankExport() {
  const qfx = Buffer.from("<OFX><BANKTRANLIST><STMTTRN><DTPOSTED>20260101<TRNAMT>25.00<FITID>QFX-1<NAME>Customer payment</BANKTRANLIST></OFX>");
  const parsed = await parseAccountancyUploadBuffer(qfx, baseMeta("bank", "bank.qfx", "application/vnd.intu.qfx"));
  assert.equal(parsed.route, "bank_transaction_parser");
  assert.equal(parsed.rows[0]?.normalizedAmount, 25);
  assert.equal(parsed.rows[0]?.transactionDescription, "Customer payment");
  assert.equal(parsed.rows[0]?.transactionReference, "QFX-1");
}

function testUnsupportedFiles() {
  const unsupported: Array<[AccountancyUploadType, string, string]> = [
    ["csv", "invoice.pdf", "application/pdf"],
    ["excel", "ledger.csv", "text/csv"],
    ["pdf", "receipt.jpg", "image/jpeg"],
    ["receipt", "ledger.csv", "text/csv"],
    ["bank", "receipt.jpg", "image/jpeg"],
  ];

  for (const [uploadType, fileName, mimeType] of unsupported) {
    assert.throws(
      () => validateAccountancyUpload(baseMeta(uploadType, fileName, mimeType)),
      (error) => error instanceof AccountancyUploadError && error.stage === "validation",
    );
  }
}

function testUiWiring() {
  const source = readFileSync("src/components/accountancy/accountancy-upload.tsx", "utf8");
  assert.ok(source.includes('fetch("/api/accountancy/upload"'), "Accountancy UI uses dedicated route");
  assert.ok(source.includes("validateUploadApiResponse"), "Accountancy upload API responses are validated before rendering");
  assert.ok(source.includes('formData.append("uploadType", selectedType)'), "selected upload type is submitted");
  assert.ok(source.includes("resetSelectedFileState"), "tab switching clears selected file and errors");
  assert.ok(source.includes("fileInputRef.current.value = \"\""), "file input is cleared on tab switch");
  assert.ok(!source.includes("simulateExtraction"), "mock extraction is removed");
  assert.ok(!source.includes("Math.random() * 1000"), "random mock transactions are removed");
}

function testApiRouteWiring() {
  const route = readFileSync("src/app/api/accountancy/upload/route.ts", "utf8");
  const processor = readFileSync("src/lib/accountancy/upload-processing.ts", "utf8");
  const prebookkeepingPage = readFileSync("src/app/(auth)/app/prebookkeeping/page.tsx", "utf8");
  const reviewRoute = readFileSync("src/app/api/prebookkeeping/review/route.ts", "utf8");
  const exportRoute = readFileSync("src/app/api/prebookkeeping/export/route.ts", "utf8");
  const reviewWorkspace = readFileSync("src/components/accountancy/prebookkeeping-review-workspace.tsx", "utf8");
  assert.ok(route.includes("processAccountancyUpload"), "API route uses Accountancy processor");
  assert.ok(route.includes("stage"), "API route returns staged errors");
  assert.ok(processor.includes("eq(datasets.checksum, checksum)"), "processor reuses duplicate datasets by checksum");
  assert.ok(processor.includes("categorizePrebookkeepingRows(parsed.rows, learningRules)"), "Pre-bookkeeping uploads start categorization automatically");
  assert.ok(processor.includes("createDefaultPrebookkeepingReviewSummary(parsed.rowCount"), "Accountancy uploads initialize review summary defaults");
  assert.ok(processor.includes("hasCompleteReviewSummary"), "legacy review summaries are backfilled with safe defaults");
  assert.ok(prebookkeepingPage.includes("Ready for review"), "Pre-bookkeeping page shows ready-for-review status");
  assert.ok(prebookkeepingPage.includes("normalizePrebookkeepingCategorization"), "Pre-bookkeeping page normalizes legacy review summaries before rendering");
  assert.ok(prebookkeepingPage.includes("StartCategorizationButton"), "Pre-bookkeeping page exposes a categorization action for legacy datasets");
  assert.ok(reviewRoute.includes("prebookkeepingLearningRules"), "manual category edits persist learning rules");
  assert.ok(reviewRoute.includes("prebookkeepingAuditEvents"), "review actions write audit events");
  assert.ok(exportRoute.includes("buildPrebookkeepingExport"), "exports use the dedicated transaction export generator");
  assert.ok(exportRoute.includes("isSupportedPrebookkeepingExportFormat"), "unsupported accountant-package formats return Coming soon");
  assert.ok(exportRoute.includes("parseRowIndexes"), "filtered exports pass selected row indexes into the export generator");
  assert.ok(reviewWorkspace.includes("AI Review Summary"), "review workspace shows AI review summary");
  assert.ok(reviewWorkspace.includes("Missing VAT"), "review workspace includes review queue filters");
  assert.ok(reviewWorkspace.includes("Confidence"), "review workspace displays prediction confidence");
  assert.ok(reviewWorkspace.includes("Current filtered rows"), "export dialog offers current filtered rows");
  assert.ok(reviewWorkspace.includes("Reviewed transactions"), "export dialog offers reviewed transactions");
  assert.ok(reviewWorkspace.includes("All transactions"), "export dialog offers all transactions");
  assert.ok(reviewWorkspace.includes("Coming soon"), "unsupported accountant package exports are visibly disabled");
  assert.ok(reviewWorkspace.includes("validateReviewApiResponse"), "review workspace validates review API responses");
  assert.ok(reviewWorkspace.includes('safeText(value, "Uncategorized")'), "review workspace normalizes category values before formatting");
  assert.ok(!route.includes("reserveCredits") && !processor.includes("reserveCredits"), "failed uploads do not reserve credits");
  assert.ok(!route.includes("finalizeCredits") && !processor.includes("finalizeCredits"), "Accountancy upload route does not finalize credits");
}

function testPrebookkeepingCategorization() {
  const summary = categorizePrebookkeepingRows([
    { date: "2026-01-01", description: "Customer payment INV-1", credit: 100, currency: "EUR", vat: 21, reference: "INV-1" },
    { date: "2026-01-02", description: "Monthly rent", debit: 40, currency: "EUR", vat: 8, reference: "BILL-1" },
    { date: "2026-01-03", description: "Average Gross Salary", debit: 60, currency: "EUR", reference: "PAY-1" },
    { date: "2026-01-04", description: "Bank fee", debit: 2, currency: "EUR", reference: "FEE-1" },
    { date: "2026-01-05", description: "VAT payment", debit: 10, currency: "EUR", reference: "TAX-1" },
    { date: "2026-01-06", description: "Internal transfer", amount: 0, currency: "EUR", reference: "TR-1" },
    { date: "2026-01-07", description: "", currency: "EUR" },
  ]);

  assert.equal(summary.status, "ready_for_review");
  assert.equal(summary.categoryCounts.revenue, 1);
  assert.equal(summary.categoryCounts.fixed_costs, 1);
  assert.equal(summary.categoryCounts.payroll, 1);
  assert.equal(summary.categoryCounts.bank_fees, 1);
  assert.equal(summary.categoryCounts.taxes, 1);
  assert.equal(summary.categoryCounts.transfers, 1);
  assert.equal(summary.categoryCounts.uncategorized, 1);
  assert.equal(summary.incomeTotal, 100);
  assert.equal(summary.expenseTotal, 112);
  assert.equal(summary.vatTaxSummary.total, 29);
}

function testPrebookkeepingExports() {
  const categorization = normalizePrebookkeepingCategorization(categorizePrebookkeepingRows([
    { date: "2026-01-01", description: "Customer payment INV-1", supplier: "Customer A", credit: 100, currency: "EUR", vat: 21, reference: "INV-1" },
    { date: "2026-01-02", description: "Monthly rent", supplier: "Office Landlord", debit: 40, currency: "EUR", vat: 8, reference: "BILL-1" },
    { date: "2026-01-03", description: "Mystery transaction", amount: -5, currency: "EUR", reference: "MISSING-CAT" },
  ]));
  const reviewedCategorization = {
    ...categorization,
    transactions: categorization.transactions.map((transaction, index) => ({
      ...transaction,
      reviewed: true,
      reviewStatus: "reviewed" as const,
      category: index === 2 ? "uncategorized" as const : transaction.category,
      duplicateStatus: "none" as const,
    })),
  };

  const csv = buildPrebookkeepingExport({ datasetName: "Ledger Export", categorization: reviewedCategorization, format: "csv", scope: "reviewed" });
  assert.equal(csv.contentType, "text/csv; charset=utf-8");
  assert.equal(csv.rowCount, 3);
  assert.ok(typeof csv.body === "string" && csv.body.startsWith("\uFEFF"), "CSV exports include UTF-8 BOM");
  assert.ok(String(csv.body).includes("Date,Description,Supplier/Customer,Amount,Debit,Credit,Currency,VAT,VAT Rate,Category,Reference,Review Status"));
  assert.ok(String(csv.body).includes("Customer payment INV-1"));

  const excel = buildPrebookkeepingExport({ datasetName: "Ledger Export", categorization: reviewedCategorization, format: "excel", scope: "reviewed" });
  assert.ok(excel.body instanceof Uint8Array, "Excel export returns binary workbook");
  const workbook = XLSX.read(excel.body, { type: "array" });
  assert.deepEqual(workbook.SheetNames, ["Transactions", "Summary", "VAT Summary"]);
  assert.equal((XLSX.utils.sheet_to_json(workbook.Sheets.Transactions || {}) as unknown[]).length, 3);

  const oneRow = buildPrebookkeepingExport({
    datasetName: "Ledger Export",
    categorization: reviewedCategorization,
    format: "csv",
    scope: "filtered",
    rowIndexes: [reviewedCategorization.transactions[0]?.rowIndex ?? 0],
  });
  assert.equal(oneRow.rowCount, 1);

  const allRows = buildPrebookkeepingExport({ datasetName: "Ledger Export", categorization: reviewedCategorization, format: "excel", scope: "all" });
  assert.equal(allRows.rowCount, 3);

  const fortyTwoRowCategorization = {
    ...reviewedCategorization,
    transactions: Array.from({ length: 42 }, (_, index) => ({
      ...reviewedCategorization.transactions[index % reviewedCategorization.transactions.length],
      rowIndex: index,
      reviewed: index < 14,
      reviewStatus: index < 14 ? "reviewed" as const : "pending" as const,
    })),
  };
  const filteredFortyTwo = buildPrebookkeepingExport({
    datasetName: "Ledger Export",
    categorization: fortyTwoRowCategorization,
    format: "excel",
    scope: "filtered",
    rowIndexes: Array.from({ length: 42 }, (_, index) => index),
  });
  assert.equal(filteredFortyTwo.rowCount, 42);
  const fortyTwoWorkbook = XLSX.read(filteredFortyTwo.body, { type: "array" });
  assert.equal((XLSX.utils.sheet_to_json(fortyTwoWorkbook.Sheets.Transactions || {}) as unknown[]).length, 42);

  const reviewedFourteen = buildPrebookkeepingExport({
    datasetName: "Ledger Export",
    categorization: fortyTwoRowCategorization,
    format: "csv",
    scope: "reviewed",
  });
  assert.equal(reviewedFourteen.rowCount, 14);

  const quickBooks = buildPrebookkeepingExport({ datasetName: "Ledger Export", categorization: reviewedCategorization, format: "quickbooks", scope: "reviewed" });
  assert.ok(String(quickBooks.body).includes("Transaction Type"));
  assert.ok(String(quickBooks.body).includes("Rent or Lease"));

  const xero = buildPrebookkeepingExport({ datasetName: "Ledger Export", categorization: reviewedCategorization, format: "xero", scope: "reviewed" });
  assert.ok(String(xero.body).includes("Payee"));
  assert.ok(String(xero.body).includes("Spend Money"));

  assert.throws(
    () => buildPrebookkeepingExport({ datasetName: "Ledger Export", categorization: reviewedCategorization, format: "datev", scope: "reviewed" }),
    (error) => error instanceof PrebookkeepingExportError && error.stage === "setup",
  );

  const datevReadyCategorization = {
    ...reviewedCategorization,
    transactions: reviewedCategorization.transactions.map((transaction) => ({
      ...transaction,
      category: transaction.category === "uncategorized" ? "operating_expenses" as const : transaction.category,
    })),
  };
  const datev = buildPrebookkeepingExport({ datasetName: "Ledger Export", categorization: datevReadyCategorization, format: "datev", scope: "reviewed" });
  assert.ok(String(datev.body).includes("Umsatz;Soll/Haben-Kennzeichen"));
  assert.ok(String(datev.body).includes("4980"));
}

function testPrebookkeepingAssistantFallback() {
  const categorization = normalizePrebookkeepingCategorization(categorizePrebookkeepingRows([
    { date: "2026-01-01", description: "Customer payment INV-1", supplier: "Customer A", credit: 100, currency: "EUR", vat: 21, reference: "INV-1" },
    { date: "2026-01-02", description: "Monthly rent", supplier: "Office Landlord", debit: 40, currency: "EUR", reference: "BILL-1" },
    { date: "2026-01-03", description: "Monthly rent", supplier: "Office Landlord", debit: 40, currency: "EUR", reference: "BILL-1-DUP" },
    { date: "2026-01-04", description: "Stripe fee", supplier: "Stripe Ltd", debit: 3, currency: "EUR", reference: "FEE-1" },
  ]));

  const expenseAnswer = answerPrebookkeepingQuestionDeterministically({
    question: "What are my largest expenses?",
    categorization,
  });
  assert.ok(expenseAnswer.answer.includes("Answer\n"));
  assert.ok(expenseAnswer.answer.includes("Evidence\n"));
  assert.ok(expenseAnswer.answer.includes("Takeaway\n"));
  assert.ok(expenseAnswer.answer.includes("Next action\n"));
  assert.equal(expenseAnswer.result.type, "prebookkeeping_direct_analysis");

  const duplicateAnswer = answerPrebookkeepingQuestionDeterministically({
    question: "Show possible duplicates.",
    categorization,
  });
  assert.equal(duplicateAnswer.result.intent, "duplicates");

  const vatAnswer = answerPrebookkeepingQuestionDeterministically({
    question: "Which transactions are missing VAT?",
    categorization,
  });
  assert.equal(vatAnswer.result.intent, "missing_vat");
  assert.ok(vatAnswer.answer.includes("VAT"));
}

function testLegacyCategorizationReviewSummaryNormalization() {
  const summary = categorizePrebookkeepingRows([
    { date: "2026-01-01", description: "Customer payment", credit: 100, currency: "EUR" },
    { date: "2026-01-02", description: "Monthly rent", debit: 40, currency: "EUR" },
  ]);
  const legacy = { ...summary };
  delete (legacy as { reviewSummary?: unknown }).reviewSummary;

  const normalized = normalizePrebookkeepingCategorization(
    legacy as Parameters<typeof normalizePrebookkeepingCategorization>[0],
  );
  assert.equal(normalized.reviewSummary.reviewedCount, 0);
  assert.equal(normalized.reviewSummary.totalCount, 2);
  assert.equal(normalized.reviewSummary.progress, 0);
  assert.equal(normalized.reviewSummary.status, "ready_for_review");
  assert.equal(normalized.reviewSummary.transactionsAnalyzed, 2);
}

function testMalformedLegacyTransactionNormalization() {
  const summary = categorizePrebookkeepingRows([
    { date: "2026-01-01", description: "Customer payment", credit: 100, currency: "EUR" },
  ]);
  const legacy = {
    ...summary,
    transactions: [
      {
        rowIndex: 0,
        description: undefined,
        supplierCustomer: undefined,
        category: undefined,
        suggestedCategory: undefined,
        duplicateStatus: undefined,
        confidence: undefined,
        reviewed: false,
      },
    ],
  };

  const normalized = normalizePrebookkeepingCategorization(
    legacy as unknown as Parameters<typeof normalizePrebookkeepingCategorization>[0],
  );
  assert.equal(normalized.transactions[0]?.category, "uncategorized");
  assert.equal(normalized.transactions[0]?.suggestedCategory, null);
  assert.equal(normalized.transactions[0]?.description, null);
  assert.equal(normalized.transactions[0]?.supplierCustomer, null);
  assert.equal(normalized.transactions[0]?.duplicateStatus, "none");
  assert.equal(normalized.transactions[0]?.vatStatus, "missing");
  assert.equal(normalized.reviewSummary.totalCount, 1);
}

function testTwoHundredRowLedgerCategorization() {
  const rows = Array.from({ length: 200 }, (_, index) => {
    const rowNumber = index + 1;
    const type = rowNumber % 8;
    return {
      transaction_date: `2026-01-${String((rowNumber % 28) + 1).padStart(2, "0")}`,
      description:
        type === 0
          ? "Customer payment"
          : type === 1
            ? "Office supplies"
            : type === 2
              ? "Monthly rent"
              : type === 3
                ? "Average Gross Salary"
                : type === 4
                  ? "VAT payment"
                  : type === 5
                    ? "Bank fee"
                    : type === 6
                      ? "Internal transfer"
                      : "",
      supplier_customer: type === 0 ? "Customer" : "Supplier",
      debit: type === 0 ? "" : 10 + rowNumber,
      credit: type === 0 ? 25 + rowNumber : "",
      amount: "",
      currency: "EUR",
      vat_tax: type === 1 || type === 2 ? 2 : "",
      category: "",
      invoice_reference: `REF-${rowNumber}`,
      cost_center: "HQ",
      notes: "",
    };
  });

  const summary = categorizePrebookkeepingRows(rows);
  assert.equal(summary.rowCount, 200);
  assert.equal(Object.keys(rows[0] || {}).length, 12);
  assert.equal(summary.transactions.length, 200);
  assert.ok(summary.categorizedCount > summary.uncategorizedCount);
  assert.ok(summary.incomeTotal > 0);
  assert.ok(summary.expenseTotal > 0);
}

function workbookBuffer(rows: unknown[][], bookType: "xlsx" | "xls" = "xlsx") {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
  return XLSX.write(workbook, { type: "buffer", bookType }) as Buffer;
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
