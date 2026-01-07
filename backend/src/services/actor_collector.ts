/**
 * Actor Collector Service
 * 演员采集服务
 * 
 * 从资源站API采集演员详细信息，补充现有演员数据
 */

import { logger } from '../utils/logger';

interface Env {
  DB: D1Database;
}

interface ActorFromApi {
  actor_id: number;
  actor_name: string;
  actor_en?: string;
  actor_alias?: string;
  actor_sex?: string;
  actor_area?: string;
  actor_pic?: string;
  actor_birthday?: string;
  actor_birtharea?: string;
  actor_height?: string;
  actor_weight?: string;
  actor_blood?: string;
  actor_starsign?: string;
  actor_works?: string;
  actor_blurb?: string;
  actor_content?: string;
  actor_hits?: number;
  actor_time?: string;
}

interface CollectResult {
  total: number;
  newCount: number;
  updateCount: number;
  matchedCount: number;  // 匹配到现有演员的数量
  errors: number;
}

/**
 * 采集演员列表
 */
export async function collectActors(
  env: Env,
  apiUrl: string,
  sourceName: string,
  options: {
    page?: number;
    maxPages?: number;
  } = {}
): Promise<CollectResult> {
  const { page = 1, maxPages = 50 } = options;
  
  let currentPage = page;
  let totalPages = 1;
  let total = 0;
  let newCount = 0;
  let updateCount = 0;
  let matchedCount = 0;
  let errors = 0;
  
  logger.actorCollector.info('Starting collection', { sourceName, page });
  
  while (currentPage <= Math.min(totalPages, maxPages)) {
    try {
      const url = `${apiUrl}?ac=list&pg=${currentPage}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RobinBot/1.0)',
        },
      });
      
      if (!response.ok) {
        logger.actorCollector.error('HTTP error', { status: response.status });
        errors++;
        break;
      }
      
      const data = await response.json() as {
        code: number;
        page: number;
        pagecount: number;
        total: number;
        list: ActorFromApi[];
      };
      
      if (data.code !== 1 || !data.list) {
        logger.actorCollector.error('Invalid response');
        errors++;
        break;
      }
      
      totalPages = data.pagecount || 1;
      total += data.list.length;
      
      // 处理每个演员
      for (const actor of data.list) {
        try {
          const result = await saveActor(env, actor, sourceName);
          if (result === 'new') newCount++;
          else if (result === 'update') updateCount++;
          else if (result === 'matched') matchedCount++;
        } catch (error) {
          logger.actorCollector.error('Error saving actor', { actorId: actor.actor_id, error: String(error) });
          errors++;
        }
      }
      
      logger.actorCollector.info('Page processed', { currentPage, totalPages });
      currentPage++;
      
      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      logger.actorCollector.error('Error on page', { currentPage, error: String(error) });
      errors++;
      break;
    }
  }
  
  logger.actorCollector.info('Collection completed', { total, newCount, updateCount, matchedCount });
  
  return { total, newCount, updateCount, matchedCount, errors };
}

/**
 * 采集演员详情
 */
export async function collectActorDetail(
  env: Env,
  apiUrl: string,
  actorId: string,
  sourceName: string
): Promise<boolean> {
  try {
    const url = `${apiUrl}?ac=detail&ids=${actorId}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RobinBot/1.0)',
      },
    });
    
    if (!response.ok) return false;
    
    const data = await response.json() as {
      code: number;
      list: ActorFromApi[];
    };
    
    if (data.code !== 1 || !data.list || data.list.length === 0) {
      return false;
    }
    
    await saveActor(env, data.list[0], sourceName, true);
    return true;
    
  } catch (error) {
    logger.actorCollector.error('Error fetching detail', { actorId, error: String(error) });
    return false;
  }
}

/**
 * 保存演员到数据库
 * 优先匹配现有演员（通过名称），补充详细信息
 */
async function saveActor(
  env: Env,
  actor: ActorFromApi,
  sourceName: string,
  isDetail: boolean = false
): Promise<'new' | 'update' | 'matched' | 'skip'> {
  const actorApiId = String(actor.actor_id);
  const actorName = actor.actor_name?.trim();
  
  if (!actorName) return 'skip';
  
  // 1. 先通过 actor_id 查找（如果之前采集过）
  let existing = await env.DB.prepare(`
    SELECT id, name, avatar, bio FROM actors WHERE actor_id = ?
  `).bind(actorApiId).first();
  
  // 2. 如果没找到，通过名称匹配现有演员
  if (!existing) {
    existing = await env.DB.prepare(`
      SELECT id, name, avatar, bio FROM actors WHERE name = ?
    `).bind(actorName).first();
  }
  
  const now = Math.floor(Date.now() / 1000);
  
  // 处理头像URL（有些是相对路径）
  let avatarUrl = actor.actor_pic || '';
  if (avatarUrl && !avatarUrl.startsWith('http')) {
    avatarUrl = avatarUrl.startsWith('//') ? `https:${avatarUrl}` : avatarUrl;
  }
  
  // 提取简介（优先使用 blurb，其次从 content 中提取纯文本）
  let bio = actor.actor_blurb || '';
  if (!bio && actor.actor_content) {
    // 简单去除HTML标签
    bio = actor.actor_content
      .replace(/<[^>]+>/g, '')
      .replace(/&[^;]+;/g, '')
      .substring(0, 500);
  }
  
  if (existing) {
    // 更新现有演员的详细信息
    // 只更新空字段，不覆盖已有数据
    await env.DB.prepare(`
      UPDATE actors SET
        actor_id = COALESCE(actor_id, ?),
        avatar = COALESCE(NULLIF(avatar, ''), ?),
        name_en = COALESCE(NULLIF(name_en, ''), ?),
        alias = COALESCE(NULLIF(alias, ''), ?),
        sex = COALESCE(NULLIF(sex, ''), ?),
        area = COALESCE(NULLIF(area, ''), ?),
        birthday = COALESCE(NULLIF(birthday, ''), ?),
        birthplace = COALESCE(NULLIF(birthplace, ''), ?),
        height = COALESCE(NULLIF(height, ''), ?),
        weight = COALESCE(NULLIF(weight, ''), ?),
        blood_type = COALESCE(NULLIF(blood_type, ''), ?),
        constellation = COALESCE(NULLIF(constellation, ''), ?),
        representative_works = COALESCE(NULLIF(representative_works, ''), ?),
        bio = COALESCE(NULLIF(bio, ''), ?),
        source_name = COALESCE(source_name, ?),
        updated_at = ?
      WHERE id = ?
    `).bind(
      actorApiId,
      avatarUrl,
      actor.actor_en || '',
      actor.actor_alias || '',
      actor.actor_sex || '',
      actor.actor_area || '',
      actor.actor_birthday || '',
      actor.actor_birtharea || '',
      actor.actor_height || '',
      actor.actor_weight || '',
      actor.actor_blood || '',
      actor.actor_starsign || '',
      actor.actor_works || '',
      bio,
      sourceName,
      now,
      existing.id
    ).run();
    
    return existing.avatar ? 'update' : 'matched';
  }
  
  // 新增演员
  await env.DB.prepare(`
    INSERT INTO actors (
      name, actor_id, avatar, name_en, alias, sex, area,
      birthday, birthplace, height, weight, blood_type, constellation,
      representative_works, bio, source_name, works_count, popularity, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
  `).bind(
    actorName,
    actorApiId,
    avatarUrl,
    actor.actor_en || '',
    actor.actor_alias || '',
    actor.actor_sex || '',
    actor.actor_area || '',
    actor.actor_birthday || '',
    actor.actor_birtharea || '',
    actor.actor_height || '',
    actor.actor_weight || '',
    actor.actor_blood || '',
    actor.actor_starsign || '',
    actor.actor_works || '',
    bio,
    sourceName,
    now
  ).run();
  
  return 'new';
}

// 演员数据库行类型
interface ActorDbRow {
  id: number;
  name: string;
  avatar?: string;
  bio?: string;
}

/**
 * 批量补充演员详情
 * 为已有演员（从视频中提取的）补充详细信息
 */
export async function enrichActorsFromApi(
  env: Env,
  apiUrl: string,
  sourceName: string,
  limit: number = 100
): Promise<{ enriched: number; notFound: number }> {
  // 获取缺少详细信息的演员
  const result = await env.DB.prepare(`
    SELECT id, name FROM actors
    WHERE (avatar IS NULL OR avatar = '') AND works_count > 0
    ORDER BY popularity DESC
    LIMIT ?
  `).bind(limit).all();
  
  const actors = result.results as ActorDbRow[];
  let enriched = 0;
  let notFound = 0;
  
  logger.actorCollector.info('Enriching actors', { count: actors.length });
  
  for (const actor of actors) {
    try {
      // 通过名称搜索API
      const searchUrl = `${apiUrl}?ac=list&wd=${encodeURIComponent(actor.name)}`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RobinBot/1.0)',
        },
      });
      
      if (!response.ok) continue;
      
      const data = await response.json() as {
        code: number;
        list: ActorFromApi[];
      };
      
      if (data.code === 1 && data.list && data.list.length > 0) {
        // 找到匹配的演员
        const matched = data.list.find(a => a.actor_name === actor.name);
        if (matched) {
          // 获取详情
          const detailUrl = `${apiUrl}?ac=detail&ids=${matched.actor_id}`;
          const detailResponse = await fetch(detailUrl);
          const detailData = await detailResponse.json() as { code: number; list: ActorFromApi[] };
          
          if (detailData.code === 1 && detailData.list && detailData.list.length > 0) {
            await saveActor(env, detailData.list[0], sourceName, true);
            enriched++;
          }
        } else {
          notFound++;
        }
      } else {
        notFound++;
      }
      
      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      logger.actorCollector.error('Error enriching actor', { actorName: actor.name, error: String(error) });
    }
  }
  
  logger.actorCollector.info('Enrichment completed', { enriched, notFound });
  
  return { enriched, notFound };
}
