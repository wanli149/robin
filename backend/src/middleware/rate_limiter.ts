/**
 * Rate Limiter Middleware
 * 基于 KV 存储的速率限制中间件
 * 
 * 🚀 优化：使用滑动窗口计数器，减少 KV 读写次数
 */

import { Context, Next } from 'hono';
import { createLogger } from '../utils/logger';
import { CACHE_CONFIG } from '../config';

const logger = createLogger('RateLimit');

type Bindings = {
  ROBIN_CACHE: KVNamespace;
};

interface RateLimitConfig {
  windowMs: number;     // 时间窗口（毫秒）
  maxRequests: number;  // 最大请求数
  keyGenerator?: (c: Context) => string; // 自定义键生成器
  skipSuccessfulRequests?: boolean; // 是否跳过成功请求
  skipFailedRequests?: boolean;     // 是否跳过失败请求
  message?: string;     // 自定义错误消息
}

// 🚀 内存缓存：减少 KV 读取（每个 Worker 实例独立）
const memoryCache = new Map<string, { count: number; resetAt: number }>();
const MEMORY_CACHE_CLEANUP_INTERVAL = 60000; // 1分钟清理一次
let lastCleanup = Date.now();

/**
 * 清理过期的内存缓存
 */
function cleanupMemoryCache() {
  const now = Date.now();
  if (now - lastCleanup < MEMORY_CACHE_CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  for (const [key, value] of memoryCache.entries()) {
    if (value.resetAt < now) {
      memoryCache.delete(key);
    }
  }
}

/**
 * 创建速率限制中间件
 * 
 * 🚀 优化策略：
 * 1. 优先使用内存缓存（同一 Worker 实例内）
 * 2. 只在超过阈值时才写入 KV
 * 3. 使用简单计数器代替时间戳数组
 */
export function createRateLimiter(config: RateLimitConfig) {
  return async function rateLimiter(
    c: Context<{ Bindings: Bindings }>,
    next: Next
  ): Promise<Response | void> {
    try {
      // 定期清理内存缓存
      cleanupMemoryCache();
      
      const key = config.keyGenerator 
        ? config.keyGenerator(c)
        : getDefaultKey(c);
      
      const now = Date.now();
      const windowEnd = now + config.windowMs;
      
      // 🚀 优先检查内存缓存
      let memEntry = memoryCache.get(key);
      if (memEntry && memEntry.resetAt > now) {
        // 内存缓存有效
        if (memEntry.count >= config.maxRequests) {
          logger.warn('Rate limit exceeded (memory)', { 
            key, 
            requests: memEntry.count, 
            limit: config.maxRequests 
          });
          
          return c.json({
            code: 0,
            msg: config.message || 'Too many requests, please try again later',
            data: {
              limit: config.maxRequests,
              windowMs: config.windowMs,
              retryAfter: Math.ceil((memEntry.resetAt - now) / 1000)
            }
          }, 429);
        }
        memEntry.count++;
      } else {
        // 内存缓存过期或不存在，创建新条目
        memEntry = { count: 1, resetAt: windowEnd };
        memoryCache.set(key, memEntry);
      }
      
      // 执行请求
      await next();
      
      // 🚀 只在接近限制时才同步到 KV（减少写入）
      if (memEntry.count >= config.maxRequests * 0.8) {
        c.executionCtx.waitUntil(
          syncToKV(c.env, key, memEntry, config.windowMs)
        );
      }
      
    } catch (error) {
      logger.error('Rate limiter error', { 
        error: error instanceof Error ? error.message : 'Unknown',
        path: c.req.path
      });
      // 出错时不阻止请求，继续执行
      await next();
    }
  };
}

/**
 * 同步计数到 KV（异步，不阻塞响应）
 */
async function syncToKV(
  env: { ROBIN_CACHE: KVNamespace },
  key: string,
  entry: { count: number; resetAt: number },
  windowMs: number
): Promise<void> {
  try {
    const countKey = `rate_limit:${key}`;
    await env.ROBIN_CACHE.put(
      countKey,
      JSON.stringify({ count: entry.count, resetAt: entry.resetAt }),
      { expirationTtl: Math.ceil(windowMs / 1000) + 60 }
    );
  } catch (error) {
    logger.error('Failed to sync rate limit to KV', { 
      error: error instanceof Error ? error.message : 'Unknown' 
    });
  }
}

/**
 * 默认键生成器：基于IP和路径
 */
function getDefaultKey(c: Context): string {
  const ip = c.req.header('cf-connecting-ip') || 
             c.req.header('x-forwarded-for') || 
             c.req.header('x-real-ip') || 
             'unknown';
  const path = c.req.path;
  return `${ip}:${path}`;
}

/**
 * 判断是否应该记录此次请求
 */
function shouldRecordRequest(c: Context, config: RateLimitConfig): boolean {
  const status = c.res.status;
  
  if (config.skipSuccessfulRequests && status < 400) {
    return false;
  }
  
  if (config.skipFailedRequests && status >= 400) {
    return false;
  }
  
  return true;
}

/**
 * 记录被阻止的请求统计
 */
async function recordBlockedRequest(
  env: { ROBIN_CACHE: KVNamespace },
  key: string
): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const statsKey = `security_blocked:${today}`;
    
    const current = await env.ROBIN_CACHE.get(statsKey);
    const count = current ? parseInt(current) + 1 : 1;
    
    await env.ROBIN_CACHE.put(
      statsKey,
      count.toString(),
      { expirationTtl: CACHE_CONFIG.statsRetentionTTL }
    );
  } catch (error) {
    logger.error('Failed to record blocked request', { 
      error: error instanceof Error ? error.message : 'Unknown' 
    });
  }
}

/**
 * 预定义的速率限制配置
 */
export const RateLimitPresets = {
  // 严格限制：每分钟30次
  strict: {
    windowMs: 60 * 1000,
    maxRequests: 30,
    message: 'Too many requests, please slow down'
  },
  
  // 中等限制：每分钟100次
  moderate: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: 'Rate limit exceeded, please try again later'
  },
  
  // 宽松限制：每分钟200次
  lenient: {
    windowMs: 60 * 1000,
    maxRequests: 200,
    message: 'Too many requests from this IP'
  },
  
  // 搜索专用：每分钟50次（搜索通常更消耗资源）
  search: {
    windowMs: 60 * 1000,
    maxRequests: 50,
    message: 'Search rate limit exceeded, please wait before searching again',
    keyGenerator: (c: Context) => {
      const ip = c.req.header('cf-connecting-ip') || 
                 c.req.header('x-forwarded-for') || 
                 'unknown';
      return `search:${ip}`;
    }
  },
  
  // API详情：每分钟150次
  detail: {
    windowMs: 60 * 1000,
    maxRequests: 150,
    message: 'Detail API rate limit exceeded'
  }
} as const;

/**
 * 获取速率限制统计
 */
export async function getRateLimitStats(
  env: { ROBIN_CACHE: KVNamespace },
  days: number = 7
): Promise<{
  blocked_today: number;
  blocked_total: number;
  top_blocked_ips: Array<{ ip: string; count: number }>;
}> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const blockedToday = await env.ROBIN_CACHE.get(`security_blocked:${today}`);
    
    // 获取最近几天的统计
    let totalBlocked = 0;
    const ipCounts = new Map<string, number>();
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayBlocked = await env.ROBIN_CACHE.get(`security_blocked:${dateStr}`);
      if (dayBlocked) {
        totalBlocked += parseInt(dayBlocked);
      }
    }
    
    // 获取被阻止IP的详细信息（从rate_limit键中提取）
    const list = await env.ROBIN_CACHE.list({ prefix: 'rate_limit:' });
    for (const key of list.keys.slice(0, 100)) { // 限制查询数量
      try {
        const keyParts = key.name.split(':');
        if (keyParts.length >= 2) {
          const ip = keyParts[1];
          const data = await env.ROBIN_CACHE.get(key.name);
          if (data) {
            const requests = JSON.parse(data);
            if (Array.isArray(requests) && requests.length > 0) {
              ipCounts.set(ip, (ipCounts.get(ip) || 0) + requests.length);
            }
          }
        }
      } catch {
        // 忽略解析错误
      }
    }
    
    const topBlockedIps = Array.from(ipCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));
    
    return {
      blocked_today: parseInt(blockedToday || '0'),
      blocked_total: totalBlocked,
      top_blocked_ips: topBlockedIps
    };
  } catch (error) {
    logger.error('Failed to get rate limit stats', { 
      error: error instanceof Error ? error.message : 'Unknown' 
    });
    return {
      blocked_today: 0,
      blocked_total: 0,
      top_blocked_ips: []
    };
  }
}