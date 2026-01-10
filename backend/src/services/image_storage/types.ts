/**
 * Image Storage Types
 * 图片存储系统类型定义
 */

/** 存储服务商类型 */
export type StorageProvider = 'none' | 'r2' | 'qiniu' | 'aliyun' | 'tencent';

/** 同步模式 */
export type SyncMode = 'sync' | 'async';

/** 图片类型 */
export type ImageType = 'cover' | 'thumb' | 'slide' | 'actor';

/** 图片状态 */
export type ImageStatus = 'pending' | 'uploading' | 'success' | 'failed';

/** 队列状态 */
export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** 存储配置 */
export interface ImageStorageConfig {
  id: number;
  provider: StorageProvider;
  is_enabled: boolean;
  
  // 通用配置
  bucket_name: string | null;
  region: string | null;
  access_key: string | null;
  secret_key: string | null;
  custom_domain: string | null;
  
  // R2 专用
  r2_account_id: string | null;
  
  // 七牛专用
  qiniu_zone: string | null;
  
  // 功能配置
  sync_mode: SyncMode;
  compress_enabled: boolean;
  webp_enabled: boolean;
  max_width: number;
  quality: number;
  
  // 同步范围
  sync_cover: boolean;
  sync_thumb: boolean;
  sync_slide: boolean;
  sync_actor: boolean;
  
  // 统计
  total_images: number;
  total_size: number;
  last_sync_at: number | null;
}

/** 图片映射记录 */
export interface ImageMapping {
  id: number;
  original_url: string;
  original_hash: string;
  storage_key: string | null;
  storage_url: string | null;
  image_type: ImageType;
  content_type: string | null;
  original_size: number | null;
  stored_size: number | null;
  width: number | null;
  height: number | null;
  status: ImageStatus;
  retry_count: number;
  error_message: string | null;
  vod_id: string | null;
  created_at: number;
  updated_at: number;
}

/** 同步队列项 */
export interface SyncQueueItem {
  id: number;
  original_url: string;
  original_hash: string;
  image_type: ImageType;
  vod_id: string | null;
  priority: number;
  status: QueueStatus;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  created_at: number;
  processed_at: number | null;
}

/** 上传结果 */
export interface UploadResult {
  success: boolean;
  storage_key?: string;
  storage_url?: string;
  content_type?: string;
  original_size?: number;
  stored_size?: number;
  width?: number;
  height?: number;
  error?: string;
}

/** 连接测试结果 */
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency?: number;
  error?: string;
}

/** 存储统计 */
export interface StorageStats {
  total_images: number;
  synced_images: number;
  pending_images: number;
  failed_images: number;
  total_size: number;
  queue_size: number;
  last_sync_at: number | null;
  sync_rate: number; // 每分钟同步数
}

/** 存储适配器接口 */
export interface IStorageAdapter {
  /** 初始化适配器 */
  initialize(config: ImageStorageConfig): Promise<void>;
  
  /** 上传图片 */
  upload(key: string, data: ArrayBuffer, contentType: string): Promise<string>;
  
  /** 删除图片 */
  delete(key: string): Promise<void>;
  
  /** 批量删除 */
  deleteBatch(keys: string[]): Promise<void>;
  
  /** 检查是否存在 */
  exists(key: string): Promise<boolean>;
  
  /** 获取公开URL */
  getPublicUrl(key: string): string;
  
  /** 测试连接 */
  testConnection(): Promise<ConnectionTestResult>;
}

/** 环境变量类型 */
export interface ImageStorageEnv {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
  IMAGE_BUCKET?: R2Bucket; // R2 存储桶绑定
}
