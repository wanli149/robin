/**
 * Rate Limiter Middleware
 * 基于 KV 存储的速率限制中间件
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

/**
 * 创建速率限制中间件
 */
export function createRateLimiter(config: RateLimitConfig) {
  return async function rateLimiter(
    c: Context<{ Bindings: Bindings }>,
    next: Next
  ): Promise<Response | void> {
    try {
      const key = config.keyGenerator 
        ? config.keyGenerator(c)
        : getDefaultKey(c);
      
      const now = Date.now();
      const windowStart = now - config.windowMs;
      
      // 获取当前计数
      const countKey = `rate_limit:${key}`;
      const currentData = await c.env.ROBIN_CACHE.get(countKey);
      
      let requests: number[] = [];
      if (currentData) {
        try {
          const parsed = JSON.parse(currentData);
          requests = Array.isArray(parsed) ? parsed : [];
        } catch {
          requests = [];
        }
      }
      
      // 清理过期的请求记录
      requests = requests.filter(timestamp => timestamp > windowStart);
      
      // 检查是否超过限制
      if (requests.length >= config.maxRequests) {
        logger.warn('Rate limit exceeded', { 
          key, 
          requests: requests.length, 
          limit: config.maxRequests,
          ip: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'
        });
        
        // 记录被阻止的请求统计
        await recordBlockedRequest(c.env, key);
        
        return c.json({
          code: 0,
          msg: config.message || 'Too many requests, please try again later',
          data: {
            limit: config.maxRequests,
            windowMs: config.windowMs,
            retryAfter: Math.ceil(config.windowMs / 1000)
          }
        }, 429);
      }
      
      // 执行请求
      await next();
      
      // 根据配置决定是否记录此次请求
      const shouldRecord = shouldRecordRequest(c, config);
      
      if (shouldRecord) {
        // 添加当前请求时间戳
        requests.push(now);
        
        // 保存更新后的计数（设置过期时间为窗口大小）
        await c.env.ROBIN_CACHE.put(
          countKey,
          JSON.stringify(requests),
          { expirationTtl: Math.ceil(config.windowMs / 1000) + 60 } // 多加60秒缓冲
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