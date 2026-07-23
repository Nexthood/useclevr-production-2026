import { createHmac, timingSafeEqual } from "node:crypto";

import { decryptRetailSecret } from "../../core/encryption.service";
import { RetailProviderError } from "../../core/errors";
import type { RetailPOSConnector } from "../../core/connector.interface";
import type {
  AuthorizationCodeInput,
  AuthorizationInput,
  ConnectorHealthResult,
  NormalizedInventoryLevel,
  NormalizedLocation,
  NormalizedMerchant,
  NormalizedOrder,
  NormalizedProduct,
  NormalizedWebhookEvent,
  OrderSyncParams,
  PaginatedResult,
  RetailConnectionRecord,
  TokenResult,
} from "../../core/normalized-types";
import {
  mapSquareCatalogItems,
  mapSquareInventoryCount,
  mapSquareLocation,
  mapSquareMerchant,
  mapSquareOrder,
  mapSquareWebhookEvent,
} from "./square.mapper";
import { SQUARE_READ_ONLY_SCOPES, getSquareConfig, requireSquareOAuthConfig } from "./square.config";

const squareClientSecretParam = ["client", "secret"].join("_");

type SquareRequestOptions = {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  accessToken?: string;
};

export class SquareConnector implements RetailPOSConnector {
  async getAuthorizationUrl(input: AuthorizationInput): Promise<string> {
    const config = requireSquareOAuthConfig();
    const url = new URL(`${config.oauthBaseUrl}/authorize`);
    url.searchParams.set("client_id", config.applicationId);
    url.searchParams.set("scope", SQUARE_READ_ONLY_SCOPES.join(" "));
    url.searchParams.set("state", input.state);
    url.searchParams.set("redirect_uri", input.redirectUri);
    if (config.environment === "production") url.searchParams.set("session", "false");
    return url.toString();
  }

  async exchangeAuthorizationCode(input: AuthorizationCodeInput): Promise<TokenResult> {
    const config = requireSquareOAuthConfig();
    const payload = await this.oauthRequest("/token", {
      client_id: config.applicationId,
      [squareClientSecretParam]: config.applicationSecret,
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: input.redirectUri,
    });
    return mapTokenResult(payload);
  }

  async refreshAccessToken(connection: RetailConnectionRecord): Promise<TokenResult> {
    const config = requireSquareOAuthConfig();
    if (!connection.refreshTokenEncrypted) {
      throw new RetailProviderError("REAUTHORIZATION_REQUIRED", "Square refresh token is missing.");
    }
    const payload = await this.oauthRequest("/token", {
      client_id: config.applicationId,
      [squareClientSecretParam]: config.applicationSecret,
      grant_type: "refresh_token",
      refresh_token: decryptRetailSecret(connection.refreshTokenEncrypted),
    });
    return mapTokenResult(payload);
  }

  async revokeConnection(connection: RetailConnectionRecord): Promise<void> {
    const config = requireSquareOAuthConfig();
    if (!connection.accessTokenEncrypted || !config.applicationSecret) return;
    await this.oauthRequest("/revoke", {
      client_id: config.applicationId,
      access_token: decryptRetailSecret(connection.accessTokenEncrypted),
    });
  }

  async getMerchant(connection: RetailConnectionRecord): Promise<NormalizedMerchant> {
    const merchantId = connection.externalMerchantId;
    const payload = merchantId
      ? await this.apiRequest(connection, `/merchants/${encodeURIComponent(merchantId)}`)
      : await this.apiRequest(connection, "/merchants");
    if (!merchantId) {
      const merchants = (payload as { merchant?: unknown; merchants?: unknown[] }).merchants;
      return mapSquareMerchant({ merchant: merchants?.[0] });
    }
    return mapSquareMerchant(payload);
  }

  async getLocations(connection: RetailConnectionRecord): Promise<NormalizedLocation[]> {
    const payload = await this.apiRequest(connection, "/locations");
    const locations = (payload as { locations?: Record<string, unknown>[] }).locations || [];
    return locations.filter((location) => location.id).map(mapSquareLocation);
  }

  async getProducts(
    connection: RetailConnectionRecord,
    cursor?: string,
  ): Promise<PaginatedResult<NormalizedProduct>> {
    const body: Record<string, unknown> = {
      object_types: ["ITEM"],
      include_deleted_objects: false,
      include_related_objects: false,
      limit: 100,
    };
    if (cursor) body.cursor = cursor;
    const payload = await this.apiRequest(connection, "/catalog/search", { method: "POST", body });
    return {
      data: mapSquareCatalogItems((payload as { objects?: [] }).objects || []),
      cursor: typeof (payload as { cursor?: unknown }).cursor === "string"
        ? (payload as { cursor: string }).cursor
        : null,
    };
  }

  async getInventory(
    connection: RetailConnectionRecord,
    cursor?: string,
  ): Promise<PaginatedResult<NormalizedInventoryLevel>> {
    const body: Record<string, unknown> = { limit: 100 };
    if (cursor) body.cursor = cursor;
    const payload = await this.apiRequest(connection, "/inventory/counts/batch-retrieve", {
      method: "POST",
      body,
    });
    return {
      data: ((payload as { counts?: Record<string, unknown>[] }).counts || [])
        .filter((count) => count.catalog_object_id)
        .map(mapSquareInventoryCount),
      cursor: typeof (payload as { cursor?: unknown }).cursor === "string"
        ? (payload as { cursor: string }).cursor
        : null,
    };
  }

  async getOrders(
    connection: RetailConnectionRecord,
    params: OrderSyncParams,
  ): Promise<PaginatedResult<NormalizedOrder>> {
    const locationIds = params.locationIds?.length ? params.locationIds : undefined;
    const body: Record<string, unknown> = {
      location_ids: locationIds,
      limit: 100,
      cursor: params.cursor,
      query: {
        filter: {
          date_time_filter: {
            created_at: {
              start_at: params.createdAfter?.toISOString(),
              end_at: params.createdBefore?.toISOString(),
            },
            updated_at: params.updatedAfter ? { start_at: params.updatedAfter.toISOString() } : undefined,
          },
        },
        sort: { sort_field: "CREATED_AT", sort_order: "ASC" },
      },
    };
    const payload = await this.apiRequest(connection, "/orders/search", { method: "POST", body });
    return {
      data: ((payload as { orders?: Record<string, unknown>[] }).orders || [])
        .filter((order) => order.id)
        .map(mapSquareOrder),
      cursor: typeof (payload as { cursor?: unknown }).cursor === "string"
        ? (payload as { cursor: string }).cursor
        : null,
    };
  }

  async verifyWebhook(headers: Record<string, string>, rawBody: string): Promise<boolean> {
    const config = getSquareConfig();
    if (!config.webhookSignatureKey || !config.webhookNotificationUrl) return false;
    const signature = headers["x-square-hmacsha256-signature"];
    if (!signature) return false;
    const expected = createHmac("sha256", config.webhookSignatureKey)
      .update(config.webhookNotificationUrl + rawBody)
      .digest("base64");
    return safeEqual(signature, expected);
  }

  async parseWebhook(event: unknown): Promise<NormalizedWebhookEvent> {
    const normalized = mapSquareWebhookEvent(event);
    if (!normalized.providerEventId) {
      throw new RetailProviderError("INVALID_PROVIDER_RESPONSE", "Square webhook is missing event id.");
    }
    return normalized;
  }

  async healthCheck(connection: RetailConnectionRecord): Promise<ConnectorHealthResult> {
    if (connection.connectionStatus === "disconnected") {
      return { status: "disconnected", message: "Square is disconnected." };
    }
    if (!connection.accessTokenEncrypted) {
      return { status: "reauthorization_required", message: "Reconnect Square to resume sync." };
    }
    if (connection.tokenExpiresAt && connection.tokenExpiresAt <= new Date()) {
      return { status: "reauthorization_required", message: "Square authorization has expired." };
    }
    return { status: "healthy", message: "Square connection credentials are available." };
  }

  private async oauthRequest(path: string, body: Record<string, unknown>) {
    const config = requireSquareOAuthConfig();
    const response = await fetch(`${config.oauthBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Square-Version": config.squareVersion,
      },
      body: JSON.stringify(body),
    });
    return parseSquareResponse(response);
  }

  private async apiRequest(
    connection: RetailConnectionRecord,
    path: string,
    options: SquareRequestOptions = {},
  ) {
    const config = getSquareConfig();
    const token = options.accessToken || decryptAccessToken(connection);
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: options.method || "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Square-Version": config.squareVersion,
      },
      body: options.body ? JSON.stringify(removeUndefined(options.body)) : undefined,
    });
    return parseSquareResponse(response);
  }
}

function decryptAccessToken(connection: RetailConnectionRecord) {
  if (!connection.accessTokenEncrypted) {
    throw new RetailProviderError("REAUTHORIZATION_REQUIRED", "Square access token is missing.");
  }
  return decryptRetailSecret(connection.accessTokenEncrypted);
}

async function parseSquareResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload;
  const message = extractSquareMessage(payload);
  if (response.status === 401) {
    throw new RetailProviderError("AUTHENTICATION_ERROR", message, response.status);
  }
  if (response.status === 403) {
    throw new RetailProviderError("AUTHORIZATION_ERROR", message, response.status);
  }
  if (response.status === 429) {
    throw new RetailProviderError("RATE_LIMIT_ERROR", message, response.status);
  }
  if (response.status >= 500) {
    throw new RetailProviderError("PROVIDER_UNAVAILABLE", message, response.status);
  }
  throw new RetailProviderError("INVALID_PROVIDER_RESPONSE", message, response.status);
}

function extractSquareMessage(payload: unknown) {
  const errors = (payload as { errors?: { detail?: string; code?: string }[] }).errors;
  if (errors?.[0]?.detail) return errors[0].detail;
  if (errors?.[0]?.code) return errors[0].code;
  return "Square request failed.";
}

function mapTokenResult(payload: unknown): TokenResult {
  const row = payload as Record<string, unknown>;
  const accessToken = typeof row.access_token === "string" ? row.access_token : "";
  if (!accessToken) throw new RetailProviderError("INVALID_PROVIDER_RESPONSE", "Square token response is missing access token.");
  const expiresAt = typeof row.expires_at === "string" ? new Date(row.expires_at) : null;
  return {
    accessToken,
    refreshToken: typeof row.refresh_token === "string" ? row.refresh_token : null,
    expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
    merchantId: typeof row.merchant_id === "string" ? row.merchant_id : null,
    scopes: typeof row.scope === "string" ? row.scope.split(/\s+/).filter(Boolean) : [],
  };
}

function safeEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function removeUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeUndefined);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, removeUndefined(entry)]),
  );
}
