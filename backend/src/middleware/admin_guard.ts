/**
 * Admin Guard Middleware
 * 验证管理员权限
 */

import { Context, Next } from 'hono';
import { createLogger } from '../utils/logger';

const logger = createLogger('AdminGuard');

type Bindings = {
  ADMIN_SECRET_KEY: string;
};

/**
 * 时间安全的字符串比较
 * 防止时序攻击（timing attack）
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // 长度不同时，仍然进行完整比较以保持恒定时间
    let result = 1;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ a.charCodeAt(i);
    }
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Admin Guard 中间件
 * 验证请求头中的 x-admin-key 是否匹配环境变量中的 ADMIN_SECRET_KEY
 */
export async function adminGuard(
  c: Context<{ Bindings: Bindings }>,
  next: Next
): Promise<Response | void> {
  try {
    const adminKey = c.req.header('x-admin-key');
    const expectedKey = c.env.ADMIN_SECRET_KEY;

    // 检查是否提供了管理员密钥
    if (!adminKey) {
      return c.json(
        {
          code: 0,
          msg: 'Missing admin key',
        },
        401
      );
    }

    // 使用时间安全比较验证管理员密钥
    if (!timingSafeEqual(adminKey, expectedKey)) {
      logger.warn('Invalid admin key attempt');
      return c.json(
        {
          code: 0,
          msg: 'Invalid admin key',
        },
        403
      );
    }

    // 验证通过，继续处理请求
    await next();
  } catch (error) {
    logger.error('Authentication error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json(
      {
        code: 0,
        msg: 'Admin authentication failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
