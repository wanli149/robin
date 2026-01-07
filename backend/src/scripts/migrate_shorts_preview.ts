/**
 * 短剧预览字段迁移脚本
 * 为 vod_cache 表添加短剧流预览字段
 */

import { logger } from '../utils/logger';

interface Env {
  DB: D1Database;
}

export async function migrateShortsPreview(env: Env): Promise<void> {
  logger.migration.info('Starting shorts preview migration');
  
  // 检查字段是否已存在
  // 定义 PRAGMA 返回类型
  interface ColumnInfo {
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
  }
  
  const columns = await env.DB.prepare(`PRAGMA table_info(vod_cache)`).all();
  const columnNames = (columns.results as ColumnInfo[]).map(c => c.name);
  
  const newColumns = [
    { name: 'shorts_preview_episode', type: 'INTEGER' },
    { name: 'shorts_preview_url', type: 'TEXT' },
    { name: 'shorts_category', type: 'TEXT' },
  ];
  
  for (const col of newColumns) {
    if (!columnNames.includes(col.name)) {
      logger.migration.info('Adding column', { name: col.name });
      await env.DB.prepare(`ALTER TABLE vod_cache ADD COLUMN ${col.name} ${col.type}`).run();
    } else {
      logger.migration.info('Column already exists', { name: col.name });
    }
  }
  
  // 创建索引
  try {
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_vod_shorts_preview 
      ON vod_cache(type_id, shorts_preview_url) 
      WHERE type_id = 5
    `).run();
    logger.migration.info('Created shorts preview index');
  } catch (e) {
    logger.migration.info('Index may already exist');
  }
  
  logger.migration.info('Shorts preview migration completed');
}
