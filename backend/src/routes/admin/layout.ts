/**
 * Admin Layout API
 * 布局管理相关接口
 */

import { Hono } from 'hono';
import { CACHE_CONFIG } from '../../config';
import type { Bindings } from './types';
import type { PageModuleRow, ParsedPageModule, LayoutValidationResult, SystemConfigRow } from '../../types/database';
import { logger } from '../../utils/logger';

const layout = new Hono<{ Bindings: Bindings }>();

/**
 * 预热首页布局缓存
 */
export async function warmupLayoutCache(env: Bindings, tabId: string): Promise<void> {
  const result = await env.DB.prepare(`
    SELECT id, tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled
    FROM page_modules
    WHERE tab_id = ? AND (is_enabled IS NULL OR is_enabled = 1)
    ORDER BY sort_order ASC
  `).bind(tabId).all();

  const modules = (result.results as PageModuleRow[]).map(module => ({
    ...module,
    api_params: module.api_params ? JSON.parse(module.api_params) : null,
    ad_config: module.ad_config ? JSON.parse(module.ad_config) : null,
  }));

  // 批量获取跑马灯配置
  const marqueeConfigs = await env.DB.prepare(`
    SELECT key, value FROM system_config WHERE key IN ('marquee_enabled', 'marquee_text', 'marquee_link')
  `).all();
  
  const configMap = new Map((marqueeConfigs.results as SystemConfigRow[]).map(r => [r.key, r.value]));
  const marqueeEnabled = configMap.get('marquee_enabled') === 'true';

  const response = {
    tab_id: tabId,
    modules: modules,
    marquee_text: marqueeEnabled ? (configMap.get('marquee_text') || '') : '',
    marquee_link: marqueeEnabled ? (configMap.get('marquee_link') || '') : '',
    timestamp: Date.now(),
  };

  await env.ROBIN_CACHE.put(`layout:${tabId}`, JSON.stringify(response), { expirationTtl: CACHE_CONFIG.layoutTTL });
  logger.admin.info(`Layout cache warmed up for: ${tabId}`);
}

/**
 * GET /admin/layout
 */
layout.get('/admin/layout', async (c) => {
  try {
    const tab = c.req.query('tab') || 'featured';

    const result = await c.env.DB.prepare(`
      SELECT id, tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled
      FROM page_modules WHERE tab_id = ? ORDER BY sort_order ASC
    `).bind(tab).all();

    const modules: ParsedPageModule[] = (result.results as PageModuleRow[]).map(module => {
      try {
        return {
          ...module,
          api_params: module.api_params ? JSON.parse(module.api_params) : null,
          ad_config: module.ad_config ? JSON.parse(module.ad_config) : null,
          is_enabled: module.is_enabled !== 0,
        };
      } catch {
        return { ...module, api_params: null, ad_config: null, is_enabled: module.is_enabled !== 0 };
      }
    });

    return c.json({ code: 1, msg: 'success', data: { tab_id: tab, modules } });
  } catch (error) {
    logger.admin.error('Get layout error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get layout' }, 500);
  }
});

/**
 * POST /admin/layout
 */
layout.post('/admin/layout', async (c) => {
  try {
    const body = await c.req.json();
    const { tab_id, modules } = body;

    if (!tab_id || !modules || !Array.isArray(modules)) {
      return c.json({ code: 0, msg: 'Invalid request body' }, 400);
    }

    await c.env.DB.prepare('DELETE FROM page_modules WHERE tab_id = ?').bind(tab_id).run();

    const statements = modules.map(module =>
      c.env.DB.prepare(`
        INSERT INTO page_modules (tab_id, module_type, title, api_params, ad_config, sort_order, is_enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        tab_id,
        module.module_type,
        module.title || null,
        module.api_params ? JSON.stringify(module.api_params) : null,
        module.ad_config ? JSON.stringify(module.ad_config) : null,
        module.sort_order || 0,
        module.is_enabled !== false ? 1 : 0
      )
    );
    
    await c.env.DB.batch(statements);
    await c.env.ROBIN_CACHE.delete(`layout:${tab_id}`);

    return c.json({ code: 1, msg: 'Layout updated successfully' });
  } catch (error) {
    logger.admin.error('Update layout error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to update layout' }, 500);
  }
});

/**
 * POST /admin/layout/validate
 */
layout.post('/admin/layout/validate', async (c) => {
  try {
    const body = await c.req.json();
    const { tab_id, modules } = body;

    if (!tab_id || !modules || !Array.isArray(modules)) {
      return c.json({ code: 0, msg: 'Invalid request body' }, 400);
    }

    const results: LayoutValidationResult[] = [];
    const dataModules = ['carousel', 'grid_3x2', 'grid_3x3', 'grid_3x2_ad', 'grid_3x3_ad', 'horizontal_scroll', 'vertical_list', 'waterfall', 'timeline', 'week_timeline'];

    for (let i = 0; i < modules.length; i++) {
      const module = modules[i];
      const result: LayoutValidationResult = { module_index: i, module_type: module.module_type, module_title: module.title || `模块 ${i + 1}`, status: 'success', message: '配置正确' };

      if (!module.module_type) {
        result.status = 'error';
        result.message = '缺少模块类型';
      } else if (module.module_type === 'grid_icons') {
        if (!module.api_params?.items?.length) {
          result.status = 'error';
          result.message = '金刚区缺少items配置';
        } else if (module.api_params.items.length > 15) {
          result.status = 'warning';
          result.message = `金刚区图标过多（${module.api_params.items.length}个）`;
        }
      } else if (dataModules.includes(module.module_type) && !module.api_params?.t) {
        result.status = 'warning';
        result.message = '缺少视频类型参数（t）';
      }

      results.push(result);
    }

    if (modules.length === 0) {
      results.push({ module_index: -1, module_type: 'global', status: 'warning', message: '频道没有配置任何模块' });
    } else if (modules.length > 20) {
      results.push({ module_index: -1, module_type: 'global', status: 'warning', message: `模块数量过多（${modules.length}个）` });
    }

    return c.json({ code: 1, msg: 'Validation completed', results });
  } catch (error) {
    logger.admin.error('Validate layout error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to validate layout' }, 500);
  }
});

export default layout;
