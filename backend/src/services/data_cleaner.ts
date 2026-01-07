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
 * 确保是清洗后的格式
 */
export function ensureCleanedFormat(playUrls: unknown): CleanedPlayUrls {
  if (!playUrls || typeof playUrls !== 'object') return {};
  return playUrls as CleanedPlayUrls;
}

/**
 * 将清洗后的格式转换为 play_sources 数组
 * 用于 API 返回
 */
export function toPlaySources(
  playUrls: CleanedPlayUrls
): Array<{ name: string; episodes: Episode[] }> {
  return Object.entries(playUrls).map(([name, episodes]) => ({
    name,
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
