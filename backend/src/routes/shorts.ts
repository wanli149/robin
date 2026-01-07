/**
 * Shorts API
 * 短剧接口 - 直接查询 vod_cache（type_id=5）
 * 
 * 新设计：
 * - 短剧数据存储在 vod_cache 表（type_id=5）
 * - 每部短剧有预选的精彩集（shorts_preview_episode, shorts_preview_url）
 * - 短剧流直接使用预选集，无需解析播放地址
 */

import { Hono } from 'hono';
import { logger } from '../utils/logger';

type Bindings = {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
};

// 短剧数据库行类型
interface ShortsDbRow {
  vod_id: string;
  vod_name: string;
  vod_pic_thumb?: string;
  episode_index?: number;
  play_url?: string;
  category?: string;
}

// 短剧列表项类型
interface ShortsListItem {
  vod_id: string;
  series_id: string;
  vod_name: string;
  episode_index: number;
  play_url: string;
  vod_pic_vertical?: string;
  category: string;
}

const shorts = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/shorts/random
 * 获取随机短剧（用于短剧流）
 * 🚀 优化：增强缓存策略
 * 
 * Query params:
 * - limit: 返回数量，默认 10
 * - category: 分类筛选（可选）
 */
shorts.get('/api/shorts/random', async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 20); // 🚀 限制最大数量
    const category = c.req.query('category');

    // 🚀 优化：使用更短的缓存 key，减少 KV 存储
    const cacheKey = `sr:${category || 'a'}:${limit}`;
    if (c.env.ROBIN_CACHE) {
      try {
        const cached = await c.env.ROBIN_CACHE.get(cacheKey, 'json');
        if (cached) {
          return c.json({
            code: 1,
            msg: 'success',
            total: (cached as ShortsListItem[]).length,
            list: cached,
          });
        }
      } catch {
        // 缓存读取失败，继续从数据库查询
        logger.shorts.warn('Random cache read failed');
      }
    }

    // 🚀 优化：只查询必要字段，减少数据传输
    let query = `
      SELECT 
        vod_id,
        vod_name,
        vod_pic_thumb,
        shorts_preview_episode as episode_index,
        shorts_preview_url as play_url,
        shorts_category as category
      FROM vod_cache
      WHERE type_id = 5 
        AND is_valid = 1 
        AND shorts_preview_url IS NOT NULL 
        AND shorts_preview_url != ''
    `;
    
    const params: (string | number)[] = [];
    
    if (category) {
      query += ' AND shorts_category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY RANDOM() LIMIT ?';
    params.push(limit);

    const result = await c.env.DB.prepare(query).bind(...params).all();
    
    // 🚀 优化：精简返回字段
    const list: ShortsListItem[] = (result.results || []).map((row: ShortsDbRow) => ({
      vod_id: `${row.vod_id}_ep${row.episode_index || 1}`,
      series_id: row.vod_id,
      vod_name: row.vod_name,
      episode_index: row.episode_index || 1,
      play_url: row.play_url || '',
      vod_pic_vertical: row.vod_pic_thumb,
      category: row.category || '其他',
    }));

    // 🚀 优化：延长缓存时间到 5 分钟
    if (c.env.ROBIN_CACHE && list.length > 0) {
      try {
        await c.env.ROBIN_CACHE.put(cacheKey, JSON.stringify(list), {
          expirationTtl: 300,
        });
      } catch {
        // 缓存写入失败不影响主流程
        logger.shorts.warn('Random cache write failed');
      }
    }

    return c.json({
      code: 1,
      msg: 'success',
      total: list.length,
      list,
    });
  } catch (error) {
    logger.shorts.error('Random error', { error: String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to fetch random shorts',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/shorts/series/:seriesId
 * 获取短剧系列的所有集数
 */
shorts.get('/api/shorts/series/:seriesId', async (c) => {
  try {
    const seriesId = c.req.param('seriesId');

    // 尝试从缓存获取
    const cacheKey = `shorts_series_${seriesId}`;
    if (c.env.ROBIN_CACHE) {
      try {
        const cached = await c.env.ROBIN_CACHE.get(cacheKey, 'json');
        if (cached) {
          return c.json({
            code: 1,
            msg: 'success',
            data: cached,
          });
        }
      } catch (e) {
        // 缓存读取失败，继续从数据库查询
        logger.shorts.warn('Series cache read failed', { error: e instanceof Error ? e.message : 'Unknown' });
      }
    }

    // 查询短剧详情
    const video = await c.env.DB.prepare(`
      SELECT 
        vod_id, vod_name, vod_pic, vod_pic_thumb, vod_play_url,
        vod_content, vod_year, vod_area, vod_actor, vod_director,
        vod_score, vod_remarks, shorts_category
      FROM vod_cache
      WHERE vod_id = ? AND type_id = 5
    `).bind(seriesId).first();

    if (!video) {
      return c.json({ code: 0, msg: 'Series not found' }, 404);
    }

    // 解析播放地址，生成选集列表
    const episodes = parseEpisodes(video.vod_play_url as string);

    const series = {
      series_id: video.vod_id,
      vod_name: video.vod_name,
      vod_pic_vertical: video.vod_pic_thumb || video.vod_pic,
      vod_content: video.vod_content || '',
      category: video.shorts_category || '其他',
      total_episodes: episodes.length,
      vod_year: video.vod_year || '',
      vod_area: video.vod_area || '',
      vod_actor: video.vod_actor || '',
      vod_director: video.vod_director || '',
      vod_score: video.vod_score || 0,
      vod_remarks: video.vod_remarks || '',
      episodes: episodes.map((ep, index) => ({
        vod_id: `${video.vod_id}_ep${index + 1}`,
        series_id: video.vod_id,
        vod_name: video.vod_name,
        episode_index: index + 1,
        episode_name: ep.name,
        play_url: ep.url,
        total_episodes: episodes.length,
        vod_pic_vertical: video.vod_pic_thumb || video.vod_pic,
        category: video.shorts_category || '其他',
      })),
    };

    // 写入缓存（10分钟）
    if (c.env.ROBIN_CACHE) {
      try {
        await c.env.ROBIN_CACHE.put(cacheKey, JSON.stringify(series), {
          expirationTtl: 600,
        });
      } catch (e) {
        // 缓存写入失败不影响主流程
        logger.shorts.warn('Series cache write failed', { error: e instanceof Error ? e.message : 'Unknown' });
      }
    }

    return c.json({
      code: 1,
      msg: 'success',
      data: series,
    });
  } catch (error) {
    logger.shorts.error('Series error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to fetch shorts series',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/shorts/detail/:vodId
 * 获取短剧详情（单集）
 */
shorts.get('/api/shorts/detail/:vodId', async (c) => {
  try {
    const vodId = c.req.param('vodId');
    
    // 解析 vodId（格式：seriesId_epN）
    const match = vodId.match(/^(.+)_ep(\d+)$/);
    if (!match) {
      return c.json({ code: 0, msg: 'Invalid vod_id format' }, 400);
    }
    
    const [, seriesId, epIndexStr] = match;
    const epIndex = parseInt(epIndexStr, 10);

    // 查询短剧
    const video = await c.env.DB.prepare(`
      SELECT vod_id, vod_name, vod_pic, vod_pic_thumb, vod_play_url, shorts_category
      FROM vod_cache
      WHERE vod_id = ? AND type_id = 5
    `).bind(seriesId).first();

    if (!video) {
      return c.json({ code: 0, msg: 'Shorts not found' }, 404);
    }

    // 解析播放地址
    const episodes = parseEpisodes(video.vod_play_url as string);
    const episode = episodes[epIndex - 1];

    if (!episode) {
      return c.json({ code: 0, msg: 'Episode not found' }, 404);
    }

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        vod_id: vodId,
        series_id: seriesId,
        vod_name: video.vod_name,
        episode_index: epIndex,
        episode_name: episode.name,
        play_url: episode.url,
        total_episodes: episodes.length,
        vod_pic_vertical: video.vod_pic_thumb || video.vod_pic,
        category: video.shorts_category || '其他',
      },
    });
  } catch (error) {
    logger.shorts.error('Detail error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to fetch shorts detail',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/shorts/categories
 * 获取短剧分类列表
 */
shorts.get('/api/shorts/categories', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT shorts_category as category, COUNT(*) as count
      FROM vod_cache
      WHERE type_id = 5 AND is_valid = 1 AND shorts_category IS NOT NULL
      GROUP BY shorts_category
      ORDER BY count DESC
    `).all();

    return c.json({
      code: 1,
      msg: 'success',
      categories: result.results,
    });
  } catch (error) {
    logger.shorts.error('Categories error', { error: String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to fetch categories',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/shorts/list
 * 获取短剧列表（支持分页和分类筛选）
 */
shorts.get('/api/shorts/list', async (c) => {
  try {
    const category = c.req.query('category');
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        vod_id as series_id,
        vod_name,
        vod_pic_thumb as vod_pic_vertical,
        shorts_category as category,
        vod_remarks
      FROM vod_cache
      WHERE type_id = 5 AND is_valid = 1
    `;
    
    const params: (string | number)[] = [];
    
    if (category) {
      query += ' AND shorts_category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await c.env.DB.prepare(query).bind(...params).all();

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as count FROM vod_cache WHERE type_id = 5 AND is_valid = 1';
    if (category) {
      countQuery += ' AND shorts_category = ?';
    }
    
    const countResult = category 
      ? await c.env.DB.prepare(countQuery).bind(category).first()
      : await c.env.DB.prepare(countQuery).first();
    
    const total = (countResult?.count as number) || 0;
    const pagecount = Math.ceil(total / limit);

    return c.json({
      code: 1,
      msg: 'success',
      page,
      pagecount,
      total,
      list: result.results,
    });
  } catch (error) {
    logger.shorts.error('List error', { error: String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to fetch shorts list',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// ============================================
// 辅助函数
// ============================================

// 播放集类型
interface EpisodeItem {
  name: string;
  url: string;
}

/**
 * 解析播放地址，生成选集列表
 */
function parseEpisodes(vodPlayUrl: string): EpisodeItem[] {
  if (!vodPlayUrl) return [];
  
  try {
    const parsed = JSON.parse(vodPlayUrl);
    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      // 取第一个播放源
      const firstSource = Object.values(parsed)[0];
      
      // 新格式：值是数组 [{ name, url }]
      if (Array.isArray(firstSource)) {
        return (firstSource as EpisodeItem[]).filter((ep) => ep.url && ep.url.startsWith('http'));
      }
    }
  } catch {
    // JSON 解析失败
  }
  
  return [];
}

export default shorts;
