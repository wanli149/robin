/**
 * Database Type Definitions
 * Unified type definitions for all database table rows, eliminating any type usage
 */

// ============================================
// Video Related Types
// ============================================

/** vod_cache table row type */
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

/** vod_cache partial fields (for list queries) */
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

/** Shorts list row type */
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
// Video Source Related Types
// ============================================

/** video_sources table row type */
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

/** source_health table row type */
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
// System Config Related Types
// ============================================

/** system_config table row type */
export interface SystemConfigRow {
  key: string;
  value: string | null;
}

/** hot_search_stats table row type */
export interface HotSearchStatsRow {
  keyword: string;
  search_count: number;
  search_count_day: number;
  is_pinned: number;
  is_hidden: number;
  last_search_at: number;
}

/** home_tabs table row type */
export interface HomeTabRow {
  id: number;
  title: string;
  sort_order: number;
  is_visible: number;
  is_locked: number;
}

// ============================================
// User Related Types
// ============================================

/** history table row type (watch history) */
export interface WatchHistoryRow {
  id: number;
  user_id: number;
  vod_id: string;
  progress: number;
  duration: number;
  created_at: number;
  updated_at: number;
}

/** feedback table row type */
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
// Collect Task Related Types
// ============================================

/** collect_tasks table row type */
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

/** collect_logs table row type */
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
// Recommendation Related Types
// ============================================

/** vod_recommendations table row type */
export interface VodRecommendationRow {
  vod_id: string;
  similar_ids: string;
  algorithm: string;
  confidence: number;
  updated_at: number;
}

// ============================================
// Category Related Types
// ============================================

/** video_sub_categories table row type */
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
// Common Types
// ============================================

/** Database query parameter type (replaces any[]) */
export type DbQueryParam = string | number | boolean | null;

/** Play episode type */
export interface PlayEpisode {
  name: string;
  url: string;
}

/** Cleaned play URLs type */
export type CleanedPlayUrls = Record<string, PlayEpisode[]>;

/** Raw play URLs type */
export type RawPlayUrls = Record<string, string>;

/** Ranking video type */
export interface RankingVideoRow extends VodCacheListRow {
  rank: number;
  heat: number;
}

// ============================================
// Layout Module Related Types
// ============================================

/** page_modules table row type */
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

/** Parsed page module type */
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

/** Layout validation result type */
export interface LayoutValidationResult {
  module_index: number;
  module_type: string;
  module_title: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  data_count?: number;
}

// ============================================
// Scheduler Task Related Types
// ============================================

/** scheduler_tasks table row type */
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

/** scheduler_history table row type */
export interface SchedulerHistoryRow {
  id: number;
  task_id: string;
  status: string;
  message: string | null;
  duration: number | null;
  executed_at: string;
}

/** Task execution params type */
export interface TaskExecutionParams {
  maxPages?: number;
  maxVideos?: number;
  typeId?: number;
  categoryId?: number;
  limit?: number;
  days?: number;
}

// ============================================
// Topic Related Types
// ============================================

/** topics table row type */
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

/** Parsed topic row type */
export interface ParsedTopicRow extends Omit<TopicRow, 'data_source_config'> {
  data_source_config: Record<string, unknown> | null;
}

/** Topic video row type */
export interface TopicVideoRow {
  vod_id: string;
  vod_name: string;
  vod_pic: string | null;
  vod_score: number | null;
  vod_year: string | null;
}

// ============================================
// Actor Related Types
// ============================================

/** actors table row type */
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
// Domain Management Related Types
// ============================================

/** domains table row type */
export interface DomainRow {
  id: number;
  domain: string;
  is_primary: number;
  is_active: number;
  health_status: string | null;
  last_check_at: number | null;
  created_at: number;
}

/** Domain health check result */
export interface DomainHealthResult {
  domain: string;
  healthy: boolean;
  responseTime?: number;
  error?: string;
}

// ============================================
// Feedback Related Types
// ============================================

/** Feedback category stats */
export interface FeedbackCategoryStats {
  category: string;
  count: number;
}

// ============================================
// Video Management Related Types
// ============================================

/** Play source type */
export interface PlaySource {
  name: string;
  episodes: PlayEpisode[];
}

/** Invalid URL report row type */
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
// Cache Status Types
// ============================================

/** Cache status item */
export interface CacheStatusItem {
  tab: string;
  exists: boolean;
  timestamp?: number;
  moduleCount?: number;
}

// ============================================
// PRAGMA Table Info Types
// ============================================

/** SQLite PRAGMA table_info return type */
export interface TableColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

// ============================================
// Collect Monitor Related Types
// ============================================

/** Source distribution stats row */
export interface SourceDistributionRow {
  source_name: string;
  count: number;
}

/** Type distribution stats row */
export interface TypeDistributionRow {
  type_name: string;
  count: number;
}

/** Merge video row type */
export interface MergeVideoRow extends VodCacheRow {
  source_name: string;
  source_priority: number;
}
