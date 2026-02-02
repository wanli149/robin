/**
 * 定时任务调度器
 * 用于自动执行采集、清理等任务
 */

import { runIncrementalCollect, runFullCollect } from './collector_v2';
import { batchValidateUrls } from './url_validator';
import { mergeDuplicateVideos } from '../scripts/merge_duplicates';
import { getCollectorMetrics, checkHealth, sendDingTalkAlert } from '../scripts/monitor_collector';
import { checkAllSourcesHealth } from './source_health';
import { cleanupOldTasks } from './task_manager';
import { cleanupOldLogs } from './collect_logger';
import { ImageStorageService } from './image_storage';
import { logger } from '../utils/logger';
import { CACHE_CONFIG } from '../config';
import type { SystemConfigRow, HotSearchStatsRow, HomeTabRow, VodCacheListRow } from '../types/database';
// 短剧数据现在直接存储在 vod_cache，不再需要同步

interface Env {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
  IMAGE_BUCKET?: R2Bucket;
  DINGTALK_WEBHOOK?: string;
}

interface ScheduledTask {
  name: string;
  cron: string;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

/**
 * 执行定时任务
 */
export async function runScheduledTasks(
  env: Env,
  scheduledTime: Date
): Promise<void> {
  const hour = scheduledTime.getHours();
  const minute = scheduledTime.getMinutes();
  const dayOfWeek = scheduledTime.getDay();
  
  logger.scheduler.info(`Running scheduled tasks at ${scheduledTime.toISOString()}`);
  
  try {
    // 每小时任务
    if (minute === 0) {
      await runHourlyTasks(env);
    }
    
    // 每天凌晨2点：增量采集
    if (hour === 2 && minute === 0) {
      await runDailyTasks(env);
    }
    
    // 每周日凌晨3点：全量采集和清理
    if (dayOfWeek === 0 && hour === 3 && minute === 0) {
      await runWeeklyTasks(env);
    }
    
    // 每6小时：健康检查
    if (minute === 0 && hour % 6 === 0) {
      await runHealthCheck(env);
    }
    
  } catch (error) {
    logger.scheduler.error('Error running scheduled tasks', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * 每小时任务
 */
async function runHourlyTasks(env: Env): Promise<void> {
  logger.scheduler.info('Running hourly tasks...');
  
  // 🚀 0. 强制刷新内存计数器（hits、security 等）
  try {
    const { forceFlushHits } = await import('./hits_tracker');
    await forceFlushHits(env);
    logger.scheduler.info('Hits counters flushed');
  } catch (error) {
    logger.scheduler.error('Failed to flush hits counters', { error: error instanceof Error ? error.message : String(error) });
  }
  
  // 1. 🚀 缓存预热（优先执行）
  try {
    await warmupCaches(env);
  } catch (error) {
    logger.scheduler.error('Cache warmup failed', { error: error instanceof Error ? error.message : String(error) });
  }
  
  // 2. 增量采集（小批量）- 使用V2引擎
  try {
    await runIncrementalCollect(env, { maxPages: 3, maxVideos: 100 });
  } catch (error) {
    logger.scheduler.error('Hourly collect failed', { error: error instanceof Error ? error.message : String(error) });
  }
  
  // 3. 处理图片上传队列
  try {
    await processImageQueue(env);
  } catch (error) {
    logger.scheduler.error('Image queue processing failed', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * 🚀 缓存预热
 * 预热热门数据，减少首次访问延迟
 */
async function warmupCaches(env: Env): Promise<void> {
  logger.scheduler.info('Warming up caches...');
  
  try {
    // 1. 预热热搜
    const hotSearchConfigs = await env.DB.prepare(`
      SELECT key, value FROM system_config WHERE key IN ('hot_search_enabled', 'hot_search_limit')
    `).all();
    
    const configMap = new Map((hotSearchConfigs.results as unknown as SystemConfigRow[]).map(r => [r.key, r.value]));
    
    if (configMap.get('hot_search_enabled') === 'true') {
      const limit = parseInt(configMap.get('hot_search_limit') as string) || 10;
      const result = await env.DB.prepare(`
        SELECT keyword FROM hot_search_stats WHERE is_hidden = 0 ORDER BY is_pinned DESC, search_count DESC LIMIT ?
      `).bind(limit).all();
      
      const keywords = (result.results || []).map((r: any) => r.keyword);
      await env.ROBIN_CACHE.put('hot_search_keywords', JSON.stringify({ keywords }), { expirationTtl: CACHE_CONFIG.hotSearchTTL });
      logger.scheduler.info('Hot search cache warmed up');
    }
    
    // 2. 预热跑马灯配置
    const marqueeConfigs = await env.DB.prepare(`
      SELECT key, value FROM system_config WHERE key IN ('marquee_enabled', 'marquee_text', 'marquee_link')
    `).all();
    
    const marqueeMap = new Map((marqueeConfigs.results as unknown as SystemConfigRow[]).map(r => [r.key, r.value]));
    await env.ROBIN_CACHE.put('marquee_config', JSON.stringify({
      enabled: marqueeMap.get('marquee_enabled') === 'true',
      text: marqueeMap.get('marquee_text') || '',
      link: marqueeMap.get('marquee_link') || '',
    }), { expirationTtl: CACHE_CONFIG.marqueeTTL });
    logger.scheduler.info('Marquee cache warmed up');
    
    // 3. 预热 tabs 列表
    const tabsResult = await env.DB.prepare(`
      SELECT id, title, sort_order, is_visible, is_locked FROM home_tabs WHERE is_visible = 1 ORDER BY sort_order ASC
    `).all();
    
    await env.ROBIN_CACHE.put('home_tabs', JSON.stringify({
      tabs: tabsResult.results,
      timestamp: Date.now(),
    }), { expirationTtl: CACHE_CONFIG.tabsTTL });
    logger.scheduler.info('Tabs cache warmed up');
    
    // 4. 预热热门排行榜
    const rankingResult = await env.DB.prepare(`
      SELECT vod_id, vod_name, vod_pic, vod_remarks, vod_score, 
             COALESCE(vod_hits_day, 0) as vod_hits_day, type_id, type_name
      FROM vod_cache WHERE is_valid = 1 ORDER BY vod_hits_day DESC LIMIT 10
    `).all();
    
    const rankingList = (rankingResult.results || []).map((video: any, index: number) => ({
      ...video,
      rank: index + 1,
      heat: video.vod_hits_day || 0,
    }));
    
    await env.ROBIN_CACHE.put('rank:day:all:10', JSON.stringify(rankingList), { expirationTtl: CACHE_CONFIG.rankingTTL });
    logger.scheduler.info('Ranking cache warmed up');
    
  } catch (error) {
    logger.scheduler.error('Cache warmup error', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * 每日任务
 */
async function runDailyTasks(env: Env): Promise<void> {
  logger.scheduler.info('Running daily tasks...');
  
  // 1. 增量采集（大批量）- 使用V2引擎
  try {
    await runIncrementalCollect(env, { maxPages: 10, maxVideos: 500 });
  } catch (error) {
    logger.scheduler.error('Daily collect failed', { error: error instanceof Error ? error.message : String(error) });
  }
  
  // 2. 验证播放地址
  try {
    await batchValidateUrls(env, 100);
  } catch (error) {
    logger.scheduler.error('URL validation failed', { error: error instanceof Error ? error.message : String(error) });
  }
  
  // 3. 资源站健康检测
  try {
    await checkAllSourcesHealth(env);
  } catch (error) {
    logger.scheduler.error('Health check failed', { error: error instanceof Error ? error.message : String(error) });
  }
  
  // 4. 清理访问日志（保留30天）
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];
    
    await env.DB.prepare(`
      DELETE FROM vod_access_log WHERE access_date < ?
    `).bind(dateStr).run();
    
    logger.scheduler.info('Cleaned old access logs');
  } catch (error) {
    logger.scheduler.error('Log cleanup failed', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * 每周任务
 */
async function runWeeklyTasks(env: Env): Promise<void> {
  logger.scheduler.info('Running weekly tasks...');
  
  // 1. 全量采集 - 使用V2引擎
  // 短剧预览字段会在采集时自动填充
  try {
    await runFullCollect(env);
  } catch (error) {
    logger.scheduler.error('Weekly collect failed', { error: error instanceof Error ? error.message : String(error) });
  }
  
  // 2. 合并重复视频
  try {
    await mergeDuplicateVideos(env);
  } catch (error) {
    logger.scheduler.error('Merge duplicates failed', { error: error instanceof Error ? error.message : String(error) });
  }
  
  // 3. 清理失效视频（超过30天未更新且失效）
  try {
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
    
    await env.DB.prepare(`
      DELETE FROM vod_cache 
      WHERE is_valid = 0 AND updated_at < ?
    `).bind(thirtyDaysAgo).run();
    
    logger.scheduler.info('Cleaned invalid videos');
  } catch (error) {
    logger.scheduler.error('Invalid video cleanup failed', { error: error instanceof Error ? error.message : String(error) });
  }
  
  // 4. 重建搜索索引
  try {
    await env.DB.prepare('DELETE FROM vod_search').run();
    await env.DB.prepare(`
      INSERT INTO vod_search (vod_id, vod_name, vod_actor, vod_director, vod_content)
      SELECT vod_id, vod_name, vod_actor, vod_director, vod_content
      FROM vod_cache
      WHERE is_valid = 1
    `).run();
    
    logger.scheduler.info('Rebuilt search index');
  } catch (error) {
    logger.scheduler.error('Search index rebuild failed', { error: error instanceof Error ? error.message : String(error) });
  }
  
  // 5. 清理旧任务和日志
  try {
    await cleanupOldTasks(env);
    await cleanupOldLogs(env);
    logger.scheduler.info('Cleaned old tasks and logs');
  } catch (error) {
    logger.scheduler.error('Task cleanup failed', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * 健康检查
 */
async function runHealthCheck(env: Env): Promise<void> {
  logger.scheduler.info('Running health check...');
  
  try {
    const metrics = await getCollectorMetrics(env);
    const health = checkHealth(metrics);
    
    logger.scheduler.info(`Health status: ${health.status}`);
    
    if (health.status !== 'healthy' && health.issues.length > 0) {
      logger.scheduler.warn('Health issues detected', { issues: health.issues });
      
      // 发送钉钉告警
      if (env.DINGTALK_WEBHOOK) {
        await sendDingTalkAlert(env.DINGTALK_WEBHOOK, metrics, health);
      }
    }
  } catch (error) {
    logger.scheduler.error('Health check failed', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * 处理图片上传队列
 */
async function processImageQueue(env: Env): Promise<void> {
  logger.scheduler.info('Processing image upload queue...');
  
  try {
    const imageService = new ImageStorageService(env);
    const result = await imageService.processQueue(100);
    
    logger.scheduler.info('Image queue processed', {
      success: result.success,
      failed: result.failed,
    });
  } catch (error) {
    logger.scheduler.error('Image queue processing error', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * 获取下次运行时间
 */
export function getNextRunTime(cron: string, now: Date = new Date()): Date {
  // 简单的cron解析（仅支持小时和分钟）
  // 格式：'0 2 * * *' (分钟 小时 日 月 周)
  const parts = cron.split(' ');
  const minute = parseInt(parts[0]);
  const hour = parseInt(parts[1]);
  
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  
  // 如果已经过了今天的时间，设置为明天
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  
  return next;
}

/**
 * 检查是否应该运行任务
 */
export function shouldRunTask(task: ScheduledTask, now: Date = new Date()): boolean {
  if (!task.enabled) {
    return false;
  }
  
  if (!task.nextRun) {
    return true; // 首次运行
  }
  
  return now.getTime() >= task.nextRun;
}
