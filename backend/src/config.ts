/**
 * 应用配置
 * 定义缓存、超时、健康检查等配置常量
 */

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
 * 缓存配置
 * 🚀 优化：分层缓存策略，减少 D1/KV 消耗
 */
export const CACHE_CONFIG = {
  // 布局相关（变化不频繁）
  layoutTTL: 300,       // 布局缓存 5 分钟
  tabsTTL: 1800,        // 频道列表 30 分钟
  marqueeTTL: 600,      // 跑马灯 10 分钟
  
  // 视频数据
  vodListTTL: 180,      // 视频列表 3 分钟
  vodDetailTTL: 3600,   // 视频详情 1 小时
  metadataTTL: 86400,   // 元数据缓存 24 小时
  
  // 短剧专用
  shortsTTL: 1800,      // 短剧缓存 30 分钟
  shortsDetailTTL: 600, // 短剧详情缓存 10 分钟
  shortsRandomTTL: 180, // 随机短剧缓存 3 分钟
  
  // 搜索相关
  hotSearchTTL: 600,    // 热搜 10 分钟
  searchResultTTL: 300, // 搜索结果 5 分钟
  
  // 系统配置
  configTTL: 1800,      // 系统配置 30 分钟
  
  // 安全/统计相关
  securityConfigTTL: 3600,    // 安全配置 1 小时
  securityEventTTL: 604800,   // 安全事件 7 天
  statsRetentionTTL: 172800,  // 统计数据保留 2 天
  hitsTrackerTTL: 86400,      // 点击统计 24 小时
  rankingTTL: 600,            // 排行榜 10 分钟
  
  // 性能监控
  performanceDataTTL: 86400,  // 性能数据 24 小时
  
  // 其他
  domainsTTL: 300,            // 域名列表 5 分钟
  announcementTTL: 120,       // 公告 2 分钟
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
