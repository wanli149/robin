/**
 * Recommendation Engine V2
 * 推荐引擎 V2 - 多策略智能推荐
 * 
 * 支持的推荐策略：
 * 1. content_based - 基于内容相似度（分类、演员、标签、地区、年份）
 * 2. collaborative - 协同过滤（基于用户行为）
 * 3. trending - 热门趋势（基于播放量、评分）
 * 4. personalized - 个性化推荐（结合用户历史）
 * 5. similar - 相似内容（用于详情页"猜你喜欢"）
 * 6. shorts_similar - 短剧相似推荐
 * 
 * 缓存策略：
 * - 预计算推荐存储在 vod_recommendations 表
 * - 热门推荐缓存在 KV（TTL 10分钟）
 * - 个性化推荐实时计算
 */

import type { 
  VodCacheRow, 
  VodCacheListRow, 
  ShortsListRow,
  WatchHistoryRow,
  DbQueryParam 
} from '../types/database';
import { logger } from '../utils/logger';
import { CACHE_CONFIG } from '../config';
import { getCurrentTimestamp, getDaysAgo } from '../utils/time';
import { castD1Results } from '../utils/type_helpers';

// 删除重复的 castResults 函数，使用统一的 type_helpers

interface Env {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
}

// 推荐策略类型
export type RecommendStrategy = 
  | 'content_based'
  | 'collaborative' 
  | 'trending'
  | 'personalized'
  | 'similar'
  | 'shorts_similar';

// 推荐请求参数
export interface RecommendRequest {
  strategy: RecommendStrategy;
  vodId?: string;           // 基于某个视频推荐
  userId?: number;          // 用户ID（个性化推荐）
  typeId?: number;          // 限定分类
  limit?: number;           // 返回数量
  excludeIds?: string[];    // 排除的视频ID
}

// 推荐结果
export interface RecommendResult {
  list: VodCacheListRow[] | ShortsListRow[];
  strategy: RecommendStrategy;
  cached: boolean;
  confidence: number;
}

/**
 * 统一推荐入口
 */
export async function getRecommendationsV2(
  env: Env,
  request: RecommendRequest
): Promise<RecommendResult> {
  const { strategy } = request;
  
  try {
    switch (strategy) {
      case 'content_based':
        return await getContentBasedRecommendations(env, request);
      
      case 'collaborative':
        return await getCollaborativeRecommendations(env, request);
      
      case 'trending':
        return await getTrendingRecommendations(env, request);
      
      case 'personalized':
        return await getPersonalizedRecommendations(env, request);
      
      case 'similar':
        return await getSimilarRecommendations(env, request);
      
      case 'shorts_similar':
        return await getShortsSimilarRecommendations(env, request);
      
      default:
        // 降级到热门推荐
        return await getTrendingRecommendations(env, { ...request, strategy: 'trending' });
    }
  } catch (error) {
    logger.recommendV2.error('Strategy failed', { strategy, error: error instanceof Error ? error.message : String(error) });
    // 降级返回空结果
    return { list: [], strategy, cached: false, confidence: 0 };
  }
}

/**
 * 基于内容的推荐
 * 根据视频的分类、演员、标签等属性计算相似度
 * 
 * 优化策略：
 * 1. 优先查找有相同演员的视频
 * 2. 其次查找同类型+同地区的视频
 * 3. 最后补充同类型的热门视频
 */
async function getContentBasedRecommendations(
  env: Env,
  request: RecommendRequest
): Promise<RecommendResult> {
  const { vodId, typeId, limit = 10, excludeIds = [] } = request;
  
  if (!vodId) {
    return { list: [], strategy: 'content_based', cached: false, confidence: 0 };
  }
  
  // 1. 尝试从预计算缓存获取
  const cached = await env.DB.prepare(`
    SELECT similar_ids, confidence FROM vod_recommendations 
    WHERE vod_id = ? AND algorithm = 'content'
  `).bind(vodId).first();
  
  if (cached?.similar_ids) {
    const ids = JSON.parse(cached.similar_ids as string) as string[];
    const filteredIds = ids.filter(id => !excludeIds.includes(id)).slice(0, limit);
    
    if (filteredIds.length > 0) {
      const videos = await fetchVideosByIds(env, filteredIds);
      return {
        list: videos,
        strategy: 'content_based',
        cached: true,
        confidence: (cached.confidence as number) || 0.8,
      };
    }
  }
  
  // 2. 实时计算 - 获取目标视频信息
  const target = await env.DB.prepare(`
    SELECT * FROM vod_cache WHERE vod_id = ? AND is_valid = 1
  `).bind(vodId).first();
  
  if (!target) {
    return { list: [], strategy: 'content_based', cached: false, confidence: 0 };
  }
  
  const targetTypeId = typeId || (target.type_id as number);
  const targetActors = parseList(target.vod_actor as string);
  const targetArea = target.vod_area as string;
  const allExcludeIds = [vodId, ...excludeIds];
  
  const results: VodCacheListRow[] = [];
  const addedIds = new Set<string>();
  
  // 策略1: 查找有相同主演的视频（最相关）
  if (targetActors.length > 0) {
    // 取前3个主演
    const mainActors = targetActors.slice(0, 3);
    const actorConditions = mainActors.map(() => 'vod_actor LIKE ?').join(' OR ');
    const actorParams = mainActors.map(a => `%${a}%`);
    
    const actorQuery = `
      SELECT vod_id, vod_name, vod_pic, vod_actor, vod_area, vod_year, 
             vod_tag, type_id, vod_score, vod_hits, vod_remarks
      FROM vod_cache
      WHERE vod_id NOT IN (${allExcludeIds.map(() => '?').join(',')})
        AND is_valid = 1
        AND (${actorConditions})
      ORDER BY vod_score DESC, vod_hits DESC
      LIMIT 20
    `;
    
    const actorResults = await env.DB.prepare(actorQuery)
      .bind(...allExcludeIds, ...actorParams)
      .all();
    
    for (const video of castD1Results<VodCacheListRow>(actorResults.results)) {
      if (!addedIds.has(video.vod_id)) {
        results.push(video);
        addedIds.add(video.vod_id);
      }
    }
  }
  
  // 策略2: 同类型+同地区的视频
  if (results.length < limit && targetArea) {
    const areaQuery = `
      SELECT vod_id, vod_name, vod_pic, vod_actor, vod_area, vod_year, 
             vod_tag, type_id, vod_score, vod_hits, vod_remarks
      FROM vod_cache
      WHERE vod_id NOT IN (${[...allExcludeIds, ...Array.from(addedIds)].map(() => '?').join(',')})
        AND is_valid = 1
        AND type_id = ?
        AND vod_area = ?
      ORDER BY vod_score DESC, vod_hits DESC
      LIMIT ?
    `;
    
    const remaining = limit - results.length + 5; // 多取一些用于后续排序
    const areaResults = await env.DB.prepare(areaQuery)
      .bind(...allExcludeIds, ...Array.from(addedIds), targetTypeId, targetArea, remaining)
      .all();
    
    for (const video of castD1Results<VodCacheListRow>(areaResults.results)) {
      if (!addedIds.has(video.vod_id)) {
        results.push(video);
        addedIds.add(video.vod_id);
      }
    }
  }
  
  // 策略3: 补充同类型的热门视频
  if (results.length < limit) {
    const fallbackQuery = `
      SELECT vod_id, vod_name, vod_pic, vod_actor, vod_area, vod_year, 
             vod_tag, type_id, vod_score, vod_hits, vod_remarks
      FROM vod_cache
      WHERE vod_id NOT IN (${[...allExcludeIds, ...Array.from(addedIds)].map(() => '?').join(',')})
        AND is_valid = 1
        AND type_id = ?
      ORDER BY vod_score DESC, vod_hits DESC
      LIMIT ?
    `;
    
    const remaining = limit - results.length;
    const fallbackResults = await env.DB.prepare(fallbackQuery)
      .bind(...allExcludeIds, ...Array.from(addedIds), targetTypeId, remaining)
      .all();
    
    for (const video of castD1Results<VodCacheListRow>(fallbackResults.results)) {
      if (!addedIds.has(video.vod_id)) {
        results.push(video);
        addedIds.add(video.vod_id);
      }
    }
  }
  
  // 计算相似度并排序
  const scored = results.map(candidate => ({
    ...candidate,
    similarity: calculateContentSimilarity(target, candidate),
  }));
  
  scored.sort((a, b) => b.similarity - a.similarity);
  
  const finalResult = scored.slice(0, limit);
  const avgConfidence = finalResult.length > 0 
    ? finalResult.reduce((sum, v) => sum + v.similarity, 0) / finalResult.length 
    : 0;
  
  return {
    list: finalResult,
    strategy: 'content_based',
    cached: false,
    confidence: avgConfidence,
  };
}

/**
 * 协同过滤推荐
 * 基于用户行为（观看、收藏）找到相似用户，推荐他们喜欢的内容
 */
async function getCollaborativeRecommendations(
  env: Env,
  request: RecommendRequest
): Promise<RecommendResult> {
  const { userId, typeId, limit = 10, excludeIds = [] } = request;
  
  if (!userId) {
    // 无用户信息，降级到热门推荐
    return getTrendingRecommendations(env, { ...request, strategy: 'trending' });
  }
  
  // 1. 获取用户观看历史
  const userHistory = await env.DB.prepare(`
    SELECT vod_id FROM history 
    WHERE user_id = ? 
    ORDER BY updated_at DESC 
    LIMIT 50
  `).bind(userId).all();
  
  const watchedIds = (userHistory.results as Pick<WatchHistoryRow, 'vod_id'>[]).map(r => r.vod_id);
  
  if (watchedIds.length === 0) {
    return getTrendingRecommendations(env, { ...request, strategy: 'trending' });
  }
  
  // 2. 找到看过相同视频的其他用户
  const placeholders = watchedIds.map(() => '?').join(',');
  const similarUsers = await env.DB.prepare(`
    SELECT user_id, COUNT(*) as overlap
    FROM history
    WHERE vod_id IN (${placeholders}) AND user_id != ?
    GROUP BY user_id
    HAVING overlap >= 3
    ORDER BY overlap DESC
    LIMIT 20
  `).bind(...watchedIds, userId).all();
  
  if ((similarUsers.results as { user_id: number; overlap: number }[]).length === 0) {
    return getTrendingRecommendations(env, { ...request, strategy: 'trending' });
  }
  
  // 3. 获取相似用户喜欢但当前用户没看过的视频
  const similarUserIds = (similarUsers.results as { user_id: number; overlap: number }[]).map(r => r.user_id);
  const userPlaceholders = similarUserIds.map(() => '?').join(',');
  const excludePlaceholders = [...watchedIds, ...excludeIds].map(() => '?').join(',');
  
  let recQuery = `
    SELECT v.*, COUNT(DISTINCT h.user_id) as rec_score
    FROM vod_cache v
    JOIN history h ON v.vod_id = h.vod_id
    WHERE h.user_id IN (${userPlaceholders})
      AND v.vod_id NOT IN (${excludePlaceholders})
      AND v.is_valid = 1
  `;
  
  const queryParams: DbQueryParam[] = [...similarUserIds, ...watchedIds, ...excludeIds];
  
  if (typeId) {
    recQuery += ' AND v.type_id = ?';
    queryParams.push(typeId);
  }
  
  recQuery += ' GROUP BY v.vod_id ORDER BY rec_score DESC, v.vod_score DESC LIMIT ?';
  queryParams.push(limit);
  
  const recommendations = await env.DB.prepare(recQuery).bind(...queryParams).all();
  
  return {
    list: castD1Results<VodCacheListRow>(recommendations.results),
    strategy: 'collaborative',
    cached: false,
    confidence: 0.7,
  };
}

/**
 * 热门趋势推荐
 * 基于播放量、评分、更新时间的综合排序
 */
async function getTrendingRecommendations(
  env: Env,
  request: RecommendRequest
): Promise<RecommendResult> {
  const { typeId, limit = 10, excludeIds = [] } = request;
  
  // 尝试从缓存获取
  const cacheKey = `trending:${typeId || 'all'}:${limit}`;
  const cached = await env.ROBIN_CACHE.get(cacheKey, 'json');
  
  if (cached && excludeIds.length === 0) {
    return {
      list: cached as VodCacheListRow[],
      strategy: 'trending',
      cached: true,
      confidence: 0.9,
    };
  }
  
  // 查询热门视频
  let query = `
    SELECT vod_id, vod_name, vod_pic, vod_pic_thumb, vod_remarks,
           vod_score, vod_hits, vod_year, vod_area, type_id,
           (vod_hits * 0.4 + vod_score * 1000 * 0.3 + 
            (strftime('%s', 'now') - updated_at) / -86400 * 0.3) as trend_score
    FROM vod_cache
    WHERE is_valid = 1
  `;
  
  const params: DbQueryParam[] = [];
  
  if (typeId) {
    query += ' AND type_id = ?';
    params.push(typeId);
  }
  
  if (excludeIds.length > 0) {
    query += ` AND vod_id NOT IN (${excludeIds.map(() => '?').join(',')})`;
    params.push(...excludeIds);
  }
  
  query += ' ORDER BY trend_score DESC LIMIT ?';
  params.push(limit);
  
  const result = await env.DB.prepare(query).bind(...params).all();
  
  // 缓存结果
  if (excludeIds.length === 0 && result.results.length > 0) {
    await env.ROBIN_CACHE.put(cacheKey, JSON.stringify(result.results), {
      expirationTtl: CACHE_CONFIG.rankingTTL,
    });
  }
  
  return {
    list: castD1Results<VodCacheListRow>(result.results),
    strategy: 'trending',
    cached: false,
    confidence: 0.9,
  };
}

/**
 * 个性化推荐
 * 结合用户历史、偏好和热门内容
 */
async function getPersonalizedRecommendations(
  env: Env,
  request: RecommendRequest
): Promise<RecommendResult> {
  const { userId, typeId, limit = 10, excludeIds = [] } = request;
  
  if (!userId) {
    return getTrendingRecommendations(env, { ...request, strategy: 'trending' });
  }
  
  // 1. 分析用户偏好（最常看的分类、演员）
  const preferences = await analyzeUserPreferences(env, userId);
  
  if (!preferences.hasData) {
    return getTrendingRecommendations(env, { ...request, strategy: 'trending' });
  }
  
  // 2. 获取用户已看过的视频
  const watchedResult = await env.DB.prepare(`
    SELECT vod_id FROM history WHERE user_id = ?
  `).bind(userId).all();
  const watchedIds = (watchedResult.results as Pick<WatchHistoryRow, 'vod_id'>[]).map(r => r.vod_id);
  const allExcludeIds = [...new Set([...watchedIds, ...excludeIds])];
  
  // 3. 基于偏好查询推荐
  let query = `
    SELECT v.*, 
      CASE WHEN v.type_id IN (${preferences.preferredTypes.map(() => '?').join(',') || '0'}) THEN 0.3 ELSE 0 END +
      CASE WHEN v.vod_area IN (${preferences.preferredAreas.map(() => '?').join(',') || "''"}) THEN 0.2 ELSE 0 END +
      v.vod_score * 0.01 +
      v.vod_hits * 0.00001 as pref_score
    FROM vod_cache v
    WHERE v.is_valid = 1
  `;
  
  const params: DbQueryParam[] = [
    ...preferences.preferredTypes,
    ...preferences.preferredAreas,
  ];
  
  if (typeId) {
    query += ' AND v.type_id = ?';
    params.push(typeId);
  }
  
  if (allExcludeIds.length > 0) {
    query += ` AND v.vod_id NOT IN (${allExcludeIds.map(() => '?').join(',')})`;
    params.push(...allExcludeIds);
  }
  
  query += ' ORDER BY pref_score DESC LIMIT ?';
  params.push(limit);
  
  const result = await env.DB.prepare(query).bind(...params).all();
  
  return {
    list: castD1Results<VodCacheListRow>(result.results),
    strategy: 'personalized',
    cached: false,
    confidence: 0.75,
  };
}

/**
 * 相似内容推荐（用于详情页）
 */
async function getSimilarRecommendations(
  env: Env,
  request: RecommendRequest
): Promise<RecommendResult> {
  // 直接使用基于内容的推荐
  return getContentBasedRecommendations(env, { ...request, strategy: 'content_based' });
}

/**
 * 短剧相似推荐
 */
async function getShortsSimilarRecommendations(
  env: Env,
  request: RecommendRequest
): Promise<RecommendResult> {
  const { vodId, limit = 10, excludeIds = [] } = request;
  
  if (!vodId) {
    // 返回热门短剧
    return getShortsTrending(env, limit, excludeIds);
  }
  
  // 获取目标短剧信息
  const target = await env.DB.prepare(`
    SELECT * FROM vod_cache WHERE vod_id = ? AND type_id = 5
  `).bind(vodId).first();
  
  if (!target) {
    return getShortsTrending(env, limit, excludeIds);
  }
  
  // 查询相似短剧（基于分类和标签）
  let query = `
    SELECT vod_id, vod_name, vod_pic_thumb as vod_pic_vertical, 
           shorts_category as category, vod_remarks, vod_score, vod_hits
    FROM vod_cache
    WHERE type_id = 5 AND is_valid = 1 AND vod_id != ?
  `;
  
  const params: DbQueryParam[] = [vodId];
  
  // 优先同分类
  if (target.shorts_category) {
    query += ' AND shorts_category = ?';
    params.push(target.shorts_category as string);
  }
  
  if (excludeIds.length > 0) {
    query += ` AND vod_id NOT IN (${excludeIds.map(() => '?').join(',')})`;
    params.push(...excludeIds);
  }
  
  query += ' ORDER BY vod_score DESC, vod_hits DESC LIMIT ?';
  params.push(limit);
  
  const result = await env.DB.prepare(query).bind(...params).all();
  
  // 如果同分类不够，补充其他分类
  const resultList = castD1Results<ShortsListRow>(result.results);
  if (resultList.length < limit) {
    const remaining = limit - resultList.length;
    const existingIds = resultList.map(r => r.vod_id);
    const allExclude = [...excludeIds, vodId, ...existingIds];
    
    const moreResult = await env.DB.prepare(`
      SELECT vod_id, vod_name, vod_pic_thumb as vod_pic_vertical,
             shorts_category as category, vod_remarks, vod_score, vod_hits
      FROM vod_cache
      WHERE type_id = 5 AND is_valid = 1
        AND vod_id NOT IN (${allExclude.map(() => '?').join(',')})
      ORDER BY vod_score DESC, vod_hits DESC
      LIMIT ?
    `).bind(...allExclude, remaining).all();
    
    return {
      list: [...resultList, ...castD1Results<ShortsListRow>(moreResult.results)],
      strategy: 'shorts_similar',
      cached: false,
      confidence: 0.7,
    };
  }
  
  return {
    list: resultList,
    strategy: 'shorts_similar',
    cached: false,
    confidence: 0.8,
  };
}

/**
 * 获取热门短剧
 */
async function getShortsTrending(
  env: Env,
  limit: number,
  excludeIds: string[]
): Promise<RecommendResult> {
  let query = `
    SELECT vod_id, vod_name, vod_pic_thumb as vod_pic_vertical,
           shorts_category as category, vod_remarks, vod_score, vod_hits
    FROM vod_cache
    WHERE type_id = 5 AND is_valid = 1
  `;
  
  const params: DbQueryParam[] = [];
  
  if (excludeIds.length > 0) {
    query += ` AND vod_id NOT IN (${excludeIds.map(() => '?').join(',')})`;
    params.push(...excludeIds);
  }
  
  query += ' ORDER BY vod_hits DESC, vod_score DESC LIMIT ?';
  params.push(limit);
  
  const result = await env.DB.prepare(query).bind(...params).all();
  
  return {
    list: castD1Results<ShortsListRow>(result.results),
    strategy: 'shorts_similar',
    cached: false,
    confidence: 0.6,
  };
}

// ============================================
// 辅助函数
// ============================================

/**
 * 计算内容相似度
 */
function calculateContentSimilarity(video1: Partial<VodCacheRow>, video2: Partial<VodCacheRow>): number {
  let score = 0;
  
  // 1. 分类相同（30%）
  if (video1.type_id === video2.type_id) {
    score += 0.3;
  }
  
  // 2. 地区相同（15%）
  if (video1.vod_area && video1.vod_area === video2.vod_area) {
    score += 0.15;
  }
  
  // 3. 年份接近（10%）
  if (video1.vod_year && video2.vod_year) {
    const yearDiff = Math.abs(parseInt(video1.vod_year) - parseInt(video2.vod_year));
    if (yearDiff <= 3) {
      score += 0.1 * (1 - yearDiff / 3);
    }
  }
  
  // 4. 演员重叠（25%）
  const actors1 = parseList(video1.vod_actor);
  const actors2 = parseList(video2.vod_actor);
  const actorOverlap = actors1.filter(a => actors2.includes(a)).length;
  if (actorOverlap > 0 && actors1.length > 0) {
    score += 0.25 * Math.min(actorOverlap / Math.min(actors1.length, 3), 1);
  }
  
  // 5. 标签重叠（20%）
  const tags1 = parseList(video1.vod_tag);
  const tags2 = parseList(video2.vod_tag);
  const tagOverlap = tags1.filter(t => tags2.includes(t)).length;
  if (tagOverlap > 0 && tags1.length > 0) {
    score += 0.2 * Math.min(tagOverlap / Math.min(tags1.length, 5), 1);
  }
  
  return score;
}

/**
 * 解析逗号分隔的列表
 */
function parseList(str: string | null | undefined): string[] {
  if (!str) return [];
  return str.split(/[,，、\/\s]+/).filter(Boolean).map(s => s.trim());
}

/**
 * 分析用户偏好
 */
async function analyzeUserPreferences(
  env: Env,
  userId: number
): Promise<{
  hasData: boolean;
  preferredTypes: number[];
  preferredAreas: string[];
  preferredActors: string[];
}> {
  // 获取用户最近观看的视频
  const historyData = await env.DB.prepare(`
    SELECT v.type_id, v.vod_area, v.vod_actor
    FROM history h
    JOIN vod_cache v ON h.vod_id = v.vod_id
    WHERE h.user_id = ?
    ORDER BY h.updated_at DESC
    LIMIT 50
  `).bind(userId).all();
  
  if ((historyData.results as Pick<VodCacheRow, 'type_id' | 'vod_area' | 'vod_actor'>[]).length === 0) {
    return { hasData: false, preferredTypes: [], preferredAreas: [], preferredActors: [] };
  }
  
  // 统计偏好
  const typeCount = new Map<number, number>();
  const areaCount = new Map<string, number>();
  const actorCount = new Map<string, number>();
  
  for (const row of historyData.results as Pick<VodCacheRow, 'type_id' | 'vod_area' | 'vod_actor'>[]) {
    // 分类
    if (row.type_id) {
      typeCount.set(row.type_id, (typeCount.get(row.type_id) || 0) + 1);
    }
    // 地区
    if (row.vod_area) {
      areaCount.set(row.vod_area, (areaCount.get(row.vod_area) || 0) + 1);
    }
    // 演员
    const actors = parseList(row.vod_actor);
    for (const actor of actors.slice(0, 3)) {
      actorCount.set(actor, (actorCount.get(actor) || 0) + 1);
    }
  }
  
  // 排序取前几个
  const preferredTypes = [...typeCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(e => e[0]);
  
  const preferredAreas = [...areaCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(e => e[0]);
  
  const preferredActors = [...actorCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(e => e[0]);
  
  return {
    hasData: true,
    preferredTypes,
    preferredAreas,
    preferredActors,
  };
}

/**
 * 根据ID列表获取视频详情
 */
async function fetchVideosByIds(env: Env, ids: string[]): Promise<VodCacheRow[]> {
  if (ids.length === 0) return [];
  
  const placeholders = ids.map(() => '?').join(',');
  const result = await env.DB.prepare(`
    SELECT * FROM vod_cache
    WHERE vod_id IN (${placeholders}) AND is_valid = 1
  `).bind(...ids).all();
  
  // 按原始顺序排序
  const idOrder = new Map(ids.map((id, i) => [id, i]));
  return castD1Results<VodCacheRow>(result.results).sort((a, b) => 
    (idOrder.get(a.vod_id) || 0) - (idOrder.get(b.vod_id) || 0)
  );
}

/**
 * 批量预计算推荐（定时任务）
 */
export async function batchPrecomputeRecommendations(
  env: Env,
  limit: number = 100
): Promise<{ success: number; failed: number }> {
  logger.recommendV2.info('Starting batch precompute...');
  
  try {
    // 获取需要更新的视频（优先热门视频）
    const videos = await env.DB.prepare(`
      SELECT v.vod_id
      FROM vod_cache v
      LEFT JOIN vod_recommendations r ON v.vod_id = r.vod_id
      WHERE v.is_valid = 1
        AND (r.vod_id IS NULL OR r.updated_at < ?)
      ORDER BY v.vod_hits DESC
      LIMIT ?
    `).bind(
      getDaysAgo(7),
      limit
    ).all();
    
    let success = 0;
    let failed = 0;
    
    for (const video of videos.results as Pick<VodCacheRow, 'vod_id'>[]) {
      try {
        const result = await getContentBasedRecommendations(env, {
          strategy: 'content_based',
          vodId: video.vod_id,
          limit: 20,
        });
        
        if (result.list.length > 0) {
          const similarIds = result.list.map((v) => v.vod_id);
          
          await env.DB.prepare(`
            INSERT OR REPLACE INTO vod_recommendations 
            (vod_id, similar_ids, algorithm, confidence, updated_at)
            VALUES (?, ?, 'content', ?, ?)
          `).bind(
            video.vod_id,
            JSON.stringify(similarIds),
            result.confidence,
            getCurrentTimestamp()
          ).run();
          
          success++;
        } else {
          failed++;
        }
      } catch (e) {
        logger.recommendV2.error('Failed for video', { vodId: video.vod_id, error: e instanceof Error ? e.message : String(e) });
        failed++;
      }
    }
    
    logger.recommendV2.info(`Batch completed: ${success} success, ${failed} failed`);
    return { success, failed };
    
  } catch (error) {
    logger.recommendV2.error('Batch precompute failed', { error: error instanceof Error ? error.message : String(error) });
    return { success: 0, failed: 0 };
  }
}
