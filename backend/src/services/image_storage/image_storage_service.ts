/**
 * Image Storage Service
 * 图片存储服务 - 核心业务逻辑
 */

import { R2Adapter, QiniuAdapter, AliyunOSSAdapter, TencentCOSAdapter } from './adapters';
import type {
  ImageStorageConfig,
  ImageStorageEnv,
  IStorageAdapter,
  StorageProvider,
  ImageType,
  UploadResult,
  ConnectionTestResult,
} from './types';
import { logger } from '../../utils/logger';
import { getCurrentTimestamp } from '../../utils/time';

// 存储配置数据库行类型
interface StorageConfigRow {
  id: number;
  name: string;
  provider: string;
  bucket: string;
  region: string | null;
  endpoint: string | null;
  access_key: string | null;
  secret_key: string | null;
  custom_domain: string | null;
  path_prefix: string;
  is_enabled: number;
  is_default: number;
  created_at: number;
  updated_at: number;
}

// 队列项数据库行类型
interface QueueItemRow {
  id: number;
  original_url: string;
  original_hash: string;
  image_type: string;
  vod_id: string | null;
  priority: number;
  status: string;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  created_at: number;
  processed_at: number | null;
}

export class ImageStorageService {
  private adapters: Map<number, IStorageAdapter> = new Map();
  private configs: Map<number, StorageConfigRow> = new Map();
  private defaultConfigId: number | null = null;
  private env: ImageStorageEnv;
  private initialized = false;

  constructor(env: ImageStorageEnv) {
    this.env = env;
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 加载所有启用的配置
      const result = await this.env.DB.prepare(`
        SELECT * FROM image_storage_config WHERE is_enabled = 1
      `).all();

      for (const row of (result.results as unknown) as StorageConfigRow[]) {
        this.configs.set(row.id, row);
        
        if (row.is_default === 1) {
          this.defaultConfigId = row.id;
        }

        // 初始化适配器
        const adapter = await this.createAdapter(row);
        if (adapter) {
          this.adapters.set(row.id, adapter);
        }
      }

      this.initialized = true;
      logger.imageStorage.info('Image storage service initialized', {
        configCount: this.configs.size,
        defaultConfigId: this.defaultConfigId,
      });
    } catch (error) {
      logger.imageStorage.error('Failed to initialize image storage service', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.initialized = true;
    }
  }

  /**
   * 创建存储适配器
   */
  private async createAdapter(config: StorageConfigRow): Promise<IStorageAdapter | null> {
    const adapterConfig: ImageStorageConfig = {
      id: config.id,
      provider: config.provider as StorageProvider,
      is_enabled: config.is_enabled === 1,
      bucket_name: config.bucket,
      region: config.region,
      access_key: config.access_key,
      secret_key: config.secret_key,
      custom_domain: config.custom_domain,
      r2_account_id: null,
      qiniu_zone: null,
      sync_mode: 'async',
      compress_enabled: false,
      webp_enabled: false,
      max_width: 800,
      quality: 80,
      sync_cover: true,
      sync_thumb: true,
      sync_slide: false,
      sync_actor: false,
      total_images: 0,
      total_size: 0,
      last_sync_at: null,
    };

    try {
      switch (config.provider) {
        case 'r2':
          const r2Adapter = new R2Adapter();
          if (this.env.IMAGE_BUCKET) {
            r2Adapter.setBucket(this.env.IMAGE_BUCKET);
          }
          await r2Adapter.initialize(adapterConfig);
          return r2Adapter;

        case 'qiniu':
          const qiniuAdapter = new QiniuAdapter();
          await qiniuAdapter.initialize(adapterConfig);
          return qiniuAdapter;

        case 'aliyun':
          const aliyunAdapter = new AliyunOSSAdapter();
          await aliyunAdapter.initialize(adapterConfig);
          return aliyunAdapter;

        case 'tencent':
          const tencentAdapter = new TencentCOSAdapter();
          await tencentAdapter.initialize(adapterConfig);
          return tencentAdapter;

        default:
          return null;
      }
    } catch (error) {
      logger.imageStorage.error('Failed to create adapter', {
        configId: config.id,
        provider: config.provider,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 检查服务是否可用
   */
  isEnabled(): boolean {
    return this.defaultConfigId !== null && this.adapters.has(this.defaultConfigId);
  }

  /**
   * 生成 URL 的 MD5 哈希
   */
  private async hashUrl(url: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(url);
    const hashBuffer = await crypto.subtle.digest('MD5', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * 上传图片（统一入口）
   */
  async uploadImage(
    originalUrl: string,
    imageType: ImageType,
    vodId?: string,
    sync: boolean = false
  ): Promise<UploadResult> {
    await this.initialize();

    if (!this.isEnabled()) {
      return { success: false, error: 'Image storage not enabled' };
    }

    if (sync) {
      return this.uploadSync(originalUrl, imageType, vodId);
    } else {
      await this.uploadAsync(originalUrl, imageType, vodId);
      return { success: true };
    }
  }

  /**
   * 同步上传图片
   */
  async uploadSync(
    originalUrl: string,
    imageType: ImageType,
    vodId?: string,
    configId?: number
  ): Promise<UploadResult> {
    await this.initialize();

    const targetConfigId = configId || this.defaultConfigId;
    if (!targetConfigId) {
      return { success: false, error: 'No storage config available' };
    }

    const adapter = this.adapters.get(targetConfigId);
    const config = this.configs.get(targetConfigId);
    if (!adapter || !config) {
      return { success: false, error: 'Storage adapter not found' };
    }

    try {
      const hash = await this.hashUrl(originalUrl);

      // 检查是否已存在
      const existing = await this.env.DB.prepare(`
        SELECT storage_url, status FROM image_mappings WHERE original_hash = ?
      `).bind(hash).first();

      if (existing && existing.status === 'success' && existing.storage_url) {
        return {
          success: true,
          storage_url: existing.storage_url as string,
        };
      }

      // 下载原图
      const imageData = await this.downloadImage(originalUrl);
      if (!imageData) {
        return { success: false, error: 'Failed to download image' };
      }

      // 生成存储 key
      const extension = this.getExtension(imageData.contentType);
      const storageKey = this.generateKey(hash, imageType, extension, config.path_prefix);

      // 上传到云存储
      const storageUrl = await adapter.upload(
        storageKey,
        imageData.data,
        imageData.contentType
      );

      // 保存映射记录
      const now = getCurrentTimestamp();
      await this.env.DB.prepare(`
        INSERT INTO image_mappings (
          original_url, original_hash, storage_key, storage_url,
          image_type, content_type, original_size, stored_size,
          status, vod_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success', ?, ?, ?)
        ON CONFLICT(original_hash) DO UPDATE SET
          storage_key = excluded.storage_key,
          storage_url = excluded.storage_url,
          stored_size = excluded.stored_size,
          status = 'success',
          updated_at = excluded.updated_at
      `).bind(
        originalUrl,
        hash,
        storageKey,
        storageUrl,
        imageType,
        imageData.contentType,
        imageData.data.byteLength,
        imageData.data.byteLength,
        vodId || null,
        now,
        now
      ).run();

      logger.imageStorage.info('Image uploaded successfully', {
        hash,
        size: imageData.data.byteLength,
      });

      return {
        success: true,
        storage_key: storageKey,
        storage_url: storageUrl,
        content_type: imageData.contentType,
        original_size: imageData.data.byteLength,
        stored_size: imageData.data.byteLength,
      };
    } catch (error) {
      logger.imageStorage.error('Upload failed', {
        url: originalUrl,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 异步上传图片（加入队列）
   */
  async uploadAsync(
    originalUrl: string,
    imageType: ImageType,
    vodId?: string,
    priority: number = 0
  ): Promise<void> {
    await this.initialize();

    if (!this.isEnabled()) return;

    try {
      const hash = await this.hashUrl(originalUrl);

      // 检查是否已存在成功的映射
      const existing = await this.env.DB.prepare(`
        SELECT status FROM image_mappings WHERE original_hash = ?
      `).bind(hash).first();

      if (existing && existing.status === 'success') {
        return;
      }

      // 加入队列
      const now = getCurrentTimestamp();
      await this.env.DB.prepare(`
        INSERT INTO image_sync_queue (
          original_url, original_hash, image_type, vod_id, priority, status, created_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
        ON CONFLICT(original_hash) DO UPDATE SET
          priority = MAX(priority, excluded.priority),
          status = CASE WHEN status = 'failed' THEN 'pending' ELSE status END
      `).bind(originalUrl, hash, imageType, vodId || null, priority, now).run();

      logger.imageStorage.debug('Image added to queue', { hash, imageType });
    } catch (error) {
      logger.imageStorage.error('Failed to add to queue', {
        url: originalUrl,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 处理队列中的图片
   */
  async processQueue(batchSize: number = 50): Promise<{ success: number; failed: number }> {
    await this.initialize();

    if (!this.isEnabled()) {
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    try {
      // 获取待处理的队列项
      const result = await this.env.DB.prepare(`
        SELECT * FROM image_sync_queue
        WHERE status = 'pending'
        ORDER BY priority DESC, created_at ASC
        LIMIT ?
      `).bind(batchSize).all();

      const items = (result.results as unknown) as QueueItemRow[];

      for (const item of items) {
        try {
          // 标记为处理中
          await this.env.DB.prepare(`
            UPDATE image_sync_queue SET status = 'processing' WHERE id = ?
          `).bind(item.id).run();

          // 上传图片
          const uploadResult = await this.uploadSync(
            item.original_url,
            item.image_type as ImageType,
            item.vod_id || undefined
          );

          if (uploadResult.success) {
            await this.env.DB.prepare(`
              UPDATE image_sync_queue 
              SET status = 'completed', processed_at = ?
              WHERE id = ?
            `).bind(getCurrentTimestamp(), item.id).run();
            success++;
          } else {
            const newRetryCount = item.retry_count + 1;
            const newStatus = newRetryCount >= item.max_retries ? 'failed' : 'pending';
            
            await this.env.DB.prepare(`
              UPDATE image_sync_queue 
              SET status = ?, retry_count = ?, error_message = ?
              WHERE id = ?
            `).bind(newStatus, newRetryCount, uploadResult.error || 'Unknown error', item.id).run();
            
            if (newStatus === 'failed') {
              failed++;
            }
          }
        } catch (error) {
          const newRetryCount = item.retry_count + 1;
          await this.env.DB.prepare(`
            UPDATE image_sync_queue 
            SET status = 'pending', retry_count = ?, error_message = ?
            WHERE id = ?
          `).bind(
            newRetryCount,
            error instanceof Error ? error.message : 'Unknown error',
            item.id
          ).run();
        }
      }

      logger.imageStorage.info('Queue processed', { success, failed, total: items.length });
    } catch (error) {
      logger.imageStorage.error('Queue processing failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return { success, failed };
  }

  /**
   * 获取图片 URL（优先云存储）
   */
  async getImageUrl(originalUrl: string): Promise<string> {
    await this.initialize();

    if (!this.isEnabled() || !originalUrl) {
      return originalUrl;
    }

    try {
      const hash = await this.hashUrl(originalUrl);
      const cacheKey = `img:${hash}`;
      
      const cached = await this.env.ROBIN_CACHE.get(cacheKey);
      if (cached) {
        return cached;
      }

      const mapping = await this.env.DB.prepare(`
        SELECT storage_url FROM image_mappings 
        WHERE original_hash = ? AND status = 'success'
      `).bind(hash).first();

      if (mapping && mapping.storage_url) {
        const storageUrl = mapping.storage_url as string;
        await this.env.ROBIN_CACHE.put(cacheKey, storageUrl, { expirationTtl: 86400 });
        return storageUrl;
      }

      return originalUrl;
    } catch (error) {
      return originalUrl;
    }
  }

  /**
   * 测试连接
   */
  async testConnection(configId: number): Promise<ConnectionTestResult> {
    await this.initialize();

    // 重新加载配置
    const configRow = await this.env.DB.prepare(`
      SELECT * FROM image_storage_config WHERE id = ?
    `).bind(configId).first() as StorageConfigRow | null;

    if (!configRow) {
      return { success: false, message: 'Config not found' };
    }

    const adapter = await this.createAdapter(configRow);
    if (!adapter) {
      return { success: false, message: 'Failed to create adapter' };
    }

    return adapter.testConnection();
  }

  /**
   * 删除图片
   */
  async deleteImage(storageKey: string, configId: number): Promise<boolean> {
    await this.initialize();

    const adapter = this.adapters.get(configId);
    if (!adapter) {
      return false;
    }

    try {
      await adapter.delete(storageKey);
      return true;
    } catch (error) {
      logger.imageStorage.error('Failed to delete image', {
        storageKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 下载图片
   */
  private async downloadImage(url: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const data = await response.arrayBuffer();

      return { data, contentType };
    } catch (error) {
      logger.imageStorage.error('Failed to download image', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 生成存储 key
   */
  private generateKey(hash: string, imageType: string, extension: string, prefix: string = 'images'): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${prefix}/${imageType}/${year}/${month}/${hash}.${extension}`;
  }

  /**
   * 获取文件扩展名
   */
  private getExtension(contentType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };
    return map[contentType] || 'jpg';
  }
}

// 创建服务实例的工厂函数
export function createImageStorageService(env: ImageStorageEnv): ImageStorageService {
  return new ImageStorageService(env);
}
