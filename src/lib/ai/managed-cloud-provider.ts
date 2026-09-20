import { createGoogleGenerativeAI } from "@ai-sdk/google";

export const MANAGED_CLOUD_PROVIDER_NAME = "UseClevr Cloud Analysis";
export const MANAGED_CLOUD_MODEL_NAME = "gemini-2.5-flash";

export const MANAGED_CLOUD_CREDENTIAL_ENV_VARS = [
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GEMINI_API_KEY",
] as const;

export function getManagedCloudApiKey(): string | null {
  const raw = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

export function isManagedCloudConfigured(): boolean {
  return getManagedCloudApiKey() !== null;
}

export function getManagedCloudLanguageModel() {
  const credential = getManagedCloudApiKey();
  if (!credential) return null;
  const google = createGoogleGenerativeAI({ apiKey: credential });
  return google(MANAGED_CLOUD_MODEL_NAME);
}

export function managedCloudCredentialMissingMessage(): string {
  return `Managed cloud credential missing: set ${MANAGED_CLOUD_CREDENTIAL_ENV_VARS[0]} (or ${MANAGED_CLOUD_CREDENTIAL_ENV_VARS[1]}) on the server environment.`;
}
