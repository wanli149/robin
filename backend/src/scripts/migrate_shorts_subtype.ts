/**
 * 短剧子分类迁移脚本
 * 将 shorts_category 数据迁移到标准的 sub_type_id 和 sub_type_name
 */

import { logger } from '../utils/logger';

interface Env {
  DB: D1Database;
}

export async function migrateShortsSubtype(env: Env): Promise<{
  success: boolean;
  message: string;
  updated: number;
  errors: number;
}> {
  logger.migration.info('Starting shorts subtype migration');
  
  let updated = 0;
  let errors = 0;
  
  try {
    // 1. 获取短剧子分类映射
    const subCatsResult = await env.DB.prepare(`
      SELECT id, name FROM video_sub_categories WHERE parent_id = 5
    `).all();
    
    const subCatMap = new Map<string, number>();
    for (const row of subCatsResult.results || []) {
      subCatMap.set(row.name as string, row.id as number);
    }
    
    logger.migration.info('Found shorts sub-categories', { count: subCatMap.size });
    
    // 2. 获取需要迁移的短剧（有 shorts_category 但没有 sub_type_id）
    const shortsResult = await env.DB.prepare(`
      SELECT vod_id, shorts_category 
      FROM vod_cache 
      WHERE type_id = 5 
        AND shorts_category IS NOT NULL 
        AND shorts_category != ''
        AND (sub_type_id IS NULL OR sub_type_name IS NULL OR sub_type_name = '')
    `).all();
    
    logger.migration.info('Found shorts to migrate', { count: shortsResult.results?.length || 0 });

    // 3. 批量更新
    for (const row of shortsResult.results || []) {
      const vodId = row.vod_id as string;
      const category = row.shorts_category as string;
      
      // 查找对应的子分类ID
      let subTypeId = subCatMap.get(category);
      let subTypeName = category;
      
      // 如果没有精确匹配，尝试模糊匹配
      if (!subTypeId) {
        for (const [name, id] of subCatMap.entries()) {
          if (category.includes(name) || name.includes(category)) {
            subTypeId = id;
            subTypeName = name;
            break;
          }
        }
      }
      
      if (subTypeId) {
        try {
          await env.DB.prepare(`
            UPDATE vod_cache 
            SET sub_type_id = ?, sub_type_name = ?
            WHERE vod_id = ?
          `).bind(subTypeId, subTypeName, vodId).run();
          updated++;
        } catch (e) {
          logger.migration.error('Failed to update video', { vodId, error: e instanceof Error ? e.message : String(e) });
          errors++;
        }
      } else {
        // 没有匹配的子分类，保持原样
        logger.migration.info('No matching sub-category', { category });
      }
    }
    
    logger.migration.info('Migration completed', { updated, errors });
    
    return {
      success: true,
      message: `迁移完成：更新 ${updated} 条，失败 ${errors} 条`,
      updated,
      errors,
    };
  } catch (error) {
    logger.migration.error('Migration failed', { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      message: error instanceof Error ? error.message : '迁移失败',
      updated,
      errors,
    };
  }
}
