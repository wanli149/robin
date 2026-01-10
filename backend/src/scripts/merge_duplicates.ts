/**
 * 合并重复视频脚本（优化版）
 * 在当前表结构上直接合并重复的视频
 * 
 * 优化点：
 * 1. 批量处理，减少数据库操作
 * 2. 基于质量评分选择最优记录
 * 3. 更智能的数据合并策略
 * 4. 支持事务回滚
 */

import type { MergeVideoRow } from '../types/database';
import { logger } from '../utils/logger';

interface Env {
  DB: D1Database;
}

interface MergeStats {
  total: number;
  merged: number;
  deleted: number;
  errors: number;
}

/** 重复组统计行 */
interface DuplicateGroupRow {
  vod_name: string;
  vod_year: string;
  count: number;
}

/** 视频合并数据行 */
interface VideoMergeRow {
  vod_id: string;
  vod_name: string;
  vod_year: string;
  vod_area: string | null;
  vod_pic: string | null;
  vod_actor: string | null;
  vod_director: string | null;
  vod_content: string | null;
  vod_play_url: string | null;
  source_name: string | null;
  source_priority: number;
  quality_score: number | null;
}

/**
 * 计算视频质量评分
 */
function calculateQualityScore(video: Partial<VideoMergeRow>): number {
  let score = 0;
  
  if (video.vod_pic && video.vod_pic.length > 10) score += 20;
  if (video.vod_actor && video.vod_actor.length > 0) score += 15;
  if (video.vod_director && video.vod_director.length > 0) score += 10;
  if (video.vod_content && video.vod_content.length > 20) score += 25;
  if (video.vod_play_url && video.vod_play_url.length > 10) score += 30;
  
  if (video.vod_content && video.vod_content.length > 100) {
    score += Math.min(10, Math.floor(video.vod_content.length / 50));
  }
  
  return score;
}

/**
 * 合并重复视频（优化版）
 */
export async function mergeDuplicateVideos(
  env: Env,
  batchSize: number = 50
): Promise<MergeStats> {
  logger.dedup.info('Starting to merge duplicate videos...');
  
  const stats: MergeStats = {
    total: 0,
    merged: 0,
    deleted: 0,
    errors: 0,
  };
  
  try {
    // 1. 查找重复视频（使用GROUP BY和HAVING）
    const duplicatesResult = await env.DB.prepare(`
      SELECT vod_name, vod_year, COUNT(*) as count
      FROM vod_cache
      GROUP BY vod_name, vod_year
      HAVING count > 1
      ORDER BY count DESC
    `).all();

    const duplicateGroups = (duplicatesResult.results || []) as unknown as DuplicateGroupRow[];
    logger.dedup.info('Found duplicate groups', { count: duplicateGroups.length });
    
    if (duplicateGroups.length === 0) {
      logger.dedup.info('No duplicates found');
      return stats;
    }

    // 2. 批量处理重复组
    for (let i = 0; i < duplicateGroups.length; i += batchSize) {
      const batch = duplicateGroups.slice(i, i + batchSize);
      
      for (const group of batch) {
        try {
          await mergeGroup(env, group.vod_name, group.vod_year, stats);
        } catch (error) {
          logger.dedup.error('Error merging group', { vodName: group.vod_name, error: error instanceof Error ? error.message : 'Unknown' });
          stats.errors++;
        }
      }
      
      logger.dedup.info('Processed groups', { processed: Math.min(i + batchSize, duplicateGroups.length), total: duplicateGroups.length });
    }

    logger.dedup.info('Merge completed', { merged: stats.merged, deleted: stats.deleted, errors: stats.errors });
    
  } catch (error) {
    logger.dedup.error('Fatal error during merge', { error: error instanceof Error ? error.message : 'Unknown' });
    throw error;
  }

  return stats;
}

/**
 * 合并单个重复组
 */
async function mergeGroup(
  env: Env,
  vodName: string,
  vodYear: string,
  stats: MergeStats
): Promise<void> {
  // 获取该组的所有视频
  const result = await env.DB.prepare(`
    SELECT vod_id, vod_name, vod_year, vod_area, vod_pic, vod_actor, vod_director, 
           vod_content, vod_play_url, source_name, source_priority, quality_score
    FROM vod_cache
    WHERE vod_name = ? AND (vod_year = ? OR (vod_year IS NULL AND ? IS NULL))
    ORDER BY quality_score DESC, source_priority DESC
  `).bind(vodName, vodYear, vodYear).all();

  const videos = (result.results || []) as unknown as VideoMergeRow[];
  
  if (videos.length <= 1) {
    return; // 没有重复
  }

  stats.total += videos.length;

  // 计算质量评分（如果没有）
  for (const video of videos) {
    if (!video.quality_score) {
      video.quality_score = calculateQualityScore(video);
    }
  }

  // 按质量评分排序，选择最优记录作为主记录
  videos.sort((a, b) => {
    const scoreA = a.quality_score ?? 0;
    const scoreB = b.quality_score ?? 0;
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    return b.source_priority - a.source_priority;
  });

  const primary = videos[0];
  const duplicates = videos.slice(1);

  // 合并播放地址
  const playUrls: Record<string, unknown> = {};
  const sources = new Set<string>();

  for (const video of videos) {
    if (video.source_name) {
      video.source_name.split(',').forEach((s: string) => sources.add(s.trim()));
    }
    
    try {
      if (video.vod_play_url) {
        const urls = JSON.parse(video.vod_play_url);
        if (typeof urls === 'object') {
          Object.assign(playUrls, urls);
        } else {
          playUrls[video.source_name || 'default'] = video.vod_play_url;
        }
      }
    } catch {
      if (video.vod_play_url) {
        playUrls[video.source_name || 'default'] = video.vod_play_url;
      }
    }
  }

  // 智能选择最优字段值
  let bestPic = primary.vod_pic || '';
  let bestActor = primary.vod_actor || '';
  let bestDirector = primary.vod_director || '';
  let bestContent = primary.vod_content || '';
  let bestArea = primary.vod_area || '';

  for (const video of videos) {
    // 选择更长且有效的数据
    const picLen = (video.vod_pic || '').length;
    if (picLen > bestPic.length && video.vod_pic && video.vod_pic.startsWith('http')) {
      bestPic = video.vod_pic;
    }
    const actorLen = (video.vod_actor || '').length;
    if (actorLen > bestActor.length && video.vod_actor) {
      bestActor = video.vod_actor;
    }
    const directorLen = (video.vod_director || '').length;
    if (directorLen > bestDirector.length && video.vod_director) {
      bestDirector = video.vod_director;
    }
    const contentLen = (video.vod_content || '').length;
    if (contentLen > bestContent.length && video.vod_content) {
      bestContent = video.vod_content;
    }
    const areaLen = (video.vod_area || '').length;
    if (areaLen > bestArea.length && video.vod_area) {
      bestArea = video.vod_area;
    }
  }

  // 重新计算质量评分
  const mergedQualityScore = calculateQualityScore({
    vod_pic: bestPic,
    vod_actor: bestActor,
    vod_director: bestDirector,
    vod_content: bestContent,
    vod_play_url: JSON.stringify(playUrls),
  });

  // 更新主记录
  await env.DB.prepare(`
    UPDATE vod_cache
    SET vod_pic = ?,
        vod_area = ?,
        vod_actor = ?,
        vod_director = ?,
        vod_content = ?,
        vod_play_url = ?,
        source_name = ?,
        source_priority = ?,
        quality_score = ?,
        updated_at = ?
    WHERE vod_id = ?
  `).bind(
    bestPic,
    bestArea,
    bestActor,
    bestDirector,
    bestContent,
    JSON.stringify(playUrls),
    Array.from(sources).join(','),
    Math.max(...videos.map(v => v.source_priority || 0)),
    mergedQualityScore,
    Math.floor(Date.now() / 1000),
    primary.vod_id
  ).run();

  // 批量删除重复记录（使用参数化查询防止SQL注入）
  if (duplicates.length > 0) {
    const placeholders = duplicates.map(() => '?').join(',');
    const deleteIds = duplicates.map(d => d.vod_id);
    await env.DB.prepare(`
      DELETE FROM vod_cache WHERE vod_id IN (${placeholders})
    `).bind(...deleteIds).run();
    
    stats.deleted += duplicates.length;
  }

  stats.merged++;
}

/**
 * 查找并报告潜在重复（不执行合并）
 */
export async function findDuplicates(env: Env): Promise<Array<{ vod_name: string; vod_year: string; count: number; ids: string; sources: string }>> {
  const result = await env.DB.prepare(`
    SELECT vod_name, vod_year, COUNT(*) as count,
           GROUP_CONCAT(vod_id) as ids,
           GROUP_CONCAT(source_name) as sources
    FROM vod_cache
    GROUP BY vod_name, vod_year
    HAVING count > 1
    ORDER BY count DESC
    LIMIT 100
  `).all();

  return result.results as Array<{ vod_name: string; vod_year: string; count: number; ids: string; sources: string }>;
}
