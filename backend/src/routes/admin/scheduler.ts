/**
 * Admin API - 定时任务管理
 * 支持查看、编辑、添加、删除定时任务
 */

import { Hono } from 'hono';
import type { Bindings } from './types';
import type { SchedulerTaskRow, SchedulerHistoryRow, TaskExecutionParams, HotSearchStatsRow, SystemConfigRow, HomeTabRow } from '../../types/database';
import { logger } from '../../utils/logger';
import { CACHE_CONFIG } from '../../config';

const scheduler = new Hono<{ Bindings: Bindings }>();

// 内置任务定义（默认配置）
const BUILTIN_TASKS = [
  {
    id: 'hourly_warmup',
    name: '缓存预热',
    description: '预热热搜、跑马灯、tabs、排行榜等缓存',
    cron: '0 * * * *',
    category: 'cache',
    task_type: 'warmup',
  },
  {
    id: 'hourly_collect',
    name: '小批量增量采集',
    description: '每小时采集最新视频',
    cron: '0 * * * *',
    category: 'collect',
    task_type: 'collect_incremental',
    task_params: { maxPages: 3, maxVideos: 100 },
  },
  {
    id: 'daily_collect',
    name: '大批量增量采集',
    description: '每天采集最新视频（大批量）',
    cron: '0 2 * * *',
    category: 'collect',
    task_type: 'collect_incremental',
    task_params: { maxPages: 10, maxVideos: 500 },
  },
  {
    id: 'daily_validate',
    name: 'URL有效性检测',
    description: '验证播放地址是否有效',
    cron: '0 */2 * * *',
    category: 'maintenance',
    task_type: 'validate_urls',
    task_params: { limit: 100 },
  },
  {
    id: 'daily_health',
    name: '资源站健康检测',
    description: '检测所有资源站的可用性',
    cron: '0 2 * * *',
    category: 'maintenance',
    task_type: 'health_check_sources',
  },
  {
    id: 'daily_cleanup',
    name: '日志清理',
    description: '清理30天前的访问日志',
    cron: '0 2 * * *',
    category: 'maintenance',
    task_type: 'cleanup_logs',
    task_params: { days: 30 },
  },
  {
    id: 'weekly_full_collect',
    name: '全量采集',
    description: '每周执行全量采集',
    cron: '0 3 * * 0',
    category: 'collect',
    task_type: 'collect_full',
  },
  {
    id: 'weekly_merge',
    name: '合并重复视频',
    description: '合并数据库中的重复视频记录',
    cron: '0 3 * * 0',
    category: 'maintenance',
    task_type: 'merge_duplicates',
  },
  {
    id: 'weekly_cleanup',
    name: '清理失效视频',
    description: '删除30天未更新且失效的视频',
    cron: '0 3 * * 0',
    category: 'maintenance',
    task_type: 'cleanup_invalid',
    task_params: { days: 30 },
  },
  {
    id: 'weekly_reindex',
    name: '重建搜索索引',
    description: '重建全文搜索索引',
    cron: '0 3 * * 0',
    category: 'maintenance',
    task_type: 'rebuild_index',
  },
  {
    id: 'health_check',
    name: '系统健康检查',
    description: '检查系统健康状态，异常时发送钉钉告警',
    cron: '0 */6 * * *',
    category: 'monitor',
    task_type: 'system_health',
  },
];

// 任务类型选项（供前端选择）
const TASK_TYPES = [
  { value: 'warmup', label: '缓存预热', category: 'cache' },
  { value: 'collect_incremental', label: '增量采集', category: 'collect' },
  { value: 'collect_full', label: '全量采集', category: 'collect' },
  { value: 'collect_category', label: '分类采集', category: 'collect' },
  { value: 'validate_urls', label: 'URL验证', category: 'maintenance' },
  { value: 'health_check_sources', label: '资源站健康检测', category: 'maintenance' },
  { value: 'cleanup_logs', label: '日志清理', category: 'maintenance' },
  { value: 'cleanup_invalid', label: '清理失效视频', category: 'maintenance' },
  { value: 'merge_duplicates', label: '合并重复', category: 'maintenance' },
  { value: 'rebuild_index', label: '重建索引', category: 'maintenance' },
  { value: 'system_health', label: '系统健康检查', category: 'monitor' },
];

/**
 * 初始化内置任务到数据库
 */
async function initBuiltinTasks(env: Bindings): Promise<void> {
  for (const task of BUILTIN_TASKS) {
    const existing = await env.DB.prepare(
      'SELECT id FROM scheduler_tasks WHERE id = ?'
    ).bind(task.id).first();
    
    if (!existing) {
      await env.DB.prepare(`
        INSERT INTO scheduler_tasks (id, name, description, cron, category, enabled, is_builtin, task_type, task_params)
        VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)
      `).bind(
        task.id,
        task.name,
        task.description,
        task.cron,
        task.category,
        task.task_type,
        task.task_params ? JSON.stringify(task.task_params) : null
      ).run();
    }
  }
}

/**
 * 获取任务类型选项
 */
scheduler.get('/admin/scheduler/task-types', async (c) => {
  return c.json({ code: 1, data: { types: TASK_TYPES } });
});

/**
 * 获取定时任务列表
 */
scheduler.get('/admin/scheduler/tasks', async (c) => {
  const env = c.env;
  
  try {
    // 确保内置任务已初始化
    await initBuiltinTasks(env);
    
    // 获取所有任务
    const tasksResult = await env.DB.prepare(`
      SELECT id, name, description, cron, category, enabled, is_builtin, task_type, task_params, created_at, updated_at
      FROM scheduler_tasks
      ORDER BY is_builtin DESC, category, created_at
    `).all();
    
    // 获取最近执行记录
    const historyResult = await env.DB.prepare(`
      SELECT task_id, MAX(executed_at) as last_run, 
             (SELECT status FROM scheduler_history h2 WHERE h2.task_id = scheduler_history.task_id ORDER BY executed_at DESC LIMIT 1) as last_status
      FROM scheduler_history 
      GROUP BY task_id
    `).all();
    
    const historyMap = new Map<string, { lastRun: string; lastStatus: string }>();
    for (const row of historyResult.results as Array<{ task_id: string; last_run: string; last_status: string }>) {
      historyMap.set(row.task_id, {
        lastRun: row.last_run,
        lastStatus: row.last_status,
      });
    }
    
    // 组装任务列表
    const tasks = (tasksResult.results as SchedulerTaskRow[]).map(task => {
      const history = historyMap.get(task.id);
      return {
        ...task,
        enabled: task.enabled === 1,
        is_builtin: task.is_builtin === 1,
        task_params: task.task_params ? JSON.parse(task.task_params) : null,
        cronDescription: parseCronDescription(task.cron),
        lastRun: history?.lastRun || null,
        lastStatus: history?.lastStatus || null,
      };
    });
    
    return c.json({ code: 1, data: { tasks } });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.scheduler.error('Get tasks error', { error: errorMessage });
    return c.json({ code: 0, msg: errorMessage });
  }
});

/**
 * 创建新任务
 */
scheduler.post('/admin/scheduler/tasks', async (c) => {
  const env = c.env;
  const body = await c.req.json();
  
  try {
    const { name, description, cron, category, task_type, task_params } = body;
    
    if (!name || !cron || !task_type) {
      return c.json({ code: 0, msg: '任务名称、Cron表达式和任务类型为必填项' });
    }
    
    // 验证 Cron 表达式
    if (!isValidCron(cron)) {
      return c.json({ code: 0, msg: 'Cron表达式格式不正确' });
    }
    
    const id = `custom_${Date.now()}`;
    
    await env.DB.prepare(`
      INSERT INTO scheduler_tasks (id, name, description, cron, category, enabled, is_builtin, task_type, task_params)
      VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)
    `).bind(
      id,
      name,
      description || '',
      cron,
      category || 'custom',
      task_type,
      task_params ? JSON.stringify(task_params) : null
    ).run();
    
    return c.json({ code: 1, msg: '任务创建成功', data: { id } });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.scheduler.error('Create task error', { error: errorMessage });
    return c.json({ code: 0, msg: errorMessage });
  }
});

/**
 * 更新任务
 */
scheduler.put('/admin/scheduler/tasks/:taskId', async (c) => {
  const env = c.env;
  const taskId = c.req.param('taskId');
  const body = await c.req.json();
  
  try {
    const { name, description, cron, category, task_type, task_params } = body;
    
    // 检查任务是否存在
    const existing = await env.DB.prepare(
      'SELECT id, is_builtin FROM scheduler_tasks WHERE id = ?'
    ).bind(taskId).first() as { id: string; is_builtin: number } | null;
    
    if (!existing) {
      return c.json({ code: 0, msg: '任务不存在' });
    }
    
    // 验证 Cron 表达式
    if (cron && !isValidCron(cron)) {
      return c.json({ code: 0, msg: 'Cron表达式格式不正确' });
    }
    
    // 构建更新语句
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (cron !== undefined) { updates.push('cron = ?'); values.push(cron); }
    if (category !== undefined && !existing.is_builtin) { updates.push('category = ?'); values.push(category); }
    if (task_type !== undefined && !existing.is_builtin) { updates.push('task_type = ?'); values.push(task_type); }
    if (task_params !== undefined) { updates.push('task_params = ?'); values.push(JSON.stringify(task_params)); }
    
    updates.push('updated_at = ?');
    values.push(Math.floor(Date.now() / 1000));
    values.push(taskId);
    
    await env.DB.prepare(`
      UPDATE scheduler_tasks SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();
    
    return c.json({ code: 1, msg: '任务更新成功' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.scheduler.error('Update task error', { error: errorMessage });
    return c.json({ code: 0, msg: errorMessage });
  }
});

/**
 * 删除任务
 */
scheduler.delete('/admin/scheduler/tasks/:taskId', async (c) => {
  const env = c.env;
  const taskId = c.req.param('taskId');
  
  try {
    // 检查是否为内置任务
    const task = await env.DB.prepare(
      'SELECT is_builtin FROM scheduler_tasks WHERE id = ?'
    ).bind(taskId).first() as { is_builtin: number } | null;
    
    if (!task) {
      return c.json({ code: 0, msg: '任务不存在' });
    }
    
    if (task.is_builtin) {
      return c.json({ code: 0, msg: '内置任务不能删除，只能禁用' });
    }
    
    await env.DB.prepare('DELETE FROM scheduler_tasks WHERE id = ?').bind(taskId).run();
    
    return c.json({ code: 1, msg: '任务已删除' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.scheduler.error('Delete task error', { error: errorMessage });
    return c.json({ code: 0, msg: errorMessage });
  }
});

/**
 * 切换任务状态（启用/禁用）
 */
scheduler.post('/admin/scheduler/tasks/:taskId/toggle', async (c) => {
  const env = c.env;
  const taskId = c.req.param('taskId');
  const { enabled } = await c.req.json();
  
  try {
    await env.DB.prepare(`
      UPDATE scheduler_tasks SET enabled = ?, updated_at = ? WHERE id = ?
    `).bind(enabled ? 1 : 0, Math.floor(Date.now() / 1000), taskId).run();
    
    return c.json({ code: 1, msg: enabled ? '任务已启用' : '任务已禁用' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.scheduler.error('Toggle task error', { error: errorMessage });
    return c.json({ code: 0, msg: errorMessage });
  }
});

/**
 * 手动执行任务
 */
scheduler.post('/admin/scheduler/tasks/:taskId/run', async (c) => {
  const env = c.env;
  const taskId = c.req.param('taskId');
  
  try {
    const task = await env.DB.prepare(
      'SELECT task_type, task_params FROM scheduler_tasks WHERE id = ?'
    ).bind(taskId).first() as { task_type: string; task_params: string | null } | null;
    
    if (!task) {
      return c.json({ code: 0, msg: '任务不存在' });
    }
    
    const startTime = Date.now();
    let status = 'success';
    let message = '';
    
    try {
      const params: TaskExecutionParams = task.task_params ? JSON.parse(task.task_params) : {};
      await executeTaskByType(env, task.task_type, params);
      message = '执行成功';
    } catch (err) {
      status = 'failed';
      message = err instanceof Error ? err.message : 'Unknown error';
    }
    
    const duration = Date.now() - startTime;
    
    // 记录执行历史
    await env.DB.prepare(`
      INSERT INTO scheduler_history (task_id, status, message, duration, executed_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(taskId, status, message, duration, new Date().toISOString()).run();
    
    return c.json({ 
      code: status === 'success' ? 1 : 0, 
      msg: message,
      data: { duration }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.scheduler.error('Run task error', { error: errorMessage });
    return c.json({ code: 0, msg: errorMessage });
  }
});

/**
 * 获取任务执行历史
 */
scheduler.get('/admin/scheduler/history', async (c) => {
  const env = c.env;
  const taskId = c.req.query('taskId');
  const limit = parseInt(c.req.query('limit') || '50');
  
  try {
    let query = `
      SELECT id, task_id, status, message, duration, executed_at
      FROM scheduler_history
    `;
    const params: (string | number)[] = [];
    
    if (taskId) {
      query += ' WHERE task_id = ?';
      params.push(taskId);
    }
    
    query += ' ORDER BY executed_at DESC LIMIT ?';
    params.push(limit);
    
    const result = await env.DB.prepare(query).bind(...params).all();
    
    return c.json({ 
      code: 1, 
      data: { 
        history: result.results as SchedulerHistoryRow[],
        total: result.results?.length || 0
      } 
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.scheduler.error('Get history error', { error: errorMessage });
    return c.json({ code: 0, msg: errorMessage });
  }
});

/**
 * 清理执行历史
 */
scheduler.delete('/admin/scheduler/history', async (c) => {
  const env = c.env;
  const days = parseInt(c.req.query('days') || '30');
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const result = await env.DB.prepare(`
      DELETE FROM scheduler_history WHERE executed_at < ?
    `).bind(cutoffDate.toISOString()).run();
    
    return c.json({ 
      code: 1, 
      msg: `已清理 ${result.meta?.changes || 0} 条历史记录` 
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.scheduler.error('Clear history error', { error: errorMessage });
    return c.json({ code: 0, msg: errorMessage });
  }
});

/**
 * 重置内置任务为默认配置
 */
scheduler.post('/admin/scheduler/tasks/:taskId/reset', async (c) => {
  const env = c.env;
  const taskId = c.req.param('taskId');
  
  try {
    const builtinTask = BUILTIN_TASKS.find(t => t.id === taskId);
    if (!builtinTask) {
      return c.json({ code: 0, msg: '只能重置内置任务' });
    }
    
    await env.DB.prepare(`
      UPDATE scheduler_tasks 
      SET name = ?, description = ?, cron = ?, category = ?, task_type = ?, task_params = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      builtinTask.name,
      builtinTask.description,
      builtinTask.cron,
      builtinTask.category,
      builtinTask.task_type,
      builtinTask.task_params ? JSON.stringify(builtinTask.task_params) : null,
      Math.floor(Date.now() / 1000),
      taskId
    ).run();
    
    return c.json({ code: 1, msg: '任务已重置为默认配置' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.scheduler.error('Reset task error', { error: errorMessage });
    return c.json({ code: 0, msg: errorMessage });
  }
});

/**
 * 根据任务类型执行任务
 */
async function executeTaskByType(env: Bindings, taskType: string, params: TaskExecutionParams): Promise<void> {
  switch (taskType) {
    case 'warmup':
      await warmupCaches(env);
      break;
    case 'collect_incremental':
      const { runIncrementalCollect } = await import('../../services/collector_v2');
      await runIncrementalCollect(env, params);
      break;
    case 'collect_full':
      const { runFullCollect } = await import('../../services/collector_v2');
      await runFullCollect(env);
      break;
    case 'collect_category':
      if (!params.categoryId) throw new Error('缺少分类ID参数');
      const { runIncrementalCollect: runCat } = await import('../../services/collector_v2');
      await runCat(env, { ...params, typeId: params.categoryId });
      break;
    case 'validate_urls':
      const { batchValidateUrls } = await import('../../services/url_validator');
      await batchValidateUrls(env, params.limit || 100);
      break;
    case 'health_check_sources':
      const { checkAllSourcesHealth } = await import('../../services/source_health');
      await checkAllSourcesHealth(env);
      break;
    case 'cleanup_logs':
      await cleanupLogs(env, params.days || 30);
      break;
    case 'cleanup_invalid':
      await cleanupInvalidVideos(env, params.days || 30);
      break;
    case 'merge_duplicates':
      const { mergeDuplicateVideos } = await import('../../scripts/merge_duplicates');
      await mergeDuplicateVideos(env);
      break;
    case 'rebuild_index':
      await rebuildSearchIndex(env);
      break;
    case 'system_health':
      await runHealthCheck(env);
      break;
    default:
      throw new Error(`未知任务类型: ${taskType}`);
  }
}

/**
 * 缓存预热
 */
async function warmupCaches(env: Bindings): Promise<void> {
  // 预热热搜
  const hotResult = await env.DB.prepare(`
    SELECT keyword FROM hot_search_stats WHERE is_hidden = 0 
    ORDER BY is_pinned DESC, search_count DESC LIMIT 10
  `).all();
  const keywords = ((hotResult.results || []) as HotSearchStatsRow[]).map(r => r.keyword);
  await env.ROBIN_CACHE.put('hot_search_keywords', JSON.stringify({ keywords }), { expirationTtl: CACHE_CONFIG.hotSearchTTL });
  
  // 预热跑马灯
  const marqueeConfigs = await env.DB.prepare(`
    SELECT key, value FROM system_config WHERE key IN ('marquee_enabled', 'marquee_text', 'marquee_link')
  `).all();
  const marqueeMap = new Map((marqueeConfigs.results as SystemConfigRow[]).map(r => [r.key, r.value]));
  await env.ROBIN_CACHE.put('marquee_config', JSON.stringify({
    enabled: marqueeMap.get('marquee_enabled') === 'true',
    text: marqueeMap.get('marquee_text') || '',
    link: marqueeMap.get('marquee_link') || '',
  }), { expirationTtl: CACHE_CONFIG.marqueeTTL });
  
  // 预热 tabs
  const tabsResult = await env.DB.prepare(`
    SELECT id, title, sort_order, is_visible, is_locked FROM home_tabs WHERE is_visible = 1 ORDER BY sort_order ASC
  `).all();
  await env.ROBIN_CACHE.put('home_tabs', JSON.stringify({
    tabs: tabsResult.results,
    timestamp: Date.now(),
  }), { expirationTtl: CACHE_CONFIG.tabsTTL });
}

/**
 * 清理日志
 */
async function cleanupLogs(env: Bindings, days: number): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const dateStr = cutoffDate.toISOString().split('T')[0];
  await env.DB.prepare(`DELETE FROM vod_access_log WHERE access_date < ?`).bind(dateStr).run();
}

/**
 * 清理失效视频
 */
async function cleanupInvalidVideos(env: Bindings, days: number): Promise<void> {
  const cutoffTime = Math.floor(Date.now() / 1000) - (days * 86400);
  await env.DB.prepare(`
    DELETE FROM vod_cache WHERE is_valid = 0 AND updated_at < ?
  `).bind(cutoffTime).run();
}

/**
 * 重建搜索索引
 */
async function rebuildSearchIndex(env: Bindings): Promise<void> {
  await env.DB.prepare('DELETE FROM vod_search').run();
  await env.DB.prepare(`
    INSERT INTO vod_search (vod_id, vod_name, vod_actor, vod_director, vod_content)
    SELECT vod_id, vod_name, vod_actor, vod_director, vod_content FROM vod_cache WHERE is_valid = 1
  `).run();
}

/**
 * 健康检查
 */
async function runHealthCheck(env: Bindings): Promise<void> {
  const { getCollectorMetrics, checkHealth, sendDingTalkAlert } = await import('../../scripts/monitor_collector');
  const metrics = await getCollectorMetrics(env);
  const health = checkHealth(metrics);
  
  if (health.status !== 'healthy' && health.issues.length > 0 && env.DINGTALK_WEBHOOK) {
    await sendDingTalkAlert(env.DINGTALK_WEBHOOK, metrics, health);
  }
}

/**
 * 验证 Cron 表达式
 */
function isValidCron(cron: string): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  
  const patterns = [
    /^(\*|[0-9]|[1-5][0-9])(\/[0-9]+)?$|^\*\/[0-9]+$/,  // 分钟 0-59
    /^(\*|[0-9]|1[0-9]|2[0-3])(\/[0-9]+)?$|^\*\/[0-9]+$/,  // 小时 0-23
    /^(\*|[1-9]|[12][0-9]|3[01])(\/[0-9]+)?$|^\*\/[0-9]+$/,  // 日 1-31
    /^(\*|[1-9]|1[0-2])(\/[0-9]+)?$|^\*\/[0-9]+$/,  // 月 1-12
    /^(\*|[0-6])(\/[0-9]+)?$|^\*\/[0-9]+$/,  // 周 0-6
  ];
  
  return parts.every((part, i) => patterns[i].test(part));
}

/**
 * 解析 Cron 表达式为可读描述
 */
function parseCronDescription(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  
  const [minute, hour, day, month, weekday] = parts;
  
  // 常见模式匹配
  if (minute === '0' && hour === '*') return '每小时整点';
  if (minute === '0' && hour.startsWith('*/')) return `每${hour.slice(2)}小时`;
  if (minute.startsWith('*/')) return `每${minute.slice(2)}分钟`;
  if (day === '*' && month === '*' && weekday === '*') {
    if (minute === '0') return `每天${hour}点`;
    return `每天${hour}:${minute.padStart(2, '0')}`;
  }
  if (weekday === '0') return `每周日${hour}:${minute.padStart(2, '0')}`;
  if (weekday !== '*') {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `每${days[parseInt(weekday)]}${hour}:${minute.padStart(2, '0')}`;
  }
  
  return cron;
}

export default scheduler;
