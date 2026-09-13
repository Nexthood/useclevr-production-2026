import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as XLSX from "xlsx";

import {
  isSupportedExcelFile,
  parseExcelWorkbook,
  toDatasetPayload,
} from "@/services/clevrsync";

function makeWorkbookBuffer() {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Customer", "Revenue", "Paid", "Invoice Date"],
    ["Acme", 1200, true, new Date("2026-01-15T00:00:00.000Z")],
    ["Northwind", 950.5, false, new Date("2026-02-20T00:00:00.000Z")],
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sales");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Only Header"]]), "Notes");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

function testExcelParsing() {
  const preview = parseExcelWorkbook({
    fileBuffer: makeWorkbookBuffer(),
    fileName: "sales.xlsx",
    fileSize: 1024,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  assert.equal(preview.sourceType, "excel");
  assert.equal(preview.activeWorksheet, "Sales");
  assert.equal(preview.worksheets.length, 2);
  assert.equal(preview.rowCount, 2);
  assert.deepEqual(
    preview.columns.map((column) => column.name),
    ["Customer", "Revenue", "Paid", "Invoice Date"],
  );
  assert.equal(preview.columns.find((column) => column.name === "Customer")?.type, "string");
  assert.equal(preview.columns.find((column) => column.name === "Revenue")?.type, "number");
  assert.equal(preview.columns.find((column) => column.name === "Paid")?.type, "boolean");
  assert.equal(preview.columns.find((column) => column.name === "Invoice Date")?.type, "date");
  assert.equal(preview.rows[0]?.Customer, "Acme");
}

function testDatasetPayload() {
  const preview = parseExcelWorkbook({
    fileBuffer: makeWorkbookBuffer(),
    fileName: "sales.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const dataset = toDatasetPayload(preview);

  assert.equal(dataset.source, "clevrsync");
  assert.equal(dataset.datasetType, "standard");
  assert.equal(dataset.name, "sales");
  assert.deepEqual(dataset.columns, ["Customer", "Revenue", "Paid", "Invoice Date"]);
  assert.equal(dataset.rows.length, 2);
  assert.equal(dataset.columnTypes.Revenue, "number");
}

function testConnectorValidation() {
  assert.equal(
    isSupportedExcelFile("book.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    true,
  );
  assert.equal(isSupportedExcelFile("book.csv", "text/csv"), false);
  assert.equal(isSupportedExcelFile("legacy.xls", "application/vnd.ms-excel"), false);
}

function testPermissionChecks() {
  const previewRoute = readFileSync("src/app/api/clevrsync/preview/route.ts", "utf8");
  const syncRoute = readFileSync("src/app/api/clevrsync/sync/route.ts", "utf8");
  const syncEngine = readFileSync("src/services/clevrsync/sync-engine.ts", "utf8");

  assert.match(previewRoute, /getOwnedClevrSyncConnector\(session\.user\.id, connectorId\)/);
  assert.match(syncRoute, /getOwnedClevrSyncConnector\(session\.user\.id, connectorId\)/);
  assert.match(previewRoute, /status: 403/);
  assert.match(syncRoute, /status: 403/);
  assert.match(syncEngine, /eq\(clevrSyncConnectors\.userId, userId\)/);
}

function testExistingUploadPathRemainsExcelAware() {
  const uploadAction = readFileSync("src/app/actions/upload.ts", "utf8");
  const csvLoader = readFileSync("src/lib/data/csvLoader.ts", "utf8");

  assert.match(uploadAction, /parseCSVStreaming\(file, rowLimit\)/);
  assert.match(csvLoader, /fileName\.endsWith\('\.xlsx'\)/);
  assert.match(csvLoader, /parseExcelStreaming\(file, acceptedRowLimit, onProgress\)/);
}

testExcelParsing();
testDatasetPayload();
testConnectorValidation();
testPermissionChecks();
testExistingUploadPathRemainsExcelAware();

console.log("ClevrSync tests passed");
