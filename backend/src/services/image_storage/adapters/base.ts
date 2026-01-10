/**
 * Base Storage Adapter
 * 存储适配器基类
 */

import type { ImageStorageConfig, IStorageAdapter, ConnectionTestResult } from '../types';

export abstract class BaseStorageAdapter implements IStorageAdapter {
  protected config: ImageStorageConfig | null = null;
  protected initialized = false;

  async initialize(config: ImageStorageConfig): Promise<void> {
    this.config = config;
    this.initialized = true;
  }

  protected ensureInitialized(): void {
    if (!this.initialized || !this.config) {
      throw new Error('Storage adapter not initialized');
    }
  }

  abstract upload(key: string, data: ArrayBuffer, contentType: string): Promise<string>;
  abstract delete(key: string): Promise<void>;
  abstract exists(key: string): Promise<boolean>;
  abstract getPublicUrl(key: string): string;
  abstract testConnection(): Promise<ConnectionTestResult>;

  async deleteBatch(keys: string[]): Promise<void> {
    // 默认实现：逐个删除
    for (const key of keys) {
      try {
        await this.delete(key);
      } catch (error) {
        console.error(`Failed to delete ${key}:`, error);
      }
    }
  }

  /**
   * 生成存储 key
   * 格式: images/{type}/{year}/{month}/{hash}.{ext}
   */
  protected generateKey(hash: string, imageType: string, extension: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `images/${imageType}/${year}/${month}/${hash}.${extension}`;
  }

  /**
   * 从 content-type 获取文件扩展名
   */
  protected getExtension(contentType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    };
    return map[contentType] || 'jpg';
  }
}
