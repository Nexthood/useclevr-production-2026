export type RetailProviderErrorCode =
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "RATE_LIMIT_ERROR"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_PROVIDER_RESPONSE"
  | "NETWORK_ERROR"
  | "SYNC_CONFLICT"
  | "TOKEN_REFRESH_FAILED"
  | "WEBHOOK_VERIFICATION_FAILED"
  | "DATA_MAPPING_ERROR"
  | "REAUTHORIZATION_REQUIRED"
  | "INVALID_PROVIDER_CREDENTIALS"
  | "INSUFFICIENT_SCOPE";

export class RetailProviderError extends Error {
  constructor(
    public readonly code: RetailProviderErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "RetailProviderError";
  }
}

export function redactProviderError(error: unknown) {
  if (error instanceof RetailProviderError) {
    return { code: error.code, message: error.message, status: error.status };
  }
  if (error instanceof Error) {
    return { code: "PROVIDER_UNAVAILABLE", message: error.message };
  }
  return { code: "PROVIDER_UNAVAILABLE", message: "Retail provider request failed." };
}
