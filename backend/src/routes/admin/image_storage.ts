/**
 * Image Storage Admin API
 * 图片云存储管理接口
 */

import { Hono } from 'hono';
import type { Bindings } from './types';
import { ImageStorageService } from '../../services/image_storage';
import { logger } from '../../utils/logger';

const imageStorage = new Hono<{ Bindings: Bindings }>();

// ============================================
// 配置管理
// ============================================

/**
 * 获取所有存储配置
 */
imageStorage.get('/admin/image-storage/configs', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT * FROM image_storage_config ORDER BY is_default DESC, created_at DESC
    `).all();

    // 隐藏敏感信息
    const configs = result.results.map((config: any) => ({
      ...config,
      access_key: config.access_key ? '******' : null,
      secret_key: config.secret_key ? '******' : null,
    }));

    return c.json({ code: 1, data: configs });
  } catch (error) {
    logger.imageStorage.error('获取配置列表失败', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: '获取配置列表失败' });
  }
});

/**
 * 获取单个存储配置
 */
imageStorage.get('/admin/image-storage/configs/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const config = await c.env.DB.prepare(`
      SELECT * FROM image_storage_config WHERE id = ?
    `).bind(id).first();

    if (!config) {
      return c.json({ code: 0, msg: '配置不存在' });
    }

    // 隐藏敏感信息
    return c.json({
      code: 1,
      data: {
        ...config,
        access_key: config.access_key ? '******' : null,
        secret_key: config.secret_key ? '******' : null,
      },
    });
  } catch (error) {
    logger.imageStorage.error('获取配置详情失败', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: '获取配置详情失败' });
  }
});

/**
 * 创建存储配置
 */
imageStorage.post('/admin/image-storage/configs', async (c) => {
  try {
    const body = await c.req.json();
    const {
      name,
      provider,
      bucket,
      region,
      endpoint,
      access_key,
      secret_key,
      custom_domain,
      path_prefix,
      is_enabled,
      is_default,
    } = body;

    // 验证必填字段
    if (!name || !provider || !bucket) {
      return c.json({ code: 0, msg: '名称、提供商和存储桶为必填项' });
    }

    // 如果设为默认，先取消其他默认
    if (is_default) {
      await c.env.DB.prepare(`
        UPDATE image_storage_config SET is_default = 0 WHERE is_default = 1
      `).run();
    }

    const now = Math.floor(Date.now() / 1000);
    const result = await c.env.DB.prepare(`
      INSERT INTO image_storage_config (
        name, provider, bucket, region, endpoint, access_key, secret_key,
        custom_domain, path_prefix, is_enabled, is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      name,
      provider,
      bucket,
      region || null,
      endpoint || null,
      access_key || null,
      secret_key || null,
      custom_domain || null,
      path_prefix || 'images',
      is_enabled ? 1 : 0,
      is_default ? 1 : 0,
      now,
      now
    ).run();

    logger.imageStorage.info('创建存储配置', { name, provider });
    return c.json({ code: 1, msg: '创建成功', data: { id: result.meta.last_row_id } });
  } catch (error) {
    logger.imageStorage.error('创建配置失败', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: '创建配置失败' });
  }
});

/**
 * 更新存储配置
 */
imageStorage.put('/admin/image-storage/configs/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const {
      name,
      provider,
      bucket,
      region,
      endpoint,
      access_key,
      secret_key,
      custom_domain,
      path_prefix,
      is_enabled,
      is_default,
    } = body;

    // 检查配置是否存在
    const existing = await c.env.DB.prepare(`
      SELECT * FROM image_storage_config WHERE id = ?
    `).bind(id).first();

    if (!existing) {
      return c.json({ code: 0, msg: '配置不存在' });
    }

    // 如果设为默认，先取消其他默认
    if (is_default) {
      await c.env.DB.prepare(`
        UPDATE image_storage_config SET is_default = 0 WHERE is_default = 1 AND id != ?
      `).bind(id).run();
    }

    const now = Math.floor(Date.now() / 1000);
    
    // 如果密钥是 ****** 则保留原值
    const finalAccessKey = access_key === '******' ? existing.access_key : access_key;
    const finalSecretKey = secret_key === '******' ? existing.secret_key : secret_key;

    await c.env.DB.prepare(`
      UPDATE image_storage_config SET
        name = ?, provider = ?, bucket = ?, region = ?, endpoint = ?,
        access_key = ?, secret_key = ?, custom_domain = ?, path_prefix = ?,
        is_enabled = ?, is_default = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      name || existing.name,
      provider || existing.provider,
      bucket || existing.bucket,
      region || existing.region,
      endpoint || existing.endpoint,
      finalAccessKey,
      finalSecretKey,
      custom_domain || existing.custom_domain,
      path_prefix || existing.path_prefix,
      is_enabled !== undefined ? (is_enabled ? 1 : 0) : existing.is_enabled,
      is_default !== undefined ? (is_default ? 1 : 0) : existing.is_default,
      now,
      id
    ).run();

    logger.imageStorage.info('更新存储配置', { id, name });
    return c.json({ code: 1, msg: '更新成功' });
  } catch (error) {
    logger.imageStorage.error('更新配置失败', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: '更新配置失败' });
  }
});

/**
 * 删除存储配置
 */
imageStorage.delete('/admin/image-storage/configs/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    // 检查是否有关联的图片映射
    const mappingCount = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM image_mappings WHERE config_id = ?
    `).bind(id).first();

    if (mappingCount && (mappingCount.count as number) > 0) {
      return c.json({ code: 0, msg: '该配置下有图片数据，无法删除' });
    }

    await c.env.DB.prepare(`
      DELETE FROM image_storage_config WHERE id = ?
    `).bind(id).run();

    logger.imageStorage.info('删除存储配置', { id });
    return c.json({ code: 1, msg: '删除成功' });
  } catch (error) {
    logger.imageStorage.error('删除配置失败', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: '删除配置失败' });
  }
});

/**
 * 测试存储配置连接
 */
imageStorage.post('/admin/image-storage/configs/:id/test', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    const config = await c.env.DB.prepare(`
      SELECT * FROM image_storage_config WHERE id = ?
    `).bind(id).first();

    if (!config) {
      return c.json({ code: 0, msg: '配置不存在' });
    }

    const service = new ImageStorageService(c.env);
    const result = await service.testConnection(id);

    if (result.success) {
      return c.json({ code: 1, msg: '连接测试成功' });
    } else {
      return c.json({ code: 0, msg: result.error || '连接测试失败' });
    }
  } catch (error) {
    logger.imageStorage.error('测试连接失败', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: '测试连接失败' });
  }
});

// ============================================
// 图片映射管理
// ============================================

/**
 * 获取图片映射列表
 */
imageStorage.get('/admin/image-storage/mappings', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const status = c.req.query('status');
    const configId = c.req.query('configId');

    let whereClause = '1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND m.status = ?';
      params.push(status);
    }

    if (configId) {
      whereClause += ' AND m.config_id = ?';
      params.push(parseInt(configId));
    }

    // 获取总数
    const countResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as total FROM image_mappings m WHERE ${whereClause}
    `).bind(...params).first();
    const total = (countResult?.total as number) || 0;

    // 获取分页数据
    const offset = (page - 1) * pageSize;
    const result = await c.env.DB.prepare(`
      SELECT m.*, c.name as config_name, c.provider
      FROM image_mappings m
      LEFT JOIN image_storage_config c ON m.config_id = c.id
      WHERE ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, pageSize, offset).all();

    return c.json({
      code: 1,
      data: {
        list: result.results,
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    logger.imageStorage.error('获取映射列表失败', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: '获取映射列表失败' });
  }
});

/**
 * 删除图片映射
 */
imageStorage.delete('/admin/image-storage/mappings/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    // 获取映射信息
    const mapping = await c.env.DB.prepare(`
      SELECT * FROM image_mappings WHERE id = ?
    `).bind(id).first();

    if (!mapping) {
      return c.json({ code: 0, msg: '映射不存在' });
    }

    // 删除云端文件（可选）
    const deleteRemote = c.req.query('deleteRemote') === 'true';
    if (deleteRemote && mapping.storage_path) {
      const service = new ImageStorageService(c.env);
      await service.deleteImage(mapping.storage_path as string, mapping.config_id as number);
    }

    // 删除映射记录
    await c.env.DB.prepare(`
      DELETE FROM image_mappings WHERE id = ?
    `).bind(id).run();

    logger.imageStorage.info('删除图片映射', { id });
    return c.json({ code: 1, msg: '删除成功' });
  } catch (error) {
    logger.imageStorage.error('删除映射失败', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: '删除映射失败' });
  }
});

// ============================================
// 上传队列管理
// ============================================

/**
 * 获取上传队列
 */
imageStorage.get('/admin/image-storage/queue', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const status = c.req.query('status');

    let whereClause = '1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    // 获取总数
    const countResult = await c.env.DB.prepare(`
      SELECT COUNT(*) as total FROM image_upload_queue WHERE ${whereClause}
    `).bind(...params).first();
    const total = (countResult?.total as number) || 0;

    // 获取分页数据
    const offset = (page - 1) * pageSize;
    const result = await c.env.DB.prepare(`
      SELECT * FROM image_upload_queue
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, pageSize, offset).all();

    return c.json({
      code: 1,
      data: {
        list: result.results,
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    logger.imageStorage.error('获取队列失败', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: '获取队列失败' });
  }
});

/**
 * 重试失败的上传任务
 */
imageStorage.post('/admin/image-storage/queue/:id/retry', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    await c.env.DB.prepare(`
      UPDATE image_upload_queue SET status = 'pending', retry_count = 0, error_message = NULL, updated_at = ?
      WHERE id = ? AND status = 'failed'
    `).bind(Math.floor(Date.now() / 1000), id).run();

    return c.json({ code: 1, msg: '已重新加入队列' });
  } catch (error) {
    logger.imageStorage.error('重试任务失败', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: '重试失败' });
  }
});

/**
 * 批量重试失败任务
 */
imageStorage.post('/admin/image-storage/queue/retry-all', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      UPDATE image_upload_queue SET status = 'pending', retry_count = 0, error_message = NULL, updated_at = ?
      WHERE status = 'failed'
    `).bind(Math.floor(Date.now() / 1000)).run();

    return c.json({ code: 1, msg: `已重试 ${result.meta.changes} 个任务` });
  } catch (error) {
    logger.imageStorage.error('批量重试失败', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: '批量重试失败' });
  }
});

/**
 * 清理已完成的队列任务
 */
imageStorage.delete('/admin/image-storage/queue/completed', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      DELETE FROM image_upload_queue WHERE status = 'completed'
    `).run();

    return c.json({ code: 1, msg: `已清理 ${result.meta.changes} 个任务` });
  } catch (error) {
    logger.imageStorage.error('清理队列失败', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: '清理失败' });
  }
});

// ============================================
// 统计信息
// ============================================

/**
 * 获取存储统计
 */
imageStorage.get('/admin/image-storage/stats', async (c) => {
  try {
    // 配置统计
    const configStats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_configs,
        SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END) as enabled_configs
      FROM image_storage_config
    `).first();

    // 映射统计
    const mappingStats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_mappings,
        SUM(CASE WHEN status = 'synced' THEN 1 ELSE 0 END) as synced_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(file_size) as total_size
      FROM image_mappings
    `).first();

    // 队列统计
    const queueStats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_queue,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_queue,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_queue,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_queue,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_queue
      FROM image_upload_queue
    `).first();

    // 按提供商统计
    const providerStats = await c.env.DB.prepare(`
      SELECT c.provider, COUNT(m.id) as count, SUM(m.file_size) as size
      FROM image_storage_config c
      LEFT JOIN image_mappings m ON c.id = m.config_id
      GROUP BY c.provider
    `).all();

    // 今日上传统计
    const today = Math.floor(Date.now() / 1000) - 86400;
    const todayStats = await c.env.DB.prepare(`
      SELECT COUNT(*) as today_uploads
      FROM image_mappings
      WHERE created_at > ?
    `).bind(today).first();

    return c.json({
      code: 1,
      data: {
        configs: {
          total: configStats?.total_configs || 0,
          enabled: configStats?.enabled_configs || 0,
        },
        mappings: {
          total: mappingStats?.total_mappings || 0,
          synced: mappingStats?.synced_count || 0,
          pending: mappingStats?.pending_count || 0,
          failed: mappingStats?.failed_count || 0,
          totalSize: mappingStats?.total_size || 0,
        },
        queue: {
          total: queueStats?.total_queue || 0,
          pending: queueStats?.pending_queue || 0,
          processing: queueStats?.processing_queue || 0,
          completed: queueStats?.completed_queue || 0,
          failed: queueStats?.failed_queue || 0,
        },
        byProvider: providerStats.results,
        todayUploads: todayStats?.today_uploads || 0,
      },
    });
  } catch (error) {
    logger.imageStorage.error('获取统计失败', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: '获取统计失败' });
  }
});

// ============================================
// 手动操作
// ============================================

/**
 * 手动触发队列处理
 */
imageStorage.post('/admin/image-storage/process-queue', async (c) => {
  try {
    const service = new ImageStorageService(c.env);
    const result = await service.processQueue(50);

    return c.json({
      code: 1,
      msg: `处理完成：成功 ${result.success}，失败 ${result.failed}`,
      data: result,
    });
  } catch (error) {
    logger.imageStorage.error('处理队列失败', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: '处理队列失败' });
  }
});

/**
 * 手动同步指定视频的图片
 */
imageStorage.post('/admin/image-storage/sync-video/:vodId', async (c) => {
  try {
    const vodId = c.req.param('vodId');
    const { sync } = await c.req.json();

    // 获取视频信息
    const video = await c.env.DB.prepare(`
      SELECT vod_id, vod_pic, vod_pic_thumb FROM vod_cache WHERE vod_id = ?
    `).bind(vodId).first();

    if (!video) {
      return c.json({ code: 0, msg: '视频不存在' });
    }

    const service = new ImageStorageService(c.env);
    const results: any[] = [];

    // 同步封面图
    if (video.vod_pic) {
      const result = await service.uploadImage(
        video.vod_pic as string,
        'cover',
        vodId,
        sync === true
      );
      results.push({ type: 'cover', ...result });
    }

    // 同步缩略图
    if (video.vod_pic_thumb && video.vod_pic_thumb !== video.vod_pic) {
      const result = await service.uploadImage(
        video.vod_pic_thumb as string,
        'thumb',
        vodId,
        sync === true
      );
      results.push({ type: 'thumb', ...result });
    }

    return c.json({ code: 1, msg: '同步任务已创建', data: results });
  } catch (error) {
    logger.imageStorage.error('同步视频图片失败', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ code: 0, msg: '同步失败' });
  }
});

export default imageStorage;
