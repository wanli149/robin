/**
 * Statistics Tracking Service
 * Records API access statistics and user activity
 */

import { logger } from '../utils/logger';
import { generatePlaceholders } from '../utils/sql';

interface Env {
  DB: D1Database;
}

/**
 * Record visit statistics
 * Uses INSERT ... ON CONFLICT DO UPDATE syntax to update daily stats
 * Executes asynchronously without blocking the main request
 * 
 * @param env - Cloudflare Workers environment variables
 * @param userId - Optional user ID for unique user counting
 */
export async function recordVisit(env: Env, userId?: number): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Use SQLite INSERT OR REPLACE syntax
    // Updates if record exists, inserts if not
    await env.DB.prepare(`
      INSERT INTO daily_stats (date, api_calls, unique_users)
      VALUES (?, 1, ?)
      ON CONFLICT(date) DO UPDATE SET
        api_calls = api_calls + 1,
        unique_users = CASE 
          WHEN ? IS NOT NULL THEN unique_users + 1
          ELSE unique_users
        END
    `).bind(today, userId ? 1 : 0, userId ?? null).run();

    logger.stats.info(`Recorded visit for ${today}`);
  } catch (error) {
    // Stats failure should not affect main flow
    logger.stats.error('Failed to record visit', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * 获取最近 N 天的统计数据
 * 
 * @param env - Cloudflare Workers 环境变量
 * @param days - 天数，默认 7 天
 * @returns 统计数据数组
 */
export async function getRecentStats(
  env: Env,
  days: number = 7
): Promise<Array<{
  date: string;
  api_calls: number;
  unique_users: number;
}>> {
  try {
    const result = await env.DB.prepare(`
      SELECT date, api_calls, unique_users
      FROM daily_stats
      ORDER BY date DESC
      LIMIT ?
    `).bind(days).all();

    return result.results as Array<{
      date: string;
      api_calls: number;
      unique_users: number;
    }>;
  } catch (error) {
    logger.stats.error('Failed to get recent stats', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

/**
 * 获取总用户数
 * 
 * @param env - Cloudflare Workers 环境变量
 * @returns 总用户数
 */
export async function getTotalUsers(env: Env): Promise<number> {
  try {
    const result = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM users
    `).first();

    return (result?.count as number) || 0;
  } catch (error) {
    logger.stats.error('Failed to get total users', { error: error instanceof Error ? error.message : String(error) });
    return 0;
  }
}

/**
 * 获取今日统计
 * 
 * @param env - Cloudflare Workers 环境变量
 * @returns 今日统计数据
 */
export async function getTodayStats(env: Env): Promise<{
  api_calls: number;
  unique_users: number;
}> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await env.DB.prepare(`
      SELECT api_calls, unique_users
      FROM daily_stats
      WHERE date = ?
    `).bind(today).first();

    if (result) {
      return {
        api_calls: result.api_calls as number,
        unique_users: result.unique_users as number,
      };
    }

    return { api_calls: 0, unique_users: 0 };
  } catch (error) {
    logger.stats.error('Failed to get today stats', { error: error instanceof Error ? error.message : String(error) });
    return { api_calls: 0, unique_users: 0 };
  }
}
