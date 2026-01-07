/**
 * Hits Tracker Service
 * 热度统计服务
 * 
 * 策略：
 * 1. 用户访问时写入KV（异步，不阻塞）
 * 2. 每小时Cron聚合到D1
 * 3. 每天凌晨计算日/周/月统计
 */

import { logger } from '../utils/logger';

interface Env {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
}

/**
 * 记录访问（异步，不阻塞响应）
 */
export async function trackHit(
  env: Env,
  vodId: string
): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const key = `hits:${vodId}:${today}`;
    
    // 读取当前计数
    const current = await env.ROBIN_CACHE.get(key);
    const count = current ? parseInt(current) + 1 : 1;
    
    // 写入KV（24小时过期）
    await env.ROBIN_CACHE.put(key, String(count), {
      expirationTtl: 86400,
    });
  } catch (error) {
    // 静默失败，不影响主流程
    logger.hits.error('Failed to track', { error: error instanceof Error ? error.message : String(error) });
  }
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
