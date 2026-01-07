/**
 * Ad Injector Service
 * 广告注入服务，在内容列表中插入广告
 */

import { logger } from '../utils/logger';

interface Env {
  DB: D1Database;
}

interface User {
  is_vip: boolean;
}

interface AdItem {
  id: number;
  location: string;
  content_type: string; // 'image' | 'video'
  media_url: string;
  action_type: string; // 'browser' | 'webview' | 'deeplink'
  action_url: string;
  weight: number;
  is_active: boolean;
}

interface AdConfig {
  insert_index?: number; // 插入位置索引
  frequency?: number; // 插入频率（每 N 个内容插入一次）
}

// 广告对象类型
interface AdObject {
  _type: 'ad';
  ad_id: number;
  content_type: string;
  media_url: string;
  action_type: string;
  action_url: string;
}

// 内容项类型（泛型支持）
type ContentItem<T = Record<string, unknown>> = T | AdObject;

/**
 * 检查全局广告开关
 */
async function isAdsEnabled(env: Env): Promise<boolean> {
  try {
    const result = await env.DB.prepare(
      'SELECT value FROM system_config WHERE key = ?'
    ).bind('ads_enabled').first();

    return result?.value === 'true';
  } catch (error) {
    logger.adInjector.error('Error checking ads enabled', { error: String(error) });
    return false;
  }
}

/**
 * 从广告库中随机选择广告
 * 根据 location 和 weight 加权随机选择
 */
async function selectAd(
  env: Env,
  location: string
): Promise<AdItem | null> {
  try {
    const result = await env.DB.prepare(`
      SELECT id, location, content_type, media_url, action_type, action_url, weight
      FROM ads_inventory
      WHERE location = ? AND is_active = 1
      ORDER BY RANDOM()
      LIMIT 1
    `).bind(location).first();

    return result as AdItem | null;
  } catch (error) {
    logger.adInjector.error('Error selecting ad', { error: String(error) });
    return null;
  }
}

/**
 * 在内容列表中注入广告
 * 
 * @param items - 原始内容列表
 * @param config - 广告配置（插入位置、频率等）
 * @param env - Cloudflare Workers 环境变量
 * @param user - 用户信息（用于判断 VIP 状态）
 * @param location - 广告位置标识
 * @returns 注入广告后的内容列表
 */
export async function injectAds<T extends Record<string, unknown>>(
  items: T[],
  config: AdConfig,
  env: Env,
  user?: User,
  location: string = 'insert_grid'
): Promise<ContentItem<T>[]> {
  try {
    // 1. 检查全局广告开关
    const adsEnabled = await isAdsEnabled(env);
    if (!adsEnabled) {
      logger.adInjector.debug('Ads globally disabled');
      return items;
    }

    // 2. 检查用户 VIP 状态
    if (user?.is_vip) {
      logger.adInjector.debug('User is VIP, skipping ads');
      return items;
    }

    // 3. 如果内容列表为空，直接返回
    if (!items || items.length === 0) {
      return items;
    }

    // 4. 选择广告
    const ad = await selectAd(env, location);
    if (!ad) {
      logger.adInjector.debug('No ad available for location', { location });
      return items;
    }

    // 5. 构造广告对象
    const adObject: AdObject = {
      _type: 'ad', // 标记为广告
      ad_id: ad.id,
      content_type: ad.content_type,
      media_url: ad.media_url,
      action_type: ad.action_type,
      action_url: ad.action_url,
    };

    // 6. 根据配置注入广告
    const result: ContentItem<T>[] = [...items];
    
    if (config.insert_index !== undefined) {
      // 在指定位置插入单个广告
      const index = Math.min(config.insert_index, result.length);
      result.splice(index, 0, adObject);
      logger.adInjector.debug('Injected ad at index', { index });
    } else if (config.frequency) {
      // 按频率插入多个广告
      let insertCount = 0;
      for (let i = config.frequency - 1; i < result.length; i += config.frequency + insertCount) {
        result.splice(i, 0, { ...adObject });
        insertCount++;
      }
      logger.adInjector.debug('Injected ads with frequency', { count: insertCount, frequency: config.frequency });
    } else {
      // 默认在第 4 个位置插入
      const defaultIndex = Math.min(3, result.length);
      result.splice(defaultIndex, 0, adObject);
      logger.adInjector.debug('Injected ad at default index', { index: defaultIndex });
    }

    return result;
  } catch (error) {
    logger.adInjector.error('Error injecting ads', { error: String(error) });
    return items; // 出错时返回原始列表
  }
}

/**
 * 获取开屏广告
 * 
 * @param env - Cloudflare Workers 环境变量
 * @returns 开屏广告对象
 */
export async function getSplashAd(env: Env): Promise<AdItem | null> {
  try {
    // 检查全局广告开关
    const adsEnabled = await isAdsEnabled(env);
    if (!adsEnabled) {
      return null;
    }

    return await selectAd(env, 'splash');
  } catch (error) {
    logger.adInjector.error('Error getting splash ad', { error: String(error) });
    return null;
  }
}

/**
 * 获取暂停贴片广告
 * 
 * @param env - Cloudflare Workers 环境变量
 * @returns 暂停贴片广告对象
 */
export async function getPauseOverlayAd(env: Env): Promise<AdItem | null> {
  try {
    // 检查全局广告开关
    const adsEnabled = await isAdsEnabled(env);
    if (!adsEnabled) {
      return null;
    }

    return await selectAd(env, 'pause_overlay');
  } catch (error) {
    logger.adInjector.error('Error getting pause overlay ad', { error: String(error) });
    return null;
  }
}

/**
 * 记录广告展示
 * 可用于后续统计分析
 * 
 * @param env - Cloudflare Workers 环境变量
 * @param adId - 广告 ID
 * @param userId - 用户 ID（可选）
 */
export async function recordAdImpression(
  env: Env,
  adId: number,
  userId?: number
): Promise<void> {
  try {
    // 记录广告展示
    logger.adInjector.debug('Ad impression recorded', { adId, userId });
    
    // 未来可以扩展：
    // await env.DB.prepare(`
    //   INSERT INTO ad_impressions (ad_id, user_id, timestamp)
    //   VALUES (?, ?, ?)
    // `).bind(adId, userId, Math.floor(Date.now() / 1000)).run();
  } catch (error) {
    logger.adInjector.error('Error recording ad impression', { error: String(error) });
  }
}
