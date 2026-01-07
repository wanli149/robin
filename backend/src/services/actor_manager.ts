/**
 * Actor Manager Service
 * 演员管理服务
 * 
 * 功能：
 * 1. 自动提取演员/导演/编剧
 * 2. 建立视频-演员关联
 * 3. 统计演员作品数
 * 4. 支持演员页面查询
 */

import { logger } from '../utils/logger';

interface Env {
  DB: D1Database;
}

// 演员基本信息类型
interface ActorInfo {
  id: number;
  name: string;
  avatar?: string;
  name_en?: string;
  alias?: string;
  sex?: string;
  area?: string;
  birthday?: string;
  birthplace?: string;
  height?: string;
  weight?: string;
  blood_type?: string;
  constellation?: string;
  representative_works?: string;
  bio?: string;
  works_count: number;
  popularity: number;
}

// 视频作品类型
interface ActorWork {
  vod_id: string;
  vod_name: string;
  vod_pic?: string;
  vod_year?: string;
  vod_hits?: number;
  role_type: string;
}

// 演员详情（包含作品）
interface ActorDetail extends ActorInfo {
  works: ActorWork[];
}

/**
 * 解析演员字符串（支持多种格式）
 */
function parseActors(actorStr: string): string[] {
  if (!actorStr) return [];
  
  // 支持的分隔符：逗号、顿号、斜杠、空格
  return actorStr
    .split(/[,，、\/\s]+/)
    .map(name => name.trim())
    .filter(name => name.length > 0 && name.length < 50); // 过滤异常数据
}

/**
 * 获取或创建演员
 */
async function getOrCreateActor(
  env: Env,
  name: string
): Promise<number | null> {
  try {
    // 1. 查找是否已存在
    const existing = await env.DB.prepare(`
      SELECT id FROM actors WHERE name = ?
    `).bind(name).first();

    if (existing) {
      return existing.id as number;
    }

    // 2. 创建新演员
    const result = await env.DB.prepare(`
      INSERT INTO actors (name) VALUES (?)
    `).bind(name).run();

    return result.meta.last_row_id || null;
  } catch (error) {
    logger.actorManager.error('Failed to get/create actor', { name, error: String(error) });
    return null;
  }
}

/**
 * 建立视频-演员关联
 */
export async function linkActors(
  env: Env,
  vodId: string,
  actors: string,
  directors: string,
  writers: string
): Promise<void> {
  try {
    // 1. 解析演员
    const actorList = parseActors(actors);
    const directorList = parseActors(directors);
    const writerList = parseActors(writers);

    // 2. 删除旧关联
    await env.DB.prepare(`
      DELETE FROM vod_actor_relation WHERE vod_id = ?
    `).bind(vodId).run();

    // 3. 建立新关联
    const relations: Array<{ actorId: number; roleType: string; sortOrder: number }> = [];

    // 导演（优先级最高）
    for (let i = 0; i < directorList.length; i++) {
      const actorId = await getOrCreateActor(env, directorList[i]);
      if (actorId) {
        relations.push({ actorId, roleType: 'director', sortOrder: i });
      }
    }

    // 主演
    for (let i = 0; i < actorList.length; i++) {
      const actorId = await getOrCreateActor(env, actorList[i]);
      if (actorId) {
        relations.push({ actorId, roleType: 'actor', sortOrder: i });
      }
    }

    // 编剧
    for (let i = 0; i < writerList.length; i++) {
      const actorId = await getOrCreateActor(env, writerList[i]);
      if (actorId) {
        relations.push({ actorId, roleType: 'writer', sortOrder: i });
      }
    }

    // 4. 批量插入
    if (relations.length > 0) {
      const statements = relations.map(rel =>
        env.DB.prepare(`
          INSERT INTO vod_actor_relation (vod_id, actor_id, role_type, sort_order)
          VALUES (?, ?, ?, ?)
        `).bind(vodId, rel.actorId, rel.roleType, rel.sortOrder)
      );

      await env.DB.batch(statements);
    }

  } catch (error) {
    logger.actorManager.error('Failed to link actors', { error: String(error) });
  }
}

/**
 * 更新演员作品统计（Cron任务）
 */
export async function updateActorStats(env: Env): Promise<number> {
  logger.actorManager.info('Updating actor stats...');

  try {
    // 更新作品数量
    await env.DB.prepare(`
      UPDATE actors
      SET works_count = (
        SELECT COUNT(DISTINCT vod_id)
        FROM vod_actor_relation
        WHERE vod_actor_relation.actor_id = actors.id
      )
    `).run();

    // 更新人气值（基于作品的热度）
    await env.DB.prepare(`
      UPDATE actors
      SET popularity = (
        SELECT COALESCE(SUM(v.vod_hits_month), 0)
        FROM vod_actor_relation r
        JOIN vod_cache v ON r.vod_id = v.vod_id
        WHERE r.actor_id = actors.id
      )
    `).run();

    logger.actorManager.info('Stats updated successfully');
    return 1;

  } catch (error) {
    logger.actorManager.error('Failed to update stats', { error: String(error) });
    return 0;
  }
}

/**
 * 获取演员详情（包含作品列表）
 */
export async function getActorDetail(
  env: Env,
  actorId: number
): Promise<ActorDetail | null> {
  try {
    // 1. 获取演员信息
    const actor = await env.DB.prepare(`
      SELECT * FROM actors WHERE id = ?
    `).bind(actorId).first();

    if (!actor) {
      return null;
    }

    // 2. 获取作品列表
    const works = await env.DB.prepare(`
      SELECT v.*, r.role_type
      FROM vod_actor_relation r
      JOIN vod_cache v ON r.vod_id = v.vod_id
      WHERE r.actor_id = ?
      AND v.is_valid = 1
      ORDER BY v.vod_year DESC, v.vod_hits DESC
      LIMIT 50
    `).bind(actorId).all();

    return {
      ...(actor as ActorInfo),
      works: works.results as ActorWork[],
    };

  } catch (error) {
    logger.actorManager.error('Failed to get detail', { error: String(error) });
    return null;
  }
}

/**
 * 搜索演员
 */
export async function searchActors(
  env: Env,
  keyword: string,
  limit: number = 20
): Promise<ActorInfo[]> {
  try {
    const result = await env.DB.prepare(`
      SELECT * FROM actors
      WHERE name LIKE ?
      ORDER BY popularity DESC, works_count DESC
      LIMIT ?
    `).bind(`%${keyword}%`, limit).all();

    return result.results as ActorInfo[];
  } catch (error) {
    logger.actorManager.error('Search failed', { error: String(error) });
    return [];
  }
}

/**
 * 获取热门演员
 */
export async function getPopularActors(
  env: Env,
  limit: number = 50
): Promise<ActorInfo[]> {
  try {
    const result = await env.DB.prepare(`
      SELECT * FROM actors
      WHERE works_count > 0
      ORDER BY popularity DESC
      LIMIT ?
    `).bind(limit).all();

    return result.results as ActorInfo[];
  } catch (error) {
    logger.actorManager.error('Failed to get popular actors', { error: String(error) });
    return [];
  }
}
