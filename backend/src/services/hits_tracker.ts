/**
 * Hits Tracker Service
 * 热度统计服务
 * 
 * 🚀 优化策略：
 * 1. 内存累计 + 批量写入（减少 KV 写入 95%+）
 * 2. 每 100 次访问或每 60 秒批量写入一次
 * 3. 每小时 Cron 聚合到 D1
 * 4. 每天凌晨计算日/周/月统计
 */

import { logger } from '../utils/logger';
import { CACHE_CONFIG } from '../config';

interface Env {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
}

// 🚀 内存计数器：减少 KV 写入
const hitsCounters = new Map<string, number>();
let lastHitsFlush = Date.now();
const HITS_FLUSH_INTERVAL = 60000; // 60 秒
const HITS_BATCH_SIZE = 100; // 累计 100 次

/**
 * 记录访问（异步，不阻塞响应）
 * 🚀 优化：内存累计 + 批量写入
 */
export async function trackHit(
  env: Env,
  vodId: string
): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const key = `hits:${vodId}:${today}`;
    
    // 🚀 内存累计
    hitsCounters.set(key, (hitsCounters.get(key) || 0) + 1);
    
    // 🚀 批量写入条件：累计 100 次或超过 60 秒
    const now = Date.now();
    const totalHits = Array.from(hitsCounters.values()).reduce((sum, count) => sum + count, 0);
    
    if (totalHits >= HITS_BATCH_SIZE || now - lastHitsFlush > HITS_FLUSH_INTERVAL) {
      await flushHitsCounters(env);
    }
  } catch (error) {
    // 静默失败，不影响主流程
    logger.hits.error('Failed to track', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * 刷新热度计数器到 KV
 * 🚀 批量写入，减少 KV 操作
 */
async function flushHitsCounters(env: Env): Promise<void> {
  if (hitsCounters.size === 0) return;
  
  try {
    const entries = Array.from(hitsCounters.entries());
    hitsCounters.clear();
    lastHitsFlush = Date.now();
    
    logger.hits.debug('Flushing hits counters', { count: entries.length });
    
    // 🚀 批量读取当前值并更新
    await Promise.all(
      entries.map(async ([key, increment]) => {
        try {
          const current = await env.ROBIN_CACHE.get(key);
          const newCount = (parseInt(current || '0') + increment).toString();
          
          await env.ROBIN_CACHE.put(key, newCount, {
            expirationTtl: CACHE_CONFIG.hitsTrackerTTL,
          });
        } catch (error) {
          logger.hits.error('Failed to flush hit counter', { 
            key,
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      })
    );
    
    logger.hits.info('Hits counters flushed', { 
      count: entries.length,
      totalHits: entries.reduce((sum, [, count]) => sum + count, 0)
    });
  } catch (error) {
    logger.hits.error('Failed to flush hits counters', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

/**
 * 强制刷新热度计数器（在 Cron 任务结束时调用）
 */
export async function forceFlushHits(env: Env): Promise<void> {
  await flushHitsCounters(env);
}

/**
 * 聚合KV数据到D1（每小时执行）
 */
export async function aggregateHits(env: Env): Promise<number> {
  logger.hits.info('Starting aggregation...');
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 列出所有今天的hits key
    const list = await env.ROBIN_CACHE.list({ prefix: `hits:` });
    
    let aggregated = 0;
    
    for (const key of list.keys) {
      try {
        const parts = key.name.split(':');
        if (parts.length !== 3) continue;
        
        const vodId = parts[1];
        const date = parts[2];
        
        const count = await env.ROBIN_CACHE.get(key.name);
        if (!count) continue;
        
        const hits = parseInt(count);
        
        // 更新或插入日志
        await env.DB.prepare(`
          INSERT INTO vod_access_log (vod_id, access_date, hits)
          VALUES (?, ?, ?)
          ON CONFLICT(vod_id, access_date) 
          DO UPDATE SET hits = hits + ?
        `).bind(vodId, date, hits, hits).run();
        
        aggregated++;
        
        // 删除已处理的key
        await env.ROBIN_CACHE.delete(key.name);
        
      } catch (error) {
        logger.hits.error('Failed to aggregate', { key: key.name, error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    logger.hits.info(`Aggregated ${aggregated} records`);
    return aggregated;
    
  } catch (error) {
    logger.hits.error('Aggregation failed', { error: error instanceof Error ? error.message : String(error) });
    return 0;
  }
}

/**
 * 计算统计数据（每天凌晨执行）
 */
export async function calculateStats(env: Env): Promise<void> {
  logger.hits.info('Calculating stats...');
  
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // 计算日期范围
    const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
    const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
    
    // 批量更新统计
    await env.DB.prepare(`
      UPDATE vod_cache
      SET 
        vod_hits_day = (
          SELECT COALESCE(SUM(hits), 0)
          FROM vod_access_log
          WHERE vod_access_log.vod_id = vod_cache.vod_id
          AND access_date = ?
        ),
        vod_hits_week = (
          SELECT COALESCE(SUM(hits), 0)
          FROM vod_access_log
          WHERE vod_access_log.vod_id = vod_cache.vod_id
          AND access_date >= ?
        ),
        vod_hits_month = (
          SELECT COALESCE(SUM(hits), 0)
          FROM vod_access_log
          WHERE vod_access_log.vod_id = vod_cache.vod_id
          AND access_date >= ?
        ),
        vod_hits = (
          SELECT COALESCE(SUM(hits), 0)
          FROM vod_access_log
          WHERE vod_access_log.vod_id = vod_cache.vod_id
        )
    `).bind(yesterday, weekAgo, monthAgo).run();
    
    // 清理30天前的日志
    const cleanupDate = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
    await env.DB.prepare(`
      DELETE FROM vod_access_log WHERE access_date < ?
    `).bind(cleanupDate).run();
    
    logger.hits.info('Stats calculated successfully');
    
  } catch (error) {
    logger.hits.error('Failed to calculate stats', { error: error instanceof Error ? error.message : String(error) });
  }
}
