/**
 * Collect Logger Service
 * 采集日志服务 - 记录详细的采集过程
 */

import { logger as mainLogger } from '../utils/logger';
import { getCurrentTimestamp, getDaysAgo } from '../utils/time';
import { castD1Results } from '../utils/type_helpers';

interface Env {
  DB: D1Database;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id?: number;
  taskId: string;
  level: LogLevel;
  sourceName?: string;
  action: string;
  message: string;
  details?: Record<string, unknown>;
  vodId?: string;
  vodName?: string;
  createdAt?: number;
}

// 日志缓冲区（批量写入优化）
const logBuffer: Map<string, LogEntry[]> = new Map();
const BUFFER_SIZE = 20;
const FLUSH_INTERVAL = 5000; // 5秒自动刷新

// 定时刷新定时器（Map<taskId, timeoutId>）
const flushTimers: Map<string, number> = new Map();

/**
 * 记录日志
 */
export async function log(
  env: Env,
  entry: Omit<LogEntry, 'id' | 'createdAt'>
): Promise<void> {
  const taskId = entry.taskId;
  
  // 添加到缓冲区
  if (!logBuffer.has(taskId)) {
    logBuffer.set(taskId, []);
  }
  
  const buffer = logBuffer.get(taskId)!;
  buffer.push({
    ...entry,
    createdAt: getCurrentTimestamp(),
  });
  
  // 使用统一日志系统输出
  const prefix = `[Collect:${taskId.substring(0, 8)}]`;
  const logMessage = `${prefix} [${entry.level.toUpperCase()}] ${entry.action}: ${entry.message}`;
  
  // 使用主日志系统（避免循环依赖）
  switch (entry.level) {
    case 'error':
      mainLogger.collectLogger.error(logMessage, entry.details);
      break;
    case 'warn':
      mainLogger.collectLogger.warn(logMessage, entry.details);
      break;
    case 'debug':
      // Debug logs can be disabled in production if needed
      mainLogger.collectLogger.debug(logMessage, entry.details);
      break;
    default:
      mainLogger.collectLogger.info(logMessage, entry.details);
  }
  
  // 缓冲区满了就立即刷新
  if (buffer.length >= BUFFER_SIZE) {
    // 清除定时器
    const timerId = flushTimers.get(taskId);
    if (timerId) {
      clearTimeout(timerId);
      flushTimers.delete(taskId);
    }
    await flushLogs(env, taskId);
  } else {
    // 设置定时刷新（如果还没有设置）
    if (!flushTimers.has(taskId)) {
      const timerId = setTimeout(async () => {
        flushTimers.delete(taskId);
        await flushLogs(env, taskId);
      }, FLUSH_INTERVAL) as unknown as number;
      flushTimers.set(taskId, timerId);
    }
  }
}

/**
 * 刷新日志到数据库
 */
export async function flushLogs(env: Env, taskId?: string): Promise<void> {
  const taskIds = taskId ? [taskId] : Array.from(logBuffer.keys());
  
  for (const tid of taskIds) {
    const buffer = logBuffer.get(tid);
    if (!buffer || buffer.length === 0) continue;
    
    // 清除该任务的定时器
    const timerId = flushTimers.get(tid);
    if (timerId) {
      clearTimeout(timerId);
      flushTimers.delete(tid);
    }
    
    try {
      // 批量插入
      const entries = buffer.splice(0, buffer.length);
      
      for (const entry of entries) {
        await env.DB.prepare(`
          INSERT INTO collect_logs (
            task_id, level, source_name, action, message, details, vod_id, vod_name, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          entry.taskId,
          entry.level,
          entry.sourceName || null,
          entry.action,
          entry.message,
          entry.details ? JSON.stringify(entry.details) : null,
          entry.vodId || null,
          entry.vodName || null,
          entry.createdAt
        ).run();
      }
    } catch (error) {
      // 日志服务本身的错误使用主日志系统，避免循环依赖
      mainLogger.collectLogger.error(`Failed to flush logs for task ${tid}`, { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }
}

// 日志数据库行类型
interface LogDbRow {
  id: number;
  task_id: string;
  level: string;
  source_name: string | null;
  action: string;
  message: string;
  details: string | null;
  vod_id: string | null;
  vod_name: string | null;
  created_at: number;
}

/**
 * 获取任务日志
 */
export async function getTaskLogs(
  env: Env,
  taskId: string,
  options: {
    level?: LogLevel;
    action?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ logs: LogEntry[]; total: number }> {
  const { level, action, limit = 100, offset = 0 } = options;
  
  let whereClause = 'task_id = ?';
  const params: (string | number)[] = [taskId];
  
  if (level) {
    whereClause += ' AND level = ?';
    params.push(level);
  }
  
  if (action) {
    whereClause += ' AND action = ?';
    params.push(action);
  }
  
  // 获取总数
  const countResult = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM collect_logs WHERE ${whereClause}
  `).bind(...params).first();
  
  const total = (countResult?.count as number) || 0;
  
  // 获取日志
  params.push(limit, offset);
  const result = await env.DB.prepare(`
    SELECT * FROM collect_logs 
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params).all();
  
  const logs = castD1Results<LogDbRow>(result.results).map((row) => ({
    id: row.id,
    taskId: row.task_id,
    level: row.level as LogLevel,
    sourceName: row.source_name ?? undefined,
    action: row.action,
    message: row.message,
    details: row.details ? JSON.parse(row.details) : undefined,
    vodId: row.vod_id ?? undefined,
    vodName: row.vod_name ?? undefined,
    createdAt: row.created_at,
  }));
  
  return { logs, total };
}

/**
 * 清理旧日志（保留7天）
 */
export async function cleanupOldLogs(env: Env): Promise<number> {
  const sevenDaysAgo = getDaysAgo(7);
  
  const result = await env.DB.prepare(`
    DELETE FROM collect_logs WHERE created_at < ?
  `).bind(sevenDaysAgo).run();
  
  const deleted = result.meta.changes || 0;
  mainLogger.collectLogger.info('Cleaned up old logs', { deleted });
  
  return deleted;
}

// ============================================
// 便捷日志方法
// ============================================

export function createLogger(env: Env, taskId: string, sourceName?: string) {
  return {
    debug: (action: string, message: string, details?: Record<string, unknown>) =>
      log(env, { taskId, level: 'debug', sourceName, action, message, details }),
    
    info: (action: string, message: string, details?: Record<string, unknown>) =>
      log(env, { taskId, level: 'info', sourceName, action, message, details }),
    
    warn: (action: string, message: string, details?: Record<string, unknown>) =>
      log(env, { taskId, level: 'warn', sourceName, action, message, details }),
    
    error: (action: string, message: string, details?: Record<string, unknown>) =>
      log(env, { taskId, level: 'error', sourceName, action, message, details }),
    
    video: (action: string, vodId: string, vodName: string, message: string, level: LogLevel = 'info') =>
      log(env, { taskId, level, sourceName, action, message, vodId, vodName }),
    
    flush: () => flushLogs(env, taskId),
  };
}
