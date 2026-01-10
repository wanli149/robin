/**
 * Database Query Optimization Utilities
 * Reduces query count and improves performance
 */

import type { SystemConfigRow } from '../types/database';
import { logger } from './logger';
import { CACHE_CONFIG } from '../config';

type Bindings = {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
};

// Helper function to safely cast D1 query results
function castResults<T>(results: Record<string, unknown>[]): T[] {
  return results as unknown as T[];
}

/**
 * Batch get system configurations
 * Single query for multiple config items, avoiding N+1 problem
 */
export async function getSystemConfigs(
  env: Bindings,
  keys: string[]
): Promise<Record<string, string>> {
  const placeholders = keys.map(() => '?').join(',');
  
  const result = await env.DB.prepare(`
    SELECT key, value
    FROM system_config
    WHERE key IN (${placeholders})
  `).bind(...keys).all();
  
  const configs: Record<string, string> = {};
  for (const row of castResults<SystemConfigRow>(result.results)) {
    configs[row.key] = row.value || '';
  }
  
  return configs;
}

/** Module input type */
interface ModuleInput {
  module_type: string;
  title?: string | null;
  api_params?: Record<string, unknown> | null;
  ad_config?: Record<string, unknown> | null;
  sort_order?: number;
  is_enabled?: boolean;
}

/**
 * Batch insert module configurations
 * Uses batch operations for better performance
 */
export async function batchInsertModules(
  env: Bindings,
  tabId: string,
  modules: ModuleInput[]
): Promise<void> {
  // D1 doesn't support true transactions, but supports batch operations
  // Use batch API to execute multiple statements at once
  
  const statements = modules.map(module => 
    env.DB.prepare(`
      INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      tabId,
      module.module_type,
      module.title || null,
      module.api_params ? JSON.stringify(module.api_params) : null,
      module.ad_config ? JSON.stringify(module.ad_config) : null,
      module.sort_order || 0,
      module.is_enabled !== false ? 1 : 0
    )
  );
  
  // Batch execute
  await env.DB.batch(statements);
}

/**
 * Get marquee configuration (optimized)
 * Single query for all related configs
 */
export async function getMarqueeConfig(
  env: Bindings
): Promise<{ enabled: boolean; text: string; link: string }> {
  const configs = await getSystemConfigs(env, [
    'marquee_enabled',
    'marquee_text',
    'marquee_link'
  ]);
  
  return {
    enabled: configs.marquee_enabled === 'true',
    text: configs.marquee_text || '',
    link: configs.marquee_link || ''
  };
}

/**
 * Cache wrapper
 * Automatically handles KV cache read/write
 * Optimized: Added error handling and null protection
 */
export async function withCache<T>(
  env: Bindings,
  cacheKey: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // Try to read from cache
  try {
    const cached = await env.ROBIN_CACHE.get(cacheKey, 'json');
    if (cached !== null) {
      return cached as T;
    }
  } catch (e) {
    // KV read failed, continue with query
    logger.admin.warn(`Cache read failed for ${cacheKey}`, { error: e instanceof Error ? e.message : 'Unknown' });
  }
  
  // Cache miss, execute query
  const data = await fetcher();
  
  // Write to cache (async, non-blocking)
  try {
    await env.ROBIN_CACHE.put(
      cacheKey,
      JSON.stringify(data),
      { expirationTtl: ttl }
    );
  } catch (e) {
    // KV write failed, doesn't affect return
    logger.admin.warn(`Cache write failed for ${cacheKey}`, { error: e instanceof Error ? e.message : 'Unknown' });
  }
  
  return data;
}

/**
 * Get cached system config
 * Convenience method for commonly used configs
 */
export async function getCachedConfig(
  env: Bindings,
  key: string,
  defaultValue: string = ''
): Promise<string> {
  const cacheKey = `config:${key}`;
  
  try {
    const cached = await env.ROBIN_CACHE.get(cacheKey);
    if (cached !== null) {
      return cached;
    }
  } catch (e) {
    // Ignore cache errors
  }
  
  const result = await env.DB.prepare(
    'SELECT value FROM system_config WHERE key = ?'
  ).bind(key).first();
  
  const value = (result?.value as string) || defaultValue;
  
  // Cache for 30 minutes
  try {
    await env.ROBIN_CACHE.put(cacheKey, value, { expirationTtl: CACHE_CONFIG.configTTL });
  } catch (e) {
    // Ignore cache errors
  }
  
  return value;
}

/**
 * Pre-compiled common queries
 * Reduces SQL parsing overhead
 */
export class PreparedQueries {
  private env: Bindings;
  
  constructor(env: Bindings) {
    this.env = env;
  }
  
  /**
   * Get user info
   */
  async getUserById(userId: number) {
    return this.env.DB.prepare(`
      SELECT id, username, is_vip, created_at
      FROM users
      WHERE id = ?
    `).bind(userId).first();
  }
  
  /**
   * Get user watch history
   */
  async getUserHistory(userId: number, limit: number = 20, offset: number = 0) {
    return this.env.DB.prepare(`
      SELECT vod_id, vod_name, vod_pic, progress, duration, updated_at
      FROM history
      WHERE user_id = ?
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();
  }
  
  /**
   * Get enabled modules
   */
  async getEnabledModules(tabId: string) {
    return this.env.DB.prepare(`
      SELECT id, tab_id, module_type, title, api_params, ad_config, sort_order
      FROM page_modules
      WHERE tab_id = ? AND (is_enabled IS NULL OR is_enabled = 1)
      ORDER BY sort_order ASC
    `).bind(tabId).all();
  }
}

/**
 * Query performance monitoring
 * Records slow queries for optimization
 */
export async function monitorQuery<T>(
  queryName: string,
  query: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  
  try {
    const result = await query();
    const duration = Date.now() - start;
    
    // Slow query warning (over 100ms)
    if (duration > 100) {
      logger.admin.warn(`Slow query: ${queryName} took ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.admin.error(`Query error: ${queryName} failed after ${duration}ms`, { error: error instanceof Error ? error.message : 'Unknown' });
    throw error;
  }
}

/**
 * Database connection pool (simulated)
 * D1 manages connections automatically, this is mainly for throttling
 */
export class QueryThrottler {
  private running = 0;
  private maxConcurrent = 10; // Max concurrent queries
  
  async execute<T>(query: () => Promise<T>): Promise<T> {
    // Wait if concurrent limit reached
    while (this.running >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    this.running++;
    
    try {
      return await query();
    } finally {
      this.running--;
    }
  }
}
