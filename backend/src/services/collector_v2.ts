/**
 * Collector V2 Service
 * 采集引擎 V2 - 支持分页采集、断点续传、实时进度、多格式解析
 */

import { 
  CollectTask, 
  TaskConfig, 
  TaskCheckpoint,
  createTask, 
  getTask, 
  updateTaskStatus, 
  updateTaskProgress,
  getNextPendingTask 
} from './task_manager';
import { createLogger, flushLogs } from './collect_logger';
import { getHealthySources, checkSourceHealth } from './source_health';
import { autoClassify, loadMappingsFromDb, loadSubCategoriesFromDb, type SubCategory } from './auto_classifier';
import { 
  parseResponse, 
  detectFormat, 
  type ResponseFormat, 
  type ParsedVideo,
  type ParsedVideoList 
} from './response_parser';
import { cleanPlayUrls, cleanImageUrl, type CleanedPlayUrls } from './data_cleaner';
import { logger } from '../utils/logger';
import type { VodCacheRow } from '../types/database';

interface Env {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
}

interface SourceInfo {
  id: number;
  name: string;
  apiUrl: string;
  weight: number;
  responseFormat: ResponseFormat;
}

// 采集配置
// 🚀 优化：减少超时和重试，降低 CPU 消耗
const CONFIG = {
  PAGE_SIZE: 20,                    // 每页数量（资源站默认）
  BATCH_SIZE: 5,                    // 🚀 减少批量大小，降低内存压力
  REQUEST_DELAY: 100,               // 🚀 减少请求间隔
  BATCH_DELAY: 300,                 // 🚀 减少批次间隔
  MAX_RETRIES: 2,                   // 🚀 减少重试次数
  REQUEST_TIMEOUT: 8000,            // 🚀 减少超时时间
  PROGRESS_UPDATE_INTERVAL: 20,     // 🚀 减少进度更新频率，降低 D1 写入
};

// 当前任务的数据库分类映射（在 executeTask 中设置）
let currentDbMappings: Map<string, Map<string, number>> | undefined;
let currentDbSubCategories: SubCategory[] | undefined;

// ============================================
// 主采集函数
// ============================================

/**
 * 执行采集任务
 */
export async function executeTask(env: Env, taskId: string): Promise<void> {
  const task = await getTask(env, taskId);
  if (!task) {
    logger.collectorV2.error('Task not found', { taskId });
    return;
  }
  
  const logger = createLogger(env, taskId);
  
  try {
    // 更新状态为运行中
    await updateTaskStatus(env, taskId, 'running');
    logger.info('task_start', `开始执行${getTaskTypeName(task.taskType)}任务`);
    
    // 加载数据库分类映射和子分类
    currentDbMappings = await loadMappingsFromDb(env);
    currentDbSubCategories = await loadSubCategoriesFromDb(env);
    logger.info('mappings_loaded', `加载了 ${currentDbMappings.size} 个资源站映射, ${currentDbSubCategories.length} 个子分类`);
    
    // 获取要采集的资源站
    const sources = await getSourcesForTask(env, task);
    if (sources.length === 0) {
      logger.warn('no_sources', '没有可用的资源站');
      await updateTaskStatus(env, taskId, 'completed');
      return;
    }
    
    logger.info('sources_loaded', `加载了 ${sources.length} 个资源站`, { 
      sources: sources.map(s => s.name) 
    });
    
    // 获取断点信息
    const checkpoint = task.checkpoint;
    let startSourceIndex = checkpoint?.sourceIndex || 0;
    let startPage = checkpoint?.page || (task.config.pageStart || 1);
    
    // 累计统计
    let totalNew = task.progress.newCount;
    let totalUpdate = task.progress.updateCount;
    let totalSkip = task.progress.skipCount;
    let totalError = task.progress.errorCount;
    let totalProcessed = task.progress.processedCount;
    
    // 遍历资源站
    for (let sourceIndex = startSourceIndex; sourceIndex < sources.length; sourceIndex++) {
      const source = sources[sourceIndex];
      
      // 检查任务是否被取消或暂停
      const currentTask = await getTask(env, taskId);
      if (currentTask?.status === 'cancelled' || currentTask?.status === 'paused') {
        logger.info('task_interrupted', `任务被${currentTask.status === 'cancelled' ? '取消' : '暂停'}`);
        await flushLogs(env, taskId);
        return;
      }
      
      logger.info('source_start', `开始采集: ${source.name}`, { sourceId: source.id });
      
      // 更新当前资源站
      await updateTaskProgress(env, taskId, {
        currentSource: source.name,
        currentSourceId: source.id,
      });
      
      try {
        // 确定要采集的分类列表
        // 如果指定了多个分类，遍历每个分类；否则不传分类参数（采集所有）
        const categoryIds = task.config.categoryIds && task.config.categoryIds.length > 0 
          ? task.config.categoryIds 
          : [undefined]; // undefined 表示不传分类参数
        
        for (const categoryId of categoryIds) {
          if (categoryId) {
            logger.info('category_start', `开始采集分类: ${categoryId}`);
          }
          
          // 获取总页数（传入当前分类ID）
          const configForCategory = categoryId 
            ? { ...task.config, categoryIds: [categoryId] }
            : { ...task.config, categoryIds: undefined };
          
          const totalPages = await getTotalPages(env, source, configForCategory);
          const pageEnd = task.config.pageEnd === -1 ? totalPages : Math.min(task.config.pageEnd || totalPages, totalPages);
          const pageStart = sourceIndex === startSourceIndex ? startPage : (task.config.pageStart || 1);
          
          logger.info('pages_info', `总页数: ${totalPages}, 采集范围: ${pageStart}-${pageEnd}${categoryId ? `, 分类: ${categoryId}` : ''}`);
          
          await updateTaskProgress(env, taskId, {
            totalPages: pageEnd - pageStart + 1,
            currentPage: 0,
          });
          
          // 遍历页面
          for (let page = pageStart; page <= pageEnd; page++) {
            // 再次检查任务状态
            const taskStatus = await getTask(env, taskId);
            if (taskStatus?.status === 'cancelled' || taskStatus?.status === 'paused') {
              // 保存断点
              await updateTaskProgress(env, taskId, {
                checkpoint: { sourceIndex, page, timestamp: Date.now() },
              });
              await flushLogs(env, taskId);
              return;
            }
            
            logger.debug('fetch_page', `获取第 ${page} 页${categoryId ? ` (分类: ${categoryId})` : ''}`);
            
            try {
              // 获取页面数据（传入当前分类ID）
              const videos = await fetchPage(source, page, task.config, categoryId);
              
              if (videos.length === 0) {
                logger.debug('empty_page', `第 ${page} 页无数据`);
                continue;
              }
              
              // 批量处理视频
              const result = await processVideos(env, videos, source, task, logger);
              
              totalNew += result.newCount;
              totalUpdate += result.updateCount;
              totalSkip += result.skipCount;
              totalError += result.errorCount;
              totalProcessed += videos.length;
              
              // 更新进度
              await updateTaskProgress(env, taskId, {
                currentPage: page - pageStart + 1,
                processedCount: totalProcessed,
                newCount: totalNew,
                updateCount: totalUpdate,
                skipCount: totalSkip,
                errorCount: totalError,
                checkpoint: { sourceIndex, page, timestamp: Date.now() },
              });
              
              // 检查是否达到最大数量限制
              if (task.config.maxVideos && totalProcessed >= task.config.maxVideos) {
                logger.info('max_reached', `达到最大采集数量限制: ${task.config.maxVideos}`);
                break;
              }
              
              // 页面间隔
              await sleep(CONFIG.BATCH_DELAY);
              
            } catch (pageError) {
              logger.error('page_error', `第 ${page} 页采集失败: ${pageError instanceof Error ? pageError.message : 'Unknown'}`, {
                page,
                categoryId,
                error: pageError instanceof Error ? pageError.stack : undefined,
              });
              totalError++;
            }
          }
          
          // 重置起始页（下一个分类从第1页开始）
          startPage = task.config.pageStart || 1;
        }
        
        logger.info('source_complete', `${source.name} 采集完成`, {
          new: totalNew,
          update: totalUpdate,
          skip: totalSkip,
          error: totalError,
        });
        
      } catch (sourceError) {
        logger.error('source_error', `${source.name} 采集失败: ${sourceError instanceof Error ? sourceError.message : 'Unknown'}`, {
          error: sourceError instanceof Error ? sourceError.stack : undefined,
        });
      }
      
      // 重置起始页（下一个资源站从第1页开始）
      startPage = task.config.pageStart || 1;
    }
    
    // 任务完成
    await updateTaskStatus(env, taskId, 'completed');
    logger.info('task_complete', `任务完成`, {
      total: totalProcessed,
      new: totalNew,
      update: totalUpdate,
      skip: totalSkip,
      error: totalError,
    });
    
    // 更新搜索索引
    await updateSearchIndex(env);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('task_error', `任务执行失败: ${errorMessage}`, {
      error: error instanceof Error ? error.stack : undefined,
    });
    
    await updateTaskStatus(env, taskId, 'failed', {
      lastError: errorMessage,
      errorDetails: error instanceof Error ? error.stack : undefined,
    });
  } finally {
    await flushLogs(env, taskId);
  }
}

// 资源站数据库行类型
interface VideoSourceDbRow {
  id: number;
  name: string;
  api_url: string;
  weight: number;
  response_format: string | null;
}

/**
 * 获取任务对应的资源站列表
 */
async function getSourcesForTask(env: Env, task: CollectTask): Promise<SourceInfo[]> {
  // 如果指定了资源站ID
  if (task.config.sourceIds && task.config.sourceIds.length > 0) {
    const placeholders = task.config.sourceIds.map(() => '?').join(',');
    const result = await env.DB.prepare(`
      SELECT id, name, api_url, weight, response_format 
      FROM video_sources 
      WHERE id IN (${placeholders}) AND is_active = 1
      ORDER BY weight DESC
    `).bind(...task.config.sourceIds).all();
    
    return (result.results as VideoSourceDbRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      apiUrl: row.api_url,
      weight: row.weight,
      responseFormat: (row.response_format as ResponseFormat) || 'auto',
    }));
  }
  
  // 否则获取所有健康的资源站
  const healthySources = await getHealthySources(env);
  
  // 获取格式信息
  if (healthySources.length === 0) return [];
  
  const ids = healthySources.map(s => s.id);
  const placeholders = ids.map(() => '?').join(',');
  const formatResult = await env.DB.prepare(`
    SELECT id, response_format FROM video_sources WHERE id IN (${placeholders})
  `).bind(...ids).all();
  
  const formatMap = new Map<number, ResponseFormat>();
  for (const row of formatResult.results as { id: number; response_format: string | null }[]) {
    formatMap.set(row.id, (row.response_format as ResponseFormat) || 'auto');
  }
  
  return healthySources.map(s => ({
    ...s,
    responseFormat: formatMap.get(s.id) || 'auto',
  }));
}

/**
 * 获取资源站总页数
 */
async function getTotalPages(
  env: Env,
  source: SourceInfo,
  config: TaskConfig
): Promise<number> {
  try {
    const url = new URL(source.apiUrl);
    url.searchParams.set('ac', 'list');
    url.searchParams.set('pg', '1');
    
    // 如果指定了分类
    if (config.categoryIds && config.categoryIds.length > 0) {
      url.searchParams.set('t', String(config.categoryIds[0]));
    }
    
    logger.collectorV2.debug(`Fetching total pages from: ${url.toString()}`);
    const response = await fetchWithRetry(url.toString());
    logger.collectorV2.debug(`Got response, parsing with format: ${source.responseFormat}`);
    const parsed = await parseResponse(response, source.responseFormat);
    logger.collectorV2.debug(`Parsed response, pagecount: ${parsed.pagecount}, list length: ${parsed.list?.length}`);
    
    return parsed.pagecount || 1;
  } catch (error) {
    logger.collectorV2.error('Failed to get total pages', { sourceName: source.name, error: error instanceof Error ? error.message : String(error) });
    return 1;
  }
}

/**
 * 获取单页数据
 * @param categoryId 可选的分类ID，用于多分类采集
 */
async function fetchPage(
  source: SourceInfo,
  page: number,
  config: TaskConfig,
  categoryId?: number
): Promise<ParsedVideo[]> {
  const url = new URL(source.apiUrl);
  url.searchParams.set('ac', 'list');
  url.searchParams.set('pg', String(page));
  
  // 优先使用传入的 categoryId，否则使用 config 中的第一个
  if (categoryId) {
    url.searchParams.set('t', String(categoryId));
  } else if (config.categoryIds && config.categoryIds.length > 0) {
    url.searchParams.set('t', String(config.categoryIds[0]));
  }
  
  const response = await fetchWithRetry(url.toString());
  const parsed = await parseResponse(response, source.responseFormat);
  
  return parsed.list || [];
}

/**
 * 批量处理视频
 */
async function processVideos(
  env: Env,
  videos: ParsedVideo[],
  source: SourceInfo,
  task: CollectTask,
  logger: ReturnType<typeof createLogger>
): Promise<{ newCount: number; updateCount: number; skipCount: number; errorCount: number }> {
  let newCount = 0;
  let updateCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  // 分批处理
  for (let i = 0; i < videos.length; i += CONFIG.BATCH_SIZE) {
    const batch = videos.slice(i, i + CONFIG.BATCH_SIZE);
    
    // 获取详情（并发但有限制）
    const detailedVideos = await Promise.all(
      batch.map(async (video, index) => {
        await sleep(index * CONFIG.REQUEST_DELAY);
        return await fetchVideoDetail(source, video);
      })
    );
    
    // 保存到数据库
    for (const video of detailedVideos) {
      try {
        const result = await saveVideo(env, video, source);
        
        if (result === 'new') {
          newCount++;
          logger.video('save_new', String(video.vod_id), video.vod_name || '', '新增视频');
        } else if (result === 'updated') {
          updateCount++;
        } else if (result === 'skipped') {
          skipCount++;
        }
      } catch (error) {
        errorCount++;
        logger.video('save_error', String(video.vod_id), video.vod_name || '', 
          `保存失败: ${error instanceof Error ? error.message : 'Unknown'}`, 'error');
      }
    }
    
    // 批次间隔
    if (i + CONFIG.BATCH_SIZE < videos.length) {
      await sleep(CONFIG.BATCH_DELAY);
    }
  }
  
  return { newCount, updateCount, skipCount, errorCount };
}

/**
 * 获取视频详情
 */
async function fetchVideoDetail(source: SourceInfo, video: ParsedVideo): Promise<ParsedVideo> {
  try {
    const url = new URL(source.apiUrl);
    url.searchParams.set('ac', 'detail');
    url.searchParams.set('ids', String(video.vod_id));
    
    const response = await fetchWithRetry(url.toString(), 2, 5000);
    const parsed = await parseResponse(response, source.responseFormat);
    
    if (parsed.list && parsed.list[0]) {
      return { ...video, ...parsed.list[0] };
    }
  } catch (error) {
    // 详情获取失败，使用列表数据
  }
  
  return video;
}

/**
 * 保存视频到数据库
 * 
 * 去重策略（多级匹配，从严格到宽松）：
 * 1. 精确匹配：名称 + 年份 + 地区（最可靠）
 * 2. 次精确匹配：名称 + 年份（处理地区缺失情况）
 * 3. 导演匹配：名称 + 导演（处理年份缺失但有导演的情况）
 * 4. 宽松匹配：仅名称（最后兜底，需要额外验证）
 */
async function saveVideo(
  env: Env,
  video: ParsedVideo,
  source: SourceInfo
): Promise<'new' | 'updated' | 'skipped'> {
  const vodName = video.vod_name || '';
  const vodYear = video.vod_year || '';
  const vodArea = video.vod_area || '';
  const vodDirector = (video.vod_director || '').split(',')[0].trim(); // 取第一个导演
  
  // 多级查找已存在的视频
  const existing = await findExistingVideoV2(env, vodName, vodYear, vodArea, vodDirector);
  
  const now = Math.floor(Date.now() / 1000);
  
  // 自动分类（V2：优先使用 type_name 智能识别）
  const classification = autoClassify({
    vod_name: video.vod_name || '',
    vod_actor: video.vod_actor || '',
    vod_director: video.vod_director || '',
    vod_content: video.vod_content || '',
    vod_remarks: video.vod_remarks || '',
    vod_tag: video.vod_tag || '',
    type_id: video.type_id,
    type_name: video.type_name,  // 关键：资源站返回的中文分类名
    source_name: source.name,
  }, currentDbMappings, currentDbSubCategories);
  
  // 调试日志（可选）
  // console.log(`[Classify] ${video.vod_name}: type_name=${video.type_name} -> ${classification.typeName}/${classification.subTypeName || '无'} (${classification.classifyMethod}, ${classification.confidence})`);
  
  // 处理播放地址（清洗：格式化 + HTTP 升级）
  const rawPlayUrls = parsePlayUrls(video, source.name);
  const playUrls = cleanPlayUrls(rawPlayUrls);
  
  // 清洗图片地址（HTTP 升级）
  const cleanedPic = cleanImageUrl(video.vod_pic || '');
  const cleanedPicThumb = cleanImageUrl(video.vod_pic_thumb || video.vod_pic || '');
  
  // 计算质量分
  const qualityScore = calculateQualityScore(video);
  
  // 短剧预览字段（仅 type_id=5）
  let shortsPreviewEpisode: number | null = null;
  let shortsPreviewUrl: string | null = null;
  let shortsCategory: string | null = null;
  
  if (classification.typeId === 5) {
    // 为短剧选择精彩集和分类（使用清洗后的格式）
    const preview = selectShortsPreviewFromCleaned(playUrls);
    shortsPreviewEpisode = preview.episode;
    shortsPreviewUrl = preview.url;
    shortsCategory = classification.subTypeName || classifyShortsCategory({
      vod_name: video.vod_name || '',
      vod_content: video.vod_content || '',
      vod_tag: video.vod_tag || '',
    });
  }
  
  if (!existing) {
    // 新增
    const vodId = generateVodId(vodName, vodYear, vodArea, vodDirector);
    
    await env.DB.prepare(`
      INSERT INTO vod_cache (
        vod_id, vod_name, vod_pic, vod_pic_thumb, vod_remarks,
        vod_year, vod_area, vod_lang, vod_actor, vod_director,
        vod_content, vod_play_url, vod_score, vod_tag,
        type_id, type_name, sub_type_id, sub_type_name,
        source_name, source_priority, quality_score,
        shorts_preview_episode, shorts_preview_url, shorts_category,
        is_valid, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).bind(
      vodId,
      vodName,
      cleanedPic,
      cleanedPicThumb,
      video.vod_remarks || '',
      vodYear,
      vodArea,
      video.vod_lang || '',
      video.vod_actor || '',
      video.vod_director || '',
      video.vod_content || '',
      JSON.stringify(playUrls),
      parseFloat(video.vod_score || '0'),
      video.vod_tag || '',
      classification.typeId,
      classification.typeName,
      classification.subTypeId || null,
      classification.subTypeName || null,
      source.name,
      source.weight,
      qualityScore,
      shortsPreviewEpisode,
      shortsPreviewUrl,
      shortsCategory,
      now,
      now
    ).run();
    
    return 'new';
  } else {
    // 更新：合并播放地址
    let mergedUrls: CleanedPlayUrls = playUrls;
    try {
      const existingUrls = JSON.parse(existing.vod_play_url as string || '{}');
      mergedUrls = { ...existingUrls, ...playUrls };
    } catch (e) {
      logger.collectorV2.warn('Failed to parse existing play_urls, using new data', { error: e instanceof Error ? e.message : 'Unknown' });
    }
    
    // 更新来源
    const existingSources = (existing.source_name as string || '').split(',').filter(Boolean);
    if (!existingSources.includes(source.name)) {
      existingSources.push(source.name);
    }
    
    await env.DB.prepare(`
      UPDATE vod_cache SET
        vod_play_url = ?,
        source_name = ?,
        vod_remarks = COALESCE(NULLIF(?, ''), vod_remarks),
        updated_at = ?
      WHERE vod_id = ?
    `).bind(
      JSON.stringify(mergedUrls),
      existingSources.join(','),
      video.vod_remarks || '',
      now,
      existing.vod_id
    ).run();
    
    return 'updated';
  }
}

// ============================================
// 辅助函数
// ============================================

/**
 * 为短剧选择精彩集（用于短剧流预览）- 清洗后格式
 * 策略：选择第 3-8 集之间的一集（避开前几集铺垫和后面剧透）
 */
function selectShortsPreviewFromCleaned(playUrls: CleanedPlayUrls): { episode: number; url: string } {
  // 获取第一个播放源的选集数组
  const firstSource = Object.values(playUrls)[0];
  if (!firstSource || !Array.isArray(firstSource) || firstSource.length === 0) {
    return { episode: 1, url: '' };
  }
  
  // 过滤有效的 URL
  const validEpisodes = firstSource.filter(ep => ep.url && ep.url.startsWith('http'));
  
  if (validEpisodes.length === 0) {
    return { episode: 1, url: '' };
  }
  
  // 选择精彩集：第 3-8 集之间随机，但不超过总集数
  const minEp = Math.min(3, validEpisodes.length);
  const maxEp = Math.min(8, validEpisodes.length);
  const targetIndex = minEp - 1 + Math.floor(Math.random() * (maxEp - minEp + 1));
  
  const selected = validEpisodes[targetIndex] || validEpisodes[0];
  return { episode: targetIndex + 1, url: selected.url };
}

/**
 * 短剧分类规则
 */
const SHORTS_CATEGORY_RULES: Record<string, string[]> = {
  霸总: ['霸总', '总裁', '豪门', '首富', '富豪', '千金', '继承人', '集团', '董事长', 'CEO'],
  战神: ['战神', '兵王', '龙王', '战尊', '特种兵', '雇佣兵', '退伍', '归来', '无敌', '至尊'],
  古装: ['古装', '穿越', '重生', '王爷', '皇上', '公主', '太子', '宫廷', '江湖', '武侠', '仙侠'],
  都市: ['都市', '职场', '白领', '创业', '逆袭', '打脸', '系统', '神医', '赘婿'],
  甜宠: ['甜宠', '恋爱', '暗恋', '初恋', '校园', '青春', '闪婚', '契约', '萌宝', '娇妻'],
  复仇: ['复仇', '重生', '归来', '报仇', '雪耻', '逆袭', '虐渣', '前妻', '前夫'],
  玄幻: ['玄幻', '修仙', '仙侠', '武侠', '异能', '超能力', '系统', '金手指', '神豪'],
};

/**
 * 短剧智能分类
 */
function classifyShortsCategory(info: { vod_name: string; vod_content?: string; vod_tag?: string }): string {
  const text = `${info.vod_name} ${info.vod_content || ''} ${info.vod_tag || ''}`.toLowerCase();
  
  let maxScore = 0;
  let bestCategory = '其他';
  
  for (const [category, keywords] of Object.entries(SHORTS_CATEGORY_RULES)) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += info.vod_name.toLowerCase().includes(keyword.toLowerCase()) ? 3 : 1;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }
  
  return maxScore > 0 ? bestCategory : '其他';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  maxRetries: number = CONFIG.MAX_RETRIES,
  timeout: number = CONFIG.REQUEST_TIMEOUT
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeout),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      
      if (response.ok) return response;
      
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
    }
    
    if (i < maxRetries - 1) {
      await sleep(Math.min(1000 * Math.pow(2, i), 5000));
    }
  }
  
  throw lastError || new Error('Fetch failed');
}

/**
 * 生成视频唯一ID
 * 使用 名称-年份-地区-导演 生成hash
 * 
 * 注意：导演只取第一个，避免顺序不同导致ID不同
 */
function generateVodId(name: string, year: string, area: string, director?: string): string {
  // 导演只取第一个，并清理空格
  const firstDirector = (director || '').split(',')[0].trim();
  const key = `${name}-${year}-${area}-${firstDirector}`.toLowerCase().replace(/\s+/g, '');
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 50);
}

function parsePlayUrls(video: ParsedVideo, sourceName: string): Record<string, string> {
  const playUrls: Record<string, string> = {};
  
  if (!video.vod_play_url) return playUrls;
  
  try {
    // 尝试解析为JSON
    const parsed = JSON.parse(video.vod_play_url);
    if (typeof parsed === 'object') {
      for (const [route, url] of Object.entries(parsed)) {
        if (url && typeof url === 'string') {
          playUrls[`${sourceName}-${route}`] = url;
        }
      }
      return playUrls;
    }
  } catch (e) {
    // JSON 解析失败，尝试直接解析 CMS 格式
  }
  
  // 直接作为字符串
  if (typeof video.vod_play_url === 'string') {
    playUrls[sourceName] = video.vod_play_url;
  }
  
  return playUrls;
}

function calculateQualityScore(video: ParsedVideo): number {
  let score = 0;
  
  if (video.vod_pic && video.vod_pic.length > 10) score += 20;
  if (video.vod_actor && video.vod_actor.length > 0) score += 15;
  if (video.vod_director && video.vod_director.length > 0) score += 10;
  if (video.vod_content && video.vod_content.length > 20) score += 25;
  if (video.vod_play_url && video.vod_play_url.length > 10) score += 30;
  
  return score;
}

function getTaskTypeName(type: string): string {
  const names: Record<string, string> = {
    full: '全量采集',
    incremental: '增量采集',
    category: '分类采集',
    source: '指定资源站采集',
    shorts: '短剧采集',
  };
  return names[type] || type;
}

/**
 * 智能查找已存在的视频（多级匹配，V2增强版）
 * 
 * 匹配策略优先级：
 * 1. 精确匹配：名称 + 年份 + 地区（最可靠，避免同名不同版本被合并）
 * 2. 次精确匹配：名称 + 年份（处理地区缺失情况）
 * 3. 导演匹配：名称 + 导演（处理年份缺失但有导演的情况）
 * 4. 宽松匹配：仅名称 + 质量评分排序（最后兜底）
 * 
 * 注意：宽松匹配需要额外验证，避免误合并
 */
async function findExistingVideoV2(
  env: Env,
  vodName: string,
  vodYear: string,
  vodArea: string,
  vodDirector: string
): Promise<any | null> {
  // 1. 精确匹配：名称 + 年份 + 地区
  if (vodYear && vodArea) {
    const exact = await env.DB.prepare(`
      SELECT vod_id, vod_play_url, source_name, quality_score, vod_year, vod_area, vod_director
      FROM vod_cache
      WHERE vod_name = ? AND vod_year = ? AND vod_area = ?
      LIMIT 1
    `).bind(vodName, vodYear, vodArea).first();
    
    if (exact) {
      logger.dedup.debug(`精确匹配: ${vodName} (${vodYear}, ${vodArea})`);
      return exact;
    }
  }
  
  // 2. 次精确匹配：名称 + 年份
  if (vodYear) {
    const yearMatch = await env.DB.prepare(`
      SELECT vod_id, vod_play_url, source_name, quality_score, vod_year, vod_area, vod_director
      FROM vod_cache
      WHERE vod_name = ? AND vod_year = ?
      LIMIT 1
    `).bind(vodName, vodYear).first();
    
    if (yearMatch) {
      logger.dedup.debug(`年份匹配: ${vodName} (${vodYear})`);
      return yearMatch;
    }
  }
  
  // 3. 导演匹配：名称 + 导演（处理年份缺失的情况）
  if (vodDirector && vodDirector.length > 0) {
    const directorMatch = await env.DB.prepare(`
      SELECT vod_id, vod_play_url, source_name, quality_score, vod_year, vod_area, vod_director
      FROM vod_cache
      WHERE vod_name = ? AND vod_director LIKE ?
      ORDER BY quality_score DESC
      LIMIT 1
    `).bind(vodName, `%${vodDirector}%`).first();
    
    if (directorMatch) {
      logger.dedup.debug(`导演匹配: ${vodName} (导演: ${vodDirector})`);
      return directorMatch;
    }
  }
  
  // 4. 宽松匹配：仅名称（需要额外验证）
  // 只有在年份和导演都缺失时才使用，且需要检查是否可能是不同版本
  if (!vodYear && !vodDirector) {
    const nameMatch = await env.DB.prepare(`
      SELECT vod_id, vod_play_url, source_name, quality_score, vod_year, vod_area, vod_director
      FROM vod_cache
      WHERE vod_name = ?
      ORDER BY quality_score DESC, updated_at DESC
      LIMIT 1
    `).bind(vodName).first();
    
    if (nameMatch) {
      // 如果已存在的视频有年份信息，而新视频没有，可能是不同版本
      // 这种情况下仍然合并，但记录警告
      if (nameMatch.vod_year) {
        logger.dedup.warn(`宽松匹配(警告): ${vodName} - 新视频无年份，已存在版本: ${nameMatch.vod_year}`);
      } else {
        logger.dedup.debug(`宽松匹配: ${vodName}`);
      }
      return nameMatch;
    }
  }
  
  // 5. 如果新视频有年份但数据库中没有匹配，检查是否有同名但无年份的记录
  // 这种情况下，更新已有记录的年份信息
  if (vodYear) {
    const noYearMatch = await env.DB.prepare(`
      SELECT vod_id, vod_play_url, source_name, quality_score, vod_year, vod_area, vod_director
      FROM vod_cache
      WHERE vod_name = ? AND (vod_year IS NULL OR vod_year = '')
      ORDER BY quality_score DESC
      LIMIT 1
    `).bind(vodName).first();
    
    if (noYearMatch) {
      logger.dedup.debug(`补充年份: ${vodName} -> ${vodYear}`);
      // 更新年份信息
      await env.DB.prepare(`
        UPDATE vod_cache SET vod_year = ? WHERE vod_id = ?
      `).bind(vodYear, noYearMatch.vod_id).run();
      return noYearMatch;
    }
  }
  
  return null;
}

async function updateSearchIndex(env: Env): Promise<void> {
  try {
    await env.DB.prepare('DELETE FROM vod_search').run();
    await env.DB.prepare(`
      INSERT INTO vod_search (vod_id, vod_name, vod_actor, vod_director, vod_content)
      SELECT vod_id, vod_name, vod_actor, vod_director, vod_content
      FROM vod_cache WHERE is_valid = 1
    `).run();
  } catch (error) {
    logger.collectorV2.error('Failed to update search index', { error: error instanceof Error ? error.message : String(error) });
  }
}

// ============================================
// 导出便捷函数
// ============================================

/**
 * 快速创建并执行增量采集任务
 */
export async function runIncrementalCollect(
  env: Env,
  options?: { maxPages?: number; maxVideos?: number }
): Promise<string> {
  const task = await createTask(env, {
    type: 'incremental',
    config: {
      pageEnd: options?.maxPages || 5,
      maxVideos: options?.maxVideos,
    },
  });
  
  // 异步执行
  executeTask(env, task.id).catch(err => logger.collectorV2.error('Task execution failed', { taskId: task.id, error: err instanceof Error ? err.message : String(err) }));
  
  return task.id;
}

/**
 * 快速创建并执行全量采集任务
 */
export async function runFullCollect(env: Env): Promise<string> {
  const task = await createTask(env, {
    type: 'full',
    config: {
      pageEnd: -1,
    },
  });
  
  executeTask(env, task.id).catch(err => logger.collectorV2.error('Full collect task failed', { taskId: task.id, error: err instanceof Error ? err.message : String(err) }));
  
  return task.id;
}

/**
 * 快速创建并执行分类采集任务
 */
export async function runCategoryCollect(
  env: Env,
  categoryId: number,
  options?: { maxPages?: number }
): Promise<string> {
  const task = await createTask(env, {
    type: 'category',
    config: {
      categoryIds: [categoryId],
      pageEnd: options?.maxPages || 20,
    },
  });
  
  executeTask(env, task.id).catch(err => logger.collectorV2.error('Category collect task failed', { taskId: task.id, error: err instanceof Error ? err.message : String(err) }));
  
  return task.id;
}

/**
 * 快速创建并执行指定资源站采集任务
 */
export async function runSourceCollect(
  env: Env,
  sourceId: number,
  options?: { maxPages?: number }
): Promise<string> {
  const task = await createTask(env, {
    type: 'source',
    config: {
      sourceIds: [sourceId],
      pageEnd: options?.maxPages || -1,
    },
  });
  
  executeTask(env, task.id).catch(err => logger.collectorV2.error('Source collect task failed', { taskId: task.id, error: err instanceof Error ? err.message : String(err) }));
  
  return task.id;
}

// ============================================
// 去重诊断和统计功能
// ============================================

/**
 * 去重诊断报告
 */
export interface DedupDiagnostics {
  totalVideos: number;
  uniqueNames: number;
  duplicateGroups: number;
  potentialDuplicates: Array<{
    name: string;
    count: number;
    videos: Array<{
      vodId: string;
      year: string;
      area: string;
      sources: string;
      qualityScore: number;
    }>;
  }>;
  multiSourceVideos: number;
  avgSourcesPerVideo: number;
  recommendations: string[];
}

/**
 * 分析去重效果
 * 检查数据库中是否有潜在的重复视频
 */
export async function analyzeDuplicates(env: Env): Promise<DedupDiagnostics> {
  const diagnostics: DedupDiagnostics = {
    totalVideos: 0,
    uniqueNames: 0,
    duplicateGroups: 0,
    potentialDuplicates: [],
    multiSourceVideos: 0,
    avgSourcesPerVideo: 0,
    recommendations: [],
  };
  
  try {
    // 1. 总视频数
    const totalResult = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM vod_cache WHERE is_valid = 1
    `).first();
    diagnostics.totalVideos = (totalResult?.count as number) || 0;
    
    // 2. 唯一名称数
    const uniqueResult = await env.DB.prepare(`
      SELECT COUNT(DISTINCT vod_name) as count FROM vod_cache WHERE is_valid = 1
    `).first();
    diagnostics.uniqueNames = (uniqueResult?.count as number) || 0;
    
    // 3. 查找同名视频（潜在重复）
    const duplicateGroups = await env.DB.prepare(`
      SELECT vod_name, COUNT(*) as count
      FROM vod_cache
      WHERE is_valid = 1
      GROUP BY vod_name
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 20
    `).all();
    
    diagnostics.duplicateGroups = duplicateGroups.results.length;
    
    // 重复组数据库行类型
    interface DuplicateGroupRow {
      vod_name: string;
      count: number;
    }
    
    // 视频详情数据库行类型
    interface VideoDetailRow {
      vod_id: string;
      vod_year: string | null;
      vod_area: string | null;
      source_name: string | null;
      quality_score: number | null;
    }
    
    // 4. 获取每组重复视频的详情
    for (const group of duplicateGroups.results as DuplicateGroupRow[]) {
      const videos = await env.DB.prepare(`
        SELECT vod_id, vod_year, vod_area, source_name, quality_score
        FROM vod_cache
        WHERE vod_name = ? AND is_valid = 1
        ORDER BY quality_score DESC
      `).bind(group.vod_name).all();
      
      diagnostics.potentialDuplicates.push({
        name: group.vod_name,
        count: group.count,
        videos: (videos.results as VideoDetailRow[]).map((v) => ({
          vodId: v.vod_id,
          year: v.vod_year || '',
          area: v.vod_area || '',
          sources: v.source_name || '',
          qualityScore: v.quality_score || 0,
        })),
      });
    }
    
    // 5. 多源视频统计（合并成功的视频）
    const multiSourceResult = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM vod_cache
      WHERE is_valid = 1 AND source_name LIKE '%,%'
    `).first();
    diagnostics.multiSourceVideos = (multiSourceResult?.count as number) || 0;
    
    // 6. 平均每个视频的来源数
    const avgSourcesResult = await env.DB.prepare(`
      SELECT AVG(LENGTH(source_name) - LENGTH(REPLACE(source_name, ',', '')) + 1) as avg
      FROM vod_cache
      WHERE is_valid = 1 AND source_name IS NOT NULL AND source_name != ''
    `).first();
    diagnostics.avgSourcesPerVideo = parseFloat((avgSourcesResult?.avg as number || 1).toFixed(2));
    
    // 7. 生成建议
    if (diagnostics.duplicateGroups > 0) {
      diagnostics.recommendations.push(
        `发现 ${diagnostics.duplicateGroups} 组同名视频，建议检查是否为不同版本（如翻拍、不同年份）`
      );
    }
    
    if (diagnostics.multiSourceVideos > 0) {
      diagnostics.recommendations.push(
        `${diagnostics.multiSourceVideos} 个视频已成功合并多个来源，去重机制运行正常`
      );
    }
    
    const duplicateRate = diagnostics.totalVideos > 0 
      ? ((diagnostics.totalVideos - diagnostics.uniqueNames) / diagnostics.totalVideos * 100).toFixed(2)
      : '0';
    
    if (parseFloat(duplicateRate) > 5) {
      diagnostics.recommendations.push(
        `重复率 ${duplicateRate}% 偏高，建议运行去重清理任务`
      );
    } else {
      diagnostics.recommendations.push(
        `重复率 ${duplicateRate}%，在正常范围内`
      );
    }
    
  } catch (error) {
    logger.dedup.error('分析失败', { error: error instanceof Error ? error.message : String(error) });
    diagnostics.recommendations.push(`分析过程出错: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
  
  return diagnostics;
}

/**
 * 合并重复视频
 * 将同名视频合并为一条记录，保留最优数据
 */
export async function mergeDuplicateVideos(
  env: Env,
  vodName: string
): Promise<{ merged: boolean; message: string }> {
  try {
    // 获取所有同名视频
    const videos = await env.DB.prepare(`
      SELECT *
      FROM vod_cache
      WHERE vod_name = ? AND is_valid = 1
      ORDER BY quality_score DESC, updated_at DESC
    `).bind(vodName).all();
    
    if (videos.results.length <= 1) {
      return { merged: false, message: '无需合并，只有一条记录' };
    }
    
    // 定义视频合并行类型
    interface MergeVideoRow {
      vod_id: string;
      vod_name: string;
      vod_pic: string | null;
      vod_actor: string | null;
      vod_director: string | null;
      vod_content: string | null;
      vod_year: string | null;
      vod_area: string | null;
      vod_play_url: string | null;
      source_name: string | null;
      quality_score: number | null;
    }
    
    const primary = videos.results[0] as MergeVideoRow;
    const others = videos.results.slice(1) as MergeVideoRow[];
    
    // 合并播放地址
    let mergedPlayUrls: Record<string, string> = {};
    try {
      mergedPlayUrls = JSON.parse(primary.vod_play_url || '{}');
    } catch (e) {
      // 主记录播放地址解析失败，使用空对象
      logger.collectorV2.warn('Failed to parse primary play_urls', { error: e instanceof Error ? e.message : 'Unknown' });
    }
    
    // 合并来源
    const allSources = new Set<string>(
      (primary.source_name || '').split(',').filter(Boolean)
    );
    
    for (const other of others) {
      // 合并播放地址
      try {
        const otherUrls = JSON.parse(other.vod_play_url || '{}');
        mergedPlayUrls = { ...mergedPlayUrls, ...otherUrls };
      } catch (e) {
        // 单个视频播放地址合并失败，跳过该视频
        logger.collectorV2.warn('Failed to merge play_urls', { vodId: other.vod_id, error: e instanceof Error ? e.message : 'Unknown' });
      }
      
      // 合并来源
      (other.source_name || '').split(',').filter(Boolean).forEach((s: string) => allSources.add(s));
      
      // 补充缺失字段
      if (!primary.vod_pic && other.vod_pic) primary.vod_pic = other.vod_pic;
      if (!primary.vod_actor && other.vod_actor) primary.vod_actor = other.vod_actor;
      if (!primary.vod_director && other.vod_director) primary.vod_director = other.vod_director;
      if (!primary.vod_content && other.vod_content) primary.vod_content = other.vod_content;
      if (!primary.vod_year && other.vod_year) primary.vod_year = other.vod_year;
      if (!primary.vod_area && other.vod_area) primary.vod_area = other.vod_area;
    }
    
    // 更新主记录
    await env.DB.prepare(`
      UPDATE vod_cache SET
        vod_play_url = ?,
        source_name = ?,
        vod_pic = COALESCE(NULLIF(?, ''), vod_pic),
        vod_actor = COALESCE(NULLIF(?, ''), vod_actor),
        vod_director = COALESCE(NULLIF(?, ''), vod_director),
        vod_content = COALESCE(NULLIF(?, ''), vod_content),
        vod_year = COALESCE(NULLIF(?, ''), vod_year),
        vod_area = COALESCE(NULLIF(?, ''), vod_area),
        updated_at = ?
      WHERE vod_id = ?
    `).bind(
      JSON.stringify(mergedPlayUrls),
      Array.from(allSources).join(','),
      primary.vod_pic || '',
      primary.vod_actor || '',
      primary.vod_director || '',
      primary.vod_content || '',
      primary.vod_year || '',
      primary.vod_area || '',
      Math.floor(Date.now() / 1000),
      primary.vod_id
    ).run();
    
    // 删除其他记录
    const otherIds = others.map(o => o.vod_id);
    for (const id of otherIds) {
      await env.DB.prepare(`DELETE FROM vod_cache WHERE vod_id = ?`).bind(id).run();
    }
    
    return {
      merged: true,
      message: `成功合并 ${videos.results.length} 条记录为 1 条，删除 ${others.length} 条重复记录`,
    };
    
  } catch (error) {
    return {
      merged: false,
      message: `合并失败: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

/**
 * 批量清理重复视频
 */
export async function cleanupDuplicates(env: Env): Promise<{
  processed: number;
  merged: number;
  errors: number;
}> {
  const result = { processed: 0, merged: 0, errors: 0 };
  
  try {
    // 获取所有重复组
    const duplicateGroups = await env.DB.prepare(`
      SELECT vod_name
      FROM vod_cache
      WHERE is_valid = 1
      GROUP BY vod_name
      HAVING COUNT(*) > 1
    `).all();
    
    for (const group of duplicateGroups.results as { vod_name: string }[]) {
      result.processed++;
      
      const mergeResult = await mergeDuplicateVideos(env, group.vod_name);
      if (mergeResult.merged) {
        result.merged++;
      } else {
        result.errors++;
      }
    }
    
    // 更新搜索索引
    await updateSearchIndex(env);
    
  } catch (error) {
    logger.dedup.error('批量清理失败', { error: error instanceof Error ? error.message : String(error) });
  }
  
  return result;
}

// ============================================
// 搜索服务
// ============================================

/**
 * 快速搜索（使用FTS5全文索引）
 * 支持视频名称、演员、导演的全文搜索
 * 
 * @param env 环境变量
 * @param keyword 搜索关键词
 * @param limit 返回数量限制
 * @returns 匹配的视频列表
 */
export async function searchVideos(
  env: Env,
  keyword: string,
  limit: number = 20
): Promise<VodCacheRow[]> {
  if (!keyword || keyword.trim() === '') {
    return [];
  }
  
  const searchKeyword = keyword.trim();
  
  try {
    // 优先使用FTS5全文搜索（性能最佳）
    const result = await env.DB.prepare(`
      SELECT v.*
      FROM vod_search s
      JOIN vod_cache v ON s.vod_id = v.vod_id
      WHERE vod_search MATCH ?
      AND v.is_valid = 1
      ORDER BY v.quality_score DESC
      LIMIT ?
    `).bind(searchKeyword, limit).all();

    if (result.results.length > 0) {
      return result.results as VodCacheRow[];
    }
    
    // FTS5 无结果时，尝试 LIKE 搜索
    return await searchVideosLike(env, searchKeyword, limit);
    
  } catch (error) {
    logger.search.error('FTS5 search failed', { error: error instanceof Error ? error.message : String(error) });
    // FTS5 失败时降级到 LIKE 搜索
    return await searchVideosLike(env, searchKeyword, limit);
  }
}

/**
 * LIKE 模糊搜索（FTS5 的降级方案）
 */
async function searchVideosLike(
  env: Env,
  keyword: string,
  limit: number
): Promise<VodCacheRow[]> {
  try {
    const likePattern = `%${keyword}%`;
    const result = await env.DB.prepare(`
      SELECT *
      FROM vod_cache
      WHERE (vod_name LIKE ? OR vod_actor LIKE ? OR vod_director LIKE ?)
      AND is_valid = 1
      ORDER BY quality_score DESC, updated_at DESC
      LIMIT ?
    `).bind(likePattern, likePattern, likePattern, limit).all();

    return result.results as VodCacheRow[];
  } catch (error) {
    logger.collectorV2.error('LIKE search failed', { error: String(error) });
    return [];
  }
}

/**
 * 高级搜索（支持多条件筛选）
 */
export async function advancedSearch(
  env: Env,
  options: {
    keyword?: string;
    typeId?: number;
    year?: string;
    area?: string;
    actor?: string;
    director?: string;
    orderBy?: 'score' | 'time' | 'name';
    page?: number;
    pageSize?: number;
  }
): Promise<{ list: VodCacheRow[]; total: number; page: number; pageSize: number }> {
  const {
    keyword,
    typeId,
    year,
    area,
    actor,
    director,
    orderBy = 'score',
    page = 1,
    pageSize = 20,
  } = options;
  
  const conditions: string[] = ['is_valid = 1'];
  const params: (string | number)[] = [];
  
  if (keyword) {
    conditions.push('(vod_name LIKE ? OR vod_actor LIKE ? OR vod_director LIKE ?)');
    const likePattern = `%${keyword}%`;
    params.push(likePattern, likePattern, likePattern);
  }
  
  if (typeId) {
    conditions.push('type_id = ?');
    params.push(typeId);
  }
  
  if (year) {
    conditions.push('vod_year = ?');
    params.push(year);
  }
  
  if (area) {
    conditions.push('vod_area LIKE ?');
    params.push(`%${area}%`);
  }
  
  if (actor) {
    conditions.push('vod_actor LIKE ?');
    params.push(`%${actor}%`);
  }
  
  if (director) {
    conditions.push('vod_director LIKE ?');
    params.push(`%${director}%`);
  }
  
  const whereClause = conditions.join(' AND ');
  
  // 排序
  let orderClause = 'quality_score DESC, updated_at DESC';
  if (orderBy === 'time') {
    orderClause = 'updated_at DESC';
  } else if (orderBy === 'name') {
    orderClause = 'vod_name ASC';
  }
  
  // 获取总数
  const countResult = await env.DB.prepare(`
    SELECT COUNT(*) as total FROM vod_cache WHERE ${whereClause}
  `).bind(...params).first();
  const total = (countResult?.total as number) || 0;
  
  // 获取分页数据
  const offset = (page - 1) * pageSize;
  const listResult = await env.DB.prepare(`
    SELECT * FROM vod_cache 
    WHERE ${whereClause}
    ORDER BY ${orderClause}
    LIMIT ? OFFSET ?
  `).bind(...params, pageSize, offset).all();
  
  return {
    list: listResult.results as VodCacheRow[],
    total,
    page,
    pageSize,
  };
}

// 搜索建议行类型
interface SuggestionRow {
  vod_name: string;
}

/**
 * 搜索建议（自动补全）
 */
export async function getSearchSuggestions(
  env: Env,
  keyword: string,
  limit: number = 10
): Promise<string[]> {
  if (!keyword || keyword.trim().length < 2) {
    return [];
  }
  
  try {
    const result = await env.DB.prepare(`
      SELECT DISTINCT vod_name
      FROM vod_cache
      WHERE vod_name LIKE ? AND is_valid = 1
      ORDER BY quality_score DESC
      LIMIT ?
    `).bind(`${keyword}%`, limit).all();
    
    return (result.results as SuggestionRow[]).map((r) => r.vod_name);
  } catch (error) {
    logger.collectorV2.error('Get suggestions failed', { error: String(error) });
    return [];
  }
}
