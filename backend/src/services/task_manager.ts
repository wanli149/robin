/**
 * Task Manager Service V2
 * 采集任务管理器 - 支持分页采集、断点续传、实时进度
 */

import type { CollectTaskDbRow } from '../types/task';
import { logger } from '../utils/logger';

// ============================================
// 类型定义
// ============================================

export interface TaskConfig {
  sourceIds?: number[];        // 指定资源站ID列表
  categoryIds?: number[];      // 指定分类ID列表
  pageStart?: number;          // 起始页（默认1）
  pageEnd?: number;            // 结束页（-1表示全部）
  maxVideos?: number;          // 最大采集数量
  priority?: number;           // 优先级 1-10
  skipExisting?: boolean;      // 是否跳过已存在的视频
}

export interface TaskProgress {
  currentSource?: string;
  currentSourceId?: number;
  currentPage: number;
  totalPages: number;
  processedCount: number;
  newCount: number;
  updateCount: number;
  skipCount: number;
  errorCount: number;
  percentage: number;
  estimatedRemaining?: number; // 预计剩余时间（秒）
}

export interface TaskCheckpoint {
  sourceIndex: number;
  page: number;
  lastVodId?: string;
  timestamp: number;
}

export interface CollectTask {
  id: string;
  taskType: 'full' | 'incremental' | 'category' | 'source' | 'shorts';
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  config: TaskConfig;
  progress: TaskProgress;
  checkpoint?: TaskCheckpoint;
  createdAt: number;
  startedAt?: number;
  pausedAt?: number;
  completedAt?: number;
  lastError?: string;
  errorDetails?: string;
}

export interface CreateTaskOptions {
  type: 'full' | 'incremental' | 'category' | 'source' | 'shorts';
  config?: TaskConfig;
}

interface Env {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
}

// ============================================
// 任务管理器
// ============================================

/**
 * 生成UUID
 */
function generateUUID(): string {
  // 简单的UUID生成（不依赖外部库）
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 创建采集任务
 */
export async function createTask(
  env: Env,
  options: CreateTaskOptions
): Promise<CollectTask> {
  const taskId = generateUUID();
  const now = Math.floor(Date.now() / 1000);
  
  const config: TaskConfig = {
    pageStart: 1,
    pageEnd: options.type === 'incremental' ? 5 : -1, // 增量默认5页，全量全部
    priority: 5,
    skipExisting: options.type === 'incremental',
    ...options.config,
  };
  
  const task: CollectTask = {
    id: taskId,
    taskType: options.type,
    status: 'pending',
    priority: config.priority || 5,
    config,
    progress: {
      currentPage: 0,
      totalPages: 0,
      processedCount: 0,
      newCount: 0,
      updateCount: 0,
      skipCount: 0,
      errorCount: 0,
      percentage: 0,
    },
    createdAt: now,
  };
  
  // 保存到数据库
  await env.DB.prepare(`
    INSERT INTO collect_tasks_v2 (
      id, task_type, status, priority, config,
      current_page, total_pages, processed_count, new_count, update_count, skip_count, error_count,
      created_at
    ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, ?)
  `).bind(
    taskId,
    options.type,
    'pending',
    config.priority || 5,
    JSON.stringify(config),
    now
  ).run();
  
  logger.taskManager.info(`Created task ${taskId} (${options.type})`);
  
  return task;
}

/**
 * 获取任务详情
 */
export async function getTask(env: Env, taskId: string): Promise<CollectTask | null> {
  const result = await env.DB.prepare(`
    SELECT * FROM collect_tasks_v2 WHERE id = ?
  `).bind(taskId).first();
  
  if (!result) return null;
  
  return mapDbToTask(result);
}

/**
 * 获取任务列表
 */
export async function getTasks(
  env: Env,
  options: {
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ tasks: CollectTask[]; total: number }> {
  const { status, type, page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;
  
  let whereClause = '1=1';
  const params: (string | number)[] = [];
  
  if (status) {
    whereClause += ' AND status = ?';
    params.push(status);
  }
  
  if (type) {
    whereClause += ' AND task_type = ?';
    params.push(type);
  }
  
  // 获取总数
  const countResult = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM collect_tasks_v2 WHERE ${whereClause}
  `).bind(...params).first();
  
  const total = (countResult?.count as number) || 0;
  
  // 获取列表
  params.push(limit, offset);
  const result = await env.DB.prepare(`
    SELECT * FROM collect_tasks_v2 
    WHERE ${whereClause}
    ORDER BY 
      CASE status 
        WHEN 'running' THEN 1 
        WHEN 'pending' THEN 2 
        ELSE 3 
      END,
      priority DESC,
      created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params).all();
  
  const tasks = result.results.map(mapDbToTask);
  
  return { tasks, total };
}

/**
 * 更新任务状态
 */
export async function updateTaskStatus(
  env: Env,
  taskId: string,
  status: CollectTask['status'],
  extra?: {
    lastError?: string;
    errorDetails?: string;
  }
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  
  let timeField = '';
  if (status === 'running') timeField = ', started_at = ?';
  else if (status === 'paused') timeField = ', paused_at = ?';
  else if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    timeField = ', completed_at = ?';
  }
  
  const params: (string | number | null)[] = [status];
  if (timeField) params.push(now);
  
  if (extra?.lastError) {
    params.push(extra.lastError);
    params.push(extra.errorDetails || null);
    params.push(taskId);
    
    await env.DB.prepare(`
      UPDATE collect_tasks_v2 
      SET status = ?${timeField}, last_error = ?, error_details = ?
      WHERE id = ?
    `).bind(...params).run();
  } else {
    params.push(taskId);
    
    await env.DB.prepare(`
      UPDATE collect_tasks_v2 
      SET status = ?${timeField}
      WHERE id = ?
    `).bind(...params).run();
  }
  
  logger.taskManager.info(`Task ${taskId} status -> ${status}`);
}

/**
 * 更新任务进度
 */
export async function updateTaskProgress(
  env: Env,
  taskId: string,
  progress: Partial<TaskProgress> & {
    currentSource?: string;
    currentSourceId?: number;
    checkpoint?: TaskCheckpoint;
  }
): Promise<void> {
  const updates: string[] = [];
  const params: (string | number | null)[] = [];
  
  if (progress.currentSource !== undefined) {
    updates.push('current_source = ?');
    params.push(progress.currentSource);
  }
  if (progress.currentSourceId !== undefined) {
    updates.push('current_source_id = ?');
    params.push(progress.currentSourceId);
  }
  if (progress.currentPage !== undefined) {
    updates.push('current_page = ?');
    params.push(progress.currentPage);
  }
  if (progress.totalPages !== undefined) {
    updates.push('total_pages = ?');
    params.push(progress.totalPages);
  }
  if (progress.processedCount !== undefined) {
    updates.push('processed_count = ?');
    params.push(progress.processedCount);
  }
  if (progress.newCount !== undefined) {
    updates.push('new_count = ?');
    params.push(progress.newCount);
  }
  if (progress.updateCount !== undefined) {
    updates.push('update_count = ?');
    params.push(progress.updateCount);
  }
  if (progress.skipCount !== undefined) {
    updates.push('skip_count = ?');
    params.push(progress.skipCount);
  }
  if (progress.errorCount !== undefined) {
    updates.push('error_count = ?');
    params.push(progress.errorCount);
  }
  if (progress.checkpoint) {
    updates.push('checkpoint = ?');
    params.push(JSON.stringify(progress.checkpoint));
  }
  
  if (updates.length === 0) return;
  
  params.push(taskId);
  
  await env.DB.prepare(`
    UPDATE collect_tasks_v2 
    SET ${updates.join(', ')}
    WHERE id = ?
  `).bind(...params).run();
}

/**
 * 获取下一个待执行的任务
 */
export async function getNextPendingTask(env: Env): Promise<CollectTask | null> {
  // 检查是否有正在运行的任务
  const runningTask = await env.DB.prepare(`
    SELECT * FROM collect_tasks_v2 WHERE status = 'running' LIMIT 1
  `).first();
  
  if (runningTask) {
    // 已有任务在运行，不启动新任务
    return null;
  }
  
  // 获取优先级最高的待执行任务
  const result = await env.DB.prepare(`
    SELECT * FROM collect_tasks_v2 
    WHERE status = 'pending'
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
  `).first();
  
  if (!result) return null;
  
  return mapDbToTask(result);
}

/**
 * 取消任务
 */
export async function cancelTask(env: Env, taskId: string): Promise<boolean> {
  const task = await getTask(env, taskId);
  
  if (!task) return false;
  
  if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
    return false; // 已完成的任务不能取消
  }
  
  await updateTaskStatus(env, taskId, 'cancelled');
  return true;
}

/**
 * 暂停任务
 */
export async function pauseTask(env: Env, taskId: string): Promise<boolean> {
  const task = await getTask(env, taskId);
  
  if (!task || task.status !== 'running') return false;
  
  await updateTaskStatus(env, taskId, 'paused');
  return true;
}

/**
 * 恢复任务
 */
export async function resumeTask(env: Env, taskId: string): Promise<boolean> {
  const task = await getTask(env, taskId);
  
  if (!task || task.status !== 'paused') return false;
  
  await updateTaskStatus(env, taskId, 'pending');
  return true;
}

/**
 * 清理旧任务（保留最近30天）
 */
export async function cleanupOldTasks(env: Env): Promise<number> {
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
  
  // 先删除相关日志
  await env.DB.prepare(`
    DELETE FROM collect_logs 
    WHERE task_id IN (
      SELECT id FROM collect_tasks_v2 
      WHERE created_at < ? AND status IN ('completed', 'failed', 'cancelled')
    )
  `).bind(thirtyDaysAgo).run();
  
  // 删除旧任务
  const result = await env.DB.prepare(`
    DELETE FROM collect_tasks_v2 
    WHERE created_at < ? AND status IN ('completed', 'failed', 'cancelled')
  `).bind(thirtyDaysAgo).run();
  
  const deleted = result.meta.changes || 0;
  logger.taskManager.info(`Cleaned up ${deleted} old tasks`);
  
  return deleted;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 数据库记录映射到任务对象
 */
function mapDbToTask(row: CollectTaskDbRow): CollectTask {
  return {
    id: row.id,
    taskType: row.task_type,
    status: row.status,
    priority: row.priority,
    config: row.config ? JSON.parse(row.config) : {},
    progress: {
      currentSource: row.current_source,
      currentSourceId: row.current_source_id,
      currentPage: row.current_page || 0,
      totalPages: row.total_pages || 0,
      processedCount: row.processed_count || 0,
      newCount: row.new_count || 0,
      updateCount: row.update_count || 0,
      skipCount: row.skip_count || 0,
      errorCount: row.error_count || 0,
      percentage: row.total_pages > 0 
        ? Math.round((row.current_page / row.total_pages) * 100) 
        : 0,
    },
    checkpoint: row.checkpoint ? JSON.parse(row.checkpoint) : undefined,
    createdAt: row.created_at,
    startedAt: row.started_at,
    pausedAt: row.paused_at,
    completedAt: row.completed_at,
    lastError: row.last_error,
    errorDetails: row.error_details,
  };
}
