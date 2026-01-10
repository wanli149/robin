/**
 * Performance Monitoring Middleware
 * 性能监控中间件
 */

import { Context, Next } from 'hono';
import { createLogger } from '../utils/logger';
import { CACHE_CONFIG } from '../config';

const logger = createLogger('Performance');

type Bindings = {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
};

/**
 * 性能监控中间件
 * 记录API响应时间和错误率
 */
export async function performanceMonitor(c: Context<{ Bindings: Bindings }>, next: Next) {
  const startTime = Date.now();
  const path = c.req.path;
  const method = c.req.method;

  try {
    await next();
    
    const duration = Date.now() - startTime;
    const status = c.res.status;

    // 异步记录性能数据（不阻塞响应）
    c.executionCtx.waitUntil(
      recordPerformance(c.env, {
        path,
        method,
        status,
        duration,
        timestamp: Date.now(),
      })
    );

    // 慢请求警告
    if (duration > 3000) {
      logger.warn('Slow request', { method, path, duration });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // 记录错误
    c.executionCtx.waitUntil(
      recordPerformance(c.env, {
        path,
        method,
        status: 500,
        duration,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    );

    throw error;
  }
}

/**
 * 记录性能数据到KV
 */
async function recordPerformance(
  env: { ROBIN_CACHE: KVNamespace },
  data: {
    path: string;
    method: string;
    status: number;
    duration: number;
    timestamp: number;
    error?: string;
  }
): Promise<void> {
  try {
    const key = `perf:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    
    await env.ROBIN_CACHE.put(
      key,
      JSON.stringify(data),
      { expirationTtl: CACHE_CONFIG.performanceDataTTL }
    );
  } catch (error) {
    logger.error('Failed to record', { error: error instanceof Error ? error.message : 'Unknown' });
  }
}

/**
 * 获取性能统计
 */
export async function getPerformanceStats(
  env: { ROBIN_CACHE: KVNamespace },
  hours: number = 1
): Promise<{
  total_requests: number;
  avg_duration: number;
  error_rate: number;
  slow_requests: number;
  endpoints: Array<{
    path: string;
    count: number;
    avg_duration: number;
    error_count: number;
  }>;
}> {
  try {
    // 性能记录类型
    interface PerfRecord {
      timestamp: number;
      method: string;
      path: string;
      status: number;
      duration: number;
    }
    
    // 端点统计类型
    interface EndpointStat {
      path: string;
      count: number;
      total_duration: number;
      error_count: number;
    }
    
    // 获取所有性能记录
    const list = await env.ROBIN_CACHE.list({ prefix: 'perf:' });
    
    const records: PerfRecord[] = [];
    const cutoffTime = Date.now() - hours * 3600 * 1000;

    // 读取记录
    for (const key of list.keys) {
      try {
        const data = await env.ROBIN_CACHE.get(key.name);
        if (data) {
          const record = JSON.parse(data) as PerfRecord;
          if (record.timestamp >= cutoffTime) {
            records.push(record);
          }
        }
      } catch {
        // 忽略解析错误
      }
    }

    // 统计
    const total = records.length;
    const errors = records.filter(r => r.status >= 400).length;
    const slowRequests = records.filter(r => r.duration > 3000).length;
    const avgDuration = total > 0
      ? records.reduce((sum, r) => sum + r.duration, 0) / total
      : 0;

    // 按端点统计
    const endpointMap = new Map<string, EndpointStat>();
    for (const record of records) {
      const key = `${record.method} ${record.path}`;
      if (!endpointMap.has(key)) {
        endpointMap.set(key, {
          path: key,
          count: 0,
          total_duration: 0,
          error_count: 0,
        });
      }
      const stat = endpointMap.get(key)!;
      stat.count++;
      stat.total_duration += record.duration;
      if (record.status >= 400) {
        stat.error_count++;
      }
    }

    const endpoints = Array.from(endpointMap.values())
      .map(stat => ({
        path: stat.path,
        count: stat.count,
        avg_duration: Math.round(stat.total_duration / stat.count),
        error_count: stat.error_count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return {
      total_requests: total,
      avg_duration: Math.round(avgDuration),
      error_rate: total > 0 ? (errors / total) * 100 : 0,
      slow_requests: slowRequests,
      endpoints,
    };
  } catch (error) {
    logger.error('Failed to get stats', { error: error instanceof Error ? error.message : 'Unknown' });
    return {
      total_requests: 0,
      avg_duration: 0,
      error_rate: 0,
      slow_requests: 0,
      endpoints: [],
    };
  }
}
