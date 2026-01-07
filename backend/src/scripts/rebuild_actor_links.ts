/**
 * 重建演员关联脚本
 * 为所有已有视频建立演员关联
 */

import { linkActors } from '../services/actor_manager';
import { logger } from '../utils/logger';

interface Env {
  DB: D1Database;
}

export async function rebuildActorLinks(env: Env, limit: number = 1000): Promise<{
  total: number;
  processed: number;
  errors: number;
}> {
  logger.actorManager.info('Starting to rebuild actor links');
  
  // 获取所有视频
  const result = await env.DB.prepare(`
    SELECT vod_id, vod_actor, vod_director, vod_writer
    FROM vod_cache
    WHERE vod_actor IS NOT NULL OR vod_director IS NOT NULL OR vod_writer IS NOT NULL
    LIMIT ?
  `).bind(limit).all();

  // 定义视频行类型
  interface VideoActorRow {
    vod_id: string;
    vod_actor: string | null;
    vod_director: string | null;
    vod_writer: string | null;
  }
  
  const videos = result.results as VideoActorRow[];
  logger.actorManager.info('Found videos with actor info', { count: videos.length });

  let processed = 0;
  let errors = 0;

  for (const video of videos) {
    try {
      await linkActors(
        env,
        video.vod_id,
        video.vod_actor || '',
        video.vod_director || '',
        video.vod_writer || ''
      );
      processed++;

      if (processed % 100 === 0) {
        logger.actorManager.info('Progress', { processed, total: videos.length });
      }
    } catch (error) {
      logger.actorManager.error('Error processing video', { vodId: video.vod_id, error: error instanceof Error ? error.message : String(error) });
      errors++;
    }
  }

  logger.actorManager.info('Completed', { processed, errors });

  // 更新演员统计
  logger.actorManager.info('Updating actor stats');
  try {
    // 更新作品数量
    await env.DB.prepare(`
      UPDATE actors
      SET works_count = (
        SELECT COUNT(DISTINCT vod_id)
        FROM vod_actor_relation
        WHERE vod_actor_relation.actor_id = actors.id
      )
    `).run();

    // 更新人气值
    await env.DB.prepare(`
      UPDATE actors
      SET popularity = (
        SELECT COALESCE(SUM(v.vod_hits_month), 0)
        FROM vod_actor_relation r
        JOIN vod_cache v ON r.vod_id = v.vod_id
        WHERE r.actor_id = actors.id
      )
    `).run();

    logger.actorManager.info('Actor stats updated');
  } catch (error) {
    logger.actorManager.error('Failed to update stats', { error: error instanceof Error ? error.message : String(error) });
  }

  return {
    total: videos.length,
    processed,
    errors,
  };
}
