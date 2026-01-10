/**
 * Admin Topics API
 * 专题管理相关接口
 * 
 * 数据来源类型 (data_source_type):
 * - manual: 手动选择视频
 * - actor: 按演员搜索（如：林正英专辑）
 * - keyword: 按关键词搜索（如：国内大片）
 * - company: 按制作公司/标签（如：迪士尼专题）
 * - filter: 按分类+条件筛选（如：2024年国产剧）
 */

import { Hono } from 'hono';
import type { Bindings } from './types';
import type { TopicRow, TopicVideoRow, DbQueryParam } from '../../types/database';
import { logger } from '../../utils/logger';

const topics = new Hono<{ Bindings: Bindings }>();

/**
 * POST /admin/topic
 * 创建/更新专题
 */
topics.post('/admin/topic', async (c) => {
  try {
    const body = await c.req.json();
    const { 
      id, title, cover_img, description, is_active, sort_order,
      // 新增：数据来源配置
      data_source_type,  // manual | actor | keyword | company | filter
      data_source_config // JSON 配置
    } = body;

    if (!id || !title) {
      return c.json({ code: 0, msg: 'id and title are required' }, 400);
    }

    // 检查表是否有新字段，如果没有则添加
    try {
      await c.env.DB.prepare(`
        ALTER TABLE topics ADD COLUMN data_source_type TEXT DEFAULT 'manual'
      `).run();
    } catch (e) {
      // 字段已存在则忽略
      logger.admin.debug('data_source_type column may already exist');
    }
    
    try {
      await c.env.DB.prepare(`
        ALTER TABLE topics ADD COLUMN data_source_config TEXT
      `).run();
    } catch (e) {
      // 字段已存在则忽略
      logger.admin.debug('data_source_config column may already exist');
    }

    await c.env.DB.prepare(`
      INSERT INTO topics (id, title, cover_img, description, is_active, sort_order, data_source_type, data_source_config)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        cover_img = excluded.cover_img,
        description = excluded.description,
        is_active = excluded.is_active,
        sort_order = excluded.sort_order,
        data_source_type = excluded.data_source_type,
        data_source_config = excluded.data_source_config
    `).bind(
      id, 
      title, 
      cover_img || null, 
      description || null, 
      is_active !== undefined ? is_active : 1, 
      sort_order || 0,
      data_source_type || 'manual',
      data_source_config ? JSON.stringify(data_source_config) : null
    ).run();

    return c.json({ code: 1, msg: 'Topic saved successfully' });
  } catch (error) {
    logger.admin.error('Save topic error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to save topic' }, 500);
  }
});

/**
 * GET /admin/topics
 */
topics.get('/admin/topics', async (c) => {
  try {
    // 先检查表结构，尝试添加新字段（如果不存在）
    try {
      await c.env.DB.prepare(`ALTER TABLE topics ADD COLUMN data_source_type TEXT DEFAULT 'manual'`).run();
    } catch (e) {
      // 字段已存在则忽略
      logger.admin.debug('data_source_type column may already exist', { error: e instanceof Error ? e.message : 'Unknown' });
    }
    try {
      await c.env.DB.prepare(`ALTER TABLE topics ADD COLUMN data_source_config TEXT`).run();
    } catch (e) {
      // 字段已存在则忽略
      logger.admin.debug('data_source_config column may already exist', { error: e instanceof Error ? e.message : 'Unknown' });
    }

    const result = await c.env.DB.prepare(`
      SELECT id, title, cover_img, description, 
             COALESCE(is_active, 1) as is_active, 
             COALESCE(sort_order, 0) as sort_order,
             COALESCE(data_source_type, 'manual') as data_source_type,
             data_source_config
      FROM topics ORDER BY sort_order ASC, id DESC
    `).all();
    
    // 解析 data_source_config JSON
    const list = ((result.results || []) as TopicRow[]).map(topic => ({
      ...topic,
      data_source_config: topic.data_source_config ? JSON.parse(topic.data_source_config) : null,
    }));
    
    return c.json({ code: 1, msg: 'success', data: list });
  } catch (error) {
    logger.admin.error('Get topics error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get topics' }, 500);
  }
});

/**
 * DELETE /admin/topic/:id
 */
topics.delete('/admin/topic/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM topics WHERE id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM topic_items WHERE topic_id = ?').bind(id).run();
    return c.json({ code: 1, msg: 'Topic deleted successfully' });
  } catch (error) {
    logger.admin.error('Delete topic error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to delete topic' }, 500);
  }
});

/**
 * GET /admin/topic/:id/items
 * 获取专题视频列表（支持动态数据源）
 */
topics.get('/admin/topic/:id/items', async (c) => {
  try {
    const topicId = c.req.param('id');
    const limit = parseInt(c.req.query('limit') || '50');
    
    // 获取专题配置
    const topic = await c.env.DB.prepare(`
      SELECT data_source_type, data_source_config FROM topics WHERE id = ?
    `).bind(topicId).first();
    
    const sourceType = (topic?.data_source_type as string) || 'manual';
    const sourceConfig = topic?.data_source_config 
      ? JSON.parse(topic.data_source_config as string) 
      : {};
    
    let videos: TopicVideoRow[] = [];
    
    switch (sourceType) {
      case 'actor':
        // 按演员搜索
        videos = await getVideosByActor(c.env, sourceConfig.actor_name, limit);
        break;
        
      case 'keyword':
        // 按关键词搜索
        videos = await getVideosByKeyword(c.env, sourceConfig.keyword, limit);
        break;
        
      case 'company':
        // 按制作公司/标签搜索
        videos = await getVideosByCompany(c.env, sourceConfig.company, limit);
        break;
        
      case 'filter':
        // 按条件筛选
        videos = await getVideosByFilter(c.env, sourceConfig, limit);
        break;
        
      case 'manual':
      default:
        // 手动选择的视频
        const result = await c.env.DB.prepare(`
          SELECT ti.vod_id, ti.sort_order, v.vod_name, v.vod_pic, v.vod_score, v.vod_year
          FROM topic_items ti
          LEFT JOIN vod_cache v ON ti.vod_id = v.vod_id
          WHERE ti.topic_id = ? 
          ORDER BY ti.sort_order ASC
          LIMIT ?
        `).bind(topicId, limit).all();
        videos = (result.results || []) as TopicVideoRow[];
        break;
    }
    
    return c.json({ 
      code: 1, 
      msg: 'success', 
      data: {
        list: videos,
        source_type: sourceType,
        total: videos.length,
      }
    });
  } catch (error) {
    logger.admin.error('Get topic items error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get topic items' }, 500);
  }
});

/**
 * 按演员搜索视频
 */
async function getVideosByActor(env: Bindings, actorName: string, limit: number): Promise<TopicVideoRow[]> {
  if (!actorName) return [];
  
  try {
    // 先找到演员ID
    const actor = await env.DB.prepare(`
      SELECT id FROM actors WHERE name LIKE ? LIMIT 1
    `).bind(`%${actorName}%`).first() as { id: number } | null;
    
    if (!actor) {
      // 没找到演员，直接搜索视频的演员字段
      const result = await env.DB.prepare(`
        SELECT vod_id, vod_name, vod_pic, vod_score, vod_year
        FROM vod_cache 
        WHERE is_valid = 1 AND vod_actor LIKE ?
        ORDER BY vod_year DESC, vod_score DESC
        LIMIT ?
      `).bind(`%${actorName}%`, limit).all();
      return (result.results || []) as TopicVideoRow[];
    }
    
    // 通过关联表查找
    const result = await env.DB.prepare(`
      SELECT v.vod_id, v.vod_name, v.vod_pic, v.vod_score, v.vod_year
      FROM vod_actor_relation r
      JOIN vod_cache v ON r.vod_id = v.vod_id
      WHERE r.actor_id = ? AND v.is_valid = 1
      ORDER BY v.vod_year DESC, v.vod_score DESC
      LIMIT ?
    `).bind(actor.id, limit).all();
    
    return (result.results || []) as TopicVideoRow[];
  } catch (error) {
    logger.admin.error('getVideosByActor error', { error: error instanceof Error ? error.message : 'Unknown' });
    return [];
  }
}

/**
 * 按关键词搜索视频
 */
async function getVideosByKeyword(env: Bindings, keyword: string, limit: number): Promise<TopicVideoRow[]> {
  if (!keyword) return [];
  
  try {
    const result = await env.DB.prepare(`
      SELECT vod_id, vod_name, vod_pic, vod_score, vod_year
      FROM vod_cache 
      WHERE is_valid = 1 AND (vod_name LIKE ? OR vod_blurb LIKE ? OR vod_content LIKE ?)
      ORDER BY vod_score DESC, vod_year DESC
      LIMIT ?
    `).bind(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, limit).all();
    
    return (result.results || []) as TopicVideoRow[];
  } catch (error) {
    logger.admin.error('getVideosByKeyword error', { error: error instanceof Error ? error.message : 'Unknown' });
    return [];
  }
}

/**
 * 按制作公司/标签搜索视频
 */
async function getVideosByCompany(env: Bindings, company: string, limit: number): Promise<TopicVideoRow[]> {
  if (!company) return [];
  
  try {
    // 搜索 vod_tag（标签）或 vod_content（简介中可能包含公司名）
    const result = await env.DB.prepare(`
      SELECT vod_id, vod_name, vod_pic, vod_score, vod_year
      FROM vod_cache 
      WHERE is_valid = 1 AND (vod_tag LIKE ? OR vod_content LIKE ? OR vod_blurb LIKE ?)
      ORDER BY vod_score DESC, vod_year DESC
      LIMIT ?
    `).bind(`%${company}%`, `%${company}%`, `%${company}%`, limit).all();
    
    return (result.results || []) as TopicVideoRow[];
  } catch (error) {
    logger.admin.error('getVideosByCompany error', { error: error instanceof Error ? error.message : 'Unknown' });
    return [];
  }
}

/** 筛选配置类型 */
interface FilterConfig {
  type_id?: number;
  year?: string;
  year_from?: string;
  year_to?: string;
  area?: string;
  min_score?: number;
  order_by?: string;
}

// ORDER BY 白名单，防止SQL注入
const ALLOWED_ORDER_BY: Record<string, string> = {
  'vod_score DESC': 'vod_score DESC',
  'vod_score ASC': 'vod_score ASC',
  'vod_year DESC': 'vod_year DESC',
  'vod_year ASC': 'vod_year ASC',
  'vod_hits DESC': 'vod_hits DESC',
  'vod_hits_day DESC': 'vod_hits_day DESC',
  'vod_name ASC': 'vod_name ASC',
  'vod_score DESC, vod_year DESC': 'vod_score DESC, vod_year DESC',
};

/**
 * 按条件筛选视频
 */
async function getVideosByFilter(env: Bindings, config: FilterConfig, limit: number): Promise<TopicVideoRow[]> {
  try {
    let sql = `SELECT vod_id, vod_name, vod_pic, vod_score, vod_year FROM vod_cache WHERE is_valid = 1`;
    const params: DbQueryParam[] = [];
    
    // 分类筛选
    if (config.type_id) {
      sql += ` AND type_id = ?`;
      params.push(config.type_id);
    }
    
    // 年份筛选
    if (config.year) {
      sql += ` AND vod_year = ?`;
      params.push(config.year);
    }
    
    // 年份范围
    if (config.year_from) {
      sql += ` AND vod_year >= ?`;
      params.push(config.year_from);
    }
    if (config.year_to) {
      sql += ` AND vod_year <= ?`;
      params.push(config.year_to);
    }
    
    // 地区筛选
    if (config.area) {
      sql += ` AND vod_area LIKE ?`;
      params.push(`%${config.area}%`);
    }
    
    // 评分筛选
    if (config.min_score) {
      sql += ` AND vod_score >= ?`;
      params.push(config.min_score);
    }
    
    // 排序（使用白名单验证，防止SQL注入）
    const requestedOrder = config.order_by || 'vod_score DESC, vod_year DESC';
    const orderBy = ALLOWED_ORDER_BY[requestedOrder] || 'vod_score DESC, vod_year DESC';
    sql += ` ORDER BY ${orderBy} LIMIT ?`;
    params.push(limit);
    
    const result = await env.DB.prepare(sql).bind(...params).all();
    return (result.results || []) as TopicVideoRow[];
  } catch (error) {
    logger.admin.error('getVideosByFilter error', { error: error instanceof Error ? error.message : 'Unknown' });
    return [];
  }
}

/**
 * POST /admin/topic/items
 */
topics.post('/admin/topic/items', async (c) => {
  try {
    const body = await c.req.json();
    const { topic_id, vod_ids } = body;

    if (!topic_id || !vod_ids || !Array.isArray(vod_ids)) {
      return c.json({ code: 0, msg: 'Invalid request body' }, 400);
    }

    const maxSortResult = await c.env.DB.prepare(`
      SELECT MAX(sort_order) as max_sort FROM topic_items WHERE topic_id = ?
    `).bind(topic_id).first();

    let currentSort = (maxSortResult?.max_sort as number) || 0;

    for (const vodId of vod_ids) {
      currentSort++;
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO topic_items (topic_id, vod_id, vod_name, vod_pic, sort_order) VALUES (?, ?, NULL, NULL, ?)
      `).bind(topic_id, vodId, currentSort).run();
    }

    return c.json({ code: 1, msg: 'Topic items added successfully' });
  } catch (error) {
    logger.admin.error('Add topic items error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to add topic items' }, 500);
  }
});

/**
 * DELETE /admin/topic/:topicId/items/:vodId
 */
topics.delete('/admin/topic/:topicId/items/:vodId', async (c) => {
  try {
    const topicId = c.req.param('topicId');
    const vodId = c.req.param('vodId');
    await c.env.DB.prepare('DELETE FROM topic_items WHERE topic_id = ? AND vod_id = ?').bind(topicId, vodId).run();
    return c.json({ code: 1, msg: 'Topic item deleted successfully' });
  } catch (error) {
    logger.admin.error('Delete topic item error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to delete topic item' }, 500);
  }
});

/**
 * PUT /admin/topic/:id/items/order
 */
topics.put('/admin/topic/:id/items/order', async (c) => {
  try {
    const topicId = c.req.param('id');
    const body = await c.req.json();
    const { vod_ids } = body;

    if (!vod_ids || !Array.isArray(vod_ids)) {
      return c.json({ code: 0, msg: 'vod_ids must be an array' }, 400);
    }

    for (let i = 0; i < vod_ids.length; i++) {
      await c.env.DB.prepare(`
        UPDATE topic_items SET sort_order = ? WHERE topic_id = ? AND vod_id = ?
      `).bind(i, topicId, vod_ids[i]).run();
    }

    return c.json({ code: 1, msg: 'Topic items order updated successfully' });
  } catch (error) {
    logger.admin.error('Update topic items order error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to update topic items order' }, 500);
  }
});

/**
 * PATCH /admin/topic/:id/toggle
 */
topics.patch('/admin/topic/:id/toggle', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare(`UPDATE topics SET is_active = NOT COALESCE(is_active, 1) WHERE id = ?`).bind(id).run();
    return c.json({ code: 1, msg: 'success' });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to toggle topic' }, 500);
  }
});

/**
 * PUT /admin/topics/order
 */
topics.put('/admin/topics/order', async (c) => {
  try {
    const body = await c.req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids)) return c.json({ code: 0, msg: 'ids is required' }, 400);

    for (let i = 0; i < ids.length; i++) {
      await c.env.DB.prepare('UPDATE topics SET sort_order = ? WHERE id = ?').bind(i, ids[i]).run();
    }

    return c.json({ code: 1, msg: 'success' });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to update order' }, 500);
  }
});

/**
 * GET /admin/topics/stats
 */
topics.get('/admin/topics/stats', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT t.id, t.title, (SELECT COUNT(*) FROM topic_items WHERE topic_id = t.id) as video_count
      FROM topics t ORDER BY t.id
    `).all();
    return c.json({ code: 1, msg: 'success', data: result.results });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to get stats' }, 500);
  }
});

export default topics;
