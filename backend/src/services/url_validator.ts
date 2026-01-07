/**
 * URL Validator Service
 * 播放地址失效检测服务
 * 
 * 核心功能：
 * 1. 定期检测播放地址是否失效
 * 2. 用户反馈失效地址
 * 3. 自动标记失效视频
 * 4. 触发重新采集
 */

import { logger } from '../utils/logger';

interface Env {
  DB: D1Database;
}

/**
 * 检测播放地址是否有效
 */
export async function validatePlayUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * 批量检测视频播放地址（Cron任务）
 */
export async function batchValidateUrls(env: Env, limit: number = 100): Promise<{
  checked: number;
  invalid: number;
}> {
  logger.validator.info('Starting batch validation...');

  // 1. 获取需要检查的视频（优先检查旧的）
  const result = await env.DB.prepare(`
    SELECT vod_id, vod_name, vod_play_url, last_check
    FROM vod_cache
    WHERE is_valid = 1
    AND (last_check IS NULL OR last_check < ?)
    ORDER BY last_check ASC NULLS FIRST
    LIMIT ?
  `).bind(
    Math.floor(Date.now() / 1000) - 86400 * 7, // 7天未检查
    limit
  ).all();

  // 定义视频行类型
  interface VideoValidateRow {
    vod_id: string;
    vod_name: string;
    vod_play_url: string | null;
    last_check: number | null;
  }
  
  const videos = result.results as VideoValidateRow[];
  let invalidCount = 0;

  // 2. 逐个检测
  for (const video of videos) {
    try {
      // 解析播放地址（取第一个）
      const playUrl = extractFirstPlayUrl(video.vod_play_url);
      
      if (!playUrl) {
        continue;
      }

      const isValid = await validatePlayUrl(playUrl);
      const now = Math.floor(Date.now() / 1000);

      if (!isValid) {
        // 标记为失效
        await env.DB.prepare(`
          UPDATE vod_cache
          SET is_valid = 0, last_check = ?
          WHERE vod_id = ?
        `).bind(now, video.vod_id).run();

        // 记录失效
        await env.DB.prepare(`
          INSERT INTO vod_invalid_urls (vod_id, vod_name, play_url, error_type, reported_by)
          VALUES (?, ?, ?, 'timeout', 'system')
        `).bind(video.vod_id, video.vod_name, playUrl).run();

        invalidCount++;
        logger.validator.info(`Invalid: ${video.vod_name}`);
      } else {
        // 更新检查时间
        await env.DB.prepare(`
          UPDATE vod_cache
          SET last_check = ?
          WHERE vod_id = ?
        `).bind(now, video.vod_id).run();
      }

    } catch (error) {
      logger.validator.error('Error checking video', { vodId: video.vod_id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  logger.validator.info(`Checked ${videos.length}, invalid ${invalidCount}`);

  return {
    checked: videos.length,
    invalid: invalidCount,
  };
}

/**
 * 用户反馈播放地址失效
 */
export async function reportInvalidUrl(
  env: Env,
  vodId: string,
  vodName: string,
  playUrl: string,
  errorType: string = 'user_report'
): Promise<void> {
  // 1. 记录失效报告
  await env.DB.prepare(`
    INSERT INTO vod_invalid_urls (vod_id, vod_name, play_url, error_type, reported_by)
    VALUES (?, ?, ?, ?, 'user')
  `).bind(vodId, vodName, playUrl, errorType).run();

  // 2. 检查是否需要标记为失效（多个用户反馈）
  const count = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM vod_invalid_urls
    WHERE vod_id = ? AND is_fixed = 0
  `).bind(vodId).first();

  if (count && (count.count as number) >= 3) {
    // 3个以上用户反馈，标记为失效
    await env.DB.prepare(`
      UPDATE vod_cache
      SET is_valid = 0
      WHERE vod_id = ?
    `).bind(vodId).run();

    logger.validator.info(`Marked ${vodId} as invalid (user reports)`);
  }
}

/**
 * 提取第一个播放地址（新格式）
 */
function extractFirstPlayUrl(playUrlStr: string): string | null {
  if (!playUrlStr) {
    return null;
  }

  try {
    const parsed = JSON.parse(playUrlStr);
    const firstSource = Object.values(parsed)[0];
    
    // 新格式：{ "资源站": [{ name, url }] }
    if (Array.isArray(firstSource) && firstSource.length > 0) {
      return (firstSource[0] as { name: string; url: string }).url || null;
    }
  } catch (error) {
    // JSON 解析失败
  }

  return null;
}
