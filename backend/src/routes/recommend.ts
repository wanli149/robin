/**
 * Recommend API
 * 推荐系统统一接口
 */

import { Hono } from 'hono';
import { logger } from '../utils/logger';
import {
  getRecommendationsV2,
  RecommendStrategy,
} from '../services/recommendation_engine_v2';

type Bindings = {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
};

const recommend = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/recommend
 * 统一推荐接口
 * 
 * Query params:
 * - strategy: 推荐策略 (content_based, collaborative, trending, personalized, similar, shorts_similar)
 * - vod_id: 基于某个视频推荐（similar, content_based, shorts_similar）
 * - user_id: 用户ID（personalized, collaborative）
 * - type_id: 限定分类
 * - limit: 返回数量（默认9，适配3x3网格）
 * - exclude: 排除的视频ID（逗号分隔）
 */
recommend.get('/api/recommend', async (c) => {
  try {
    const strategy = (c.req.query('strategy') || 'trending') as RecommendStrategy;
    const vodId = c.req.query('vod_id');
    const userId = c.req.query('user_id');
    const typeId = c.req.query('type_id');
    const limit = parseInt(c.req.query('limit') || '9', 10); // 默认9个，适配3x3网格
    const exclude = c.req.query('exclude');

    const excludeIds = exclude ? exclude.split(',').filter(Boolean) : [];

    const result = await getRecommendationsV2(c.env, {
      strategy,
      vodId,
      userId: userId ? parseInt(userId, 10) : undefined,
      typeId: typeId ? parseInt(typeId, 10) : undefined,
      limit,
      excludeIds,
    });

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        list: result.list,
        strategy: result.strategy,
        cached: result.cached,
        confidence: result.confidence,
      },
    });
  } catch (error) {
    logger.recommend.error('Error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: error instanceof Error ? error.message : 'Unknown error',
      data: { list: [] },
    }, 500);
  }
});

/**
 * GET /api/recommend/similar/:vodId
 * 相似视频推荐（用于详情页"猜你喜欢"）
 */
recommend.get('/api/recommend/similar/:vodId', async (c) => {
  try {
    const vodId = c.req.param('vodId');
    const limit = parseInt(c.req.query('limit') || '9', 10); // 默认9个，适配3x3网格
    const exclude = c.req.query('exclude');

    const excludeIds = exclude ? exclude.split(',').filter(Boolean) : [];
    excludeIds.push(vodId); // 排除当前视频

    const result = await getRecommendationsV2(c.env, {
      strategy: 'similar',
      vodId,
      limit,
      excludeIds,
    });

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        list: result.list,
        confidence: result.confidence,
      },
    });
  } catch (error) {
    logger.recommend.error('Similar error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: error instanceof Error ? error.message : 'Unknown error',
      data: { list: [] },
    }, 500);
  }
});

/**
 * GET /api/recommend/shorts/:vodId
 * 短剧相似推荐
 */
recommend.get('/api/recommend/shorts/:vodId', async (c) => {
  try {
    const vodId = c.req.param('vodId');
    const limit = parseInt(c.req.query('limit') || '9', 10); // 默认9个，适配3x3网格
    const exclude = c.req.query('exclude');

    const excludeIds = exclude ? exclude.split(',').filter(Boolean) : [];
    excludeIds.push(vodId);

    const result = await getRecommendationsV2(c.env, {
      strategy: 'shorts_similar',
      vodId,
      limit,
      excludeIds,
    });

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        list: result.list,
        confidence: result.confidence,
      },
    });
  } catch (error) {
    logger.recommend.error('Shorts error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: error instanceof Error ? error.message : 'Unknown error',
      data: { list: [] },
    }, 500);
  }
});

/**
 * GET /api/recommend/trending
 * 热门趋势推荐
 */
recommend.get('/api/recommend/trending', async (c) => {
  try {
    const typeId = c.req.query('type_id');
    const limit = parseInt(c.req.query('limit') || '10', 10);

    const result = await getRecommendationsV2(c.env, {
      strategy: 'trending',
      typeId: typeId ? parseInt(typeId, 10) : undefined,
      limit,
    });

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        list: result.list,
        cached: result.cached,
      },
    });
  } catch (error) {
    logger.recommend.error('Trending error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: error instanceof Error ? error.message : 'Unknown error',
      data: { list: [] },
    }, 500);
  }
});

/**
 * GET /api/recommend/personalized
 * 个性化推荐（需要用户ID）
 */
recommend.get('/api/recommend/personalized', async (c) => {
  try {
    const userId = c.req.query('user_id');
    const typeId = c.req.query('type_id');
    const limit = parseInt(c.req.query('limit') || '10', 10);

    if (!userId) {
      // 无用户ID，降级到热门推荐
      const result = await getRecommendationsV2(c.env, {
        strategy: 'trending',
        typeId: typeId ? parseInt(typeId, 10) : undefined,
        limit,
      });

      return c.json({
        code: 1,
        msg: 'success',
        data: {
          list: result.list,
          strategy: 'trending', // 标记实际使用的策略
          fallback: true,
        },
      });
    }

    const result = await getRecommendationsV2(c.env, {
      strategy: 'personalized',
      userId: parseInt(userId, 10),
      typeId: typeId ? parseInt(typeId, 10) : undefined,
      limit,
    });

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        list: result.list,
        strategy: result.strategy,
        confidence: result.confidence,
      },
    });
  } catch (error) {
    logger.recommend.error('Personalized error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      code: 0,
      msg: error instanceof Error ? error.message : 'Unknown error',
      data: { list: [] },
    }, 500);
  }
});

export default recommend;
