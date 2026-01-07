/**
 * Video API (VOD)
 * 视频列表、详情、搜索接口
 */

import { Hono } from 'hono';
import { aggregateVideos, shouldIncludeWelfare } from '../services/spider_aggregator';
import { ensureCleanedFormat, toPlaySources } from '../services/data_cleaner';
import { logger } from '../utils/logger';

type Bindings = {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
  TMDB_API_KEY?: string;
  DOUBAN_API_KEY?: string;
};

// 视频缓存数据类型
interface VodCacheData {
  vod_id: string;
  vod_name: string;
  vod_pic?: string;
  vod_play_url?: string;
  type_id?: number;
  type_name?: string;
  vod_year?: string;
  vod_area?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_content?: string;
  vod_remarks?: string;
  vod_score?: string;
  vod_hits?: number;
  vod_hits_day?: number;
  vod_hits_week?: number;
  vod_hits_month?: number;
}

// 播放集数类型
interface EpisodeItem {
  name: string;
  url: string;
}

// 播放源类型
interface PlaySource {
  name: string;
  episodes: EpisodeItem[];
}

const vod = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/vod
 * 获取视频列表/筛选
 * 
 * Query params:
 * - ac: 操作类型（list, detail, videolist）
 * - t: 分类 ID 或名称
 * - area: 地区
 * - year: 年份
 * - sort: 排序方式（time, hits, score）
 * - pg: 页码
 * - ids: 视频 ID（用于详情查询）
 * - wd: 搜索关键词
 */
vod.get('/api/vod', async (c) => {
  try {
    const params = {
      ac: c.req.query('ac') || 'list',
      t: c.req.query('t'),
      area: c.req.query('area'),
      year: c.req.query('year'),
      sort: c.req.query('sort'),
      pg: c.req.query('pg') || '1',
      ids: c.req.query('ids'),
      wd: c.req.query('wd'),
    };

    logger.vod.info('Request params', { params });

    // 🚀 优化：优先使用聚合器（已内置缓存逻辑）
    const includeWelfare = await shouldIncludeWelfare(c.env, params);

    const result = await aggregateVideos(c.env, '', params, {
      includeWelfare,
      timeout: 5000,
    });

    return c.json({
      code: 1,
      msg: 'success',
      page: result.page,
      pagecount: result.pagecount,
      total: result.total,
      list: result.list,
      sources: result.sources,
      failed: result.failed,
    });
  } catch (error) {
    logger.vod.error('Error', { error: String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to fetch videos',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/vod/detail
 * 获取视频详情
 * 🚀 优化：增加 KV 缓存层
 * 
 * Query params:
 * - ids: 视频 ID（必需）
 */
vod.get('/api/vod/detail', async (c) => {
  try {
    const ids = c.req.query('ids');

    if (!ids) {
      return c.json(
        {
          code: 0,
          msg: 'Missing required parameter: ids',
        },
        400
      );
    }

    // 🚀 优先从 KV 缓存读取
    const cacheKey = `vod:${ids}`;
    let video: VodCacheData | null = null;
    
    try {
      const kvCached = await c.env.ROBIN_CACHE.get(cacheKey, 'json');
      if (kvCached) {
        video = kvCached as VodCacheData;
        // 异步记录访问（不阻塞响应）
        c.executionCtx.waitUntil(
          (async () => {
            const { trackHit } = await import('../services/hits_tracker');
            await trackHit(c.env, ids);
          })()
        );
        
        // 🆕 解析播放源
        let playSources: PlaySource[] = [];
        try {
          const playUrls = typeof video.vod_play_url === 'string' 
            ? JSON.parse(video.vod_play_url || '{}')
            : video.vod_play_url || {};
          const cleanedUrls = ensureCleanedFormat(playUrls);
          playSources = toPlaySources(cleanedUrls);
        } catch {
          // 播放地址解析失败，使用空数组，不影响视频详情返回
          logger.vod.warn('Failed to parse play_sources from cache');
        }
        
        // 🚀 直接返回缓存，跳过推荐（推荐可以懒加载）
        return c.json({
          code: 1,
          msg: 'success',
          data: {
            ...video,
            play_sources: playSources,  // 新增：清洗后的播放源
          },
          recommendations: [], // 前端可以单独请求推荐
        });
      }
    } catch {
      // KV 读取失败，继续
    }

    // 从 D1 读取
    try {
      const cached = await c.env.DB.prepare(`
        SELECT * FROM vod_cache WHERE vod_id = ? AND is_valid = 1
      `).bind(ids).first();

      if (cached) {
        video = cached as VodCacheData;
        
        // 🚀 写入 KV 缓存（1 小时）
        c.executionCtx.waitUntil(
          c.env.ROBIN_CACHE.put(cacheKey, JSON.stringify(cached), { expirationTtl: 3600 })
        );
        
        // 异步记录访问
        c.executionCtx.waitUntil(
          (async () => {
            const { trackHit } = await import('../services/hits_tracker');
            await trackHit(c.env, ids);
          })()
        );
      }
    } catch (error) {
      logger.vod.error('Cache read failed', { error: String(error) });
    }

    // 降级：实时获取
    if (!video) {
      const includeWelfare = await shouldIncludeWelfare(c.env, { ids });
      const result = await aggregateVideos(c.env, '', { ac: 'detail', ids }, {
        includeWelfare,
        timeout: 5000,
      });

      if (result.list.length === 0) {
        return c.json(
          {
            code: 0,
            msg: 'Video not found',
          },
          404
        );
      }

      video = result.list[0] as VodCacheData;
    }

    // 🆕 解析播放源
    let playSources: PlaySource[] = [];
    try {
      const playUrls = typeof video.vod_play_url === 'string' 
        ? JSON.parse(video.vod_play_url || '{}')
        : video.vod_play_url || {};
      const cleanedUrls = ensureCleanedFormat(playUrls);
      playSources = toPlaySources(cleanedUrls);
    } catch {
      logger.vod.error('Failed to parse play_sources');
    }

    // 🆕 获取智能推荐（使用推荐引擎 V2）
    let recommendations: VodCacheData[] = [];
    try {
      const { getRecommendationsV2 } = await import('../services/recommendation_engine_v2');
      const recResult = await getRecommendationsV2(c.env, {
        strategy: 'similar',
        vodId: ids,
        limit: 10,
      });
      recommendations = recResult.list as VodCacheData[];
    } catch (error) {
      logger.vod.error('Recommendation failed', { error: String(error) });
    }

    // 降级：同类型视频
    if (recommendations.length === 0 && (video.type_id || video.type_name)) {
      const recResult = await aggregateVideos(c.env, '', {
        ac: 'list',
        t: video.type_id ? String(video.type_id) : video.type_name,
        pg: '1',
      }, {
        includeWelfare: false,
        timeout: 3000,
      });
      recommendations = recResult.list.slice(0, 10) as VodCacheData[];
    }

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        ...video,
        play_sources: playSources,  // 新增：清洗后的播放源
      },
      recommendations,
    });
  } catch (error) {
    logger.vod.error('Detail error', { error: String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to fetch video detail',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/search_cache
 * 搜索视频（仅搜索缓存，使用FTS5全文索引）
 * 
 * Query params:
 * - wd: 搜索关键词（必需）
 * - limit: 返回数量（默认20）
 */
vod.get('/api/search_cache', async (c) => {
  try {
    const wd = c.req.query('wd');
    const limit = parseInt(c.req.query('limit') || '20');

    if (!wd) {
      return c.json(
        {
          code: 0,
          msg: 'Missing required parameter: wd',
        },
        400
      );
    }

    logger.search.info('Keyword', { keyword: wd });

    // 使用FTS5全文搜索（V2引擎）
    try {
      const { searchVideos } = await import('../services/collector_v2');
      const results = await searchVideos(c.env, wd, limit);
      
      logger.search.info('Found results', { count: results.length });
      
      return c.json({
        code: 1,
        msg: 'success',
        keyword: wd,
        total: results.length,
        list: results,
      });
    } catch (error) {
      logger.search.error('Error', { error: error instanceof Error ? error.message : String(error) });
      return c.json({
        code: 0,
        msg: 'Cache search failed',
        list: [],
      });
    }
  } catch (error) {
    logger.search.error('Error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Search failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/search
 * 搜索视频
 * 
 * Query params:
 * - wd: 搜索关键词（必需）
 * - pg: 页码
 */
vod.get('/api/search', async (c) => {
  try {
    const wd = c.req.query('wd');
    const pg = c.req.query('pg') || '1';
    const userId = c.req.header('x-user-id');
    const deviceId = c.req.header('x-device-id');

    if (!wd) {
      return c.json(
        {
          code: 0,
          msg: 'Missing required parameter: wd',
        },
        400
      );
    }

    logger.search.info('Keyword', { keyword: wd });

    // 记录搜索历史和更新热搜统计
    try {
      // 更新热搜统计
      await c.env.DB.prepare(`
        INSERT INTO hot_search_stats (keyword, search_count, search_count_day, last_search_at)
        VALUES (?, 1, 1, strftime('%s', 'now'))
        ON CONFLICT(keyword) DO UPDATE SET
          search_count = search_count + 1,
          search_count_day = search_count_day + 1,
          last_search_at = strftime('%s', 'now')
      `).bind(wd).run();

      // 记录用户搜索历史（如果有用户或设备ID）
      if (userId || deviceId) {
        await c.env.DB.prepare(`
          INSERT INTO search_history (user_id, device_id, keyword, search_count, last_search_at)
          VALUES (?, ?, ?, 1, strftime('%s', 'now'))
          ON CONFLICT(user_id, device_id, keyword) DO UPDATE SET
            search_count = search_count + 1,
            last_search_at = strftime('%s', 'now')
        `).bind(userId || '', deviceId || '', wd).run();
      }
    } catch (e) {
      // 记录失败不影响搜索
      logger.search.error('Failed to record search history', { error: e instanceof Error ? e.message : String(e) });
    }

    // 🚀 优化：优先使用FTS5搜索缓存（V2引擎）
    try {
      const { searchVideos } = await import('../services/collector_v2');
      const cached = await searchVideos(c.env, wd, 20);
      
      if (cached.length > 0) {
        logger.search.info('Cache hit', { count: cached.length });
        return c.json({
          code: 1,
          msg: 'success',
          keyword: wd,
          page: 1,
          pagecount: 1,
          total: cached.length,
          list: cached,
          sources: ['cache'],
          failed: [],
        });
      }
    } catch (error) {
      logger.search.error('Cache search failed', { error: error instanceof Error ? error.message : String(error) });
    }

    // 降级：实时搜索资源站
    const result = await aggregateVideos(c.env, '', {
      ac: 'list',
      wd,
      pg,
    }, {
      includeWelfare: false,
      timeout: 5000,
    });

    return c.json({
      code: 1,
      msg: 'success',
      keyword: wd,
      page: result.page,
      pagecount: result.pagecount,
      total: result.total,
      list: result.list,
      sources: result.sources,
      failed: result.failed,
    });
  } catch (error) {
    logger.search.error('Error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Search failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/hot_search
 * 获取热搜关键词（从 hot_search_stats 表获取）
 * 优化：增加 KV 缓存，减少 D1 查询
 */
vod.get('/api/hot_search', async (c) => {
  try {
    // 优先从缓存读取（热搜变化不频繁，缓存 10 分钟）
    const cacheKey = 'hot_search_keywords';
    const cached = await c.env.ROBIN_CACHE.get(cacheKey, 'json') as { keywords: string[] } | null;
    
    if (cached) {
      return c.json({
        code: 1,
        msg: 'success',
        keywords: cached.keywords,
      });
    }

    // 单次查询获取开关和限制配置
    const configResult = await c.env.DB.prepare(`
      SELECT key, value FROM system_config 
      WHERE key IN ('hot_search_enabled', 'hot_search_limit')
    `).all();
    
    const configMap = new Map((configResult.results as { key: string; value: string }[]).map(r => [r.key, r.value]));
    
    // 如果开关关闭，返回空数组并缓存
    if (configMap.get('hot_search_enabled') !== 'true') {
      await c.env.ROBIN_CACHE.put(cacheKey, JSON.stringify({ keywords: [] }), { expirationTtl: 600 });
      return c.json({
        code: 1,
        msg: 'success',
        keywords: [],
      });
    }

    const limit = parseInt(configMap.get('hot_search_limit') as string) || 10;

    // 从 hot_search_stats 表获取热搜词
    let keywords: string[] = [];
    try {
      const result = await c.env.DB.prepare(`
        SELECT keyword FROM hot_search_stats 
        WHERE is_hidden = 0
        ORDER BY is_pinned DESC, search_count DESC
        LIMIT ?
      `).bind(limit).all();
      keywords = (result.results || []).map((r: { keyword: string }) => r.keyword);
    } catch {
      // 表不存在，回退到旧的 system_config 方式
      const result = await c.env.DB.prepare(
        'SELECT value FROM system_config WHERE key = ?'
      ).bind('hot_search_keywords').first();
      keywords = result?.value ? JSON.parse(result.value as string) : [];
    }

    // 缓存结果 10 分钟
    await c.env.ROBIN_CACHE.put(cacheKey, JSON.stringify({ keywords }), { expirationTtl: 600 });

    return c.json({
      code: 1,
      msg: 'success',
      keywords,
    });
  } catch (error) {
    logger.vod.error('HotSearch Error', { error: String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to fetch hot search keywords',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/actor/:id
 * 获取演员详情
 */
vod.get('/api/actor/:id', async (c) => {
  try {
    const actorId = parseInt(c.req.param('id'));

    const { getActorDetail } = await import('../services/actor_manager');
    const actor = await getActorDetail(c.env, actorId);

    if (!actor) {
      return c.json(
        {
          code: 0,
          msg: 'Actor not found',
        },
        404
      );
    }

    return c.json({
      code: 1,
      msg: 'success',
      data: actor,
    });
  } catch (error) {
    logger.actorManager.error('Get actor detail error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get actor detail',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/actors/popular
 * 获取热门演员
 */
vod.get('/api/actors/popular', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');

    const { getPopularActors } = await import('../services/actor_manager');
    const actors = await getPopularActors(c.env, limit);

    return c.json({
      code: 1,
      msg: 'success',
      list: actors,
    });
  } catch (error) {
    logger.actorManager.error('Get popular actors error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get popular actors',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/actors/search
 * 搜索演员
 */
vod.get('/api/actors/search', async (c) => {
  try {
    const keyword = c.req.query('keyword');
    const limit = parseInt(c.req.query('limit') || '20');

    if (!keyword) {
      return c.json(
        {
          code: 0,
          msg: 'Missing keyword',
        },
        400
      );
    }

    const { searchActors } = await import('../services/actor_manager');
    const actors = await searchActors(c.env, keyword, limit);

    return c.json({
      code: 1,
      msg: 'success',
      list: actors,
    });
  } catch (error) {
    logger.actorManager.error('Search error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to search actors',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/vod/parse_share
 * 解析CDN分享链接，提取真实视频地址
 */
vod.get('/api/vod/parse_share', async (c) => {
  try {
    const url = c.req.query('url');
    
    if (!url) {
      return c.json({ code: 0, msg: 'Missing URL parameter' }, 400);
    }

    logger.vod.info('Parsing share URL', { url });

    // 获取分享页面HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return c.json({ code: 0, msg: 'Failed to fetch share page' }, 500);
    }

    const html = await response.text();
    
    // 提取 var main = "..." 中的视频地址
    const mainMatch = html.match(/var\s+main\s*=\s*["']([^"']+)["']/);
    
    if (!mainMatch) {
      logger.vod.error('Could not find video URL in HTML');
      return c.json({ code: 0, msg: 'Could not parse video URL' }, 500);
    }

    let videoUrl = mainMatch[1];
    
    // 如果是相对路径，拼接完整URL
    if (videoUrl.startsWith('/')) {
      const urlObj = new URL(url);
      videoUrl = `${urlObj.protocol}//${urlObj.host}${videoUrl}`;
    }

    logger.vod.info('Parsed video URL', { videoUrl });

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        original_url: url,
        video_url: videoUrl,
      },
    });
  } catch (error) {
    logger.vod.error('Parse share error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: 'Failed to parse share URL',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/ranking
 * 获取排行榜数据
 * 🚀 优化：增加缓存，排行榜变化不频繁
 * 
 * Query params:
 * - period: 时间段 (day, week, month)
 * - t: 分类ID（可选）
 * - limit: 返回数量（默认10）
 */
vod.get('/api/ranking', async (c) => {
  try {
    const period = c.req.query('period') || 'day';
    const typeId = c.req.query('t');
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50); // 🚀 限制最大数量

    // 🚀 优先从缓存读取（排行榜缓存 10 分钟）
    const cacheKey = `rank:${period}:${typeId || 'all'}:${limit}`;
    try {
      const cached = await c.env.ROBIN_CACHE.get(cacheKey, 'json');
      if (cached) {
        return c.json({
          code: 1,
          msg: 'success',
          list: cached,
          period,
        });
      }
    } catch {
      // 缓存读取失败，继续从数据库查询
      logger.vod.warn('Ranking cache read failed');
    }

    // 根据时间段确定排序字段
    let orderBy = 'COALESCE(vod_hits_day, 0) DESC';
    if (period === 'week') {
      orderBy = 'COALESCE(vod_hits_week, vod_hits_day * 7, 0) DESC';
    } else if (period === 'month') {
      orderBy = 'COALESCE(vod_hits_month, vod_hits_day * 30, 0) DESC';
    }

    // 🚀 优化：只查询必要字段
    let sql = `
      SELECT vod_id, vod_name, vod_pic, vod_remarks, vod_score, 
             COALESCE(vod_hits_day, 0) as vod_hits_day, 
             COALESCE(vod_hits_week, 0) as vod_hits_week, 
             COALESCE(vod_hits_month, 0) as vod_hits_month,
             type_id, type_name
      FROM vod_cache
      WHERE is_valid = 1
    `;
    const params: (string | number)[] = [];

    if (typeId) {
      sql += ' AND type_id = ?';
      params.push(parseInt(typeId));
    }

    sql += ` ORDER BY ${orderBy} LIMIT ?`;
    params.push(limit);

    const result = await c.env.DB.prepare(sql).bind(...params).all();

    // 排行榜视频行类型
    interface RankingVideoRow {
      vod_id: string;
      vod_name: string;
      vod_pic?: string;
      vod_remarks?: string;
      vod_score?: string;
      vod_hits_day: number;
      vod_hits_week: number;
      vod_hits_month: number;
      type_id?: number;
      type_name?: string;
    }

    // 添加排名和热度信息
    const list = (result.results || []).map((video: RankingVideoRow, index: number) => {
      let heat = video.vod_hits_day || 0;
      if (period === 'week') {
        heat = video.vod_hits_week || video.vod_hits_day * 7 || 0;
      } else if (period === 'month') {
        heat = video.vod_hits_month || video.vod_hits_day * 30 || 0;
      }

      return {
        ...video,
        rank: index + 1,
        heat,
      };
    });

    // 🚀 写入缓存（10 分钟）
    try {
      await c.env.ROBIN_CACHE.put(cacheKey, JSON.stringify(list), { expirationTtl: 600 });
    } catch (e) {
      // 缓存写入失败不影响主流程，仅记录警告
      logger.vod.warn('Ranking cache write failed', { error: e instanceof Error ? e.message : 'Unknown' });
    }

    return c.json({
      code: 1,
      msg: 'success',
      list,
      period,
    });
  } catch (error) {
    logger.vod.error('Ranking error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: 'Failed to get ranking',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/categories/:id/subs
 * 获取指定分类的子分类列表
 */
vod.get('/api/categories/:id/subs', async (c) => {
  try {
    const parentId = parseInt(c.req.param('id'));

    const result = await c.env.DB.prepare(`
      SELECT id, parent_id, name, name_en, icon, sort_order
      FROM video_sub_categories
      WHERE parent_id = ? AND is_active = 1
      ORDER BY sort_order ASC, id ASC
    `).bind(parentId).all();

    return c.json({
      code: 1,
      msg: 'success',
      list: result.results || [],
    });
  } catch (error) {
    logger.vod.error('Get sub categories error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: 'Failed to get sub categories',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/articles
 * 获取文章列表
 * 
 * Query params:
 * - type_id: 文章分类ID（可选）
 * - page: 页码（默认1）
 * - limit: 每页数量（默认20）
 * - keyword: 搜索关键词（可选）
 */
vod.get('/api/articles', async (c) => {
  try {
    const typeId = c.req.query('type_id') ? parseInt(c.req.query('type_id')!) : undefined;
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const keyword = c.req.query('keyword');

    const { getArticles } = await import('../services/article_collector');
    const result = await getArticles(c.env, { typeId, page, limit, keyword });

    return c.json({
      code: 1,
      msg: 'success',
      list: result.list,
      total: result.total,
      page,
      limit,
    });
  } catch (error) {
    logger.vod.error('Get articles error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: 'Failed to get articles',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/articles/:id
 * 获取文章详情
 */
vod.get('/api/articles/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    const { getArticleDetail } = await import('../services/article_collector');
    const article = await getArticleDetail(c.env, id);

    if (!article) {
      return c.json({
        code: 0,
        msg: 'Article not found',
      }, 404);
    }

    return c.json({
      code: 1,
      msg: 'success',
      data: article,
    });
  } catch (error) {
    logger.vod.error('Get article detail error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: 'Failed to get article',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/article-categories
 * 获取文章分类列表
 */
vod.get('/api/article-categories', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT id, name, name_en, icon, sort_order
      FROM article_categories 
      WHERE is_active = 1 
      ORDER BY sort_order ASC
    `).all();

    return c.json({
      code: 1,
      msg: 'success',
      list: result.results || [],
    });
  } catch (error) {
    logger.vod.error('Get article categories error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: 'Failed to get article categories',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default vod;
