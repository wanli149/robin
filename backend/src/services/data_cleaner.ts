/**
 * 数据清洗服务
 * 在采集时清洗数据，降低 API 请求时的 CPU 消耗
 */

import { logger } from '../utils/logger';

export interface Episode {
  name: string;
  url: string;
}

export type CleanedPlayUrls = Record<string, Episode[]>;
export type RawPlayUrls = Record<string, string>;

/**
 * 清理HTML标签，提取纯文本
 * 用于清洗视频简介等字段
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  
  return html
    // 移除所有HTML标签
    .replace(/<[^>]*>/g, '')
    // 解码常见HTML实体
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&hellip;/g, '...')
    // 移除多余空白
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 清洗播放地址
 * 输入: { "资源站": "第1集$url#第2集$url" }
 * 输出: { "资源站": [{ name: "第1集", url: "https://..." }] }
 */
export function cleanPlayUrls(rawUrls: RawPlayUrls): CleanedPlayUrls {
  const result: CleanedPlayUrls = {};

  for (const [sourceName, rawUrl] of Object.entries(rawUrls)) {
    if (!rawUrl || typeof rawUrl !== 'string') continue;
    const episodes = parseEpisodes(rawUrl);
    if (episodes.length > 0) {
      result[sourceName] = episodes;
    }
  }

  return result;
}

/**
 * 解析选集字符串
 * 输入: "第1集$http://a.com/1.m3u8#第2集$http://a.com/2.m3u8"
 * 输出: [{ name: "第1集", url: "https://a.com/1.m3u8" }, ...]
 */
export function parseEpisodes(raw: string): Episode[] {
  if (!raw) return [];

  const episodes: Episode[] = [];
  const parts = raw.split('#');

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    const dollarIndex = part.indexOf('$');
    let name: string;
    let url: string;

    if (dollarIndex > 0) {
      name = part.substring(0, dollarIndex).trim() || `第${i + 1}集`;
      url = part.substring(dollarIndex + 1).trim();
    } else {
      // 没有 $ 分隔符，整个作为 URL
      name = `第${i + 1}集`;
      url = part;
    }

    // HTTP 升级
    url = upgradeToHttps(url);

    // 过滤无效 URL
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      episodes.push({ name, url });
    }
  }

  return episodes;
}


/**
 * HTTP 升级为 HTTPS
 * 大多数资源站都支持 HTTPS，直接替换
 */
export function upgradeToHttps(url: string): string {
  if (!url) return url;

  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }

  return url;
}

/**
 * 清洗图片地址
 */
export function cleanImageUrl(url: string): string {
  if (!url) return url;
  return upgradeToHttps(url);
}

/**
 * 地区名称标准化映射
 * 将各种地区别名统一为标准名称
 */
const AREA_NORMALIZATION: Record<string, string> = {
  // 中国大陆
  '大陆': '中国大陆',
  '内地': '中国大陆',
  '国产': '中国大陆',
  '中国': '中国大陆',
  // 香港
  '香港': '中国香港',
  '港': '中国香港',
  // 台湾
  '台湾': '中国台湾',
  '台': '中国台湾',
  // 韩国
  '韩': '韩国',
  '南韩': '韩国',
  // 日本
  '日': '日本',
  // 美国
  '美': '美国',
  // 英国
  '英': '英国',
  // 泰国
  '泰': '泰国',
  // 欧美（保持不变，因为是复合地区）
};

/**
 * 标准化地区名称
 * 将各种地区别名统一为标准名称
 */
export function normalizeArea(area: string): string {
  if (!area) return area;
  
  const trimmed = area.trim();
  
  // 精确匹配
  if (AREA_NORMALIZATION[trimmed]) {
    return AREA_NORMALIZATION[trimmed];
  }
  
  // 处理复合地区（如"中国大陆,中国香港"）
  if (trimmed.includes(',') || trimmed.includes('，')) {
    const parts = trimmed.split(/[,，]/).map(p => p.trim()).filter(Boolean);
    const normalized = parts.map(p => AREA_NORMALIZATION[p] || p);
    // 去重
    return [...new Set(normalized)].join(',');
  }
  
  return trimmed;
}

/**
 * 确保是清洗后的格式
 * 如果输入是原始字符串格式，先进行清洗
 */
export function ensureCleanedFormat(playUrls: unknown): CleanedPlayUrls {
  if (!playUrls) return {};
  
  // 如果是字符串（原始格式），需要清洗
  if (typeof playUrls === 'string') {
    // 原始格式: "第1集$url#第2集$url"
    const episodes = parseEpisodes(playUrls);
    if (episodes.length > 0) {
      return { '默认': episodes };
    }
    return {};
  }
  
  // 如果是对象，检查是否已经是清洗后的格式
  if (typeof playUrls === 'object') {
    const obj = playUrls as Record<string, unknown>;
    const firstValue = Object.values(obj)[0];
    
    // 已经是清洗后的格式 { "源名": [{ name, url }] }
    if (Array.isArray(firstValue)) {
      return obj as CleanedPlayUrls;
    }
    
    // 旧格式 { "源名": "第1集$url#第2集$url" }
    return cleanPlayUrls(obj as RawPlayUrls);
  }
  
  return {};
}

/**
 * 将清洗后的格式转换为 play_sources 数组
 * 用于 API 返回
 * @param playUrls 清洗后的播放地址
 * @param displayNameMap 可选的源名称到显示别名的映射
 */
export function toPlaySources(
  playUrls: CleanedPlayUrls,
  displayNameMap?: Map<string, string>
): Array<{ name: string; episodes: Episode[] }> {
  return Object.entries(playUrls).map(([name, episodes]) => ({
    name: displayNameMap?.get(name) || name,
    episodes,
  }));
}

/**
 * 从清洗后的格式中提取第一个播放 URL
 */
export function extractFirstUrl(playUrls: unknown): string | null {
  if (!playUrls) return null;

  try {
    const parsed = typeof playUrls === 'string' ? JSON.parse(playUrls) : playUrls;
    const firstSource = Object.values(parsed as Record<string, unknown>)[0];

    // 新格式
    if (Array.isArray(firstSource) && firstSource.length > 0) {
      return (firstSource[0] as Episode).url || null;
    }
  } catch (e) {
    // JSON 解析失败
  }

  return null;
}

/**
 * 合并两个清洗后的播放地址
 * 用于视频合并器
 */
export function mergeCleanedPlayUrls(
  existing: CleanedPlayUrls,
  newUrls: CleanedPlayUrls
): CleanedPlayUrls {
  const result = { ...existing };

  for (const [sourceName, episodes] of Object.entries(newUrls)) {
    if (!result[sourceName]) {
      result[sourceName] = episodes;
    }
    // 如果已存在同名源，保留现有的（或可以选择合并集数）
  }

  return result;
}
