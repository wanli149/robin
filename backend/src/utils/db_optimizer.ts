/**
 * 数据库查询优化工具
 * 减少查询次数，提升性能
 */

import type { SystemConfigRow, PageModuleRow } from '../types/database';
import { logger } from './logger';

type Bindings = {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
};

/**
 * 批量获取系统配置
 * 一次查询获取多个配置项，避免 N+1 问题
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
  for (const row of result.results as SystemConfigRow[]) {
    configs[row.key] = row.value || '';
  }
  
  return configs;
}

/** 模块输入类型 */
interface ModuleInput {
  module_type: string;
  title?: string | null;
  api_params?: Record<string, unknown> | null;
  ad_config?: Record<string, unknown> | null;
  sort_order?: number;
  is_enabled?: boolean;
}

/**
 * 批量插入模块配置
 * 使用事务和批量插入，提升性能
 */
export async function batchInsertModules(
  env: Bindings,
  tabId: string,
  modules: ModuleInput[]
): Promise<void> {
  // D1 目前不支持真正的事务，但支持批量操作
  // 使用 batch API 一次性执行多个语句
  
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
  
  // 批量执行
  await env.DB.batch(statements);
}

/**
 * 获取跑马灯配置（优化版）
 * 一次查询获取所有相关配置
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
 * 缓存包装器
 * 自动处理 KV 缓存的读写
 * 🚀 优化：增加错误处理和空值保护
 */
export async function withCache<T>(
  env: Bindings,
  cacheKey: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // 尝试从缓存读取
  try {
    const cached = await env.ROBIN_CACHE.get(cacheKey, 'json');
    if (cached !== null) {
      return cached as T;
    }
  } catch (e) {
    // KV 读取失败，继续执行查询
    logger.admin.warn(`Cache read failed for ${cacheKey}`, { error: e instanceof Error ? e.message : 'Unknown' });
  }
  
  // 缓存未命中，执行查询
  const data = await fetcher();
  
  // 写入缓存（异步，不阻塞响应）
  try {
    await env.ROBIN_CACHE.put(
      cacheKey,
      JSON.stringify(data),
      { expirationTtl: ttl }
    );
  } catch (e) {
    // KV 写入失败，不影响返回
    logger.admin.warn(`Cache write failed for ${cacheKey}`, { error: e instanceof Error ? e.message : 'Unknown' });
  }
  
  return data;
}

/**
 * 带缓存的系统配置获取
 * 🚀 新增：常用配置的便捷方法
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
    // 忽略缓存错误
  }
  
  const result = await env.DB.prepare(
    'SELECT value FROM system_config WHERE key = ?'
  ).bind(key).first();
  
  const value = (result?.value as string) || defaultValue;
  
  // 缓存 30 分钟
  try {
    await env.ROBIN_CACHE.put(cacheKey, value, { expirationTtl: 1800 });
  } catch (e) {
    // 忽略缓存错误
  }
  
  return value;
}

/**
 * 预编译的常用查询
 * 减少 SQL 解析开销
 */
export class PreparedQueries {
  private env: Bindings;
  
  constructor(env: Bindings) {
    this.env = env;
  }
  
  /**
   * 获取用户信息
   */
  async getUserById(userId: number) {
    return this.env.DB.prepare(`
      SELECT id, username, is_vip, created_at
      FROM users
      WHERE id = ?
    `).bind(userId).first();
  }
  
  /**
   * 获取用户历史记录
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
   * 获取启用的模块
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
 * 查询性能监控
 * 记录慢查询，帮助优化
 */
export async function monitorQuery<T>(
  queryName: string,
  query: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  
  try {
    const result = await query();
    const duration = Date.now() - start;
    
    // 慢查询警告（超过 100ms）
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
 * 数据库连接池（模拟）
 * D1 自动管理连接，这里主要是限流
 */
export class QueryThrottler {
  private running = 0;
  private maxConcurrent = 10; // 最大并发查询数
  
  async execute<T>(query: () => Promise<T>): Promise<T> {
    // 如果达到并发限制，等待
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
