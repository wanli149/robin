/**
 * Admin 模块共享类型定义
 */

export type Bindings = {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
  IMAGE_BUCKET?: R2Bucket;
  ADMIN_SECRET_KEY: string;
  DINGTALK_WEBHOOK?: string;
};
