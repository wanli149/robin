/**
 * Admin Videos API
 * 视频管理相关接口
 */

import { Hono } from 'hono';
import type { Bindings } from './types';
import type { PlaySource, PlayEpisode, DbQueryParam } from '../../types/database';
import { logger } from '../../utils/logger';

const videos = new Hono<{ Bindings: Bindings }>();

/**
 * GET /admin/videos
 */
videos.get('/admin/videos', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const typeId = c.req.query('type_id');
    const keyword = c.req.query('keyword');
    const isValid = c.req.query('is_valid');
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const params: DbQueryParam[] = [];

    if (typeId) {
      whereClause += ' AND type_id = ?';
      params.push(parseInt(typeId));
    }
    if (keyword) {
      whereClause += ' AND (vod_name LIKE ? OR vod_actor LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (isValid !== undefined && isValid !== '') {
      whereClause += ' AND is_valid = ?';
      params.push(parseInt(isValid));
    }

    const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM vod_cache WHERE ${whereClause}`).bind(...params).first();
    const total = (countResult?.count as number) || 0;

    params.push(limit, offset);
    const result = await c.env.DB.prepare(`
      SELECT vod_id, vod_name, vod_pic, vod_remarks, vod_year, vod_area, vod_score, type_id, type_name, is_valid, updated_at
      FROM vod_cache WHERE ${whereClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?
    `).bind(...params).all();

    return c.json({
      code: 1,
      msg: 'success',
      page,
      pagecount: Math.ceil(total / limit),
      total,
      list: result.results,
    });
  } catch (error) {
    logger.admin.error('Get videos error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get videos' }, 500);
  }
});

/**
 * GET /admin/video/:id
 */
videos.get('/admin/video/:id', async (c) => {
  try {
    const vodId = c.req.param('id');
    const result = await c.env.DB.prepare(`SELECT * FROM vod_cache WHERE vod_id = ?`).bind(vodId).first();

    if (!result) {
      return c.json({ code: 0, msg: 'Video not found' }, 404);
    }

    // 解析播放地址
    let playSources: PlaySource[] = [];
    try {
      const playUrls = result.vod_play_url ? JSON.parse(result.vod_play_url as string) : {};
      
      // 转换为 play_sources 格式
      for (const [sourceName, sourceData] of Object.entries(playUrls)) {
        if (Array.isArray(sourceData)) {
          playSources.push({ name: sourceName, episodes: sourceData as PlayEpisode[] });
        }
      }
    } catch (e) {
      logger.admin.warn('Failed to parse play_urls', { error: e instanceof Error ? e.message : 'Unknown' });
    }

    return c.json({ code: 1, msg: 'success', data: { ...result, play_urls: playSources.length > 0 ? Object.fromEntries(playSources.map(s => [s.name, s.episodes])) : {}, play_sources: playSources } });
  } catch (error) {
    logger.admin.error('Get video error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get video' }, 500);
  }
});

/**
 * PUT /admin/video/:id
 */
videos.put('/admin/video/:id', async (c) => {
  try {
    const vodId = c.req.param('id');
    const body = await c.req.json();
    const { vod_name, vod_pic, vod_remarks, vod_year, vod_area, vod_actor, vod_director, vod_content, vod_score, type_id, type_name, is_valid } = body;
    const now = Math.floor(Date.now() / 1000);

    await c.env.DB.prepare(`
      UPDATE vod_cache SET vod_name = ?, vod_pic = ?, vod_remarks = ?, vod_year = ?, vod_area = ?, 
      vod_actor = ?, vod_director = ?, vod_content = ?, vod_score = ?, type_id = ?, type_name = ?, is_valid = ?, updated_at = ?
      WHERE vod_id = ?
    `).bind(vod_name, vod_pic, vod_remarks, vod_year, vod_area, vod_actor, vod_director, vod_content, vod_score, type_id, type_name, is_valid ? 1 : 0, now, vodId).run();

    // 清除视频详情缓存
    await c.env.ROBIN_CACHE.delete(`vod:${vodId}`);

    return c.json({ code: 1, msg: 'Video updated successfully' });
  } catch (error) {
    logger.admin.error('Update video error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to update video' }, 500);
  }
});

/**
 * DELETE /admin/video/:id
 */
videos.delete('/admin/video/:id', async (c) => {
  try {
    const vodId = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM vod_cache WHERE vod_id = ?').bind(vodId).run();
    await c.env.ROBIN_CACHE.delete(`vod:${vodId}`);
    return c.json({ code: 1, msg: 'Video deleted successfully' });
  } catch (error) {
    logger.admin.error('Delete video error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to delete video' }, 500);
  }
});

/**
 * PATCH /admin/video/:id/valid
 */
videos.patch('/admin/video/:id/valid', async (c) => {
  try {
    const vodId = c.req.param('id');
    const body = await c.req.json();
    const { is_valid } = body;
    const now = Math.floor(Date.now() / 1000);

    await c.env.DB.prepare(`UPDATE vod_cache SET is_valid = ?, updated_at = ? WHERE vod_id = ?`).bind(is_valid ? 1 : 0, now, vodId).run();
    await c.env.ROBIN_CACHE.delete(`vod:${vodId}`);

    return c.json({ code: 1, msg: 'Video status updated' });
  } catch (error) {
    logger.admin.error('Update video status error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to update video status' }, 500);
  }
});

/**
 * GET /admin/shorts
 */
videos.get('/admin/shorts', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;

    const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM vod_cache WHERE type_id = 5`).first();
    const total = (countResult?.count as number) || 0;

    const result = await c.env.DB.prepare(`
      SELECT vod_id, vod_name, vod_pic_thumb, shorts_category, vod_remarks, is_valid, updated_at
      FROM vod_cache WHERE type_id = 5 ORDER BY updated_at DESC LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    return c.json({
      code: 1,
      msg: 'success',
      page,
      pagecount: Math.ceil(total / limit),
      total,
      list: result.results,
    });
  } catch (error) {
    logger.admin.error('Get shorts error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get shorts' }, 500);
  }
});

/**
 * DELETE /admin/shorts/:id
 */
videos.delete('/admin/shorts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare(`UPDATE vod_cache SET is_valid = 0 WHERE vod_id = ? AND type_id = 5`).bind(id).run();
    return c.json({ code: 1, msg: 'Shorts disabled successfully' });
  } catch (error) {
    logger.admin.error('Delete shorts error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to disable shorts' }, 500);
  }
});

/**
 * POST /admin/videos/batch
 */
videos.post('/admin/videos/batch', async (c) => {
  try {
    const body = await c.req.json();
    const { vod_ids, action, data } = body;

    if (!vod_ids || !Array.isArray(vod_ids) || vod_ids.length === 0) {
      return c.json({ code: 0, msg: 'vod_ids is required' }, 400);
    }

    const placeholders = vod_ids.map(() => '?').join(',');
    const now = Math.floor(Date.now() / 1000);

    switch (action) {
      case 'delete':
        await c.env.DB.prepare(`DELETE FROM vod_cache WHERE vod_id IN (${placeholders})`).bind(...vod_ids).run();
        break;
      case 'mark_valid':
        await c.env.DB.prepare(`UPDATE vod_cache SET is_valid = 1, updated_at = ? WHERE vod_id IN (${placeholders})`).bind(now, ...vod_ids).run();
        break;
      case 'mark_invalid':
        await c.env.DB.prepare(`UPDATE vod_cache SET is_valid = 0, updated_at = ? WHERE vod_id IN (${placeholders})`).bind(now, ...vod_ids).run();
        break;
      case 'change_category':
        if (data?.type_id) {
          const typeNames: Record<number, string> = { 1: '电影', 2: '电视剧', 3: '综艺', 4: '动漫', 5: '短剧', 6: '体育', 7: '纪录片', 8: '预告片' };
          await c.env.DB.prepare(`UPDATE vod_cache SET type_id = ?, type_name = ?, updated_at = ? WHERE vod_id IN (${placeholders})`)
            .bind(data.type_id, typeNames[data.type_id] || '其他', now, ...vod_ids).run();
        }
        break;
      default:
        return c.json({ code: 0, msg: 'Invalid action' }, 400);
    }

    return c.json({ code: 1, msg: 'success', affected: vod_ids.length });
  } catch (error) {
    logger.admin.error('Batch videos error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Batch operation failed' }, 500);
  }
});

/**
 * GET /admin/videos/export
 */
videos.get('/admin/videos/export', async (c) => {
  try {
    const typeId = c.req.query('type_id');
    const isValid = c.req.query('is_valid');
    const limit = parseInt(c.req.query('limit') || '1000');

    let query = 'SELECT vod_id, vod_name, vod_pic, type_id, type_name, vod_year, vod_area, vod_actor, vod_score, is_valid FROM vod_cache WHERE 1=1';
    const bindings: DbQueryParam[] = [];

    if (typeId) { query += ' AND type_id = ?'; bindings.push(parseInt(typeId)); }
    if (isValid !== undefined) { query += ' AND is_valid = ?'; bindings.push(isValid === '1' ? 1 : 0); }

    query += ' ORDER BY updated_at DESC LIMIT ?';
    bindings.push(limit);

    const result = await c.env.DB.prepare(query).bind(...bindings).all();
    return c.json({ code: 1, msg: 'success', list: result.results, total: result.results.length });
  } catch (error) {
    return c.json({ code: 0, msg: 'Export failed' }, 500);
  }
});

/**
 * GET /admin/video/:id/sources
 */
videos.get('/admin/video/:id/sources', async (c) => {
  try {
    const vodId = c.req.param('id');
    const video = await c.env.DB.prepare(`SELECT vod_play_url FROM vod_cache WHERE vod_id = ?`).bind(vodId).first();

    if (!video) return c.json({ code: 0, msg: 'Video not found' }, 404);

    let sources: PlaySource[] = [];
    
    try {
      const playUrls = JSON.parse((video.vod_play_url as string) || '{}');
      
      for (const [sourceName, sourceData] of Object.entries(playUrls)) {
        if (Array.isArray(sourceData)) {
          sources.push({
            name: sourceName,
            episodes: (sourceData as PlayEpisode[]).map(ep => ({ title: ep.name, url: ep.url })),
          });
        }
      }
    } catch (e) {
      // JSON 解析失败
    }

    return c.json({ code: 1, msg: 'success', data: { sources } });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to get sources' }, 500);
  }
});

/**
 * POST /admin/video/:id/repair
 */
videos.post('/admin/video/:id/repair', async (c) => {
  try {
    const vodId = c.req.param('id');
    const video = await c.env.DB.prepare(`SELECT vod_id, vod_name FROM vod_cache WHERE vod_id = ?`).bind(vodId).first();
    
    if (!video) return c.json({ code: 0, msg: '视频不存在' }, 404);
    
    // 简化版修复逻辑
    return c.json({ code: 0, msg: '修复功能需要完整实现' });
  } catch (error) {
    logger.admin.error('Repair video error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: '修复失败' }, 500);
  }
});

/**
 * POST /admin/videos/repair-invalid
 */
videos.post('/admin/videos/repair-invalid', async (c) => {
  try {
    return c.json({ code: 0, msg: '批量修复功能需要完整实现' });
  } catch (error) {
    logger.admin.error('Batch repair error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: '批量修复失败' }, 500);
  }
});

/**
 * DELETE /admin/videos/clear
 * 清空视频数据
 * @param type_id - 可选，指定分类ID则只清空该分类
 */
videos.delete('/admin/videos/clear', async (c) => {
  try {
    const typeId = c.req.query('type_id');
    
    let deleted = 0;
    
    if (typeId) {
      // 清空指定分类
      const result = await c.env.DB.prepare(
        'DELETE FROM vod_cache WHERE type_id = ?'
      ).bind(parseInt(typeId)).run();
      deleted = result.meta?.changes || 0;
      logger.admin.info('Cleared videos from category', { typeId, deleted });
    } else {
      // 清空所有视频
      const result = await c.env.DB.prepare('DELETE FROM vod_cache').run();
      deleted = result.meta?.changes || 0;
      logger.admin.info('Cleared all videos', { deleted });
    }
    
    // 清除相关缓存
    const cacheKeys = [
      'layout:featured', 'layout:movie', 'layout:series', 
      'layout:shorts', 'layout:anime', 'layout:variety',
      'home_tabs'
    ];
    for (const key of cacheKeys) {
      try {
        await c.env.ROBIN_CACHE.delete(key);
      } catch (e) {
        // 单个缓存删除失败不影响整体清理
        logger.admin.warn('Failed to delete cache key', { key, error: e instanceof Error ? e.message : 'Unknown' });
      }
    }
    
    return c.json({ 
      code: 1, 
      msg: typeId ? `已清空分类 ${typeId} 的 ${deleted} 个视频` : `已清空所有 ${deleted} 个视频`,
      deleted 
    });
  } catch (error) {
    logger.admin.error('Clear videos error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: '清空视频失败' }, 500);
  }
});

export default videos;
