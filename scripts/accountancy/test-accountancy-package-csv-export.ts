import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildAccountancyPackageCsv,
  toStructuredAccountancyPackageCsvRows,
} from "../../src/lib/accountancy/package-csv";

function run() {
  testStructuredCsvRows();
  testCsvOutputEscapingAndExcelCompatibility();
  testCsvButtonFlowRemainsCurrent();
  testPdfAndExcelPathsRemainSeparate();
  console.log("Accountancy package CSV export regression tests passed.");
}

function testStructuredCsvRows() {
  const rows = toStructuredAccountancyPackageCsvRows([
    { label: "Company name", value: "BrightPath Retail Ltd" },
    { label: "Tax country", value: "United Kingdom" },
    { label: "Currency", value: "GBP" },
    { label: "VAT registered", value: "Yes" },
    { label: "Default VAT rate", value: "20%" },
    { label: "Payroll", value: "Average Gross Salary 3000 monthly; Employer Contribution 15%; Health Insurance 3%" },
    { label: "Fixed costs", value: "Rent 3500 monthly; Utilities 650 monthly; Software 350 monthly" },
  ]);

  assert.deepEqual(rows.slice(0, 5), [
    { category: "Company", field: "Company Name", value: "BrightPath Retail Ltd", unit: "", frequency: "" },
    { category: "Tax", field: "Country", value: "United Kingdom", unit: "", frequency: "" },
    { category: "Company", field: "Currency", value: "GBP", unit: "GBP", frequency: "" },
    { category: "Tax", field: "VAT Registered", value: "Yes", unit: "", frequency: "" },
    { category: "Tax", field: "VAT Rate", value: "20", unit: "%", frequency: "" },
  ]);
  assert.ok(rows.some((row) => row.category === "Payroll" && row.field === "Average Gross Salary" && row.value === "3000" && row.unit === "GBP" && row.frequency === "Monthly"));
  assert.ok(rows.some((row) => row.category === "Payroll" && row.field === "Employer Contribution" && row.value === "15" && row.unit === "%" && row.frequency === ""));
  assert.ok(rows.some((row) => row.category === "Fixed Cost" && row.field === "Utilities" && row.value === "650" && row.unit === "GBP" && row.frequency === "Monthly"));
}

function testCsvOutputEscapingAndExcelCompatibility() {
  const csv = buildAccountancyPackageCsv([
    { label: "Company name", value: "BrightPath, \"Retail\"\nLtd" },
    { label: "Currency", value: "GBP" },
    { label: "Payroll", value: "Complex payroll note without a reliable amount" },
  ]);

  assert.ok(csv.startsWith("\uFEFFCategory,Field,Value,Unit,Frequency"), "CSV should include a UTF-8 BOM and the structured header");
  assert.match(csv, /"BrightPath, ""Retail""\nLtd"/, "CSV should escape commas, quotes, and multiline values");
  assert.match(csv, /"Payroll","Payroll","Complex payroll note without a reliable amount","",""/, "Unparsed text values should be preserved without invented numbers");
}

function testCsvButtonFlowRemainsCurrent() {
  const source = readFileSync("src/components/accountancy/accountancy-package-form.tsx", "utf8");
  assert.match(source, /function exportCsv\(\)/, "CSV export function should remain available");
  assert.match(source, /downloadFile\("pre-bookkeeping-package\.csv", "text\/csv;charset=utf-8", csv\)/, "CSV button should keep the same filename and UTF-8 download flow");
  assert.match(source, /<Download className="h-4 w-4" \/>[\s\S]*CSV file/, "CSV download button should remain visible");
}

function testPdfAndExcelPathsRemainSeparate() {
  const source = readFileSync("src/components/accountancy/accountancy-package-form.tsx", "utf8");
  assert.match(source, /function exportExcel\(\)/, "Excel export should remain a separate function");
  assert.match(source, /application\/vnd\.ms-excel;charset=utf-8/, "Excel export content type should remain unchanged");
  assert.match(source, /async function exportPdf\(\)/, "PDF export should remain a separate function");
  assert.match(source, /fetch\("\/api\/accountancy\/package\/pdf\?disposition=inline"/, "PDF export route should remain unchanged");
}

run();
