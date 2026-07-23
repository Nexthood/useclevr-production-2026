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
} from "./normalized-types";

export interface RetailPOSConnector {
  getAuthorizationUrl(input: AuthorizationInput): Promise<string>;
  exchangeAuthorizationCode(input: AuthorizationCodeInput): Promise<TokenResult>;
  refreshAccessToken(connection: RetailConnectionRecord): Promise<TokenResult>;
  revokeConnection(connection: RetailConnectionRecord): Promise<void>;
  getMerchant(connection: RetailConnectionRecord): Promise<NormalizedMerchant>;
  getLocations(connection: RetailConnectionRecord): Promise<NormalizedLocation[]>;
  getProducts(
    connection: RetailConnectionRecord,
    cursor?: string,
  ): Promise<PaginatedResult<NormalizedProduct>>;
  getInventory(
    connection: RetailConnectionRecord,
    cursor?: string,
  ): Promise<PaginatedResult<NormalizedInventoryLevel>>;
  getOrders(
    connection: RetailConnectionRecord,
    params: OrderSyncParams,
  ): Promise<PaginatedResult<NormalizedOrder>>;
  verifyWebhook(headers: Record<string, string>, rawBody: string): Promise<boolean>;
  parseWebhook(event: unknown): Promise<NormalizedWebhookEvent>;
  healthCheck(connection: RetailConnectionRecord): Promise<ConnectorHealthResult>;
}
