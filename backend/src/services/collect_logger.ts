/**
 * Collect Logger Service
 * 采集日志服务 - 记录详细的采集过程
 */

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
const FLUSH_INTERVAL = 5000; // 5秒

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
    createdAt: Math.floor(Date.now() / 1000),
  });
  
  // 控制台输出
  const prefix = `[Collect:${taskId.substring(0, 8)}]`;
  const logMessage = `${prefix} [${entry.level.toUpperCase()}] ${entry.action}: ${entry.message}`;
  
  switch (entry.level) {
    case 'error':
      console.error(logMessage, entry.details || '');
      break;
    case 'warn':
      console.warn(logMessage);
      break;
    case 'debug':
      // 生产环境可以关闭 debug 日志
      if (process.env.NODE_ENV !== 'production') {
        console.log(logMessage);
      }
      break;
    default:
      console.log(logMessage);
  }
  
  // 缓冲区满了就刷新
  if (buffer.length >= BUFFER_SIZE) {
    await flushLogs(env, taskId);
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
      // 日志服务本身的错误使用 console.error，避免循环依赖
      console.error(`[CollectLogger] Failed to flush logs for task ${tid}:`, error);
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
  
  const logs = (result.results as LogDbRow[]).map((row) => ({
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
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  
  const result = await env.DB.prepare(`
    DELETE FROM collect_logs WHERE created_at < ?
  `).bind(sevenDaysAgo).run();
  
  const deleted = result.meta.changes || 0;
  // 日志服务本身使用 console.log 记录清理结果
  console.log(`[CollectLogger] Cleaned up ${deleted} old logs`);
  
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
