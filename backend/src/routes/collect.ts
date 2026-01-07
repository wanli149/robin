/**
 * Collect API
 * 采集管理接口
 */

import { Hono } from 'hono';
import { adminGuard } from '../middleware/admin_guard';
import { searchVideos, runIncrementalCollect, runFullCollect, runCategoryCollect } from '../services/collector_v2';
import { batchValidateUrls, reportInvalidUrl } from '../services/url_validator';
import { fixVideoCovers } from '../scripts/fix_covers';
import { mergeDuplicateVideos } from '../scripts/merge_duplicates';
import { rebuildActorLinks } from '../scripts/rebuild_actor_links';
import { logger } from '../utils/logger';

type Bindings = {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
  ADMIN_SECRET_KEY: string;
};

const collect = new Hono<{ Bindings: Bindings }>();

// 只对 /admin/* 路径应用 Admin Guard
collect.use('/admin/*', adminGuard);

/**
 * POST /admin/collect/trigger
 * 手动触发采集任务（使用 V2 引擎）
 */
collect.post('/admin/collect/trigger', async (c) => {
  try {
    const body = await c.req.json();
    const { taskType = 'incremental', category, limit } = body;

    logger.collector.info('Manual trigger', { taskType, category, limit });

    // 使用 V2 引擎执行采集任务
    let taskId: string;
    if (taskType === 'full') {
      taskId = await runFullCollect(c.env);
    } else if (category) {
      taskId = await runCategoryCollect(c.env, parseInt(category), { maxPages: limit });
    } else {
      taskId = await runIncrementalCollect(c.env, { maxPages: limit || 5 });
    }

    return c.json({
      code: 1,
      msg: 'Collect task triggered',
      data: { taskId },
    });
  } catch (error) {
    logger.collector.error('Trigger error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to trigger collect task',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /admin/collect/tasks
 * 获取采集任务历史
 */
collect.get('/admin/collect/tasks', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = 20;
    const offset = (page - 1) * limit;

    const result = await c.env.DB.prepare(`
      SELECT *
      FROM collect_tasks
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    // 获取总数
    const countResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM collect_tasks
    `).first();

    const total = (countResult?.count as number) || 0;

    return c.json({
      code: 1,
      msg: 'success',
      page,
      total,
      pagecount: Math.ceil(total / limit),
      list: result.results,
    });
  } catch (error) {
    logger.collector.error('Get tasks error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get collect tasks',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /admin/collect/stats
 * 获取采集统计
 */
collect.get('/admin/collect/stats', async (c) => {
  try {
    // 总视频数
    const totalResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM vod_cache
    `).first();

    // 有效视频数
    const validResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM vod_cache WHERE is_valid = 1
    `).first();

    // 今日新增
    const todayResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM vod_cache
      WHERE created_at > ?
    `).bind(Math.floor(Date.now() / 1000) - 86400).first();

    // 最近任务
    const lastTaskResult = await c.env.DB.prepare(`
      SELECT *
      FROM collect_tasks
      ORDER BY created_at DESC
      LIMIT 1
    `).first();

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        total_videos: totalResult?.count || 0,
        valid_videos: validResult?.count || 0,
        today_new: todayResult?.count || 0,
        last_task: lastTaskResult,
      },
    });
  } catch (error) {
    logger.collector.error('Get stats error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get collect stats',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /admin/collect/metrics
 * 获取详细性能指标
 */
collect.get('/admin/collect/metrics', async (c) => {
  try {
    const { getCollectorMetrics, generateReport, checkHealth } = await import('../scripts/monitor_collector');
    
    const metrics = await getCollectorMetrics(c.env);
    const health = checkHealth(metrics);
    const report = generateReport(metrics);
    
    return c.json({
      code: 1,
      msg: 'success',
      data: {
        metrics,
        health,
        report,
      },
    });
  } catch (error) {
    logger.collector.error('Get metrics error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get metrics',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /admin/collect/migrate
 * 合并重复视频（将多源视频合并为单条记录）
 */
collect.post('/admin/collect/migrate', async (c) => {
  try {
    logger.collector.info('Starting to merge duplicate videos');

    // 异步执行合并任务
    c.executionCtx.waitUntil(
      mergeDuplicateVideos(c.env)
    );

    return c.json({
      code: 1,
      msg: 'Merge task triggered. This may take a few minutes.',
    });
  } catch (error) {
    logger.collector.error('Merge error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to trigger merge',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /admin/collect/rebuild-actors
 * 重建演员关联
 */
collect.post('/admin/collect/rebuild-actors', async (c) => {
  try {
    const body = await c.req.json();
    const { limit = 1000 } = body;

    logger.collector.info('Rebuilding actor links');

    // 异步执行重建任务
    c.executionCtx.waitUntil(
      rebuildActorLinks(c.env, limit)
    );

    return c.json({
      code: 1,
      msg: 'Actor rebuild task triggered.',
    });
  } catch (error) {
    logger.collector.error('Rebuild actors error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to trigger actor rebuild',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /admin/collect/fix-covers
 * 修复视频封面
 */
collect.post('/admin/collect/fix-covers', async (c) => {
  try {
    const body = await c.req.json();
    const { limit = 100 } = body;

    logger.collector.info('Fixing covers', { limit });

    // 异步执行修复任务
    c.executionCtx.waitUntil(
      fixVideoCovers(c.env, limit)
    );

    return c.json({
      code: 1,
      msg: 'Cover fix task triggered',
    });
  } catch (error) {
    logger.collector.error('Fix covers error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to trigger cover fix',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /admin/collect/validate
 * 手动触发URL检测
 */
collect.post('/admin/collect/validate', async (c) => {
  try {
    const body = await c.req.json();
    const { limit = 100 } = body;

    // 异步执行检测任务
    c.executionCtx.waitUntil(
      batchValidateUrls(c.env, limit)
    );

    return c.json({
      code: 1,
      msg: 'Validation task triggered',
    });
  } catch (error) {
    logger.collector.error('Validate error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to trigger validation',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /admin/collect/invalid
 * 获取失效视频列表
 */
collect.get('/admin/collect/invalid', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT vod_id, vod_name, updated_at
      FROM vod_cache
      WHERE is_valid = 0
      ORDER BY updated_at DESC
      LIMIT 100
    `).all();

    return c.json({
      code: 1,
      msg: 'success',
      list: result.results,
    });
  } catch (error) {
    logger.collector.error('Get invalid error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get invalid videos',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/report_invalid
 * 用户反馈播放地址失效（公开接口）
 */
collect.post('/api/report_invalid', async (c) => {
  try {
    const body = await c.req.json();
    const { vod_id, vod_name, play_url, error_type } = body;

    if (!vod_id || !vod_name || !play_url) {
      return c.json(
        {
          code: 0,
          msg: 'Missing required parameters',
        },
        400
      );
    }

    await reportInvalidUrl(c.env, vod_id, vod_name, play_url, error_type);

    return c.json({
      code: 1,
      msg: 'Report submitted successfully',
    });
  } catch (error) {
    logger.collector.error('Report invalid error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to submit report',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/search_cache
 * 快速搜索（使用FTS5）
 */
collect.get('/api/search_cache', async (c) => {
  try {
    const keyword = c.req.query('wd');
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

    const results = await searchVideos(c.env, keyword, limit);

    return c.json({
      code: 1,
      msg: 'success',
      keyword,
      total: results.length,
      list: results,
    });
  } catch (error) {
    logger.collector.error('Search error', { error: error instanceof Error ? error.message : String(error) });
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

export default collect;
