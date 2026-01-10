/**
 * Security Middleware
 * 整合API安全验证、签名验证等功能
 */

import { Context, Next } from 'hono';
import { createLogger } from '../utils/logger';
import { getSecurityConfig, type SecurityConfig } from '../routes/admin/security';
import { CACHE_CONFIG } from '../config';

const logger = createLogger('Security');

type Bindings = {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
};

/**
 * API 安全验证中间件
 * 基于现有的安全配置系统
 */
export function apiSecurity() {
  return async function securityMiddleware(
    c: Context<{ Bindings: Bindings }>,
    next: Next
  ): Promise<Response | void> {
    try {
      const path = c.req.path;
      const method = c.req.method;

      // 获取安全配置
      const config = await getSecurityConfig(c.env);
      
      // 如果安全验证未启用，直接通过
      if (!config.enabled) {
        await next();
        return;
      }

      // 检查是否在白名单路径中
      if (isWhitelistPath(path, config.whitelistPaths)) {
        await next();
        return;
      }

      // 检查是否需要保护
      if (!isProtectedPath(path, config.protectedPaths)) {
        await next();
        return;
      }

      // 验证签名
      const validationResult = await validateApiSignature(c, config);
      
      if (!validationResult.valid) {
        logger.warn('API security validation failed', {
          path,
          method,
          reason: validationResult.reason,
          ip: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'
        });

        // 记录安全事件
        await recordSecurityEvent(c.env, {
          type: 'signature_validation_failed',
          path,
          method,
          reason: validationResult.reason || 'unknown',
          ip: c.req.header('cf-connecting-ip') || 'unknown',
          timestamp: Date.now()
        });

        return c.json({
          code: 0,
          msg: validationResult.message || 'Security validation failed',
          error_code: validationResult.reason
        }, 401);
      }

      // 记录成功的验证
      await recordValidRequest(c.env);
      
      await next();
    } catch (error) {
      logger.error('Security middleware error', { 
        error: error instanceof Error ? error.message : 'Unknown',
        path: c.req.path
      });
      
      // 安全中间件出错时，为了不影响服务，继续执行
      await next();
    }
  };
}

/**
 * 检查路径是否在白名单中
 */
function isWhitelistPath(path: string, whitelistPaths: string[]): boolean {
  return whitelistPaths.some(pattern => {
    if (pattern.endsWith('/')) {
      return path.startsWith(pattern);
    }
    return path === pattern || path.startsWith(pattern + '/');
  });
}

/**
 * 检查路径是否需要保护
 */
function isProtectedPath(path: string, protectedPaths: string[]): boolean {
  return protectedPaths.some(pattern => {
    if (pattern.endsWith('/')) {
      return path.startsWith(pattern);
    }
    return path === pattern || path.startsWith(pattern + '/');
  });
}

/**
 * 验证API签名
 */
async function validateApiSignature(
  c: Context,
  config: SecurityConfig
): Promise<{
  valid: boolean;
  reason?: string;
  message?: string;
}> {
  try {
    // 获取签名相关头部
    const timestamp = c.req.header('x-timestamp');
    const nonce = c.req.header('x-nonce');
    const signature = c.req.header('x-signature');
    const packageName = c.req.header('x-package-name');

    // 检查必需的头部
    if (!timestamp || !nonce || !signature) {
      return {
        valid: false,
        reason: 'missing_headers',
        message: 'Missing required security headers'
      };
    }

    // 验证包名（如果配置了）
    if (config.allowedPackages.length > 0 && packageName) {
      if (!config.allowedPackages.includes(packageName)) {
        return {
          valid: false,
          reason: 'invalid_package',
          message: 'Invalid application package'
        };
      }
    }

    // 验证时间戳
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp);
    
    if (isNaN(ts)) {
      return {
        valid: false,
        reason: 'invalid_timestamp',
        message: 'Invalid timestamp format'
      };
    }

    if (Math.abs(now - ts) > config.timestampTolerance) {
      return {
        valid: false,
        reason: 'timestamp_expired',
        message: 'Request timestamp expired'
      };
    }

    // 检查nonce是否已使用（防重放攻击）
    const nonceKey = `nonce:${nonce}`;
    const nonceExists = await c.env.ROBIN_CACHE.get(nonceKey);
    
    if (nonceExists) {
      return {
        valid: false,
        reason: 'nonce_reused',
        message: 'Nonce already used'
      };
    }

    // 生成预期签名
    const method = c.req.method.toUpperCase();
    const path = c.req.path;
    const signData = [method, path, timestamp, nonce].join('&');
    const expectedSignature = await generateHmacSha256(signData, config.secretKey);

    // 验证签名
    if (signature !== expectedSignature) {
      return {
        valid: false,
        reason: 'invalid_signature',
        message: 'Invalid request signature'
      };
    }

    // 记录使用过的nonce
    await c.env.ROBIN_CACHE.put(
      nonceKey,
      '1',
      { expirationTtl: config.nonceTtl }
    );

    return { valid: true };
  } catch (error) {
    logger.error('Signature validation error', { 
      error: error instanceof Error ? error.message : 'Unknown' 
    });
    
    return {
      valid: false,
      reason: 'validation_error',
      message: 'Security validation error'
    };
  }
}

/**
 * 生成 HMAC-SHA256 签名
 */
async function generateHmacSha256(data: string, secretKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const dataBuffer = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, dataBuffer);

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 记录安全事件
 */
async function recordSecurityEvent(
  env: { ROBIN_CACHE: KVNamespace },
  event: {
    type: string;
    path: string;
    method: string;
    reason: string;
    ip: string;
    timestamp: number;
  }
): Promise<void> {
  try {
    const key = `security_event:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    
    await env.ROBIN_CACHE.put(
      key,
      JSON.stringify(event),
      { expirationTtl: CACHE_CONFIG.securityEventTTL }
    );

    // 更新今日被阻止请求统计
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
    logger.error('Failed to record security event', { 
      error: error instanceof Error ? error.message : 'Unknown' 
    });
  }
}

/**
 * 记录有效请求统计
 */
async function recordValidRequest(env: { ROBIN_CACHE: KVNamespace }): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const statsKey = `security_valid:${today}`;
    
    const current = await env.ROBIN_CACHE.get(statsKey);
    const count = current ? parseInt(current) + 1 : 1;
    
    await env.ROBIN_CACHE.put(
      statsKey,
      count.toString(),
      { expirationTtl: CACHE_CONFIG.statsRetentionTTL }
    );
  } catch (error) {
    logger.error('Failed to record valid request', { 
      error: error instanceof Error ? error.message : 'Unknown' 
    });
  }
}

/**
 * 获取安全统计信息
 */
export async function getSecurityStats(
  env: { ROBIN_CACHE: KVNamespace },
  days: number = 7
): Promise<{
  blocked_requests: number;
  valid_requests: number;
  security_events: Array<{
    type: string;
    count: number;
    recent_ips: string[];
  }>;
  top_blocked_paths: Array<{
    path: string;
    count: number;
  }>;
}> {
  try {
    let blockedRequests = 0;
    let validRequests = 0;
    const eventTypes = new Map<string, { count: number; ips: Set<string> }>();
    const blockedPaths = new Map<string, number>();

    // 统计最近几天的数据
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const [blocked, valid] = await Promise.all([
        env.ROBIN_CACHE.get(`security_blocked:${dateStr}`),
        env.ROBIN_CACHE.get(`security_valid:${dateStr}`)
      ]);
      
      if (blocked) blockedRequests += parseInt(blocked);
      if (valid) validRequests += parseInt(valid);
    }

    // 获取安全事件详情
    const eventList = await env.ROBIN_CACHE.list({ prefix: 'security_event:' });
    
    for (const key of eventList.keys.slice(0, 1000)) { // 限制查询数量
      try {
        const eventData = await env.ROBIN_CACHE.get(key.name);
        if (eventData) {
          const event = JSON.parse(eventData);
          const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
          
          if (event.timestamp >= cutoffTime) {
            // 统计事件类型
            if (!eventTypes.has(event.type)) {
              eventTypes.set(event.type, { count: 0, ips: new Set() });
            }
            const typeStats = eventTypes.get(event.type)!;
            typeStats.count++;
            typeStats.ips.add(event.ip);
            
            // 统计被阻止的路径
            blockedPaths.set(event.path, (blockedPaths.get(event.path) || 0) + 1);
          }
        }
      } catch {
        // 忽略解析错误
      }
    }

    const securityEvents = Array.from(eventTypes.entries()).map(([type, stats]) => ({
      type,
      count: stats.count,
      recent_ips: Array.from(stats.ips).slice(0, 10)
    }));

    const topBlockedPaths = Array.from(blockedPaths.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    return {
      blocked_requests: blockedRequests,
      valid_requests: validRequests,
      security_events: securityEvents,
      top_blocked_paths: topBlockedPaths
    };
  } catch (error) {
    logger.error('Failed to get security stats', { 
      error: error instanceof Error ? error.message : 'Unknown' 
    });
    
    return {
      blocked_requests: 0,
      valid_requests: 0,
      security_events: [],
      top_blocked_paths: []
    };
  }
}