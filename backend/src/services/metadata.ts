/**
 * Metadata Enhancement Service
 * 从 TMDB 和豆瓣获取高质量海报和元数据
 */

import { TMDB_CONFIG, DOUBAN_CONFIG, CACHE_CONFIG } from '../config';
import { logger } from '../utils/logger';

interface Env {
  TMDB_API_KEY?: string;
  DOUBAN_API_KEY?: string;
  ROBIN_CACHE: KVNamespace;
}

interface TMDBSearchResult {
  results?: Array<{
    id: number;
    title?: string;
    name?: string;
    poster_path?: string;
    backdrop_path?: string;
    overview?: string;
    vote_average?: number;
    release_date?: string;
    first_air_date?: string;
  }>;
}

interface DoubanSearchResult {
  subjects?: Array<{
    id: string;
    title: string;
    images?: {
      large?: string;
      medium?: string;
      small?: string;
    };
    rating?: {
      average: number;
    };
    year?: string;
  }>;
}

interface EnhancedMetadata {
  poster_url?: string;
  backdrop_url?: string;
  overview?: string;
  rating?: number;
  source: 'tmdb' | 'douban' | 'original';
}

/**
 * 从 TMDB 获取电影/剧集海报
 * 
 * @param movieName - 影片名称
 * @param env - Cloudflare Workers 环境变量
 * @returns 海报 URL 或 null
 */
export async function fetchTMDBImage(
  movieName: string,
  env: Env
): Promise<EnhancedMetadata | null> {
  try {
    const apiKey = env.TMDB_API_KEY;
    
    if (!apiKey || apiKey === 'your-tmdb-api-key-here') {
      logger.metadata.debug('TMDB API key not configured');
      return null;
    }

    // 检查 KV 缓存
    const cacheKey = `tmdb:${movieName}`;
    const cached = await env.ROBIN_CACHE.get(cacheKey, 'json');
    if (cached) {
      logger.metadata.debug(`TMDB cache hit: ${movieName}`);
      return cached as EnhancedMetadata;
    }

    // 搜索电影
    const searchUrl = new URL(`${TMDB_CONFIG.baseUrl}/search/multi`);
    searchUrl.searchParams.append('api_key', apiKey);
    searchUrl.searchParams.append('query', movieName);
    searchUrl.searchParams.append('language', 'zh-CN');

    const response = await fetch(searchUrl.toString(), {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logger.metadata.error('TMDB API error', { status: response.status });
      return null;
    }

    const data = await response.json() as TMDBSearchResult;

    if (!data.results || data.results.length === 0) {
      logger.metadata.debug(`No TMDB results for: ${movieName}`);
      return null;
    }

    // 取第一个结果
    const result = data.results[0];
    const metadata: EnhancedMetadata = {
      poster_url: result.poster_path 
        ? `${TMDB_CONFIG.imageBaseUrl}${result.poster_path}`
        : undefined,
      backdrop_url: result.backdrop_path
        ? `${TMDB_CONFIG.imageBaseUrl}${result.backdrop_path}`
        : undefined,
      overview: result.overview,
      rating: result.vote_average,
      source: 'tmdb',
    };

    // 缓存到 KV（24 小时）
    await env.ROBIN_CACHE.put(
      cacheKey,
      JSON.stringify(metadata),
      { expirationTtl: CACHE_CONFIG.metadataTTL }
    );

    logger.metadata.debug(`TMDB metadata fetched: ${movieName}`);
    return metadata;
  } catch (error) {
    logger.metadata.error('TMDB fetch error', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * 从豆瓣获取电影海报（备用）
 * 
 * @param movieName - 影片名称
 * @param env - Cloudflare Workers 环境变量
 * @returns 海报 URL 或 null
 */
export async function fetchDoubanImage(
  movieName: string,
  env: Env
): Promise<EnhancedMetadata | null> {
  try {
    const apiKey = env.DOUBAN_API_KEY;
    
    if (!apiKey || apiKey === 'your-douban-api-key-here') {
      logger.metadata.debug('Douban API key not configured');
      return null;
    }

    // 检查 KV 缓存
    const cacheKey = `douban:${movieName}`;
    const cached = await env.ROBIN_CACHE.get(cacheKey, 'json');
    if (cached) {
      logger.metadata.debug(`Douban cache hit: ${movieName}`);
      return cached as EnhancedMetadata;
    }

    // 搜索电影
    const searchUrl = new URL(`${DOUBAN_CONFIG.baseUrl}/movie/search`);
    searchUrl.searchParams.append('q', movieName);
    searchUrl.searchParams.append('apikey', apiKey);

    const response = await fetch(searchUrl.toString(), {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logger.metadata.error('Douban API error', { status: response.status });
      return null;
    }

    const data = await response.json() as DoubanSearchResult;

    if (!data.subjects || data.subjects.length === 0) {
      logger.metadata.debug(`No Douban results for: ${movieName}`);
      return null;
    }

    // 取第一个结果
    const result = data.subjects[0];
    const metadata: EnhancedMetadata = {
      poster_url: result.images?.large || result.images?.medium,
      rating: result.rating?.average,
      source: 'douban',
    };

    // 缓存到 KV（24 小时）
    await env.ROBIN_CACHE.put(
      cacheKey,
      JSON.stringify(metadata),
      { expirationTtl: CACHE_CONFIG.metadataTTL }
    );

    logger.metadata.debug(`Douban metadata fetched: ${movieName}`);
    return metadata;
  } catch (error) {
    logger.metadata.error('Douban fetch error', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * 增强视频元数据
 * 使用降级策略：TMDB -> 豆瓣 -> 原始图片
 * 
 * @param movieName - 影片名称
 * @param originalPoster - 原始海报 URL
 * @param env - Cloudflare Workers 环境变量
 * @returns 增强后的元数据
 */
export async function enhanceMetadata(
  movieName: string,
  originalPoster: string,
  env: Env
): Promise<EnhancedMetadata> {
  // 1. 尝试从 TMDB 获取
  const tmdbData = await fetchTMDBImage(movieName, env);
  if (tmdbData && tmdbData.poster_url) {
    return tmdbData;
  }

  // 2. TMDB 失败，尝试豆瓣
  const doubanData = await fetchDoubanImage(movieName, env);
  if (doubanData && doubanData.poster_url) {
    return doubanData;
  }

  // 3. 都失败，使用原始图片
  logger.metadata.debug(`Using original poster for: ${movieName}`);
  return {
    poster_url: originalPoster,
    source: 'original',
  };
}

/**
 * 批量增强视频列表的元数据
 * 
 * @param videos - 视频列表
 * @param env - Cloudflare Workers 环境变量
 * @returns 增强后的视频列表
 */
export async function enhanceVideoList<T extends { vod_name: string; vod_pic?: string }>(
  videos: T[],
  env: Env
): Promise<Array<T & {
  vod_pic_enhanced?: string;
  vod_backdrop?: string;
  vod_overview?: string;
  vod_rating?: number;
  metadata_source?: string;
}>> {
  const enhanced = await Promise.all(
    videos.map(async (video) => {
      const metadata = await enhanceMetadata(
        video.vod_name,
        video.vod_pic || '',
        env
      );

      return {
        ...video,
        vod_pic_enhanced: metadata.poster_url,
        vod_backdrop: metadata.backdrop_url,
        vod_overview: metadata.overview,
        vod_rating: metadata.rating,
        metadata_source: metadata.source,
      };
    })
  );

  return enhanced;
}

/**
 * 清除元数据缓存
 * 
 * 缓存策略说明：
 * - 单个影片：支持立即删除指定影片的 TMDB 和豆瓣缓存
 * - 批量清理：Cloudflare KV 不支持批量删除操作，依赖 TTL 自动过期机制
 * 
 * TTL 自动过期机制（Cloudflare KV 原生支持）：
 * - 当前 TTL 配置：CACHE_CONFIG.metadataTTL = 86400 秒（24 小时）
 * - 过期后 Cloudflare 自动标记为无效，读取返回 null
 * - 存储空间由 Cloudflare 自动回收，无需人工干预
 * - 下次请求会重新从 TMDB/豆瓣 获取最新数据
 * 
 * @param env - Cloudflare Workers 环境变量
 * @param movieName - 影片名称（可选，不传则依赖 TTL 自动过期）
 */
export async function clearMetadataCache(
  env: Env,
  movieName?: string
): Promise<void> {
  try {
    if (movieName) {
      // 单个影片：立即删除指定缓存
      await env.ROBIN_CACHE.delete(`tmdb:${movieName}`);
      await env.ROBIN_CACHE.delete(`douban:${movieName}`);
      logger.metadata.debug(`Cache cleared for: ${movieName}`);
    } else {
      // 批量清理：Cloudflare KV 不支持批量删除
      // 所有缓存会在 TTL（24小时）后自动过期并被 Cloudflare 回收
      // 参考：https://developers.cloudflare.com/kv/api/write-key-value-pairs/#expiring-keys
      logger.metadata.info(
        `Bulk cache clear not supported by KV. ` +
        `All metadata caches will auto-expire after TTL (${CACHE_CONFIG.metadataTTL}s = 24h). ` +
        `No manual intervention required.`
      );
    }
  } catch (error) {
    logger.metadata.error('Error clearing cache', { error: error instanceof Error ? error.message : String(error) });
  }
}
