import "server-only";

import { matrixToWorksheetPreview, normalizeRowsAsCsv } from "@/services/clevrsync/normalize";
import type { ClevrSyncDatasetPayload, ClevrSyncPreview } from "@/services/clevrsync/types";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const GOOGLE_DRIVE_METADATA_SCOPE = "https://www.googleapis.com/auth/drive.metadata.readonly";
const GOOGLE_SHEETS_MIME = "text/csv";
const GOOGLE_SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet";
const DEFAULT_LIST_PAGE_SIZE = 30;
const MAX_LIST_PAGE_SIZE = 100;
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

type GoogleDriveFile = {
  id?: string;
  name?: string;
  modifiedTime?: string;
  shared?: boolean;
  ownedByMe?: boolean;
};

type GoogleDriveListResponse = {
  nextPageToken?: string;
  files?: GoogleDriveFile[];
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

export type GoogleSpreadsheetSummary = {
  id: string;
  name: string;
  modifiedTime: string | null;
  shared: boolean;
  ownedByMe: boolean;
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

export function getGoogleSheetsScopes() {
  return [GOOGLE_SHEETS_SCOPE, GOOGLE_DRIVE_METADATA_SCOPE];
}

export function requiresSpreadsheetListingScope(scope?: string | null) {
  return !scope?.includes(GOOGLE_DRIVE_METADATA_SCOPE);
}

export function buildGoogleSheetsAuthorizationUrl(input: { state: string; redirectUri: string }) {
  const clientId = requiredEnv("GOOGLE_CLEVRSYNC_CLIENT_ID");
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", getGoogleSheetsScopes().join(" "));
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
  const worksheets = mapGoogleWorksheets(spreadsheet);
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

export async function getGoogleSpreadsheetWorksheets(input: {
  accessToken: string;
  spreadsheetId: string;
}): Promise<{
  spreadsheetId: string;
  spreadsheetName: string;
  worksheets: GoogleSheetsWorksheet[];
}> {
  const spreadsheet = await fetchGoogleSpreadsheet(input.accessToken, input.spreadsheetId);
  return {
    spreadsheetId: spreadsheet.spreadsheetId,
    spreadsheetName: spreadsheet.properties?.title || "Google Sheet",
    worksheets: mapGoogleWorksheets(spreadsheet),
  };
}

export function buildGoogleDriveListUrl(input: {
  search?: string | null;
  pageSize?: number;
  pageToken?: string | null;
}) {
  const url = new URL(GOOGLE_DRIVE_API);
  const clauses = [`mimeType='${GOOGLE_SPREADSHEET_MIME}'`, "trashed=false"];
  const search = input.search?.trim();
  if (search) {
    clauses.push(`name contains '${escapeDriveQueryValue(search)}'`);
  }
  url.searchParams.set("q", clauses.join(" and "));
  url.searchParams.set("orderBy", "modifiedTime desc");
  url.searchParams.set("pageSize", String(clampListPageSize(input.pageSize)));
  url.searchParams.set(
    "fields",
    "nextPageToken,files(id,name,modifiedTime,shared,ownedByMe)",
  );
  if (input.pageToken) {
    url.searchParams.set("pageToken", input.pageToken);
  }
  return url;
}

export async function listGoogleSpreadsheets(input: {
  accessToken: string;
  search?: string | null;
  pageSize?: number;
  pageToken?: string | null;
}): Promise<{ spreadsheets: GoogleSpreadsheetSummary[]; nextPageToken: string | null }> {
  const url = buildGoogleDriveListUrl(input);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });
  const payload = await readGoogleResponse<GoogleDriveListResponse>(
    response,
    "Unable to list Google Sheets.",
  );
  const spreadsheets = (payload.files ?? [])
    .filter((file): file is GoogleDriveFile & { id: string } => typeof file.id === "string")
    .map((file) => ({
      id: file.id,
      name: file.name?.trim() || "Untitled spreadsheet",
      modifiedTime: typeof file.modifiedTime === "string" ? file.modifiedTime : null,
      shared: file.shared === true,
      ownedByMe: file.ownedByMe !== false,
    }));
  return {
    spreadsheets,
    nextPageToken: typeof payload.nextPageToken === "string" ? payload.nextPageToken : null,
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

function mapGoogleWorksheets(spreadsheet: GoogleSpreadsheet): GoogleSheetsWorksheet[] {
  return (spreadsheet.sheets ?? [])
    .map((sheet, index) => ({
      id: sheet.properties?.sheetId ?? null,
      title: sheet.properties?.title || `Sheet ${index + 1}`,
      index: sheet.properties?.index ?? index,
    }))
    .sort((a, b) => a.index - b.index);
}

function clampListPageSize(pageSize?: number) {
  if (!Number.isFinite(pageSize) || !pageSize || pageSize < 1) return DEFAULT_LIST_PAGE_SIZE;
  return Math.min(Math.floor(pageSize), MAX_LIST_PAGE_SIZE);
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
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
