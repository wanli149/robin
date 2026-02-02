/**
 * Admin Collect API
 * 采集管理相关接口（文章、演员）
 */

import { Hono } from 'hono';
import type { Bindings } from './types';
import { logger } from '../../utils/logger';
import { generatePlaceholders } from '../../utils/sql';

const collect = new Hono<{ Bindings: Bindings }>();

/**
 * POST /admin/articles-actors/migrate
 */
collect.post('/admin/articles-actors/migrate', async (c) => {
  try {
    const { migrateArticlesActors } = await import('../../scripts/migrate_articles_actors');
    const result = await migrateArticlesActors(c.env);
    return c.json({ code: result.success ? 1 : 0, msg: result.message, data: { tables: result.tables, columns: result.columns } });
  } catch (error) {
    logger.admin.error('Articles/Actors migration error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Migration failed' }, 500);
  }
});

/**
 * POST /admin/collect/articles
 */
collect.post('/admin/collect/articles', async (c) => {
  try {
    const body = await c.req.json();
    const { apiUrl, sourceName, page, maxPages, typeId } = body;

    if (!apiUrl) return c.json({ code: 0, msg: 'apiUrl is required' }, 400);

    const { collectArticles } = await import('../../services/article_collector');
    const result = await collectArticles(c.env, apiUrl, sourceName || '未知来源', { page: page || 1, maxPages: maxPages || 10, typeId });

    return c.json({ code: 1, msg: 'success', data: result });
  } catch (error) {
    logger.admin.error('Collect articles error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Collection failed' }, 500);
  }
});

/**
 * GET /admin/articles
 */
collect.get('/admin/articles', async (c) => {
  try {
    const typeId = c.req.query('type_id') ? parseInt(c.req.query('type_id')!) : undefined;
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const keyword = c.req.query('keyword');

    const { getArticles } = await import('../../services/article_collector');
    const result = await getArticles(c.env, { typeId, page, limit, keyword });

    return c.json({ code: 1, msg: 'success', data: { list: result.list, total: result.total, page, limit } });
  } catch (error) {
    logger.admin.error('Get articles error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get articles' }, 500);
  }
});

/**
 * GET /admin/articles/:id
 */
collect.get('/admin/articles/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const { getArticleDetail } = await import('../../services/article_collector');
    const article = await getArticleDetail(c.env, id);

    if (!article) return c.json({ code: 0, msg: 'Article not found' }, 404);
    return c.json({ code: 1, msg: 'success', data: article });
  } catch (error) {
    logger.admin.error('Get article detail error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get article' }, 500);
  }
});

/**
 * DELETE /admin/articles/:id
 */
collect.delete('/admin/articles/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    await c.env.DB.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
    return c.json({ code: 1, msg: 'success' });
  } catch (error) {
    logger.admin.error('Delete article error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to delete article' }, 500);
  }
});

/**
 * GET /admin/article-categories
 */
collect.get('/admin/article-categories', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT ac.*, COALESCE(counts.article_count, 0) as article_count
      FROM article_categories ac
      LEFT JOIN (SELECT type_id, COUNT(*) as article_count FROM articles WHERE is_active = 1 GROUP BY type_id) counts ON ac.id = counts.type_id
      WHERE ac.is_active = 1 ORDER BY ac.sort_order
    `).all();
    return c.json({ code: 1, msg: 'success', data: result.results });
  } catch (error) {
    return c.json({ code: 1, msg: 'success', data: [] });
  }
});

/**
 * POST /admin/collect/actors
 */
collect.post('/admin/collect/actors', async (c) => {
  try {
    const body = await c.req.json();
    const { apiUrl, sourceName, page, maxPages } = body;

    if (!apiUrl) return c.json({ code: 0, msg: 'apiUrl is required' }, 400);

    const { collectActors } = await import('../../services/actor_collector');
    const result = await collectActors(c.env, apiUrl, sourceName || '未知来源', { page: page || 1, maxPages: maxPages || 50 });

    return c.json({ code: 1, msg: 'success', data: result });
  } catch (error) {
    logger.admin.error('Collect actors error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Collection failed' }, 500);
  }
});

/**
 * POST /admin/collect/actors/enrich
 */
collect.post('/admin/collect/actors/enrich', async (c) => {
  try {
    const body = await c.req.json();
    const { apiUrl, sourceName, limit } = body;

    if (!apiUrl) return c.json({ code: 0, msg: 'apiUrl is required' }, 400);

    const { enrichActorsFromApi } = await import('../../services/actor_collector');
    const result = await enrichActorsFromApi(c.env, apiUrl, sourceName || '未知来源', limit || 100);

    return c.json({ code: 1, msg: 'success', data: result });
  } catch (error) {
    logger.admin.error('Enrich actors error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Enrichment failed' }, 500);
  }
});

/**
 * GET /admin/actors
 */
collect.get('/admin/actors', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '50');
    const keyword = c.req.query('keyword');
    const hasAvatar = c.req.query('has_avatar');
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const params: (string | number)[] = [];

    if (keyword) { whereClause += ' AND name LIKE ?'; params.push(`%${keyword}%`); }
    if (hasAvatar === 'true') { whereClause += ' AND avatar IS NOT NULL AND avatar != ""'; }
    else if (hasAvatar === 'false') { whereClause += ' AND (avatar IS NULL OR avatar = "")'; }

    const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM actors WHERE ${whereClause}`).bind(...params).first();
    const result = await c.env.DB.prepare(`
      SELECT id, name, actor_id, avatar, name_en, sex, area, birthday, works_count, popularity, bio, updated_at
      FROM actors WHERE ${whereClause} ORDER BY popularity DESC, works_count DESC LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    return c.json({ code: 1, msg: 'success', data: { list: result.results, total: (countResult?.total as number) || 0, page, limit } });
  } catch (error) {
    logger.admin.error('Get actors error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get actors' }, 500);
  }
});

/**
 * GET /admin/actors/:id
 */
collect.get('/admin/actors/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const actor = await c.env.DB.prepare(`SELECT * FROM actors WHERE id = ?`).bind(id).first();

    if (!actor) return c.json({ code: 0, msg: 'Actor not found' }, 404);

    const works = await c.env.DB.prepare(`
      SELECT v.vod_id, v.vod_name, v.vod_pic, v.vod_year, v.vod_score, r.role_type
      FROM vod_actor_relation r JOIN vod_cache v ON r.vod_id = v.vod_id
      WHERE r.actor_id = ? AND v.is_valid = 1 ORDER BY v.vod_year DESC LIMIT 50
    `).bind(id).all();

    return c.json({ code: 1, msg: 'success', data: { ...actor, works: works.results } });
  } catch (error) {
    logger.admin.error('Get actor detail error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get actor' }, 500);
  }
});

/**
 * PUT /admin/actors/:id
 */
collect.put('/admin/actors/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { name, name_en, avatar, bio } = body;

    await c.env.DB.prepare(`
      UPDATE actors SET name = COALESCE(?, name), name_en = COALESCE(?, name_en), avatar = COALESCE(?, avatar), bio = COALESCE(?, bio) WHERE id = ?
    `).bind(name || null, name_en || null, avatar || null, bio || null, id).run();

    return c.json({ code: 1, msg: 'success' });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to update actor' }, 500);
  }
});

/**
 * DELETE /admin/actors/:id
 */
collect.delete('/admin/actors/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM vod_actor_relation WHERE actor_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM actors WHERE id = ?').bind(id).run();
    return c.json({ code: 1, msg: 'success' });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to delete actor' }, 500);
  }
});

/**
 * POST /admin/actors/merge
 */
collect.post('/admin/actors/merge', async (c) => {
  try {
    const body = await c.req.json();
    const { source_ids, target_id } = body;

    if (!source_ids || !Array.isArray(source_ids) || !target_id) {
      return c.json({ code: 0, msg: 'source_ids and target_id are required' }, 400);
    }

    // 安全地生成 placeholders
    if (!Array.isArray(source_ids) || source_ids.length === 0) {
      return c.json({ code: 0, msg: 'Invalid source IDs' }, 400);
    }
    
    // 验证所有ID都是数字
    const validIds = source_ids.filter((id: unknown) => Number.isInteger(Number(id)));
    if (validIds.length !== source_ids.length) {
      return c.json({ code: 0, msg: 'All IDs must be integers' }, 400);
    }
    
    const placeholders = generatePlaceholders(validIds.length);
    await c.env.DB.prepare(`UPDATE vod_actor_relation SET actor_id = ? WHERE actor_id IN (${placeholders})`).bind(target_id, ...validIds).run();
    await c.env.DB.prepare(`DELETE FROM actors WHERE id IN (${placeholders})`).bind(...validIds).run();

    const countResult = await c.env.DB.prepare(`SELECT COUNT(DISTINCT vod_id) as count FROM vod_actor_relation WHERE actor_id = ?`).bind(target_id).first();
    await c.env.DB.prepare(`UPDATE actors SET works_count = ? WHERE id = ?`).bind(countResult?.count || 0, target_id).run();

    return c.json({ code: 1, msg: 'success' });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to merge actors' }, 500);
  }
});

/**
 * GET /admin/collect/stats
 * 获取采集统计（视频、文章、演员）
 */
collect.get('/admin/collect/stats', async (c) => {
  try {
    // 视频统计
    const videoStats = await c.env.DB.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN is_valid = 1 THEN 1 ELSE 0 END) as valid 
      FROM vod_cache
    `).first();

    // 今日新增视频
    const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
    const todayNewResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM vod_cache WHERE created_at > ?
    `).bind(oneDayAgo).first();

    // 最近采集任务
    let lastTask = null;
    try {
      lastTask = await c.env.DB.prepare(`
        SELECT * FROM collect_tasks ORDER BY created_at DESC LIMIT 1
      `).first();
    } catch (e) {
      logger.admin.warn('Failed to get last collect task', { error: e instanceof Error ? e.message : 'Unknown' });
    }

    // 文章统计
    let articleStats: { total: number } = { total: 0 };
    try {
      const artResult = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM articles WHERE is_active = 1`).first();
      articleStats = (artResult as { total: number }) || { total: 0 };
    } catch (e) {
      logger.admin.warn('Failed to get article stats', { error: e instanceof Error ? e.message : 'Unknown' });
    }

    // 演员统计
    let actorStats: { total: number; with_avatar: number; with_works: number } = { total: 0, with_avatar: 0, with_works: 0 };
    try {
      actorStats = await c.env.DB.prepare(`
        SELECT COUNT(*) as total, 
               SUM(CASE WHEN avatar IS NOT NULL AND avatar != '' THEN 1 ELSE 0 END) as with_avatar,
               SUM(CASE WHEN works_count > 0 THEN 1 ELSE 0 END) as with_works 
        FROM actors
      `).first() || actorStats;
    } catch (e) {
      logger.admin.warn('Failed to get actor stats', { error: e instanceof Error ? e.message : 'Unknown' });
    }

    return c.json({
      code: 1, 
      msg: 'success',
      data: {
        // 前端 Dashboard 期望的格式
        total_videos: (videoStats?.total as number) || 0,
        valid_videos: (videoStats?.valid as number) || 0,
        today_new: (todayNewResult?.count as number) || 0,
        last_task: lastTask,
        // 额外的统计信息
        articles: { total: (articleStats?.total as number) || 0 },
        actors: { 
          total: (actorStats?.total as number) || 0, 
          withAvatar: (actorStats?.with_avatar as number) || 0, 
          withWorks: (actorStats?.with_works as number) || 0 
        },
      },
    });
  } catch (error) {
    logger.admin.error('Get collect stats error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get stats' }, 500);
  }
});

export default collect;
