/**
 * Admin API - 域名管理
 * 管理 API 域名配置、健康检测、自动切换
 */

import { Hono } from 'hono';
import type { Bindings } from './types';
import { logger } from '../../utils/logger';

// 域名数据库行类型
interface DomainDbRow {
  id: number;
  domain: string;
  name: string | null;
  priority: number;
  is_active: number;
  is_primary: number;
  health_status: string | null;
  last_check_at: number | null;
  response_time: number | null;
  fail_count: number;
  created_at: number;
  updated_at: number;
}

const domains = new Hono<{ Bindings: Bindings }>();

/**
 * 获取域名列表
 */
domains.get('/admin/domains', async (c) => {
  const env = c.env;
  
  try {
    const result = await env.DB.prepare(`
      SELECT id, domain, name, priority, is_active, is_primary, 
             health_status, last_check_at, response_time, fail_count,
             created_at, updated_at
      FROM api_domains
      ORDER BY is_primary DESC, priority DESC, id ASC
    `).all();
    
    return c.json({ 
      code: 1, 
      data: { 
        domains: (result.results || []).map((d: DomainDbRow) => ({
          ...d,
          is_active: d.is_active === 1,
          is_primary: d.is_primary === 1,
        }))
      } 
    });
  } catch (error) {
    logger.admin.error('Get domains list error', { error: String(error) });
    return c.json({ code: 0, msg: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * 添加域名
 */
domains.post('/admin/domains', async (c) => {
  const env = c.env;
  const body = await c.req.json();
  
  try {
    const { domain, name, priority, is_primary } = body;
    
    if (!domain) {
      return c.json({ code: 0, msg: '域名不能为空' });
    }
    
    // 验证域名格式
    try {
      new URL(domain);
    } catch {
      return c.json({ code: 0, msg: '域名格式不正确，需要包含协议（如 https://）' });
    }
    
    // 检查是否已存在
    const existing = await env.DB.prepare(
      'SELECT id FROM api_domains WHERE domain = ?'
    ).bind(domain).first();
    
    if (existing) {
      return c.json({ code: 0, msg: '域名已存在' });
    }
    
    // 如果设为主域名，先取消其他主域名
    if (is_primary) {
      await env.DB.prepare('UPDATE api_domains SET is_primary = 0').run();
    }
    
    await env.DB.prepare(`
      INSERT INTO api_domains (domain, name, priority, is_active, is_primary)
      VALUES (?, ?, ?, 1, ?)
    `).bind(domain, name || '', priority || 100, is_primary ? 1 : 0).run();
    
    return c.json({ code: 1, msg: '域名添加成功' });
  } catch (error) {
    logger.admin.error('Add domain error', { error: String(error) });
    return c.json({ code: 0, msg: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * 更新域名
 */
domains.put('/admin/domains/:id', async (c) => {
  const env = c.env;
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json();
  
  try {
    const { domain, name, priority, is_active, is_primary } = body;
    
    // 如果设为主域名，先取消其他主域名
    if (is_primary) {
      await env.DB.prepare('UPDATE api_domains SET is_primary = 0').run();
    }
    
    await env.DB.prepare(`
      UPDATE api_domains 
      SET domain = ?, name = ?, priority = ?, is_active = ?, is_primary = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      domain, 
      name || '', 
      priority || 100, 
      is_active ? 1 : 0, 
      is_primary ? 1 : 0,
      Math.floor(Date.now() / 1000),
      id
    ).run();
    
    return c.json({ code: 1, msg: '域名更新成功' });
  } catch (error) {
    logger.admin.error('Update domain error', { error: String(error) });
    return c.json({ code: 0, msg: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * 删除域名
 */
domains.delete('/admin/domains/:id', async (c) => {
  const env = c.env;
  const id = parseInt(c.req.param('id'));
  
  try {
    // 检查是否为主域名
    const domain = await env.DB.prepare(
      'SELECT is_primary FROM api_domains WHERE id = ?'
    ).bind(id).first() as { is_primary: number } | null;
    
    if (domain?.is_primary) {
      return c.json({ code: 0, msg: '不能删除主域名，请先设置其他域名为主域名' });
    }
    
    await env.DB.prepare('DELETE FROM api_domains WHERE id = ?').bind(id).run();
    
    return c.json({ code: 1, msg: '域名已删除' });
  } catch (error) {
    logger.admin.error('Delete domain error', { error: String(error) });
    return c.json({ code: 0, msg: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * 设为主域名
 */
domains.post('/admin/domains/:id/set-primary', async (c) => {
  const env = c.env;
  const id = parseInt(c.req.param('id'));
  
  try {
    // 取消所有主域名
    await env.DB.prepare('UPDATE api_domains SET is_primary = 0').run();
    
    // 设置新的主域名
    await env.DB.prepare(
      'UPDATE api_domains SET is_primary = 1, updated_at = ? WHERE id = ?'
    ).bind(Math.floor(Date.now() / 1000), id).run();
    
    return c.json({ code: 1, msg: '已设为主域名' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.admin.error('Set primary error', { error: errorMessage });
    return c.json({ code: 0, msg: errorMessage });
  }
});

/**
 * 检测单个域名健康状态
 */
domains.post('/admin/domains/:id/check', async (c) => {
  const env = c.env;
  const id = parseInt(c.req.param('id'));
  
  try {
    const domain = await env.DB.prepare(
      'SELECT domain FROM api_domains WHERE id = ?'
    ).bind(id).first() as { domain: string } | null;
    
    if (!domain) {
      return c.json({ code: 0, msg: '域名不存在' });
    }
    
    const result = await checkDomainHealth(domain.domain);
    
    // 更新健康状态
    await env.DB.prepare(`
      UPDATE api_domains 
      SET health_status = ?, last_check_at = ?, response_time = ?, 
          fail_count = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      result.healthy ? 'healthy' : 'unhealthy',
      new Date().toISOString(),
      result.responseTime,
      result.healthy ? 0 : 1,
      Math.floor(Date.now() / 1000),
      id
    ).run();
    
    return c.json({ 
      code: 1, 
      data: result,
      msg: result.healthy ? '域名可用' : `域名不可用: ${result.error}`
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.admin.error('Check domain error', { error: errorMessage });
    return c.json({ code: 0, msg: errorMessage });
  }
});

/**
 * 检测所有域名健康状态
 */
domains.post('/admin/domains/check-all', async (c) => {
  const env = c.env;
  
  try {
    const result = await env.DB.prepare(
      'SELECT id, domain FROM api_domains WHERE is_active = 1'
    ).all();
    
    const domainList = result.results as DomainDbRow[];
    const results: Array<{ id: number; domain: string; healthy: boolean; responseTime: number; error?: string }> = [];
    
    for (const domain of domainList) {
      const checkResult = await checkDomainHealth(domain.domain);
      
      // 更新健康状态
      const currentDomain = await env.DB.prepare(
        'SELECT fail_count FROM api_domains WHERE id = ?'
      ).bind(domain.id).first() as { fail_count: number } | null;
      
      const newFailCount = checkResult.healthy ? 0 : (currentDomain?.fail_count || 0) + 1;
      
      await env.DB.prepare(`
        UPDATE api_domains 
        SET health_status = ?, last_check_at = ?, response_time = ?, 
            fail_count = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        checkResult.healthy ? 'healthy' : 'unhealthy',
        new Date().toISOString(),
        checkResult.responseTime,
        newFailCount,
        Math.floor(Date.now() / 1000),
        domain.id
      ).run();
      
      results.push({
        id: domain.id,
        domain: domain.domain,
        ...checkResult,
      });
    }
    
    const healthy = results.filter(r => r.healthy).length;
    const unhealthy = results.filter(r => !r.healthy).length;
    
    return c.json({ 
      code: 1, 
      data: { results, healthy, unhealthy },
      msg: `检测完成：${healthy} 个可用，${unhealthy} 个不可用`
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.admin.error('Check all domains error', { error: errorMessage });
    return c.json({ code: 0, msg: errorMessage });
  }
});

/**
 * 检测域名健康状态
 */
async function checkDomainHealth(domain: string): Promise<{
  healthy: boolean;
  responseTime: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${domain}/`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      return { healthy: true, responseTime };
    } else {
      return { 
        healthy: false, 
        responseTime, 
        error: `HTTP ${response.status}` 
      };
    }
  } catch (error) {
    return { 
      healthy: false, 
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Connection failed'
    };
  }
}

export default domains;
