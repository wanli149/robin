/**
 * API 安全配置管理
 * 可视化配置 API 签名验证、APP 白名单等安全功能
 */

import { Hono } from 'hono';
import type { Bindings } from './types';
import { logger } from '../../utils/logger';
import { CACHE_CONFIG } from '../../config';

const security = new Hono<{ Bindings: Bindings }>();

// 安全配置的 KV 键
const SECURITY_CONFIG_KEY = 'api_security_config';

// 默认配置
// 注意：secretKey 必须与 APP 端 http_client.dart 中的 _apiSecretKey 一致
const DEFAULT_CONFIG = {
  enabled: true, // 默认启用
  secretKey: 'robin-video-api-secret-2024', // 默认密钥，生产环境建议在管理后台修改
  timestampTolerance: 300, // 5分钟
  nonceTtl: 600, // 10分钟
  allowedPackages: ['com.fetch.video'] as string[], // 允许的 APP 包名
  protectedPaths: ['/api/vod', '/api/search', '/api/shorts', '/api/user', '/home_layout', '/home_tabs', '/api/ads'],
  whitelistPaths: ['/api/version', '/api/config', '/api/domains', '/api/announcement', '/api/ads/splash', '/admin/', '/auth/', '/api.php/'],
};

export type SecurityConfig = typeof DEFAULT_CONFIG;

/**
 * GET /admin/security/config
 * 获取 API 安全配置
 */
security.get('/admin/security/config', async (c) => {
  try {
    const cached = await c.env.ROBIN_CACHE.get(SECURITY_CONFIG_KEY);
    let config: SecurityConfig;

    if (cached) {
      config = JSON.parse(cached);
    } else {
      // 从数据库加载
      const result = await c.env.DB.prepare(
        'SELECT value FROM system_config WHERE key = ?'
      ).bind('api_security_config').first();

      if (result?.value) {
        config = JSON.parse(result.value as string);
      } else {
        config = { ...DEFAULT_CONFIG };
      }

      // 缓存配置
      await c.env.ROBIN_CACHE.put(SECURITY_CONFIG_KEY, JSON.stringify(config), {
        expirationTtl: CACHE_CONFIG.securityConfigTTL,
      });
    }

    // 不返回密钥明文，只返回是否已设置
    return c.json({
      code: 1,
      data: {
        ...config,
        secretKey: config.secretKey ? '******' : '',
        hasSecretKey: !!config.secretKey,
      },
    });
  } catch (error) {
    logger.admin.error('Security get config error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: '获取配置失败' }, 500);
  }
});

/**
 * POST /admin/security/config
 * 更新 API 安全配置
 */
security.post('/admin/security/config', async (c) => {
  try {
    const body = await c.req.json();
    const {
      enabled,
      secretKey,
      timestampTolerance,
      nonceTtl,
      allowedPackages,
      protectedPaths,
      whitelistPaths,
    } = body;

    // 获取现有配置
    const existingResult = await c.env.DB.prepare(
      'SELECT value FROM system_config WHERE key = ?'
    ).bind('api_security_config').first();

    let config: SecurityConfig = existingResult?.value
      ? JSON.parse(existingResult.value as string)
      : { ...DEFAULT_CONFIG };

    // 更新配置
    if (enabled !== undefined) config.enabled = enabled;
    if (secretKey && secretKey !== '******') config.secretKey = secretKey;
    if (timestampTolerance !== undefined) config.timestampTolerance = timestampTolerance;
    if (nonceTtl !== undefined) config.nonceTtl = nonceTtl;
    if (allowedPackages !== undefined) config.allowedPackages = allowedPackages;
    if (protectedPaths !== undefined) config.protectedPaths = protectedPaths;
    if (whitelistPaths !== undefined) config.whitelistPaths = whitelistPaths;

    // 保存到数据库
    await c.env.DB.prepare(`
      INSERT INTO system_config (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
    `).bind(
      'api_security_config',
      JSON.stringify(config),
      Math.floor(Date.now() / 1000),
      JSON.stringify(config),
      Math.floor(Date.now() / 1000)
    ).run();

    // 更新缓存
    await c.env.ROBIN_CACHE.put(SECURITY_CONFIG_KEY, JSON.stringify(config), {
      expirationTtl: CACHE_CONFIG.securityConfigTTL,
    });

    return c.json({ code: 1, msg: '配置已更新' });
  } catch (error) {
    logger.admin.error('Security update config error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: '更新配置失败' }, 500);
  }
});

/**
 * POST /admin/security/toggle
 * 快速切换 API 安全开关
 */
security.post('/admin/security/toggle', async (c) => {
  try {
    const { enabled } = await c.req.json();

    // 获取现有配置
    const existingResult = await c.env.DB.prepare(
      'SELECT value FROM system_config WHERE key = ?'
    ).bind('api_security_config').first();

    let config: SecurityConfig = existingResult?.value
      ? JSON.parse(existingResult.value as string)
      : { ...DEFAULT_CONFIG };

    // 检查是否已设置密钥
    if (enabled && !config.secretKey) {
      return c.json({ code: 0, msg: '请先设置 API 密钥' }, 400);
    }

    config.enabled = enabled;

    // 保存
    await c.env.DB.prepare(`
      INSERT INTO system_config (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
    `).bind(
      'api_security_config',
      JSON.stringify(config),
      Math.floor(Date.now() / 1000),
      JSON.stringify(config),
      Math.floor(Date.now() / 1000)
    ).run();

    // 更新缓存
    await c.env.ROBIN_CACHE.put(SECURITY_CONFIG_KEY, JSON.stringify(config), {
      expirationTtl: CACHE_CONFIG.securityConfigTTL,
    });

    return c.json({
      code: 1,
      msg: enabled ? 'API 安全已启用' : 'API 安全已关闭',
    });
  } catch (error) {
    logger.admin.error('Security toggle error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: '切换失败' }, 500);
  }
});

/**
 * POST /admin/security/generate-key
 * 生成新的 API 密钥
 */
security.post('/admin/security/generate-key', async (c) => {
  try {
    // 生成 32 字节的随机密钥
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const newKey = Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return c.json({
      code: 1,
      data: { key: newKey },
      msg: '密钥已生成，请保存后点击保存配置',
    });
  } catch (error) {
    logger.admin.error('Security generate key error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: '生成密钥失败' }, 500);
  }
});

/**
 * POST /admin/security/test
 * 测试 API 签名验证
 */
security.post('/admin/security/test', async (c) => {
  try {
    const { timestamp, nonce, sign, path, method } = await c.req.json();

    // 获取配置
    const cached = await c.env.ROBIN_CACHE.get(SECURITY_CONFIG_KEY);
    let config: SecurityConfig;

    if (cached) {
      config = JSON.parse(cached);
    } else {
      const result = await c.env.DB.prepare(
        'SELECT value FROM system_config WHERE key = ?'
      ).bind('api_security_config').first();
      config = result?.value ? JSON.parse(result.value as string) : { ...DEFAULT_CONFIG };
    }

    if (!config.secretKey) {
      return c.json({ code: 0, msg: '未设置 API 密钥' }, 400);
    }

    // 验证时间戳
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp);
    if (isNaN(ts) || Math.abs(now - ts) > config.timestampTolerance) {
      return c.json({
        code: 0,
        msg: '时间戳验证失败',
        data: { reason: 'timestamp_expired', diff: now - ts },
      });
    }

    // 生成预期签名
    const signData = [method.toUpperCase(), path, timestamp, nonce].join('&');
    const expectedSign = await generateHmacSha256(signData, config.secretKey);

    if (sign !== expectedSign) {
      return c.json({
        code: 0,
        msg: '签名验证失败',
        data: {
          reason: 'invalid_signature',
          expected: expectedSign.substring(0, 16) + '...',
          got: sign.substring(0, 16) + '...',
        },
      });
    }

    return c.json({
      code: 1,
      msg: '验证通过',
      data: { valid: true },
    });
  } catch (error) {
    logger.admin.error('Security test error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: '测试失败' }, 500);
  }
});

/**
 * GET /admin/security/stats
 * 获取安全统计
 */
security.get('/admin/security/stats', async (c) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 从 KV 获取统计数据
    const [blockedCount, validCount] = await Promise.all([
      c.env.ROBIN_CACHE.get(`security_blocked:${today}`),
      c.env.ROBIN_CACHE.get(`security_valid:${today}`),
    ]);

    return c.json({
      code: 1,
      data: {
        today: {
          blocked: parseInt(blockedCount || '0'),
          valid: parseInt(validCount || '0'),
        },
      },
    });
  } catch (error) {
    logger.admin.error('Security stats error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: '获取统计失败' }, 500);
  }
});

/**
 * GET /admin/security/stats
 * 获取安全统计
 */
security.get('/admin/security/stats', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7');
    
    // 获取安全统计
    const { getSecurityStats } = await import('../../middleware/security');
    const securityStats = await getSecurityStats(c.env, days);
    
    // 获取速率限制统计
    const { getRateLimitStats } = await import('../../middleware/rate_limiter');
    const rateLimitStats = await getRateLimitStats(c.env, days);

    return c.json({
      code: 1,
      data: {
        security: securityStats,
        rate_limit: rateLimitStats,
        period_days: days
      }
    });
  } catch (error) {
    logger.admin.error('Security stats error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: '获取统计失败' }, 500);
  }
});

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

// 导出获取配置的函数供中间件使用
export async function getSecurityConfig(env: { DB: D1Database; ROBIN_CACHE: KVNamespace }): Promise<SecurityConfig> {
  const cached = await env.ROBIN_CACHE.get(SECURITY_CONFIG_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  const result = await env.DB.prepare(
    'SELECT value FROM system_config WHERE key = ?'
  ).bind('api_security_config').first();

  const config = result?.value ? JSON.parse(result.value as string) : { ...DEFAULT_CONFIG };

  // 缓存
  await env.ROBIN_CACHE.put(SECURITY_CONFIG_KEY, JSON.stringify(config), {
    expirationTtl: CACHE_CONFIG.securityConfigTTL,
  });

  return config;
}

export default security;
