/**
 * Admin System API
 * 系统管理相关接口（版本、缓存、去重、修复等）
 */

import { Hono } from 'hono';
import type { Bindings } from './types';
import type { SystemConfigRow, CacheStatusItem, DbQueryParam, InvalidUrlRow } from '../../types/database';
import { logger } from '../../utils/logger';

const system = new Hono<{ Bindings: Bindings }>();

// ============================================
// 版本管理
// ============================================

/**
 * GET /admin/versions
 */
system.get('/admin/versions', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT id, version, url, force_update, changelog, platform, download_count, created_at
      FROM app_versions ORDER BY created_at DESC LIMIT 50
    `).all();
    return c.json({ code: 1, msg: 'success', data: result.results });
  } catch (error) {
    return c.json({ code: 1, msg: 'success', data: [] });
  }
});

/**
 * POST /admin/versions
 */
system.post('/admin/versions', async (c) => {
  try {
    const body = await c.req.json();
    const { version, url, force, changelog, platform } = body;

    if (!version || !url) return c.json({ code: 0, msg: 'version and url are required' }, 400);

    const now = Math.floor(Date.now() / 1000);

    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS app_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, version TEXT NOT NULL, url TEXT NOT NULL,
        force_update INTEGER DEFAULT 0, changelog TEXT, platform TEXT DEFAULT 'android',
        download_count INTEGER DEFAULT 0, created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `).run();

    await c.env.DB.prepare(`INSERT INTO app_versions (version, url, force_update, changelog, platform, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(version, url, force ? 1 : 0, changelog || '', platform || 'android', now).run();

    await c.env.DB.prepare(`INSERT OR REPLACE INTO system_config (key, value) VALUES ('app_version', ?)`).bind(version).run();

    if (force) {
      await c.env.DB.prepare(`INSERT OR REPLACE INTO system_config (key, value) VALUES ('force_update_min_ver', ?)`).bind(version).run();
    }

    return c.json({ code: 1, msg: 'Version released successfully' });
  } catch (error) {
    logger.admin.error('Release version error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to release version' }, 500);
  }
});

/**
 * DELETE /admin/versions/:id
 */
system.delete('/admin/versions/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM app_versions WHERE id = ?').bind(id).run();
    return c.json({ code: 1, msg: 'success' });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to delete version' }, 500);
  }
});

// ============================================
// 配置管理增强
// ============================================

/**
 * GET /admin/config/all
 */
system.get('/admin/config/all', async (c) => {
  try {
    const result = await c.env.DB.prepare(`SELECT key, value FROM system_config`).all();
    const config: Record<string, unknown> = {};
    for (const row of result.results as SystemConfigRow[]) {
      try { config[row.key] = JSON.parse(row.value || ''); }
      catch {
        if (row.value === 'true') config[row.key] = true;
        else if (row.value === 'false') config[row.key] = false;
        else config[row.key] = row.value;
      }
    }
    return c.json({ code: 1, msg: 'success', data: config });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to get config' }, 500);
  }
});

/**
 * POST /admin/config/batch
 */
system.post('/admin/config/batch', async (c) => {
  try {
    const body = await c.req.json();
    const { configs } = body;

    if (!configs || typeof configs !== 'object') return c.json({ code: 0, msg: 'configs is required' }, 400);

    for (const [key, value] of Object.entries(configs)) {
      const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      await c.env.DB.prepare(`INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)`).bind(key, strValue).run();
    }

    return c.json({ code: 1, msg: 'success' });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to update config' }, 500);
  }
});

/**
 * POST /admin/config/switch/:key
 */
system.post('/admin/config/switch/:key', async (c) => {
  try {
    const key = c.req.param('key');
    const body = await c.req.json();
    const { enabled } = body;

    await c.env.DB.prepare(`INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)`).bind(key, enabled ? 'true' : 'false').run();
    return c.json({ code: 1, msg: 'success' });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to update switch' }, 500);
  }
});

/**
 * POST /admin/config/share
 */
system.post('/admin/config/share', async (c) => {
  try {
    const body = await c.req.json();
    const { download_url, share_title, share_description } = body;
    
    await c.env.DB.prepare(`INSERT OR REPLACE INTO system_config (key, value) VALUES ('app_download_url', ?)`).bind(download_url).run();
    await c.env.DB.prepare(`INSERT OR REPLACE INTO system_config (key, value) VALUES ('share_title', ?)`).bind(share_title).run();
    await c.env.DB.prepare(`INSERT OR REPLACE INTO system_config (key, value) VALUES ('share_description', ?)`).bind(share_description).run();
    
    return c.json({ code: 1, msg: 'Share config updated successfully' });
  } catch (error) {
    logger.admin.error('Update share config error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to update share config' }, 500);
  }
});

// ============================================
// 缓存管理
// ============================================

/**
 * GET /admin/cache/stats
 */
system.get('/admin/cache/stats', async (c) => {
  try {
    const tabs = ['featured', 'movie', 'series', 'netflix', 'shorts', 'anime', 'variety', 'welfare'];
    const cacheStatus: CacheStatusItem[] = [];

    for (const tab of tabs) {
      const cached = await c.env.ROBIN_CACHE.get(`layout:${tab}`);
      cacheStatus.push({ key: `layout:${tab}`, exists: !!cached, size: cached ? cached.length : 0 });
    }

    return c.json({ code: 1, msg: 'success', data: { caches: cacheStatus, total_keys: cacheStatus.filter(c => c.exists).length } });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to get cache stats' }, 500);
  }
});

/**
 * DELETE /admin/cache/:key
 */
system.delete('/admin/cache/:key', async (c) => {
  try {
    const key = c.req.param('key');
    await c.env.ROBIN_CACHE.delete(key);
    return c.json({ code: 1, msg: 'success' });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to delete cache' }, 500);
  }
});

// ============================================
// 去重管理
// ============================================

/**
 * GET /admin/dedup/diagnostics
 */
system.get('/admin/dedup/diagnostics', async (c) => {
  try {
    const { analyzeDuplicates } = await import('../../services/collector_v2');
    const diagnostics = await analyzeDuplicates(c.env);
    return c.json({ code: 1, msg: 'success', data: diagnostics });
  } catch (error) {
    logger.admin.error('Dedup diagnostics error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to analyze duplicates' }, 500);
  }
});

/**
 * POST /admin/dedup/merge
 */
system.post('/admin/dedup/merge', async (c) => {
  try {
    const body = await c.req.json();
    const { vodName } = body;
    
    if (!vodName) return c.json({ code: 0, msg: 'vodName is required' }, 400);
    
    const { mergeDuplicateVideos } = await import('../../services/collector_v2');
    const result = await mergeDuplicateVideos(c.env, vodName);
    
    return c.json({ code: result.merged ? 1 : 0, msg: result.message });
  } catch (error) {
    logger.admin.error('Dedup merge error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to merge duplicates' }, 500);
  }
});

/**
 * POST /admin/dedup/cleanup
 */
system.post('/admin/dedup/cleanup', async (c) => {
  try {
    const { cleanupDuplicates } = await import('../../services/collector_v2');
    const result = await cleanupDuplicates(c.env);
    return c.json({ code: 1, msg: 'success', data: result });
  } catch (error) {
    logger.admin.error('Dedup cleanup error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to cleanup duplicates' }, 500);
  }
});

// ============================================
// 统计和报告
// ============================================

/**
 * GET /admin/module-stats
 */
system.get('/admin/module-stats', async (c) => {
  try {
    const tabId = c.req.query('tab_id');
    const days = parseInt(c.req.query('days') || '7');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    let query = `
      SELECT tab_id, module_id, module_type, module_title, SUM(view_count) as total_views, SUM(click_count) as total_clicks,
      CAST(SUM(click_count) AS REAL) / NULLIF(SUM(view_count), 0) * 100 as click_rate
      FROM module_stats WHERE date >= ? AND date <= ?
    `;
    const params: DbQueryParam[] = [startDateStr, endDateStr];

    if (tabId) { query += ' AND tab_id = ?'; params.push(tabId); }
    query += ' GROUP BY tab_id, module_id, module_type, module_title ORDER BY total_views DESC';

    const result = await c.env.DB.prepare(query).bind(...params).all();
    return c.json({ code: 1, msg: 'success', data: { stats: result.results, date_range: { start: startDateStr, end: endDateStr, days } } });
  } catch (error) {
    logger.admin.error('Get module stats error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get module stats' }, 500);
  }
});

/**
 * GET /admin/crash-reports
 */
system.get('/admin/crash-reports', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const result = await c.env.DB.prepare(`
      SELECT id, user_id, error, context, device_info, app_version, created_at
      FROM crash_reports ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    const countResult = await c.env.DB.prepare('SELECT COUNT(*) as total FROM crash_reports').first();
    return c.json({ code: 1, msg: 'success', data: { list: result.results, total: countResult?.total || 0 } });
  } catch (error) {
    logger.admin.error('Get crash reports error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get crash reports' }, 500);
  }
});

/**
 * GET /admin/invalid-urls
 */
system.get('/admin/invalid-urls', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const isFixed = c.req.query('is_fixed');

    let query = `SELECT id, vod_id, vod_name, play_url, error_type, reported_by, reported_at, is_fixed FROM vod_invalid_urls`;
    const bindings: DbQueryParam[] = [];

    if (isFixed !== undefined) { query += ' WHERE is_fixed = ?'; bindings.push(isFixed === 'true' ? 1 : 0); }
    query += ' ORDER BY reported_at DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const result = await c.env.DB.prepare(query).bind(...bindings).all();

    const countQuery = isFixed !== undefined ? 'SELECT COUNT(*) as total FROM vod_invalid_urls WHERE is_fixed = ?' : 'SELECT COUNT(*) as total FROM vod_invalid_urls';
    const countBindings = isFixed !== undefined ? [isFixed === 'true' ? 1 : 0] : [];
    const countResult = await c.env.DB.prepare(countQuery).bind(...countBindings).first();

    return c.json({ code: 1, msg: 'success', data: { list: result.results, total: countResult?.total || 0 } });
  } catch (error) {
    logger.admin.error('Get invalid URLs error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get invalid URLs' }, 500);
  }
});

/**
 * PATCH /admin/invalid-urls/:id/fix
 */
system.patch('/admin/invalid-urls/:id/fix', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare(`UPDATE vod_invalid_urls SET is_fixed = 1 WHERE id = ?`).bind(id).run();
    return c.json({ code: 1, msg: 'Marked as fixed' });
  } catch (error) {
    logger.admin.error('Fix invalid URL error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to mark as fixed' }, 500);
  }
});

// ============================================
// 视频修复
// ============================================

export default system;
