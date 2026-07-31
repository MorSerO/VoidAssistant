import { safeStorage } from '../electron-access';
import type { ApiConfig } from '../../shared/types';

/**
 * Check if encryption is available on this platform.
 * safeStorage may be unavailable on some Linux headless environments.
 */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

/**
 * Encrypt an API key for storage in the database.
 * Returns a base64-encoded encrypted string.
 * Falls back to base64 encoding if safeStorage is unavailable.
 */
export function encryptKey(plaintext: string): string {
  if (!plaintext) return '';
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(plaintext);
    return encrypted.toString('base64');
  }
  // Fallback: warn and use base64 (not truly secure, but better than plaintext)
  console.warn('[KeyStore] safeStorage not available - API keys will NOT be securely encrypted.');
  return Buffer.from(plaintext, 'utf-8').toString('base64');
}

/**
 * Decrypt an API key that was stored encrypted.
 */
export function decryptKey(encrypted: string): string {
  if (!encrypted) return '';
  if (safeStorage.isEncryptionAvailable()) {
    const buffer = Buffer.from(encrypted, 'base64');
    return safeStorage.decryptString(buffer);
  }
  // Fallback
  return Buffer.from(encrypted, 'base64').toString('utf-8');
}

/**
 * Convert a DB row to an ApiConfig with decrypted key.
 */
export function hydrateConfigForUse(row: Record<string, unknown>): ApiConfig {
  return {
    id: row.id as string,
    name: row.name as string,
    baseUrl: row.base_url as string,
    apiKey: decryptKey((row.encrypted_api_key as string) || ''),
    model: row.model as string,
    temperature: (row.temperature as number) ?? 0.7,
    maxTokens: (row.max_tokens as number) ?? 4096,
    pricing: {
      inputPrice: (row.input_price as number) ?? 0,
      outputPrice: (row.output_price as number) ?? 0,
    },
    headers: typeof row.headers === 'string' ? JSON.parse(row.headers) : (row.headers as Record<string, string> || {}),
    isActive: (row.is_active as number) === 1,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

/**
 * Convert an ApiConfig to a DB row with encrypted key.
 */
export function prepareConfigForStorage(config: ApiConfig): Record<string, unknown> {
  return {
    id: config.id,
    name: config.name,
    base_url: config.baseUrl,
    encrypted_api_key: config.apiKey ? encryptKey(config.apiKey) : '',
    model: config.model,
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 4096,
    input_price: config.pricing?.inputPrice ?? 0,
    output_price: config.pricing?.outputPrice ?? 0,
    headers: JSON.stringify(config.headers || {}),
    is_active: config.isActive ? 1 : 0,
    created_at: config.createdAt,
    updated_at: config.updatedAt,
  };
}

/**
 * Strip the key from an ApiConfig, returning a public-view safe object.
 */
export function sanitizeConfigForRenderer(config: ApiConfig): {
  id: string; name: string; baseUrl: string; model: string;
  temperature: number; maxTokens: number;
  pricing: { inputPrice: number; outputPrice: number };
  headers: Record<string, string>;
  isActive: boolean; hasKey: boolean;
  createdAt: number; updatedAt: number;
} {
  return {
    id: config.id,
    name: config.name,
    baseUrl: config.baseUrl,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    pricing: config.pricing,
    headers: config.headers,
    isActive: config.isActive,
    hasKey: !!config.apiKey,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}
