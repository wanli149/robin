/**
 * Type Helper Utilities
 * 统一的类型转换和验证工具
 */

import { logger } from './logger';

/**
 * 安全地转换 D1 查询结果
 * 提供类型安全的转换，避免使用 as unknown as
 */
export function castD1Results<T>(results: unknown): T[] {
  if (!results || !Array.isArray(results)) {
    return [];
  }
  return results as T[];
}

/**
 * 安全地转换单个 D1 查询结果
 */
export function castD1Result<T>(result: unknown): T | null {
  if (!result || typeof result !== 'object') {
    return null;
  }
  return result as T;
}

/**
 * 安全地解析 JSON 字符串
 */
export function safeJsonParse<T>(json: string | null | undefined, defaultValue: T): T {
  if (!json) return defaultValue;
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * 类型守卫：检查是否为有效的对象
 */
export function isValidObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 类型守卫：检查是否为字符串数组
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

/**
 * 类型守卫：检查是否为数字数组
 */
export function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(item => typeof item === 'number');
}

/**
 * 从 KV 获取并解析 JSON
 */
export async function getKVJson<T>(
  kv: KVNamespace,
  key: string,
  defaultValue: T | null
): Promise<T | null> {
  try {
    const value = await kv.get(key, 'json');
    return value ? (value as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * 安全地设置 KV 值
 */
export async function setKVJson(
  kv: KVNamespace,
  key: string,
  value: unknown,
  options?: { expirationTtl?: number }
): Promise<void> {
  try {
    await kv.put(key, JSON.stringify(value), options);
  } catch (error) {
    // 使用 logger，避免直接使用 console
    logger.admin.error('Failed to set KV key', { 
      key, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}
