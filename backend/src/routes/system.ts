/**
 * System API
 * 系统配置、版本检查、崩溃报告等接口
 */

import { Hono } from 'hono';
import { sendDingTalk, formatCrashReport } from '../utils/notify';
import { logger } from '../utils/logger';
import { castD1Results, castD1Result } from '../utils/type_helpers';
import { CACHE_CONFIG } from '../config';

type Bindings = {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
  DINGTALK_WEBHOOK?: string;
  JWT_SECRET?: string;
};

const system = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/version
 * 获取版本信息和强制更新配置
 */
system.get('/api/version', async (c) => {
  try {
    // 批量获取版本相关配置
    const configResult = await c.env.DB.prepare(`
      SELECT key, value FROM system_config 
      WHERE key IN ('app_version', 'force_update_min_ver', 'download_url', 'changelog')
    `).all();
    
    const configMap = new Map(
      (configResult.results as { key: string; value: string }[]).map(r => [r.key, r.value])
    );

    const currentVersion = configMap.get('app_version') || '1.0.0';
    const forceUpdateVersion = configMap.get('force_update_min_ver') || '1.0.0';
    const downloadUrl = configMap.get('download_url') || '';
    const changelog = configMap.get('changelog') || '';

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        current_version: currentVersion,
        force_update_version: forceUpdateVersion,
        force: false, // 客户端需要比较版本号判断是否强制更新
        url: downloadUrl,
        changelog,
      },
    });
  } catch (error) {
    logger.admin.error('Version error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get version info',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/config
 * 获取全局配置
 */
system.get('/api/config', async (c) => {
  try {
    // 获取多个配置项
    const configs = await c.env.DB.prepare(`
      SELECT key, value FROM system_config
      WHERE key IN (
        'welfare_enabled', 'welfare_password', 'ads_enabled',
        'marquee_enabled', 'marquee_text', 'marquee_link',
        'hot_search_enabled', 'hot_search_keywords',
        'permanent_urls', 'customer_service', 'official_group',
        'terms_url', 'privacy_url', 'app_download_url',
        'share_title', 'share_description'
      )
    `).all();

    // 转换为对象
    const configMap: Record<string, string | boolean | string[]> = {};
    for (const row of configs.results) {
      const key = row.key as string;
      let value: string | boolean | string[] = row.value as string;
      
      // 解析 JSON 字段
      if (key === 'permanent_urls' || key === 'hot_search_keywords') {
        try {
          value = JSON.parse(value as string);
        } catch {
          value = [];
        }
      } else if (key === 'welfare_enabled' || key === 'ads_enabled' || key === 'marquee_enabled' || key === 'hot_search_enabled') {
        value = value === 'true';
      }
      
      configMap[key] = value;
    }

    return c.json({
      code: 1,
      msg: 'success',
      data: configMap,
    });
  } catch (error) {
    logger.admin.error('Config error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get config',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/system/crash_report
 * 接收崩溃报告
 * 
 * Body:
 * - app_version: 应用版本
 * - device: 设备信息
 * - os_version: 系统版本
 * - error_message: 错误信息
 * - stack_trace: 堆栈跟踪
 */
system.post('/api/system/crash_report', async (c) => {
  try {
    const body = await c.req.json();
    const {
      app_version,
      device,
      os_version,
      error_message,
      stack_trace,
    } = body;

    logger.admin.info('Crash report received', {
      app_version,
      device,
      error_message: error_message?.substring(0, 100),
    });

    // 格式化崩溃报告
    const report = formatCrashReport({
      error: error_message || 'Unknown error',
      stack_trace,
      context: `Device: ${device || 'Unknown'}, OS: ${os_version || 'Unknown'}`,
      device_info: { platform: device, version: app_version },
      timestamp: new Date().toISOString(),
    });

    // 发送钉钉通知（如果配置了）
    if (c.env.DINGTALK_WEBHOOK) {
      try {
        await sendDingTalk(c.env.DINGTALK_WEBHOOK, report);
      } catch (notifyError) {
        logger.notify.error('Failed to send crash notification', { error: notifyError instanceof Error ? notifyError.message : String(notifyError) });
      }
    }

    return c.json({
      code: 1,
      msg: 'Crash report received',
    });
  } catch (error) {
    logger.admin.error('Crash report error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to submit crash report',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/feedback
 * 提交用户反馈
 * 
 * Body:
 * - user_id: 用户 ID（可选）
 * - content: 反馈内容（必需）
 * - contact: 联系方式（可选）
 */
system.post('/api/feedback', async (c) => {
  try {
    const body = await c.req.json();
    const { user_id, content, contact } = body;

    if (!content) {
      return c.json(
        {
          code: 0,
          msg: 'Feedback content is required',
        },
        400
      );
    }

    // 存储到数据库
    await c.env.DB.prepare(`
      INSERT INTO feedback (user_id, content, contact, status, created_at)
      VALUES (?, ?, ?, 'pending', ?)
    `).bind(
      user_id || null,
      content,
      contact || null,
      getCurrentTimestamp()
    ).run();

    // 异步发送钉钉通知
    const feedbackText = `
### 💬 用户反馈

**用户ID**: ${user_id || '游客'}  
**联系方式**: ${contact || '未提供'}  
**时间**: ${new Date().toISOString()}

---

**反馈内容**:  
${content}
`;

    if (c.env.DINGTALK_WEBHOOK) {
      c.executionCtx.waitUntil(
        sendDingTalk(c.env.DINGTALK_WEBHOOK, feedbackText)
      );
    }

    logger.admin.info('Feedback submitted', { user_id, content: content.substring(0, 50) });

    return c.json({
      code: 1,
      msg: 'Feedback submitted successfully',
    });
  } catch (error) {
    logger.admin.error('Feedback error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to submit feedback',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/app_wall
 * 获取应用墙推广列表
 */
system.get('/api/app_wall', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT id, app_name, icon_url, download_url, sort_order
      FROM app_wall
      WHERE is_active = 1
      ORDER BY sort_order ASC
    `).all();

    return c.json({
      code: 1,
      msg: 'success',
      data: result.results,
    });
  } catch (error) {
    logger.admin.error('App wall error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get app wall',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/system/crash_report
 * 上报崩溃日志
 * 
 * Body:
 * - error: 错误信息
 * - stack_trace: 堆栈跟踪
 * - context: 上下文信息
 * - device_info: 设备信息（JSON）
 * - timestamp: 时间戳
 */
system.post('/api/system/crash_report', async (c) => {
  try {
    const body = await c.req.json();
    const { error, stack_trace, context, device_info, timestamp } = body;

    // 提取用户ID（如果已登录）
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    let userId = null;
    
    if (token && c.env.JWT_SECRET) {
      try {
        const { verifyToken } = await import('../utils/jwt');
        const payload = await verifyToken(token, c.env.JWT_SECRET);
        if (payload) {
          userId = payload.user_id;
        }
      } catch (error) {
        logger.auth.debug('Invalid token', { error: error instanceof Error ? error.message : String(error) });
        // Token无效，忽略
      }
    }

    // 提取版本号
    const appVersion = typeof device_info === 'object' && device_info !== null
      ? device_info.version || '1.0.0'
      : '1.0.0';

    // 存储到数据库
    await c.env.DB.prepare(`
      INSERT INTO crash_reports (user_id, error, stack_trace, context, device_info, app_version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      error || 'Unknown error',
      stack_trace || '',
      context || '',
      JSON.stringify(device_info || {}),
      appVersion,
      getCurrentTimestamp()
    ).run();

    // 发送钉钉通知（如果配置了）
    if (c.env.DINGTALK_WEBHOOK) {
      try {
        const message = formatCrashReport({
          error,
          stack_trace,
          context,
          device_info,
          user_id: userId,
          timestamp,
        });
        await sendDingTalk(c.env.DINGTALK_WEBHOOK, message);
      } catch (notifyError) {
        logger.notify.error('Failed to send crash notification', { error: notifyError instanceof Error ? notifyError.message : String(notifyError) });
      }
    }

    logger.admin.info('Crash report received', { error, context, userId });

    return c.json({
      code: 1,
      msg: 'Crash report received',
    });
  } catch (error) {
    logger.admin.error('Crash report error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to save crash report',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/report_invalid
 * 上报播放地址失效
 * 
 * Body:
 * - vod_id: 视频ID
 * - vod_name: 视频名称
 * - play_url: 播放地址
 * - error_type: 错误类型
 */
system.post('/api/report_invalid', async (c) => {
  try {
    const body = await c.req.json();
    const { vod_id, vod_name, play_url, error_type } = body;

    if (!vod_id || !play_url) {
      return c.json(
        {
          code: 0,
          msg: 'vod_id and play_url are required',
        },
        400
      );
    }

    // 存储到数据库
    await c.env.DB.prepare(`
      INSERT INTO vod_invalid_urls (vod_id, vod_name, play_url, error_type, reported_by, reported_at)
      VALUES (?, ?, ?, ?, 'user', ?)
    `).bind(
      vod_id,
      vod_name || '',
      play_url,
      error_type || 'playback_failed',
      getCurrentTimestamp()
    ).run();

    // 标记视频为无效（可选）
    await c.env.DB.prepare(`
      UPDATE vod_cache
      SET is_valid = 0, last_check = ?
      WHERE vod_id = ?
    `).bind(getCurrentTimestamp(), vod_id).run();

    logger.admin.info('Invalid URL reported', { vod_id, vod_name, error_type });

    return c.json({
      code: 1,
      msg: 'Report received, thank you for your feedback',
    });
  } catch (error) {
    logger.admin.error('Report invalid error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to save report',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/ads/stats
 * 上报广告统计（点击/曝光）
 * 
 * Body:
 * - ad_id: 广告ID
 * - location: 广告位置
 * - event_type: 事件类型（impression/click）
 * - user_id: 用户ID（可选）
 */
system.post('/api/ads/stats', async (c) => {
  try {
    const body = await c.req.json();
    const { ad_id, location, event_type, user_id } = body;

    if (!ad_id || !location || !event_type) {
      return c.json(
        {
          code: 0,
          msg: 'Missing required parameters',
        },
        400
      );
    }

    // 记录到数据库（简化版，实际可以用专门的统计表）
    // 这里使用 KV 存储每日统计
    const today = new Date().toISOString().split('T')[0];
    const statsKey = `ad_stats:${today}:${ad_id}:${event_type}`;
    
    try {
      const currentCount = await c.env.ROBIN_CACHE.get(statsKey);
      const newCount = (parseInt(currentCount || '0') + 1).toString();
      await c.env.ROBIN_CACHE.put(statsKey, newCount, {
        expirationTtl: CACHE_CONFIG.securityEventTTL,
      });
    } catch (kvError) {
      logger.admin.error('KV stats error', { error: kvError instanceof Error ? kvError.message : String(kvError) });
    }

    logger.admin.info('Ad stats', { ad_id, location, event_type, user_id });

    return c.json({
      code: 1,
      msg: 'Stats recorded',
    });
  } catch (error) {
    logger.admin.error('Ad stats error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to record stats',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/ads/splash
 * 获取闪屏广告
 */
system.get('/api/ads/splash', async (c) => {
  try {
    // 检查广告总开关
    const adsEnabledResult = await c.env.DB.prepare(
      'SELECT value FROM system_config WHERE key = ?'
    ).bind('ads_enabled').first();

    if (adsEnabledResult?.value !== 'true') {
      return c.json({
        code: 1,
        msg: 'Ads disabled',
        data: null,
      });
    }

    // 获取闪屏广告
    const result = await c.env.DB.prepare(`
      SELECT id, content_type, media_url, action_type, action_url
      FROM ads_inventory
      WHERE location = 'splash' AND is_active = 1
      ORDER BY weight DESC, RANDOM()
      LIMIT 1
    `).first();

    if (!result) {
      return c.json({
        code: 1,
        msg: 'No splash ad available',
        data: null,
      });
    }

    return c.json({
      code: 1,
      msg: 'success',
      data: {
        id: result.id,
        content_type: result.content_type,
        media_url: result.media_url,
        action_type: result.action_type,
        action_url: result.action_url,
      },
    });
  } catch (error) {
    logger.admin.error('Splash ad error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get splash ad',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/ad/pause
 * 获取暂停广告配置（公开接口，无需认证）
 */
system.get('/api/ad/pause', async (c) => {
  try {
    const { getPauseOverlayAd } = await import('../services/ad_injector');
    const ad = await getPauseOverlayAd(c.env);
    
    if (!ad) {
      return c.json({
        code: 1,
        msg: 'No pause ad available',
        data: null,
      });
    }
    
    return c.json({
      code: 1,
      msg: 'success',
      data: {
        content_type: ad.content_type,
        media_url: ad.media_url,
        action_type: ad.action_type,
        action_url: ad.action_url,
      },
    });
  } catch (error) {
    logger.adInjector.error('Get pause ad error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get pause ad',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/domains
 * 获取可用的 API 域名列表（公开接口，供 APP 调用）
 * 返回按优先级排序的健康域名列表
 */
system.get('/api/domains', async (c) => {
  try {
    // 优先从缓存获取
    const cached = await c.env.ROBIN_CACHE.get('api_domains_list');
    if (cached) {
      return c.json(JSON.parse(cached));
    }
    
    // 从数据库获取启用且健康的域名
    const result = await c.env.DB.prepare(`
      SELECT domain, name, priority, is_primary, health_status, response_time
      FROM api_domains
      WHERE is_active = 1
      ORDER BY is_primary DESC, 
               CASE health_status WHEN 'healthy' THEN 0 WHEN 'unknown' THEN 1 ELSE 2 END,
               priority DESC,
               response_time ASC
    `).all();
    
    // 域名数据库行类型
    interface DomainDbRow {
      domain: string;
      name: string | null;
      priority: number;
      is_primary: number;
      health_status: string;
      response_time: number | null;
    }
    
    const domains = castD1Results<DomainDbRow>(result.results).map((d) => ({
      url: d.domain,
      name: d.name || '',
      primary: d.is_primary === 1,
      healthy: d.health_status === 'healthy',
      responseTime: d.response_time || 0,
    }));
    
    // 如果没有配置域名，返回当前请求的域名
    if (domains.length === 0) {
      const currentUrl = new URL(c.req.url);
      domains.push({
        url: `${currentUrl.protocol}//${currentUrl.host}`,
        name: '默认',
        primary: true,
        healthy: true,
        responseTime: 0,
      });
    }
    
    const response = {
      code: 1,
      msg: 'success',
      data: domains,
      meta: {
        updated_at: new Date().toISOString(),
      },
    };
    
    // 缓存
    await c.env.ROBIN_CACHE.put('api_domains_list', JSON.stringify(response), {
      expirationTtl: CACHE_CONFIG.domainsTTL,
    });
    
    return c.json(response);
  } catch (error) {
    logger.admin.error('Get domains error', { error: error instanceof Error ? error.message : String(error) });
    
    // 出错时返回当前域名
    const currentUrl = new URL(c.req.url);
    return c.json({
      code: 1,
      msg: 'success',
      data: [{
        url: `${currentUrl.protocol}//${currentUrl.host}`,
        name: '默认',
        primary: true,
        healthy: true,
        responseTime: 0,
      }],
      meta: {
        updated_at: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /api/announcement
 * 获取当前有效的公告（公开接口，APP 启动时调用）
 * 
 * Query:
 * - device_id: 设备ID（用于 show_once 功能）
 * - version: APP 版本号
 * - platform: 平台（android/ios）
 */
system.get('/api/announcement', async (c) => {
  try {
    const deviceId = c.req.query('device_id') || '';
    const version = c.req.query('version') || '';
    const platform = c.req.query('platform') || 'all';
    const now = getCurrentTimestamp();

    // 尝试从缓存获取
    const cacheKey = `announcement:${platform}:${version}`;
    const cached = await c.env.ROBIN_CACHE.get(cacheKey);
    
    // 公告类型
    interface AnnouncementData {
      id: number;
      title: string;
      content: string;
      type: string;
      action_type: string | null;
      action_url: string | null;
      action_text: string | null;
      image_url: string | null;
      priority: number;
      show_once: number;
      force_show: number;
      target_version: string | null;
    }
    
    let announcement: AnnouncementData | null = null;
    
    if (cached) {
      announcement = JSON.parse(cached);
    } else {
      // 查询有效公告（按优先级排序，取最高优先级的一条）
      const result = await c.env.DB.prepare(`
        SELECT id, title, content, type, action_type, action_url, action_text,
               image_url, priority, show_once, force_show, target_version
        FROM announcements
        WHERE is_active = 1
          AND (start_time IS NULL OR start_time <= ?)
          AND (end_time IS NULL OR end_time >= ?)
          AND (target_platform = 'all' OR target_platform = ?)
        ORDER BY priority DESC, created_at DESC
        LIMIT 1
      `).bind(now, now, platform).first();

      if (result) {
        announcement = castD1Result<AnnouncementData>(result);
        // 缓存
        await c.env.ROBIN_CACHE.put(cacheKey, JSON.stringify(announcement), {
          expirationTtl: CACHE_CONFIG.announcementTTL,
        });
      }
    }

    if (!announcement) {
      return c.json({ code: 1, data: null });
    }

    // 检查版本限制
    if (announcement.target_version && version) {
      // 简单版本比较：target_version 格式如 "<2.0.0" 或 ">=1.5.0"
      const targetVer = announcement.target_version as string;
      if (targetVer.startsWith('<')) {
        const maxVer = targetVer.substring(1);
        if (compareVersions(version, maxVer) >= 0) {
          return c.json({ code: 1, data: null });
        }
      } else if (targetVer.startsWith('>=')) {
        const minVer = targetVer.substring(2);
        if (compareVersions(version, minVer) < 0) {
          return c.json({ code: 1, data: null });
        }
      }
    }

    // 检查 show_once（每个设备只显示一次）
    if (announcement.show_once && deviceId) {
      const readRecord = await c.env.DB.prepare(`
        SELECT id FROM announcement_reads WHERE announcement_id = ? AND device_id = ?
      `).bind(announcement.id, deviceId).first();

      if (readRecord) {
        return c.json({ code: 1, data: null });
      }
    }

    // 更新查看次数（异步）
    c.executionCtx.waitUntil(
      c.env.DB.prepare(`
        UPDATE announcements SET view_count = view_count + 1 WHERE id = ?
      `).bind(announcement.id).run()
    );

    return c.json({
      code: 1,
      data: {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        type: announcement.type,
        action_type: announcement.action_type,
        action_url: announcement.action_url,
        action_text: announcement.action_text,
        image_url: announcement.image_url,
        force_show: announcement.force_show === 1,
        show_once: announcement.show_once === 1,
      },
    });
  } catch (error) {
    logger.admin.error('Get announcement error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 1, data: null }); // 出错时返回空，不影响 APP 启动
  }
});

/**
 * POST /api/announcement/read
 * 标记公告已读（用于 show_once 功能）
 */
system.post('/api/announcement/read', async (c) => {
  try {
    const body = await c.req.json();
    const { announcement_id, device_id } = body;

    if (!announcement_id || !device_id) {
      return c.json({ code: 0, msg: '参数不完整' }, 400);
    }

    // 记录已读
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO announcement_reads (announcement_id, device_id, read_at)
      VALUES (?, ?, ?)
    `).bind(announcement_id, device_id, getCurrentTimestamp()).run();

    return c.json({ code: 1, msg: 'ok' });
  } catch (error) {
    logger.admin.error('Mark announcement read error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 1, msg: 'ok' }); // 静默失败
  }
});

/**
 * POST /api/announcement/click
 * 记录公告点击
 */
system.post('/api/announcement/click', async (c) => {
  try {
    const body = await c.req.json();
    const { announcement_id } = body;

    if (announcement_id) {
      await c.env.DB.prepare(`
        UPDATE announcements SET click_count = click_count + 1 WHERE id = ?
      `).bind(announcement_id).run();
    }

    return c.json({ code: 1, msg: 'ok' });
  } catch (error) {
    logger.admin.error('Record announcement click error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 1, msg: 'ok' });
  }
});

/**
 * 版本号比较函数
 * 返回: -1 (v1 < v2), 0 (v1 == v2), 1 (v1 > v2)
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  const len = Math.max(parts1.length, parts2.length);
  
  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}

export default system;
