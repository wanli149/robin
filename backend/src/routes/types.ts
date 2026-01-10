/**
 * Types API
 * 分类管理接口
 */

import { Hono } from 'hono';
import { validateQuery, ValidationSchemas, sanitizeQueryParams } from '../middleware/input_validator';
import { logger } from '../utils/logger';
import { CACHE_CONFIG } from '../config';

type Bindings = {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
};

const types = new Hono<{ Bindings: Bindings }>();

/**
 * 标准分类映射
 * 统一不同资源站的分类
 */
const STANDARD_TYPES = [
  { id: 1, name: '电影', icon: '🎬', tab_id: 'movie' },
  { id: 2, name: '电视剧', icon: '📺', tab_id: 'series' },
  { id: 3, name: '综艺', icon: '🎭', tab_id: 'variety' },
  { id: 4, name: '动漫', icon: '🎨', tab_id: 'anime' },
  { id: 5, name: '短剧', icon: '⚡', tab_id: 'shorts' },
];

/**
 * 子分类（标签）- 硬编码后备
 */
const DEFAULT_SUB_TYPES: Record<number, string[]> = {
  1: [ // 电影
    '动作', '喜剧', '爱情', '科幻', '恐怖', 
    '悬疑', '战争', '犯罪', '冒险', '奇幻'
  ],
  2: [ // 电视剧
    '都市', '古装', '悬疑', '言情', '家庭',
    '军旅', '谍战', '历史', '武侠', '偶像'
  ],
  3: [ // 综艺
    '真人秀', '访谈', '选秀', '游戏', '音乐',
    '美食', '旅游', '情感', '脱口秀', '晚会'
  ],
  4: [ // 动漫
    '热血', '搞笑', '恋爱', '冒险', '奇幻',
    '科幻', '运动', '校园', '治愈', '悬疑'
  ],
  5: [ // 短剧
    '霸总', '战神', '古装', '现代', '甜宠',
    '复仇', '重生', '穿越', '都市', '玄幻'
  ],
};

/**
 * 从数据库加载子分类
 */
async function loadSubTypesFromDb(db: D1Database): Promise<Record<number, Array<{ id: number; name: string }>>> {
  const result: Record<number, Array<{ id: number; name: string }>> = {};
  
  try {
    const rows = await db.prepare(`
      SELECT id, parent_id, name
      FROM video_sub_categories
      WHERE is_active = 1
      ORDER BY parent_id, sort_order
    `).all();
    
    for (const row of rows.results as { id: number; parent_id: number; name: string }[]) {
      const parentId = row.parent_id;
      if (!result[parentId]) {
        result[parentId] = [];
      }
      result[parentId].push({ id: row.id, name: row.name });
    }
  } catch (e) {
    // 表可能不存在，忽略
    logger.vod.debug('video_sub_categories table may not exist', { error: e instanceof Error ? e.message : 'Unknown' });
  }
  
  return result;
}

/**
 * GET /api/types
 * 获取所有分类
 */
types.get('/api/types', async (c) => {
  try {
    // 检查缓存
    const cacheKey = 'types:all';
    const cached = await c.env.ROBIN_CACHE.get(cacheKey, 'json');
    
    if (cached) {
      return c.json(cached);
    }

    // 尝试从数据库加载子分类
    const dbSubTypes = await loadSubTypesFromDb(c.env.DB);
    
    // 构建分类数据
    const typesData = STANDARD_TYPES.map(type => {
      // 优先使用数据库子分类，否则使用硬编码后备
      const dbSubs = dbSubTypes[type.id];
      const subTypes = dbSubs && dbSubs.length > 0
        ? dbSubs
        : (DEFAULT_SUB_TYPES[type.id] || []).map((name, idx) => ({ id: idx + 1, name }));
      
      return {
        ...type,
        sub_types: subTypes,
      };
    });

    const response = {
      code: 1,
      msg: 'success',
      data: typesData,
    };

    // 缓存
    await c.env.ROBIN_CACHE.put(
      cacheKey,
      JSON.stringify(response),
      { expirationTtl: CACHE_CONFIG.vodDetailTTL }
    );

    return c.json(response);
  } catch (error) {
    logger.vod.error('Types error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get types',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/types/:id
 * 获取指定分类的详情
 */
types.get('/api/types/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    const type = STANDARD_TYPES.find(t => t.id === id);
    
    if (!type) {
      return c.json(
        {
          code: 0,
          msg: 'Type not found',
        },
        404
      );
    }

    // 尝试从数据库加载子分类
    const dbSubTypes = await loadSubTypesFromDb(c.env.DB);
    const dbSubs = dbSubTypes[id];
    const subTypes = dbSubs && dbSubs.length > 0
      ? dbSubs
      : (DEFAULT_SUB_TYPES[id] || []).map((name, idx) => ({ id: idx + 1, name }));

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        ...type,
        sub_types: subTypes,
      },
    });
  } catch (error) {
    logger.vod.error('Types detail error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get type',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/types/:id/videos
 * 获取指定分类的视频列表
 */
types.get('/api/types/:id/videos', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const { page, limit } = sanitizeQueryParams(c);
    const subType = c.req.query('sub_type'); // 子分类
    const area = c.req.query('area'); // 地区
    const year = c.req.query('year'); // 年份
    const sort = c.req.query('sort') || 'time'; // 排序

    // 这里应该调用聚合器获取数据
    // 暂时返回空列表
    return c.json({
      code: 1,
      msg: 'success',
      data: {
        list: [],
        page,
        limit,
        total: 0,
      },
    });
  } catch (error) {
    logger.vod.error('Types videos error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get videos',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// ============================================
// 筛选选项 API（客户端使用）
// ============================================

/**
 * 标准化地区名称（用于去重和排序）
 */
function normalizeAreaForFilter(area: string): string {
  const areaMap: Record<string, string> = {
    '大陆': '中国大陆',
    '内地': '中国大陆',
    '国产': '中国大陆',
    '中国': '中国大陆',
    '香港': '中国香港',
    '港': '中国香港',
    '台湾': '中国台湾',
    '台': '中国台湾',
    '港台': '中国香港,中国台湾',
  };
  return areaMap[area] || area;
}

/**
 * GET /api/filter-options
 * 获取筛选选项（地区、年份）- 客户端使用
 * 
 * Query params:
 * - type_id: 可选，按分类筛选
 */
types.get('/api/filter-options', async (c) => {
  try {
    const typeId = c.req.query('type_id');
    
    // 检查缓存
    const cacheKey = `filter-options:${typeId || 'all'}`;
    const cached = await c.env.ROBIN_CACHE.get(cacheKey, 'json');
    
    if (cached) {
      return c.json(cached);
    }
    
    // 并发获取地区和年份
    const [areasResult, yearsResult] = await Promise.all([
      // 地区
      typeId
        ? c.env.DB.prepare(`SELECT DISTINCT vod_area FROM vod_cache WHERE vod_area IS NOT NULL AND vod_area != '' AND type_id = ?`).bind(parseInt(typeId)).all()
        : c.env.DB.prepare(`SELECT DISTINCT vod_area FROM vod_cache WHERE vod_area IS NOT NULL AND vod_area != ''`).all(),
      // 年份
      typeId
        ? c.env.DB.prepare(`SELECT DISTINCT vod_year FROM vod_cache WHERE vod_year IS NOT NULL AND vod_year != '' AND vod_year != '0' AND type_id = ? ORDER BY vod_year DESC`).bind(parseInt(typeId)).all()
        : c.env.DB.prepare(`SELECT DISTINCT vod_year FROM vod_cache WHERE vod_year IS NOT NULL AND vod_year != '' AND vod_year != '0' ORDER BY vod_year DESC`).all(),
    ]);
    
    // 处理地区（去重、标准化）
    const areaSet = new Set<string>();
    const rawAreas = (areasResult.results || []) as { vod_area: string }[];
    for (const row of rawAreas) {
      const areas = row.vod_area.split(',').map(a => a.trim()).filter(a => a);
      for (const area of areas) {
        const normalized = normalizeAreaForFilter(area);
        const parts = normalized.split(',').map(a => a.trim()).filter(a => a);
        parts.forEach(p => areaSet.add(p));
      }
    }
    
    // 地区排序优先级
    const areaPriority: Record<string, number> = {
      '中国大陆': 1, '中国香港': 2, '中国台湾': 3, '日本': 4, '韩国': 5, 
      '美国': 6, '英国': 7, '法国': 8, '泰国': 9,
    };
    const areas = Array.from(areaSet).sort((a, b) => {
      const pa = areaPriority[a] || 100;
      const pb = areaPriority[b] || 100;
      if (pa !== pb) return pa - pb;
      return a.localeCompare(b, 'zh-CN');
    });
    
    // 处理年份
    const years = ((yearsResult.results || []) as { vod_year: string }[])
      .map(row => row.vod_year)
      .filter(year => /^\d{4}$/.test(year))
      .sort((a, b) => parseInt(b) - parseInt(a));
    
    const response = {
      code: 1,
      msg: 'success',
      data: {
        areas: areas.map(a => ({ value: a, label: a })),
        years: years.map(y => ({ value: y, label: y })),
      },
    };
    
    // 缓存 10 分钟
    await c.env.ROBIN_CACHE.put(
      cacheKey,
      JSON.stringify(response),
      { expirationTtl: 600 }
    );
    
    return c.json(response);
  } catch (error) {
    logger.vod.error('Filter options error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get filter options',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/filter-options/areas
 * 获取地区选项
 */
types.get('/api/filter-options/areas', async (c) => {
  try {
    const typeId = c.req.query('type_id');
    
    let query = `SELECT DISTINCT vod_area FROM vod_cache WHERE vod_area IS NOT NULL AND vod_area != ''`;
    const params: number[] = [];
    
    if (typeId) {
      query += ' AND type_id = ?';
      params.push(parseInt(typeId));
    }
    
    const result = await c.env.DB.prepare(query).bind(...params).all();
    
    // 处理地区数据
    const areaSet = new Set<string>();
    const rawAreas = (result.results || []) as { vod_area: string }[];
    
    for (const row of rawAreas) {
      const areas = row.vod_area.split(',').map(a => a.trim()).filter(a => a);
      for (const area of areas) {
        const normalized = normalizeAreaForFilter(area);
        const parts = normalized.split(',').map(a => a.trim()).filter(a => a);
        parts.forEach(p => areaSet.add(p));
      }
    }
    
    const areaPriority: Record<string, number> = {
      '中国大陆': 1, '中国香港': 2, '中国台湾': 3, '日本': 4, '韩国': 5,
      '美国': 6, '英国': 7, '法国': 8, '泰国': 9,
    };
    
    const sortedAreas = Array.from(areaSet).sort((a, b) => {
      const pa = areaPriority[a] || 100;
      const pb = areaPriority[b] || 100;
      if (pa !== pb) return pa - pb;
      return a.localeCompare(b, 'zh-CN');
    });
    
    return c.json({
      code: 1,
      msg: 'success',
      data: sortedAreas.map(area => ({ value: area, label: area })),
    });
  } catch (error) {
    logger.vod.error('Get areas error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: 'Failed to get areas' }, 500);
  }
});

/**
 * GET /api/filter-options/years
 * 获取年份选项
 */
types.get('/api/filter-options/years', async (c) => {
  try {
    const typeId = c.req.query('type_id');
    
    let query = `SELECT DISTINCT vod_year FROM vod_cache WHERE vod_year IS NOT NULL AND vod_year != '' AND vod_year != '0'`;
    const params: number[] = [];
    
    if (typeId) {
      query += ' AND type_id = ?';
      params.push(parseInt(typeId));
    }
    
    query += ' ORDER BY vod_year DESC';
    
    const result = await c.env.DB.prepare(query).bind(...params).all();
    const years = (result.results || []) as { vod_year: string }[];
    
    const validYears = years
      .map(row => row.vod_year)
      .filter(year => /^\d{4}$/.test(year))
      .sort((a, b) => parseInt(b) - parseInt(a));
    
    return c.json({
      code: 1,
      msg: 'success',
      data: validYears.map(year => ({ value: year, label: year })),
    });
  } catch (error) {
    logger.vod.error('Get years error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: 'Failed to get years' }, 500);
  }
});

export default types;
