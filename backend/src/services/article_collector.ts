/**
 * Article Collector Service
 * 文章采集服务
 * 
 * 从资源站API采集文章/资讯数据
 */

import { ARTICLE_TYPE_MAPPING } from '../scripts/migrate_articles_actors';
import { logger } from '../utils/logger';
import { getCurrentTimestamp } from '../utils/time';

interface Env {
  DB: D1Database;
}

interface ArticleFromApi {
  art_id: number;
  art_name: string;
  art_en?: string;
  type_id: number;
  type_name: string;
  art_pic?: string;
  art_author?: string;
  art_from?: string;
  art_blurb?: string;
  art_content?: string;
  art_tag?: string;
  art_time?: string;
  art_hits?: number;
  art_hits_day?: number;
  art_hits_week?: number;
  art_hits_month?: number;
}

interface CollectResult {
  total: number;
  newCount: number;
  updateCount: number;
  errors: number;
}

/**
 * 采集文章列表
 */
export async function collectArticles(
  env: Env,
  apiUrl: string,
  sourceName: string,
  options: {
    page?: number;
    maxPages?: number;
    typeId?: number;
  } = {}
): Promise<CollectResult> {
  const { page = 1, maxPages = 10, typeId } = options;
  
  let currentPage = page;
  let totalPages = 1;
  let total = 0;
  let newCount = 0;
  let updateCount = 0;
  let errors = 0;
  
  logger.articleCollector.info('Starting collection', { sourceName, page });
  
  while (currentPage <= Math.min(totalPages, maxPages)) {
    try {
      // 构建请求URL
      let url = `${apiUrl}?ac=list&pg=${currentPage}`;
      if (typeId) {
        url += `&t=${typeId}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RobinBot/1.0)',
        },
      });
      
      if (!response.ok) {
        logger.articleCollector.error('HTTP error', { status: response.status });
        errors++;
        break;
      }
      
      const data = await response.json() as {
        code: number;
        page: number;
        pagecount: number;
        total: number;
        list: ArticleFromApi[];
      };
      
      if (data.code !== 1 || !data.list) {
        logger.articleCollector.error('Invalid response');
        errors++;
        break;
      }
      
      totalPages = data.pagecount || 1;
      total += data.list.length;
      
      // 处理每篇文章
      for (const article of data.list) {
        try {
          const result = await saveArticle(env, article, sourceName);
          if (result === 'new') newCount++;
          else if (result === 'update') updateCount++;
        } catch (error) {
          logger.articleCollector.error('Error saving article', { artId: article.art_id, error: String(error) });
          errors++;
        }
      }
      
      logger.articleCollector.info('Page processed', { currentPage, totalPages, newCount, updateCount });
      currentPage++;
      
      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      logger.articleCollector.error('Error on page', { currentPage, error: String(error) });
      errors++;
      break;
    }
  }
  
  logger.articleCollector.info('Collection completed', { total, newCount, updateCount, errors });
  
  return { total, newCount, updateCount, errors };
}

/**
 * 采集文章详情
 */
export async function collectArticleDetail(
  env: Env,
  apiUrl: string,
  artId: string,
  sourceName: string
): Promise<boolean> {
  try {
    const url = `${apiUrl}?ac=detail&ids=${artId}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RobinBot/1.0)',
      },
    });
    
    if (!response.ok) return false;
    
    const data = await response.json() as {
      code: number;
      list: ArticleFromApi[];
    };
    
    if (data.code !== 1 || !data.list || data.list.length === 0) {
      return false;
    }
    
    await saveArticle(env, data.list[0], sourceName, true);
    return true;
    
  } catch (error) {
    logger.articleCollector.error('Error fetching detail', { artId, error: String(error) });
    return false;
  }
}

/**
 * 保存文章到数据库
 */
async function saveArticle(
  env: Env,
  article: ArticleFromApi,
  sourceName: string,
  isDetail: boolean = false
): Promise<'new' | 'update' | 'skip'> {
  const artId = String(article.art_id);
  
  // 检查是否已存在
  const existing = await env.DB.prepare(`
    SELECT id, content FROM articles WHERE art_id = ?
  `).bind(artId).first();
  
  // 映射分类
  const localTypeId = ARTICLE_TYPE_MAPPING[article.type_id] || 1;
  
  // 解析发布时间
  let publishedAt = getCurrentTimestamp();
  if (article.art_time) {
    const parsed = Date.parse(article.art_time);
    if (!isNaN(parsed)) {
      publishedAt = Math.floor(parsed / 1000);
    }
  }
  
  const now = getCurrentTimestamp();
  
  if (existing) {
    // 如果是详情采集且已有内容，或者只是列表采集，跳过
    if (!isDetail && existing.content) {
      return 'skip';
    }
    
    // 更新
    await env.DB.prepare(`
      UPDATE articles SET
        title = ?,
        title_en = ?,
        type_id = ?,
        type_name = ?,
        cover = ?,
        author = ?,
        source = ?,
        summary = ?,
        content = COALESCE(?, content),
        tags = ?,
        hits = ?,
        hits_day = ?,
        hits_week = ?,
        hits_month = ?,
        published_at = ?,
        updated_at = ?
      WHERE art_id = ?
    `).bind(
      article.art_name || '',
      article.art_en || '',
      localTypeId,
      article.type_name || '',
      article.art_pic || '',
      article.art_author || '',
      article.art_from || '',
      article.art_blurb || '',
      article.art_content || null,
      article.art_tag || '',
      article.art_hits || 0,
      article.art_hits_day || 0,
      article.art_hits_week || 0,
      article.art_hits_month || 0,
      publishedAt,
      now,
      artId
    ).run();
    
    return 'update';
  }
  
  // 新增
  await env.DB.prepare(`
    INSERT INTO articles (
      art_id, title, title_en, type_id, type_name,
      cover, author, source, summary, content, tags,
      hits, hits_day, hits_week, hits_month,
      source_name, published_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    artId,
    article.art_name || '',
    article.art_en || '',
    localTypeId,
    article.type_name || '',
    article.art_pic || '',
    article.art_author || '',
    article.art_from || '',
    article.art_blurb || '',
    article.art_content || '',
    article.art_tag || '',
    article.art_hits || 0,
    article.art_hits_day || 0,
    article.art_hits_week || 0,
    article.art_hits_month || 0,
    sourceName,
    publishedAt,
    now,
    now
  ).run();
  
  return 'new';
}

// 文章列表项类型
interface ArticleListItem {
  id: number;
  art_id: string;
  title: string;
  type_id: number;
  type_name: string;
  cover: string;
  author: string;
  summary: string;
  hits: number;
  published_at: number;
  created_at: number;
}

// 文章详情类型
interface ArticleDetail extends ArticleListItem {
  title_en: string;
  source: string;
  content: string;
  tags: string;
  hits_day: number;
  hits_week: number;
  hits_month: number;
  source_name: string;
  updated_at: number;
  is_active: number;
}

/**
 * 获取文章列表
 */
export async function getArticles(
  env: Env,
  options: {
    typeId?: number;
    page?: number;
    limit?: number;
    keyword?: string;
  } = {}
): Promise<{ list: ArticleListItem[]; total: number }> {
  const { typeId, page = 1, limit = 20, keyword } = options;
  const offset = (page - 1) * limit;
  
  let whereClause = 'WHERE is_active = 1';
  const params: (string | number)[] = [];
  
  if (typeId) {
    whereClause += ' AND type_id = ?';
    params.push(typeId);
  }
  
  if (keyword) {
    whereClause += ' AND (title LIKE ? OR summary LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  
  // 获取总数
  const countResult = await env.DB.prepare(`
    SELECT COUNT(*) as total FROM articles ${whereClause}
  `).bind(...params).first();
  
  const total = (countResult?.total as number) || 0;
  
  // 获取列表
  const result = await env.DB.prepare(`
    SELECT id, art_id, title, type_id, type_name, cover, author, summary, 
           hits, published_at, created_at
    FROM articles
    ${whereClause}
    ORDER BY published_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all();
  
  return {
    list: result.results as ArticleListItem[],
    total,
  };
}

/**
 * 获取文章详情
 */
export async function getArticleDetail(
  env: Env,
  id: number
): Promise<ArticleDetail | null> {
  const result = await env.DB.prepare(`
    SELECT * FROM articles WHERE id = ? AND is_active = 1
  `).bind(id).first();
  
  return (result as ArticleDetail) || null;
}
