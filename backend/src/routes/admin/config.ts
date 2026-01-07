/**
 * Admin Config API
 * 系统配置相关接口
 */

import { Hono } from 'hono';
import type { Bindings } from './types';
import { logger } from '../../utils/logger';

const config = new Hono<{ Bindings: Bindings }>();

/**
 * POST /admin/config/welfare
 */
config.post('/admin/config/welfare', async (c) => {
  try {
    const body = await c.req.json();
    const { enabled } = body;
    await c.env.DB.prepare(`UPDATE system_config SET value = ? WHERE key = 'welfare_enabled'`).bind(enabled ? 'true' : 'false').run();
    return c.json({ code: 1, msg: 'Welfare switch updated' });
  } catch (error) {
    logger.admin.error('Welfare switch error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: 'Failed to update welfare switch' }, 500);
  }
});

/**
 * POST /admin/config/ads_global_switch
 */
config.post('/admin/config/ads_global_switch', async (c) => {
  try {
    const body = await c.req.json();
    const { enabled } = body;
    await c.env.DB.prepare(`UPDATE system_config SET value = ? WHERE key = 'ads_enabled'`).bind(enabled ? 'true' : 'false').run();
    return c.json({ code: 1, msg: 'Ads global switch updated' });
  } catch (error) {
    logger.admin.error('Ads switch error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: 'Failed to update ads switch' }, 500);
  }
});

/**
 * POST /admin/config/marquee
 */
config.post('/admin/config/marquee', async (c) => {
  try {
    const body = await c.req.json();
    const { text, link } = body;

    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE system_config SET value = ? WHERE key = 'marquee_text'`).bind(text || ''),
      c.env.DB.prepare(`UPDATE system_config SET value = ? WHERE key = 'marquee_link'`).bind(link || ''),
    ]);

    // 清除跑马灯缓存
    await c.env.ROBIN_CACHE.delete('marquee_config');

    return c.json({ code: 1, msg: 'Marquee updated' });
  } catch (error) {
    logger.admin.error('Marquee update error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: 'Failed to update marquee' }, 500);
  }
});

/**
 * POST /admin/config/marquee_switch
 */
config.post('/admin/config/marquee_switch', async (c) => {
  try {
    const body = await c.req.json();
    const { enabled } = body;
    await c.env.DB.prepare(`UPDATE system_config SET value = ? WHERE key = 'marquee_enabled'`).bind(enabled ? 'true' : 'false').run();
    await c.env.ROBIN_CACHE.delete('marquee_config');
    return c.json({ code: 1, msg: 'Marquee switch updated' });
  } catch (error) {
    logger.admin.error('Marquee switch error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: 'Failed to update marquee switch' }, 500);
  }
});

/**
 * POST /admin/config/hot_search_switch
 */
config.post('/admin/config/hot_search_switch', async (c) => {
  try {
    const body = await c.req.json();
    const { enabled } = body;
    await c.env.DB.prepare(`UPDATE system_config SET value = ? WHERE key = 'hot_search_enabled'`).bind(enabled ? 'true' : 'false').run();
    await c.env.ROBIN_CACHE.delete('hot_search_keywords');
    return c.json({ code: 1, msg: 'Hot search switch updated' });
  } catch (error) {
    logger.admin.error('Hot search switch error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: 'Failed to update hot search switch' }, 500);
  }
});

/**
 * POST /admin/config/contact
 */
config.post('/admin/config/contact', async (c) => {
  try {
    const body = await c.req.json();
    const { customer_service, official_group } = body;

    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE system_config SET value = ? WHERE key = 'customer_service'`).bind(customer_service || ''),
      c.env.DB.prepare(`UPDATE system_config SET value = ? WHERE key = 'official_group'`).bind(official_group || ''),
    ]);

    return c.json({ code: 1, msg: 'Contact info updated' });
  } catch (error) {
    logger.admin.error('Contact update error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: 'Failed to update contact info' }, 500);
  }
});

/**
 * POST /admin/config/dingtalk
 */
config.post('/admin/config/dingtalk', async (c) => {
  try {
    const body = await c.req.json();
    const { webhook } = body;
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO system_config (key, value) VALUES ('dingtalk_webhook', ?)
    `).bind(webhook || '').run();
    return c.json({ code: 1, msg: 'DingTalk webhook updated' });
  } catch (error) {
    logger.admin.error('DingTalk update error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: 'Failed to update DingTalk webhook' }, 500);
  }
});

/**
 * POST /admin/config/dingtalk/test
 */
config.post('/admin/config/dingtalk/test', async (c) => {
  try {
    const webhookResult = await c.env.DB.prepare(`SELECT value FROM system_config WHERE key = 'dingtalk_webhook'`).first();
    const webhook = webhookResult?.value as string;

    if (!webhook) {
      return c.json({ code: 0, msg: 'DingTalk webhook not configured' }, 400);
    }

    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'text',
        text: { content: `🔔 测试通知\n\n这是一条来自 Robin Video 后台的测试消息。\n时间：${new Date().toLocaleString('zh-CN')}` },
      }),
    });

    if (response.ok) {
      return c.json({ code: 1, msg: 'Test notification sent successfully' });
    } else {
      return c.json({ code: 0, msg: 'Failed to send test notification' }, 500);
    }
  } catch (error) {
    logger.admin.error('DingTalk test error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: 'Failed to send test notification' }, 500);
  }
});

/**
 * GET /admin/config/permanent_urls
 */
config.get('/admin/config/permanent_urls', async (c) => {
  try {
    const result = await c.env.DB.prepare(`SELECT value FROM system_config WHERE key = 'permanent_urls'`).first();
    const urls = result?.value ? JSON.parse(result.value as string) : [];
    return c.json({ code: 1, msg: 'success', urls });
  } catch (error) {
    logger.admin.error('Get permanent urls error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: 'Failed to get permanent urls' }, 500);
  }
});

/**
 * POST /admin/config/permanent_urls
 * 更新永久网址列表
 */
config.post('/admin/config/permanent_urls', async (c) => {
  try {
    const body = await c.req.json();
    const { urls } = body;

    if (!Array.isArray(urls)) {
      return c.json({ code: 0, msg: 'urls must be an array' }, 400);
    }

    await c.env.DB.prepare(`UPDATE system_config SET value = ? WHERE key = 'permanent_urls'`).bind(JSON.stringify(urls)).run();
    logger.admin.info('Permanent URLs updated', { count: urls.length });

    return c.json({ code: 1, msg: 'Permanent URLs updated successfully' });
  } catch (error) {
    logger.admin.error('Update permanent URLs error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to update permanent URLs' }, 500);
  }
});

/**
 * POST /admin/release
 */
config.post('/admin/release', async (c) => {
  try {
    const body = await c.req.json();
    const { version, force_update_min_ver, download_url, changelog } = body;

    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE system_config SET value = ? WHERE key = 'app_version'`).bind(version || ''),
      c.env.DB.prepare(`UPDATE system_config SET value = ? WHERE key = 'force_update_min_ver'`).bind(force_update_min_ver || ''),
      c.env.DB.prepare(`UPDATE system_config SET value = ? WHERE key = 'download_url'`).bind(download_url || ''),
      c.env.DB.prepare(`UPDATE system_config SET value = ? WHERE key = 'changelog'`).bind(changelog || ''),
    ]);

    return c.json({ code: 1, msg: 'Release info updated' });
  } catch (error) {
    logger.admin.error('Release update error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: 'Failed to update release info' }, 500);
  }
});

/**
 * POST /admin/cache/purge
 */
config.post('/admin/cache/purge', async (c) => {
  try {
    const body = await c.req.json();
    const { type } = body;

    const keysToDelete: string[] = [];

    if (type === 'layout' || type === 'all') {
      keysToDelete.push('layout:featured', 'layout:movie', 'layout:series', 'layout:netflix', 'layout:shorts', 'layout:anime', 'layout:variety', 'layout:welfare', 'home_tabs', 'marquee_config');
    }

    if (type === 'shorts' || type === 'all') {
      // 短剧缓存使用前缀 sr:
      const list = await c.env.ROBIN_CACHE.list({ prefix: 'sr:' });
      for (const key of list.keys) {
        keysToDelete.push(key.name);
      }
    }

    if (type === 'all') {
      keysToDelete.push('hot_search_keywords');
    }

    for (const key of keysToDelete) {
      try {
        await c.env.ROBIN_CACHE.delete(key);
      } catch (e) {
        // 单个缓存删除失败不影响整体清理
        logger.admin.warn('Failed to delete cache key', { key, error: e instanceof Error ? e.message : 'Unknown' });
      }
    }

    return c.json({ code: 1, msg: `Cache purged: ${keysToDelete.length} keys` });
  } catch (error) {
    logger.admin.error('Cache purge error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: 'Failed to purge cache' }, 500);
  }
});

export default config;
