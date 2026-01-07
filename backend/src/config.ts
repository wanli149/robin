/**
 * 应用配置
 * 定义资源站 API、第三方服务等配置
 */

/**
 * 资源站配置
 */
export interface ResourceSite {
  name: string;
  url: string;
  weight: number; // 权重，用于排序
  enabled: boolean;
  timeout?: number; // 超时时间（毫秒）
}

/**
 * 主资源站列表
 * 🚀 优化：减少超时时间，提升短剧切换速度
 */
export const RESOURCE_SITES: ResourceSite[] = [
  {
    name: '非凡资源',
    url: 'https://cj.ffzyapi.com/api.php/provide/vod',
    weight: 100,
    enabled: true,
    timeout: 5000, // 🚀 从10秒减少到5秒
  },
  {
    name: '量子资源',
    url: 'https://cj.lziapi.com/api.php/provide/vod',
    weight: 90,
    enabled: true,
    timeout: 5000, // 🚀 从10秒减少到5秒
  },
  {
    name: '新浪资源',
    url: 'https://api.xinlangapi.com/xinlangapi.php/provide/vod',
    weight: 80,
    enabled: true,
    timeout: 5000, // 🚀 从10秒减少到5秒
  },
  // 🚀 临时禁用红牛资源（一直超时）
  {
    name: '红牛资源',
    url: 'https://hongniu.ffzyapi.com/api.php/provide/vod',
    weight: 70,
    enabled: false, // 🚀 临时禁用
    timeout: 3000,
  },
];

/**
 * 福利资源站列表（需要特殊权限访问）
 */
export const WELFARE_SITES: ResourceSite[] = [
  {
    name: '乐播资源',
    url: 'https://lbapi9.com/api.php/provide/vod',
    weight: 100,
    enabled: true,
    timeout: 10000,
  },
];



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
};
