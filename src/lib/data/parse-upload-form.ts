import { debugLog } from "@/lib/utils/debug";
import { parse } from "papaparse";
import {
  assertStandardUploadFile,
  getStandardUploadFileKind,
  uploadValidationErrorPayload,
} from "@/lib/upload/upload-security";

export interface ParsedUpload {
  file: File;
  fileText: string;
  headers: string[];
  rawRows: Record<string, unknown>[];
  delimiter: string;
}

export async function parseUploadForm(request: Request): Promise<ParsedUpload> {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    throw new UploadFormError("No file provided");
  }

  try {
    await assertStandardUploadFile(file);
  } catch (error) {
    const payload = uploadValidationErrorPayload(error, "UPLOAD_FILE_TYPE_INVALID");
    throw new UploadFormError(`${payload.code}|${payload.message}`);
  }

  if (getStandardUploadFileKind(file.name) !== "csv") {
    throw new UploadFormError("Only CSV files allowed");
  }

  debugLog("[UPLOAD] Parsing CSV");

  const fileBuffer = await file.arrayBuffer();
  const fileText = Buffer.from(fileBuffer).toString("utf-8");

  debugLog("[UPLOAD] File size:", file.size, "bytes");
  debugLog("[UPLOAD] File text length:", fileText.length, "chars");

  const delimiter = detectDelimiter(fileText);

  const parseResult = parse<Record<string, unknown>>(fileText, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: true,
    transformHeader: (h: string) =>
      h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
    delimiter,
  });

  debugLog(
    "Parsed rows:",
    parseResult.data.length,
    "First row:",
    parseResult.data[0],
  );
  debugLog(
    "[PARSER] Headers detected:",
    parseResult.meta.fields?.length || 0,
  );

  const rawRows = parseResult.data;
  const headers = parseResult.meta.fields || [];

  if (rawRows.length === 0) {
    throw new UploadFormError("CSV has no data rows");
  }

  if (headers.length === 0) {
    throw new UploadFormError("CSV has no headers detected");
  }

  return { file, fileText, headers, rawRows, delimiter };
}

export class UploadFormError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadFormError";
  }
}

function detectDelimiter(text: string): string {
  const firstLines = text.split("\n").slice(0, 5).join("\n");

  const delimiters = [",", ";", "\t", "|"];
  const counts = delimiters.map((d) => ({
    delimiter: d,
    count: (
      firstLines.match(
        new RegExp(d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      ) || []
    ).length,
  }));

  const best = counts.reduce((a, b) => (a.count > b.count ? a : b));

  debugLog(
    "[DELIMITER] Delimiter counts:",
    counts.map((c) => `${c.delimiter}: ${c.count}`).join(", "),
  );
  debugLog(
    "[DELIMITER] Selected:",
    best.delimiter === "\t" ? "tab" : best.delimiter,
  );

  return best.delimiter;
}
