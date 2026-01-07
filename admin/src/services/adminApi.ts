/**
 * Admin API Service
 * 管理后台API接口
 */

import apiClient, { type ApiResponse } from './api';

/**
 * Dashboard数据类型
 */
export interface DashboardStats {
  stats: Array<{
    date: string;
    api_calls: number;
    unique_users: number;
  }>;
  total_users: number;
  today_active: number;
  today_api_calls: number;
  server_status: string;
}

/**
 * 获取仪表板数据
 */
export const getDashboard = async (): Promise<DashboardStats> => {
  const response = await apiClient.get<ApiResponse<DashboardStats>>('/admin/dashboard');
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取仪表板数据失败');
};

/**
 * 测试API连接
 */
export const testConnection = async (): Promise<boolean> => {
  try {
    await getDashboard();
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * 清除缓存
 */
export const purgeCache = async (type: 'layout' | 'shorts' | 'all'): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/cache/purge', { type });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '清除缓存失败');
  }
};

/**
 * 发布新版本
 */
export interface ReleaseVersion {
  version: string;
  url: string;
  force: boolean;
  changelog: string;
}

export const releaseVersion = async (data: ReleaseVersion): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/release', data);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '发布版本失败');
  }
};

/**
 * 布局数据类型
 */
export interface LayoutModule {
  id?: number;
  tab_id: string;
  module_type: string;
  title: string | null;
  api_params: any;
  ad_config: any;
  sort_order: number;
  is_enabled?: boolean; // 模块开关
}

export interface LayoutData {
  tab_id: string;
  modules: LayoutModule[];
}

/**
 * 获取布局配置
 */
export const getLayout = async (tabId: string): Promise<LayoutData> => {
  const response = await apiClient.get<ApiResponse<LayoutData>>(
    `/admin/layout?tab=${tabId}`
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取布局失败');
};

/**
 * 更新布局配置
 */
export const updateLayout = async (
  tabId: string,
  modules: LayoutModule[]
): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/layout', {
    tab_id: tabId,
    modules,
  });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '更新布局失败');
  }
};

/**
 * 布局验证结果类型
 */
export interface ValidationResult {
  module_index: number;
  module_type: string;
  module_title: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  data_count?: number;
  details?: any;
}

/**
 * 验证布局配置
 */
export const validateLayout = async (
  tabId: string,
  modules: LayoutModule[]
): Promise<ValidationResult[]> => {
  const response = await apiClient.post<ApiResponse & { results?: ValidationResult[] }>(
    '/admin/layout/validate',
    {
      tab_id: tabId,
      modules,
    }
  );
  if (response.data.code === 1 && response.data.results) {
    return response.data.results;
  }
  throw new Error(response.data.msg || '验证布局失败');
};

/**
 * 广告数据类型
 */
export interface Ad {
  id: number;
  name: string;
  location: string;
  content_type: string;
  media_url: string;
  action_type: string;
  action_url: string;
  weight: number;
  is_active: boolean;
  start_time: number | null;
  end_time: number | null;
  daily_limit: number;
  remark: string;
  created_at?: number;
}

/**
 * 获取广告列表
 */
export const getAds = async (): Promise<Ad[]> => {
  const response = await apiClient.get<ApiResponse>('/admin/ads');
  if (response.data.code === 1 && response.data.list) {
    return response.data.list as Ad[];
  }
  throw new Error(response.data.msg || '获取广告列表失败');
};

/**
 * 创建或更新广告
 */
export const saveAd = async (ad: Partial<Ad>): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/ads', ad);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '保存广告失败');
  }
};

/**
 * 删除广告
 */
export const deleteAd = async (id: number): Promise<void> => {
  const response = await apiClient.delete<ApiResponse>(`/admin/ads/${id}`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '删除广告失败');
  }
};

/**
 * 切换全局广告开关
 */
export const toggleAdsGlobalSwitch = async (enabled: boolean): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/config/ads_global_switch', {
    enabled,
  });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '切换广告开关失败');
  }
};

/**
 * 专题数据类型
 */
export interface Topic {
  id: string;
  title: string;
  cover_img: string | null;
  description: string | null;
  is_active?: number | boolean;
  sort_order?: number;
  data_source_type?: 'manual' | 'actor' | 'keyword' | 'company' | 'filter';
  data_source_config?: {
    actor_name?: string;
    keyword?: string;
    company?: string;
    type_id?: number;
    year?: number;
    year_from?: number;
    year_to?: number;
    area?: string;
    min_score?: number;
  } | null;
}

/**
 * 获取专题列表
 */
export const getTopics = async (): Promise<Topic[]> => {
  const response = await apiClient.get<ApiResponse>('/admin/topics');
  if (response.data.code === 1 && response.data.list) {
    return response.data.list as Topic[];
  }
  throw new Error(response.data.msg || '获取专题列表失败');
};

/**
 * 保存专题
 */
export const saveTopic = async (topic: Partial<Topic>): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/topic', topic);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '保存专题失败');
  }
};

/**
 * 删除专题
 */
export const deleteTopic = async (id: string): Promise<void> => {
  const response = await apiClient.delete<ApiResponse>(`/admin/topic/${id}`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '删除专题失败');
  }
};

/**
 * 专题内容项数据类型
 */
export interface TopicItem {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_year?: string;
  vod_area?: string;
  sort_order: number;
}

/**
 * 视频搜索结果类型
 */
export interface Video {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_year?: string;
  vod_area?: string;
}

/**
 * 获取专题内容列表
 */
export const getTopicItems = async (topicId: string): Promise<TopicItem[]> => {
  const response = await apiClient.get<ApiResponse>(`/admin/topic/${topicId}/items`);
  if (response.data.code === 1 && response.data.list) {
    return response.data.list as TopicItem[];
  }
  throw new Error(response.data.msg || '获取专题内容失败');
};

/**
 * 搜索视频
 */
export const searchVideos = async (keyword: string): Promise<Video[]> => {
  const response = await apiClient.get<ApiResponse>(`/api/search?wd=${encodeURIComponent(keyword)}`);
  if (response.data.code === 1 && response.data.list) {
    return response.data.list as Video[];
  }
  throw new Error(response.data.msg || '搜索视频失败');
};

/**
 * 添加视频到专题
 */
export const addTopicItems = async (topicId: string, vodIds: string[]): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/topic/items', {
    topic_id: topicId,
    vod_ids: vodIds,
  });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '添加视频失败');
  }
};

/**
 * 删除专题内容项
 */
export const deleteTopicItem = async (topicId: string, vodId: string): Promise<void> => {
  const response = await apiClient.delete<ApiResponse>(`/admin/topic/${topicId}/items/${vodId}`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '删除内容失败');
  }
};

/**
 * 更新专题内容排序
 */
export const updateTopicItemsOrder = async (topicId: string, vodIds: string[]): Promise<void> => {
  const response = await apiClient.put<ApiResponse>(`/admin/topic/${topicId}/items/order`, {
    vod_ids: vodIds,
  });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '更新排序失败');
  }
};

/**
 * 短剧数据类型
 */
export interface Short {
  vod_id: string;
  vod_name: string;
  vod_pic_vertical: string;
  category: string;
  vod_year: string;
  vod_area: string;
  vod_actor: string;
  vod_director: string;
  vod_score: number;
  vod_remarks: string;
  vod_hits: number;
  fetched_at: number;
}

/**
 * 获取短剧列表
 */
export const getShorts = async (): Promise<Short[]> => {
  const response = await apiClient.get<ApiResponse>('/admin/shorts');
  if (response.data.code === 1 && response.data.list) {
    return response.data.list as Short[];
  }
  throw new Error(response.data.msg || '获取短剧列表失败');
};

/**
 * 下架短剧
 */
export const deleteShort = async (vodId: string): Promise<void> => {
  const response = await apiClient.delete<ApiResponse>(`/admin/shorts/${vodId}`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '下架短剧失败');
  }
};

/**
 * 手动触发短剧抓取
 */
export const triggerShortsFetch = async (): Promise<{ fetched: number }> => {
  const response = await apiClient.post<ApiResponse>('/admin/shorts/trigger-fetch');
  if (response.data.code === 1 && response.data.data) {
    return response.data.data as { fetched: number };
  }
  throw new Error(response.data.msg || '触发短剧抓取失败');
};

/**
 * 迁移短剧表结构
 */
export const migrateShorts = async (): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/shorts/migrate');
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '迁移短剧表结构失败');
  }
};

/**
 * 重新分类所有短剧
 */
export const reclassifyShorts = async (): Promise<{ updated: number }> => {
  const response = await apiClient.post<ApiResponse>('/admin/shorts/reclassify');
  if (response.data.code === 1 && response.data.data) {
    return response.data.data as { updated: number };
  }
  throw new Error(response.data.msg || '重新分类短剧失败');
};

/**
 * 清空所有短剧数据
 */
export const clearShorts = async (): Promise<{ deleted: number }> => {
  const response = await apiClient.post<ApiResponse>('/admin/clear-shorts');
  if (response.data.code === 1 && response.data.data) {
    return response.data.data as { deleted: number };
  }
  throw new Error(response.data.msg || '清空短剧数据失败');
};

/**
 * 清空视频数据
 * @param typeId - 可选，指定分类ID则只清空该分类，不传则清空所有
 */
export const clearVideos = async (typeId?: number): Promise<{ deleted: number }> => {
  const url = typeId ? `/admin/videos/clear?type_id=${typeId}` : '/admin/videos/clear';
  const response = await apiClient.delete<ApiResponse & { deleted?: number }>(url);
  if (response.data.code === 1) {
    return { deleted: response.data.deleted || 0 };
  }
  throw new Error(response.data.msg || '清空视频数据失败');
};

/**
 * 反馈数据类型
 */
export interface Feedback {
  id: number;
  user_id: number;
  content: string;
  contact: string | null;
  status: string;
  created_at: number;
}

/**
 * 获取反馈列表
 */
export const getFeedback = async (): Promise<Feedback[]> => {
  const response = await apiClient.get<ApiResponse>('/admin/feedback');
  if (response.data.code === 1 && response.data.list) {
    return response.data.list as Feedback[];
  }
  throw new Error(response.data.msg || '获取反馈列表失败');
};

/**
 * 标记反馈为已处理
 */
export const processFeedback = async (id: number): Promise<void> => {
  const response = await apiClient.patch<ApiResponse>(`/admin/feedback/${id}`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '处理反馈失败');
  }
};

/**
 * 应用墙数据类型
 */
export interface AppWallItem {
  id?: number;
  app_name: string;
  icon_url: string;
  download_url: string;
  commission: number;
  sort_order: number;
  is_active: boolean;
}

/**
 * 获取应用墙列表
 */
export const getAppWall = async (): Promise<AppWallItem[]> => {
  const response = await apiClient.get<ApiResponse>('/admin/app_wall');
  if (response.data.code === 1 && response.data.list) {
    return response.data.list as AppWallItem[];
  }
  throw new Error(response.data.msg || '获取应用列表失败');
};

/**
 * 保存应用墙项
 */
export const saveAppWall = async (app: AppWallItem): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/app_wall', app);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '保存应用失败');
  }
};

/**
 * 删除应用墙项
 */
export const deleteAppWall = async (id: number): Promise<void> => {
  const response = await apiClient.delete<ApiResponse>(`/admin/app_wall/${id}`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '删除应用失败');
  }
};

/**
 * 获取热搜关键词
 */
export const getHotSearch = async (): Promise<string[]> => {
  const response = await apiClient.get<ApiResponse & { keywords?: string[] }>('/admin/hot_search');
  if (response.data.code === 1 && response.data.keywords) {
    return response.data.keywords;
  }
  throw new Error(response.data.msg || '获取热搜关键词失败');
};

/**
 * 更新热搜关键词
 */
export const updateHotSearch = async (keywords: string[]): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/hot_search', { keywords });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '更新热搜关键词失败');
  }
};

/**
 * 更新联系方式配置
 */
export const updateContactConfig = async (
  customerService: string,
  officialGroup: string
): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/config/contact', {
    customer_service: customerService,
    official_group: officialGroup,
  });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '更新联系方式失败');
  }
};

/**
 * 获取系统配置
 */
export const getSystemConfig = async (): Promise<{
  marquee_enabled?: boolean;
  marquee_text?: string;
  marquee_link?: string;
  hot_search_enabled?: boolean;
  welfare_enabled?: boolean;
  ads_enabled?: boolean;
  customer_service?: string;
  official_group?: string;
}> => {
  const response = await apiClient.get<ApiResponse & { data?: any }>('/api/config');
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  return {};
};

/**
 * 更新滚动通告配置
 */
export const updateMarqueeConfig = async (
  text: string,
  link: string
): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/config/marquee', {
    text,
    link,
  });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '更新滚动通告失败');
  }
};

/**
 * 更新福利频道开关
 */
export const updateWelfareSwitch = async (enabled: boolean): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/config/welfare', {
    enabled,
  });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '更新福利频道开关失败');
  }
};

/**
 * 更新跑马灯开关
 */
export const updateMarqueeSwitch = async (enabled: boolean): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/config/marquee_switch', {
    enabled,
  });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '更新跑马灯开关失败');
  }
};

/**
 * 更新热搜关键词开关
 */
export const updateHotSearchSwitch = async (enabled: boolean): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/config/hot_search_switch', {
    enabled,
  });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '更新热搜开关失败');
  }
};

/**
 * 更新全局广告开关
 */
export const updateAdsSwitch = async (enabled: boolean): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/config/ads_global_switch', {
    enabled,
  });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '更新广告开关失败');
  }
};

/**
 * 获取永久网址列表
 */
export const getPermanentUrls = async (): Promise<string[]> => {
  const response = await apiClient.get<ApiResponse & { urls?: string[] }>('/admin/config/permanent_urls');
  if (response.data.code === 1 && response.data.urls) {
    return response.data.urls;
  }
  return [];
};

/**
 * 更新永久网址列表
 */
export const updatePermanentUrls = async (urls: string[]): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/config/permanent_urls', { urls });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '更新永久网址失败');
  }
};

/**
 * 获取分享配置
 */
export const getShareConfig = async (): Promise<{
  download_url: string;
  share_title: string;
  share_description: string;
}> => {
  const response = await apiClient.get<ApiResponse & { data?: any }>('/api/share/config');
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  return {
    download_url: '',
    share_title: '',
    share_description: '',
  };
};

/**
 * 更新分享配置
 */
export const updateShareConfig = async (config: {
  download_url: string;
  share_title: string;
  share_description: string;
}): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/config/share', config);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '更新分享配置失败');
  }
};

/**
 * 置顶短剧
 */
export const pinShort = async (vodId: string): Promise<void> => {
  const response = await apiClient.patch<ApiResponse>(`/admin/shorts/${vodId}/pin`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '置顶短剧失败');
  }
};

/**
 * 视频资源站类型
 */
export interface VideoSource {
  id?: number;
  name: string;
  api_url: string;
  weight: number;
  is_active: boolean;
  response_format?: 'json' | 'xml' | 'auto';
}

/**
 * 获取视频资源站列表
 */
export const getSources = async (): Promise<VideoSource[]> => {
  const response = await apiClient.get<ApiResponse & { list?: VideoSource[] }>('/admin/sources');
  if (response.data.code === 1 && response.data.list) {
    return response.data.list;
  }
  throw new Error(response.data.msg || '获取资源站列表失败');
};

/**
 * 保存视频资源站（创建或更新）
 */
export const saveSource = async (source: VideoSource): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/sources', source);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '保存资源站失败');
  }
};

/**
 * 删除视频资源站
 */
export const deleteSource = async (id: number): Promise<void> => {
  const response = await apiClient.delete<ApiResponse>(`/admin/sources/${id}`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '删除资源站失败');
  }
};

/**
 * 切换资源站启用状态
 */
export const toggleSource = async (id: number): Promise<void> => {
  const response = await apiClient.patch<ApiResponse>(`/admin/sources/${id}/toggle`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '切换状态失败');
  }
};

/**
 * 测试视频资源站连接
 */
export const testSource = async (id: number): Promise<{
  success: boolean;
  message: string;
  responseTime?: number;
  videoCount?: number;
  status?: string;
  format?: string;
}> => {
  try {
    console.log('[API] Sending test request for source:', id);
    const response = await apiClient.post<ApiResponse & { details?: any }>(`/admin/sources/${id}/test`);
    console.log('[API] Test response:', response.data);
    return {
      success: response.data.code === 1,
      message: response.data.msg || '',
      responseTime: response.data.details?.responseTime,
      videoCount: response.data.details?.videoCount,
      status: response.data.details?.status,
      format: response.data.details?.format,
    };
  } catch (error: any) {
    console.error('[API] Test request error:', error);
    // 处理网络错误或服务器错误
    if (error.response?.data) {
      const data = error.response.data;
      return {
        success: false,
        message: data.msg || '测试失败',
        responseTime: data.details?.responseTime,
        status: data.details?.status || 'error',
      };
    }
    // 网络错误
    return {
      success: false,
      message: error.message || '网络错误',
      status: 'network_error',
    };
  }
};

/**
 * 同步单个资源站的分类映射
 */
export const syncSourceCategories = async (id: number): Promise<{
  msg: string;
  data?: {
    sourceName: string;
    totalCategories: number;
    created: number;
    updated: number;
    skipped: number;
    mappings: Array<{
      sourceTypeId: string;
      sourceTypeName: string;
      targetCategoryId: number;
      targetCategoryName: string;
    }>;
  };
}> => {
  const response = await apiClient.post<ApiResponse & { data?: any }>(`/admin/sources/${id}/sync-categories`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '同步分类映射失败');
  }
  return { msg: response.data.msg || '同步成功', data: response.data.data };
};

/**
 * 同步所有资源站的分类映射
 */
export const syncAllSourceCategories = async (): Promise<{
  msg: string;
  data?: {
    results: Array<{
      sourceName: string;
      success: boolean;
      created: number;
      updated: number;
      error?: string;
    }>;
  };
}> => {
  const response = await apiClient.post<ApiResponse & { data?: any }>('/admin/sources/sync-all-categories');
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '同步分类映射失败');
  }
  return { msg: response.data.msg || '同步成功', data: response.data.data };
};

/**
 * 模块统计数据类型
 */
export interface ModuleStats {
  tab_id: string;
  module_id: number;
  module_type: string;
  module_title: string;
  total_views: number;
  total_clicks: number;
  click_rate: number;
}

/**
 * 获取模块使用统计
 */
export const getModuleStats = async (
  tabId?: string,
  days: number = 7
): Promise<{
  stats: ModuleStats[];
  date_range: { start: string; end: string; days: number };
}> => {
  const params = new URLSearchParams();
  if (tabId) params.append('tab_id', tabId);
  params.append('days', days.toString());

  const response = await apiClient.get<ApiResponse & { data?: any }>(
    `/admin/module-stats?${params.toString()}`
  );
  
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取统计数据失败');
};

// 更新钉钉Webhook配置
export const updateDingTalkWebhook = async (webhook: string): Promise<void> => {
  const response = await fetch('/admin/config/dingtalk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': localStorage.getItem('admin_key') || '',
    },
    body: JSON.stringify({ webhook }),
  });

  if (!response.ok) {
    throw new Error('更新钉钉配置失败');
  }

  const data = await response.json();
  if (data.code !== 1) {
    throw new Error(data.msg || '更新钉钉配置失败');
  }
};

// 测试钉钉通知
export const testDingTalk = async (): Promise<void> => {
  const response = await fetch('/admin/config/dingtalk/test', {
    method: 'POST',
    headers: {
      'x-admin-key': localStorage.getItem('admin_key') || '',
    },
  });

  if (!response.ok) {
    throw new Error('测试失败');
  }

  const data = await response.json();
  if (data.code !== 1) {
    throw new Error(data.msg || '测试失败');
  }
};

// 自动发现常用资源站
export const autoDiscoverSources = async (): Promise<{ added: number }> => {
  const response = await fetch('/admin/sources/auto-discover', {
    method: 'POST',
    headers: {
      'x-admin-key': localStorage.getItem('admin_key') || '',
    },
  });

  if (!response.ok) {
    throw new Error('自动发现失败');
  }

  const data = await response.json();
  if (data.code !== 1) {
    throw new Error(data.msg || '自动发现失败');
  }

  return data.data;
};

// 获取崩溃日志列表
export const getCrashReports = async (limit = 50, offset = 0): Promise<{
  list: any[];
  total: number;
}> => {
  const response = await apiClient.get<ApiResponse & { data?: any }>(
    `/admin/crash-reports?limit=${limit}&offset=${offset}`
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取崩溃日志失败');
};

// 获取播放失效上报列表
export const getInvalidUrls = async (
  limit = 50,
  offset = 0,
  isFixed?: boolean
): Promise<{
  list: any[];
  total: number;
}> => {
  let url = `/admin/invalid-urls?limit=${limit}&offset=${offset}`;
  if (isFixed !== undefined) {
    url += `&is_fixed=${isFixed}`;
  }
  
  const response = await apiClient.get<ApiResponse & { data?: any }>(url);
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取失效上报失败');
};

// 标记播放失效为已修复
export const markInvalidUrlFixed = async (id: number): Promise<void> => {
  const response = await apiClient.patch<ApiResponse>(
    `/admin/invalid-urls/${id}/fix`
  );
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '标记失败');
  }
};


// ============================================
// 采集引擎 V2 API
// ============================================

/**
 * 采集任务类型
 */
export interface CollectTaskV2 {
  id: string;
  taskType: 'full' | 'incremental' | 'category' | 'source' | 'shorts';
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  config: {
    sourceIds?: number[];
    categoryIds?: number[];
    pageStart?: number;
    pageEnd?: number;
    maxVideos?: number;
  };
  progress: {
    currentSource?: string;
    currentSourceId?: number;
    currentPage: number;
    totalPages: number;
    processedCount: number;
    newCount: number;
    updateCount: number;
    skipCount: number;
    errorCount: number;
    percentage: number;
  };
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  lastError?: string;
}

/**
 * 资源站健康状态
 */
export interface SourceHealthStatus {
  sourceId: number;
  sourceName: string;
  status: 'healthy' | 'slow' | 'error' | 'timeout' | 'unknown';
  responseTime: number;
  avgResponseTime: number;
  successRate: number;
  totalChecks: number;
  consecutiveFailures: number;
  videoCount: number;
  lastCheckAt: number;
  lastError?: string;
}

/**
 * 创建采集任务
 */
export const createCollectTask = async (
  type: CollectTaskV2['taskType'],
  config?: CollectTaskV2['config']
): Promise<{ taskId: string }> => {
  const response = await apiClient.post<ApiResponse & { data?: { taskId: string } }>(
    '/admin/collect/v2/task',
    { type, config }
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '创建任务失败');
};

/**
 * 获取任务详情
 */
export const getCollectTask = async (taskId: string): Promise<CollectTaskV2> => {
  const response = await apiClient.get<ApiResponse & { data?: CollectTaskV2 }>(
    `/admin/collect/v2/task/${taskId}`
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取任务失败');
};

/**
 * 获取任务进度
 */
export const getCollectTaskProgress = async (taskId: string): Promise<{
  status: string;
  progress: CollectTaskV2['progress'];
  startedAt?: number;
  lastError?: string;
}> => {
  const response = await apiClient.get<ApiResponse & { data?: any }>(
    `/admin/collect/v2/task/${taskId}/progress`
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取进度失败');
};

/**
 * 获取任务列表
 */
export const getCollectTasks = async (options?: {
  status?: string;
  type?: string;
  page?: number;
  limit?: number;
}): Promise<{ tasks: CollectTaskV2[]; total: number }> => {
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);
  if (options?.type) params.append('type', options.type);
  if (options?.page) params.append('page', String(options.page));
  if (options?.limit) params.append('limit', String(options.limit));
  
  const response = await apiClient.get<ApiResponse & { list?: CollectTaskV2[]; total?: number }>(
    `/admin/collect/v2/tasks?${params.toString()}`
  );
  if (response.data.code === 1) {
    return {
      tasks: response.data.list || [],
      total: response.data.total || 0,
    };
  }
  throw new Error(response.data.msg || '获取任务列表失败');
};

/**
 * 取消任务
 */
export const cancelCollectTask = async (taskId: string): Promise<void> => {
  const response = await apiClient.post<ApiResponse>(
    `/admin/collect/v2/task/${taskId}/cancel`
  );
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '取消任务失败');
  }
};

/**
 * 暂停任务
 */
export const pauseCollectTask = async (taskId: string): Promise<void> => {
  const response = await apiClient.post<ApiResponse>(
    `/admin/collect/v2/task/${taskId}/pause`
  );
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '暂停任务失败');
  }
};

/**
 * 恢复任务
 */
export const resumeCollectTask = async (taskId: string): Promise<void> => {
  const response = await apiClient.post<ApiResponse>(
    `/admin/collect/v2/task/${taskId}/resume`
  );
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '恢复任务失败');
  }
};

/**
 * 获取任务日志
 */
export const getCollectTaskLogs = async (
  taskId: string,
  options?: { level?: string; limit?: number; offset?: number }
): Promise<{ logs: any[]; total: number }> => {
  const params = new URLSearchParams();
  if (options?.level) params.append('level', options.level);
  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.offset) params.append('offset', String(options.offset));
  
  const response = await apiClient.get<ApiResponse & { list?: any[]; total?: number }>(
    `/admin/collect/v2/task/${taskId}/logs?${params.toString()}`
  );
  if (response.data.code === 1) {
    return {
      logs: response.data.list || [],
      total: response.data.total || 0,
    };
  }
  throw new Error(response.data.msg || '获取日志失败');
};

/**
 * 快速增量采集
 */
export const quickIncrementalCollect = async (options?: {
  maxPages?: number;
  maxVideos?: number;
}): Promise<{ taskId: string }> => {
  const response = await apiClient.post<ApiResponse & { data?: { taskId: string } }>(
    '/admin/collect/v2/quick/incremental',
    options || {}
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '启动采集失败');
};

/**
 * 快速全量采集
 * @param options.maxPages 最大采集页数（-1 表示全部）
 * @param options.categoryIds 指定分类ID数组（可选）
 * @param options.sourceIds 指定资源站ID数组（可选）
 */
export const quickFullCollect = async (options?: {
  maxPages?: number;
  categoryIds?: number[];
  sourceIds?: number[];
}): Promise<{ taskId: string }> => {
  const response = await apiClient.post<ApiResponse & { data?: { taskId: string } }>(
    '/admin/collect/v2/quick/full',
    options || {}
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '启动采集失败');
};

/**
 * 快速分类采集
 */
export const quickCategoryCollect = async (
  categoryId: number,
  options?: { maxPages?: number }
): Promise<{ taskId: string }> => {
  const response = await apiClient.post<ApiResponse & { data?: { taskId: string } }>(
    `/admin/collect/v2/quick/category/${categoryId}`,
    options || {}
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '启动采集失败');
};

/**
 * 快速指定资源站采集
 */
export const quickSourceCollect = async (
  sourceId: number,
  options?: { maxPages?: number }
): Promise<{ taskId: string }> => {
  const response = await apiClient.post<ApiResponse & { data?: { taskId: string } }>(
    `/admin/collect/v2/quick/source/${sourceId}`,
    options || {}
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '启动采集失败');
};

/**
 * 获取资源站健康状态
 */
export const getSourcesHealth = async (): Promise<SourceHealthStatus[]> => {
  const response = await apiClient.get<ApiResponse & { list?: SourceHealthStatus[] }>(
    '/admin/collect/v2/sources/health'
  );
  if (response.data.code === 1) {
    return response.data.list || [];
  }
  throw new Error(response.data.msg || '获取健康状态失败');
};

/**
 * 检测单个资源站健康状态
 */
export const checkSourceHealthStatus = async (sourceId: number): Promise<{
  success: boolean;
  status: string;
  responseTime: number;
  videoCount?: number;
  error?: string;
}> => {
  const response = await apiClient.post<ApiResponse & { data?: any }>(
    `/admin/collect/v2/sources/${sourceId}/health-check`
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '健康检测失败');
};

/**
 * 检测所有资源站健康状态
 */
export const checkAllSourcesHealthStatus = async (): Promise<void> => {
  const response = await apiClient.post<ApiResponse>(
    '/admin/collect/v2/sources/health-check-all'
  );
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '启动健康检测失败');
  }
};

/**
 * 获取采集统计 V2
 */
export const getCollectStatsV2 = async (): Promise<{
  videos: {
    total: number;
    valid: number;
    todayNew: number;
    weekNew: number;
  };
  tasks: {
    running: any | null;
    recent: any[];
  };
  sources: {
    total: number;
    healthy: number;
    slow: number;
    error: number;
  };
}> => {
  const response = await apiClient.get<ApiResponse & { data?: any }>(
    '/admin/collect/v2/stats'
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取统计失败');
};

/**
 * 获取可采集的分类列表
 */
export const getCollectCategories = async (): Promise<Array<{
  id: number;
  name: string;
  name_en: string;
}>> => {
  const response = await apiClient.get<ApiResponse & { list?: any[] }>(
    '/admin/collect/v2/categories'
  );
  if (response.data.code === 1) {
    return response.data.list || [];
  }
  throw new Error(response.data.msg || '获取分类失败');
};

/**
 * 清理旧数据
 */
export const cleanupCollectData = async (): Promise<{
  tasksDeleted: number;
  logsDeleted: number;
}> => {
  const response = await apiClient.post<ApiResponse & { data?: any }>(
    '/admin/collect/v2/cleanup'
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '清理失败');
};


/**
 * 执行采集引擎V2数据库迁移
 */
export const migrateCollectV2 = async (): Promise<{
  success: boolean;
  tables: string[];
  errors: string[];
}> => {
  const response = await apiClient.post<ApiResponse & { data?: any }>(
    '/admin/collect/v2/migrate'
  );
  if (response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '迁移失败');
};


// ============================================
// 子分类管理 API
// ============================================

/**
 * 子分类类型
 */
export interface SubCategory {
  id: number;
  parent_id: number;
  name: string;
  name_en: string;
  icon?: string;
  keywords: string;
  sort_order: number;
  is_active: boolean;
  video_count?: number;
}

/**
 * 获取子分类列表
 */
export const getSubCategories = async (parentId?: number): Promise<SubCategory[]> => {
  const params = parentId ? `?parent_id=${parentId}` : '';
  const response = await apiClient.get<ApiResponse & { list?: SubCategory[] }>(
    `/admin/sub-categories${params}`
  );
  if (response.data.code === 1) {
    return response.data.list || [];
  }
  throw new Error(response.data.msg || '获取子分类失败');
};

/**
 * 保存子分类（创建或更新）
 */
export const saveSubCategory = async (subCategory: Partial<SubCategory>): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/sub-categories', subCategory);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '保存子分类失败');
  }
};

/**
 * 删除子分类
 */
export const deleteSubCategory = async (id: number): Promise<void> => {
  const response = await apiClient.delete<ApiResponse>(`/admin/sub-categories/${id}`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '删除子分类失败');
  }
};

/**
 * 执行子分类数据库迁移
 */
export const migrateSubCategories = async (): Promise<{
  success: boolean;
  message: string;
  subCategoriesCreated: number;
}> => {
  const response = await apiClient.post<ApiResponse & { data?: any }>(
    '/admin/sub-categories/migrate'
  );
  return {
    success: response.data.code === 1,
    message: response.data.msg || '',
    subCategoriesCreated: response.data.data?.subCategoriesCreated || 0,
  };
};


// ============================================
// 文章和演员采集 API
// ============================================

/**
 * 文章类型
 */
export interface Article {
  id: number;
  art_id: string;
  title: string;
  type_id: number;
  type_name: string;
  cover: string;
  author: string;
  summary: string;
  content?: string;
  hits: number;
  published_at: number;
  created_at: number;
}

/**
 * 文章分类类型
 */
export interface ArticleCategory {
  id: number;
  name: string;
  name_en: string;
  sort_order: number;
  article_count?: number; // 该分类下的文章数量
}

/**
 * 演员详情类型
 */
export interface ActorDetail {
  id: number;
  name: string;
  actor_id?: string;
  avatar?: string;
  name_en?: string;
  alias?: string;
  sex?: string;
  area?: string;
  birthday?: string;
  birthplace?: string;
  height?: string;
  weight?: string;
  blood_type?: string;
  constellation?: string;
  representative_works?: string;
  bio?: string;
  works_count: number;
  popularity: number;
  works?: Array<{
    vod_id: string;
    vod_name: string;
    vod_pic: string;
    vod_year: string;
    vod_score: number;
    role_type: string;
  }>;
}

/**
 * 执行文章和演员表迁移
 */
export const migrateArticlesActors = async (): Promise<{
  success: boolean;
  message: string;
  tables: string[];
  columns: string[];
}> => {
  const response = await apiClient.post<ApiResponse & { data?: any }>(
    '/admin/articles-actors/migrate'
  );
  return {
    success: response.data.code === 1,
    message: response.data.msg || '',
    tables: response.data.data?.tables || [],
    columns: response.data.data?.columns || [],
  };
};

/**
 * 采集文章
 */
export const collectArticles = async (options: {
  apiUrl: string;
  sourceName?: string;
  page?: number;
  maxPages?: number;
  typeId?: number;
}): Promise<{
  total: number;
  newCount: number;
  updateCount: number;
  errors: number;
}> => {
  const response = await apiClient.post<ApiResponse & { data?: any }>(
    '/admin/collect/articles',
    options
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '采集失败');
};

/**
 * 获取文章列表
 */
export const getArticles = async (options?: {
  typeId?: number;
  page?: number;
  limit?: number;
  keyword?: string;
}): Promise<{ list: Article[]; total: number }> => {
  const params = new URLSearchParams();
  if (options?.typeId) params.append('type_id', String(options.typeId));
  if (options?.page) params.append('page', String(options.page));
  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.keyword) params.append('keyword', options.keyword);

  const response = await apiClient.get<ApiResponse & { list?: Article[]; total?: number }>(
    `/admin/articles?${params.toString()}`
  );
  if (response.data.code === 1) {
    return {
      list: response.data.list || [],
      total: response.data.total || 0,
    };
  }
  throw new Error(response.data.msg || '获取文章失败');
};

/**
 * 获取文章详情
 */
export const getArticleDetail = async (id: number): Promise<Article> => {
  const response = await apiClient.get<ApiResponse & { data?: Article }>(
    `/admin/articles/${id}`
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取文章详情失败');
};

/**
 * 删除文章
 */
export const deleteArticle = async (id: number): Promise<void> => {
  const response = await apiClient.delete<ApiResponse>(`/admin/articles/${id}`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '删除文章失败');
  }
};

/**
 * 获取文章分类
 */
export const getArticleCategories = async (): Promise<ArticleCategory[]> => {
  const response = await apiClient.get<ApiResponse & { list?: ArticleCategory[] }>(
    '/admin/article-categories'
  );
  if (response.data.code === 1) {
    return response.data.list || [];
  }
  return [];
};

/**
 * 采集演员
 */
export const collectActors = async (options: {
  apiUrl: string;
  sourceName?: string;
  page?: number;
  maxPages?: number;
}): Promise<{
  total: number;
  newCount: number;
  updateCount: number;
  matchedCount: number;
  errors: number;
}> => {
  const response = await apiClient.post<ApiResponse & { data?: any }>(
    '/admin/collect/actors',
    options
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '采集失败');
};

/**
 * 补充演员详情
 */
export const enrichActors = async (options: {
  apiUrl: string;
  sourceName?: string;
  limit?: number;
}): Promise<{ enriched: number; notFound: number }> => {
  const response = await apiClient.post<ApiResponse & { data?: any }>(
    '/admin/collect/actors/enrich',
    options
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '补充失败');
};

/**
 * 获取演员列表（管理后台）
 */
export const getActorsAdmin = async (options?: {
  page?: number;
  limit?: number;
  keyword?: string;
  hasAvatar?: boolean;
}): Promise<{ list: ActorDetail[]; total: number }> => {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', String(options.page));
  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.keyword) params.append('keyword', options.keyword);
  if (options?.hasAvatar !== undefined) params.append('has_avatar', String(options.hasAvatar));

  const response = await apiClient.get<ApiResponse & { list?: ActorDetail[]; total?: number }>(
    `/admin/actors?${params.toString()}`
  );
  if (response.data.code === 1) {
    return {
      list: response.data.list || [],
      total: response.data.total || 0,
    };
  }
  throw new Error(response.data.msg || '获取演员失败');
};

/**
 * 获取演员详情
 */
export const getActorDetailAdmin = async (id: number): Promise<ActorDetail> => {
  const response = await apiClient.get<ApiResponse & { data?: ActorDetail }>(
    `/admin/actors/${id}`
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取演员详情失败');
};

/**
 * 获取采集统计
 */
export const getCollectStats = async (): Promise<{
  videos: { total: number; valid: number };
  articles: { total: number };
  actors: { total: number; withAvatar: number; withWorks: number };
}> => {
  const response = await apiClient.get<ApiResponse & { data?: any }>(
    '/admin/collect/stats'
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取统计失败');
};

// ============================================
// 资源站分类探测 API
// ============================================

/**
 * 探测到的分类信息
 */
export interface DetectedCategory {
  id: string;
  name: string;
  count?: number;
  suggestedMapping?: {
    targetId: number;
    targetName: string;
    subTypeName?: string;
    confidence: number;
  } | null;
}

/**
 * 探测资源站的分类列表
 * 自动获取资源站支持的所有分类，并预测映射关系
 */
export const detectSourceCategories = async (sourceId: number): Promise<{
  sourceName: string;
  totalCategories: number;
  categories: DetectedCategory[];
}> => {
  const response = await apiClient.post<ApiResponse & { data?: any }>(
    `/admin/sources/${sourceId}/detect-categories`
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '探测分类失败');
};

/**
 * 测试分类器效果
 */
export const testClassify = async (input: {
  vod_name: string;
  type_name?: string;
  type_id?: number | string;
  vod_remarks?: string;
  vod_content?: string;
}): Promise<{
  input: any;
  result: {
    typeId: number;
    typeName: string;
    subTypeId?: number;
    subTypeName?: string;
    confidence: number;
    method: string;
  };
}> => {
  const response = await apiClient.post<ApiResponse & { data?: any }>(
    '/admin/sources/test-classify',
    input
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '测试失败');
};

// ============================================
// 布局编辑器分类数据 API
// ============================================

/**
 * 分类树结构
 */
export interface CategoryWithSubs {
  id: number;
  name: string;
  name_en: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  subCategories: Array<{
    id: number;
    parent_id: number;
    name: string;
    name_en: string;
    keywords?: string;
    sort_order: number;
    is_active: boolean;
  }>;
}

/**
 * 获取分类及其子分类（供布局编辑器使用）
 */
export const getCategoriesWithSubs = async (): Promise<{
  categories: CategoryWithSubs[];
  flatCategories: Array<{ id: number; name: string; name_en: string }>;
  flatSubCategories: Array<{ id: number; parent_id: number; name: string; name_en: string }>;
}> => {
  const response = await apiClient.get<ApiResponse & { data?: any }>(
    '/admin/categories/with-subs'
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取分类失败');
};


// ============================================
// 版本管理增强 API
// ============================================

/**
 * 版本记录类型
 */
export interface AppVersion {
  id: number;
  version: string;
  url: string;
  force_update: boolean;
  changelog: string;
  platform: string;
  download_count: number;
  created_at: number;
}

/**
 * 获取历史版本列表
 */
export const getVersions = async (): Promise<AppVersion[]> => {
  const response = await apiClient.get<ApiResponse & { list?: AppVersion[] }>('/admin/versions');
  if (response.data.code === 1) {
    return response.data.list || [];
  }
  throw new Error(response.data.msg || '获取版本列表失败');
};

/**
 * 发布新版本（增强版）
 */
export const releaseVersionV2 = async (data: {
  version: string;
  url: string;
  force: boolean;
  changelog: string;
  platform?: string;
}): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/versions', data);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '发布版本失败');
  }
};

/**
 * 删除版本记录
 */
export const deleteVersion = async (id: number): Promise<void> => {
  const response = await apiClient.delete<ApiResponse>(`/admin/versions/${id}`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '删除版本失败');
  }
};

// ============================================
// 反馈管理增强 API
// ============================================

/**
 * 反馈详情类型（增强版）
 */
export interface FeedbackDetail {
  id: number;
  user_id: number;
  content: string;
  contact: string | null;
  status: 'pending' | 'processed' | 'replied';
  category?: 'bug' | 'suggestion' | 'complaint' | 'other';
  reply?: string;
  replied_at?: number;
  created_at: number;
}

/**
 * 获取所有反馈（支持筛选和分页）
 */
export const getAllFeedback = async (options?: {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
}): Promise<{ list: FeedbackDetail[]; total: number }> => {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', String(options.page));
  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.status) params.append('status', options.status);
  if (options?.category) params.append('category', options.category);

  const response = await apiClient.get<ApiResponse & { list?: FeedbackDetail[]; total?: number }>(
    `/admin/feedback/all?${params.toString()}`
  );
  if (response.data.code === 1) {
    return {
      list: response.data.list || [],
      total: response.data.total || 0,
    };
  }
  throw new Error(response.data.msg || '获取反馈失败');
};

/**
 * 回复反馈
 */
export const replyFeedback = async (id: number, reply: string): Promise<void> => {
  const response = await apiClient.post<ApiResponse>(`/admin/feedback/${id}/reply`, { reply });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '回复失败');
  }
};

/**
 * 更新反馈分类
 */
export const updateFeedbackCategory = async (id: number, category: string): Promise<void> => {
  const response = await apiClient.patch<ApiResponse>(`/admin/feedback/${id}/category`, { category });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '更新分类失败');
  }
};

/**
 * 批量处理反馈
 */
export const batchProcessFeedback = async (ids: number[], action: 'process' | 'delete'): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/feedback/batch', { ids, action });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '批量操作失败');
  }
};

/**
 * 获取反馈统计
 */
export const getFeedbackStats = async (): Promise<{
  total: number;
  pending: number;
  processed: number;
  replied: number;
  byCategory: Array<{ category: string; count: number }>;
}> => {
  const response = await apiClient.get<ApiResponse & { data?: any }>('/admin/feedback/stats');
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取统计失败');
};

// ============================================
// 系统设置增强 API
// ============================================

/**
 * 获取所有系统配置
 */
export const getAllConfig = async (): Promise<Record<string, any>> => {
  const response = await apiClient.get<ApiResponse & { data?: Record<string, any> }>('/admin/config/all');
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取配置失败');
};

/**
 * 批量更新系统配置
 */
export const batchUpdateConfig = async (configs: Record<string, any>): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/config/batch', { configs });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '更新配置失败');
  }
};

/**
 * 切换开关配置
 */
export const toggleConfigSwitch = async (key: string, enabled: boolean): Promise<void> => {
  const response = await apiClient.post<ApiResponse>(`/admin/config/switch/${key}`, { enabled });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '切换开关失败');
  }
};

// ============================================
// 视频管理增强 API
// ============================================

/**
 * 批量操作视频
 */
export const batchVideos = async (
  vodIds: string[],
  action: 'delete' | 'mark_valid' | 'mark_invalid' | 'change_category',
  data?: { type_id?: number }
): Promise<{ affected: number }> => {
  const response = await apiClient.post<ApiResponse & { affected?: number }>('/admin/videos/batch', {
    vod_ids: vodIds,
    action,
    data,
  });
  if (response.data.code === 1) {
    return { affected: response.data.affected || 0 };
  }
  throw new Error(response.data.msg || '批量操作失败');
};

/**
 * 导出视频列表
 */
export const exportVideos = async (options?: {
  type_id?: number;
  is_valid?: string;
  limit?: number;
}): Promise<{ list: any[]; total: number }> => {
  const params = new URLSearchParams();
  if (options?.type_id) params.append('type_id', String(options.type_id));
  if (options?.is_valid) params.append('is_valid', options.is_valid);
  if (options?.limit) params.append('limit', String(options.limit));

  const response = await apiClient.get<ApiResponse & { list?: any[]; total?: number }>(
    `/admin/videos/export?${params.toString()}`
  );
  if (response.data.code === 1) {
    return {
      list: response.data.list || [],
      total: response.data.total || 0,
    };
  }
  throw new Error(response.data.msg || '导出失败');
};

/**
 * 获取视频播放源
 */
export const getVideoSources = async (vodId: string): Promise<{
  sources: Array<{
    name: string;
    episodes: Array<{ title: string; url: string }>;
  }>;
}> => {
  const response = await apiClient.get<ApiResponse & { data?: any }>(`/admin/video/${vodId}/sources`);
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取播放源失败');
};

// ============================================
// 专题管理增强 API
// ============================================

/**
 * 切换专题启用状态
 */
export const toggleTopic = async (id: string): Promise<void> => {
  const response = await apiClient.patch<ApiResponse>(`/admin/topic/${id}/toggle`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '切换状态失败');
  }
};

/**
 * 更新专题排序
 */
export const updateTopicsOrder = async (ids: string[]): Promise<void> => {
  const response = await apiClient.put<ApiResponse>('/admin/topics/order', { ids });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '更新排序失败');
  }
};

/**
 * 获取专题统计
 */
export const getTopicsStats = async (): Promise<Array<{
  id: string;
  title: string;
  video_count: number;
}>> => {
  const response = await apiClient.get<ApiResponse & { list?: any[] }>('/admin/topics/stats');
  if (response.data.code === 1) {
    return response.data.list || [];
  }
  throw new Error(response.data.msg || '获取统计失败');
};

// ============================================
// 演员管理增强 API
// ============================================

/**
 * 更新演员信息
 */
export const updateActor = async (id: number, data: {
  name?: string;
  name_en?: string;
  avatar?: string;
  bio?: string;
}): Promise<void> => {
  const response = await apiClient.put<ApiResponse>(`/admin/actors/${id}`, data);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '更新演员失败');
  }
};

/**
 * 删除演员
 */
export const deleteActor = async (id: number): Promise<void> => {
  const response = await apiClient.delete<ApiResponse>(`/admin/actors/${id}`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '删除演员失败');
  }
};

/**
 * 合并重复演员
 */
export const mergeActors = async (sourceIds: number[], targetId: number): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/actors/merge', {
    source_ids: sourceIds,
    target_id: targetId,
  });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '合并演员失败');
  }
};

// ============================================
// 仪表板增强 API
// ============================================

/**
 * 获取实时统计数据
 */
export const getRealtimeStats = async (): Promise<{
  hourly_active: number;
  videos: { total: number; valid: number; today_new: number };
  sources: { total: number; active: number };
  pending_feedback: number;
  timestamp: number;
}> => {
  const response = await apiClient.get<ApiResponse & { data?: any }>('/admin/dashboard/realtime');
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取实时数据失败');
};

/**
 * 获取趋势数据
 */
export const getTrends = async (days?: number): Promise<Array<{
  date: string;
  new_videos: number;
}>> => {
  const params = days ? `?days=${days}` : '';
  const response = await apiClient.get<ApiResponse & { data?: any[] }>(`/admin/dashboard/trends${params}`);
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取趋势数据失败');
};

// ============================================
// 缓存管理增强 API
// ============================================

/**
 * 获取缓存统计
 */
export const getCacheStats = async (): Promise<{
  caches: Array<{ key: string; exists: boolean; size: number }>;
  total_keys: number;
}> => {
  const response = await apiClient.get<ApiResponse & { data?: any }>('/admin/cache/stats');
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取缓存统计失败');
};

/**
 * 删除指定缓存
 */
export const deleteCache = async (key: string): Promise<void> => {
  const response = await apiClient.delete<ApiResponse>(`/admin/cache/${encodeURIComponent(key)}`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '删除缓存失败');
  }
};

// ============================================
// 去重诊断 API
// ============================================

/**
 * 去重诊断报告类型
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
 * 获取去重诊断报告
 */
export const getDedupDiagnostics = async (): Promise<DedupDiagnostics> => {
  const response = await apiClient.get<ApiResponse & { data?: DedupDiagnostics }>('/admin/dedup/diagnostics');
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取去重诊断失败');
};

/**
 * 合并指定视频的重复记录
 */
export const mergeDuplicateVideo = async (vodName: string): Promise<string> => {
  const response = await apiClient.post<ApiResponse>('/admin/dedup/merge', { vodName });
  return response.data.msg || (response.data.code === 1 ? '合并成功' : '合并失败');
};

/**
 * 批量清理所有重复视频
 */
export const cleanupDuplicates = async (): Promise<{
  processed: number;
  merged: number;
  errors: number;
}> => {
  const response = await apiClient.post<ApiResponse & { data?: any }>('/admin/dedup/cleanup');
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '清理重复视频失败');
};


// ============================================
// 视频修复 API
// ============================================

/**
 * 修复单个视频 - 从所有资源站搜索并更新播放源
 */
export const repairVideo = async (vodId: string): Promise<{
  foundCount: number;
  sources: string[];
}> => {
  const response = await apiClient.post<ApiResponse & { data?: any }>(
    `/admin/video/${vodId}/repair`
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '修复失败');
};

/**
 * 批量修复失效视频
 */
export const repairInvalidVideos = async (options?: {
  type_id?: number;
  sub_type_id?: number;
  limit?: number;
}): Promise<{
  total: number;
  repaired: number;
  failed: number;
}> => {
  const response = await apiClient.post<ApiResponse & { data?: any }>(
    '/admin/videos/repair-invalid',
    options || {}
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '批量修复失败');
};


// ============================================
// 定时任务管理 API
// ============================================

/**
 * 定时任务类型
 */
export interface SchedulerTask {
  id: string;
  name: string;
  description: string;
  cron: string;
  cronDescription: string;
  category: string;
  enabled: boolean;
  is_builtin: boolean;
  task_type: string;
  task_params: Record<string, any> | null;
  lastRun: string | null;
  lastStatus: string | null;
}

/**
 * 执行历史类型
 */
export interface SchedulerHistory {
  id: number;
  task_id: string;
  status: string;
  message: string;
  duration: number;
  executed_at: string;
}

/**
 * 任务类型选项
 */
export interface SchedulerTaskType {
  value: string;
  label: string;
  category: string;
}

/**
 * 获取任务类型选项
 */
export const getSchedulerTaskTypes = async (): Promise<{ types: SchedulerTaskType[] }> => {
  const response = await apiClient.get<ApiResponse & { data?: { types: SchedulerTaskType[] } }>(
    '/admin/scheduler/task-types'
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取任务类型失败');
};

/**
 * 获取定时任务列表
 */
export const getSchedulerTasks = async (): Promise<{ tasks: SchedulerTask[] }> => {
  const response = await apiClient.get<ApiResponse & { data?: { tasks: SchedulerTask[] } }>(
    '/admin/scheduler/tasks'
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取任务列表失败');
};

/**
 * 创建新任务
 */
export const createSchedulerTask = async (data: {
  name: string;
  description?: string;
  cron: string;
  category?: string;
  task_type: string;
  task_params?: Record<string, any>;
}): Promise<{ id: string }> => {
  const response = await apiClient.post<ApiResponse & { data?: { id: string } }>(
    '/admin/scheduler/tasks',
    data
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '创建任务失败');
};

/**
 * 更新任务
 */
export const updateSchedulerTask = async (taskId: string, data: {
  name?: string;
  description?: string;
  cron?: string;
  category?: string;
  task_type?: string;
  task_params?: Record<string, any>;
}): Promise<void> => {
  const response = await apiClient.put<ApiResponse>(
    `/admin/scheduler/tasks/${taskId}`,
    data
  );
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '更新任务失败');
  }
};

/**
 * 删除任务
 */
export const deleteSchedulerTask = async (taskId: string): Promise<void> => {
  const response = await apiClient.delete<ApiResponse>(
    `/admin/scheduler/tasks/${taskId}`
  );
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '删除任务失败');
  }
};

/**
 * 切换任务启用状态
 */
export const toggleSchedulerTask = async (taskId: string, enabled: boolean): Promise<void> => {
  const response = await apiClient.post<ApiResponse>(
    `/admin/scheduler/tasks/${taskId}/toggle`,
    { enabled }
  );
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '切换状态失败');
  }
};

/**
 * 手动执行任务
 */
export const runSchedulerTask = async (taskId: string): Promise<{
  code: number;
  msg: string;
  data?: { duration: number };
}> => {
  const response = await apiClient.post<ApiResponse & { data?: { duration: number } }>(
    `/admin/scheduler/tasks/${taskId}/run`
  );
  return {
    code: response.data.code,
    msg: response.data.msg || '',
    data: response.data.data,
  };
};

/**
 * 重置内置任务为默认配置
 */
export const resetSchedulerTask = async (taskId: string): Promise<void> => {
  const response = await apiClient.post<ApiResponse>(
    `/admin/scheduler/tasks/${taskId}/reset`
  );
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '重置任务失败');
  }
};

/**
 * 获取执行历史
 */
export const getSchedulerHistory = async (options?: {
  taskId?: string;
  limit?: number;
}): Promise<{ history: SchedulerHistory[]; total: number }> => {
  const params = new URLSearchParams();
  if (options?.taskId) params.append('taskId', options.taskId);
  if (options?.limit) params.append('limit', String(options.limit));

  const response = await apiClient.get<ApiResponse & { data?: { history: SchedulerHistory[]; total: number } }>(
    `/admin/scheduler/history?${params.toString()}`
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取执行历史失败');
};

/**
 * 清理执行历史
 */
export const clearSchedulerHistory = async (days: number = 30): Promise<void> => {
  const response = await apiClient.delete<ApiResponse>(
    `/admin/scheduler/history?days=${days}`
  );
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '清理历史失败');
  }
};


// ============================================
// 域名管理 API
// ============================================

/**
 * API 域名类型
 */
export interface ApiDomain {
  id: number;
  domain: string;
  name: string;
  priority: number;
  is_active: boolean;
  is_primary: boolean;
  health_status: string;
  last_check_at: string | null;
  response_time: number | null;
  fail_count: number;
  created_at: number;
  updated_at: number;
}

/**
 * 获取域名列表
 */
export const getDomains = async (): Promise<{ domains: ApiDomain[] }> => {
  const response = await apiClient.get<ApiResponse & { data?: { domains: ApiDomain[] } }>(
    '/admin/domains'
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取域名列表失败');
};

/**
 * 添加域名
 */
export const addDomain = async (data: {
  domain: string;
  name?: string;
  priority?: number;
  is_primary?: boolean;
}): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/domains', data);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '添加域名失败');
  }
};

/**
 * 更新域名
 */
export const updateDomain = async (id: number, data: {
  domain?: string;
  name?: string;
  priority?: number;
  is_active?: boolean;
  is_primary?: boolean;
}): Promise<void> => {
  const response = await apiClient.put<ApiResponse>(`/admin/domains/${id}`, data);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '更新域名失败');
  }
};

/**
 * 删除域名
 */
export const deleteDomain = async (id: number): Promise<void> => {
  const response = await apiClient.delete<ApiResponse>(`/admin/domains/${id}`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '删除域名失败');
  }
};

/**
 * 设为主域名
 */
export const setDomainPrimary = async (id: number): Promise<void> => {
  const response = await apiClient.post<ApiResponse>(`/admin/domains/${id}/set-primary`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '设置主域名失败');
  }
};

/**
 * 检测单个域名
 */
export const checkDomain = async (id: number): Promise<{
  msg: string;
  data?: { healthy: boolean; responseTime: number; error?: string };
}> => {
  const response = await apiClient.post<ApiResponse & { data?: any }>(
    `/admin/domains/${id}/check`
  );
  return {
    msg: response.data.msg || '',
    data: response.data.data,
  };
};

/**
 * 检测所有域名
 */
export const checkAllDomains = async (): Promise<{
  msg: string;
  data?: { results: any[]; healthy: number; unhealthy: number };
}> => {
  const response = await apiClient.post<ApiResponse & { data?: any }>(
    '/admin/domains/check-all'
  );
  return {
    msg: response.data.msg || '',
    data: response.data.data,
  };
};

// ============================================
// 公告管理 API
// ============================================

/**
 * 公告类型
 */
export interface Announcement {
  id: number;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'update' | 'urgent';
  action_type: 'none' | 'url' | 'update' | 'close';
  action_url: string | null;
  action_text: string | null;
  image_url: string | null;
  priority: number;
  is_active: boolean;
  show_once: boolean;
  force_show: boolean;
  target_version: string | null;
  target_platform: 'all' | 'android' | 'ios';
  start_time: number | null;
  end_time: number | null;
  view_count: number;
  click_count: number;
  created_at: number;
  updated_at: number;
}

/**
 * 获取公告列表
 */
export const getAnnouncements = async (options?: {
  page?: number;
  limit?: number;
  status?: 'active' | 'inactive' | 'all';
}): Promise<{ list: Announcement[]; total: number }> => {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', String(options.page));
  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.status) params.append('status', options.status);

  const response = await apiClient.get<ApiResponse & { list?: Announcement[]; total?: number }>(
    `/admin/announcements?${params.toString()}`
  );
  if (response.data.code === 1) {
    return {
      list: response.data.list || [],
      total: response.data.total || 0,
    };
  }
  throw new Error(response.data.msg || '获取公告列表失败');
};

/**
 * 获取公告详情
 */
export const getAnnouncementDetail = async (id: number): Promise<Announcement> => {
  const response = await apiClient.get<ApiResponse & { data?: Announcement }>(
    `/admin/announcements/${id}`
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取公告详情失败');
};

/**
 * 创建公告
 */
export const createAnnouncement = async (data: Partial<Announcement>): Promise<{ id: number }> => {
  const response = await apiClient.post<ApiResponse & { data?: { id: number } }>(
    '/admin/announcements',
    data
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '创建公告失败');
};

/**
 * 更新公告
 */
export const updateAnnouncement = async (id: number, data: Partial<Announcement>): Promise<void> => {
  const response = await apiClient.put<ApiResponse>(`/admin/announcements/${id}`, data);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '更新公告失败');
  }
};

/**
 * 删除公告
 */
export const deleteAnnouncement = async (id: number): Promise<void> => {
  const response = await apiClient.delete<ApiResponse>(`/admin/announcements/${id}`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '删除公告失败');
  }
};

/**
 * 切换公告启用状态
 */
export const toggleAnnouncement = async (id: number): Promise<void> => {
  const response = await apiClient.patch<ApiResponse>(`/admin/announcements/${id}/toggle`);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '切换状态失败');
  }
};

/**
 * 获取公告统计
 */
export const getAnnouncementStats = async (id: number): Promise<{
  view_count: number;
  click_count: number;
  unique_reads: number;
  click_rate: string;
}> => {
  const response = await apiClient.get<ApiResponse & { data?: any }>(
    `/admin/announcements/${id}/stats`
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取统计失败');
};


// ============================================
// API 安全配置 API
// ============================================

/**
 * 安全配置类型
 */
export interface SecurityConfig {
  enabled: boolean;
  secretKey: string;
  hasSecretKey: boolean;
  timestampTolerance: number;
  nonceTtl: number;
  allowedPackages: string[];
  protectedPaths: string[];
  whitelistPaths: string[];
}

/**
 * 获取安全配置
 */
export const getSecurityConfig = async (): Promise<SecurityConfig> => {
  const response = await apiClient.get<ApiResponse & { data?: SecurityConfig }>(
    '/admin/security/config'
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取配置失败');
};

/**
 * 更新安全配置
 */
export const updateSecurityConfig = async (config: Partial<SecurityConfig>): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/security/config', config);
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '更新配置失败');
  }
};

/**
 * 切换安全开关
 */
export const toggleSecurityEnabled = async (enabled: boolean): Promise<void> => {
  const response = await apiClient.post<ApiResponse>('/admin/security/toggle', { enabled });
  if (response.data.code !== 1) {
    throw new Error(response.data.msg || '切换失败');
  }
};

/**
 * 生成新密钥
 */
export const generateSecurityKey = async (): Promise<{ key: string }> => {
  const response = await apiClient.post<ApiResponse & { data?: { key: string } }>(
    '/admin/security/generate-key'
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '生成失败');
};

/**
 * 获取安全统计
 */
export const getSecurityStats = async (): Promise<{
  today: { blocked: number; valid: number };
}> => {
  const response = await apiClient.get<ApiResponse & { data?: any }>(
    '/admin/security/stats'
  );
  if (response.data.code === 1 && response.data.data) {
    return response.data.data;
  }
  throw new Error(response.data.msg || '获取统计失败');
};
