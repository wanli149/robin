/**
 * Admin Dashboard API
 * 仪表板和统计相关接口
 */

import { Hono } from 'hono';
import { getRecentStats, getTotalUsers } from '../../utils/stats';
import type { Bindings } from './types';
import { logger } from '../../utils/logger';

const dashboard = new Hono<{ Bindings: Bindings }>();

/**
 * GET /admin/dashboard
 * 获取管理后台仪表板数据
 */
dashboard.get('/admin/dashboard', async (c) => {
  try {
    const stats = await getRecentStats(c.env, 7);
    const totalUsers = await getTotalUsers(c.env);

    const today = new Date().toISOString().split('T')[0];
    const todayStats = stats.find(s => s.date === today) || {
      api_calls: 0,
      unique_users: 0,
    };

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        stats: stats.reverse(),
        total_users: totalUsers,
        today_active: todayStats.unique_users,
        today_api_calls: todayStats.api_calls,
        server_status: 'healthy',
      },
    });
  } catch (error) {
    logger.admin.error('[Admin] Dashboard error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({
      code: 0,
      msg: 'Failed to get dashboard data',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /admin/stats/hot-videos
 * 获取热门视频排行
 */
dashboard.get('/admin/stats/hot-videos', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '20');
    const period = c.req.query('period') || 'day';

    const orderField = period === 'week' ? 'vod_hits_week' : period === 'month' ? 'vod_hits_month' : 'vod_hits_day';

    const result = await c.env.DB.prepare(`
      SELECT vod_id, vod_name, vod_pic, vod_score, vod_hits, vod_hits_day, vod_hits_week, vod_hits_month
      FROM vod_cache
      WHERE is_valid = 1
      ORDER BY ${orderField} DESC
      LIMIT ?
    `).bind(limit).all();

    return c.json({
      code: 1,
      msg: 'success',
      list: result.results,
    });
  } catch (error) {
    logger.admin.error('[Admin] Hot videos error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get hot videos' }, 500);
  }
});

/**
 * GET /admin/stats/rating-distribution
 * 获取评分分布统计
 */
dashboard.get('/admin/stats/rating-distribution', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT 
        CASE 
          WHEN vod_score >= 9 THEN '9-10分'
          WHEN vod_score >= 8 THEN '8-9分'
          WHEN vod_score >= 7 THEN '7-8分'
          WHEN vod_score >= 6 THEN '6-7分'
          WHEN vod_score >= 5 THEN '5-6分'
          ELSE '5分以下'
        END as score_range,
        COUNT(*) as count
      FROM vod_cache
      WHERE is_valid = 1 AND vod_score > 0
      GROUP BY score_range
      ORDER BY vod_score DESC
    `).all();

    return c.json({
      code: 1,
      msg: 'success',
      data: result.results,
    });
  } catch (error) {
    logger.admin.error('[Admin] Rating distribution error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get rating distribution' }, 500);
  }
});

/**
 * GET /admin/stats/recommendation-performance
 * 获取推荐系统性能统计
 */
dashboard.get('/admin/stats/recommendation-performance', async (c) => {
  try {
    // 检查表是否存在并有数据
    let totalVideos = 0;
    let avgRecommendations = 0;
    let lastUpdate: number | null = null;

    try {
      const totalResult = await c.env.DB.prepare(`
        SELECT COUNT(DISTINCT vod_id) as count FROM vod_recommendations
      `).first();
      totalVideos = (totalResult?.count as number) || 0;

      if (totalVideos > 0) {
        const avgResult = await c.env.DB.prepare(`
          SELECT AVG(rec_count) as avg_count
          FROM (SELECT vod_id, COUNT(*) as rec_count FROM vod_recommendations GROUP BY vod_id)
        `).first();
        avgRecommendations = Math.round((avgResult?.avg_count as number) || 0);

        const lastUpdateResult = await c.env.DB.prepare(`
          SELECT MAX(updated_at) as last_update FROM vod_recommendations
        `).first();
        lastUpdate = (lastUpdateResult?.last_update as number) || null;
      }
    } catch (e) {
      // 表可能不存在，返回默认值
      logger.admin.debug('vod_recommendations table may not exist', { error: e instanceof Error ? e.message : 'Unknown' });
    }

    // 获取总视频数用于计算覆盖率
    const totalVodResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM vod_cache WHERE is_valid = 1
    `).first();
    const totalVod = (totalVodResult?.count as number) || 0;

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        total_videos: totalVideos,
        total_vod: totalVod,
        coverage: totalVod > 0 ? Math.round((totalVideos / totalVod) * 100) : 0,
        avg_recommendations: avgRecommendations,
        last_update: lastUpdate,
      },
    });
  } catch (error) {
    logger.admin.error('[Admin] Recommendation performance error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get recommendation performance' }, 500);
  }
});

/**
 * POST /admin/recommend/precompute
 * 触发推荐预计算任务
 */
dashboard.post('/admin/recommend/precompute', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const limit = body.limit || 100;

    const { batchPrecomputeRecommendations } = await import('../../services/recommendation_engine_v2');
    
    // 异步执行，不阻塞响应
    c.executionCtx.waitUntil(
      batchPrecomputeRecommendations(c.env, limit)
    );

    return c.json({
      code: 1,
      msg: `推荐预计算任务已启动，将处理 ${limit} 个视频`,
    });
  } catch (error) {
    logger.admin.error('[Admin] Precompute recommendations error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to start precompute task' }, 500);
  }
});

/**
 * GET /admin/stats/api-performance
 * 获取API性能统计
 */
dashboard.get('/admin/stats/api-performance', async (c) => {
  try {
    const hours = parseInt(c.req.query('hours') || '1');
    return c.json({
      code: 1,
      msg: 'success',
      data: {
        avg_response_time: 0,
        total_requests: 0,
        error_rate: 0,
        period_hours: hours,
      },
    });
  } catch (error) {
    logger.admin.error('[Admin] API performance error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get API performance' }, 500);
  }
});

/**
 * GET /admin/dashboard/realtime
 */
dashboard.get('/admin/dashboard/realtime', async (c) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const oneHourAgo = now - 3600;
    const oneDayAgo = now - 86400;

    let hourlyActive = 0;
    try {
      const result = await c.env.DB.prepare(`SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE created_at > ?`).bind(oneHourAgo).first();
      hourlyActive = (result?.count as number) || 0;
    } catch (e) {
      logger.admin.warn('Failed to get hourly active users', { error: e instanceof Error ? e.message : 'Unknown' });
    }

    const videoStats = await c.env.DB.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN is_valid = 1 THEN 1 ELSE 0 END) as valid,
      SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) as today_new FROM vod_cache
    `).bind(oneDayAgo).first();

    const sourceStats = await c.env.DB.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active FROM video_sources`).first();

    let pendingFeedback = 0;
    try {
      const result = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM feedback WHERE status = 'pending'`).first();
      pendingFeedback = (result?.count as number) || 0;
    } catch (e) {
      logger.admin.warn('Failed to get pending feedback count', { error: e instanceof Error ? e.message : 'Unknown' });
    }

    return c.json({
      code: 1, msg: 'success',
      data: {
        hourly_active: hourlyActive,
        videos: { total: (videoStats?.total as number) || 0, valid: (videoStats?.valid as number) || 0, today_new: (videoStats?.today_new as number) || 0 },
        sources: { total: (sourceStats?.total as number) || 0, active: (sourceStats?.active as number) || 0 },
        pending_feedback: pendingFeedback, timestamp: now,
      },
    });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to get realtime stats' }, 500);
  }
});

/**
 * GET /admin/dashboard/trends
 */
dashboard.get('/admin/dashboard/trends', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '30');
    const trends: Array<{ date: string; new_videos: number }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const startTs = Math.floor(new Date(dateStr).getTime() / 1000);
      const endTs = startTs + 86400;

      const result = await c.env.DB.prepare(`SELECT COUNT(*) as new_videos FROM vod_cache WHERE created_at >= ? AND created_at < ?`).bind(startTs, endTs).first();
      trends.push({ date: dateStr, new_videos: (result?.new_videos as number) || 0 });
    }

    return c.json({ code: 1, msg: 'success', data: trends });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to get trends' }, 500);
  }
});

export default dashboard;
