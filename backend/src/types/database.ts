/**
 * 数据库类型定义
 * 统一定义所有数据库表的行类型，消除 any 类型使用
 */

// ============================================
// 视频相关类型
// ============================================

/** vod_cache 表行类型 */
export interface VodCacheRow {
  vod_id: string;
  vod_name: string;
  vod_pic: string | null;
  vod_pic_thumb: string | null;
  vod_remarks: string | null;
  vod_year: string | null;
  vod_area: string | null;
  vod_lang: string | null;
  vod_actor: string | null;
  vod_director: string | null;
  vod_content: string | null;
  vod_play_url: string | null;
  vod_play_from: string | null;
  vod_score: number | null;
  vod_tag: string | null;
  vod_hits: number | null;
  vod_hits_day: number | null;
  vod_hits_week: number | null;
  vod_hits_month: number | null;
  type_id: number | null;
  type_name: string | null;
  sub_type_id: number | null;
  sub_type_name: string | null;
  source_name: string | null;
  source_priority: number | null;
  quality_score: number | null;
  shorts_preview_episode: number | null;
  shorts_preview_url: string | null;
  shorts_category: string | null;
  is_valid: number;
  last_check: number | null;
  created_at: number;
  updated_at: number;
}

/** vod_cache 表部分字段（用于列表查询） */
export interface VodCacheListRow {
  vod_id: string;
  vod_name: string;
  vod_pic: string | null;
  vod_pic_thumb: string | null;
  vod_remarks: string | null;
  vod_year: string | null;
  vod_area: string | null;
  vod_score: number | null;
  vod_hits: number | null;
  vod_hits_day: number | null;
  vod_hits_week: number | null;
  vod_hits_month: number | null;
  type_id: number | null;
  type_name: string | null;
  is_valid: number;
  updated_at: number;
}

/** 短剧列表行类型 */
export interface ShortsListRow {
  vod_id: string;
  vod_name: string;
  vod_pic_thumb: string | null;
  shorts_category: string | null;
  vod_remarks: string | null;
  vod_score: number | null;
  vod_hits: number | null;
  episode_index?: number;
  play_url?: string;
}

// ============================================
// 资源站相关类型
// ============================================

/** video_sources 表行类型 */
export interface VideoSourceRow {
  id: number;
  name: string;
  api_url: string;
  weight: number;
  is_active: number;
  response_format: string | null;
  created_at: number;
  updated_at: number;
}

/** source_health 表行类型 */
export interface SourceHealthRow {
  source_id: number;
  source_name: string;
  status: string | null;
  response_time: number | null;
  avg_response_time: number | null;
  success_rate: number | null;
  total_checks: number | null;
  success_checks: number | null;
  last_error: string | null;
  last_error_at: number | null;
  consecutive_failures: number | null;
  video_count: number | null;
  last_check_at: number | null;
  updated_at: number | null;
}

// ============================================
// 系统配置相关类型
// ============================================

/** system_config 表行类型 */
export interface SystemConfigRow {
  key: string;
  value: string | null;
}

/** hot_search_stats 表行类型 */
export interface HotSearchStatsRow {
  keyword: string;
  search_count: number;
  search_count_day: number;
  is_pinned: number;
  is_hidden: number;
  last_search_at: number;
}

/** home_tabs 表行类型 */
export interface HomeTabRow {
  id: number;
  title: string;
  sort_order: number;
  is_visible: number;
  is_locked: number;
}

// ============================================
// 用户相关类型
// ============================================

/** watch_history 表行类型 */
export interface WatchHistoryRow {
  id: number;
  user_id: number;
  vod_id: string;
  progress: number;
  duration: number;
  created_at: number;
  updated_at: number;
}

/** feedback 表行类型 */
export interface FeedbackRow {
  id: number;
  user_id: number | null;
  content: string;
  contact: string | null;
  category: string | null;
  status: string;
  reply: string | null;
  replied_at: number | null;
  created_at: number;
}

// ============================================
// 采集任务相关类型
// ============================================

/** collect_tasks 表行类型 */
export interface CollectTaskRow {
  id: string;
  task_type: string;
  status: string;
  config: string;
  progress: string;
  checkpoint: string | null;
  last_error: string | null;
  error_details: string | null;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  updated_at: number;
}

/** collect_logs 表行类型 */
export interface CollectLogRow {
  id: number;
  task_id: string;
  level: string;
  action: string;
  message: string;
  details: string | null;
  vod_id: string | null;
  vod_name: string | null;
  created_at: number;
}

// ============================================
// 推荐相关类型
// ============================================

/** vod_recommendations 表行类型 */
export interface VodRecommendationRow {
  vod_id: string;
  similar_ids: string;
  algorithm: string;
  confidence: number;
  updated_at: number;
}

// ============================================
// 分类相关类型
// ============================================

/** video_sub_categories 表行类型 */
export interface VideoSubCategoryRow {
  id: number;
  parent_id: number;
  name: string;
  name_en: string | null;
  icon: string | null;
  sort_order: number;
  is_active: number;
}

// ============================================
// 通用类型
// ============================================

/** 数据库查询参数类型（替代 any[]） */
export type DbQueryParam = string | number | boolean | null;

/** 播放地址 Episode 类型 */
export interface PlayEpisode {
  name: string;
  url: string;
}

/** 清洗后的播放地址类型 */
export type CleanedPlayUrls = Record<string, PlayEpisode[]>;

/** 原始播放地址类型 */
export type RawPlayUrls = Record<string, string>;

/** 排行榜视频类型 */
export interface RankingVideoRow extends VodCacheListRow {
  rank: number;
  heat: number;
}

// ============================================
// 布局模块相关类型
// ============================================

/** page_modules 表行类型 */
export interface PageModuleRow {
  id: number;
  tab_id: string;
  module_type: string;
  title: string | null;
  api_params: string | null;
  ad_config: string | null;
  sort_order: number;
  is_enabled: number | null;
}

/** 解析后的布局模块类型 */
export interface ParsedPageModule {
  id: number;
  tab_id: string;
  module_type: string;
  title: string | null;
  api_params: Record<string, unknown> | null;
  ad_config: Record<string, unknown> | null;
  sort_order: number;
  is_enabled: boolean;
}

/** 布局验证结果类型 */
export interface LayoutValidationResult {
  module_index: number;
  module_type: string;
  module_title: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  data_count?: number;
}

// ============================================
// 定时任务相关类型
// ============================================

/** scheduler_tasks 表行类型 */
export interface SchedulerTaskRow {
  id: string;
  name: string;
  description: string | null;
  cron: string;
  category: string;
  enabled: number;
  is_builtin: number;
  task_type: string;
  task_params: string | null;
  created_at: number;
  updated_at: number | null;
}

/** scheduler_history 表行类型 */
export interface SchedulerHistoryRow {
  id: number;
  task_id: string;
  status: string;
  message: string | null;
  duration: number | null;
  executed_at: string;
}

/** 任务执行参数类型 */
export interface TaskExecutionParams {
  maxPages?: number;
  maxVideos?: number;
  typeId?: number;
  categoryId?: number;
  limit?: number;
  days?: number;
}

// ============================================
// 专题相关类型
// ============================================

/** topics 表行类型 */
export interface TopicRow {
  id: string;
  title: string;
  cover_img: string | null;
  description: string | null;
  is_active: number;
  sort_order: number;
  data_source_type: string | null;
  data_source_config: string | null;
}

/** 解析后的专题类型 */
export interface ParsedTopicRow extends Omit<TopicRow, 'data_source_config'> {
  data_source_config: Record<string, unknown> | null;
}

/** 专题视频类型 */
export interface TopicVideoRow {
  vod_id: string;
  vod_name: string;
  vod_pic: string | null;
  vod_score: number | null;
  vod_year: string | null;
}

// ============================================
// 演员相关类型
// ============================================

/** actors 表行类型 */
export interface ActorRow {
  id: number;
  name: string;
  actor_id: string | null;
  avatar: string | null;
  name_en: string | null;
  sex: string | null;
  area: string | null;
  birthday: string | null;
  works_count: number;
  popularity: number;
  bio: string | null;
  updated_at: number;
}

// ============================================
// 域名管理相关类型
// ============================================

/** domains 表行类型 */
export interface DomainRow {
  id: number;
  domain: string;
  is_primary: number;
  is_active: number;
  health_status: string | null;
  last_check_at: number | null;
  created_at: number;
}

/** 域名健康检查结果 */
export interface DomainHealthResult {
  domain: string;
  healthy: boolean;
  responseTime?: number;
  error?: string;
}

// ============================================
// 反馈相关类型
// ============================================

/** 反馈分类统计 */
export interface FeedbackCategoryStats {
  category: string;
  count: number;
}

// ============================================
// 视频管理相关类型
// ============================================

/** 播放源类型 */
export interface PlaySource {
  name: string;
  episodes: PlayEpisode[];
}

/** 无效URL报告行类型 */
export interface InvalidUrlRow {
  id: number;
  vod_id: string;
  vod_name: string;
  play_url: string;
  error_type: string;
  reported_by: string | null;
  reported_at: number;
  is_fixed: number;
}

// ============================================
// 缓存状态类型
// ============================================

/** 缓存状态项 */
export interface CacheStatusItem {
  tab: string;
  exists: boolean;
  timestamp?: number;
  moduleCount?: number;
}

// ============================================
// PRAGMA 表信息类型
// ============================================

/** SQLite PRAGMA table_info 返回类型 */
export interface TableColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

// ============================================
// 采集监控相关类型
// ============================================

/** 资源站分布统计行 */
export interface SourceDistributionRow {
  source_name: string;
  count: number;
}

/** 类型分布统计行 */
export interface TypeDistributionRow {
  type_name: string;
  count: number;
}

/** 合并视频类型 */
export interface MergeVideoRow extends VodCacheRow {
  source_name: string;
  source_priority: number;
}
