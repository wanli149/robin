/**
 * 语言版本合并服务
 * 
 * 将同一部电影的不同语言版本（国语、粤语、原声等）合并为一条记录
 * 语言作为播放线路的属性，而不是独立的视频条目
 * 
 * 示例：
 * - "禁闭岛国语4K" + "禁闭岛4K" + "禁闭岛粤语" → "禁闭岛" (多语言版本)
 */

import { logger } from '../utils/logger';
import type { CleanedPlayUrls, Episode } from './data_cleaner';
import { castD1Results } from '../utils/type_helpers';

interface Env {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
}

// 语言标识正则
const LANGUAGE_PATTERNS = [
  { pattern: /国语/g, lang: '国语' },
  { pattern: /粤语/g, lang: '粤语' },
  { pattern: /原声/g, lang: '原声' },
  { pattern: /英语/g, lang: '英语' },
  { pattern: /日语/g, lang: '日语' },
  { pattern: /韩语/g, lang: '韩语' },
  { pattern: /中字/g, lang: '中字' },
  { pattern: /字幕/g, lang: '字幕' },
];

// 清晰度标识正则
const QUALITY_PATTERNS = [
  { pattern: /4K/gi, quality: '4K' },
  { pattern: /1080[Pp]/g, quality: '1080P' },
  { pattern: /720[Pp]/g, quality: '720P' },
  { pattern: /蓝光/g, quality: '蓝光' },
  { pattern: /超清/g, quality: '超清' },
  { pattern: /高清/g, quality: '高清' },
  { pattern: /HD/gi, quality: 'HD' },
];

/**
 * 从视频名称中提取语言和清晰度信息
 */
export function extractVideoMeta(vodName: string): {
  baseName: string;
  language: string | null;
  quality: string | null;
} {
  let baseName = vodName;
  let language: string | null = null;
  let quality: string | null = null;

  // 提取语言
  for (const { pattern, lang } of LANGUAGE_PATTERNS) {
    if (pattern.test(baseName)) {
      language = lang;
      baseName = baseName.replace(pattern, '');
      break;
    }
  }

  // 提取清晰度
  for (const { pattern, quality: q } of QUALITY_PATTERNS) {
    if (pattern.test(baseName)) {
      quality = q;
      baseName = baseName.replace(pattern, '');
      break;
    }
  }

  // 清理多余空格和符号
  baseName = baseName.replace(/[\s\-_]+$/, '').trim();

  return { baseName, language, quality };
}

/**
 * 播放源结构（带语言信息）
 */
export interface PlaySourceWithLang {
  name: string;           // 线路名称（如：超清1、蓝光线路）
  language: string;       // 语言版本（如：国语、粤语、原声）
  quality: string | null; // 清晰度（如：4K、1080P）
  episodes: Episode[];    // 集数列表
  count: number;          // 集数
}

/**
 * 合并后的视频详情
 */
export interface MergedVideoDetail {
  vod_id: string;
  vod_name: string;           // 基础名称（不含语言/清晰度后缀）
  vod_pic: string;
  vod_year: string;
  vod_area: string;
  vod_actor: string;
  vod_director: string;
  vod_content: string;
  vod_remarks: string;
  vod_score: number;
  type_id: number;
  type_name: string;
  // 合并后的播放源（按语言分组）
  play_sources: PlaySourceWithLang[];
  // 可用语言列表
  available_languages: string[];
  // 可用清晰度列表
  available_qualities: string[];
}

/**
 * 数据库视频行类型
 */
interface VodCacheRow {
  vod_id: string;
  vod_name: string;
  vod_pic?: string;
  vod_pic_thumb?: string;
  vod_year?: string;
  vod_area?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_content?: string;
  vod_remarks?: string;
  vod_score?: number;
  vod_play_url?: string;
  vod_hits?: number;
  type_id?: number;
  type_name?: string;
  source_name?: string;
  updated_at?: number;
}

/**
 * 查找同一影片的所有版本
 */
export async function findAllVersions(
  env: Env,
  vodId: string
): Promise<VodCacheRow[]> {
  // 1. 先获取当前视频
  const current = await env.DB.prepare(`
    SELECT * FROM vod_cache WHERE vod_id = ? AND is_valid = 1
  `).bind(vodId).first() as VodCacheRow | null;

  if (!current) return [];

  // 2. 提取基础名称
  const { baseName } = extractVideoMeta(current.vod_name);
  
  if (!baseName) return [current];

  // 3. 查找所有相关版本（基础名称相同 + 年份相同）
  const versions = await env.DB.prepare(`
    SELECT * FROM vod_cache 
    WHERE is_valid = 1 
      AND (
        vod_name = ? 
        OR vod_name LIKE ?
        OR vod_name LIKE ?
        OR vod_name LIKE ?
        OR vod_name LIKE ?
      )
      AND (vod_year = ? OR vod_year IS NULL OR vod_year = '')
    ORDER BY quality_score DESC, vod_id ASC
  `).bind(
    baseName,
    `${baseName}国语%`,
    `${baseName}粤语%`,
    `${baseName}4K%`,
    `${baseName}%`,
    current.vod_year || ''
  ).all();

  // 4. 过滤：只保留真正相关的版本
  const filtered = castD1Results<VodCacheRow>(versions.results).filter(v => {
    const { baseName: vBaseName } = extractVideoMeta(v.vod_name);
    return vBaseName === baseName;
  });

  return filtered.length > 0 ? filtered : [current];
}

/**
 * 合并多个版本为一个详情
 */
export function mergeVersions(versions: VodCacheRow[]): MergedVideoDetail | null {
  if (versions.length === 0) return null;

  // 选择主记录（质量最高的）
  const primary = versions[0];
  const { baseName } = extractVideoMeta(primary.vod_name);

  // 收集所有播放源
  const allSources: PlaySourceWithLang[] = [];
  const languageSet = new Set<string>();
  const qualitySet = new Set<string>();

  for (const version of versions) {
    const { language, quality } = extractVideoMeta(version.vod_name);
    
    // 解析播放地址
    let playUrls: CleanedPlayUrls = {};
    try {
      playUrls = JSON.parse(version.vod_play_url || '{}');
    } catch {
      continue;
    }

    // 转换为带语言信息的播放源
    for (const [sourceName, episodes] of Object.entries(playUrls)) {
      if (!Array.isArray(episodes) || episodes.length === 0) continue;

      const lang = language || '原声';
      const qual = quality || inferQualityFromSource(sourceName);

      languageSet.add(lang);
      if (qual) qualitySet.add(qual);

      allSources.push({
        name: sourceName,
        language: lang,
        quality: qual,
        episodes: episodes,
        count: episodes.length,
      });
    }
  }

  // 如果没有播放源，返回 null
  if (allSources.length === 0) return null;

  // 去重：相同线路名+语言只保留一个
  const uniqueSources = deduplicateSources(allSources);

  return {
    vod_id: primary.vod_id,
    vod_name: baseName || primary.vod_name,
    vod_pic: primary.vod_pic || '',
    vod_year: primary.vod_year || '',
    vod_area: primary.vod_area || '',
    vod_actor: primary.vod_actor || '',
    vod_director: primary.vod_director || '',
    vod_content: selectBestContent(versions),
    vod_remarks: primary.vod_remarks || '',
    vod_score: primary.vod_score || 0,
    type_id: primary.type_id || 1,
    type_name: primary.type_name || '',
    play_sources: uniqueSources,
    available_languages: Array.from(languageSet),
    available_qualities: Array.from(qualitySet),
  };
}

/**
 * 从线路名称推断清晰度
 */
function inferQualityFromSource(sourceName: string): string | null {
  for (const { pattern, quality } of QUALITY_PATTERNS) {
    if (pattern.test(sourceName)) {
      return quality;
    }
  }
  return null;
}

/**
 * 选择最佳简介（最长的）
 */
function selectBestContent(versions: VodCacheRow[]): string {
  let best = '';
  for (const v of versions) {
    if (v.vod_content && v.vod_content.length > best.length) {
      best = v.vod_content;
    }
  }
  return best;
}

/**
 * 去重播放源
 */
function deduplicateSources(sources: PlaySourceWithLang[]): PlaySourceWithLang[] {
  const seen = new Map<string, PlaySourceWithLang>();
  
  for (const source of sources) {
    const key = `${source.name}-${source.language}`;
    if (!seen.has(key) || source.count > (seen.get(key)?.count || 0)) {
      seen.set(key, source);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * 获取合并后的视频详情
 */
export async function getMergedVideoDetail(
  env: Env,
  vodId: string
): Promise<MergedVideoDetail | null> {
  try {
    // 查找所有版本
    const versions = await findAllVersions(env, vodId);
    
    if (versions.length === 0) {
      return null;
    }

    // 合并版本
    return mergeVersions(versions);
  } catch (error) {
    logger.vod.error('Failed to get merged video detail', {
      vodId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * 提取视频基础名称（去除语言和清晰度后缀）
 */
function getBaseNameForGrouping(vodName: string): string {
  let baseName = vodName;
  
  // 移除语言标识
  for (const { pattern } of LANGUAGE_PATTERNS) {
    baseName = baseName.replace(pattern, '');
  }
  
  // 移除清晰度标识
  for (const { pattern } of QUALITY_PATTERNS) {
    baseName = baseName.replace(pattern, '');
  }
  
  // 清理多余空格和符号
  baseName = baseName.replace(/[\s\-_]+$/, '').trim();
  
  return baseName;
}

/**
 * 片库去重：获取去重后的视频列表
 * 同一影片的多个语言版本只返回一条（质量最高的）
 */
export async function getDeduplicatedLibrary(
  env: Env,
  options: {
    typeId?: number;
    area?: string;
    year?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }
): Promise<{ list: VodCacheRow[]; total: number }> {
  const { typeId, area, year, page = 1, limit = 20, sort = 'time' } = options;

  // 构建查询条件
  const conditions: string[] = ['is_valid = 1'];
  const params: (string | number)[] = [];

  if (typeId) {
    conditions.push('type_id = ?');
    params.push(typeId);
  }
  if (area) {
    conditions.push('vod_area LIKE ?');
    params.push(`%${area}%`);
  }
  if (year) {
    conditions.push('vod_year = ?');
    params.push(year);
  }

  const whereClause = conditions.join(' AND ');

  // 排序
  let orderBy = 'updated_at DESC';
  if (sort === 'hits') orderBy = 'vod_hits DESC';
  if (sort === 'score') orderBy = 'vod_score DESC';

  // 先获取所有符合条件的视频
  const allSql = `
    SELECT * FROM vod_cache
    WHERE ${whereClause}
    ORDER BY quality_score DESC, ${orderBy}
  `;

  const allResult = await env.DB.prepare(allSql).bind(...params).all();
  const allVideos = castD1Results<VodCacheRow>(allResult.results);

  // 在应用层进行去重（按基础名称+年份分组）
  const groupedMap = new Map<string, VodCacheRow>();
  
  for (const video of allVideos) {
    const baseName = getBaseNameForGrouping(video.vod_name);
    const groupKey = `${baseName}-${video.vod_year || ''}`;
    
    // 只保留每组的第一个（质量最高的，因为已按quality_score排序）
    if (!groupedMap.has(groupKey)) {
      groupedMap.set(groupKey, video);
    }
  }

  // 转换为数组并重新排序
  let deduplicatedList = Array.from(groupedMap.values());
  
  // 根据排序条件重新排序
  if (sort === 'hits') {
    deduplicatedList.sort((a, b) => (b.vod_hits || 0) - (a.vod_hits || 0));
  } else if (sort === 'score') {
    deduplicatedList.sort((a, b) => (b.vod_score || 0) - (a.vod_score || 0));
  }
  // 默认按 updated_at 排序（已在SQL中处理）

  // 分页
  const total = deduplicatedList.length;
  const offset = (page - 1) * limit;
  const pagedList = deduplicatedList.slice(offset, offset + limit);

  return {
    list: pagedList,
    total,
  };
}
