/**
 * 应用配置
 * 定义缓存、超时、健康检查等配置常量
 */

import { TIME_CONSTANTS } from './utils/time';

/**
 * 资源站配置接口
 * 注意：资源站数据从数据库 video_sources 表获取，不再硬编码
 */
export interface ResourceSite {
  name: string;
  url: string;
  weight: number; // 权重，用于排序
  enabled: boolean;
  timeout?: number; // 超时时间（毫秒）
  isWelfare?: boolean; // 是否为福利资源站
}

/**
 * TMDB API 配置
 */
export const TMDB_CONFIG = {
  baseUrl: 'https://api.themoviedb.org/3',
  imageBaseUrl: 'https://image.tmdb.org/t/p/w500',
};

/**
 * 豆瓣 API 配置（备用）
 */
export const DOUBAN_CONFIG = {
  baseUrl: 'https://api.douban.com/v2',
};

/**
 * 七牛云存储区域配置
 */
export const QINIU_ZONES: Record<string, { up: string; rs: string; rsf: string }> = {
  z0: { // 华东
    up: 'https://up.qiniup.com',
    rs: 'https://rs.qbox.me',
    rsf: 'https://rsf.qbox.me',
  },
  z1: { // 华北
    up: 'https://up-z1.qiniup.com',
    rs: 'https://rs-z1.qbox.me',
    rsf: 'https://rsf-z1.qbox.me',
  },
  z2: { // 华南
    up: 'https://up-z2.qiniup.com',
    rs: 'https://rs-z2.qbox.me',
    rsf: 'https://rsf-z2.qbox.me',
  },
  na0: { // 北美
    up: 'https://up-na0.qiniup.com',
    rs: 'https://rs-na0.qbox.me',
    rsf: 'https://rsf-na0.qbox.me',
  },
  as0: { // 东南亚
    up: 'https://up-as0.qiniup.com',
    rs: 'https://rs-as0.qbox.me',
    rsf: 'https://rsf-as0.qbox.me',
  },
};

/**
 * 缓存配置
 * 🚀 优化：分层缓存策略，减少 D1/KV 消耗
 * 
 * Cloudflare Workers 免费套餐限制：
 * - KV 读取：100,000 次/天
 * - KV 写入：1,000 次/天
 * - D1 读取：5,000,000 行/天
 * - D1 写入：100,000 行/天
 * 
 * 付费套餐（$5/月）：
 * - KV 读取：10,000,000 次/月
 * - KV 写入：1,000,000 次/月
 */
export const CACHE_CONFIG = {
  // 布局相关（变化不频繁，延长缓存时间）
  layoutTTL: 600,                      // 布局缓存 10 分钟
  tabsTTL: TIME_CONSTANTS.HOUR,       // 频道列表 1 小时
  marqueeTTL: 1800,                    // 跑马灯 30 分钟
  
  // 视频数据
  vodListTTL: 300,                     // 视频列表 5 分钟
  vodDetailTTL: 7200,                  // 视频详情 2 小时
  metadataTTL: TIME_CONSTANTS.DAY,    // 元数据缓存 24 小时
  
  // 短剧专用
  shortsTTL: TIME_CONSTANTS.HOUR,     // 短剧缓存 1 小时
  shortsDetailTTL: 1800,               // 短剧详情缓存 30 分钟
  shortsRandomTTL: 300,                // 随机短剧缓存 5 分钟
  
  // 搜索相关
  hotSearchTTL: 1800,                  // 热搜 30 分钟
  searchResultTTL: 600,                // 搜索结果 10 分钟
  
  // 系统配置
  configTTL: TIME_CONSTANTS.HOUR,     // 系统配置 1 小时
  
  // 安全/统计相关
  securityConfigTTL: TIME_CONSTANTS.HOUR,        // 安全配置 1 小时
  securityEventTTL: 3 * TIME_CONSTANTS.DAY,      // 安全事件 3 天
  statsRetentionTTL: TIME_CONSTANTS.DAY,         // 统计数据保留 1 天
  hitsTrackerTTL: TIME_CONSTANTS.DAY,            // 点击统计 24 小时
  rankingTTL: 1800,                              // 排行榜 30 分钟
  
  // 性能监控
  performanceDataTTL: 12 * TIME_CONSTANTS.HOUR,  // 性能数据 12 小时
  
  // 其他
  domainsTTL: 600,                     // 域名列表 10 分钟
  announcementTTL: 300,                // 公告 5 分钟
};

/**
 * 请求超时配置（毫秒）
 */
export const TIMEOUT_CONFIG = {
  // 资源站请求
  defaultRequest: 5000,       // 默认请求超时 5 秒
  fastRequest: 3000,          // 快速请求超时 3 秒
  slowRequest: 10000,         // 慢速请求超时 10 秒
  
  // 采集相关
  collectorRequest: 8000,     // 采集请求超时 8 秒
  detailRequest: 5000,        // 详情请求超时 5 秒
  
  // 聚合器
  aggregatorDefault: 3000,    // 聚合器默认超时 3 秒
  aggregatorSearch: 5000,     // 聚合器搜索超时 5 秒
};

/**
 * 健康检查阈值配置
 */
export const HEALTH_THRESHOLDS = {
  slowResponseTime: 3000,         // 超过 3 秒认为慢
  errorResponseTime: 10000,       // 超过 10 秒认为超时
  unhealthySuccessRate: 80,       // 成功率低于 80% 认为不健康
  maxConsecutiveFailures: 3,      // 连续失败 3 次标记为错误
};

/**
 * 采集器配置
 */
export const COLLECTOR_CONFIG = {
  pageSize: 20,                   // 每页数量（资源站默认）
  batchSize: 5,                   // 批量大小
  requestDelay: 100,              // 请求间隔（毫秒）
  batchDelay: 300,                // 批次间隔（毫秒）
  maxRetries: 2,                  // 最大重试次数
  requestTimeout: 8000,           // 请求超时（毫秒）
  progressUpdateInterval: 20,     // 进度更新频率
};
