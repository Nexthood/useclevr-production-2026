import "server-only";

import { matrixToWorksheetPreview, normalizeRowsAsCsv } from "@/services/clevrsync/normalize";
import type { ClevrSyncDatasetPayload, ClevrSyncPreview } from "@/services/clevrsync/types";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const GOOGLE_SHEETS_MIME = "text/csv";
const DEFAULT_PREVIEW_ROW_LIMIT = 20;

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GoogleSpreadsheet = {
  spreadsheetId: string;
  properties?: { title?: string };
  sheets?: Array<{ properties?: { title?: string; sheetId?: number; index?: number } }>;
};

type GoogleValuesResponse = {
  values?: unknown[][];
  error?: { message?: string; status?: string };
};

export type GoogleSheetsTokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date | null;
  scope?: string;
};

export type GoogleSheetsWorksheet = {
  id: number | null;
  title: string;
  index: number;
};

export type GoogleSheetsSource = {
  spreadsheetId: string;
  spreadsheetName: string;
  worksheetName: string;
  worksheets: GoogleSheetsWorksheet[];
};

export function getGoogleSheetsScope() {
  return GOOGLE_SHEETS_SCOPE;
}

export function buildGoogleSheetsAuthorizationUrl(input: { state: string; redirectUri: string }) {
  const clientId = requiredEnv("GOOGLE_CLEVRSYNC_CLIENT_ID");
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SHEETS_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", input.state);
  return url;
}

export async function exchangeGoogleSheetsCode(input: {
  code: string;
  redirectUri: string;
}): Promise<GoogleSheetsTokenSet> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: requiredEnv("GOOGLE_CLEVRSYNC_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLEVRSYNC_CLIENT_SECRET"),
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  return readTokenResponse(response);
}

export async function refreshGoogleSheetsAccessToken(
  refreshToken: string,
): Promise<GoogleSheetsTokenSet> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requiredEnv("GOOGLE_CLEVRSYNC_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLEVRSYNC_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });

  return readTokenResponse(response);
}

export async function getGoogleSpreadsheetSource(input: {
  accessToken: string;
  spreadsheetId: string;
  worksheetName?: string | null;
}): Promise<GoogleSheetsSource> {
  const spreadsheet = await fetchGoogleSpreadsheet(input.accessToken, input.spreadsheetId);
  const worksheets = (spreadsheet.sheets ?? [])
    .map((sheet, index) => ({
      id: sheet.properties?.sheetId ?? null,
      title: sheet.properties?.title || `Sheet ${index + 1}`,
      index: sheet.properties?.index ?? index,
    }))
    .sort((a, b) => a.index - b.index);
  const selectedWorksheet =
    input.worksheetName && worksheets.some((sheet) => sheet.title === input.worksheetName)
      ? input.worksheetName
      : worksheets[0]?.title;

  if (!selectedWorksheet) {
    throw new Error("Google Sheet contains no worksheets.");
  }

  return {
    spreadsheetId: spreadsheet.spreadsheetId,
    spreadsheetName: spreadsheet.properties?.title || "Google Sheet",
    worksheetName: selectedWorksheet,
    worksheets,
  };
}

export async function previewGoogleSheet(input: {
  accessToken: string;
  spreadsheetId: string;
  worksheetName?: string | null;
  previewRowLimit?: number;
}): Promise<ClevrSyncPreview> {
  const source = await getGoogleSpreadsheetSource(input);
  const matrix = await fetchGoogleSheetValues(
    input.accessToken,
    source.spreadsheetId,
    source.worksheetName,
  );
  const worksheetPreview = matrixToWorksheetPreview({
    name: source.worksheetName,
    matrix,
    previewRowLimit: input.previewRowLimit ?? DEFAULT_PREVIEW_ROW_LIMIT,
  });

  return {
    sourceType: "google_sheets",
    fileName: `${source.spreadsheetName} - ${source.worksheetName}.csv`,
    fileSize: 0,
    mimeType: GOOGLE_SHEETS_MIME,
    activeWorksheet: source.worksheetName,
    worksheets: [worksheetPreview],
    googleSheets: source,
    columns: worksheetPreview.columns,
    rows: worksheetPreview.rows,
    rowCount: worksheetPreview.rowCount,
    columnCount: worksheetPreview.columnCount,
  };
}

export function googleSheetPreviewToCsvFile(preview: ClevrSyncPreview) {
  const columns = preview.columns.map((column) => column.name);
  const csv = normalizeRowsAsCsv(preview.rows, columns);
  return new File([csv], preview.fileName, { type: GOOGLE_SHEETS_MIME });
}

export function googleSheetToDatasetPayload(preview: ClevrSyncPreview): ClevrSyncDatasetPayload {
  const columns = preview.columns.map((column) => column.name);
  return {
    name: preview.fileName.replace(/\.csv$/i, ""),
    fileName: preview.fileName,
    fileSize: preview.fileSize,
    mimeType: preview.mimeType,
    columns,
    rows: preview.rows,
    columnTypes: Object.fromEntries(preview.columns.map((column) => [column.name, column.type])),
    datasetType: "standard",
    source: "clevrsync",
  };
}

export function parseGoogleSpreadsheetId(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match?.[1]) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  throw new Error("Enter a valid Google Sheets URL or spreadsheet ID.");
}

async function fetchGoogleSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
): Promise<GoogleSpreadsheet> {
  const url = new URL(`${GOOGLE_SHEETS_API}/${encodeURIComponent(spreadsheetId)}`);
  url.searchParams.set("includeGridData", "false");
  url.searchParams.set(
    "fields",
    "spreadsheetId,properties.title,sheets.properties(sheetId,title,index)",
  );

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return readGoogleResponse<GoogleSpreadsheet>(response, "Unable to access this Google Sheet.");
}

async function fetchGoogleSheetValues(
  accessToken: string,
  spreadsheetId: string,
  worksheetName: string,
) {
  const range = `'${worksheetName.replace(/'/g, "''")}'`;
  const url = new URL(
    `${GOOGLE_SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
  );
  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
  url.searchParams.set("dateTimeRenderOption", "FORMATTED_STRING");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await readGoogleResponse<GoogleValuesResponse>(
    response,
    "Unable to read Google Sheet values.",
  );
  return payload.values ?? [];
}

async function readGoogleResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const status = response.status === 401 ? "reconnect_required" : "error";
    const message =
      typeof payload?.error?.message === "string" ? payload.error.message : fallbackMessage;
    throw new GoogleSheetsProviderError(status, message);
  }
  return payload as T;
}

async function readTokenResponse(response: Response): Promise<GoogleSheetsTokenSet> {
  const payload = (await response.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new GoogleSheetsProviderError(
      "reconnect_required",
      "Google Sheets authorization failed.",
    );
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt:
      typeof payload.expires_in === "number"
        ? new Date(Date.now() + payload.expires_in * 1000)
        : null,
    scope: payload.scope,
  };
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export class GoogleSheetsProviderError extends Error {
  readonly connectorStatus: "error" | "reconnect_required";

  constructor(connectorStatus: "error" | "reconnect_required", message: string) {
    super(message);
    this.name = "GoogleSheetsProviderError";
    this.connectorStatus = connectorStatus;
  }
}
