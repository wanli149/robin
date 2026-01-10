/**
 * 公告管理 API
 * 管理公告弹窗，支持紧急通知、版本更新、域名变更等
 */

import { Hono } from 'hono';
import type { Bindings } from './types';
import { logger } from '../../utils/logger';

const announcements = new Hono<{ Bindings: Bindings }>();

// ============================================
// 管理接口
// ============================================

/**
 * GET /admin/announcements
 * 获取公告列表
 */
announcements.get('/admin/announcements', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const status = c.req.query('status'); // active, inactive, all
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    if (status === 'active') {
      whereClause = 'is_active = 1';
    } else if (status === 'inactive') {
      whereClause = 'is_active = 0';
    }

    const [listResult, countResult] = await Promise.all([
      c.env.DB.prepare(`
        SELECT id, title, content, type, action_type, action_url, action_text,
               image_url, priority, is_active, show_once, force_show,
               target_version, target_platform, start_time, end_time,
               view_count, click_count, created_at, updated_at
        FROM announcements
        WHERE ${whereClause}
        ORDER BY priority DESC, created_at DESC
        LIMIT ? OFFSET ?
      `).bind(limit, offset).all(),
      c.env.DB.prepare(`SELECT COUNT(*) as total FROM announcements WHERE ${whereClause}`).first(),
    ]);

    return c.json({
      code: 1,
      data: listResult.results || [],
      total: countResult?.total || 0,
      page,
      limit,
    });
  } catch (error) {
    logger.admin.error('Announcements list error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: '获取公告列表失败' }, 500);
  }
});

/**
 * GET /admin/announcements/:id
 * 获取公告详情
 */
announcements.get('/admin/announcements/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await c.env.DB.prepare(`
      SELECT * FROM announcements WHERE id = ?
    `).bind(id).first();

    if (!result) {
      return c.json({ code: 0, msg: '公告不存在' }, 404);
    }

    return c.json({ code: 1, data: result });
  } catch (error) {
    logger.admin.error('Announcements get detail error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: '获取公告详情失败' }, 500);
  }
});

/**
 * POST /admin/announcements
 * 创建公告
 */
announcements.post('/admin/announcements', async (c) => {
  try {
    const body = await c.req.json();
    const {
      title, content, type = 'info', action_type = 'none',
      action_url, action_text, image_url, priority = 0,
      is_active = true, show_once = false, force_show = false,
      target_version, target_platform = 'all', start_time, end_time,
    } = body;

    if (!title || !content) {
      return c.json({ code: 0, msg: '标题和内容不能为空' }, 400);
    }

    const now = Math.floor(Date.now() / 1000);
    const result = await c.env.DB.prepare(`
      INSERT INTO announcements (
        title, content, type, action_type, action_url, action_text,
        image_url, priority, is_active, show_once, force_show,
        target_version, target_platform, start_time, end_time,
        view_count, click_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `).bind(
      title, content, type, action_type, action_url || null, action_text || null,
      image_url || null, priority, is_active ? 1 : 0, show_once ? 1 : 0, force_show ? 1 : 0,
      target_version || null, target_platform, start_time || null, end_time || null,
      now, now
    ).run();

    // 清除公告缓存
    await c.env.ROBIN_CACHE.delete('active_announcement');

    return c.json({
      code: 1,
      msg: '创建成功',
      data: { id: result.meta.last_row_id },
    });
  } catch (error) {
    logger.admin.error('Announcements create error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: '创建公告失败' }, 500);
  }
});

/**
 * PUT /admin/announcements/:id
 * 更新公告
 */
announcements.put('/admin/announcements/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const {
      title, content, type, action_type, action_url, action_text,
      image_url, priority, is_active, show_once, force_show,
      target_version, target_platform, start_time, end_time,
    } = body;

    const now = Math.floor(Date.now() / 1000);
    await c.env.DB.prepare(`
      UPDATE announcements SET
        title = COALESCE(?, title),
        content = COALESCE(?, content),
        type = COALESCE(?, type),
        action_type = COALESCE(?, action_type),
        action_url = ?,
        action_text = ?,
        image_url = ?,
        priority = COALESCE(?, priority),
        is_active = COALESCE(?, is_active),
        show_once = COALESCE(?, show_once),
        force_show = COALESCE(?, force_show),
        target_version = ?,
        target_platform = COALESCE(?, target_platform),
        start_time = ?,
        end_time = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(
      title || null, content || null, type || null, action_type || null,
      action_url ?? null, action_text ?? null, image_url ?? null,
      priority ?? null, is_active !== undefined ? (is_active ? 1 : 0) : null,
      show_once !== undefined ? (show_once ? 1 : 0) : null,
      force_show !== undefined ? (force_show ? 1 : 0) : null,
      target_version ?? null, target_platform || null,
      start_time ?? null, end_time ?? null, now, id
    ).run();

    // 清除公告缓存
    await c.env.ROBIN_CACHE.delete('active_announcement');

    return c.json({ code: 1, msg: '更新成功' });
  } catch (error) {
    logger.admin.error('Announcements update error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: '更新公告失败' }, 500);
  }
});

/**
 * DELETE /admin/announcements/:id
 * 删除公告
 */
announcements.delete('/admin/announcements/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM announcement_reads WHERE announcement_id = ?').bind(id).run();

    // 清除公告缓存
    await c.env.ROBIN_CACHE.delete('active_announcement');

    return c.json({ code: 1, msg: '删除成功' });
  } catch (error) {
    logger.admin.error('Announcements delete error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: '删除公告失败' }, 500);
  }
});

/**
 * PATCH /admin/announcements/:id/toggle
 * 切换公告启用状态
 */
announcements.patch('/admin/announcements/:id/toggle', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare(`
      UPDATE announcements SET is_active = 1 - is_active, updated_at = ? WHERE id = ?
    `).bind(Math.floor(Date.now() / 1000), id).run();

    // 清除公告缓存
    await c.env.ROBIN_CACHE.delete('active_announcement');

    return c.json({ code: 1, msg: '状态已切换' });
  } catch (error) {
    logger.admin.error('Announcements toggle error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: '切换状态失败' }, 500);
  }
});

/**
 * GET /admin/announcements/:id/stats
 * 获取公告统计
 */
announcements.get('/admin/announcements/:id/stats', async (c) => {
  try {
    const id = c.req.param('id');
    
    const [announcement, readCount] = await Promise.all([
      c.env.DB.prepare(`
        SELECT view_count, click_count FROM announcements WHERE id = ?
      `).bind(id).first(),
      c.env.DB.prepare(`
        SELECT COUNT(*) as count FROM announcement_reads WHERE announcement_id = ?
      `).bind(id).first(),
    ]);

    if (!announcement) {
      return c.json({ code: 0, msg: '公告不存在' }, 404);
    }

    return c.json({
      code: 1,
      data: {
        view_count: announcement.view_count || 0,
        click_count: announcement.click_count || 0,
        unique_reads: readCount?.count || 0,
        click_rate: announcement.view_count 
          ? ((announcement.click_count as number) / (announcement.view_count as number) * 100).toFixed(2) + '%'
          : '0%',
      },
    });
  } catch (error) {
    logger.admin.error('Announcements stats error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: '获取统计失败' }, 500);
  }
});

export default announcements;
