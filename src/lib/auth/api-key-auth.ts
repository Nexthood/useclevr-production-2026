/**
 * API Key Authentication
 *
 * Validates API keys for external application access.
 */

import { v4 as uuidv4 } from 'uuid';

export interface APIKey {
  id: string;
  key: string;
  userId: string;
  name: string;
  permissions: string[];
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
}

// In-memory store (use database in production)
const apiKeys = new Map<string, APIKey>();

/**
 * Generate a new API key
 */
export async function generateAPIKey(
  userId: string,
  name: string,
  permissions: string[] = ['analyze', 'investigate', 'predict', 'compare']
): Promise<APIKey> {
  const keyId = uuidv4();
  const key = `useclever_${keyId}_${uuidv4().replace(/-/g, '').substring(0, 32)}`;

  const apiKey: APIKey = {
    id: keyId,
    key,
    userId,
    name,
    permissions,
    createdAt: new Date(),
  };

  apiKeys.set(key, apiKey);

  return apiKey;
}

/**
 * Validate API key
 */
export async function validateAPIKey(key: string): Promise<APIKey | null> {
  const apiKey = apiKeys.get(key);

  if (!apiKey) {
    return null;
  }

  // Check expiration
  if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
    return null;
  }

  // Update last used
  apiKey.lastUsedAt = new Date();

  return apiKey;
}

/**
 * Revoke API key
 */
export async function revokeAPIKey(key: string): Promise<boolean> {
  return apiKeys.delete(key);
}

/**
 * Check if API key has permission
 */
export function hasAPIPermission(apiKey: APIKey, permission: string): boolean {
  return apiKey.permissions.includes(permission) || apiKey.permissions.includes('*');
}
