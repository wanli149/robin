/**
 * 修复视频数据脚本
 * 为数据不完整的视频从资源站获取完整信息（封面、年份、地区、演员等）
 */

import { logger } from '../utils/logger';
import { getCurrentTimestamp } from '../utils/time';

interface Env {
  DB: D1Database;
}

// 资源站数据库行类型
interface VideoSourceDbRow {
  name: string;
  api_url: string;
}

/**
 * 从数据库获取资源站配置
 */
async function getSourceByName(env: Env, sourceName: string): Promise<{ name: string; url: string } | null> {
  try {
    const result = await env.DB.prepare(`
      SELECT name, api_url FROM video_sources WHERE name = ? AND is_active = 1
    `).bind(sourceName).first() as VideoSourceDbRow | null;
    
    if (result) {
      return { name: result.name, url: result.api_url };
    }
    return null;
  } catch (error) {
    logger.repair.error('Failed to get source from DB', { sourceName, error: String(error) });
    return null;
  }
}

export async function fixVideoCovers(env: Env, limit: number = 100): Promise<{
  total: number;
  fixed: number;
  failed: number;
}> {
  logger.repair.info('Starting to fix video data...');
  
  // 1. 查找数据不完整的视频（没有封面或没有年份）
  const videos = await env.DB.prepare(`
    SELECT vod_id, vod_name, source_name
    FROM vod_cache
    WHERE vod_pic IS NULL OR vod_pic = '' OR vod_year IS NULL OR vod_year = ''
    LIMIT ?
  `).bind(limit).all();

  if (!videos.results || videos.results.length === 0) {
    logger.repair.info('No videos need fixing');
    return { total: 0, fixed: 0, failed: 0 };
  }

  logger.repair.info('Found videos without covers', { count: videos.results.length });

  let fixed = 0;
  let failed = 0;

  // 2. 为每个视频获取封面
  for (const video of videos.results) {
    try {
      const vodId = video.vod_id as string;
      const sourceName = video.source_name as string;
      
      // 从数据库获取对应的资源站
      const source = await getSourceByName(env, sourceName);
      if (!source) {
        logger.repair.warn('Source not found in database', { vodId, sourceName });
        failed++;
        continue;
      }

      // 获取详情
      const detailUrl = new URL(source.url);
      detailUrl.searchParams.set('ac', 'detail');
      detailUrl.searchParams.set('ids', vodId);

      const response = await fetch(detailUrl.toString(), {
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        logger.repair.warn('Failed to fetch detail', { vodId, status: response.status });
        failed++;
        continue;
      }

      // 定义 API 响应类型
      interface ApiResponse {
        list?: Array<{
          vod_pic?: string;
          vod_pic_thumb?: string;
          vod_pic_slide?: string;
          vod_year?: string;
          vod_area?: string;
          vod_actor?: string;
          vod_director?: string;
          vod_writer?: string;
          vod_content?: string;
        }>;
      }
      
      const data = await response.json() as ApiResponse;
      if (!data.list || !data.list[0]) {
        logger.repair.warn('No detail data', { vodId });
        failed++;
        continue;
      }

      const detail = data.list[0];
      
      // 更新所有字段
      await env.DB.prepare(`
        UPDATE vod_cache
        SET vod_pic = COALESCE(NULLIF(?, ''), vod_pic),
            vod_pic_thumb = COALESCE(NULLIF(?, ''), vod_pic_thumb),
            vod_pic_slide = COALESCE(NULLIF(?, ''), vod_pic_slide),
            vod_year = COALESCE(NULLIF(?, ''), vod_year),
            vod_area = COALESCE(NULLIF(?, ''), vod_area),
            vod_actor = COALESCE(NULLIF(?, ''), vod_actor),
            vod_director = COALESCE(NULLIF(?, ''), vod_director),
            vod_writer = COALESCE(NULLIF(?, ''), vod_writer),
            vod_content = COALESCE(NULLIF(?, ''), vod_content),
            updated_at = ?
        WHERE vod_id = ?
      `).bind(
        detail.vod_pic || '',
        detail.vod_pic_thumb || detail.vod_pic || '',
        detail.vod_pic_slide || detail.vod_pic || '',
        detail.vod_year || '',
        detail.vod_area || '',
        detail.vod_actor || '',
        detail.vod_director || '',
        detail.vod_writer || '',
        detail.vod_content || '',
        getCurrentTimestamp(),
        vodId
      ).run();

      logger.repair.info('Fixed data', { vodId, vodName: video.vod_name as string });
      fixed++;

      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      logger.repair.error('Error fixing video', { vodId: video.vod_id, error: error instanceof Error ? error.message : 'Unknown' });
      failed++;
    }
  }

  logger.repair.info('Fix covers completed', { fixed, failed });

  return {
    total: videos.results.length,
    fixed,
    failed,
  };
}
