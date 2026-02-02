/**
 * Admin Categories API
 * 分类管理相关接口
 */

import { Hono } from 'hono';
import type { Bindings } from './types';
import { logger } from '../../utils/logger';

const categories = new Hono<{ Bindings: Bindings }>();

/**
 * GET /admin/categories
 */
categories.get('/admin/categories', async (c) => {
  try {
    let result;
    try {
      result = await c.env.DB.prepare(`
        SELECT c.*, (SELECT COUNT(*) FROM vod_cache WHERE type_id = c.id) as video_count
        FROM video_categories c ORDER BY c.sort_order ASC
      `).all();
    } catch {
      result = { results: [] };
    }

    if (!result.results || result.results.length === 0) {
      const defaultCategories = [
        { id: 1, name: '电影', name_en: 'movie', sort_order: 1, is_active: true, collect_enabled: true },
        { id: 2, name: '电视剧', name_en: 'series', sort_order: 2, is_active: true, collect_enabled: true },
        { id: 3, name: '综艺', name_en: 'variety', sort_order: 3, is_active: true, collect_enabled: true },
        { id: 4, name: '动漫', name_en: 'anime', sort_order: 4, is_active: true, collect_enabled: true },
        { id: 5, name: '短剧', name_en: 'shorts', sort_order: 5, is_active: true, collect_enabled: true },
      ];

      // 定义带 video_count 的分类类型
      interface CategoryWithCount {
        id: number;
        name: string;
        name_en: string;
        sort_order: number;
        is_active: boolean;
        collect_enabled: boolean;
        video_count: number;
      }
      
      const categoriesWithCount: CategoryWithCount[] = [];
      for (const cat of defaultCategories) {
        let videoCount = 0;
        try {
          const countResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM vod_cache WHERE type_id = ?').bind(cat.id).first();
          videoCount = (countResult?.count as number) || 0;
        } catch (e) {
          logger.admin.warn('Failed to get video count for category', { categoryId: cat.id, error: e instanceof Error ? e.message : 'Unknown' });
        }
        categoriesWithCount.push({ ...cat, video_count: videoCount });
      }
      return c.json({ code: 1, msg: 'success', data: categoriesWithCount });
    }

    return c.json({ code: 1, msg: 'success', data: result.results });
  } catch (error) {
    logger.admin.error('Get categories error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get categories' }, 500);
  }
});

/**
 * GET /admin/categories/stats
 */
categories.get('/admin/categories/stats', async (c) => {
  try {
    const now = getCurrentTimestamp();
    const oneDayAgo = getDaysAgo(1);
    const oneWeekAgo = getDaysAgo(7);

    let cats: { id: number; name: string }[] = [];
    try {
      const catResult = await c.env.DB.prepare(`SELECT id, name FROM video_categories WHERE is_active = 1 ORDER BY sort_order`).all();
      cats = (catResult.results || []) as { id: number; name: string }[];
    } catch (e) {
      logger.admin.warn('Failed to load categories from DB', { error: e instanceof Error ? e.message : 'Unknown' });
    }
    
    if (cats.length === 0) {
      cats = [{ id: 1, name: '电影' }, { id: 2, name: '电视剧' }, { id: 3, name: '综艺' }, { id: 4, name: '动漫' }, { id: 5, name: '短剧' }];
    }

    const stats = [];
    for (const cat of cats) {
      const totalResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM vod_cache WHERE type_id = ?').bind(cat.id).first();
      const todayResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM vod_cache WHERE type_id = ? AND created_at > ?').bind(cat.id, oneDayAgo).first();
      const weekResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM vod_cache WHERE type_id = ? AND created_at > ?').bind(cat.id, oneWeekAgo).first();

      stats.push({
        id: cat.id, name: cat.name,
        video_count: (totalResult?.count as number) || 0,
        today_new: (todayResult?.count as number) || 0,
        week_new: (weekResult?.count as number) || 0,
      });
    }

    return c.json({ code: 1, msg: 'success', data: stats });
  } catch (error) {
    logger.admin.error('Get category stats error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get stats' }, 500);
  }
});

/**
 * POST /admin/categories
 */
categories.post('/admin/categories', async (c) => {
  try {
    const body = await c.req.json();
    const { id, name, name_en, icon, sort_order, is_active, collect_enabled } = body;

    if (!name || !name_en) return c.json({ code: 0, msg: 'name and name_en are required' }, 400);

    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS video_categories (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, name_en TEXT, icon TEXT,
        sort_order INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT 1, collect_enabled BOOLEAN DEFAULT 1,
        collect_priority INTEGER DEFAULT 5, created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `).run();

    if (id) {
      await c.env.DB.prepare(`UPDATE video_categories SET name = ?, name_en = ?, icon = ?, sort_order = ?, is_active = ?, collect_enabled = ? WHERE id = ?`)
        .bind(name, name_en, icon || null, sort_order || 0, is_active ? 1 : 0, collect_enabled ? 1 : 0, id).run();
    } else {
      const maxIdResult = await c.env.DB.prepare('SELECT MAX(id) as max_id FROM video_categories').first();
      const newId = ((maxIdResult?.max_id as number) || 5) + 1;
      await c.env.DB.prepare(`INSERT INTO video_categories (id, name, name_en, icon, sort_order, is_active, collect_enabled) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(newId, name, name_en, icon || null, sort_order || newId, is_active ? 1 : 0, collect_enabled ? 1 : 0).run();
    }

    return c.json({ code: 1, msg: 'success' });
  } catch (error) {
    logger.admin.error('Save category error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to save category' }, 500);
  }
});

/**
 * DELETE /admin/categories/:id
 */
categories.delete('/admin/categories/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (id <= 5) return c.json({ code: 0, msg: '不能删除系统默认分类' }, 400);
    await c.env.DB.prepare('DELETE FROM video_categories WHERE id = ?').bind(id).run();
    return c.json({ code: 1, msg: 'success' });
  } catch (error) {
    logger.admin.error('Delete category error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to delete category' }, 500);
  }
});

/**
 * GET /admin/categories/mappings
 */
categories.get('/admin/categories/mappings', async (c) => {
  try {
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS category_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT, source_id INTEGER NOT NULL, source_name TEXT,
        source_type_id TEXT NOT NULL, source_type_name TEXT, target_category_id INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')), UNIQUE(source_id, source_type_id)
      )
    `).run();

    const result = await c.env.DB.prepare(`SELECT * FROM category_mappings ORDER BY source_id, source_type_id`).all();
    return c.json({ code: 1, msg: 'success', data: result.results });
  } catch (error) {
    logger.admin.error('Get mappings error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get mappings' }, 500);
  }
});

/**
 * POST /admin/categories/mappings
 */
categories.post('/admin/categories/mappings', async (c) => {
  try {
    const body = await c.req.json();
    const { id, source_id, source_name, source_type_id, source_type_name, target_category_id } = body;

    if (!source_id || !source_type_id || !target_category_id) {
      return c.json({ code: 0, msg: 'source_id, source_type_id and target_category_id are required' }, 400);
    }

    if (id) {
      await c.env.DB.prepare(`UPDATE category_mappings SET source_id = ?, source_name = ?, source_type_id = ?, source_type_name = ?, target_category_id = ? WHERE id = ?`)
        .bind(source_id, source_name || '', source_type_id, source_type_name || '', target_category_id, id).run();
    } else {
      await c.env.DB.prepare(`INSERT OR REPLACE INTO category_mappings (source_id, source_name, source_type_id, source_type_name, target_category_id) VALUES (?, ?, ?, ?, ?)`)
        .bind(source_id, source_name || '', source_type_id, source_type_name || '', target_category_id).run();
    }

    const { clearMappingCache } = await import('../../services/auto_classifier');
    clearMappingCache();

    return c.json({ code: 1, msg: 'success' });
  } catch (error) {
    logger.admin.error('Save mapping error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to save mapping' }, 500);
  }
});

/**
 * DELETE /admin/categories/mappings/:id
 */
categories.delete('/admin/categories/mappings/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    await c.env.DB.prepare('DELETE FROM category_mappings WHERE id = ?').bind(id).run();
    const { clearMappingCache } = await import('../../services/auto_classifier');
    clearMappingCache();
    return c.json({ code: 1, msg: 'success' });
  } catch (error) {
    logger.admin.error('Delete mapping error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to delete mapping' }, 500);
  }
});

/**
 * GET /admin/categories/with-subs
 */
categories.get('/admin/categories/with-subs', async (c) => {
  // 分类类型
  interface CategoryItem {
    id: number;
    name: string;
    name_en: string;
    icon?: string;
    sort_order: number;
    is_active: boolean | number;
  }
  
  // 子分类类型
  interface SubCategoryItem {
    id: number;
    parent_id: number;
    name: string;
    name_en: string;
    keywords?: string;
    sort_order: number;
    is_active: boolean | number;
  }
  
  try {
    // 从数据库获取分类（不使用硬编码降级）
    const catResult = await c.env.DB.prepare(`
      SELECT id, name, name_en, icon, sort_order, is_active 
      FROM video_categories 
      WHERE is_active = 1 
      ORDER BY sort_order ASC
    `).all();
    const cats = (catResult.results || []) as CategoryItem[];

    // 从数据库获取子分类
    const subResult = await c.env.DB.prepare(`
      SELECT id, parent_id, name, name_en, keywords, sort_order, is_active 
      FROM video_sub_categories 
      WHERE is_active = 1 
      ORDER BY parent_id, sort_order ASC
    `).all();
    const subCategories = (subResult.results || []) as SubCategoryItem[];

    // 构建分类树
    const categoryTree = cats.map(cat => ({ 
      ...cat, 
      subCategories: subCategories.filter(sub => sub.parent_id === cat.id) 
    }));

    return c.json({ 
      code: 1, 
      msg: 'success', 
      data: { 
        categories: categoryTree, 
        flatCategories: cats, 
        flatSubCategories: subCategories 
      } 
    });
  } catch (error) {
    logger.admin.error('Get categories with subs error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get categories' }, 500);
  }
});

/**
 * GET /admin/sub-categories
 */
categories.get('/admin/sub-categories', async (c) => {
  try {
    const parentId = c.req.query('parent_id');
    let query = `SELECT sc.*, (SELECT COUNT(*) FROM vod_cache WHERE sub_type_id = sc.id) as video_count FROM video_sub_categories sc`;
    const params: number[] = [];
    
    if (parentId) { query += ' WHERE sc.parent_id = ?'; params.push(parseInt(parentId)); }
    query += ' ORDER BY sc.parent_id, sc.sort_order';
    
    const result = await c.env.DB.prepare(query).bind(...params).all();
    return c.json({ code: 1, msg: 'success', data: result.results });
  } catch {
    return c.json({ code: 1, msg: 'success', data: [] });
  }
});

/**
 * POST /admin/sub-categories
 */
categories.post('/admin/sub-categories', async (c) => {
  try {
    const body = await c.req.json();
    const { id, parent_id, name, name_en, icon, keywords, sort_order, is_active } = body;

    if (!parent_id || !name) return c.json({ code: 0, msg: 'parent_id and name are required' }, 400);

    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS video_sub_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT, parent_id INTEGER NOT NULL, name TEXT NOT NULL, name_en TEXT,
        icon TEXT, keywords TEXT, sort_order INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s', 'now')), UNIQUE(parent_id, name)
      )
    `).run();

    if (id) {
      await c.env.DB.prepare(`UPDATE video_sub_categories SET parent_id = ?, name = ?, name_en = ?, icon = ?, keywords = ?, sort_order = ?, is_active = ? WHERE id = ?`)
        .bind(parent_id, name, name_en || '', icon || '', keywords || '', sort_order || 0, is_active ? 1 : 0, id).run();
    } else {
      await c.env.DB.prepare(`INSERT OR REPLACE INTO video_sub_categories (parent_id, name, name_en, icon, keywords, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(parent_id, name, name_en || '', icon || '', keywords || '', sort_order || 0, is_active !== false ? 1 : 0).run();
    }

    const { clearMappingCache } = await import('../../services/auto_classifier');
    clearMappingCache();
    return c.json({ code: 1, msg: 'success' });
  } catch (error) {
    logger.admin.error('Save sub-category error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to save sub-category' }, 500);
  }
});

/**
 * DELETE /admin/sub-categories/:id
 */
categories.delete('/admin/sub-categories/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    await c.env.DB.prepare('DELETE FROM video_sub_categories WHERE id = ?').bind(id).run();
    const { clearMappingCache } = await import('../../services/auto_classifier');
    clearMappingCache();
    return c.json({ code: 1, msg: 'success' });
  } catch (error) {
    logger.admin.error('Delete sub-category error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to delete sub-category' }, 500);
  }
});

/**
 * POST /admin/sub-categories/migrate
 */
categories.post('/admin/sub-categories/migrate', async (c) => {
  try {
    const { migrateSubCategories } = await import('../../scripts/migrate_sub_categories');
    const result = await migrateSubCategories(c.env);
    return c.json({ code: result.success ? 1 : 0, msg: result.message, data: { subCategoriesCreated: result.subCategoriesCreated } });
  } catch (error) {
    logger.admin.error('Sub-category migration error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Migration failed' }, 500);
  }
});

// ============================================
// 动态筛选选项 API（地区、年份）
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
 * GET /admin/filter-options/areas
 * 获取所有可用的地区选项（从 vod_cache 动态获取）
 */
categories.get('/admin/filter-options/areas', async (c) => {
  try {
    const typeId = c.req.query('type_id'); // 可选：按分类筛选
    
    let query = `SELECT DISTINCT vod_area FROM vod_cache WHERE vod_area IS NOT NULL AND vod_area != ''`;
    const params: number[] = [];
    
    if (typeId) {
      query += ' AND type_id = ?';
      params.push(parseInt(typeId));
    }
    
    const result = await c.env.DB.prepare(query).bind(...params).all();
    
    // 处理地区数据：拆分组合值、标准化、去重
    const areaSet = new Set<string>();
    const rawAreas = (result.results || []) as { vod_area: string }[];
    
    for (const row of rawAreas) {
      // 拆分组合地区（如 "中国大陆,中国香港"）
      const areas = row.vod_area.split(',').map(a => a.trim()).filter(a => a);
      for (const area of areas) {
        const normalized = normalizeAreaForFilter(area);
        // 再次拆分（如 "港台" -> "中国香港,中国台湾"）
        const parts = normalized.split(',').map(a => a.trim()).filter(a => a);
        parts.forEach(p => areaSet.add(p));
      }
    }
    
    // 定义排序优先级
    const areaPriority: Record<string, number> = {
      '中国大陆': 1,
      '中国香港': 2,
      '中国台湾': 3,
      '日本': 4,
      '韩国': 5,
      '美国': 6,
      '英国': 7,
      '法国': 8,
      '泰国': 9,
    };
    
    // 排序：优先级高的在前，其他按字母顺序
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
    logger.admin.error('Get areas error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get areas' }, 500);
  }
});

/**
 * GET /admin/filter-options/years
 * 获取所有可用的年份选项（从 vod_cache 动态获取）
 */
categories.get('/admin/filter-options/years', async (c) => {
  try {
    const typeId = c.req.query('type_id'); // 可选：按分类筛选
    
    let query = `SELECT DISTINCT vod_year FROM vod_cache WHERE vod_year IS NOT NULL AND vod_year != '' AND vod_year != '0'`;
    const params: number[] = [];
    
    if (typeId) {
      query += ' AND type_id = ?';
      params.push(parseInt(typeId));
    }
    
    query += ' ORDER BY vod_year DESC';
    
    const result = await c.env.DB.prepare(query).bind(...params).all();
    const years = (result.results || []) as { vod_year: string }[];
    
    // 过滤有效年份（4位数字）
    const validYears = years
      .map(row => row.vod_year)
      .filter(year => /^\d{4}$/.test(year))
      .sort((a, b) => parseInt(b) - parseInt(a)); // 降序
    
    return c.json({
      code: 1,
      msg: 'success',
      data: validYears.map(year => ({ value: year, label: year })),
    });
  } catch (error) {
    logger.admin.error('Get years error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get years' }, 500);
  }
});

/**
 * GET /admin/filter-options
 * 获取所有筛选选项（分类、子分类、地区、年份）
 * 用于模块配置时的下拉选项
 */
categories.get('/admin/filter-options', async (c) => {
  try {
    const typeId = c.req.query('type_id');
    
    // 并发获取所有数据
    const [categoriesResult, subCategoriesResult, areasResult, yearsResult] = await Promise.all([
      // 主分类
      c.env.DB.prepare(`SELECT id, name, name_en FROM video_categories WHERE is_active = 1 ORDER BY sort_order`).all(),
      // 子分类
      typeId
        ? c.env.DB.prepare(`SELECT id, parent_id, name, name_en FROM video_sub_categories WHERE is_active = 1 AND parent_id = ? ORDER BY sort_order`).bind(parseInt(typeId)).all()
        : c.env.DB.prepare(`SELECT id, parent_id, name, name_en FROM video_sub_categories WHERE is_active = 1 ORDER BY parent_id, sort_order`).all(),
      // 地区
      typeId
        ? c.env.DB.prepare(`SELECT DISTINCT vod_area FROM vod_cache WHERE vod_area IS NOT NULL AND vod_area != '' AND type_id = ?`).bind(parseInt(typeId)).all()
        : c.env.DB.prepare(`SELECT DISTINCT vod_area FROM vod_cache WHERE vod_area IS NOT NULL AND vod_area != ''`).all(),
      // 年份
      typeId
        ? c.env.DB.prepare(`SELECT DISTINCT vod_year FROM vod_cache WHERE vod_year IS NOT NULL AND vod_year != '' AND vod_year != '0' AND type_id = ? ORDER BY vod_year DESC`).bind(parseInt(typeId)).all()
        : c.env.DB.prepare(`SELECT DISTINCT vod_year FROM vod_cache WHERE vod_year IS NOT NULL AND vod_year != '' AND vod_year != '0' ORDER BY vod_year DESC`).all(),
    ]);
    
    // 处理分类
    let categories = (categoriesResult.results || []) as { id: number; name: string; name_en: string }[];
    if (categories.length === 0) {
      categories = [
        { id: 1, name: '电影', name_en: 'movie' },
        { id: 2, name: '电视剧', name_en: 'series' },
        { id: 3, name: '综艺', name_en: 'variety' },
        { id: 4, name: '动漫', name_en: 'anime' },
        { id: 5, name: '短剧', name_en: 'shorts' },
      ];
    }
    
    // 处理子分类
    const subCategories = (subCategoriesResult.results || []) as { id: number; parent_id: number; name: string; name_en: string }[];
    
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
    const areaPriority: Record<string, number> = {
      '中国大陆': 1, '中国香港': 2, '中国台湾': 3, '日本': 4, '韩国': 5, '美国': 6, '英国': 7, '法国': 8, '泰国': 9,
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
    
    return c.json({
      code: 1,
      msg: 'success',
      data: {
        categories: categories.map(c => ({ value: c.id, label: c.name, name_en: c.name_en })),
        subCategories: subCategories.map(s => ({ value: s.id, label: s.name, parent_id: s.parent_id, name_en: s.name_en })),
        areas: areas.map(a => ({ value: a, label: a })),
        years: years.map(y => ({ value: y, label: y })),
      },
    });
  } catch (error) {
    logger.admin.error('Get filter options error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get filter options' }, 500);
  }
});

export default categories;
