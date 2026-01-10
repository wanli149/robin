/**
 * Authentication API
 * 用户注册、登录、同步接口
 */

import { Hono } from 'hono';
import { generateToken, verifyToken, extractToken } from '../utils/jwt';
import { logger } from '../utils/logger';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

const auth = new Hono<{ Bindings: Bindings }>();

/**
 * 生成随机盐值
 */
function generateSalt(length: number = 16): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 密码哈希函数（使用 Web Crypto API + 盐值）
 * 格式：salt:hash
 */
async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hash));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hashHex}`;
}

/**
 * 验证密码
 * 支持新格式（salt:hash）和旧格式（纯hash）的兼容
 */
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const encoder = new TextEncoder();
  
  // 检查是否为新格式（包含盐值）
  if (storedHash.includes(':')) {
    const [salt, hash] = storedHash.split(':');
    const data = encoder.encode(salt + password);
    const computedHash = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(computedHash));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === hash;
  }
  
  // 兼容旧格式（无盐值）
  const data = encoder.encode(password);
  const computedHash = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(computedHash));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === storedHash;
}

/**
 * POST /api/auth/register
 * 用户注册
 * 
 * Body:
 * - username: 用户名（必需）
 * - password: 密码（必需）
 * - device_id: 设备 ID（可选）
 */
auth.post('/api/auth/register', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password, device_id } = body;

    if (!username || !password) {
      return c.json(
        {
          code: 0,
          msg: 'Username and password are required',
        },
        400
      );
    }

    // 检查用户名是否已存在
    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE username = ?'
    ).bind(username).first();

    if (existing) {
      return c.json(
        {
          code: 0,
          msg: 'Username already exists',
        },
        409
      );
    }

    // 哈希密码
    const passwordHash = await hashPassword(password);

    // 插入用户
    const result = await c.env.DB.prepare(`
      INSERT INTO users (username, password, device_id, is_vip, created_at)
      VALUES (?, ?, ?, 0, ?)
    `).bind(username, passwordHash, device_id || null, Math.floor(Date.now() / 1000)).run();

    // 获取新用户 ID
    const user = await c.env.DB.prepare(
      'SELECT id, username, is_vip FROM users WHERE username = ?'
    ).bind(username).first();

    if (!user) {
      throw new Error('Failed to create user');
    }

    // 生成 JWT token
    const token = await generateToken(
      {
        user_id: user.id as number,
        username: user.username as string,
        is_vip: Boolean(user.is_vip),
      },
      c.env.JWT_SECRET
    );

    logger.admin.info('User registered', { username });

    return c.json({
      code: 1,
      msg: 'Registration successful',
      data: {
        user_id: user.id,
        username: user.username,
        is_vip: Boolean(user.is_vip),
        token,
      },
    });
  } catch (error) {
    logger.admin.error('Register error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Registration failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/auth/login
 * 用户登录
 * 
 * Body:
 * - username: 用户名（必需）
 * - password: 密码（必需）
 */
auth.post('/api/auth/login', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;

    if (!username || !password) {
      return c.json(
        {
          code: 0,
          msg: 'Username and password are required',
        },
        400
      );
    }

    // 查询用户
    const user = await c.env.DB.prepare(
      'SELECT id, username, password, is_vip FROM users WHERE username = ?'
    ).bind(username).first();

    if (!user) {
      return c.json(
        {
          code: 0,
          msg: 'Invalid username or password',
        },
        401
      );
    }

    // 验证密码
    const isValid = await verifyPassword(password, user.password as string);
    if (!isValid) {
      return c.json(
        {
          code: 0,
          msg: 'Invalid username or password',
        },
        401
      );
    }

    // 生成 JWT token
    const token = await generateToken(
      {
        user_id: user.id as number,
        username: user.username as string,
        is_vip: Boolean(user.is_vip),
      },
      c.env.JWT_SECRET
    );

    logger.admin.info('User logged in', { username });

    return c.json({
      code: 1,
      msg: 'Login successful',
      data: {
        user_id: user.id,
        username: user.username,
        is_vip: Boolean(user.is_vip),
        token,
      },
    });
  } catch (error) {
    logger.admin.error('Login error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Login failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/auth/me
 * 获取当前用户信息
 * 
 * Headers:
 * - Authorization: Bearer <token>
 */
auth.get('/api/auth/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || null;
    const token = extractToken(authHeader);

    if (!token) {
      return c.json(
        {
          code: 0,
          msg: 'Missing authorization token',
        },
        401
      );
    }

    // 验证 token
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json(
        {
          code: 0,
          msg: 'Invalid or expired token',
        },
        401
      );
    }

    // 查询最新用户信息
    const user = await c.env.DB.prepare(
      'SELECT id, username, is_vip, created_at FROM users WHERE id = ?'
    ).bind(payload.user_id).first();

    if (!user) {
      return c.json(
        {
          code: 0,
          msg: 'User not found',
        },
        404
      );
    }

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        user_id: user.id,
        username: user.username,
        is_vip: Boolean(user.is_vip),
        created_at: user.created_at,
      },
    });
  } catch (error) {
    logger.admin.error('Me error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get user info',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default auth;

/**
 * POST /user/sync
 * 同步观看进度
 * 
 * Headers:
 * - Authorization: Bearer <token>
 * 
 * Body:
 * - vod_id: 视频 ID（必需）
 * - vod_name: 视频名称
 * - vod_pic: 视频封面
 * - progress: 观看进度（秒）
 * - duration: 总时长（秒）
 */
auth.post('/user/sync', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || null;
    const token = extractToken(authHeader);

    if (!token) {
      return c.json({ code: 0, msg: 'Missing authorization token' }, 401);
    }

    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ code: 0, msg: 'Invalid or expired token' }, 401);
    }

    const body = await c.req.json();
    const { vod_id, vod_name, vod_pic, progress, duration } = body;

    if (!vod_id) {
      return c.json({ code: 0, msg: 'vod_id is required' }, 400);
    }

    // 使用 INSERT OR REPLACE 更新观看历史
    await c.env.DB.prepare(`
      INSERT INTO history (user_id, vod_id, vod_name, vod_pic, progress, duration, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, vod_id) DO UPDATE SET
        progress = excluded.progress,
        duration = excluded.duration,
        updated_at = excluded.updated_at
    `).bind(
      payload.user_id,
      vod_id,
      vod_name || null,
      vod_pic || null,
      progress || 0,
      duration || 0,
      Math.floor(Date.now() / 1000)
    ).run();

    logger.admin.info('Sync progress', { user_id: payload.user_id, vod_id, progress });

    return c.json({
      code: 1,
      msg: 'Progress synced successfully',
    });
  } catch (error) {
    logger.admin.error('Sync error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to sync progress',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/user/history
 * 获取观看历史
 * 
 * Headers:
 * - Authorization: Bearer <token>
 * 
 * Query params:
 * - page: 页码，默认 1
 * - limit: 每页数量，默认 20
 */
auth.get('/api/user/history', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || null;
    const token = extractToken(authHeader);

    if (!token) {
      return c.json({ code: 0, msg: 'Missing authorization token' }, 401);
    }

    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ code: 0, msg: 'Invalid or expired token' }, 401);
    }

    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const offset = (page - 1) * limit;

    // 查询观看历史
    const result = await c.env.DB.prepare(`
      SELECT vod_id, vod_name, vod_pic, progress, duration, updated_at
      FROM history
      WHERE user_id = ?
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `).bind(payload.user_id, limit, offset).all();

    // 获取总数
    const countResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM history WHERE user_id = ?'
    ).bind(payload.user_id).first();

    const total = (countResult?.count as number) || 0;

    return c.json({
      code: 1,
      msg: 'success',
      page,
      total,
      data: result.results,
    });
  } catch (error) {
    logger.admin.error('History error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get history',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/user/favorites
 * 获取收藏列表
 * 
 * Headers:
 * - Authorization: Bearer <token>
 */
auth.get('/api/user/favorites', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || null;
    const token = extractToken(authHeader);

    if (!token) {
      return c.json({ code: 0, msg: 'Missing authorization token' }, 401);
    }

    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ code: 0, msg: 'Invalid or expired token' }, 401);
    }

    const result = await c.env.DB.prepare(`
      SELECT vod_id, vod_name, vod_pic, created_at
      FROM favorites
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(payload.user_id).all();

    return c.json({
      code: 1,
      msg: 'success',
      data: result.results,
    });
  } catch (error) {
    logger.admin.error('Favorites error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get favorites',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/user/favorite
 * 添加收藏
 * 
 * Headers:
 * - Authorization: Bearer <token>
 * 
 * Body:
 * - vod_id: 视频 ID（必需）
 * - vod_name: 视频名称
 * - vod_pic: 视频封面
 */
auth.post('/api/user/favorite', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || null;
    const token = extractToken(authHeader);

    if (!token) {
      return c.json({ code: 0, msg: 'Missing authorization token' }, 401);
    }

    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ code: 0, msg: 'Invalid or expired token' }, 401);
    }

    const body = await c.req.json();
    const { vod_id, vod_name, vod_pic } = body;

    if (!vod_id) {
      return c.json({ code: 0, msg: 'vod_id is required' }, 400);
    }

    // 插入收藏（忽略重复）
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO favorites (user_id, vod_id, vod_name, vod_pic, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      payload.user_id,
      vod_id,
      vod_name || null,
      vod_pic || null,
      Math.floor(Date.now() / 1000)
    ).run();

    logger.admin.info('Added favorite', { user_id: payload.user_id, vod_id });

    return c.json({
      code: 1,
      msg: 'Added to favorites',
    });
  } catch (error) {
    logger.admin.error('Add favorite error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to add favorite',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * DELETE /api/user/favorite/:vod_id
 * 取消收藏
 * 
 * Headers:
 * - Authorization: Bearer <token>
 */
auth.delete('/api/user/favorite/:vod_id', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || null;
    const token = extractToken(authHeader);

    if (!token) {
      return c.json({ code: 0, msg: 'Missing authorization token' }, 401);
    }

    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ code: 0, msg: 'Invalid or expired token' }, 401);
    }

    const vod_id = c.req.param('vod_id');

    await c.env.DB.prepare(`
      DELETE FROM favorites
      WHERE user_id = ? AND vod_id = ?
    `).bind(payload.user_id, vod_id).run();

    logger.admin.info('Removed favorite', { user_id: payload.user_id, vod_id });

    return c.json({
      code: 1,
      msg: 'Removed from favorites',
    });
  } catch (error) {
    logger.admin.error('Remove favorite error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to remove favorite',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/appointment
 * 添加预约
 * 
 * Headers:
 * - Authorization: Bearer <token>
 * 
 * Body:
 * - vod_id: 视频 ID（必需）
 * - vod_name: 视频名称
 * - release_date: 上映日期
 */
auth.post('/api/appointment', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || null;
    const token = extractToken(authHeader);

    if (!token) {
      return c.json({ code: 0, msg: 'Missing authorization token' }, 401);
    }

    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ code: 0, msg: 'Invalid or expired token' }, 401);
    }

    const body = await c.req.json();
    const { vod_id, vod_name, release_date } = body;

    if (!vod_id) {
      return c.json({ code: 0, msg: 'vod_id is required' }, 400);
    }

    // 插入预约（忽略重复）
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO appointments (user_id, vod_id, vod_name, release_date, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      payload.user_id,
      vod_id,
      vod_name || null,
      release_date || null,
      Math.floor(Date.now() / 1000)
    ).run();

    logger.admin.info('Added appointment', { user_id: payload.user_id, vod_id });

    return c.json({
      code: 1,
      msg: 'Appointment added',
    });
  } catch (error) {
    logger.admin.error('Add appointment error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to add appointment',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/user/appointments
 * 获取预约列表
 * 
 * Headers:
 * - Authorization: Bearer <token>
 */
auth.get('/api/user/appointments', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || null;
    const token = extractToken(authHeader);

    if (!token) {
      return c.json({ code: 0, msg: 'Missing authorization token' }, 401);
    }

    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ code: 0, msg: 'Invalid or expired token' }, 401);
    }

    const result = await c.env.DB.prepare(`
      SELECT vod_id, vod_name, release_date, created_at
      FROM appointments
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(payload.user_id).all();

    return c.json({
      code: 1,
      msg: 'success',
      data: result.results,
    });
  } catch (error) {
    logger.admin.error('Appointments error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get appointments',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * DELETE /api/appointment/:vod_id
 * 取消预约
 * 
 * Headers:
 * - Authorization: Bearer <token>
 */
auth.delete('/api/appointment/:vod_id', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || null;
    const token = extractToken(authHeader);

    if (!token) {
      return c.json({ code: 0, msg: 'Missing authorization token' }, 401);
    }

    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ code: 0, msg: 'Invalid or expired token' }, 401);
    }

    const vod_id = c.req.param('vod_id');

    await c.env.DB.prepare(`
      DELETE FROM appointments
      WHERE user_id = ? AND vod_id = ?
    `).bind(payload.user_id, vod_id).run();

    logger.admin.info('Removed appointment', { user_id: payload.user_id, vod_id });

    return c.json({
      code: 1,
      msg: 'Appointment cancelled',
    });
  } catch (error) {
    logger.admin.error('Remove appointment error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to cancel appointment',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});
