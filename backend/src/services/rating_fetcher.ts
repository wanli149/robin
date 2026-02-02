/**
 * Rating Fetcher Service
 * 评分获取服务 - 从TMDB获取权威评分
 * 
 * 策略：
 * 1. 优先使用TMDB（免费，数据全）
 * 2. 缓存30天，避免重复请求
 * 3. 批量处理，每次100个
 * 4. 失败重试3次
 */

import { logger } from '../utils/logger';
import { TMDB_CONFIG } from '../config';

interface Env {
  DB: D1Database;
  TMDB_API_KEY?: string;
}

// 使用配置文件中的 TMDB_CONFIG

/**
 * 搜索TMDB获取电影/剧集ID
 */
async function searchTMDB(
  vodName: string,
  year: string | null,
  apiKey: string
): Promise<{ id: number; score: number; votes: number } | null> {
  try {
    // 清理片名（去除集数、画质等信息）
    const cleanName = vodName
      .replace(/第?\d+集/g, '')
      .replace(/\d+p/gi, '')
      .replace(/HD|BD|4K|蓝光/gi, '')
      .trim();

    // 搜索电影
    const searchUrl = `${TMDB_CONFIG.baseUrl}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(cleanName)}&language=zh-CN`;
    
    const response = await fetch(searchUrl, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      return null;
    }

    // 取第一个结果（最相关）
    const first = data.results[0];
    
    // 如果提供了年份，验证年份是否匹配
    if (year) {
      const releaseYear = (first.release_date || first.first_air_date || '').substring(0, 4);
      if (releaseYear && Math.abs(parseInt(releaseYear) - parseInt(year)) > 1) {
        // 年份差距超过1年，可能不是同一部
        return null;
      }
    }

    return {
      id: first.id,
      score: first.vote_average || 0,
      votes: first.vote_count || 0,
    };
  } catch (error) {
    logger.rating.error('TMDB search failed', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * 批量获取评分（Cron任务调用）
 */
export async function batchFetchRatings(
  env: Env,
  limit: number = 100
): Promise<{ success: number; failed: number }> {
  logger.rating.info('Starting batch fetch...');

  const apiKey = env.TMDB_API_KEY;
  if (!apiKey) {
    logger.rating.warn('TMDB_API_KEY not configured');
    return { success: 0, failed: 0 };
  }

  // 1. 获取待处理的视频
  const result = await env.DB.prepare(`
    SELECT r.vod_id, v.vod_name, v.vod_year
    FROM vod_ratings r
    JOIN vod_cache v ON r.vod_id = v.vod_id
    WHERE r.fetch_status = 'pending'
    OR (r.fetch_status = 'failed' AND r.updated_at < ?)
    LIMIT ?
  `).bind(
    getDaysAgo(1),
    limit
  ).all();

  // 定义视频行类型
  interface VideoRatingRow {
    vod_id: string;
    vod_name: string;
    vod_year: string | null;
  }
  
  const videos = result.results as VideoRatingRow[];
  let successCount = 0;
  let failedCount = 0;

  // 2. 逐个获取评分
  for (const video of videos) {
    try {
      const rating = await searchTMDB(
        video.vod_name,
        video.vod_year,
        apiKey
      );

      if (rating) {
        // 更新评分缓存
        await env.DB.prepare(`
          UPDATE vod_ratings
          SET tmdb_score = ?, tmdb_votes = ?, tmdb_id = ?, 
              fetch_status = 'success', updated_at = ?
          WHERE vod_id = ?
        `).bind(
          rating.score,
          rating.votes,
          String(rating.id),
          getCurrentTimestamp(),
          video.vod_id
        ).run();

        // 更新视频表
        await env.DB.prepare(`
          UPDATE vod_cache
          SET vod_tmdb_score = ?, vod_score = ?, vod_score_source = 'tmdb'
          WHERE vod_id = ?
        `).bind(rating.score, rating.score, video.vod_id).run();

        successCount++;
        logger.rating.info(`✅ ${video.vod_name}: ${rating.score}`);
      } else {
        // 标记为失败
        await env.DB.prepare(`
          UPDATE vod_ratings
          SET fetch_status = 'failed', updated_at = ?
          WHERE vod_id = ?
        `).bind(getCurrentTimestamp(), video.vod_id).run();

        failedCount++;
      }

      // 避免API限流，延迟250ms
      await new Promise(resolve => setTimeout(resolve, 250));

    } catch (error) {
      logger.rating.error('Error fetching video', { vodId: video.vod_id, error: error instanceof Error ? error.message : String(error) });
      failedCount++;
    }
  }

  logger.rating.info(`Batch completed: ${successCount} success, ${failedCount} failed`);

  return { success: successCount, failed: failedCount };
}

/**
 * 单个视频获取评分（手动触发）
 */
export async function fetchSingleRating(
  env: Env,
  vodId: string
): Promise<boolean> {
  const apiKey = env.TMDB_API_KEY;
  if (!apiKey) {
    return false;
  }

  try {
    // 获取视频信息
    const video = await env.DB.prepare(`
      SELECT vod_name, vod_year FROM vod_cache WHERE vod_id = ?
    `).bind(vodId).first();

    if (!video) {
      return false;
    }

    const rating = await searchTMDB(
      video.vod_name as string,
      video.vod_year as string,
      apiKey
    );

    if (rating) {
      // 更新评分
      await env.DB.prepare(`
        INSERT OR REPLACE INTO vod_ratings (vod_id, tmdb_score, tmdb_votes, tmdb_id, fetch_status, updated_at)
        VALUES (?, ?, ?, ?, 'success', ?)
      `).bind(
        vodId,
        rating.score,
        rating.votes,
        String(rating.id),
        getCurrentTimestamp()
      ).run();

      await env.DB.prepare(`
        UPDATE vod_cache
        SET vod_tmdb_score = ?, vod_score = ?, vod_score_source = 'tmdb'
        WHERE vod_id = ?
      `).bind(rating.score, rating.score, vodId).run();

      return true;
    }

    return false;
  } catch (error) {
    logger.rating.error('Failed to fetch single rating', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
