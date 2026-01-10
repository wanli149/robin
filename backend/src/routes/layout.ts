/**
 * Dynamic Layout API
 * 首页动态布局接口
 */

import { Hono } from 'hono';
import { recordVisit } from '../utils/stats';
import { CACHE_CONFIG, TIMEOUT_CONFIG } from '../config';
import { aggregateVideos } from '../services/spider_aggregator';
import { getRecommendationsV2, RecommendStrategy } from '../services/recommendation_engine_v2';
import { logger } from '../utils/logger';
import { extractVideoMeta } from '../services/language_merger';

type Bindings = {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
};

const layout = new Hono<{ Bindings: Bindings }>();

interface PageModule {
  id: number;
  tab_id: string;
  module_type: string;
  title?: string;
  api_params?: string;
  ad_config?: string;
  sort_order: number;
  is_enabled?: number; // 新增：模块开关（1=启用，0=禁用）
}

// 视频数据类型
interface VideoItem {
  vod_id: string;
  vod_name: string;
  vod_pic?: string;
  vod_pic_thumb?: string;
  vod_remarks?: string;
  vod_year?: string;
  vod_area?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_content?: string;
  vod_time?: string;
  vod_hits?: number;
  type_id?: number;
  type_name?: string;
}

// 专题项类型
interface TopicItem {
  id: string;
  title: string;
  cover: string;
  video_count?: number;
}

// 模块数据类型（可以是视频列表、专题列表、时间线等）
type ModuleData = VideoItem[] | TopicItem[] | Record<string, VideoItem[]> | { items: VideoItem[]; tabs?: any[] } | null;

// API 参数类型
interface ApiParams {
  t?: string | number;
  pg?: number;
  limit?: number;
  class?: string;
  area?: string;
  year?: string;
  sort?: string;
  wd?: string;
  source?: string;
  category?: string;
  strategy?: string;
  type_id?: number;
  vod_id?: string;
  user_id?: string;
  topics?: Array<{ id: string; title: string; cover: string }>;
  items?: unknown[];
}

/**
 * 判断模块类型是否需要获取数据
 */
function shouldFetchData(moduleType: string): boolean {
  const dataModules = [
    // 轮播图
    'carousel',
    // 网格类
    'grid_3x2',
    'grid_3x3',
    'grid_3x2_ad',
    'grid_3x3_ad',
    // 列表类
    'horizontal_scroll',
    'vertical_list',
    'ranking',
    // 瀑布流
    'waterfall',
    'waterfall_2col',
    'waterfall_3col',
    // 时间轴
    'timeline',
    'week_timeline',
    // 分类标签页（需要获取视频数据）
    'category_tabs',
    // 演员列表（需要从数据库获取）
    'actor_list',
    // 专题列表（需要从数据库获取）
    'topic_list',
    // 推荐模块
    'recommend',
    'recommend_similar',
    'recommend_trending',
    'recommend_personalized',
  ];
  return dataModules.includes(moduleType);
}

/**
 * 对视频列表进行去重（按基础名称+年份）
 * 同一影片的不同语言/清晰度版本只保留一个
 */
function deduplicateVideos(videos: VideoItem[]): VideoItem[] {
  const seen = new Map<string, VideoItem>();
  
  for (const video of videos) {
    const { baseName } = extractVideoMeta(video.vod_name || '');
    const groupKey = `${baseName}-${video.vod_year || ''}`;
    
    // 只保留每组的第一个
    if (!seen.has(groupKey)) {
      seen.set(groupKey, video);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * 根据模块类型和参数获取数据
 */
async function fetchModuleData(
  env: Bindings,
  moduleType: string,
  apiParams: ApiParams
): Promise<ModuleData> {
  try {
    // 金刚区不需要获取视频数据（数据在 api_params.items 中）
    if (moduleType === 'grid_icons') {
      return null;
    }

    // 推荐模块处理
    if (moduleType.startsWith('recommend')) {
      return await fetchRecommendData(env, moduleType, apiParams);
    }

    // 处理特殊的数据源类型
    if (apiParams.source) {
      // 例如：{"source": "tmdb_trending"} 
      // 这里可以根据 source 类型获取不同的数据
      logger.admin.debug(`Special source: ${apiParams.source}`);
      // 暂时使用默认逻辑
    }

    // 处理搜索关键词（例如：{"wd": "短剧"}）
    if (apiParams.wd) {
      logger.admin.debug(`Search keyword: ${apiParams.wd}`);
      // 首页模块不应该使用搜索，使用缓存数据
      // 如果需要按关键词筛选，应该在缓存中搜索
      const searchResult = await aggregateVideos(env, '', { wd: apiParams.wd }, {
        timeout: TIMEOUT_CONFIG.aggregatorSearch,
        includeWelfare: false,
        cacheOnly: true,  // 首页只使用缓存数据
      });
      
      const limit = apiParams.limit || 20;
      logger.admin.debug(`Got ${searchResult.list.length} items for search: ${apiParams.wd}`);
      
      // 对搜索结果进行去重
      const deduplicatedList = deduplicateVideos(searchResult.list as VideoItem[]);
      return deduplicatedList.slice(0, limit) as VideoItem[];
    }
    
    // 处理分类参数（例如：{"category": "hot_drama"}）
    if (apiParams.category) {
      logger.admin.debug(`Category: ${apiParams.category}`);
      // 可以根据 category 映射到不同的视频类型
      // 暂时使用默认逻辑
    }

    // 确定视频类型
    let videoType = apiParams.t;
    if (!videoType) {
      // 根据模块类型或分类推断视频类型
      if (apiParams.category === 'hot_drama') {
        videoType = '2'; // 电视剧
      } else if (apiParams.category === 'shorts') {
        videoType = '5'; // 短剧
      } else {
        videoType = '1'; // 默认电影
      }
    }
    
    // 转换为字符串
    videoType = String(videoType);

    // 构建查询参数
    const params: Record<string, string | number | undefined> = {
      t: videoType,
      pg: apiParams.pg || 1,
    };

    // 可选参数
    if (apiParams.class) params.class = apiParams.class; // 视频分类
    if (apiParams.area) params.area = apiParams.area;
    if (apiParams.year) params.year = apiParams.year;
    if (apiParams.sort) params.sort = apiParams.sort;

    // 根据模块类型确定数量
    let limit = apiParams.limit;
    
    // 如果没有指定 limit，根据模块类型设置默认值
    if (!limit) {
      if (moduleType === 'grid_3x3' || moduleType === 'grid_3x3_ad') {
        limit = 9; // 3x3 网格默认 9 个
      } else if (moduleType === 'grid_3x2' || moduleType === 'grid_3x2_ad') {
        limit = 6; // 3x2 网格默认 6 个
      } else if (moduleType === 'carousel') {
        limit = 6; // 轮播图默认 6 个
      } else if (moduleType === 'horizontal_scroll') {
        limit = 10; // 横向滚动默认 10 个
      } else if (moduleType === 'waterfall' || moduleType.startsWith('waterfall_')) {
        limit = 20; // 瀑布流默认 20 个
      } else {
        limit = 10; // 其他模块默认 10 个
      }
    }
    
    // 设置最大限制
    if (moduleType === 'carousel') {
      limit = Math.min(limit, 10); // 轮播图最多10个
    } else if (moduleType.startsWith('grid_')) {
      limit = Math.min(limit, 20); // 网格最多20个
    } else if (moduleType === 'waterfall' || moduleType.startsWith('waterfall_')) {
      limit = Math.min(limit, 30); // 瀑布流最多30个
    }

    logger.admin.debug(`Fetching data for ${moduleType}, type=${videoType}, limit=${limit}, class=${params.class || 'all'}`);

    // 调用聚合器获取数据（首页只使用缓存）
    const result = await aggregateVideos(env, '', params, {
      timeout: TIMEOUT_CONFIG.defaultRequest,
      includeWelfare: false,
      cacheOnly: true,  // 首页只使用缓存数据，不实时获取
    });

    logger.admin.debug(`Got ${result.list.length} items for ${moduleType}`);

    // 对视频列表进行去重（同一影片的不同语言/清晰度版本只保留一个）
    const deduplicatedList = deduplicateVideos(result.list as VideoItem[]);
    logger.admin.debug(`After deduplication: ${deduplicatedList.length} items`);
    
    const videos = deduplicatedList.slice(0, limit) as VideoItem[];

    // 特殊处理：carousel 需要格式化字段
    if (moduleType === 'carousel') {
      return videos.map((video) => ({
        ...video,
        image_url: video.vod_pic || video.vod_pic_thumb || '',
        title: video.vod_name || '',
      }));
    }

    // 特殊处理：week_timeline 需要按星期分组
    if (moduleType === 'week_timeline') {
      return groupVideosByWeekday(videos);
    }

    // 特殊处理：timeline 需要按日期排序
    if (moduleType === 'timeline') {
      return videos.sort((a, b) => {
        const dateA = new Date(a.vod_time || a.vod_year || 0).getTime();
        const dateB = new Date(b.vod_time || b.vod_year || 0).getTime();
        return dateB - dateA; // 降序
      });
    }

    // 特殊处理：ranking 排行榜（添加排名信息）
    if (moduleType === 'ranking') {
      return videos.map((video, index) => ({
        ...video,
        rank: index + 1,
        heat: video.vod_hits || Math.floor(Math.random() * 10000) + 1000, // 热度值
      }));
    }

    // 特殊处理：category_tabs 分类标签页
    if (moduleType === 'category_tabs') {
      // 返回视频数据和子分类标签
      // 前端会根据 tabs 显示标签，items 显示视频
      return {
        items: videos,
        // tabs 将在 fetchModuleData 外部从数据库获取
      };
    }

    // 特殊处理：actor_list 演员列表
    if (moduleType === 'actor_list') {
      // 演员信息类型
      interface ActorInfo {
        name: string;
        avatar: string;
        video_count: number;
      }
      // 从视频数据中提取演员信息
      const actorMap = new Map<string, ActorInfo>();
      videos.forEach((video) => {
        const actors = (video.vod_actor || '').split(',').filter((a: string) => a.trim());
        actors.slice(0, 3).forEach((actorName: string) => {
          const name = actorName.trim();
          if (name && !actorMap.has(name)) {
            actorMap.set(name, {
              name,
              avatar: '', // 演员头像需要单独获取
              video_count: 1,
            });
          } else if (actorMap.has(name)) {
            actorMap.get(name)!.video_count++;
          }
        });
      });
      return Array.from(actorMap.values()).slice(0, apiParams.limit || 10) as unknown as VideoItem[];
    }

    // 特殊处理：topic_list 专题列表
    if (moduleType === 'topic_list') {
      // 从 api_params.topics 获取专题配置，或返回默认专题
      if (apiParams.topics && Array.isArray(apiParams.topics)) {
        return apiParams.topics as TopicItem[];
      }
      // 返回基于视频分类的默认专题
      return [
        { id: 'hot', title: '热门推荐', cover: '', video_count: videos.length },
        { id: 'new', title: '最新上映', cover: '', video_count: videos.length },
      ] as TopicItem[];
    }

    return videos;
  } catch (error) {
    logger.admin.error(`Failed to fetch data for ${moduleType}`, { error: String(error) });
    return moduleType === 'week_timeline' ? {} : [];
  }
}

/**
 * 获取推荐模块数据
 */
async function fetchRecommendData(
  env: Bindings,
  moduleType: string,
  apiParams: ApiParams
): Promise<VideoItem[]> {
  try {
    // 确定推荐策略
    let strategy: RecommendStrategy = 'trending';
    
    if (moduleType === 'recommend_similar' || apiParams.strategy === 'similar') {
      strategy = 'similar';
    } else if (moduleType === 'recommend_personalized' || apiParams.strategy === 'personalized') {
      strategy = 'personalized';
    } else if (apiParams.strategy === 'content_based') {
      strategy = 'content_based';
    } else if (apiParams.strategy === 'collaborative') {
      strategy = 'collaborative';
    } else if (apiParams.strategy === 'shorts_similar') {
      strategy = 'shorts_similar';
    } else {
      strategy = 'trending';
    }

    // 推荐模块通常使用 3x3 网格，默认 9 个
    const limit = apiParams.limit || 9;
    const typeId = apiParams.t || apiParams.type_id;
    const vodId = apiParams.vod_id;
    const userId = apiParams.user_id;

    logger.admin.debug(`Fetching recommend data: strategy=${strategy}, limit=${limit}, typeId=${typeId}`);

    const result = await getRecommendationsV2(env, {
      strategy,
      vodId,
      userId: userId ? parseInt(userId, 10) : undefined,
      typeId: typeId ? parseInt(String(typeId), 10) : undefined,
      limit,
      excludeIds: [],
    });

    logger.admin.debug(`Got ${result.list.length} recommendations for ${moduleType}`);

    return result.list as VideoItem[];
  } catch (error) {
    logger.admin.error(`Failed to fetch recommend data for ${moduleType}`, { error: String(error) });
    return [];
  }
}

/**
 * 将视频列表按星期分组
 * 用于周更时间轴组件
 */
function groupVideosByWeekday(videos: VideoItem[]): Record<string, VideoItem[]> {
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const grouped: Record<string, VideoItem[]> = {};
  
  // 初始化每天的数组
  weekdays.forEach(day => {
    grouped[day] = [];
  });

  // 将视频分配到各天（简单策略：循环分配）
  videos.forEach((video, index) => {
    const dayIndex = index % 7;
    grouped[weekdays[dayIndex]].push(video);
  });

  // 如果有更新时间信息，可以根据实际更新日期分组
  // 这里使用简单的循环分配策略
  
  logger.admin.debug(`Grouped ${videos.length} videos into weekdays`);
  
  return grouped;
}

/**
 * GET /home_layout
 * 获取首页布局配置
 * 
 * Query params:
 * - tab: 频道 ID（featured, movie, series, netflix, shorts, anime, variety, welfare）
 */
layout.get('/home_layout', async (c) => {
  try {
    const tab = c.req.query('tab') || 'featured';

    // 1. 检查 KV 缓存
    const cacheKey = `layout:${tab}`;
    const cached = await c.env.ROBIN_CACHE.get(cacheKey, 'json');
    
    if (cached) {
    logger.admin.info('Cache hit for tab', { tab });
      
      // 异步记录访问统计（不阻塞响应）
      c.executionCtx.waitUntil(recordVisit(c.env));
      
      return c.json(cached);
    }

    // 2. 查询数据库（只查询启用的模块）
    const result = await c.env.DB.prepare(`
      SELECT id, tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled
      FROM page_modules
      WHERE tab_id = ? AND (is_enabled IS NULL OR is_enabled = 1)
      ORDER BY sort_order ASC
    `).bind(tab).all();

    const modules = result.results as unknown as PageModule[];

    // 3. 解析 JSON 字段并填充数据（并发优化）
    const parsedModules = await Promise.all(modules.map(async (module) => {
      try {
        const apiParams = module.api_params ? JSON.parse(module.api_params) : null;
        const adConfig = module.ad_config ? JSON.parse(module.ad_config) : null;
        
        // 根据模块类型和 API 参数获取数据
        let data: any = null;
        if (apiParams && shouldFetchData(module.module_type)) {
          data = await fetchModuleData(c.env, module.module_type, apiParams);
          
          // 特殊处理：category_tabs 需要获取子分类标签
          if (module.module_type === 'category_tabs' && apiParams.t) {
            // 定义子分类类型
          interface SubCategoryRow {
            id: number;
            name: string;
            name_en: string | null;
          }
          
          const subCatsResult = await c.env.DB.prepare(`
              SELECT id, name, name_en FROM video_sub_categories
              WHERE parent_id = ? AND is_active = 1
              ORDER BY sort_order ASC
            `).bind(apiParams.t).all();
            
            const tabs = (subCatsResult.results as unknown as SubCategoryRow[]).map(sub => ({
              id: sub.id,
              name: sub.name,
              name_en: sub.name_en,
            }));
            
            // 合并 tabs 到 data
            if (data && typeof data === 'object') {
              data.tabs = tabs;
            } else {
              data = { items: data || [], tabs };
            }
          }
        }
        
        return {
          id: module.id,
          module_type: module.module_type,
          title: module.title || '',
          sort_order: module.sort_order,
          api_params: apiParams,
          ad_config: adConfig,
          data: data,
        };
      } catch (error) {
        logger.admin.error('Error processing module', { moduleId: module.id, error: String(error) });
        // 返回空模块，前端会跳过
        return null;
      }
    }));
    
    // 过滤掉处理失败的模块
    const validModules = parsedModules.filter(m => m !== null);

    // 4. 获取滚动通告（优化：使用缓存 + 单次批量查询）
    let marqueeText = '';
    let marqueeLink = '';
    
    const marqueeCacheKey = 'marquee_config';
    const cachedMarquee = await c.env.ROBIN_CACHE.get(marqueeCacheKey, 'json') as { enabled: boolean; text: string; link: string } | null;
    
    if (cachedMarquee) {
      marqueeText = cachedMarquee.enabled ? cachedMarquee.text : '';
      marqueeLink = cachedMarquee.enabled ? cachedMarquee.link : '';
    } else {
      // 定义系统配置行类型
    interface SystemConfigRow {
      key: string;
      value: string | null;
    }
    
    const marqueeConfigs = await c.env.DB.prepare(`
        SELECT key, value FROM system_config
        WHERE key IN ('marquee_enabled', 'marquee_text', 'marquee_link')
      `).all();
      
      const configMap = new Map(
        (marqueeConfigs.results as unknown as SystemConfigRow[]).map(r => [r.key, r.value])
      );
      
      const marqueeEnabled = configMap.get('marquee_enabled') === 'true';
      marqueeText = marqueeEnabled ? (configMap.get('marquee_text') || '') : '';
      marqueeLink = marqueeEnabled ? (configMap.get('marquee_link') || '') : '';
      
      // 缓存跑马灯配置
      await c.env.ROBIN_CACHE.put(marqueeCacheKey, JSON.stringify({
        enabled: marqueeEnabled,
        text: configMap.get('marquee_text') || '',
        link: configMap.get('marquee_link') || '',
      }), { expirationTtl: CACHE_CONFIG.marqueeTTL });
    }

    // 5. 构造响应
    const response = {
      tab_id: tab,
      modules: validModules,
      marquee_text: marqueeText,
      marquee_link: marqueeLink,
      timestamp: Date.now(),
    };

    // 6. 缓存到 KV（5 分钟）
    await c.env.ROBIN_CACHE.put(
      cacheKey,
      JSON.stringify(response),
      { expirationTtl: CACHE_CONFIG.layoutTTL }
    );

    // 7. 异步记录访问统计
    c.executionCtx.waitUntil(recordVisit(c.env));

    logger.admin.info('Fetched layout', { tab, moduleCount: modules.length });

    return c.json(response);
  } catch (error) {
    logger.admin.error('Error', { error: String(error) });
    return c.json(
      {
        error: 'Failed to fetch layout',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /home_tabs
 * 获取首页频道列表
 */
layout.get('/home_tabs', async (c) => {
  try {
    // 检查缓存（延长 TTL 到 30 分钟，tabs 变化不频繁）
    const cacheKey = 'home_tabs';
    const cached = await c.env.ROBIN_CACHE.get(cacheKey, 'json');
    
    if (cached) {
      return c.json(cached);
    }

    // 查询数据库
    const result = await c.env.DB.prepare(`
      SELECT id, title, sort_order, is_visible, is_locked
      FROM home_tabs
      WHERE is_visible = 1
      ORDER BY sort_order ASC
    `).all();

    const response = {
      tabs: result.results,
      timestamp: Date.now(),
    };

    // 缓存（tabs 配置变化不频繁）
    await c.env.ROBIN_CACHE.put(
      cacheKey,
      JSON.stringify(response),
      { expirationTtl: CACHE_CONFIG.tabsTTL }
    );

    return c.json(response);
  } catch (error) {
    logger.admin.error('Error fetching tabs', { error: String(error) });
    return c.json(
      {
        error: 'Failed to fetch tabs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// ============================================
// 频道管理 API（管理端使用）
// ============================================

/**
 * GET /admin/tabs
 * 获取所有频道（包括隐藏的）
 */
layout.get('/admin/tabs', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT id, title, sort_order, is_visible, is_locked
      FROM home_tabs
      ORDER BY sort_order ASC
    `).all();
    
    return c.json({
      code: 1,
      msg: 'success',
      data: result.results,
    });
  } catch (error) {
    return c.json({ code: 0, msg: 'Failed to get tabs' }, 500);
  }
});

/**
 * POST /admin/tabs
 * 创建新频道
 */
layout.post('/admin/tabs', async (c) => {
  try {
    const body = await c.req.json();
    const { id, title } = body;
    
    if (!id || !title) {
      return c.json({ code: 0, msg: 'ID和名称不能为空' }, 400);
    }
    
    // 获取最大排序值
    const maxOrder = await c.env.DB.prepare(`
      SELECT MAX(sort_order) as max_order FROM home_tabs
    `).first();
    const newOrder = ((maxOrder?.max_order as number) || 0) + 1;
    
    await c.env.DB.prepare(`
      INSERT INTO home_tabs (id, title, sort_order, is_visible, is_locked)
      VALUES (?, ?, ?, 1, 0)
    `).bind(id, title, newOrder).run();
    
    // 清除缓存
    await c.env.ROBIN_CACHE.delete('home_tabs');
    
    return c.json({ code: 1, msg: '创建成功' });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      return c.json({ code: 0, msg: '频道ID已存在' }, 400);
    }
    return c.json({ code: 0, msg: '创建失败' }, 500);
  }
});

/**
 * PUT /admin/tabs/:id
 * 更新频道
 */
layout.put('/admin/tabs/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { title, is_visible, is_locked } = body;
    
    // 构建动态更新语句
    const updates: string[] = [];
    const values: (string | number)[] = [];
    
    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (is_visible !== undefined) {
      updates.push('is_visible = ?');
      values.push(is_visible);
    }
    if (is_locked !== undefined) {
      updates.push('is_locked = ?');
      values.push(is_locked);
    }
    
    if (updates.length === 0) {
      return c.json({ code: 0, msg: '没有要更新的字段' }, 400);
    }
    
    values.push(id);
    
    await c.env.DB.prepare(`
      UPDATE home_tabs SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();
    
    // 清除缓存
    await c.env.ROBIN_CACHE.delete('home_tabs');
    
    return c.json({ code: 1, msg: '更新成功' });
  } catch (error) {
    logger.admin.error('Failed to update tab', { error: String(error) });
    return c.json({ code: 0, msg: '更新失败' }, 500);
  }
});

/**
 * DELETE /admin/tabs/:id
 * 删除频道
 */
layout.delete('/admin/tabs/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    // 检查是否有关联的模块
    const modules = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM page_modules WHERE tab_id = ?
    `).bind(id).first();
    
    if ((modules?.count as number) > 0) {
      return c.json({ code: 0, msg: '该频道下有模块，请先删除模块' }, 400);
    }
    
    await c.env.DB.prepare('DELETE FROM home_tabs WHERE id = ?').bind(id).run();
    
    // 清除缓存
    await c.env.ROBIN_CACHE.delete('home_tabs');
    
    return c.json({ code: 1, msg: '删除成功' });
  } catch (error) {
    return c.json({ code: 0, msg: '删除失败' }, 500);
  }
});

/**
 * POST /admin/tabs/reorder
 * 批量更新频道排序
 */
layout.post('/admin/tabs/reorder', async (c) => {
  try {
    const body = await c.req.json();
    const { orders } = body; // [{ id: 'featured', sort_order: 1 }, ...]
    
    if (!Array.isArray(orders)) {
      return c.json({ code: 0, msg: '参数错误' }, 400);
    }
    
    for (const item of orders) {
      await c.env.DB.prepare(`
        UPDATE home_tabs SET sort_order = ? WHERE id = ?
      `).bind(item.sort_order, item.id).run();
    }
    
    // 清除缓存
    await c.env.ROBIN_CACHE.delete('home_tabs');
    
    return c.json({ code: 1, msg: '排序更新成功' });
  } catch (error) {
    return c.json({ code: 0, msg: '排序更新失败' }, 500);
  }
});

export default layout;
