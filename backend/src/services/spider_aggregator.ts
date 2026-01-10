/**
 * Spider Aggregator Service
 * 聚合多个资源站的视频数据
 */

import { TIMEOUT_CONFIG, type ResourceSite } from '../config';
import { parseXmlResponse, parseJsonResponse, detectFormat } from './response_parser';
import { logger } from '../utils/logger';
import type { VodCacheRow, VideoSourceRow, DbQueryParam } from '../types/database';

interface AggregatorOptions {
  includeWelfare?: boolean; // 是否包含福利源
  timeout?: number; // 请求超时时间（毫秒）
  maxRetries?: number; // 最大重试次数
  cacheOnly?: boolean; // 是否只从缓存读取，不降级到实时获取
}

interface VideoItem {
  vod_id: string | number;
  vod_name: string;
  vod_pic?: string;
  vod_remarks?: string;
  vod_year?: string;
  vod_area?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_content?: string;
  vod_play_url?: string;
  type_id?: number;
  type_name?: string;
  [key: string]: string | number | undefined;
}

interface AggregatorResult {
  list: VideoItem[];
  total: number;
  page: number;
  pagecount: number;
  sources: string[]; // 成功的资源站列表
  failed: string[]; // 失败的资源站列表
}

/**
 * 构建资源站 API URL
 */
function buildApiUrl(baseUrl: string, endpoint: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(baseUrl);
  
  // 添加查询参数
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, String(value));
    }
  });

  return url.toString();
}

/**
 * 请求单个资源站（带重试和超时优化）
 * 🚀 优化：减少重试次数和等待时间，快速失败
 * 🔧 支持XML和JSON两种格式
 */
async function fetchFromSite(
  site: ResourceSite & { responseFormat?: string },
  endpoint: string,
  params: Record<string, any>,
  timeout: number = 3000,
  maxRetries: number = 1  // 🚀 减少重试次数，快速失败
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const apiUrl = buildApiUrl(site.url, endpoint, params);
  let lastError: string = '';
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 🚀 使用 AbortSignal.timeout 更简洁
      const response = await fetch(apiUrl, {
        signal: AbortSignal.timeout(timeout),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
        },
      });

      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        
        // 4xx 错误不重试
        if (response.status >= 400 && response.status < 500) {
          return { success: false, error: lastError };
        }
        
        // 5xx 错误重试一次
        continue;
      }

      // 🔧 根据格式解析响应
      const text = await response.text();
      const format = site.responseFormat || detectFormat(text);
      
      let parsed;
      if (format === 'xml') {
        parsed = parseXmlResponse(text);
      } else {
        parsed = parseJsonResponse(text);
      }
      
      // 转换为聚合器期望的格式
      return {
        success: true,
        data: {
          list: parsed.list,
          total: parsed.total,
          page: parsed.page,
          pagecount: parsed.pagecount,
        },
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      
      // 超时或网络错误，快速失败
      if (lastError.includes('Timeout') || lastError.includes('Abort')) {
        return { success: false, error: `Timeout after ${timeout}ms` };
      }
      
      // 最后一次尝试失败才返回错误
      if (attempt === maxRetries) {
        return { success: false, error: lastError };
      }
      
      // 🚀 减少等待时间
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  return { success: false, error: lastError };
}

/**
 * 去重视频列表（智能去重：基于多字段）
 */
function deduplicateVideos(videos: VideoItem[]): VideoItem[] {
  const seen = new Map<string, VideoItem>();

  for (const video of videos) {
    // 生成唯一键：名称 + 年份 + 地区
    const uniqueKey = `${video.vod_name}-${video.vod_year || ''}-${video.vod_area || ''}`.toLowerCase();
    
    if (!seen.has(uniqueKey)) {
      seen.set(uniqueKey, video);
    } else {
      // 如果已存在，选择数据更完整的
      const existing = seen.get(uniqueKey)!;
      const existingScore = calculateVideoScore(existing);
      const newScore = calculateVideoScore(video);
      
      if (newScore > existingScore) {
        seen.set(uniqueKey, video);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * 计算视频数据完整度评分
 */
function calculateVideoScore(video: VideoItem): number {
  let score = 0;
  
  if (video.vod_pic && video.vod_pic.length > 10) score += 20;
  if (video.vod_actor && video.vod_actor.length > 0) score += 15;
  if (video.vod_director && video.vod_director.length > 0) score += 10;
  if (video.vod_content && video.vod_content.length > 20) score += 25;
  if (video.vod_play_url && video.vod_play_url.length > 10) score += 30;
  
  return score;
}

// 环境类型定义
interface Env {
  DB: D1Database;
}

// 资源站数据库行类型
interface VideoSourceDbRow {
  name: string;
  api_url: string;
  weight: number;
  is_active: number;
  response_format: string | null;
  is_welfare: number | null;
}

/**
 * 从数据库加载资源站配置
 * @param includeWelfare - 是否包含福利资源站
 */
async function loadSourcesFromDB(env: Env, includeWelfare: boolean = false): Promise<(ResourceSite & { responseFormat?: string })[]> {
  try {
    // 根据 includeWelfare 参数决定查询条件
    const query = includeWelfare
      ? `SELECT name, api_url, weight, is_active, response_format, is_welfare
         FROM video_sources
         WHERE is_active = 1
         ORDER BY weight DESC, sort_order ASC`
      : `SELECT name, api_url, weight, is_active, response_format, is_welfare
         FROM video_sources
         WHERE is_active = 1 AND (is_welfare = 0 OR is_welfare IS NULL)
         ORDER BY weight DESC, sort_order ASC`;
    
    const result = await env.DB.prepare(query).all();

    return (result.results as VideoSourceDbRow[]).map((row) => ({
      name: row.name,
      url: row.api_url,
      weight: row.weight,
      enabled: row.is_active === 1,
      timeout: TIMEOUT_CONFIG.defaultRequest,
      responseFormat: row.response_format || 'json',
      isWelfare: row.is_welfare === 1,
    }));
  } catch (error) {
    logger.aggregator.error('Failed to load sources from DB', { error: String(error) });
    // 不再降级到硬编码配置，返回空数组
    return [];
  }
}

/**
 * 检查是否有福利资源站配置
 */
export async function hasWelfareSources(env: Env): Promise<boolean> {
  try {
    const result = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM video_sources 
      WHERE is_active = 1 AND is_welfare = 1
    `).first();
    return (result?.count as number) > 0;
  } catch (error) {
    logger.aggregator.error('Failed to check welfare sources', { error: String(error) });
    return false;
  }
}

/**
 * 聚合多个资源站的视频数据
 * 
 * 优化策略：
 * 1. 优先从vod_cache读取（毫秒级响应）
 * 2. 缓存未命中时才实时聚合
 * 3. 聚合结果异步写入缓存
 * 
 * @param env - Cloudflare Workers 环境变量（包含 DB）
 * @param endpoint - API 端点（通常为空字符串，参数通过 params 传递）
 * @param params - 查询参数（ac, t, ids, wd, pg 等）
 * @param options - 聚合选项
 * @returns 聚合结果
 */
export async function aggregateVideos(
  env: Env,
  endpoint: string = '',
  params: Record<string, string | number | undefined> = {},
  options: AggregatorOptions = {}
): Promise<AggregatorResult> {
  const {
    includeWelfare = false,
    timeout = TIMEOUT_CONFIG.aggregatorDefault,
    cacheOnly = false,
  } = options;

  // 🚀 优化1：优先从缓存读取
  if (params.ac !== 'detail' && !params.wd) {
    try {
      const cached = await getFromCache(env, params);
      if (cached && cached.length > 0) {
        logger.aggregator.info(`Cache hit: ${cached.length} videos`);
        return {
          list: cached,
          total: cached.length,
          page: Number(params.pg) || 1,
          pagecount: Math.ceil(cached.length / 20),
          sources: ['cache'],
          failed: [],
        };
      }
    } catch (error) {
      logger.aggregator.error('Cache read failed', { error: error instanceof Error ? error.message : String(error) });
      // 降级到实时聚合（除非是 cacheOnly 模式）
    }
  }

  // 🚀 cacheOnly 模式：缓存没有数据就返回空结果，不实时获取
  if (cacheOnly) {
    logger.aggregator.info('Cache miss in cacheOnly mode, returning empty');
    return {
      list: [],
      total: 0,
      page: Number(params.pg) || 1,
      pagecount: 0,
      sources: ['cache'],
      failed: [],
    };
  }

  // 从数据库加载资源站配置（根据 includeWelfare 参数决定是否包含福利站）
  const sites = await loadSourcesFromDB(env, includeWelfare);
  
  // 如果没有配置资源站，返回空结果
  if (sites.length === 0) {
    logger.aggregator.warn('No sources configured in database');
    return {
      list: [],
      total: 0,
      page: 1,
      pagecount: 0,
      sources: [],
      failed: [],
    };
  }

  // 按权重排序
  sites.sort((a, b) => b.weight - a.weight);

  logger.aggregator.info(`Fetching from ${sites.length} sites`);

  // 🔧 过滤掉资源站不支持的参数（如 class）
  const apiParams = { ...params };
  const classFilter = apiParams.class; // 保存分类参数用于后续过滤
  delete apiParams.class; // 资源站API不支持class参数，需要删除

  // 🔧 确保有 ac 参数，资源站API需要这个参数
  if (!apiParams.ac) {
    apiParams.ac = 'list'; // 默认获取列表
  }

  // 并发请求所有资源站
  const results = await Promise.allSettled(
    sites.map(site => fetchFromSite(site, endpoint, apiParams, timeout))
  );

  const successSites: string[] = [];
  const failedSites: string[] = [];
  const allVideos: VideoItem[] = [];

  // 处理结果
  results.forEach((result, index) => {
    const site = sites[index];
    
    if (result.status === 'fulfilled' && result.value.success) {
      successSites.push(site.name);
      
      // 提取视频列表
      const data = result.value.data;
      if (data && data.list && Array.isArray(data.list)) {
        allVideos.push(...data.list);
      }
    } else {
      failedSites.push(site.name);
      const error = result.status === 'rejected' 
        ? result.reason 
        : result.value.error;
      logger.aggregator.error('Source failed', { name: site.name, error });
    }
  });

  // 去重
  let uniqueVideos = deduplicateVideos(allVideos);

  // 🔧 如果有分类过滤，在本地进行过滤
  if (classFilter) {
    const beforeCount = uniqueVideos.length;
    
    // 尝试过滤
    const filtered = uniqueVideos.filter((video: VideoItem) => {
      const tag = (video.vod_tag || '').toLowerCase();
      const content = (video.vod_content || '').toLowerCase();
      const className = (video.vod_class || '').toLowerCase();
      const typeName = (video.type_name || '').toLowerCase();
      const vodName = (video.vod_name || '').toLowerCase();
      const filterLower = classFilter.toLowerCase();
      
      // 更宽松的匹配：检查多个字段
      return tag.includes(filterLower) || 
             content.includes(filterLower) || 
             className.includes(filterLower) ||
             typeName.includes(filterLower) ||
             vodName.includes(filterLower);
    });
    
    // 如果过滤后结果太少（少于3个），则不应用过滤，返回原始数据
    if (filtered.length >= 3) {
      uniqueVideos = filtered;
      logger.aggregator.info(`Filtered by class '${classFilter}': ${beforeCount} -> ${uniqueVideos.length} videos`);
    } else {
      logger.aggregator.info(`Class filter '${classFilter}' resulted in too few videos (${filtered.length}), showing all ${beforeCount} videos instead`);
    }
  }

  logger.aggregator.info(`Success: ${successSites.length}, Failed: ${failedSites.length}, Videos: ${uniqueVideos.length}`);

  return {
    list: uniqueVideos,
    total: uniqueVideos.length,
    page: Number(params.pg) || 1,
    pagecount: Math.ceil(uniqueVideos.length / 20),
    sources: successSites,
    failed: failedSites,
  };
}

/**
 * 检查是否需要福利源
 * 根据请求参数和数据库配置判断
 */
export async function shouldIncludeWelfare(
  env: Env,
  params: Record<string, string | number | undefined>
): Promise<boolean> {
  // 检查是否明确请求福利内容
  if (params.type === 'welfare') {
    // 1. 检查系统配置是否启用福利功能
    const config = await env.DB.prepare(
      'SELECT value FROM system_config WHERE key = ?'
    ).bind('welfare_enabled').first();

    if (config?.value !== 'true') {
      return false;
    }
    
    // 2. 检查是否有配置福利资源站
    const hasWelfare = await hasWelfareSources(env);
    return hasWelfare;
  }

  return false;
}

/**
 * 从缓存读取视频列表
 */
async function getFromCache(
  env: Env,
  params: Record<string, string | number | undefined>
): Promise<VideoItem[]> {
  let query = 'SELECT * FROM vod_cache WHERE is_valid = 1';
  const bindings: DbQueryParam[] = [];

  // 分类筛选
  if (params.t) {
    query += ' AND type_id = ?';
    bindings.push(parseInt(params.t));
  }

  // 视频分类筛选（检查 sub_type_name, vod_tag, vod_content）
  if (params.class) {
    query += ' AND (sub_type_name LIKE ? OR vod_tag LIKE ? OR vod_content LIKE ?)';
    const classPattern = `%${params.class}%`;
    bindings.push(classPattern, classPattern, classPattern);
  }

  // 地区筛选（使用模糊匹配，因为数据可能是"大陆"或"中国大陆"）
  if (params.area) {
    query += ' AND vod_area LIKE ?';
    bindings.push(`%${params.area}%`);
  }

  // 年份筛选
  if (params.year) {
    query += ' AND vod_year = ?';
    bindings.push(params.year);
  }

  // 排序
  if (params.sort === 'hits') {
    query += ' ORDER BY vod_hits DESC';
  } else if (params.sort === 'score') {
    query += ' ORDER BY vod_score DESC';
  } else {
    query += ' ORDER BY updated_at DESC';
  }

  // 分页
  const page = parseInt(params.pg || '1');
  const limit = 20;
  const offset = (page - 1) * limit;
  query += ' LIMIT ? OFFSET ?';
  bindings.push(limit, offset);

  const result = await env.DB.prepare(query).bind(...bindings).all();
  return result.results as VideoItem[];
}
