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
      return c.json({ code: 1, msg: 'success', list: categoriesWithCount });
    }

    return c.json({ code: 1, msg: 'success', list: result.results });
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
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;
    const oneWeekAgo = now - 604800;

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

    return c.json({ code: 1, msg: 'success', list: stats });
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
    return c.json({ code: 1, msg: 'success', list: result.results });
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
    let cats: CategoryItem[] = [];
    try {
      const catResult = await c.env.DB.prepare(`SELECT id, name, name_en, icon, sort_order, is_active FROM video_categories WHERE is_active = 1 ORDER BY sort_order ASC`).all();
      cats = (catResult.results || []) as CategoryItem[];
    } catch (e) {
      logger.admin.warn('Failed to load categories', { error: e instanceof Error ? e.message : 'Unknown' });
    }

    if (cats.length === 0) {
      cats = [
        { id: 1, name: '电影', name_en: 'movie', sort_order: 1, is_active: true },
        { id: 2, name: '电视剧', name_en: 'series', sort_order: 2, is_active: true },
        { id: 3, name: '综艺', name_en: 'variety', sort_order: 3, is_active: true },
        { id: 4, name: '动漫', name_en: 'anime', sort_order: 4, is_active: true },
        { id: 5, name: '短剧', name_en: 'shorts', sort_order: 5, is_active: true },
      ];
    }

    let subCategories: SubCategoryItem[] = [];
    try {
      const subResult = await c.env.DB.prepare(`SELECT id, parent_id, name, name_en, keywords, sort_order, is_active FROM video_sub_categories WHERE is_active = 1 ORDER BY parent_id, sort_order ASC`).all();
      subCategories = (subResult.results || []) as SubCategoryItem[];
    } catch (e) {
      logger.admin.warn('Failed to load sub-categories', { error: e instanceof Error ? e.message : 'Unknown' });
    }

    const categoryTree = cats.map(cat => ({ ...cat, subCategories: subCategories.filter(sub => sub.parent_id === cat.id) }));

    return c.json({ code: 1, msg: 'success', data: { categories: categoryTree, flatCategories: cats, flatSubCategories: subCategories } });
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
    return c.json({ code: 1, msg: 'success', list: result.results });
  } catch {
    return c.json({ code: 1, msg: 'success', list: [] });
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

export default categories;
