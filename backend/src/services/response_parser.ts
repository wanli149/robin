/**
 * Response Parser Service
 * 资源站响应解析器 - 支持 JSON 和 XML 格式
 */

export type ResponseFormat = 'json' | 'xml' | 'auto';

export interface ParsedVideoList {
  code: number;
  msg: string;
  page: number;
  pagecount: number;
  limit: number;
  total: number;
  list: ParsedVideo[];
}

export interface ParsedVideo {
  vod_id: string | number;
  vod_name: string;
  vod_pic?: string;
  vod_pic_thumb?: string;
  vod_remarks?: string;
  vod_year?: string;
  vod_area?: string;
  vod_lang?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_content?: string;
  vod_play_url?: string;
  vod_play_from?: string;
  vod_score?: string;
  vod_tag?: string;
  type_id?: number;
  type_name?: string;
  vod_time?: string;
  vod_state?: string;
}

// 原始视频数据类型（来自 API 响应）
interface RawVideoData {
  vod_id?: string | number;
  id?: string | number;
  vod_name?: string;
  name?: string;
  vod_pic?: string;
  pic?: string;
  vod_pic_thumb?: string;
  pic_thumb?: string;
  vod_remarks?: string;
  note?: string;
  vod_year?: string;
  year?: string;
  vod_area?: string;
  area?: string;
  vod_lang?: string;
  lang?: string;
  vod_actor?: string;
  actor?: string;
  vod_director?: string;
  director?: string;
  vod_content?: string;
  des?: string;
  blurb?: string;
  vod_play_url?: string;
  vod_play_from?: string;
  vod_score?: string;
  score?: string;
  vod_tag?: string;
  tag?: string;
  type_id?: number;
  tid?: number;
  type_name?: string;
  type?: string;
}

/**
 * 自动检测响应格式
 */
export function detectFormat(text: string): ResponseFormat {
  const trimmed = text.trim();
  
  // XML 格式检测
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<rss') || trimmed.startsWith('<list')) {
    return 'xml';
  }
  
  // JSON 格式检测
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }
  
  return 'json'; // 默认尝试 JSON
}

/**
 * 解析响应数据
 */
export async function parseResponse(
  response: Response,
  format: ResponseFormat = 'auto'
): Promise<ParsedVideoList> {
  const text = await response.text();
  
  // 自动检测格式
  const actualFormat = format === 'auto' ? detectFormat(text) : format;
  
  if (actualFormat === 'xml') {
    return parseXmlResponse(text);
  } else {
    return parseJsonResponse(text);
  }
}

/**
 * 解析 JSON 响应
 */
export function parseJsonResponse(text: string): ParsedVideoList {
  try {
    const data = JSON.parse(text);
    
    return {
      code: data.code ?? 1,
      msg: data.msg ?? 'success',
      page: data.page ?? 1,
      pagecount: data.pagecount ?? data.page_count ?? 1,
      limit: data.limit ?? 20,
      total: data.total ?? 0,
      list: (data.list || []).map(normalizeVideo),
    };
  } catch (error) {
    throw new Error(`JSON 解析失败: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

/**
 * 解析 XML 响应 (苹果CMS格式)
 */
export function parseXmlResponse(text: string): ParsedVideoList {
  try {
    // 简单的 XML 解析器（不依赖外部库）
    const result: ParsedVideoList = {
      code: 1,
      msg: 'success',
      page: 1,
      pagecount: 1,
      limit: 20,
      total: 0,
      list: [],
    };
    
    // 解析 rss/list 根元素属性
    // 优先从 <list> 标签获取分页信息，因为 <rss> 标签通常只有 version 属性
    const listMatch = text.match(/<list[^>]*>/i);
    if (listMatch) {
      const listTag = listMatch[0];
      const page = extractAttr(listTag, 'page');
      const pagecount = extractAttr(listTag, 'pagecount');
      const pagesize = extractAttr(listTag, 'pagesize');
      const recordcount = extractAttr(listTag, 'recordcount');
      
      if (page) result.page = parseInt(page);
      if (pagecount) result.pagecount = parseInt(pagecount);
      if (pagesize) result.limit = parseInt(pagesize);
      if (recordcount) result.total = parseInt(recordcount);
    }
    
    // 如果 <list> 标签没有分页信息，尝试从 <rss> 标签获取（某些资源站可能使用这种格式）
    if (result.pagecount === 1 && result.total === 0) {
      const rssMatch = text.match(/<rss[^>]*>/i);
      if (rssMatch) {
        const rssTag = rssMatch[0];
        const page = extractAttr(rssTag, 'page');
        const pagecount = extractAttr(rssTag, 'pagecount');
        const pagesize = extractAttr(rssTag, 'pagesize');
        const recordcount = extractAttr(rssTag, 'recordcount');
        
        if (page) result.page = parseInt(page);
        if (pagecount) result.pagecount = parseInt(pagecount);
        if (pagesize) result.limit = parseInt(pagesize);
        if (recordcount) result.total = parseInt(recordcount);
      }
    }
    
    // 解析视频列表
    const videoMatches = text.matchAll(/<video>([\s\S]*?)<\/video>/gi);
    
    for (const match of videoMatches) {
      const videoXml = match[1];
      const video = parseVideoXml(videoXml);
      if (video.vod_id && video.vod_name) {
        result.list.push(video);
      }
    }
    
    // 如果没有 <video> 标签，尝试解析 <item> 标签（某些资源站使用）
    if (result.list.length === 0) {
      const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/gi);
      for (const match of itemMatches) {
        const itemXml = match[1];
        const video = parseVideoXml(itemXml);
        if (video.vod_id && video.vod_name) {
          result.list.push(video);
        }
      }
    }
    
    return result;
  } catch (error) {
    throw new Error(`XML 解析失败: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

/**
 * 解析单个视频 XML
 */
function parseVideoXml(xml: string): ParsedVideo {
  return {
    vod_id: extractTag(xml, 'id') || extractTag(xml, 'vod_id') || '',
    vod_name: extractTag(xml, 'name') || extractTag(xml, 'vod_name') || '',
    vod_pic: extractTag(xml, 'pic') || extractTag(xml, 'vod_pic') || '',
    vod_pic_thumb: extractTag(xml, 'pic_thumb') || extractTag(xml, 'vod_pic_thumb') || '',
    vod_remarks: extractTag(xml, 'note') || extractTag(xml, 'vod_remarks') || '',
    vod_year: extractTag(xml, 'year') || extractTag(xml, 'vod_year') || '',
    vod_area: extractTag(xml, 'area') || extractTag(xml, 'vod_area') || '',
    vod_lang: extractTag(xml, 'lang') || extractTag(xml, 'vod_lang') || '',
    vod_actor: extractTag(xml, 'actor') || extractTag(xml, 'vod_actor') || '',
    vod_director: extractTag(xml, 'director') || extractTag(xml, 'vod_director') || '',
    vod_content: extractTag(xml, 'des') || extractTag(xml, 'vod_content') || '',
    vod_play_url: extractPlayUrl(xml) || extractTag(xml, 'vod_play_url') || '',
    vod_play_from: extractTag(xml, 'vod_play_from') || '',
    vod_score: extractTag(xml, 'score') || extractTag(xml, 'vod_score') || '',
    vod_tag: extractTag(xml, 'tag') || extractTag(xml, 'vod_tag') || '',
    type_id: parseInt(extractTag(xml, 'tid') || extractTag(xml, 'type_id') || '0'),
    type_name: extractTag(xml, 'type') || extractTag(xml, 'type_name') || '',
    // 额外字段
    vod_time: extractTag(xml, 'last') || extractTag(xml, 'vod_time') || '',
    vod_state: extractTag(xml, 'state') || '',
  };
}

/**
 * 提取播放地址（处理 <dl><dd> 结构和 CDATA）
 */
function extractPlayUrl(xml: string): string {
  // 匹配 <dl>...</dl> 内容
  const dlMatch = xml.match(/<dl>([\s\S]*?)<\/dl>/i);
  if (!dlMatch) return '';
  
  const dlContent = dlMatch[1];
  
  // 匹配所有 <dd> 标签，提取 flag 和内容
  const ddRegex = /<dd[^>]*(?:flag="([^"]*)")?[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/dd>/gi;
  const results: string[] = [];
  let match;
  
  while ((match = ddRegex.exec(dlContent)) !== null) {
    let content = match[2] || '';
    // 清理 CDATA 残留
    content = content.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
    if (content) {
      results.push(content);
    }
  }
  
  // 返回第一个有效的播放地址（通常只有一个）
  return results[0] || '';
}

/**
 * 提取 XML 标签内容
 */
function extractTag(xml: string, tagName: string): string {
  // 尝试匹配 CDATA
  const cdataRegex = new RegExp(`<${tagName}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) {
    return cdataMatch[1].trim();
  }
  
  // 普通标签
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * 提取 XML 属性值
 */
function extractAttr(tag: string, attrName: string): string {
  const regex = new RegExp(`${attrName}="([^"]*)"`, 'i');
  const match = tag.match(regex);
  return match ? match[1] : '';
}

/**
 * 标准化视频数据
 */
function normalizeVideo(video: RawVideoData): ParsedVideo {
  return {
    vod_id: video.vod_id ?? video.id ?? '',
    vod_name: video.vod_name ?? video.name ?? '',
    vod_pic: video.vod_pic ?? video.pic ?? '',
    vod_pic_thumb: video.vod_pic_thumb ?? video.pic_thumb ?? video.vod_pic ?? '',
    vod_remarks: video.vod_remarks ?? video.note ?? '',
    vod_year: video.vod_year ?? video.year ?? '',
    vod_area: video.vod_area ?? video.area ?? '',
    vod_lang: video.vod_lang ?? video.lang ?? '',
    vod_actor: video.vod_actor ?? video.actor ?? '',
    vod_director: video.vod_director ?? video.director ?? '',
    vod_content: video.vod_content ?? video.des ?? video.blurb ?? '',
    vod_play_url: video.vod_play_url ?? '',
    vod_play_from: video.vod_play_from ?? '',
    vod_score: video.vod_score ?? video.score ?? '',
    vod_tag: video.vod_tag ?? video.tag ?? '',
    type_id: video.type_id ?? video.tid ?? 0,
    type_name: video.type_name ?? video.type ?? '',
  };
}

/**
 * 测试资源站连接并检测格式
 */
export async function testSourceConnection(apiUrl: string): Promise<{
  success: boolean;
  format: ResponseFormat;
  responseTime: number;
  videoCount: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    const url = new URL(apiUrl);
    url.searchParams.set('ac', 'list');
    url.searchParams.set('pg', '1');
    
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        success: false,
        format: 'json',
        responseTime,
        videoCount: 0,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    const text = await response.text();
    const format = detectFormat(text);
    
    let parsed: ParsedVideoList;
    if (format === 'xml') {
      parsed = parseXmlResponse(text);
    } else {
      parsed = parseJsonResponse(text);
    }
    
    return {
      success: true,
      format,
      responseTime,
      videoCount: parsed.list.length,
    };
  } catch (error) {
    return {
      success: false,
      format: 'json',
      responseTime: Date.now() - startTime,
      videoCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
