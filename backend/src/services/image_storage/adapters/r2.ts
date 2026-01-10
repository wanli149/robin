/**
 * Cloudflare R2 Storage Adapter
 * R2 存储适配器
 */

import { BaseStorageAdapter } from './base';
import type { ConnectionTestResult } from '../types';

export class R2Adapter extends BaseStorageAdapter {
  private bucket: R2Bucket | null = null;

  /**
   * 设置 R2 Bucket（从 Workers 环境绑定）
   */
  setBucket(bucket: R2Bucket): void {
    this.bucket = bucket;
  }

  async upload(key: string, data: ArrayBuffer, contentType: string): Promise<string> {
    this.ensureInitialized();
    
    if (!this.bucket) {
      throw new Error('R2 bucket not configured');
    }

    await this.bucket.put(key, data, {
      httpMetadata: {
        contentType,
        cacheControl: 'public, max-age=31536000', // 1年缓存
      },
    });

    return this.getPublicUrl(key);
  }

  async delete(key: string): Promise<void> {
    this.ensureInitialized();
    
    if (!this.bucket) {
      throw new Error('R2 bucket not configured');
    }

    await this.bucket.delete(key);
  }

  async deleteBatch(keys: string[]): Promise<void> {
    this.ensureInitialized();
    
    if (!this.bucket) {
      throw new Error('R2 bucket not configured');
    }

    // R2 支持批量删除
    await this.bucket.delete(keys);
  }

  async exists(key: string): Promise<boolean> {
    this.ensureInitialized();
    
    if (!this.bucket) {
      throw new Error('R2 bucket not configured');
    }

    const object = await this.bucket.head(key);
    return object !== null;
  }

  getPublicUrl(key: string): string {
    this.ensureInitialized();
    
    // 优先使用自定义域名
    if (this.config?.custom_domain) {
      const domain = this.config.custom_domain.replace(/\/$/, '');
      return `${domain}/${key}`;
    }

    // 使用 R2 公开访问 URL
    // 格式: https://{account_id}.r2.cloudflarestorage.com/{bucket}/{key}
    if (this.config?.r2_account_id && this.config?.bucket_name) {
      return `https://${this.config.r2_account_id}.r2.cloudflarestorage.com/${this.config.bucket_name}/${key}`;
    }

    return key;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      if (!this.bucket) {
        return {
          success: false,
          message: 'R2 bucket not configured',
          error: 'Bucket binding is missing',
        };
      }

      // 尝试列出对象（限制1个）来测试连接
      const list = await this.bucket.list({ limit: 1 });
      const latency = Date.now() - startTime;

      return {
        success: true,
        message: `R2 connection successful. Objects: ${list.objects.length >= 0 ? 'accessible' : 'empty'}`,
        latency,
      };
    } catch (error) {
      return {
        success: false,
        message: 'R2 connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - startTime,
      };
    }
  }
}
