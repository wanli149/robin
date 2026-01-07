/**
 * Admin Sources API
 * 资源站管理相关接口
 */

import { Hono } from 'hono';
import type { Bindings } from './types';
import { logger } from '../../utils/logger';

const sources = new Hono<{ Bindings: Bindings }>();

/**
 * GET /admin/sources
 * 获取所有视频资源站
 */
sources.get('/admin/sources', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT id, name, api_url, weight, is_active, sort_order, response_format
      FROM video_sources
      ORDER BY weight DESC, sort_order ASC
    `).all();

    return c.json({ code: 1, msg: 'success', list: result.results });
  } catch (error) {
    logger.admin.error('Get sources error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to get sources' }, 500);
  }
});

/**
 * POST /admin/sources
 * 创建或更新视频资源站
 */
sources.post('/admin/sources', async (c) => {
  try {
    const body = await c.req.json();
    const { id, name, api_url, weight, is_active, response_format } = body;

    if (!name || !api_url) {
      return c.json({ code: 0, msg: 'name and api_url are required' }, 400);
    }

    const validFormats = ['json', 'xml', 'auto'];
    const format = validFormats.includes(response_format) ? response_format : 'auto';

    if (id) {
      await c.env.DB.prepare(`
        UPDATE video_sources SET name = ?, api_url = ?, weight = ?, is_active = ?, response_format = ? WHERE id = ?
      `).bind(name, api_url, weight || 50, is_active ? 1 : 0, format, id).run();
      logger.admin.info('Source updated', { id });
    } else {
      const result = await c.env.DB.prepare(`
        INSERT INTO video_sources (name, api_url, weight, is_active, response_format, sort_order)
        VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM video_sources))
      `).bind(name, api_url, weight || 50, is_active ? 1 : 0, format).run();
      logger.admin.info('Source created', { id: result.meta.last_row_id });
    }

    return c.json({ code: 1, msg: id ? 'Source updated successfully' : 'Source created successfully' });
  } catch (error) {
    logger.admin.error('Save source error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to save source' }, 500);
  }
});

/**
 * DELETE /admin/sources/:id
 * 删除视频资源站
 */
sources.delete('/admin/sources/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM video_sources WHERE id = ?').bind(id).run();
    logger.admin.info('Source deleted', { id });
    return c.json({ code: 1, msg: 'Source deleted successfully' });
  } catch (error) {
    logger.admin.error('Delete source error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to delete source' }, 500);
  }
});

/**
 * PATCH /admin/sources/:id/toggle
 * 切换资源站启用状态
 */
sources.patch('/admin/sources/:id/toggle', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare(`UPDATE video_sources SET is_active = NOT is_active WHERE id = ?`).bind(id).run();
    logger.admin.info('Source toggled', { id });
    return c.json({ code: 1, msg: 'Source status toggled successfully' });
  } catch (error) {
    logger.admin.error('Toggle source error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to toggle source status' }, 500);
  }
});

/**
 * POST /admin/sources/:id/test
 * 测试资源站连接（支持多格式：JSON/XML）
 */
sources.post('/admin/sources/:id/test', async (c) => {
  try {
    const id = c.req.param('id');

    const source = await c.env.DB.prepare(
      'SELECT name, api_url, response_format FROM video_sources WHERE id = ?'
    ).bind(id).first();

    if (!source) {
      return c.json({ code: 0, msg: 'Source not found' }, 404);
    }

    const { testSourceConnection } = await import('../../services/response_parser');
    const result = await testSourceConnection(source.api_url as string);
    
    logger.admin.info('Test source result', { id, format: result.format, responseTime: result.responseTime, videoCount: result.videoCount });

    if (result.success) {
      const savedFormat = source.response_format || 'auto';
      if (savedFormat === 'auto' && result.format !== 'auto') {
        await c.env.DB.prepare('UPDATE video_sources SET response_format = ? WHERE id = ?').bind(result.format, id).run();
        logger.admin.info('Auto-detected format for source', { id, format: result.format });
      }
      
      return c.json({
        code: 1,
        msg: 'Connection successful',
        details: {
          responseTime: result.responseTime,
          videoCount: result.videoCount,
          format: result.format,
          status: 'healthy',
        },
      });
    } else {
      return c.json({
        code: 0,
        msg: result.error || 'Connection failed',
        details: {
          responseTime: result.responseTime,
          format: result.format,
          status: result.error?.includes('timeout') ? 'timeout' : 'error',
        },
      });
    }
  } catch (error) {
    logger.admin.error('Test source error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Failed to test source' }, 500);
  }
});

/**
 * POST /admin/sources/:id/detect-categories
 */
sources.post('/admin/sources/:id/detect-categories', async (c) => {
  try {
    const sourceId = parseInt(c.req.param('id'));
    const source = await c.env.DB.prepare(`SELECT id, name, api_url, response_format FROM video_sources WHERE id = ?`).bind(sourceId).first();
    
    if (!source) return c.json({ code: 0, msg: 'Source not found' }, 404);
    
    const apiUrl = source.api_url as string;
    const url = new URL(apiUrl);
    url.searchParams.set('ac', 'list');
    
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!response.ok) return c.json({ code: 0, msg: `HTTP ${response.status}` }, 500);
    
    const text = await response.text();
    const categories: Array<{ id: string; name: string; count?: number }> = [];
    
    // 从 XML 提取分类
    const classMatches = text.matchAll(/<ty[^>]*id="(\d+)"[^>]*>([^<]+)<\/ty>/gi);
    for (const match of classMatches) {
      categories.push({ id: match[1], name: match[2].trim() });
    }
    
    // 从视频列表统计分类
    if (categories.length === 0) {
      const typeMap = new Map<string, { name: string; count: number }>();
      
      const tidMatches = text.matchAll(/<tid>(\d+)<\/tid>[\s\S]*?<type>([^<]+)<\/type>/gi);
      for (const match of tidMatches) {
        const tid = match[1];
        const typeName = match[2].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
        if (!typeMap.has(tid)) typeMap.set(tid, { name: typeName, count: 0 });
        typeMap.get(tid)!.count++;
      }
      
      try {
        const json = JSON.parse(text);
        if (json.list && Array.isArray(json.list)) {
          for (const item of json.list) {
            const tid = String(item.type_id || item.tid || '');
            const typeName = item.type_name || item.type || '';
            if (tid && typeName) {
              if (!typeMap.has(tid)) typeMap.set(tid, { name: typeName, count: 0 });
              typeMap.get(tid)!.count++;
            }
          }
        }
      } catch (e) {
        // JSON 解析失败，使用 XML 解析结果
        logger.admin.debug('JSON parse failed, using XML results', { error: e instanceof Error ? e.message : 'Unknown' });
      }
      
      for (const [id, info] of typeMap) {
        categories.push({ id, name: info.name, count: info.count });
      }
    }
    
    categories.sort((a, b) => parseInt(a.id) - parseInt(b.id));
    
    return c.json({
      code: 1, msg: 'success',
      data: { sourceName: source.name, totalCategories: categories.length, categories },
    });
  } catch (error) {
    logger.admin.error('Detect categories error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Detection failed' }, 500);
  }
});

/**
 * POST /admin/sources/test-classify
 */
sources.post('/admin/sources/test-classify', async (c) => {
  try {
    const body = await c.req.json();
    const { vod_name, type_name, type_id, vod_remarks, vod_content } = body;
    
    if (!vod_name) return c.json({ code: 0, msg: 'vod_name is required' }, 400);
    
    const { autoClassify, loadMappingsFromDb, loadSubCategoriesFromDb } = await import('../../services/auto_classifier');
    
    const dbMappings = await loadMappingsFromDb(c.env);
    const dbSubCategories = await loadSubCategoriesFromDb(c.env);
    
    const result = autoClassify({ vod_name, type_name, type_id, vod_remarks, vod_content }, dbMappings, dbSubCategories);
    
    return c.json({
      code: 1, msg: 'success',
      data: {
        input: { vod_name, type_name, type_id, vod_remarks },
        result: { typeId: result.typeId, typeName: result.typeName, subTypeId: result.subTypeId, subTypeName: result.subTypeName, confidence: result.confidence, method: result.classifyMethod },
      },
    });
  } catch (error) {
    logger.admin.error('Test classify error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Test failed' }, 500);
  }
});

/**
 * POST /admin/sources/:id/sync-categories
 * 从资源站同步分类映射（自动生成分类映射表）
 */
sources.post('/admin/sources/:id/sync-categories', async (c) => {
  try {
    const sourceId = parseInt(c.req.param('id'));
    const source = await c.env.DB.prepare(`SELECT id, name, api_url, response_format FROM video_sources WHERE id = ?`).bind(sourceId).first();
    
    if (!source) return c.json({ code: 0, msg: 'Source not found' }, 404);
    
    const apiUrl = source.api_url as string;
    const sourceName = source.name as string;
    const url = new URL(apiUrl);
    url.searchParams.set('ac', 'list');
    
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!response.ok) return c.json({ code: 0, msg: `HTTP ${response.status}` }, 500);
    
    const text = await response.text();
    const categories: Array<{ id: string; name: string }> = [];
    
    // 从 XML <class> 标签提取分类
    const classMatches = text.matchAll(/<ty[^>]*id="(\d+)"[^>]*>([^<]+)<\/ty>/gi);
    for (const match of classMatches) {
      categories.push({ id: match[1], name: match[2].trim() });
    }
    
    if (categories.length === 0) {
      return c.json({ code: 0, msg: '未能从资源站获取分类信息' }, 400);
    }
    
    // 导入分类识别函数
    const { classifyByTypeName, clearMappingCache } = await import('../../services/auto_classifier');
    
    // 确保分类映射表存在
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS category_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        source_name TEXT,
        source_type_id TEXT NOT NULL,
        source_type_name TEXT,
        target_category_id INTEGER NOT NULL,
        UNIQUE(source_id, source_type_id)
      )
    `).run();
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const mappings: Array<{ sourceTypeId: string; sourceTypeName: string; targetCategoryId: number; targetCategoryName: string }> = [];
    
    for (const cat of categories) {
      // 使用 classifyByTypeName 智能识别目标分类
      const result = classifyByTypeName(cat.name);
      
      if (!result) {
        skipped++;
        continue;
      }
      
      // 检查是否已存在
      const existing = await c.env.DB.prepare(`
        SELECT id FROM category_mappings WHERE source_id = ? AND source_type_id = ?
      `).bind(sourceId, cat.id).first();
      
      if (existing) {
        // 更新
        await c.env.DB.prepare(`
          UPDATE category_mappings SET source_name = ?, source_type_name = ?, target_category_id = ? WHERE id = ?
        `).bind(sourceName, cat.name, result.typeId, existing.id).run();
        updated++;
      } else {
        // 创建
        await c.env.DB.prepare(`
          INSERT INTO category_mappings (source_id, source_name, source_type_id, source_type_name, target_category_id)
          VALUES (?, ?, ?, ?, ?)
        `).bind(sourceId, sourceName, cat.id, cat.name, result.typeId).run();
        created++;
      }
      
      mappings.push({
        sourceTypeId: cat.id,
        sourceTypeName: cat.name,
        targetCategoryId: result.typeId,
        targetCategoryName: result.typeName,
      });
    }
    
    // 清除缓存
    clearMappingCache();
    
    return c.json({
      code: 1,
      msg: `同步完成: 新增 ${created}, 更新 ${updated}, 跳过 ${skipped}`,
      data: {
        sourceName,
        totalCategories: categories.length,
        created,
        updated,
        skipped,
        mappings,
      },
    });
  } catch (error) {
    logger.admin.error('Sync categories error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Sync failed' }, 500);
  }
});

/**
 * POST /admin/sources/sync-all-categories
 * 同步所有资源站的分类映射
 */
sources.post('/admin/sources/sync-all-categories', async (c) => {
  try {
    const sourcesResult = await c.env.DB.prepare(`
      SELECT id, name, api_url FROM video_sources WHERE is_active = 1
    `).all();
    
    if (!sourcesResult.results || sourcesResult.results.length === 0) {
      return c.json({ code: 0, msg: '没有可用的资源站' }, 400);
    }
    
    const { classifyByTypeName, clearMappingCache } = await import('../../services/auto_classifier');
    
    // 确保分类映射表存在
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS category_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        source_name TEXT,
        source_type_id TEXT NOT NULL,
        source_type_name TEXT,
        target_category_id INTEGER NOT NULL,
        UNIQUE(source_id, source_type_id)
      )
    `).run();
    
    // 定义资源站行类型
    interface SourceRow {
      id: number;
      name: string;
      api_url: string;
    }
    
    const results: Array<{ sourceName: string; success: boolean; created: number; updated: number; error?: string }> = [];
    
    for (const source of sourcesResult.results as SourceRow[]) {
      try {
        const url = new URL(source.api_url);
        url.searchParams.set('ac', 'list');
        
        const response = await fetch(url.toString(), {
          signal: AbortSignal.timeout(15000),
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });
        
        if (!response.ok) {
          results.push({ sourceName: source.name, success: false, created: 0, updated: 0, error: `HTTP ${response.status}` });
          continue;
        }
        
        const text = await response.text();
        const categories: Array<{ id: string; name: string }> = [];
        
        const classMatches = text.matchAll(/<ty[^>]*id="(\d+)"[^>]*>([^<]+)<\/ty>/gi);
        for (const match of classMatches) {
          categories.push({ id: match[1], name: match[2].trim() });
        }
        
        let created = 0;
        let updated = 0;
        
        for (const cat of categories) {
          const result = classifyByTypeName(cat.name);
          if (!result) continue;
          
          const existing = await c.env.DB.prepare(`
            SELECT id FROM category_mappings WHERE source_id = ? AND source_type_id = ?
          `).bind(source.id, cat.id).first();
          
          if (existing) {
            await c.env.DB.prepare(`
              UPDATE category_mappings SET source_name = ?, source_type_name = ?, target_category_id = ? WHERE id = ?
            `).bind(source.name, cat.name, result.typeId, existing.id).run();
            updated++;
          } else {
            await c.env.DB.prepare(`
              INSERT INTO category_mappings (source_id, source_name, source_type_id, source_type_name, target_category_id)
              VALUES (?, ?, ?, ?, ?)
            `).bind(source.id, source.name, cat.id, cat.name, result.typeId).run();
            created++;
          }
        }
        
        results.push({ sourceName: source.name, success: true, created, updated });
      } catch (error) {
        results.push({ sourceName: source.name, success: false, created: 0, updated: 0, error: error instanceof Error ? error.message : 'Unknown' });
      }
    }
    
    // 清除缓存
    clearMappingCache();
    
    const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
    const successCount = results.filter(r => r.success).length;
    
    return c.json({
      code: 1,
      msg: `同步完成: ${successCount}/${results.length} 个资源站成功, 新增 ${totalCreated}, 更新 ${totalUpdated}`,
      data: { results },
    });
  } catch (error) {
    logger.admin.error('Sync all categories error', { error: error instanceof Error ? error.message : 'Unknown' });
    return c.json({ code: 0, msg: 'Sync failed' }, 500);
  }
});

export default sources;
