import "server-only";

import { matrixToWorksheetPreview, normalizeRowsAsCsv } from "@/services/clevrsync/normalize";
import type { ClevrSyncPreview } from "@/services/clevrsync/types";

const MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize";
const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token";
const GRAPH_API_ORIGIN = "https://graph.microsoft.com";

const SCOPE_OFFLINE_ACCESS = "offline_access";
const SCOPE_USER_READ = "User.Read";
const SCOPE_FILES_READ_ALL = "Files.Read.All";
const SCOPE_SITES_READ_ALL = "Sites.Read.All";

const EXCEL_WORKBOOK_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DEFAULT_LIST_PAGE_SIZE = 30;
const MAX_LIST_PAGE_SIZE = 100;
const DEFAULT_PREVIEW_ROW_LIMIT = 20;
const MAX_THROTTLE_RETRIES = 3;
const THROTTLE_MAX_DELAY_MS = 8_000;

export type MicrosoftConnectorType = "onedrive" | "sharepoint";

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

type MicrosoftErrorResponse = {
  error?: { code?: string; message?: string };
};

type GraphItemParent = {
  path?: string;
};

type GraphDriveItem = {
  id?: string;
  name?: string;
  file?: { mimeType?: string };
  size?: number;
  lastModifiedDateTime?: string;
  parentReference?: GraphItemParent;
};

type GraphCollection = {
  value?: Array<GraphDriveItem & Record<string, unknown>>;
  "@odata.nextLink"?: string;
};

type GraphWorksheet = {
  id?: string;
  name?: string;
  position?: number;
};

type GraphWorksheetCollection = {
  value?: GraphWorksheet[];
};

type GraphRangeResponse = {
  values?: unknown[][];
};

type GraphMeResponse = {
  userPrincipalName?: string;
  displayName?: string;
};

export type MicrosoftTokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date | null;
  scope?: string;
};

export type MicrosoftWorkbookSummary = {
  driveId: string | null;
  itemId: string;
  name: string;
  folderPath: string | null;
  lastModified: string | null;
  size: number | null;
};

export type MicrosoftSiteSummary = {
  id: string;
  displayName: string;
  webUrl: string | null;
};

export type MicrosoftDriveSummary = {
  id: string;
  name: string;
  webUrl: string | null;
  driveType: string | null;
  lastModified: string | null;
};

export type MicrosoftWorksheetSummary = {
  id: string;
  name: string;
  position: number;
};

export type MicrosoftWorkbookMeta = {
  driveId: string | null;
  itemId: string;
  workbookName: string;
  folderParentPath: string | null;
  worksheets: MicrosoftWorksheetSummary[];
};

export type MicrosoftPreviewSource = {
  connectorType: MicrosoftConnectorType;
  driveId: string | null;
  itemId: string;
  workbookName: string;
  folderPath: string | null;
  worksheetId: string;
  worksheetName: string;
  worksheets: MicrosoftWorksheetSummary[];
};

/**
 * Delegated, least-privilege Graph scopes.
 * - offline_access: refresh tokens so Sync now can run in the background.
 * - User.Read: identify the signed-in account for the connection label.
 * - Files.Read.All: discover and read Excel workbooks the user can access
 *   (OneDrive and SharePoint document libraries) with no write access.
 * - Sites.Read.All (SharePoint only): discover the SharePoint sites the user
 *   can access. OneDrive users never consent to this extra permission.
 */
export function getMicrosoftScopes(connectorType: MicrosoftConnectorType) {
  const scopes = [SCOPE_OFFLINE_ACCESS, SCOPE_USER_READ, SCOPE_FILES_READ_ALL];
  if (connectorType === "sharepoint") {
    scopes.push(SCOPE_SITES_READ_ALL);
  }
  return scopes;
}

export function getMicrosoftScope(connectorType: MicrosoftConnectorType) {
  return getMicrosoftScopes(connectorType).join(" ");
}

/** True when the granted scope set cannot read files through Microsoft Graph. */
export function requiresMicrosoftFileScope(scope?: string | null) {
  return !hasMicrosoftScope(scope, SCOPE_FILES_READ_ALL);
}

/** True when the granted scope set lacks SharePoint site discovery. */
export function requiresSharePointSitesScope(scope?: string | null) {
  return !hasMicrosoftScope(scope, SCOPE_SITES_READ_ALL);
}

export function hasMicrosoftScope(scope: string | null | undefined, required: string) {
  if (!scope) return false;
  const granted = scope
    .split(/[\s+]+/)
    .filter(Boolean)
    .map((entry) => {
      const withoutPrefix = entry.includes("/") ? entry.slice(entry.lastIndexOf("/") + 1) : entry;
      return withoutPrefix.toLowerCase();
    });
  return granted.includes(required.toLowerCase());
}

export function getMicrosoftTenant() {
  const tenant = process.env.MICROSOFT_CLEVRSYNC_TENANT_ID?.trim();
  return tenant || "common";
}

export function buildMicrosoftAuthorizationUrl(input: {
  state: string;
  redirectUri: string;
  connectorType: MicrosoftConnectorType;
}) {
  const clientId = requiredEnv("MICROSOFT_CLEVRSYNC_CLIENT_ID");
  const url = new URL(MICROSOFT_AUTH_URL.replace("{tenant}", getMicrosoftTenant()));
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", getMicrosoftScopes(input.connectorType).join(" "));
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", input.state);
  return url;
}

export async function exchangeMicrosoftCode(input: {
  code: string;
  redirectUri: string;
  connectorType: MicrosoftConnectorType;
}): Promise<MicrosoftTokenSet> {
  const response = await fetch(tokenEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: requiredEnv("MICROSOFT_CLEVRSYNC_CLIENT_ID"),
      client_secret: requiredEnv("MICROSOFT_CLEVRSYNC_CLIENT_SECRET"),
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
      scope: getMicrosoftScopes(input.connectorType).join(" "),
    }),
  });
  return readMicrosoftTokenResponse(response);
}

export async function refreshMicrosoftAccessToken(
  refreshToken: string,
  connectorType: MicrosoftConnectorType,
): Promise<MicrosoftTokenSet> {
  const response = await fetch(tokenEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requiredEnv("MICROSOFT_CLEVRSYNC_CLIENT_ID"),
      client_secret: requiredEnv("MICROSOFT_CLEVRSYNC_CLIENT_SECRET"),
      grant_type: "refresh_token",
      scope: getMicrosoftScopes(connectorType).join(" "),
    }),
  });
  return readMicrosoftTokenResponse(response);
}

export async function getMicrosoftAccountProfile(accessToken: string) {
  const profile = await graphFetchJson<GraphMeResponse>(
    accessToken,
    "/v1.0/me?$select=userPrincipalName,displayName",
  );
  return profile.userPrincipalName || profile.displayName || null;
}

export async function listOneDriveWorkbooks(input: {
  accessToken: string;
  search?: string | null;
  pageSize?: number;
  pageToken?: string | null;
}): Promise<{ workbooks: MicrosoftWorkbookSummary[]; nextPageToken: string | null }> {
  const search = input.search?.trim();
  const path = search
    ? `/v1.0/me/drive/root/search(q='${escapeODataValue(search)}')`
    : "/v1.0/me/drive/root/children";
  return listGraphWorkbooks({ accessToken: input.accessToken, path, pageSize: input.pageSize, pageToken: input.pageToken });
}

export async function searchSharePointSites(input: {
  accessToken: string;
  search: string;
}): Promise<{ sites: MicrosoftSiteSummary[] }> {
  const search = input.search.trim();
  if (!search) return { sites: [] };
  const url = new URL(`${GRAPH_API_ORIGIN}/v1.0/sites`);
  url.searchParams.set("search", search);
  url.searchParams.set("$select", "id,displayName,webUrl");
  const payload = await graphFetchJson<GraphCollection>(
    input.accessToken,
    `${url.pathname}${url.search}`,
  );
  const sites = (payload.value ?? [])
    .filter((site) => typeof site.id === "string" && isSafeGraphSiteId(site.id))
    .map((site) => ({
      id: site.id as string,
      displayName: sanitizeDisplayName(String(site.displayName ?? site.name ?? ""), "Untitled site"),
      webUrl: typeof site.webUrl === "string" ? site.webUrl : null,
    }));
  return { sites };
}

export async function listSharePointDrives(input: {
  accessToken: string;
  siteId: string;
}): Promise<{ drives: MicrosoftDriveSummary[] }> {
  const siteId = assertSafeGraphSiteId(input.siteId, "SharePoint site");
  const payload = await graphFetchJson<GraphCollection>(
    input.accessToken,
    `/v1.0/sites/${encodeURIComponent(siteId)}/drives?$select=id,name,webUrl,driveType,lastModifiedDateTime`,
  );
  const drives = (payload.value ?? [])
    .filter((drive) => typeof drive.id === "string" && isSafeGraphId(drive.id))
    .map((drive) => ({
      id: drive.id as string,
      name: sanitizeDisplayName(String(drive.name ?? ""), "Document library"),
      webUrl: typeof drive.webUrl === "string" ? drive.webUrl : null,
      driveType: typeof drive.driveType === "string" ? drive.driveType : null,
      lastModified:
        typeof drive.lastModifiedDateTime === "string" ? drive.lastModifiedDateTime : null,
    }));
  return { drives };
}

export async function listSharePointWorkbooks(input: {
  accessToken: string;
  driveId: string;
  search?: string | null;
  pageSize?: number;
  pageToken?: string | null;
}): Promise<{ workbooks: MicrosoftWorkbookSummary[]; nextPageToken: string | null }> {
  const driveId = assertSafeGraphId(input.driveId, "document library");
  const search = input.search?.trim();
  const path = search
    ? `/v1.0/drives/${encodeURIComponent(driveId)}/root/search(q='${escapeODataValue(search)}')`
    : `/v1.0/drives/${encodeURIComponent(driveId)}/root/children`;
  return listGraphWorkbooks({ accessToken: input.accessToken, path, pageSize: input.pageSize, pageToken: input.pageToken });
}

export async function getMicrosoftWorkbookMeta(input: {
  accessToken: string;
  driveId?: string | null;
  itemId: string;
}): Promise<MicrosoftWorkbookMeta> {
  const itemId = assertSafeGraphId(input.itemId, "workbook");
  const base = itemPathBase(input.driveId);
  const workbook = await graphFetchJson<GraphDriveItem>(
    input.accessToken,
    `${itemPath(base, itemId)}?$select=name,parentReference`,
  );
  const worksheetsPayload = await graphFetchJson<GraphWorksheetCollection>(
    input.accessToken,
    `${itemPath(base, itemId)}/workbook/worksheets?$select=id,name,position`,
  );
  const worksheets = (worksheetsPayload.value ?? [])
    .filter((sheet) => typeof sheet.id === "string" && isSafeWorksheetId(sheet.id))
    .map((sheet, index) => ({
      id: sheet.id as string,
      name: sanitizeDisplayName(sheet.name, `Sheet ${index + 1}`),
      position: typeof sheet.position === "number" ? sheet.position : index,
    }))
    .sort((a, b) => a.position - b.position);

  if (worksheets.length === 0) {
    throw new MicrosoftGraphError("error", "The selected workbook contains no worksheets.", "workbook_empty");
  }

  return {
    driveId: input.driveId ?? null,
    itemId,
    workbookName: sanitizeDisplayName(workbook.name, "Workbook"),
    folderParentPath: workbook.parentReference?.path ?? null,
    worksheets,
  };
}

export async function previewMicrosoftWorksheet(input: {
  accessToken: string;
  connectorType: MicrosoftConnectorType;
  driveId?: string | null;
  itemId: string;
  worksheetId?: string | null;
  worksheetName?: string | null;
  previewRowLimit?: number;
}): Promise<ClevrSyncPreview> {
  const meta = await getMicrosoftWorkbookMeta({
    accessToken: input.accessToken,
    driveId: input.driveId,
    itemId: input.itemId,
  });
  const selectedWorksheet =
    (input.worksheetId && meta.worksheets.find((sheet) => sheet.id === input.worksheetId)) ||
    (input.worksheetName && meta.worksheets.find((sheet) => sheet.name === input.worksheetName)) ||
    meta.worksheets[0];

  if (!selectedWorksheet) {
    throw new MicrosoftGraphError("error", "The selected workbook contains no worksheets.", "workbook_empty");
  }

  const matrix = await fetchMicrosoftWorksheetValues({
    accessToken: input.accessToken,
    driveId: input.driveId ?? undefined,
    itemId: input.itemId,
    worksheetId: selectedWorksheet.id,
  });
  const worksheetPreview = matrixToWorksheetPreview({
    name: selectedWorksheet.name,
    matrix,
    previewRowLimit: input.previewRowLimit ?? DEFAULT_PREVIEW_ROW_LIMIT,
  });
  const folderPath = extractFolderPath(meta.folderParentPath);
  return {
    sourceType: input.connectorType,
    fileName: `${meta.workbookName} - ${selectedWorksheet.name}.csv`,
    fileSize: 0,
    mimeType: EXCEL_WORKBOOK_MIME,
    activeWorksheet: selectedWorksheet.name,
    worksheets: [worksheetPreview],
    microsoft: {
      connectorType: input.connectorType,
      driveId: input.driveId ?? null,
      itemId: input.itemId,
      workbookName: meta.workbookName,
      folderPath,
      worksheetId: selectedWorksheet.id,
      worksheetName: selectedWorksheet.name,
      worksheets: meta.worksheets,
    },
    columns: worksheetPreview.columns,
    rows: worksheetPreview.rows,
    rowCount: worksheetPreview.rowCount,
    columnCount: worksheetPreview.columnCount,
  };
}

export function microsoftPreviewToCsvFile(preview: ClevrSyncPreview) {
  const columns = preview.columns.map((column) => column.name);
  const csv = normalizeRowsAsCsv(preview.rows, columns);
  return new File([csv], preview.fileName, { type: "text/csv" });
}

/**
 * Fetches a Graph JSON resource with bounded throttling handling.
 * Retries 429/503/504 responses at most three times while honoring
 * Retry-After, and never loops indefinitely.
 */
export async function graphFetchJson<T>(
  accessToken: string,
  pathAndQuery: string,
): Promise<T> {
  if (!isSafeGraphPath(pathAndQuery)) {
    throw new MicrosoftGraphError("error", "Invalid Microsoft Graph request path.", "invalid_request_path");
  }

  let attempt = 0;
  for (;;) {
    const response = await fetch(`${GRAPH_API_ORIGIN}${pathAndQuery}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (isThrottled(response.status) && attempt < MAX_THROTTLE_RETRIES) {
      await delayMs(throttleDelayMs(response.headers.get("Retry-After"), attempt));
      attempt += 1;
      continue;
    }

    if (response.ok) {
      return (await response.json().catch(() => ({}))) as T;
    }

    const payload = (await response.json().catch(() => ({}))) as MicrosoftErrorResponse;
    const graphCode = payload.error?.code || "";
    if (response.status === 401) {
      throw new MicrosoftGraphError(
        "reconnect_required",
        "Microsoft authorization expired. Reconnect Microsoft to continue.",
        "reconnect_required",
      );
    }
    if (response.status === 403) {
      throw new MicrosoftGraphError(
        "error",
        "UseClevr does not have permission to read this resource with the current Microsoft connection.",
        "insufficient_permission",
      );
    }
    if (response.status === 404 || graphCode === "itemNotFound") {
      throw new MicrosoftGraphError(
        "error",
        "The selected Microsoft file or location no longer exists or is no longer accessible.",
        "not_found",
      );
    }
    if (isThrottled(response.status)) {
      throw new MicrosoftGraphError(
        "error",
        "Microsoft is throttling requests. Try again in a few moments.",
        "provider_throttled",
      );
    }
    if (response.status >= 500) {
      throw new MicrosoftGraphError(
        "error",
        "Microsoft is temporarily unavailable. Try again shortly.",
        "provider_unavailable",
      );
    }
    throw new MicrosoftGraphError(
      "error",
      sanitizeGraphMessage(payload.error?.message) || "Microsoft Graph request failed.",
      graphCode || undefined,
    );
  }
}

async function listGraphWorkbooks(input: {
  accessToken: string;
  path: string;
  pageSize?: number;
  pageToken?: string | null;
}): Promise<{ workbooks: MicrosoftWorkbookSummary[]; nextPageToken: string | null }> {
  const pathAndQuery = input.pageToken
    ? resolveSafeNextPagePath(input.pageToken)
    : withTopParam(input.path, clampListPageSize(input.pageSize));

  const payload = await graphFetchJson<GraphCollection>(input.accessToken, pathAndQuery);
  const workbooks = (payload.value ?? [])
    .filter(isExcelWorkbookItem)
    .filter((item) => typeof item.id === "string" && isSafeGraphId(item.id))
    .map((item) => ({
      driveId: extractDriveIdFromPath(item),
      itemId: item.id as string,
      name: sanitizeDisplayName(item.name, "Untitled workbook"),
      folderPath: extractFolderPath(item.parentReference?.path),
      lastModified:
        typeof item.lastModifiedDateTime === "string" ? item.lastModifiedDateTime : null,
      size: typeof item.size === "number" ? item.size : null,
    }));

  const nextLink = typeof payload["@odata.nextLink"] === "string" ? payload["@odata.nextLink"] : null;
  return { workbooks, nextPageToken: nextLink ? safeGraphNextPagePath(nextLink) : null };
}

function isExcelWorkbookItem(item: GraphDriveItem) {
  return (
    typeof item.file?.mimeType === "string" &&
    item.file.mimeType === EXCEL_WORKBOOK_MIME &&
    typeof item.name === "string" &&
    item.name.toLowerCase().endsWith(".xlsx")
  );
}

function extractDriveIdFromPath(item: GraphDriveItem): string | null {
  const path = item.parentReference?.path || "";
  const match = path.match(/^\/drives\/([A-Za-z0-9!_-]+)/);
  return match?.[1] ?? null;
}

function extractFolderPath(parentPath?: string | null) {
  if (!parentPath) return null;
  const rootIndex = parentPath.indexOf("root:");
  if (rootIndex === -1) return null;
  const folder = parentPath.slice(rootIndex + "root:".length);
  return folder.replace(/^\//, "") || null;
}

async function fetchMicrosoftWorksheetValues(input: {
  accessToken: string;
  driveId?: string;
  itemId: string;
  worksheetId: string;
}) {
  const worksheetId = assertSafeWorksheetId(input.worksheetId, "worksheet");
  const path = `${itemPath(itemPathBase(input.driveId), input.itemId)}/worksheets/${encodeURIComponent(worksheetId)}/usedRange(valuesOnly=true)?$select=values`;
  const payload = await graphFetchJson<GraphRangeResponse>(input.accessToken, path);
  return payload.values ?? [];
}

function itemPathBase(driveId?: string | null) {
  return driveId
    ? `/v1.0/drives/${encodeURIComponent(assertSafeGraphId(driveId, "document library"))}`
    : "/v1.0/me/drive";
}

function itemPath(base: string, itemId: string) {
  return `${base}/items/${encodeURIComponent(assertSafeGraphId(itemId, "workbook"))}`;
}

function withTopParam(path: string, top: number) {
  const queryIndex = path.indexOf("?");
  const pathname = queryIndex === -1 ? path : path.slice(0, queryIndex);
  const params = new URLSearchParams(queryIndex === -1 ? "" : path.slice(queryIndex + 1));
  params.set("$top", String(top));
  return `${pathname}?${params.toString()}`;
}

function clampListPageSize(pageSize?: number) {
  if (!Number.isFinite(pageSize) || !pageSize || pageSize < 1) return DEFAULT_LIST_PAGE_SIZE;
  return Math.min(Math.floor(pageSize), MAX_LIST_PAGE_SIZE);
}

function resolveSafeNextPagePath(pageToken: string) {
  if (!isSafeGraphPath(pageToken)) {
    throw new MicrosoftGraphError("error", "Invalid Microsoft Graph pagination token.", "invalid_page_token");
  }
  return pageToken;
}

function safeGraphNextPagePath(nextLink: string) {
  try {
    const url = new URL(nextLink);
    if (url.origin !== GRAPH_API_ORIGIN || !url.pathname.startsWith("/v1.0/")) return null;
    if (/[\r\n]/.test(nextLink) || /\.\./.test(url.pathname)) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function isSafeGraphPath(pathAndQuery: string) {
  try {
    const url = new URL(pathAndQuery, GRAPH_API_ORIGIN);
    if (url.origin !== GRAPH_API_ORIGIN) return false;
    if (!url.pathname.startsWith("/v1.0/")) return false;
    if (/[\r\n\\]/.test(pathAndQuery)) return false;
    if (/\.\./.test(url.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function isSafeGraphId(value: string) {
  return /^[A-Za-z0-9!_-]{5,200}$/.test(value);
}

export function isSafeGraphSiteId(value: string) {
  return /^[A-Za-z0-9.,_-]{5,300}$/.test(value) && !/\.\./.test(value);
}

export function isSafeWorksheetId(value: string) {
  return /^\{?[A-Za-z0-9-]{8,80}\}?$/.test(value);
}

function assertSafeGraphId(value: string, label: string) {
  if (!isSafeGraphId(value)) {
    throw new MicrosoftGraphError(
      "error",
      `The selected ${label} identifier is invalid.`,
      "invalid_identifier",
    );
  }
  return value;
}

function assertSafeGraphSiteId(value: string, label: string) {
  if (!isSafeGraphSiteId(value)) {
    throw new MicrosoftGraphError(
      "error",
      `The selected ${label} identifier is invalid.`,
      "invalid_identifier",
    );
  }
  return value;
}

function assertSafeWorksheetId(value: string, label: string) {
  if (!isSafeWorksheetId(value)) {
    throw new MicrosoftGraphError(
      "error",
      `The selected ${label} identifier is invalid.`,
      "invalid_identifier",
    );
  }
  return value;
}

function escapeODataValue(value: string) {
  return value.replace(/'/g, "''");
}

function sanitizeDisplayName(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, 255);
}

function sanitizeGraphMessage(message?: string) {
  if (typeof message !== "string") return null;
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

function isThrottled(status: number) {
  return status === 429 || status === 503 || status === 504;
}

function throttleDelayMs(retryAfter: string | null, attempt: number) {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, THROTTLE_MAX_DELAY_MS);
  }
  const date = retryAfter ? Date.parse(retryAfter) : Number.NaN;
  if (!Number.isNaN(date)) {
    return Math.min(Math.max(date - Date.now(), 250), THROTTLE_MAX_DELAY_MS);
  }
  return Math.min(500 * 2 ** attempt + Math.floor(Math.random() * 250), THROTTLE_MAX_DELAY_MS);
}

function delayMs(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tokenEndpoint() {
  return MICROSOFT_TOKEN_URL.replace("{tenant}", getMicrosoftTenant());
}

async function readMicrosoftTokenResponse(response: Response): Promise<MicrosoftTokenSet> {
  const payload = (await response.json().catch(() => ({}))) as MicrosoftTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new MicrosoftGraphError(
      "reconnect_required",
      "Microsoft authorization failed.",
      "authorization_failed",
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

export function parseMicrosoftConnectorType(value: unknown): MicrosoftConnectorType | null {
  return value === "onedrive" || value === "sharepoint" ? value : null;
}

export class MicrosoftGraphError extends Error {
  readonly connectorStatus: "error" | "reconnect_required";
  readonly code?: string;

  constructor(connectorStatus: "error" | "reconnect_required", message: string, code?: string) {
    super(message);
    this.name = "MicrosoftGraphError";
    this.connectorStatus = connectorStatus;
    this.code = code;
  }
}
