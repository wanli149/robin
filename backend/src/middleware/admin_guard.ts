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

    // 验证管理员密钥
    if (adminKey !== expectedKey) {
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
