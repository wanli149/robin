/**
 * Storage API
 * 存储配置和播放进度同步接口
 */

import { Hono } from 'hono';
import { adminGuard } from '../middleware/admin_guard';
import { logger } from '../utils/logger';

type Bindings = {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
  ADMIN_SECRET_KEY: string;
};

const storage = new Hono<{ Bindings: Bindings }>();

// ============================================
// 公开接口（APP端调用）
// ============================================

/**
 * GET /api/storage/config
 * 获取存储配置（APP启动时调用）
 */
storage.get('/api/storage/config', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT storage_type, is_enabled, sync_strategy, sync_interval
      FROM storage_config
      WHERE id = 1
    `).first();

    if (!result) {
      return c.json({
        code: 1,
        msg: 'success',
        data: {
          storage_type: 'local',
          is_enabled: false,
          sync_strategy: 'local_only',
          sync_interval: 30,
        },
      });
    }

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        storage_type: result.storage_type,
        is_enabled: result.is_enabled === 1,
        sync_strategy: result.sync_strategy,
        sync_interval: result.sync_interval,
      },
    });
  } catch (error) {
    logger.admin.error('Get config error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: 'Failed to get storage config',
    }, 500);
  }
});

/**
 * POST /api/progress/sync
 * 上传播放进度（APP端调用）
 */
storage.post('/api/progress/sync', async (c) => {
  try {
    const body = await c.req.json();
    const { user_id, progress_list } = body;

    if (!user_id || !progress_list || !Array.isArray(progress_list)) {
      return c.json({ code: 0, msg: 'Invalid request body' }, 400);
    }

    // 检查存储配置
    const config = await c.env.DB.prepare(`
      SELECT is_enabled, sync_strategy FROM storage_config WHERE id = 1
    `).first();

    if (!config || config.is_enabled !== 1) {
      return c.json({ code: 0, msg: 'Cloud sync is disabled' }, 400);
    }

    const now = Math.floor(Date.now() / 1000);
    let syncedCount = 0;

    // 批量插入/更新进度
    for (const item of progress_list) {
      const { content_type, content_id, episode_index, position_seconds, duration_seconds } = item;
      
      const progressPercent = duration_seconds > 0 
        ? Math.round((position_seconds / duration_seconds) * 100) 
        : 0;

      await c.env.DB.prepare(`
        INSERT INTO user_progress (user_id, content_type, content_id, episode_index, position_seconds, duration_seconds, progress_percent, updated_at, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, content_type, content_id, episode_index) 
        DO UPDATE SET 
          position_seconds = excluded.position_seconds,
          duration_seconds = excluded.duration_seconds,
          progress_percent = excluded.progress_percent,
          updated_at = excluded.updated_at,
          synced_at = excluded.synced_at
      `).bind(
        user_id,
        content_type,
        content_id,
        episode_index || 1,
        position_seconds,
        duration_seconds || 0,
        progressPercent,
        now,
        now
      ).run();

      syncedCount++;
    }

    // 记录同步日志
    await c.env.DB.prepare(`
      INSERT INTO sync_logs (sync_type, records_count, status, created_at)
      VALUES ('upload', ?, 'success', ?)
    `).bind(syncedCount, now).run();

    logger.admin.info('Progress synced', { syncedCount, userId: user_id });

    return c.json({
      code: 1,
      msg: 'Progress synced successfully',
      data: { synced_count: syncedCount },
    });
  } catch (error) {
    logger.admin.error('Sync progress error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: 'Failed to sync progress',
    }, 500);
  }
});

/**
 * GET /api/progress/pull
 * 拉取播放进度（APP启动时调用）
 */
storage.get('/api/progress/pull', async (c) => {
  try {
    const userId = c.req.query('user_id');
    const since = c.req.query('since'); // 时间戳，只拉取此时间之后的更新

    if (!userId) {
      return c.json({ code: 0, msg: 'user_id is required' }, 400);
    }

    // 检查存储配置
    const config = await c.env.DB.prepare(`
      SELECT is_enabled, sync_strategy FROM storage_config WHERE id = 1
    `).first();

    if (!config || config.is_enabled !== 1) {
      return c.json({ code: 0, msg: 'Cloud sync is disabled' }, 400);
    }

    let query = `
      SELECT content_type, content_id, episode_index, position_seconds, duration_seconds, progress_percent, updated_at
      FROM user_progress
      WHERE user_id = ?
    `;
    const params: (string | number)[] = [userId];

    if (since) {
      query += ' AND updated_at > ?';
      params.push(parseInt(since));
    }

    query += ' ORDER BY updated_at DESC LIMIT 100';

    const result = await c.env.DB.prepare(query).bind(...params).all();

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        progress_list: result.results,
        server_time: Math.floor(Date.now() / 1000),
      },
    });
  } catch (error) {
    logger.admin.error('Pull progress error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: 'Failed to pull progress',
    }, 500);
  }
});

/**
 * GET /api/progress/:contentId
 * 获取单个视频的播放进度
 */
storage.get('/api/progress/:contentId', async (c) => {
  try {
    const contentId = c.req.param('contentId');
    const userId = c.req.query('user_id');
    const contentType = c.req.query('content_type') || 'tv';
    const episodeIndex = c.req.query('episode_index') || '1';

    if (!userId) {
      return c.json({ code: 0, msg: 'user_id is required' }, 400);
    }

    const result = await c.env.DB.prepare(`
      SELECT position_seconds, duration_seconds, progress_percent, updated_at
      FROM user_progress
      WHERE user_id = ? AND content_type = ? AND content_id = ? AND episode_index = ?
    `).bind(userId, contentType, contentId, parseInt(episodeIndex)).first();

    if (!result) {
      return c.json({
        code: 1,
        msg: 'success',
        data: null,
      });
    }

    return c.json({
      code: 1,
      msg: 'success',
      data: result,
    });
  } catch (error) {
    logger.admin.error('Get progress error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: 'Failed to get progress',
    }, 500);
  }
});

// ============================================
// 管理接口（需要管理员权限）
// ============================================

/**
 * GET /admin/storage/config
 * 获取完整存储配置（管理后台用）
 */
storage.get('/admin/storage/config', adminGuard, async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT * FROM storage_config WHERE id = 1
    `).first();

    if (!result) {
      return c.json({
        code: 1,
        msg: 'success',
        data: {
          storage_type: 'local',
          connection_url: '',
          api_key: '',
          is_enabled: false,
          sync_strategy: 'local_only',
          sync_interval: 30,
          last_sync_at: null,
          last_sync_status: null,
        },
      });
    }

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        storage_type: result.storage_type,
        connection_url: result.connection_url || '',
        api_key: result.api_key ? '******' : '', // 隐藏API密钥
        is_enabled: result.is_enabled === 1,
        sync_strategy: result.sync_strategy,
        sync_interval: result.sync_interval,
        last_sync_at: result.last_sync_at,
        last_sync_status: result.last_sync_status,
        last_sync_error: result.last_sync_error,
      },
    });
  } catch (error) {
    logger.admin.error('Get admin config error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: 'Failed to get storage config',
    }, 500);
  }
});

/**
 * POST /admin/storage/config
 * 更新存储配置
 */
storage.post('/admin/storage/config', adminGuard, async (c) => {
  try {
    const body = await c.req.json();
    const { storage_type, connection_url, api_key, is_enabled, sync_strategy, sync_interval } = body;

    const now = Math.floor(Date.now() / 1000);

    // 如果api_key是******，表示不更新
    let updateApiKey = api_key && api_key !== '******';

    if (updateApiKey) {
      await c.env.DB.prepare(`
        UPDATE storage_config
        SET storage_type = ?, connection_url = ?, api_key = ?, is_enabled = ?, sync_strategy = ?, sync_interval = ?, updated_at = ?
        WHERE id = 1
      `).bind(
        storage_type || 'local',
        connection_url || '',
        api_key,
        is_enabled ? 1 : 0,
        sync_strategy || 'local_only',
        sync_interval || 30,
        now
      ).run();
    } else {
      await c.env.DB.prepare(`
        UPDATE storage_config
        SET storage_type = ?, connection_url = ?, is_enabled = ?, sync_strategy = ?, sync_interval = ?, updated_at = ?
        WHERE id = 1
      `).bind(
        storage_type || 'local',
        connection_url || '',
        is_enabled ? 1 : 0,
        sync_strategy || 'local_only',
        sync_interval || 30,
        now
      ).run();
    }

    logger.admin.info('Config updated', { storage_type, is_enabled, sync_strategy });

    return c.json({
      code: 1,
      msg: 'Storage config updated successfully',
    });
  } catch (error) {
    logger.admin.error('Update config error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: 'Failed to update storage config',
    }, 500);
  }
});

/**
 * POST /admin/storage/test
 * 测试存储连接
 */
storage.post('/admin/storage/test', adminGuard, async (c) => {
  try {
    const body = await c.req.json();
    const { storage_type, connection_url, api_key } = body;

    if (storage_type === 'local') {
      return c.json({
        code: 1,
        msg: 'Local storage is always available',
        data: { status: 'success' },
      });
    }

    if (!connection_url) {
      return c.json({
        code: 0,
        msg: 'Connection URL is required',
        data: { status: 'failed' },
      });
    }

    // URL 格式验证
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(connection_url);
    } catch {
      return c.json({
        code: 0,
        msg: 'Invalid connection URL format',
        data: { status: 'failed' },
      });
    }

    // 根据存储类型测试连接
    const testResult = await testStorageConnection(storage_type, connection_url, api_key);
    
    if (testResult.success) {
      return c.json({
        code: 1,
        msg: testResult.message,
        data: { status: 'success', latency: testResult.latency },
      });
    } else {
      return c.json({
        code: 0,
        msg: testResult.message,
        data: { status: 'failed', error: testResult.error },
      });
    }
  } catch (error) {
    logger.admin.error('Test connection error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: 'Connection test failed',
      data: { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' },
    }, 500);
  }
});

/**
 * 测试存储连接
 */
async function testStorageConnection(
  storageType: string,
  connectionUrl: string,
  apiKey?: string
): Promise<{ success: boolean; message: string; error?: string; latency?: number }> {
  const startTime = Date.now();
  
  try {
    switch (storageType) {
      case 'supabase': {
        // Supabase REST API 测试
        // URL 格式: https://<project>.supabase.co
        const healthUrl = `${connectionUrl}/rest/v1/`;
        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: {
            'apikey': apiKey || '',
            'Authorization': `Bearer ${apiKey || ''}`,
          },
          signal: AbortSignal.timeout(10000),
        });
        
        const latency = Date.now() - startTime;
        
        if (response.ok || response.status === 200) {
          return { success: true, message: 'Supabase connection successful', latency };
        } else if (response.status === 401) {
          return { success: false, message: 'Authentication failed', error: 'Invalid API key' };
        } else {
          return { success: false, message: 'Connection failed', error: `HTTP ${response.status}` };
        }
      }
      
      case 'firebase': {
        // Firebase Realtime Database 测试
        // URL 格式: https://<project>.firebaseio.com
        const testUrl = `${connectionUrl}/.json?shallow=true`;
        const response = await fetch(testUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
        });
        
        const latency = Date.now() - startTime;
        
        if (response.ok) {
          return { success: true, message: 'Firebase connection successful', latency };
        } else if (response.status === 401) {
          return { success: false, message: 'Authentication failed', error: 'Database rules may require authentication' };
        } else {
          return { success: false, message: 'Connection failed', error: `HTTP ${response.status}` };
        }
      }
      
      case 'custom': {
        // 自定义 REST API 测试
        // 发送 HEAD 请求测试连接
        const response = await fetch(connectionUrl, {
          method: 'HEAD',
          headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
          signal: AbortSignal.timeout(10000),
        });
        
        const latency = Date.now() - startTime;
        
        if (response.ok || response.status < 400) {
          return { success: true, message: 'Custom endpoint connection successful', latency };
        } else if (response.status === 401 || response.status === 403) {
          return { success: false, message: 'Authentication failed', error: 'Invalid credentials' };
        } else {
          return { success: false, message: 'Connection failed', error: `HTTP ${response.status}` };
        }
      }
      
      default:
        return { success: false, message: 'Unknown storage type', error: `Unsupported type: ${storageType}` };
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        return { success: false, message: 'Connection timeout', error: 'Request timed out after 10 seconds' };
      }
      if (error.message.includes('fetch')) {
        return { success: false, message: 'Network error', error: 'Unable to reach the server' };
      }
      return { success: false, message: 'Connection failed', error: error.message };
    }
    return { success: false, message: 'Connection failed', error: 'Unknown error' };
  }
}

/**
 * GET /admin/storage/stats
 * 获取同步统计信息
 */
storage.get('/admin/storage/stats', adminGuard, async (c) => {
  try {
    // 获取进度记录总数
    const totalResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM user_progress
    `).first();

    // 获取活跃用户数
    const usersResult = await c.env.DB.prepare(`
      SELECT COUNT(DISTINCT user_id) as count FROM user_progress
    `).first();

    // 获取最近同步日志
    const logsResult = await c.env.DB.prepare(`
      SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT 10
    `).all();

    // 获取今日同步统计
    const today = new Date().toISOString().split('T')[0];
    const todayStart = Math.floor(new Date(today).getTime() / 1000);
    const todayResult = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as sync_count,
        SUM(records_count) as records_total
      FROM sync_logs
      WHERE created_at >= ?
    `).bind(todayStart).first();

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        total_records: totalResult?.count || 0,
        active_users: usersResult?.count || 0,
        today_syncs: todayResult?.sync_count || 0,
        today_records: todayResult?.records_total || 0,
        recent_logs: logsResult.results,
      },
    });
  } catch (error) {
    logger.admin.error('Get stats error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: 'Failed to get storage stats',
    }, 500);
  }
});

/**
 * DELETE /admin/storage/progress
 * 清除所有播放进度（危险操作）
 */
storage.delete('/admin/storage/progress', adminGuard, async (c) => {
  try {
    await c.env.DB.prepare('DELETE FROM user_progress').run();
    await c.env.DB.prepare('DELETE FROM sync_logs').run();

    logger.admin.info('All progress data cleared');

    return c.json({
      code: 1,
      msg: 'All progress data cleared',
    });
  } catch (error) {
    logger.admin.error('Clear progress error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: 'Failed to clear progress data',
    }, 500);
  }
});

export default storage;
