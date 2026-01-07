/**
 * 苹果CMS兼容接口
 * 提供标准的苹果CMS格式API，兼容TVBox等第三方播放器
 */

import { Hono, Context } from 'hono';
import { aggregateVideos } from '../services/spider_aggregator';
import { logger } from '../utils/logger';

type Bindings = {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
  ADMIN_SECRET_KEY?: string; // 可选，因为CMS路由不需要admin认证
  JWT_SECRET?: string;
  TMDB_API_KEY?: string;
  DOUBAN_API_KEY?: string;
  DINGTALK_WEBHOOK?: string;
};

// CMS 视频数据类型
interface CMSVideo {
  vod_id: string | number;
  vod_name: string;
  type_id: number;
  type_name: string;
  vod_en: string;
  vod_time: string;
  vod_remarks: string;
  vod_play_from: string;
  vod_play_url: string;
  vod_pic: string;
  vod_pic_thumb: string;
  vod_pic_slide: string;
  vod_actor: string;
  vod_director: string;
  vod_writer: string;
  vod_behind: string;
  vod_blurb: string;
  vod_content: string;
  vod_year: string;
  vod_area: string;
  vod_lang: string;
  vod_class: string;
  vod_tag: string;
  vod_state: string;
  vod_version: string;
  vod_serial: string;
  vod_tv: string;
  vod_weekday: string;
  vod_duration: string;
  vod_total: number;
  vod_isend: number;
  vod_lock: number;
  vod_level: number;
  vod_copyright: number;
  vod_points: number;
  vod_points_play: number;
  vod_points_down: number;
  vod_score: string;
  vod_score_all: number;
  vod_score_num: number;
  vod_hits: number;
  vod_hits_day: number;
  vod_hits_week: number;
  vod_hits_month: number;
  vod_up: number;
  vod_down: number;
  vod_status: number;
}

// CMS 列表响应类型
interface CMSListResponse {
  code: number;
  msg: string;
  page: number;
  pagecount: number;
  limit: string;
  total: number;
  list: CMSVideo[];
}

// 原始视频数据类型
interface RawVideoData {
  vod_id?: string | number;
  vod_name?: string;
  type_id?: number;
  type_name?: string;
  vod_en?: string;
  vod_time?: string;
  vod_remarks?: string;
  vod_play_from?: string;
  vod_play_url?: string;
  vod_pic?: string;
  vod_pic_thumb?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_content?: string;
  vod_year?: string;
  vod_area?: string;
  vod_lang?: string;
  vod_class?: string;
  vod_tag?: string;
  vod_score?: string;
  vod_hits?: number;
  vod_hits_day?: number;
  vod_hits_week?: number;
  vod_hits_month?: number;
}

const cms = new Hono<{ Bindings: Bindings }>();

// 测试接口
// 简单测试接口（不调用任何其他函数）
cms.get('/cms/test', (c) => {
  return c.json({ code: 1, msg: 'CMS route is working!', path: c.req.path });
});

cms.get('/api.php/test', (c) => {
  return c.json({ code: 1, msg: 'API.PHP test working!', path: c.req.path });
});

/**
 * GET /api.php/provide/vod
 * 苹果CMS标准接口（公开接口，无需认证）
 * 
 * 支持的参数：
 * - ac: 操作类型（list=列表, detail=详情, videolist=视频列表）
 * - t: 分类ID
 * - pg: 页码
 * - wd: 搜索关键词
 * - ids: 视频ID（多个用逗号分隔）
 * - h: 最近N小时更新
 */
cms.get('/api.php/provide/vod', async (c) => {
  try {
    const ac = c.req.query('ac') || 'list';
    const t = c.req.query('t');
    const pg = parseInt(c.req.query('pg') || '1');
    const wd = c.req.query('wd');
    const ids = c.req.query('ids');
    const h = c.req.query('h');

    logger.admin.info(`CMS Request: ac=${ac}, t=${t}, pg=${pg}, wd=${wd}, ids=${ids}`);

    // 处理详情请求
    if (ac === 'detail' && ids) {
      const result = await handleDetail(c.env, ids);
      return c.json(result);
    }

    // 处理列表/搜索请求
    const result = await handleList(c.env, { t, pg, wd, h });
    return c.json(result);
  } catch (error) {
    logger.admin.error('CMS request error', { error: String(error) });
    return c.json({
      code: 0,
      msg: '请求失败',
      page: 1,
      pagecount: 0,
      limit: '20',
      total: 0,
      list: [],
    });
  }
});

/**
 * 处理详情请求
 */
async function handleDetail(env: Bindings, ids: string) {
  const idList = ids.split(',').map(id => id.trim());
  const videos = [];

  for (const vodId of idList) {
    try {
      // 从缓存获取
      const cached = await env.DB.prepare(`
        SELECT * FROM vod_cache WHERE vod_id = ?
      `).bind(vodId).first();

      if (cached) {
        videos.push(convertToCMSFormat(cached));
      } else {
        // 从聚合器获取
        const result = await aggregateVideos(env, '', { ids: vodId }, {
          timeout: 5000,
          includeWelfare: false,
        });
        
        if (result.list.length > 0) {
          videos.push(convertToCMSFormat(result.list[0]));
        }
      }
    } catch (error) {
      logger.admin.error(`Failed to get detail for ${vodId}`, { error: String(error) });
    }
  }

  return {
    code: 1,
    msg: '数据列表',
    page: 1,
    pagecount: 1,
    limit: String(videos.length),
    total: videos.length,
    list: videos,
  };
}

/**
 * 处理列表请求
 */
async function handleList(
  env: Bindings,
  params: { t?: string; pg: number; wd?: string; h?: string }
) {
  const { t, pg, wd, h } = params;
  const limit = 20;

  try {
    // 构建查询参数
    const queryParams: Record<string, string> = {
      pg: String(pg),
    };

    if (t) queryParams.t = t;
    if (wd) queryParams.wd = wd;
    if (h) queryParams.h = h;

    // 调用聚合器
    const result = await aggregateVideos(env, '', queryParams, {
      timeout: 5000,
      includeWelfare: false,
    });

    // 转换为CMS格式
    const cmsList = result.list.map(video => convertToCMSFormat(video));

    return {
      code: 1,
      msg: '数据列表',
      page: pg,
      pagecount: result.pagecount || Math.ceil(result.total / limit),
      limit: String(limit),
      total: result.total,
      list: cmsList,
    };
  } catch (error) {
    logger.admin.error('CMS List error', { error: String(error) });
    return {
      code: 0,
      msg: '获取列表失败',
      page: pg,
      pagecount: 0,
      limit: String(limit),
      total: 0,
      list: [],
    };
  }
}

/**
 * 转换为苹果CMS标准格式
 */
function convertToCMSFormat(video: RawVideoData): CMSVideo {
  // 处理播放地址 - 标准格式
  // vod_play_from: "播放源1$$$播放源2$$$播放源3"
  // vod_play_url: "第01集$url1#第02集$url2$$$第01集$url3#第02集$url4$$$..."
  let vodPlayUrl = '';
  let vodPlayFrom = '';
  
  if (video.vod_play_url) {
    try {
      const playUrls = typeof video.vod_play_url === 'string' 
        ? JSON.parse(video.vod_play_url)
        : video.vod_play_url;
      
      if (typeof playUrls === 'object' && playUrls !== null) {
        // 多个播放源
        const sources: string[] = [];
        const urls: string[] = [];
        
        for (const [sourceName, sourceData] of Object.entries(playUrls)) {
          if (sourceData && Array.isArray(sourceData)) {
            sources.push(sourceName);
            const episodeStrs = (sourceData as Array<{ name: string; url: string }>)
              .map(ep => `${ep.name}$${ep.url}`)
              .join('#');
            urls.push(episodeStrs);
          }
        }
        
        if (sources.length > 0) {
          vodPlayFrom = sources.join('$$$');
          vodPlayUrl = urls.join('$$$');
        } else {
          vodPlayFrom = '默认';
          vodPlayUrl = '';
        }
      } else {
        // 单个播放源
        vodPlayFrom = '默认';
        vodPlayUrl = String(playUrls || '');
      }
    } catch (e) {
      // 解析失败，直接使用原始值
      vodPlayFrom = '默认';
      vodPlayUrl = String(video.vod_play_url || '');
    }
  }

  return {
    vod_id: video.vod_id,
    vod_name: video.vod_name || '',
    vod_pic: video.vod_pic || '',
    vod_pic_thumb: video.vod_pic_thumb || video.vod_pic || '',
    vod_pic_slide: video.vod_pic_slide || video.vod_pic || '',
    vod_remarks: video.vod_remarks || '',
    vod_year: video.vod_year || '',
    vod_area: video.vod_area || '',
    vod_lang: video.vod_lang || '',
    vod_actor: video.vod_actor || '',
    vod_director: video.vod_director || '',
    vod_writer: video.vod_writer || '',
    vod_content: video.vod_content || '',
    vod_play_from: vodPlayFrom,
    vod_play_url: vodPlayUrl,
    vod_time: video.vod_time || video.updated_at || '',
    vod_time_add: video.created_at || '',
    vod_time_hits: video.vod_hits || 0,
    vod_time_make: video.updated_at || '',
    vod_score: video.vod_score || 0,
    vod_score_all: video.vod_score_num || 0,
    vod_score_num: video.vod_score_num || 0,
    vod_duration: video.vod_duration || '',
    vod_total: video.vod_total || 0,
    vod_serial: video.vod_serial || '',
    vod_tv: video.vod_tv || '',
    vod_weekday: video.vod_weekday || '',
    vod_tag: video.vod_tag || '',
    vod_class: video.vod_class || '',
    type_id: video.type_id || 1,
    type_name: video.type_name || '电影',
    vod_en: video.vod_en || '',
    vod_letter: video.vod_letter || '',
    vod_color: video.vod_color || '',
    vod_version: video.vod_version || '',
    vod_state: video.vod_state || '',
    vod_author: video.vod_author || '',
    vod_jumpurl: video.vod_jumpurl || '',
    vod_tpl: video.vod_tpl || '',
    vod_tpl_play: video.vod_tpl_play || '',
    vod_tpl_down: video.vod_tpl_down || '',
    vod_isend: video.vod_isend || 0,
    vod_lock: video.vod_lock || 0,
    vod_level: video.vod_level || 0,
    vod_copyright: video.vod_copyright || 0,
    vod_points: video.vod_points || 0,
    vod_points_play: video.vod_points_play || 0,
    vod_points_down: video.vod_points_down || 0,
    vod_hits: video.vod_hits || 0,
    vod_hits_day: video.vod_hits_day || 0,
    vod_hits_week: video.vod_hits_week || 0,
    vod_hits_month: video.vod_hits_month || 0,
    vod_up: video.vod_up || 0,
    vod_down: video.vod_down || 0,
    vod_status: video.vod_status || 1,
  };
}

/**
 * GET /api.php/provide/vod/at/xml
 * XML格式接口（部分TVBox源使用）
 */
cms.get('/api.php/provide/vod/at/xml', async (c) => {
  // 获取JSON数据
  const jsonData = await handleCMSRequest(c);
  
  // 转换为XML
  const xml = convertToXML(jsonData);
  
  return c.text(xml, 200, {
    'Content-Type': 'application/xml; charset=utf-8',
  });
});

/**
 * 处理CMS请求（内部方法）
 */
async function handleCMSRequest(c: Context<{ Bindings: Bindings }>): Promise<CMSListResponse> {
  const ac = c.req.query('ac') || 'list';
  const ids = c.req.query('ids');
  
  if (ac === 'detail' && ids) {
    return await handleDetail(c.env, ids);
  }
  
  return await handleList(c.env, {
    t: c.req.query('t'),
    pg: parseInt(c.req.query('pg') || '1'),
    wd: c.req.query('wd'),
    h: c.req.query('h'),
  });
}

/**
 * 转换为XML格式
 */
function convertToXML(data: CMSListResponse): string {
  let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
  xml += '<rss version="2.0">\n';
  xml += '  <list>\n';
  xml += `    <page>${data.page}</page>\n`;
  xml += `    <pagecount>${data.pagecount}</pagecount>\n`;
  xml += `    <pagesize>${data.limit}</pagesize>\n`;
  xml += `    <recordcount>${data.total}</recordcount>\n`;
  
  for (const video of data.list) {
    xml += '    <video>\n';
    xml += `      <last>${video.vod_time}</last>\n`;
    xml += `      <id>${video.vod_id}</id>\n`;
    xml += `      <tid>${video.type_id}</tid>\n`;
    xml += `      <name><![CDATA[${video.vod_name}]]></name>\n`;
    xml += `      <type>${video.type_name}</type>\n`;
    xml += `      <pic>${video.vod_pic}</pic>\n`;
    xml += `      <note><![CDATA[${video.vod_remarks}]]></note>\n`;
    xml += `      <year>${video.vod_year}</year>\n`;
    xml += `      <area>${video.vod_area}</area>\n`;
    xml += `      <actor><![CDATA[${video.vod_actor}]]></actor>\n`;
    xml += `      <director><![CDATA[${video.vod_director}]]></director>\n`;
    xml += `      <des><![CDATA[${video.vod_content}]]></des>\n`;
    xml += `      <dl>\n`;
    
    if (video.vod_play_from && video.vod_play_url) {
      const froms = video.vod_play_from.split('$$$');
      const urls = video.vod_play_url.split('$$$');
      
      for (let i = 0; i < froms.length; i++) {
        xml += `        <dd flag="${froms[i] || '默认'}"><![CDATA[${urls[i] || ''}]]></dd>\n`;
      }
    }
    
    xml += '      </dl>\n';
    xml += '    </video>\n';
  }
  
  xml += '  </list>\n';
  xml += '</rss>';
  
  return xml;
}

export default cms;
