/**
 * 视频合并服务（增强版）
 * 类似苹果CMS的多源合并逻辑，但更智能
 * 
 * 核心思路：
 * 1. 使用多字段智能匹配（名称+年份+地区+导演）
 * 2. 合并不同资源站的播放地址为多个线路
 * 3. 基于质量评分选择最优数据
 * 4. 支持相似度计算和模糊匹配
 */

import type { ResourceSite } from '../config';
import { getCurrentTimestamp } from '../utils/time';

interface Env {
  DB: D1Database;
}

interface VideoData {
  vod_name: string;
  vod_year?: string;
  vod_pic?: string;
  vod_area?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_content?: string;
  vod_play_url?: string;
  source_name: string;
  source_priority: number;
  quality_score?: number;
  [key: string]: string | number | undefined;
}

// 视频缓存数据库行类型
interface VodCacheRow {
  vod_id: string;
  vod_name: string;
  vod_year?: string;
  vod_pic?: string;
  vod_area?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_content?: string;
  vod_play_url?: string;
  source_name?: string;
  source_priority?: number;
  quality_score?: number;
}

// 带相似度的视频类型
interface VideoWithSimilarity extends VodCacheRow {
  similarity: number;
}

/**
 * 查找相似视频（增强版：多级匹配）
 */
export async function findSimilarVideo(
  env: Env,
  videoName: string,
  year?: string,
  area?: string,
  director?: string
): Promise<VodCacheRow | null> {
  // 1. 精确匹配：名称+年份+地区
  if (year && area) {
    const exact = await env.DB.prepare(`
      SELECT * FROM vod_cache
      WHERE vod_name = ? AND vod_year = ? AND vod_area = ?
      ORDER BY quality_score DESC
      LIMIT 1
    `).bind(videoName, year, area).first();
    
    if (exact) return exact;
  }
  
  // 2. 次精确匹配：名称+年份
  if (year) {
    const yearMatch = await env.DB.prepare(`
      SELECT * FROM vod_cache
      WHERE vod_name = ? AND vod_year = ?
      ORDER BY quality_score DESC
      LIMIT 1
    `).bind(videoName, year).first();
    
    if (yearMatch) return yearMatch;
  }
  
  // 3. 导演匹配：名称+导演
  if (director) {
    const directorMatch = await env.DB.prepare(`
      SELECT * FROM vod_cache
      WHERE vod_name = ? AND vod_director LIKE ?
      ORDER BY quality_score DESC
      LIMIT 1
    `).bind(videoName, `%${director}%`).first();
    
    if (directorMatch) return directorMatch;
  }
  
  // 4. 模糊匹配：只匹配名称（按质量评分排序）
  const similar = await env.DB.prepare(`
    SELECT * FROM vod_cache
    WHERE vod_name = ?
    ORDER BY quality_score DESC, source_priority DESC
    LIMIT 1
  `).bind(videoName).first();
  
  return similar;
}

/**
 * 计算字符串相似度（Levenshtein距离）
 */
function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // 初始化矩阵
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // 计算编辑距离
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // 删除
        matrix[i][j - 1] + 1,      // 插入
        matrix[i - 1][j - 1] + cost // 替换
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  
  // 返回相似度百分比
  return maxLen === 0 ? 100 : ((maxLen - distance) / maxLen) * 100;
}

/**
 * 查找相似视频（基于相似度）
 */
export async function findSimilarVideosBySimilarity(
  env: Env,
  videoName: string,
  threshold: number = 80
): Promise<VideoWithSimilarity[]> {
  // 获取候选视频（名称前几个字符相同）
  const prefix = videoName.substring(0, Math.min(3, videoName.length));
  
  const candidates = await env.DB.prepare(`
    SELECT * FROM vod_cache
    WHERE vod_name LIKE ?
    LIMIT 50
  `).bind(`${prefix}%`).all();
  
  // 计算相似度并过滤
  const similar = (candidates.results as VodCacheRow[])
    .map((video) => ({
      ...video,
      similarity: calculateSimilarity(videoName, video.vod_name),
    }))
    .filter((video) => video.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
  
  return similar;
}

/**
 * 合并播放地址
 * 将不同资源站的播放地址合并为多个线路
 */
export function mergePlayUrls(
  existingUrl: string,
  newUrl: string,
  sourceName: string
): string {
  if (!existingUrl) return newUrl;
  if (!newUrl) return existingUrl;
  
  try {
    const existing = JSON.parse(existingUrl);
    const newData = JSON.parse(newUrl);
    
    if (typeof existing === 'object' && typeof newData === 'object') {
      // 添加新线路，使用资源站名称作为前缀
      for (const [key, value] of Object.entries(newData)) {
        const routeName = `${sourceName}-${key}`;
        existing[routeName] = value;
      }
      return JSON.stringify(existing);
    }
    
    return existingUrl;
  } catch (error) {
    return existingUrl;
  }
}

/**
 * 计算视频数据质量评分
 */
function calculateQualityScore(video: VideoData): number {
  let score = 0;
  
  if (video.vod_pic && video.vod_pic.length > 10) score += 20;
  if (video.vod_actor && video.vod_actor.length > 0) score += 15;
  if (video.vod_director && video.vod_director.length > 0) score += 10;
  if (video.vod_content && video.vod_content.length > 20) score += 25;
  if (video.vod_play_url && video.vod_play_url.length > 10) score += 30;
  
  // 内容长度加分
  if (video.vod_content && video.vod_content.length > 100) {
    score += Math.min(10, Math.floor(video.vod_content.length / 50));
  }
  
  return score;
}

/**
 * 选择最优数据（增强版：基于质量评分）
 */
export function selectBestData(
  existing: VideoData,
  newData: VideoData
): Partial<VideoData> {
  const result: Partial<VideoData> = {};
  
  // 计算质量评分
  const existingScore = existing.quality_score || calculateQualityScore(existing);
  const newScore = newData.quality_score || calculateQualityScore(newData);
  
  // 优先级权重
  const priorityWeight = 0.3;
  const qualityWeight = 0.7;
  
  // 综合评分
  const existingTotal = existingScore * qualityWeight + existing.source_priority * priorityWeight;
  const newTotal = newScore * qualityWeight + newData.source_priority * priorityWeight;
  
  // 选择更完整的数据
  const fields = ['vod_pic', 'vod_area', 'vod_actor', 'vod_director', 'vod_content'];
  
  for (const field of fields) {
    const existingValue = existing[field] || '';
    const newValue = newData[field] || '';
    
    // 如果现有值为空，使用新值
    if (!existingValue && newValue) {
      result[field] = newValue;
      continue;
    }
    
    // 如果新值为空，保留现有值
    if (existingValue && !newValue) {
      continue;
    }
    
    // 都有值时，基于综合评分和长度选择
    if (newTotal > existingTotal || newValue.length > existingValue.length * 1.2) {
      result[field] = newValue;
    }
  }
  
  return result;
}

/**
 * 智能选择字段值
 */
export function selectBestField(
  existingValue: string,
  newValue: string,
  existingQuality: number,
  newQuality: number
): string {
  // 如果现有值为空，使用新值
  if (!existingValue && newValue) {
    return newValue;
  }
  
  // 如果新值为空，保留现有值
  if (existingValue && !newValue) {
    return existingValue;
  }
  
  // 都有值时，基于质量和长度选择
  if (newQuality > existingQuality) {
    return newValue;
  } else if (newQuality === existingQuality && newValue.length > existingValue.length) {
    return newValue;
  }
  
  return existingValue;
}

/**
 * 智能保存视频（带合并逻辑）
 */
export async function saveVideoWithMerge(
  env: Env,
  video: VideoData,
  source: ResourceSite
): Promise<'new' | 'merged' | 'updated'> {
  const videoName = video.vod_name || '';
  const year = video.vod_year || '';
  
  // 1. 查找相似视频
  const similar = await findSimilarVideo(env, videoName, year);
  
  if (!similar) {
    // 新视频，直接插入
    return 'new';
  }
  
  // 2. 合并播放地址
  const mergedPlayUrl = mergePlayUrls(
    similar.vod_play_url || '',
    video.vod_play_url || '',
    source.name
  );
  
  // 3. 选择最优数据
  const bestData = selectBestData(
    { ...similar, source_priority: similar.source_priority },
    { ...video, source_name: source.name, source_priority: source.weight }
  );
  
  // 4. 更新数据库
  const updateFields: string[] = [];
  const updateValues: (string | number)[] = [];
  
  if (mergedPlayUrl !== similar.vod_play_url) {
    updateFields.push('vod_play_url = ?');
    updateValues.push(mergedPlayUrl);
  }
  
  for (const [key, value] of Object.entries(bestData)) {
    if (value !== undefined) {
      updateFields.push(`${key} = ?`);
      updateValues.push(value);
    }
  }
  
  if (updateFields.length > 0) {
    updateFields.push('updated_at = ?');
    updateValues.push(getCurrentTimestamp());
    updateValues.push(similar.vod_id);
    
    await env.DB.prepare(`
      UPDATE vod_cache
      SET ${updateFields.join(', ')}
      WHERE vod_id = ?
    `).bind(...updateValues).run();
    
    return 'merged';
  }
  
  return 'updated';
}
