/**
 * Admin Ads API
 * 广告管理相关接口
 */

import { Hono } from 'hono';
import type { Bindings } from './types';
import { logger } from '../../utils/logger';

const ads = new Hono<{ Bindings: Bindings }>();

/**
 * POST /admin/ads/migrate
 */
ads.post('/admin/ads/migrate', async (c) => {
  try {
    const { migrateAds } = await import('../../scripts/migrate_ads');
    const result = await migrateAds(c.env);
    return c.json({ code: result.success ? 1 : 0, msg: result.message, data: { changes: result.changes } });
  } catch (error) {
    logger.admin.error('Ads migration error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Migration failed' }, 500);
  }
});

/**
 * GET /admin/ads
 */
ads.get('/admin/ads', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT id, name, location, content_type, media_url, action_type, action_url, 
             weight, sort_order, is_active, start_time, end_time, daily_limit, remark, created_at
      FROM ads_inventory ORDER BY location, sort_order ASC
    `).all();
    return c.json({ code: 1, msg: 'success', list: result.results });
  } catch (error) {
    logger.admin.error('Get ads error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get ads' }, 500);
  }
});

/**
 * POST /admin/ads
 */
ads.post('/admin/ads', async (c) => {
  try {
    const body = await c.req.json();
    const { id, name, location, content_type, media_url, action_type, action_url, weight, start_time, end_time, daily_limit, remark, is_active } = body;
    const now = Math.floor(Date.now() / 1000);

    if (id) {
      await c.env.DB.prepare(`
        UPDATE ads_inventory SET name = ?, location = ?, content_type = ?, media_url = ?, action_type = ?, action_url = ?, 
        weight = ?, start_time = ?, end_time = ?, daily_limit = ?, remark = ?, is_active = ?, updated_at = ? WHERE id = ?
      `).bind(name || null, location, content_type, media_url, action_type, action_url, weight || 1, 
              start_time || null, end_time || null, daily_limit || 0, remark || null, is_active !== false ? 1 : 0, now, id).run();
    } else {
      await c.env.DB.prepare(`
        INSERT INTO ads_inventory (name, location, content_type, media_url, action_type, action_url, weight, is_active, start_time, end_time, daily_limit, remark, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
      `).bind(name || null, location, content_type, media_url, action_type, action_url, weight || 1, 
              start_time || null, end_time || null, daily_limit || 0, remark || null, now, now).run();
    }

    return c.json({ code: 1, msg: 'Ad saved successfully' });
  } catch (error) {
    logger.admin.error('Save ad error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to save ad' }, 500);
  }
});

/**
 * DELETE /admin/ads/:id
 */
ads.delete('/admin/ads/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM ads_inventory WHERE id = ?').bind(id).run();
    return c.json({ code: 1, msg: 'Ad deleted successfully' });
  } catch (error) {
    logger.admin.error('Delete ad error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to delete ad' }, 500);
  }
});

/**
 * GET /admin/ads/stats
 */
ads.get('/admin/ads/stats', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7');
    const adId = c.req.query('ad_id');
    
    // 定义统计结果类型
    interface OverallStats {
      total_impressions: number;
      total_clicks: number;
    }
    
    const overallStats = await c.env.DB.prepare(`
      SELECT 
        COUNT(DISTINCT CASE WHEN event_type = 'impression' THEN id END) as total_impressions,
        COUNT(DISTINCT CASE WHEN event_type = 'click' THEN id END) as total_clicks
      FROM ads_stats WHERE created_at > strftime('%s', 'now', '-${days} days')
      ${adId ? 'AND ad_id = ?' : ''}
    `).bind(...(adId ? [adId] : [])).first() as OverallStats | null;
    
    const dailyStats = await c.env.DB.prepare(`
      SELECT date(created_at, 'unixepoch') as date,
        COUNT(CASE WHEN event_type = 'impression' THEN 1 END) as impressions,
        COUNT(CASE WHEN event_type = 'click' THEN 1 END) as clicks
      FROM ads_stats WHERE created_at > strftime('%s', 'now', '-${days} days')
      ${adId ? 'AND ad_id = ?' : ''}
      GROUP BY date(created_at, 'unixepoch') ORDER BY date DESC
    `).bind(...(adId ? [adId] : [])).all();
    
    const adStats = await c.env.DB.prepare(`
      SELECT a.id, a.name, a.location,
        COUNT(CASE WHEN s.event_type = 'impression' THEN 1 END) as impressions,
        COUNT(CASE WHEN s.event_type = 'click' THEN 1 END) as clicks
      FROM ads_inventory a
      LEFT JOIN ads_stats s ON a.id = s.ad_id AND s.created_at > strftime('%s', 'now', '-${days} days')
      GROUP BY a.id ORDER BY impressions DESC
    `).all();
    
    const totalImpressions = overallStats?.total_impressions || 0;
    const totalClicks = overallStats?.total_clicks || 0;
    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        overview: { total_impressions: totalImpressions, total_clicks: totalClicks, ctr: parseFloat(ctr) },
        daily: dailyStats.results,
        by_ad: adStats.results,
      },
    });
  } catch (error) {
    logger.admin.error('Get ads stats error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get stats' }, 500);
  }
});

/**
 * GET /admin/ads/list-simple
 */
ads.get('/admin/ads/list-simple', async (c) => {
  try {
    const location = c.req.query('location');
    let query = `SELECT id, name, location, media_url FROM ads_inventory WHERE is_active = 1`;
    if (location) query += ` AND location = '${location}'`;
    query += ` ORDER BY name ASC`;
    
    const result = await c.env.DB.prepare(query).all();
    return c.json({ code: 1, msg: 'success', list: result.results });
  } catch (error) {
    logger.admin.error('Get ads list error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get ads list' }, 500);
  }
});

export default ads;
