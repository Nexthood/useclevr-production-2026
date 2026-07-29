import { createHash } from "node:crypto";

import Papa from "papaparse";
import * as XLSX from "xlsx";

import type { AnalysisResult, PipelineContext, Scanner, ScannerExecutionOptions } from "./types";
import type {
  DatasetColumnProfile,
  DatasetHealthReport,
  DatasetPhysicalSourceType,
  DatasetRegionProfile,
  DatasetStructureMetadata,
  DatasetStructureProfile,
  DetectionConfidence,
  StructureDataType,
  StructureDetectionLog,
  WorksheetStructureProfile,
} from "./structure-types";

const SUPPORTED_FUTURE_SOURCES: DatasetPhysicalSourceType[] = ["pdf", "image", "sql", "snowflake", "api"];
const PROFILE_SAMPLE_LIMIT = 10000;
const DISPLAY_SAMPLE_LIMIT = 5;
const EMPTY_CELL = "";

interface SourceWorksheet {
  name: string;
  rows: unknown[][];
  merges: WorksheetStructureProfile["mergedCells"];
  hiddenRows: number[];
  hiddenColumns: number[];
  comments: WorksheetStructureProfile["comments"];
  formulas: WorksheetStructureProfile["formulas"];
}

interface NormalizedSource {
  type: DatasetPhysicalSourceType;
  worksheets: SourceWorksheet[];
  rawText: string;
  rawBytes: Uint8Array;
  fileName: string | null;
  mimeType: string | null;
  size: number;
}

interface DetectionStepRunner {
  run<T>(step: string, detect: () => DetectionConfidence<T>): DetectionConfidence<T>;
  logs(): StructureDetectionLog[];
}

export class UniversalDatasetStructureScanner implements Scanner {
  id(): string {
    return "edie.structure-scanner.v1";
  }

  name(): string {
    return "Universal Dataset Structure Scanner";
  }

  version(): string {
    return "1.0.0";
  }

  priority(): number {
    return 10;
  }

  supports(context: PipelineContext): boolean {
    const sourceType = detectSourceType(context);
    return sourceType === "csv" || sourceType === "excel" || hasRows(context);
  }

  validate(context: PipelineContext) {
    const hasSource = Boolean(context.dataset.rawText || context.dataset.rawBuffer || hasRows(context));

    return {
      valid: hasSource,
      warnings: [],
      errors: hasSource ? [] : ["Universal structure scanner requires raw text, raw buffer, or parsed rows."],
    };
  }

  execute(context: PipelineContext, options: ScannerExecutionOptions): AnalysisResult {
    const startedAtMs = Date.now();
    const runner = createDetectionStepRunner();
    const source = normalizeSource(context);

    if (options.signal.aborted) {
      return this.cancelledResult(startedAtMs);
    }

    const encoding = runner.run("encoding", () => detectEncoding(source.rawBytes, source.rawText));
    const delimiter = runner.run("delimiter", () => detectDelimiter(source.rawText, source.type));
    const decimalSeparator = runner.run("decimal-separator", () => detectDecimalSeparator(source.worksheets));
    const thousandsSeparator = runner.run("thousands-separator", () => detectThousandsSeparator(source.worksheets));
    const language = runner.run("language", () => detectLanguage(source.rawText, source.worksheets));
    const timezone = runner.run("timezone", () => detectTimezone(source.rawText));

    const worksheets = source.worksheets.map((worksheet, index) =>
      buildWorksheetProfile(worksheet, index, {
        decimalSeparator: decimalSeparator.value,
        thousandsSeparator: thousandsSeparator.value,
      }),
    );
    const primaryWorksheet = worksheets[0] ?? createEmptyWorksheetProfile();
    const health = buildDatasetHealthReport(worksheets, encoding);
    const rowCount = worksheets.reduce((sum, worksheet) => sum + worksheet.rowCount, 0);
    const columnCount = worksheets.reduce((max, worksheet) => Math.max(max, worksheet.columnCount), 0);
    const fileHash = hashBytes(source.rawBytes.length > 0 ? source.rawBytes : stringToBytes(source.rawText));
    const fingerprint = buildDatasetFingerprint({
      sourceType: source.type,
      encoding: encoding.value,
      worksheets,
      delimiter: delimiter.value,
    });
    const metadata = buildMetadata({
      context,
      source,
      encoding,
      language,
      timezone,
      fileHash,
      fingerprint,
      rowCount,
      columnCount,
    });
    const warnings = uniqueStrings([
      ...encoding.warnings,
      ...delimiter.warnings,
      ...decimalSeparator.warnings,
      ...thousandsSeparator.warnings,
      ...language.warnings,
      ...timezone.warnings,
      ...worksheets.flatMap((worksheet) => worksheet.warnings),
      ...health.warnings,
    ]);
    const errors = uniqueStrings([
      ...encoding.errors,
      ...delimiter.errors,
      ...decimalSeparator.errors,
      ...thousandsSeparator.errors,
      ...language.errors,
      ...timezone.errors,
      ...worksheets.flatMap((worksheet) => worksheet.errors),
      ...health.errors,
    ]);
    const confidence = average([
      encoding.confidence,
      delimiter.confidence,
      decimalSeparator.confidence,
      thousandsSeparator.confidence,
      language.confidence,
      timezone.confidence,
      ...worksheets.map((worksheet) => worksheet.confidence),
      health.qualityScore / 100,
    ]);
    const types = Object.fromEntries(primaryWorksheet.columns.map((column) => [column.name, column.detectedDataType]));
    const profile: DatasetStructureProfile = {
      version: "edie.structure.v1",
      metadata,
      worksheets,
      columns: primaryWorksheet.columns,
      types,
      health,
      quality: {
        score: health.qualityScore,
        grade: scoreToGrade(health.qualityScore),
      },
      fingerprint,
      warnings,
      errors,
      confidence,
      detectionLog: runner.logs(),
    };

    return {
      scannerId: this.id(),
      status: "completed",
      confidence,
      duration: Date.now() - startedAtMs,
      warnings,
      errors,
      metadata: {
        structureProfile: profile,
        fileType: source.type,
        delimiter: delimiter.value,
        decimalSeparator: decimalSeparator.value,
        thousandsSeparator: thousandsSeparator.value,
        worksheetCount: worksheets.length,
      },
      executionTime: new Date().toISOString(),
      scannerVersion: this.version(),
      contextPatch: {
        schema: { structureProfile: profile },
        metadata: { structureProfile: profile.metadata },
        confidence: { [this.id()]: confidence },
        warnings,
      },
    };
  }

  private cancelledResult(startedAtMs: number): AnalysisResult {
    return {
      scannerId: this.id(),
      status: "cancelled",
      confidence: 0,
      duration: Date.now() - startedAtMs,
      warnings: [],
      errors: ["Scanner execution was cancelled before structure analysis."],
      metadata: {},
      executionTime: new Date().toISOString(),
      scannerVersion: this.version(),
    };
  }
}

export function buildDatasetStructureProfile(context: PipelineContext): DatasetStructureProfile {
  const scanner = new UniversalDatasetStructureScanner();
  const result = scanner.execute(context, { signal: new AbortController().signal, attempt: 1 });
  return result.metadata.structureProfile as DatasetStructureProfile;
}

function normalizeSource(context: PipelineContext): NormalizedSource {
  const sourceType = detectSourceType(context);
  const rawBytes = normalizeRawBytes(context.dataset.rawBuffer, context.dataset.rawText);
  const rawText = context.dataset.rawText ?? bytesToString(rawBytes);
  const fileName = context.dataset.fileName ?? context.dataset.name ?? null;
  const mimeType = context.dataset.mimeType ?? null;
  const size = context.dataset.fileSize ?? rawBytes.byteLength ?? rawText.length;

  if (sourceType === "excel" && rawBytes.byteLength > 0) {
    return {
      type: "excel",
      worksheets: readExcelWorksheets(rawBytes),
      rawText,
      rawBytes,
      fileName,
      mimeType,
      size,
    };
  }

  if (context.dataset.rows && context.dataset.rows.length > 0) {
    return {
      type: sourceType === "unknown" ? "csv" : sourceType,
      worksheets: [rowsToWorksheet("Sheet1", context.dataset.rows, context.dataset.columns)],
      rawText,
      rawBytes,
      fileName,
      mimeType,
      size,
    };
  }

  return {
    type: sourceType === "unknown" ? "csv" : sourceType,
    worksheets: [parseCsvWorksheet(rawText)],
    rawText,
    rawBytes,
    fileName,
    mimeType,
    size,
  };
}

function readExcelWorksheets(rawBytes: Uint8Array): SourceWorksheet[] {
  const workbook = XLSX.read(rawBytes, { type: "array", cellFormula: true, cellHTML: false, cellNF: false, cellStyles: true, cellDates: false });

  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: true, defval: EMPTY_CELL, raw: false });
    const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
    const rowMetadata = sheet["!rows"] ?? [];
    const columnMetadata = sheet["!cols"] ?? [];
    const merges = (sheet["!merges"] ?? []).map((merge) => ({
      rowStart: merge.s.r + 1,
      rowEnd: merge.e.r + 1,
      columnStart: merge.s.c + 1,
      columnEnd: merge.e.c + 1,
    }));
    const hiddenRows = rowMetadata.map((row, index) => (row?.hidden ? index + 1 : null)).filter(isNumber);
    const hiddenColumns = columnMetadata.map((column, index) => (column?.hidden ? index + 1 : null)).filter(isNumber);
    const comments: SourceWorksheet["comments"] = [];
    const formulas: SourceWorksheet["formulas"] = [];

    if (range) {
      for (let row = range.s.r; row <= range.e.r; row += 1) {
        for (let column = range.s.c; column <= range.e.c; column += 1) {
          const address = XLSX.utils.encode_cell({ r: row, c: column });
          const cell = sheet[address] as XLSX.CellObject | undefined;

          if (!cell) {
            continue;
          }

          if (cell.f) {
            formulas.push({ row: row + 1, column: column + 1, formula: cell.f });
          }

          const commentText = Array.isArray(cell.c) ? cell.c.map((comment) => comment.t).filter(Boolean).join(" ") : "";

          if (commentText) {
            comments.push({ row: row + 1, column: column + 1, text: commentText });
          }
        }
      }
    }

    return {
      name: sheetName,
      rows: normalizeMatrixRows(rows),
      merges,
      hiddenRows,
      hiddenColumns,
      comments,
      formulas,
    };
  });
}

function parseCsvWorksheet(rawText: string): SourceWorksheet {
  const delimiter = detectDelimiter(rawText, "csv").value;
  const parsed = Papa.parse<string[]>(rawText, {
    delimiter: delimiter || "",
    skipEmptyLines: false,
  });

  return {
    name: "Sheet1",
    rows: normalizeMatrixRows(parsed.data),
    merges: [],
    hiddenRows: [],
    hiddenColumns: [],
    comments: [],
    formulas: [],
  };
}

function rowsToWorksheet(
  name: string,
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
  providedColumns?: ReadonlyArray<string>,
): SourceWorksheet {
  const columns = providedColumns && providedColumns.length > 0 ? [...providedColumns] : Object.keys(rows[0] ?? {});
  const matrix = [columns, ...rows.map((row) => columns.map((column) => row[column] ?? EMPTY_CELL))];

  return {
    name,
    rows: matrix,
    merges: [],
    hiddenRows: [],
    hiddenColumns: [],
    comments: [],
    formulas: [],
  };
}

function buildWorksheetProfile(
  worksheet: SourceWorksheet,
  index: number,
  separators: { decimalSeparator: string; thousandsSeparator: string },
): WorksheetStructureProfile {
  const rows = normalizeMatrixRows(worksheet.rows);
  const nonEmptyRows = rows.map((row, rowIndex) => ({ row, rowIndex })).filter(({ row }) => !isRowEmpty(row));
  const columnCount = getMaxColumnCount(rows);
  const density = calculateDensity(rows, columnCount);
  const emptyRows = rows.map((row, rowIndex) => (isRowEmpty(row) ? rowIndex + 1 : null)).filter(isNumber);
  const emptyColumns = detectEmptyColumns(rows, columnCount);
  const region = detectDatasetRegion(rows);
  const headerIndex = Math.max(0, region.headerRow.value - 1);
  const firstDataIndex = Math.max(headerIndex + 1, region.firstDataRow.value - 1);
  const lastDataIndex = Math.max(firstDataIndex - 1, region.lastDataRow.value - 1);
  const header = rows[headerIndex] ?? [];
  const normalizedHeaders = normalizeHeaders(header, columnCount);
  const bodyRows = rows.slice(firstDataIndex, lastDataIndex + 1).slice(0, PROFILE_SAMPLE_LIMIT);
  const columns = normalizedHeaders.map((headerName, columnIndex) =>
    buildColumnProfile(headerName, columnIndex, bodyRows, separators),
  );
  const duplicateColumns = findDuplicateHeaders(normalizedHeaders);
  const duplicateRows = countDuplicateRows(bodyRows);
  const sparseRegions = detectSparseRegions(rows, columnCount);
  const warnings = [
    ...duplicateColumns.map((column) => `Duplicate column detected: ${column}`),
    ...(density < 0.4 ? ["Worksheet contains sparse data."] : []),
    ...(region.headerRow.confidence < 0.75 ? ["Header row detection has reduced confidence."] : []),
    ...columns.flatMap((column) => column.potentialProblems.map((problem) => `${column.name}: ${problem}`)),
  ];
  const errors: string[] = [];
  const healthScore = calculateWorksheetHealthScore({
    density,
    duplicateColumns,
    duplicateRows,
    columns,
    sparseRegions,
    rowCount: rows.length,
  });
  const confidence = average([
    region.headerRow.confidence,
    region.dataRegion.confidence,
    density >= 0.2 ? 0.9 : 0.6,
    duplicateColumns.length === 0 ? 0.95 : 0.7,
    healthScore / 100,
  ]);

  return {
    name: worksheet.name,
    index,
    rowCount: nonEmptyRows.length,
    columnCount,
    dataDensity: density,
    confidence,
    healthScore,
    duplicateColumns,
    duplicateRows,
    mergedCells: worksheet.merges,
    hiddenRows: worksheet.hiddenRows,
    hiddenColumns: worksheet.hiddenColumns,
    emptyRows,
    emptyColumns,
    sparseRegions,
    comments: worksheet.comments,
    formulas: worksheet.formulas,
    region,
    columns,
    warnings,
    errors,
  };
}

function buildColumnProfile(
  name: string,
  columnIndex: number,
  bodyRows: unknown[][],
  separators: { decimalSeparator: string; thousandsSeparator: string },
): DatasetColumnProfile {
  const values = bodyRows.map((row) => normalizeCell(row[columnIndex]));
  const nonMissingValues = values.filter((value) => !isMissing(value));
  const missingCount = values.length - nonMissingValues.length;
  const uniqueValues = new Set(nonMissingValues.map((value) => String(value).trim()));
  const stringLengths = nonMissingValues.map((value) => String(value).length);
  const detectedDataType = detectColumnType(nonMissingValues, separators);
  const potentialProblems = detectColumnProblems({
    name,
    values,
    nonMissingValues,
    detectedDataType,
  });

  return {
    name,
    position: columnIndex + 1,
    detectedDataType,
    missingPercent: ratioPercent(missingCount, values.length),
    uniquePercent: ratioPercent(uniqueValues.size, nonMissingValues.length),
    nullPercent: ratioPercent(missingCount, values.length),
    sampleValues: nonMissingValues.slice(0, DISPLAY_SAMPLE_LIMIT),
    exampleValues: uniqueSample(nonMissingValues, DISPLAY_SAMPLE_LIMIT),
    maximumLength: stringLengths.length > 0 ? Math.max(...stringLengths) : 0,
    minimumLength: stringLengths.length > 0 ? Math.min(...stringLengths) : 0,
    potentialProblems,
  };
}

function detectDatasetRegion(rows: unknown[][]): DatasetRegionProfile {
  const candidates = rows.map((row, index) => ({
    index,
    score: scoreHeaderCandidate(row, rows[index + 1], rows[index + 2]),
  }));
  const best = candidates.reduce((winner, candidate) => (candidate.score > winner.score ? candidate : winner), {
    index: 0,
    score: 0,
  });
  const headerIndex = best.index;
  const firstDataIndex = findFirstDataRow(rows, headerIndex + 1);
  const lastDataIndex = findLastDataRow(rows, firstDataIndex);
  const footerRows = rows
    .map((row, index) => (index > lastDataIndex && !isRowEmpty(row) ? index + 1 : null))
    .filter(isNumber);
  const columnCount = getMaxColumnCount(rows);
  const confidence = clamp(best.score);

  return {
    headerRow: {
      value: headerIndex + 1,
      confidence,
      warnings: confidence < 0.75 ? ["Header row candidate is ambiguous."] : [],
      errors: [],
    },
    firstDataRow: {
      value: firstDataIndex + 1,
      confidence: firstDataIndex > headerIndex ? 0.9 : 0.6,
      warnings: firstDataIndex > headerIndex ? [] : ["First data row is ambiguous."],
      errors: [],
    },
    lastDataRow: {
      value: lastDataIndex + 1,
      confidence: lastDataIndex >= firstDataIndex ? 0.9 : 0.6,
      warnings: lastDataIndex >= firstDataIndex ? [] : ["Last data row is ambiguous."],
      errors: [],
    },
    footerRows: {
      value: footerRows,
      confidence: footerRows.length > 0 ? 0.85 : 0.75,
      warnings: footerRows.length > 0 ? ["Footer or notes rows were detected after the data body."] : [],
      errors: [],
    },
    dataRegion: {
      value: {
        rowStart: headerIndex + 1,
        rowEnd: lastDataIndex + 1,
        columnStart: 1,
        columnEnd: columnCount,
      },
      confidence: average([confidence, lastDataIndex >= firstDataIndex ? 0.9 : 0.6]),
      warnings: [],
      errors: [],
    },
  };
}

function scoreHeaderCandidate(row: unknown[], nextRow?: unknown[], followingRow?: unknown[]): number {
  if (isRowEmpty(row)) {
    return 0;
  }

  const cells = row.map(normalizeCell).filter((cell) => !isMissing(cell));
  const nextCells = (nextRow ?? []).map(normalizeCell).filter((cell) => !isMissing(cell));
  const followingCells = (followingRow ?? []).map(normalizeCell).filter((cell) => !isMissing(cell));
  const textRatio = ratio(cells.filter((cell) => isProbablyHeaderText(cell)).length, cells.length);
  const currentDataRatio = ratio(cells.filter((cell) => !isProbablyHeaderText(cell)).length, cells.length);
  const uniqueness = ratio(new Set(cells.map((cell) => String(cell).toLowerCase())).size, cells.length);
  const nextDataRatio = ratio(nextCells.filter((cell) => !isProbablyHeaderText(cell) || looksLikeIdentifier(cell)).length, nextCells.length);
  const followingDataRatio = ratio(followingCells.filter((cell) => !isProbablyHeaderText(cell) || looksLikeIdentifier(cell)).length, followingCells.length);
  const widthScore = Math.min(1, cells.length / 3);
  const nonTitlePenalty = cells.length <= 2 ? 0.35 : 0;
  const dataRowPenalty = currentDataRatio * 0.4;
  const score = textRatio * 0.3 + uniqueness * 0.25 + nextDataRatio * 0.25 + followingDataRatio * 0.1 + widthScore * 0.1 - nonTitlePenalty - dataRowPenalty;

  return clamp(score);
}

function findFirstDataRow(rows: unknown[][], startIndex: number): number {
  for (let index = startIndex; index < rows.length; index += 1) {
    const row = rows[index];

    if (!isRowEmpty(row) && !isFooterRow(row)) {
      return index;
    }
  }

  return startIndex;
}

function findLastDataRow(rows: unknown[][], startIndex: number): number {
  let lastDataIndex = startIndex;

  for (let index = startIndex; index < rows.length; index += 1) {
    const row = rows[index];

    if (isRowEmpty(row)) {
      const remainingNonEmpty = rows.slice(index + 1).some((remainingRow) => !isRowEmpty(remainingRow));

      if (!remainingNonEmpty) {
        break;
      }

      continue;
    }

    if (isFooterRow(row)) {
      break;
    }

    lastDataIndex = index;
  }

  return lastDataIndex;
}

function isFooterRow(row: unknown[]): boolean {
  const cells = row.map(normalizeCell).filter((cell) => !isMissing(cell));
  const first = String(cells[0] ?? "").trim().toLowerCase();

  return /^(total|subtotal|grand total|notes?|generated|report total)\b/.test(first);
}

function detectColumnType(values: unknown[], separators: { decimalSeparator: string; thousandsSeparator: string }): DetectionConfidence<StructureDataType> {
  if (values.length === 0) {
    return { value: "Unknown", confidence: 0.5, warnings: ["Column contains no profileable values."], errors: [] };
  }

  const counts = new Map<StructureDataType, number>();

  for (const value of values.slice(0, PROFILE_SAMPLE_LIMIT)) {
    const detected = detectValueType(value, separators);
    counts.set(detected, (counts.get(detected) ?? 0) + 1);
  }

  const sorted = Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  const [primaryType, primaryCount] = sorted[0] ?? ["Unknown", 0];
  const confidence = ratio(primaryCount, values.length);
  const meaningfulTypes = sorted.filter(([type]) => type !== "Unknown");
  const type = meaningfulTypes.length > 1 && confidence < 0.85 ? "Mixed" : primaryType;

  return {
    value: type,
    confidence: type === "Mixed" ? Math.max(0.55, 1 - confidence) : clamp(confidence),
    warnings: type === "Mixed" ? [`Mixed data types detected: ${meaningfulTypes.map(([value]) => value).join(", ")}`] : [],
    errors: [],
  };
}

function detectValueType(value: unknown, separators: { decimalSeparator: string; thousandsSeparator: string }): StructureDataType {
  const text = String(value ?? "").trim();

  if (!text) return "Unknown";
  if (isUuid(text)) return "UUID";
  if (isEmail(text)) return "Email";
  if (isUrl(text)) return "URL";
  if (isJson(text)) return "JSON";
  if (isBoolean(text)) return "Boolean";
  if (isPercentage(text, separators)) return "Percentage";
  if (isCurrency(text, separators)) return "Currency";
  if (isDateTime(text)) return "DateTime";
  if (isTime(text)) return "Time";
  if (isDateOnly(text)) return "Date";
  if (isDecimal(text, separators)) return "Decimal";
  if (isInteger(text, separators)) return "Integer";
  if (isPhone(text)) return "Phone";
  return "Text";
}

function buildDatasetHealthReport(
  worksheets: WorksheetStructureProfile[],
  encoding: DetectionConfidence<string>,
): DatasetHealthReport {
  const columns = worksheets.flatMap((worksheet) => worksheet.columns.map((column) => ({ ...column, worksheet: worksheet.name })));
  const missingValues = columns.reduce((sum, column) => sum + Math.round((column.missingPercent / 100) * 100), 0);
  const duplicateRows = worksheets.reduce((sum, worksheet) => sum + worksheet.duplicateRows, 0);
  const duplicateColumns = uniqueStrings(worksheets.flatMap((worksheet) => worksheet.duplicateColumns));
  const mixedDataTypes = columns.filter((column) => column.detectedDataType.value === "Mixed").map((column) => `${column.worksheet}.${column.name}`);
  const brokenDates = columns
    .filter((column) => column.detectedDataType.value === "Date" || column.detectedDataType.value === "DateTime")
    .filter((column) => column.detectedDataType.confidence < 0.8)
    .map((column) => `${column.worksheet}.${column.name}`);
  const unexpectedNullRatios = columns.filter((column) => column.nullPercent > 50).map((column) => `${column.worksheet}.${column.name}`);
  const sparseData = worksheets.some((worksheet) => worksheet.dataDensity < 0.4 || worksheet.sparseRegions.length > 0);
  const outlierColumns = columns
    .filter((column) => column.maximumLength > 500 || column.uniquePercent > 98 || column.missingPercent > 80)
    .map((column) => `${column.worksheet}.${column.name}`);
  const warnings = [
    ...(duplicateColumns.length > 0 ? ["Duplicate columns detected."] : []),
    ...(duplicateRows > 0 ? ["Duplicate rows detected."] : []),
    ...(mixedDataTypes.length > 0 ? ["Mixed data types detected."] : []),
    ...(unexpectedNullRatios.length > 0 ? ["Unexpected null ratios detected."] : []),
    ...(sparseData ? ["Sparse data detected."] : []),
    ...encoding.warnings,
  ];
  const errors = [...encoding.errors];
  const recommendations = [
    ...(duplicateColumns.length > 0 ? ["Rename duplicate columns before downstream analysis."] : []),
    ...(duplicateRows > 0 ? ["Review duplicate rows before calculating totals."] : []),
    ...(mixedDataTypes.length > 0 ? ["Normalize mixed-type columns before semantic analysis."] : []),
    ...(unexpectedNullRatios.length > 0 ? ["Check high-null columns for optional or shifted data."] : []),
    ...(sparseData ? ["Review sparse regions and remove explanatory blank areas when possible."] : []),
    ...(encoding.errors.length > 0 ? ["Re-upload the file with valid UTF-8 or UTF-16 encoding."] : []),
  ];
  const penalty =
    duplicateColumns.length * 8 +
    Math.min(25, duplicateRows * 2) +
    mixedDataTypes.length * 6 +
    unexpectedNullRatios.length * 4 +
    (sparseData ? 10 : 0) +
    (encoding.errors.length > 0 ? 25 : 0);

  return {
    missingValues,
    duplicateRows,
    duplicateColumns,
    invalidEncoding: encoding.errors.length > 0,
    mixedDataTypes,
    brokenDates,
    unexpectedNullRatios,
    sparseData,
    outlierColumns,
    qualityScore: Math.max(0, Math.min(100, Math.round(100 - penalty))),
    warnings,
    errors,
    recommendations,
  };
}

function buildMetadata(input: {
  context: PipelineContext;
  source: NormalizedSource;
  encoding: DetectionConfidence<string>;
  language: DetectionConfidence<string>;
  timezone: DetectionConfidence<string>;
  fileHash: string;
  fingerprint: string;
  rowCount: number;
  columnCount: number;
}): DatasetStructureMetadata {
  return {
    datasetId: input.context.dataset.id ?? null,
    fileHash: input.fileHash,
    fingerprint: input.fingerprint,
    created: input.context.dataset.createdAt ?? null,
    imported: input.context.dataset.importedAt ?? new Date().toISOString(),
    source: input.source.type,
    encoding: input.encoding,
    language: input.language,
    timezone: input.timezone,
    size: input.source.size,
    rows: input.rowCount,
    columns: input.columnCount,
    checksum: input.fileHash,
    fileName: input.source.fileName,
    mimeType: input.source.mimeType,
    futureSources: SUPPORTED_FUTURE_SOURCES,
  };
}

function buildDatasetFingerprint(input: {
  sourceType: DatasetPhysicalSourceType;
  encoding: string;
  worksheets: WorksheetStructureProfile[];
  delimiter: string;
}): string {
  const structuralShape = {
    sourceType: input.sourceType,
    encoding: input.encoding,
    delimiter: input.delimiter,
    worksheets: input.worksheets.map((worksheet) => ({
      name: worksheet.name,
      rows: worksheet.rowCount,
      columns: worksheet.columnCount,
      headerRow: worksheet.region.headerRow.value,
      firstDataRow: worksheet.region.firstDataRow.value,
      headers: worksheet.columns.map((column) => column.name.toLowerCase()),
      types: worksheet.columns.map((column) => column.detectedDataType.value),
      mergedCells: worksheet.mergedCells.length,
      hiddenRows: worksheet.hiddenRows.length,
      hiddenColumns: worksheet.hiddenColumns.length,
    })),
  };

  return hashText(JSON.stringify(structuralShape));
}

function detectSourceType(context: PipelineContext): DatasetPhysicalSourceType {
  const fileName = `${context.dataset.fileName ?? context.dataset.name ?? ""}`.toLowerCase();
  const mimeType = `${context.dataset.mimeType ?? ""}`.toLowerCase();
  const sourceType = `${context.dataset.sourceType ?? ""}`.toLowerCase();

  if (sourceType === "csv" || fileName.endsWith(".csv") || mimeType.includes("csv")) return "csv";
  if (sourceType === "excel" || /\.(xlsx|xlsm|xls)$/.test(fileName) || mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "excel";
  if (sourceType === "pdf" || fileName.endsWith(".pdf") || mimeType.includes("pdf")) return "pdf";
  if (sourceType === "image" || /\.(png|jpg|jpeg|webp|gif|tiff)$/.test(fileName) || mimeType.startsWith("image/")) return "image";
  if (sourceType === "sql") return "sql";
  if (sourceType === "snowflake") return "snowflake";
  if (sourceType === "api") return "api";
  return "unknown";
}

function detectEncoding(bytes: Uint8Array, text: string): DetectionConfidence<string> {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { value: "utf-8-bom", confidence: 0.99, warnings: [], errors: [] };
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { value: "utf-16le", confidence: 0.98, warnings: [], errors: [] };
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { value: "utf-16be", confidence: 0.98, warnings: [], errors: [] };
  }

  if (text.includes("\uFFFD")) {
    return {
      value: "unknown",
      confidence: 0.3,
      warnings: ["Replacement characters indicate possible invalid encoding."],
      errors: ["Invalid or unsupported text encoding detected."],
    };
  }

  return { value: "utf-8", confidence: 0.9, warnings: [], errors: [] };
}

function detectDelimiter(rawText: string, sourceType: DatasetPhysicalSourceType): DetectionConfidence<string> {
  if (sourceType !== "csv") {
    return { value: "", confidence: 0.95, warnings: [], errors: [] };
  }

  const lines = rawText.split(/\r?\n/).filter((line) => line.trim()).slice(0, 20);
  const delimiters = [",", ";", "\t", "|"];
  const scored = delimiters.map((delimiter) => {
    const counts = lines.map((line) => (line.match(new RegExp(escapeRegExp(delimiter), "g")) ?? []).length);
    const positiveCounts = counts.filter((count) => count > 0);
    const coverage = ratio(positiveCounts.length, lines.length);
    const consistency = positiveCounts.length > 0 ? 1 - standardDeviation(positiveCounts) / Math.max(1, average(positiveCounts)) : 0;
    const width = average(positiveCounts);
    return { delimiter, score: Math.max(0, consistency) * 0.5 + Math.min(1, width / 3) * 0.3 + coverage * 0.2 };
  });
  const best = scored.sort((left, right) => right.score - left.score)[0];

  if (!best || best.score === 0) {
    return { value: ",", confidence: 0.45, warnings: ["Delimiter detection fell back to comma."], errors: [] };
  }

  return { value: best.delimiter, confidence: clamp(best.score), warnings: best.score < 0.7 ? ["Delimiter detection has reduced confidence."] : [], errors: [] };
}

function detectDecimalSeparator(worksheets: SourceWorksheet[]): DetectionConfidence<string> {
  const values = flattenWorksheetValues(worksheets);
  const commaDecimals = values.filter((value) => /^\d{1,3}(?:\.\d{3})*,\d+$/.test(String(value))).length;
  const dotDecimals = values.filter((value) => /^\d{1,3}(?:,\d{3})*\.\d+$/.test(String(value)) || /^\d+\.\d+$/.test(String(value))).length;

  if (commaDecimals > dotDecimals) {
    return { value: ",", confidence: ratio(commaDecimals, commaDecimals + dotDecimals), warnings: [], errors: [] };
  }

  return { value: ".", confidence: dotDecimals > 0 ? ratio(dotDecimals, commaDecimals + dotDecimals) : 0.75, warnings: [], errors: [] };
}

function detectThousandsSeparator(worksheets: SourceWorksheet[]): DetectionConfidence<string> {
  const values = flattenWorksheetValues(worksheets);
  const commaThousands = values.filter((value) => /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(String(value))).length;
  const dotThousands = values.filter((value) => /^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(String(value))).length;

  if (dotThousands > commaThousands) {
    return { value: ".", confidence: ratio(dotThousands, commaThousands + dotThousands), warnings: [], errors: [] };
  }

  return { value: ",", confidence: commaThousands > 0 ? ratio(commaThousands, commaThousands + dotThousands) : 0.65, warnings: [], errors: [] };
}

function detectLanguage(rawText: string, worksheets: SourceWorksheet[]): DetectionConfidence<string> {
  const text = rawText || flattenWorksheetValues(worksheets).slice(0, 200).join(" ");

  if (/[àâçéèêëîïôùûüÿœ]/i.test(text)) return { value: "fr", confidence: 0.7, warnings: [], errors: [] };
  if (/[äöüß]/i.test(text)) return { value: "de", confidence: 0.7, warnings: [], errors: [] };
  if (/[áéíñóúü]/i.test(text)) return { value: "es", confidence: 0.7, warnings: [], errors: [] };

  return { value: "en", confidence: 0.6, warnings: ["Language detection uses lightweight structural heuristics."], errors: [] };
}

function detectTimezone(rawText: string): DetectionConfidence<string> {
  const timezoneMatch = rawText.match(/\b(?:UTC|GMT)[+-]?\d{0,2}:?\d{0,2}\b|\b[A-Z][A-Za-z_]+\/[A-Z][A-Za-z_]+\b/);

  if (timezoneMatch) {
    return { value: timezoneMatch[0], confidence: 0.85, warnings: [], errors: [] };
  }

  return { value: "unknown", confidence: 0.5, warnings: ["No timezone marker detected in dataset structure."], errors: [] };
}

function createDetectionStepRunner(): DetectionStepRunner {
  const events: StructureDetectionLog[] = [];

  return {
    run<T>(step: string, detect: () => DetectionConfidence<T>): DetectionConfidence<T> {
      const startedAt = new Date().toISOString();
      const startedAtMs = Date.now();
      events.push({
        step,
        status: "started",
        startedAt,
        duration: 0,
        confidence: 0,
        warnings: [],
        errors: [],
      });

      const result = detect();
      events.push({
        step,
        status: "finished",
        startedAt,
        finishedAt: new Date().toISOString(),
        duration: Date.now() - startedAtMs,
        confidence: result.confidence,
        warnings: result.warnings,
        errors: result.errors,
      });
      return result;
    },
    logs() {
      return [...events];
    },
  };
}

function normalizeRawBytes(rawBuffer?: Uint8Array | ArrayBuffer, rawText?: string): Uint8Array {
  if (rawBuffer instanceof Uint8Array) {
    return rawBuffer;
  }

  if (rawBuffer instanceof ArrayBuffer) {
    return new Uint8Array(rawBuffer);
  }

  return stringToBytes(rawText ?? "");
}

function normalizeMatrixRows(rows: unknown[][]): unknown[][] {
  const columnCount = getMaxColumnCount(rows);
  return rows.map((row) => {
    const normalized = [...row];
    while (normalized.length < columnCount) {
      normalized.push(EMPTY_CELL);
    }
    return normalized;
  });
}

function normalizeHeaders(header: unknown[], columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, index) => {
    const raw = String(normalizeCell(header[index]) ?? "").trim();
    return raw || `Column ${index + 1}`;
  });
}

function detectEmptyColumns(rows: unknown[][], columnCount: number): number[] {
  return Array.from({ length: columnCount }, (_, index) => {
    const empty = rows.every((row) => isMissing(normalizeCell(row[index])));
    return empty ? index + 1 : null;
  }).filter(isNumber);
}

function detectSparseRegions(rows: unknown[][], columnCount: number): WorksheetStructureProfile["sparseRegions"] {
  if (rows.length < 5 || columnCount < 3) {
    return [];
  }

  const regions: WorksheetStructureProfile["sparseRegions"] = [];
  const windowSize = Math.min(10, rows.length);

  for (let start = 0; start <= rows.length - windowSize; start += windowSize) {
    const windowRows = rows.slice(start, start + windowSize);
    const density = calculateDensity(windowRows, columnCount);

    if (density > 0 && density < 0.25) {
      regions.push({
        rowStart: start + 1,
        rowEnd: start + windowRows.length,
        columnStart: 1,
        columnEnd: columnCount,
        density,
      });
    }
  }

  return regions;
}

function detectColumnProblems(input: {
  name: string;
  values: unknown[];
  nonMissingValues: unknown[];
  detectedDataType: DetectionConfidence<StructureDataType>;
}): string[] {
  const problems = [...input.detectedDataType.warnings];
  const missingPercent = ratioPercent(input.values.length - input.nonMissingValues.length, input.values.length);

  if (missingPercent > 50) {
    problems.push(`High missing value ratio: ${missingPercent}%.`);
  }

  if (input.detectedDataType.value === "Date" || input.detectedDataType.value === "DateTime") {
    const broken = input.nonMissingValues.filter((value) => Number.isNaN(Date.parse(String(value)))).length;

    if (broken > 0) {
      problems.push(`Broken dates detected in ${broken} sampled value(s).`);
    }
  }

  if (/^column \d+$/i.test(input.name)) {
    problems.push("Column header is missing.");
  }

  return uniqueStrings(problems);
}

function calculateWorksheetHealthScore(input: {
  density: number;
  duplicateColumns: string[];
  duplicateRows: number;
  columns: DatasetColumnProfile[];
  sparseRegions: WorksheetStructureProfile["sparseRegions"];
  rowCount: number;
}): number {
  const mixedColumns = input.columns.filter((column) => column.detectedDataType.value === "Mixed").length;
  const highMissingColumns = input.columns.filter((column) => column.missingPercent > 50).length;
  const penalty =
    (input.density < 0.4 ? 12 : 0) +
    input.duplicateColumns.length * 8 +
    Math.min(25, input.duplicateRows * 2) +
    mixedColumns * 7 +
    highMissingColumns * 5 +
    input.sparseRegions.length * 4 +
    (input.rowCount === 0 ? 40 : 0);

  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

function createEmptyWorksheetProfile(): WorksheetStructureProfile {
  const region = detectDatasetRegion([]);
  return {
    name: "Sheet1",
    index: 0,
    rowCount: 0,
    columnCount: 0,
    dataDensity: 0,
    confidence: 0,
    healthScore: 0,
    duplicateColumns: [],
    duplicateRows: 0,
    mergedCells: [],
    hiddenRows: [],
    hiddenColumns: [],
    emptyRows: [],
    emptyColumns: [],
    sparseRegions: [],
    comments: [],
    formulas: [],
    region,
    columns: [],
    warnings: ["No worksheet data detected."],
    errors: [],
  };
}

function flattenWorksheetValues(worksheets: SourceWorksheet[]): unknown[] {
  return worksheets.flatMap((worksheet) => worksheet.rows.flat()).map(normalizeCell).filter((value) => !isMissing(value));
}

function countDuplicateRows(rows: unknown[][]): number {
  const seen = new Set<string>();
  let duplicates = 0;

  for (const row of rows) {
    const key = JSON.stringify(row.map((value) => String(normalizeCell(value)).trim()));
    if (seen.has(key)) {
      duplicates += 1;
    } else {
      seen.add(key);
    }
  }

  return duplicates;
}

function findDuplicateHeaders(headers: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const header of headers) {
    const key = header.trim().toLowerCase();
    if (seen.has(key)) {
      duplicates.add(header);
    } else {
      seen.add(key);
    }
  }

  return Array.from(duplicates);
}

function calculateDensity(rows: unknown[][], columnCount: number): number {
  if (rows.length === 0 || columnCount === 0) {
    return 0;
  }

  const filledCells = rows.reduce((sum, row) => sum + row.filter((cell) => !isMissing(normalizeCell(cell))).length, 0);
  return round(filledCells / (rows.length * columnCount), 3);
}

function normalizeCell(value: unknown): unknown {
  if (value === null || value === undefined) {
    return EMPTY_CELL;
  }

  return value;
}

function isRowEmpty(row: unknown[]): boolean {
  return row.every((cell) => isMissing(normalizeCell(cell)));
}

function isMissing(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

function isProbablyHeaderText(value: unknown): boolean {
  const text = String(value ?? "").trim();
  return Boolean(text) && !isCurrency(text, { decimalSeparator: ".", thousandsSeparator: "," }) && !isDateOnly(text) && !isDateTime(text) && !isBoolean(text) && !isDecimal(text, { decimalSeparator: ".", thousandsSeparator: "," }) && !isInteger(text, { decimalSeparator: ".", thousandsSeparator: "," });
}

function looksLikeIdentifier(value: unknown): boolean {
  return /^[A-Z]{2,}[-_]?\d+|\w+_\d+$/i.test(String(value ?? "").trim());
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhone(value: string): boolean {
  return /^\+?[\d\s().-]{7,}$/.test(value) && /\d{7,}/.test(value.replace(/\D/g, ""));
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isUrl(value: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(value);
}

function isBoolean(value: string): boolean {
  return /^(true|false|yes|no|y|n|0|1)$/i.test(value);
}

function isJson(value: string): boolean {
  if (!/^[\[{]/.test(value)) {
    return false;
  }

  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function isPercentage(value: string, separators: { decimalSeparator: string; thousandsSeparator: string }): boolean {
  return /%$/.test(value) && Number.isFinite(parseNumber(value.replace("%", ""), separators));
}

function isCurrency(value: string, separators: { decimalSeparator: string; thousandsSeparator: string }): boolean {
  return /^[€$£¥]|[€$£¥]$|^[A-Z]{3}\s?\d/.test(value) && Number.isFinite(parseNumber(value.replace(/[€$£¥]|[A-Z]{3}/g, ""), separators));
}

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{1,2}-\d{1,2}$|^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(value)) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

function isDateTime(value: string): boolean {
  if (!/^\d{4}-\d{1,2}-\d{1,2}[ T]\d{1,2}:\d{2}/.test(value)) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

function isTime(value: string): boolean {
  return /^(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?:\s?[AP]M)?$/i.test(value);
}

function isInteger(value: string, separators: { decimalSeparator: string; thousandsSeparator: string }): boolean {
  const parsed = parseNumber(value, separators);
  return Number.isInteger(parsed) && /^[+-]?\d{1,3}(?:[,.]\d{3})*$|^[+-]?\d+$/.test(value.trim());
}

function isDecimal(value: string, separators: { decimalSeparator: string; thousandsSeparator: string }): boolean {
  const parsed = parseNumber(value, separators);
  return Number.isFinite(parsed) && (value.includes(separators.decimalSeparator) || !Number.isInteger(parsed));
}

function parseNumber(value: string, separators: { decimalSeparator: string; thousandsSeparator: string }): number {
  const trimmed = value.trim();
  const withoutThousands = separators.thousandsSeparator
    ? trimmed.replace(new RegExp(`\\${separators.thousandsSeparator}`, "g"), "")
    : trimmed;
  const normalized = withoutThousands.replace(separators.decimalSeparator, ".");
  return Number(normalized.replace(/\s/g, ""));
}

function scoreToGrade(score: number): DatasetStructureProfile["quality"]["grade"] {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 55) return "fair";
  return "poor";
}

function hasRows(context: PipelineContext): boolean {
  return Boolean(context.dataset.rows && context.dataset.rows.length > 0);
}

function hashBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stringToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function bytesToString(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return "";
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function ratio(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return value / total;
}

function ratioPercent(value: number, total: number): number {
  return round(ratio(value, total) * 100, 1);
}

function average(values: number[]): number {
  const finiteValues = values.filter(Number.isFinite);
  if (finiteValues.length === 0) {
    return 0;
  }
  return round(finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length, 3);
}

function standardDeviation(values: number[]): number {
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return round(Math.max(0, Math.min(1, value)), 3);
}

function round(value: number, places: number): number {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}

function uniqueSample(values: unknown[], limit: number): unknown[] {
  const seen = new Set<string>();
  const sample: unknown[] = [];

  for (const value of values) {
    const key = String(value);
    if (!seen.has(key)) {
      seen.add(key);
      sample.push(value);
    }

    if (sample.length >= limit) {
      break;
    }
  }

  return sample;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function getMaxColumnCount(rows: unknown[][]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

function isNumber(value: number | null): value is number {
  return typeof value === "number";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
