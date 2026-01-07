/**
 * Collect API V2
 * 采集管理接口 V2 - 支持任务管理、实时进度、资源站健康检测
 */

import { Hono } from 'hono';
import { adminGuard } from '../middleware/admin_guard';
import { logger } from '../utils/logger';
import {
  createTask,
  getTask,
  getTasks,
  cancelTask,
  pauseTask,
  resumeTask,
  cleanupOldTasks,
} from '../services/task_manager';
import {
  executeTask,
  runIncrementalCollect,
  runFullCollect,
  runCategoryCollect,
  runSourceCollect,
} from '../services/collector_v2';
import { getTaskLogs, cleanupOldLogs } from '../services/collect_logger';
import {
  checkSourceHealth,
  getAllSourceHealth,
  checkAllSourcesHealth,
} from '../services/source_health';

type Bindings = {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
  ADMIN_SECRET_KEY: string;
};

const collectV2 = new Hono<{ Bindings: Bindings }>();

// 所有接口需要管理员权限
collectV2.use('/admin/collect/v2/*', adminGuard);

// ============================================
// 任务管理接口
// ============================================

/**
 * POST /admin/collect/v2/task
 * 创建采集任务
 */
collectV2.post('/admin/collect/v2/task', async (c) => {
  try {
    const body = await c.req.json();
    const { type, config } = body;
    
    if (!type || !['full', 'incremental', 'category', 'source', 'shorts'].includes(type)) {
      return c.json({ code: 0, msg: 'Invalid task type' }, 400);
    }
    
    const task = await createTask(c.env, { type, config });
    
    // 异步执行任务
    c.executionCtx.waitUntil(executeTask(c.env, task.id));
    
    return c.json({
      code: 1,
      msg: 'Task created and started',
      data: { taskId: task.id },
    });
  } catch (error) {
    logger.collectorV2.error('Create task error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: 'Failed to create task',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /admin/collect/v2/task/:id
 * 获取任务详情
 */
collectV2.get('/admin/collect/v2/task/:id', async (c) => {
  try {
    const taskId = c.req.param('id');
    const task = await getTask(c.env, taskId);
    
    if (!task) {
      return c.json({ code: 0, msg: 'Task not found' }, 404);
    }
    
    return c.json({
      code: 1,
      msg: 'success',
      data: task,
    });
  } catch (error) {
    logger.collectorV2.error('Get task error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: 'Failed to get task',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /admin/collect/v2/task/:id/progress
 * 获取任务实时进度
 */
collectV2.get('/admin/collect/v2/task/:id/progress', async (c) => {
  try {
    const taskId = c.req.param('id');
    const task = await getTask(c.env, taskId);
    
    if (!task) {
      return c.json({ code: 0, msg: 'Task not found' }, 404);
    }
    
    return c.json({
      code: 1,
      msg: 'success',
      data: {
        status: task.status,
        progress: task.progress,
        startedAt: task.startedAt,
        lastError: task.lastError,
      },
    });
  } catch (error) {
    return c.json({
      code: 0,
      msg: 'Failed to get progress',
    }, 500);
  }
});

/**
 * POST /admin/collect/v2/task/:id/cancel
 * 取消任务
 */
collectV2.post('/admin/collect/v2/task/:id/cancel', async (c) => {
  try {
    const taskId = c.req.param('id');
    const success = await cancelTask(c.env, taskId);
    
    if (!success) {
      return c.json({ code: 0, msg: 'Cannot cancel this task' }, 400);
    }
    
    return c.json({ code: 1, msg: 'Task cancelled' });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to cancel task' }, 500);
  }
});

/**
 * POST /admin/collect/v2/task/:id/pause
 * 暂停任务
 */
collectV2.post('/admin/collect/v2/task/:id/pause', async (c) => {
  try {
    const taskId = c.req.param('id');
    const success = await pauseTask(c.env, taskId);
    
    if (!success) {
      return c.json({ code: 0, msg: 'Cannot pause this task' }, 400);
    }
    
    return c.json({ code: 1, msg: 'Task paused' });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to pause task' }, 500);
  }
});

/**
 * POST /admin/collect/v2/task/:id/resume
 * 恢复任务
 */
collectV2.post('/admin/collect/v2/task/:id/resume', async (c) => {
  try {
    const taskId = c.req.param('id');
    const success = await resumeTask(c.env, taskId);
    
    if (!success) {
      return c.json({ code: 0, msg: 'Cannot resume this task' }, 400);
    }
    
    // 重新执行任务
    const task = await getTask(c.env, taskId);
    if (task) {
      c.executionCtx.waitUntil(executeTask(c.env, taskId));
    }
    
    return c.json({ code: 1, msg: 'Task resumed' });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to resume task' }, 500);
  }
});

/**
 * GET /admin/collect/v2/tasks
 * 获取任务列表
 */
collectV2.get('/admin/collect/v2/tasks', async (c) => {
  try {
    const status = c.req.query('status');
    const type = c.req.query('type');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    
    const result = await getTasks(c.env, { status, type, page, limit });
    
    return c.json({
      code: 1,
      msg: 'success',
      page,
      total: result.total,
      pagecount: Math.ceil(result.total / limit),
      list: result.tasks,
    });
  } catch (error) {
    logger.collectorV2.error('Get tasks error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: 'Failed to get tasks',
    }, 500);
  }
});

/**
 * GET /admin/collect/v2/task/:id/logs
 * 获取任务日志
 */
collectV2.get('/admin/collect/v2/task/:id/logs', async (c) => {
  try {
    const taskId = c.req.param('id');
    const level = c.req.query('level') as 'info' | 'warn' | 'error' | 'debug' | undefined;
    const action = c.req.query('action');
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');
    
    const result = await getTaskLogs(c.env, taskId, { level, action, limit, offset });
    
    return c.json({
      code: 1,
      msg: 'success',
      total: result.total,
      list: result.logs,
    });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to get logs' }, 500);
  }
});

// ============================================
// 快捷采集接口
// ============================================

/**
 * POST /admin/collect/v2/quick/incremental
 * 快速增量采集
 */
collectV2.post('/admin/collect/v2/quick/incremental', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { maxPages, maxVideos, sync } = body;
    
    // 创建任务
    const task = await createTask(c.env, {
      type: 'incremental',
      config: {
        pageEnd: maxPages || 5,
        maxVideos,
      },
    });
    
    // 如果是同步模式或本地开发，直接执行
    if (sync) {
      await executeTask(c.env, task.id);
      const finalTask = await getTask(c.env, task.id);
      return c.json({
        code: 1,
        msg: 'Incremental collect completed',
        data: { 
          taskId: task.id,
          status: finalTask?.status,
          progress: finalTask?.progress,
        },
      });
    }
    
    // 异步执行
    c.executionCtx.waitUntil(executeTask(c.env, task.id));
    
    return c.json({
      code: 1,
      msg: 'Incremental collect started',
      data: { taskId: task.id },
    });
  } catch (error) {
    logger.collectorV2.error('Quick incremental error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: 'Failed to start collect' }, 500);
  }
});

/**
 * POST /admin/collect/v2/quick/full
 * 快速全量采集
 * 
 * 支持参数：
 * - maxPages: 最大采集页数（-1 表示全部）
 * - categoryIds: 指定分类ID数组（可选，不传则采集所有分类）
 * - sourceIds: 指定资源站ID数组（可选，不传则采集所有资源站）
 * - sync: 是否同步执行
 */
collectV2.post('/admin/collect/v2/quick/full', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { sync, maxPages, categoryIds, sourceIds } = body;
    
    const task = await createTask(c.env, {
      type: 'full',
      config: {
        pageEnd: maxPages || -1,
        categoryIds: categoryIds && categoryIds.length > 0 ? categoryIds : undefined,
        sourceIds: sourceIds && sourceIds.length > 0 ? sourceIds : undefined,
      },
    });
    
    // 使用 waitUntil 确保任务在后台执行
    if (sync) {
      await executeTask(c.env, task.id);
    } else {
      c.executionCtx.waitUntil(executeTask(c.env, task.id));
    }
    
    return c.json({
      code: 1,
      msg: 'Full collect started',
      data: { taskId: task.id },
    });
  } catch (error) {
    logger.collectorV2.error('Quick full collect error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: 'Failed to start collect' }, 500);
  }
});

/**
 * POST /admin/collect/v2/quick/category/:id
 * 快速分类采集
 */
collectV2.post('/admin/collect/v2/quick/category/:id', async (c) => {
  try {
    const categoryId = parseInt(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));
    const { maxPages, sync } = body;
    
    const task = await createTask(c.env, {
      type: 'category',
      config: {
        categoryIds: [categoryId],
        pageEnd: maxPages || 20,
      },
    });
    
    // 使用 waitUntil 确保任务在后台执行
    if (sync) {
      await executeTask(c.env, task.id);
    } else {
      c.executionCtx.waitUntil(executeTask(c.env, task.id));
    }
    
    return c.json({
      code: 1,
      msg: 'Category collect started',
      data: { taskId: task.id },
    });
  } catch (error) {
    logger.collectorV2.error('Quick category collect error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: 'Failed to start collect' }, 500);
  }
});

/**
 * POST /admin/collect/v2/quick/source/:id
 * 快速指定资源站采集
 */
collectV2.post('/admin/collect/v2/quick/source/:id', async (c) => {
  try {
    const sourceId = parseInt(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));
    const { maxPages } = body;
    
    const taskId = await runSourceCollect(c.env, sourceId, { maxPages });
    
    return c.json({
      code: 1,
      msg: 'Source collect started',
      data: { taskId },
    });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to start collect' }, 500);
  }
});

// ============================================
// 资源站健康检测接口
// ============================================

/**
 * GET /admin/collect/v2/sources/health
 * 获取所有资源站健康状态
 */
collectV2.get('/admin/collect/v2/sources/health', async (c) => {
  try {
    const healthList = await getAllSourceHealth(c.env);
    
    return c.json({
      code: 1,
      msg: 'success',
      list: healthList,
    });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to get health status' }, 500);
  }
});

/**
 * POST /admin/collect/v2/sources/:id/health-check
 * 检测单个资源站健康状态
 */
collectV2.post('/admin/collect/v2/sources/:id/health-check', async (c) => {
  try {
    const sourceId = parseInt(c.req.param('id'));
    
    // 获取资源站信息
    const source = await c.env.DB.prepare(`
      SELECT id, name, api_url FROM video_sources WHERE id = ?
    `).bind(sourceId).first();
    
    if (!source) {
      return c.json({ code: 0, msg: 'Source not found' }, 404);
    }
    
    const result = await checkSourceHealth(
      c.env,
      sourceId,
      source.api_url as string,
      source.name as string
    );
    
    return c.json({
      code: 1,
      msg: 'Health check completed',
      data: result,
    });
  } catch (error) {
    return c.json({ code: 0, msg: 'Health check failed' }, 500);
  }
});

/**
 * POST /admin/collect/v2/sources/health-check-all
 * 检测所有资源站健康状态
 */
collectV2.post('/admin/collect/v2/sources/health-check-all', async (c) => {
  try {
    // 异步执行
    c.executionCtx.waitUntil(checkAllSourcesHealth(c.env));
    
    return c.json({
      code: 1,
      msg: 'Health check started for all sources',
    });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to start health check' }, 500);
  }
});

// ============================================
// 统计接口
// ============================================

/**
 * GET /admin/collect/v2/stats
 * 获取采集统计
 */
collectV2.get('/admin/collect/v2/stats', async (c) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;
    const oneWeekAgo = now - 604800;
    
    // 总视频数
    const totalResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM vod_cache
    `).first();
    
    // 有效视频数
    const validResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM vod_cache WHERE is_valid = 1
    `).first();
    
    // 今日新增
    const todayNewResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM vod_cache WHERE created_at > ?
    `).bind(oneDayAgo).first();
    
    // 本周新增
    const weekNewResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM vod_cache WHERE created_at > ?
    `).bind(oneWeekAgo).first();
    
    // 运行中的任务
    const runningTaskResult = await c.env.DB.prepare(`
      SELECT * FROM collect_tasks_v2 WHERE status = 'running' LIMIT 1
    `).first();
    
    // 最近任务
    const recentTasksResult = await c.env.DB.prepare(`
      SELECT * FROM collect_tasks_v2 ORDER BY created_at DESC LIMIT 5
    `).all();
    
    // 资源站健康状态汇总
    const healthSummary = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'healthy' THEN 1 ELSE 0 END) as healthy,
        SUM(CASE WHEN status = 'slow' THEN 1 ELSE 0 END) as slow,
        SUM(CASE WHEN status IN ('error', 'timeout') THEN 1 ELSE 0 END) as error
      FROM source_health
    `).first();
    
    return c.json({
      code: 1,
      msg: 'success',
      data: {
        videos: {
          total: totalResult?.count || 0,
          valid: validResult?.count || 0,
          todayNew: todayNewResult?.count || 0,
          weekNew: weekNewResult?.count || 0,
        },
        tasks: {
          running: runningTaskResult ? {
            id: runningTaskResult.id,
            type: runningTaskResult.task_type,
            progress: {
              currentSource: runningTaskResult.current_source,
              currentPage: runningTaskResult.current_page,
              totalPages: runningTaskResult.total_pages,
              newCount: runningTaskResult.new_count,
              updateCount: runningTaskResult.update_count,
            },
          } : null,
          recent: recentTasksResult.results,
        },
        sources: {
          total: healthSummary?.total || 0,
          healthy: healthSummary?.healthy || 0,
          slow: healthSummary?.slow || 0,
          error: healthSummary?.error || 0,
        },
      },
    });
  } catch (error) {
    logger.collectorV2.error('Get stats error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: 'Failed to get stats' }, 500);
  }
});

// ============================================
// 维护接口
// ============================================

/**
 * POST /admin/collect/v2/cleanup
 * 清理旧数据
 */
collectV2.post('/admin/collect/v2/cleanup', async (c) => {
  try {
    const tasksDeleted = await cleanupOldTasks(c.env);
    const logsDeleted = await cleanupOldLogs(c.env);
    
    return c.json({
      code: 1,
      msg: 'Cleanup completed',
      data: {
        tasksDeleted,
        logsDeleted,
      },
    });
  } catch (error) {
    return c.json({ code: 0, msg: 'Cleanup failed' }, 500);
  }
});

/**
 * POST /admin/collect/v2/migrate
 * 执行数据库迁移（创建V2所需的表）
 */
collectV2.post('/admin/collect/v2/migrate', async (c) => {
  try {
    const { migrateToV2 } = await import('../scripts/migrate_v2');
    const result = await migrateToV2(c.env);
    
    return c.json({
      code: result.success ? 1 : 0,
      msg: result.success ? 'Migration completed' : 'Migration completed with errors',
      data: result,
    });
  } catch (error) {
    logger.collectorV2.error('Migration error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: 'Migration failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /admin/collect/v2/categories
 * 获取可采集的分类列表
 */
collectV2.get('/admin/collect/v2/categories', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT * FROM video_categories WHERE is_active = 1 ORDER BY sort_order
    `).all();
    
    // 如果表不存在，返回默认分类
    if (!result.results || result.results.length === 0) {
      return c.json({
        code: 1,
        msg: 'success',
        list: [
          { id: 1, name: '电影', name_en: 'movie' },
          { id: 2, name: '电视剧', name_en: 'series' },
          { id: 3, name: '综艺', name_en: 'variety' },
          { id: 4, name: '动漫', name_en: 'anime' },
          { id: 5, name: '短剧', name_en: 'shorts' },
        ],
      });
    }
    
    return c.json({
      code: 1,
      msg: 'success',
      list: result.results,
    });
  } catch (error) {
    // 表可能不存在，返回默认分类
    return c.json({
      code: 1,
      msg: 'success',
      list: [
        { id: 1, name: '电影', name_en: 'movie' },
        { id: 2, name: '电视剧', name_en: 'series' },
        { id: 3, name: '综艺', name_en: 'variety' },
        { id: 4, name: '动漫', name_en: 'anime' },
        { id: 5, name: '短剧', name_en: 'shorts' },
      ],
    });
  }
});

export default collectV2;
