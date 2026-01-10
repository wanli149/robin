/**
 * Admin Misc API
 * 其他管理接口（反馈、应用墙、热搜、资源站等）
 */

import { Hono } from 'hono';
import type { Bindings } from './types';
import type { FeedbackRow, FeedbackCategoryStats, DbQueryParam } from '../../types/database';
import { logger } from '../../utils/logger';

const misc = new Hono<{ Bindings: Bindings }>();

// ============================================
// 反馈管理
// ============================================

/**
 * GET /admin/feedback
 */
misc.get('/admin/feedback', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT id, user_id, content, contact, status, created_at
      FROM feedback WHERE status = 'pending' ORDER BY created_at DESC LIMIT 50
    `).all();
    return c.json({ code: 1, msg: 'success', data: result.results });
  } catch (error) {
    logger.admin.error('Get feedback error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get feedback' }, 500);
  }
});

/**
 * PATCH /admin/feedback/:id
 */
misc.patch('/admin/feedback/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare(`UPDATE feedback SET status = 'processed' WHERE id = ?`).bind(id).run();
    return c.json({ code: 1, msg: 'Feedback marked as processed' });
  } catch (error) {
    logger.admin.error('Update feedback error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to update feedback' }, 500);
  }
});

/**
 * GET /admin/feedback/all
 */
misc.get('/admin/feedback/all', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const status = c.req.query('status');
    const category = c.req.query('category');
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM feedback WHERE 1=1';
    const bindings: DbQueryParam[] = [];

    if (status) { query += ' AND status = ?'; bindings.push(status); }
    if (category) { query += ' AND category = ?'; bindings.push(category); }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const result = await c.env.DB.prepare(query).bind(...bindings).all();

    let countQuery = 'SELECT COUNT(*) as count FROM feedback WHERE 1=1';
    const countBindings: DbQueryParam[] = [];
    if (status) { countQuery += ' AND status = ?'; countBindings.push(status); }
    if (category) { countQuery += ' AND category = ?'; countBindings.push(category); }
    const countResult = await c.env.DB.prepare(countQuery).bind(...countBindings).first();

    return c.json({ code: 1, msg: 'success', data: { list: result.results, total: countResult?.count || 0, page, limit } });
  } catch (error) {
    logger.admin.error('Get all feedback error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get feedback' }, 500);
  }
});

/**
 * POST /admin/feedback/:id/reply
 */
misc.post('/admin/feedback/:id/reply', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { reply } = body;

    if (!reply) return c.json({ code: 0, msg: 'reply is required' }, 400);

    const now = Math.floor(Date.now() / 1000);
    await c.env.DB.prepare(`UPDATE feedback SET reply = ?, replied_at = ?, status = 'replied' WHERE id = ?`).bind(reply, now, id).run();

    return c.json({ code: 1, msg: 'Reply sent successfully' });
  } catch (error) {
    logger.admin.error('Reply feedback error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to reply' }, 500);
  }
});

/**
 * PATCH /admin/feedback/:id/category
 */
misc.patch('/admin/feedback/:id/category', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { category } = body;

    await c.env.DB.prepare(`UPDATE feedback SET category = ? WHERE id = ?`).bind(category, id).run();
    return c.json({ code: 1, msg: 'success' });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to update category' }, 500);
  }
});

/**
 * POST /admin/feedback/batch
 */
misc.post('/admin/feedback/batch', async (c) => {
  try {
    const body = await c.req.json();
    const { ids, action } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) return c.json({ code: 0, msg: 'ids is required' }, 400);

    const placeholders = ids.map(() => '?').join(',');

    if (action === 'process') {
      await c.env.DB.prepare(`UPDATE feedback SET status = 'processed' WHERE id IN (${placeholders})`).bind(...ids).run();
    } else if (action === 'delete') {
      await c.env.DB.prepare(`DELETE FROM feedback WHERE id IN (${placeholders})`).bind(...ids).run();
    }

    return c.json({ code: 1, msg: 'success' });
  } catch (error) {
    return c.json({ code: 0, msg: 'Batch operation failed' }, 500);
  }
});

/**
 * GET /admin/feedback/stats
 */
misc.get('/admin/feedback/stats', async (c) => {
  try {
    const total = await c.env.DB.prepare('SELECT COUNT(*) as count FROM feedback').first();
    const pending = await c.env.DB.prepare('SELECT COUNT(*) as count FROM feedback WHERE status = "pending"').first();
    const processed = await c.env.DB.prepare('SELECT COUNT(*) as count FROM feedback WHERE status = "processed"').first();
    const replied = await c.env.DB.prepare('SELECT COUNT(*) as count FROM feedback WHERE status = "replied"').first();

    let byCategory: FeedbackCategoryStats[] = [];
    try {
      const catResult = await c.env.DB.prepare(`SELECT category, COUNT(*) as count FROM feedback GROUP BY category`).all();
      byCategory = catResult.results as FeedbackCategoryStats[];
    } catch (e) {
      logger.admin.warn('Failed to get feedback by category', { error: e instanceof Error ? e.message : 'Unknown' });
    }

    return c.json({
      code: 1, msg: 'success',
      data: { total: total?.count || 0, pending: pending?.count || 0, processed: processed?.count || 0, replied: replied?.count || 0, byCategory },
    });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to get stats' }, 500);
  }
});

// ============================================
// 应用墙管理
// ============================================

/**
 * GET /admin/app_wall
 */
misc.get('/admin/app_wall', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT id, app_name, icon_url, download_url, commission, sort_order, is_active
      FROM app_wall ORDER BY sort_order ASC
    `).all();
    return c.json({ code: 1, msg: 'success', data: result.results });
  } catch (error) {
    logger.admin.error('Get app wall error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get app wall' }, 500);
  }
});

/**
 * POST /admin/app_wall
 */
misc.post('/admin/app_wall', async (c) => {
  try {
    const body = await c.req.json();
    const { id, app_name, icon_url, download_url, commission, sort_order, is_active } = body;

    if (id) {
      await c.env.DB.prepare(`
        UPDATE app_wall SET app_name = ?, icon_url = ?, download_url = ?, commission = ?, sort_order = ?, is_active = ? WHERE id = ?
      `).bind(app_name, icon_url, download_url, commission || 0, sort_order || 0, is_active !== false ? 1 : 0, id).run();
    } else {
      await c.env.DB.prepare(`
        INSERT INTO app_wall (app_name, icon_url, download_url, commission, sort_order, is_active) VALUES (?, ?, ?, ?, ?, 1)
      `).bind(app_name, icon_url, download_url, commission || 0, sort_order || 0).run();
    }

    return c.json({ code: 1, msg: 'App saved successfully' });
  } catch (error) {
    logger.admin.error('Save app wall error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to save app' }, 500);
  }
});

/**
 * DELETE /admin/app_wall/:id
 */
misc.delete('/admin/app_wall/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM app_wall WHERE id = ?').bind(id).run();
    return c.json({ code: 1, msg: 'App deleted successfully' });
  } catch (error) {
    logger.admin.error('Delete app wall error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to delete app' }, 500);
  }
});

// ============================================
// 热搜管理
// ============================================

/**
 * GET /admin/hot_search
 */
misc.get('/admin/hot_search', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT keyword, search_count, is_pinned, is_hidden FROM hot_search_stats ORDER BY is_pinned DESC, search_count DESC LIMIT 50
    `).all();
    return c.json({ code: 1, msg: 'success', data: result.results });
  } catch (error) {
    logger.admin.error('Get hot search error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get hot search' }, 500);
  }
});

/**
 * POST /admin/hot_search
 */
misc.post('/admin/hot_search', async (c) => {
  try {
    const body = await c.req.json();
    const { keywords } = body;

    if (!keywords || !Array.isArray(keywords)) {
      return c.json({ code: 0, msg: 'keywords must be an array' }, 400);
    }

    // 重置所有置顶
    await c.env.DB.prepare(`UPDATE hot_search_stats SET is_pinned = 0`).run();

    // 设置新的置顶关键词
    for (let i = 0; i < keywords.length; i++) {
      await c.env.DB.prepare(`
        INSERT INTO hot_search_stats (keyword, search_count, is_pinned) VALUES (?, ?, 1)
        ON CONFLICT(keyword) DO UPDATE SET is_pinned = 1
      `).bind(keywords[i], 10000 - i).run();
    }

    // 清除热搜缓存
    await c.env.ROBIN_CACHE.delete('hot_search_keywords');

    return c.json({ code: 1, msg: 'Hot search updated' });
  } catch (error) {
    logger.admin.error('Update hot search error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to update hot search' }, 500);
  }
});

export default misc;
