/**
 * Statistics API
 * 统计上报接口（APP端使用）
 */

import { Hono } from 'hono';
import { logger } from '../utils/logger';

type Bindings = {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
};

const stats = new Hono<{ Bindings: Bindings }>();

// 🚀 确保 play_stats 表存在
async function ensurePlayStatsTable(db: D1Database): Promise<void> {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS play_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vod_id TEXT NOT NULL,
        vod_type TEXT NOT NULL,
        episode_index INTEGER,
        event_type TEXT NOT NULL,
        played_seconds INTEGER DEFAULT 0,
        total_seconds INTEGER DEFAULT 0,
        date TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `).run();
    
    // 创建索引（忽略已存在的错误）
    try {
      await db.prepare(`CREATE INDEX IF NOT EXISTS idx_play_stats_vod_date ON play_stats(vod_id, date)`).run();
      await db.prepare(`CREATE INDEX IF NOT EXISTS idx_play_stats_date ON play_stats(date)`).run();
      await db.prepare(`CREATE INDEX IF NOT EXISTS idx_play_stats_event_type ON play_stats(event_type, date)`).run();
    } catch (e) {
      // 索引可能已存在，忽略
    }
  } catch (e) {
    logger.stats.error('Failed to create play_stats table', { error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * POST /api/stats/module_click
 * 上报模块点击事件
 * 
 * Body:
 * - tab_id: 频道ID
 * - module_id: 模块ID
 * - module_type: 模块类型
 * - module_title: 模块标题
 * - item_id: 点击的内容ID（可选）
 */
stats.post('/api/stats/module_click', async (c) => {
  try {
    const body = await c.req.json();
    const { tab_id, module_id, module_type, module_title, item_id } = body;

    if (!tab_id || !module_type) {
      return c.json(
        {
          code: 0,
          msg: 'Missing required fields',
        },
        400
      );
    }

    const today = new Date().toISOString().split('T')[0];

    // 1. 更新或插入统计数据（使用 UPSERT）
    await c.env.DB.prepare(`
      INSERT INTO module_stats (tab_id, module_id, module_type, module_title, click_count, view_count, date, updated_at)
      VALUES (?, ?, ?, ?, 1, 0, ?, strftime('%s', 'now'))
      ON CONFLICT(tab_id, module_id, date) 
      DO UPDATE SET 
        click_count = click_count + 1,
        updated_at = strftime('%s', 'now')
    `).bind(
      tab_id,
      module_id || 0,
      module_type,
      module_title || '',
      today
    ).run();

    // 2. 记录点击明细（可选，用于详细分析）
    // 为了节省空间，可以只记录最近7天的明细
    if (item_id) {
      await c.env.DB.prepare(`
        INSERT INTO module_click_log (tab_id, module_id, module_type, item_id)
        VALUES (?, ?, ?, ?)
      `).bind(
        tab_id,
        module_id || 0,
        module_type,
        item_id
      ).run();
    }

    return c.json({
      code: 1,
      msg: 'success',
    });
  } catch (error) {
    logger.stats.error('Module click error', { error: error instanceof Error ? error.message : String(error) });
    // 统计失败不影响用户体验，返回成功
    return c.json({
      code: 1,
      msg: 'success',
    });
  }
});

/**
 * POST /api/stats/module_view
 * 上报模块曝光事件
 * 
 * Body:
 * - tab_id: 频道ID
 * - module_id: 模块ID
 * - module_type: 模块类型
 * - module_title: 模块标题
 */
stats.post('/api/stats/module_view', async (c) => {
  try {
    const body = await c.req.json();
    const { tab_id, module_id, module_type, module_title } = body;

    if (!tab_id || !module_type) {
      return c.json(
        {
          code: 0,
          msg: 'Missing required fields',
        },
        400
      );
    }

    const today = new Date().toISOString().split('T')[0];

    // 更新或插入统计数据
    await c.env.DB.prepare(`
      INSERT INTO module_stats (tab_id, module_id, module_type, module_title, click_count, view_count, date, updated_at)
      VALUES (?, ?, ?, ?, 0, 1, ?, strftime('%s', 'now'))
      ON CONFLICT(tab_id, module_id, date) 
      DO UPDATE SET 
        view_count = view_count + 1,
        updated_at = strftime('%s', 'now')
    `).bind(
      tab_id,
      module_id || 0,
      module_type,
      module_title || '',
      today
    ).run();

    return c.json({
      code: 1,
      msg: 'success',
    });
  } catch (error) {
    logger.stats.error('Module view error', { error: error instanceof Error ? error.message : String(error) });
    // 统计失败不影响用户体验，返回成功
    return c.json({
      code: 1,
      msg: 'success',
    });
  }
});

/**
 * POST /api/stats/batch
 * 批量上报统计事件（优化版，减少请求次数）
 * 
 * Body:
 * - events: 事件数组
 *   - type: 'click' | 'view'
 *   - tab_id: 频道ID
 *   - module_id: 模块ID
 *   - module_type: 模块类型
 *   - module_title: 模块标题
 *   - item_id: 内容ID（可选）
 */
stats.post('/api/stats/batch', async (c) => {
  try {
    const body = await c.req.json();
    const { events } = body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return c.json(
        {
          code: 0,
          msg: 'Invalid events',
        },
        400
      );
    }

    const today = new Date().toISOString().split('T')[0];

    // 事件类型
    interface StatsEvent {
      tab_id: string;
      module_id?: number;
      module_type: string;
      module_title?: string;
      type: 'click' | 'view';
    }

    // 聚合事件（按 tab_id + module_id 分组）
    const aggregated = new Map<string, { clicks: number; views: number; event: StatsEvent }>();

    for (const event of events as StatsEvent[]) {
      const key = `${event.tab_id}_${event.module_id || 0}`;
      if (!aggregated.has(key)) {
        aggregated.set(key, { clicks: 0, views: 0, event });
      }
      const agg = aggregated.get(key)!;
      if (event.type === 'click') {
        agg.clicks++;
      } else if (event.type === 'view') {
        agg.views++;
      }
    }

    // 批量更新
    const statements = [];
    for (const [_, { clicks, views, event }] of aggregated) {
      if (clicks > 0) {
        statements.push(
          c.env.DB.prepare(`
            INSERT INTO module_stats (tab_id, module_id, module_type, module_title, click_count, view_count, date, updated_at)
            VALUES (?, ?, ?, ?, ?, 0, ?, strftime('%s', 'now'))
            ON CONFLICT(tab_id, module_id, date) 
            DO UPDATE SET 
              click_count = click_count + ?,
              updated_at = strftime('%s', 'now')
          `).bind(
            event.tab_id,
            event.module_id || 0,
            event.module_type,
            event.module_title || '',
            clicks,
            today,
            clicks
          )
        );
      }
      if (views > 0) {
        statements.push(
          c.env.DB.prepare(`
            INSERT INTO module_stats (tab_id, module_id, module_type, module_title, click_count, view_count, date, updated_at)
            VALUES (?, ?, ?, ?, 0, ?, ?, strftime('%s', 'now'))
            ON CONFLICT(tab_id, module_id, date) 
            DO UPDATE SET 
              view_count = view_count + ?,
              updated_at = strftime('%s', 'now')
          `).bind(
            event.tab_id,
            event.module_id || 0,
            event.module_type,
            event.module_title || '',
            views,
            today,
            views
          )
        );
      }
    }

    if (statements.length > 0) {
      await c.env.DB.batch(statements);
    }

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        processed: events.length,
      },
    });
  } catch (error) {
    logger.stats.error('Batch error', { error: error instanceof Error ? error.message : String(error) });
    // 统计失败不影响用户体验，返回成功
    return c.json({
      code: 1,
      msg: 'success',
    });
  }
});

/**
 * POST /api/stats/play
 * 上报视频播放统计
 * 
 * Body:
 * - events: 播放事件数组
 *   - type: 'play_start' | 'valid_play' | 'play_complete'
 *   - vod_id: 视频ID
 *   - vod_type: 视频类型 (movie, tv, shorts)
 *   - episode_index: 集数（可选）
 *   - played_seconds: 已播放秒数（valid_play 时使用）
 *   - total_seconds: 总时长秒数（valid_play 时使用）
 *   - timestamp: 时间戳
 */
stats.post('/api/stats/play', async (c) => {
  try {
    // 🚀 确保表存在
    await ensurePlayStatsTable(c.env.DB);
    
    const body = await c.req.json();
    const { events } = body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return c.json({
        code: 0,
        msg: 'Invalid events',
      }, 400);
    }

    const today = new Date().toISOString().split('T')[0];
    const statements: D1PreparedStatement[] = [];

    // 统计有效播放次数（用于更新 vod_hits）
    const validPlayCounts = new Map<string, number>();

    for (const event of events) {
      const { type, vod_id, vod_type, episode_index, played_seconds, total_seconds } = event;

      if (!vod_id || !vod_type) continue;

      // 记录播放日志
      statements.push(
        c.env.DB.prepare(`
          INSERT INTO play_stats (vod_id, vod_type, episode_index, event_type, played_seconds, total_seconds, date, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
        `).bind(
          vod_id,
          vod_type,
          episode_index || null,
          type,
          played_seconds || 0,
          total_seconds || 0,
          today
        )
      );

      // 统计有效播放
      if (type === 'valid_play') {
        const count = validPlayCounts.get(vod_id) || 0;
        validPlayCounts.set(vod_id, count + 1);
      }
    }

    // 更新视频播放次数（vod_hits）
    for (const [vodId, count] of validPlayCounts) {
      // 更新 vod_cache 表的播放次数
      statements.push(
        c.env.DB.prepare(`
          UPDATE vod_cache 
          SET vod_hits = COALESCE(vod_hits, 0) + ?,
              vod_hits_day = COALESCE(vod_hits_day, 0) + ?,
              vod_hits_week = COALESCE(vod_hits_week, 0) + ?,
              vod_hits_month = COALESCE(vod_hits_month, 0) + ?
          WHERE vod_id = ?
        `).bind(count, count, count, count, vodId)
      );
    }

    // 批量执行
    if (statements.length > 0) {
      await c.env.DB.batch(statements);
    }

    logger.stats.info('Play stats recorded', { 
      eventCount: events.length,
      validPlays: validPlayCounts.size 
    });

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        processed: events.length,
        valid_plays: validPlayCounts.size,
      },
    });
  } catch (error) {
    logger.stats.error('Play stats error', { error: error instanceof Error ? error.message : String(error) });
    // 统计失败不影响用户体验，返回成功
    return c.json({
      code: 1,
      msg: 'success',
    });
  }
});

export default stats;
