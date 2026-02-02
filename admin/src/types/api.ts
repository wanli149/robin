/**
 * API Types
 * 统一的API类型定义
 */

/**
 * 基础API响应
 */
export interface ApiResponse<T = unknown> {
  code: number;
  msg: string;
  data?: T;
  list?: T[];
  page?: number;
  total?: number;
  meta?: Record<string, unknown>;
}

/**
 * 分页参数
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

/**
 * Dashboard 统计数据
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
 * 实时统计
 */
export interface RealtimeStats {
  online_users: number;
  active_sessions: number;
  requests_per_minute: number;
  timestamp: number;
}

/**
 * 趋势数据
 */
export interface TrendData {
  date: string;
  users: number;
  api_calls: number;
  videos: number;
}

/**
 * 布局模块API参数
 */
export interface ModuleApiParams {
  t?: string | number;
  area?: string;
  year?: string;
  sort?: string;
  pg?: string | number;
  limit?: number;
  strategy?: string;
  [key: string]: string | number | undefined;
}

/**
 * 广告配置
 */
export interface AdConfig {
  enabled: boolean;
  position?: string;
  ad_id?: number;
  frequency?: number;
  [key: string]: unknown;
}

/**
 * 布局模块
 */
export interface LayoutModule {
  id?: number;
  tab_id: string;
  module_type: string;
  title: string | null;
  api_params: ModuleApiParams | null;
  ad_config: AdConfig | null;
  sort_order: number;
  is_enabled?: boolean;
}

/**
 * 布局数据
 */
export interface LayoutData {
  tab_id: string;
  modules: LayoutModule[];
}

/**
 * 采集任务日志
 */
export interface CollectLog {
  id: number;
  task_id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  source_name?: string;
  action: string;
  message: string;
  details?: Record<string, unknown>;
  vod_id?: string;
  vod_name?: string;
  created_at: number;
}

/**
 * 采集任务进度
 */
export interface CollectTaskProgress {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  currentPage?: number;
  totalPages?: number;
  videosCollected?: number;
  videosUpdated?: number;
  errors?: number;
  startTime?: number;
  endTime?: number;
  lastError?: string;
}

/**
 * 资源站健康检查结果
 */
export interface SourceHealthCheck {
  success: boolean;
  responseTime: number;
  format?: string;
  videoCount?: number;
  error?: string;
}

/**
 * 采集统计
 */
export interface CollectStats {
  videos: { total: number; today: number; week: number };
  sources: { total: number; active: number; inactive: number };
  tasks: {
    running: CollectTaskProgress | null;
    recent: CollectTaskProgress[];
  };
}

/**
 * 分类信息
 */
export interface Category {
  id: number;
  name: string;
  name_en: string;
}

/**
 * 子分类信息
 */
export interface SubCategory {
  id: number;
  parent_id: number;
  name: string;
  name_en: string;
}

/**
 * 分类映射
 */
export interface CategoryMapping {
  id: number;
  source_id: number;
  source_type_id: string;
  source_type_name: string;
  target_type_id: number;
  target_type_name: string;
}

/**
 * 视频源信息
 */
export interface VideoSource {
  id: number;
  name: string;
  url: string;
  weight: number;
  enabled: boolean;
  timeout?: number;
  is_welfare?: boolean;
}

/**
 * 模块统计
 */
export interface ModuleStats {
  module_type: string;
  title: string;
  views: number;
  clicks: number;
  click_rate: string;
}

/**
 * 崩溃报告
 */
export interface CrashReport {
  id: number;
  app_version: string;
  device_info: string;
  error_message: string;
  stack_trace: string;
  created_at: number;
  is_fixed?: boolean;
}

/**
 * 反馈信息
 */
export interface Feedback {
  id: number;
  user_id?: string;
  category: string;
  content: string;
  contact?: string;
  status: 'pending' | 'processing' | 'resolved' | 'closed';
  created_at: number;
}

/**
 * 反馈统计
 */
export interface FeedbackStats {
  total: number;
  pending: number;
  processing: number;
  resolved: number;
  byCategory: Array<{ category: string; count: number }>;
}

/**
 * 视频导出选项
 */
export interface VideoExportOptions {
  type_id?: number;
  source_name?: string;
  is_valid?: string;
  limit?: number;
}

/**
 * 视频源信息
 */
export interface VideoSourceInfo {
  sources: Array<{
    source_name: string;
    vod_play_url: string;
    quality_score: number;
  }>;
}

/**
 * 专题统计
 */
export interface TopicStats {
  id: number;
  title: string;
  video_count: number;
}

/**
 * 缓存统计
 */
export interface CacheStats {
  used_memory: number;
  total_keys: number;
}

/**
 * 去重结果
 */
export interface DedupResult {
  merged: number;
  deleted: number;
  errors: number;
}

/**
 * 视频修复结果
 */
export interface VideoRepairResult {
  repaired: number;
  sources: string[];
}

/**
 * 批量修复结果
 */
export interface BatchRepairResult {
  repaired: number;
  failed: number;
}

/**
 * 域名检查结果
 */
export interface DomainCheckResult {
  healthy: boolean;
  responseTime: number;
  error?: string;
}

/**
 * 批量域名检查结果
 */
export interface BatchDomainCheckResult {
  results: Array<{
    id: number;
    domain: string;
    healthy: boolean;
    responseTime?: number;
    error?: string;
  }>;
  healthy: number;
  unhealthy: number;
}

/**
 * 迁移结果
 */
export interface MigrationResult {
  success: boolean;
  message: string;
  data_count?: number;
  details?: Record<string, unknown>;
}

/**
 * 采集结果
 */
export interface CollectResult {
  collected: number;
  updated: number;
  errors: number;
}

/**
 * 演员丰富结果
 */
export interface ActorEnrichResult {
  enriched: number;
  notFound: number;
}

/**
 * 演员统计
 */
export interface ActorStats {
  articles: { total: number; withCover: number };
  actors: { total: number; withAvatar: number; withWorks: number };
}

/**
 * 检测到的分类
 */
export interface DetectedCategory {
  source_type_id: string;
  source_type_name: string;
  count: number;
  suggested_target?: string;
}

/**
 * 分类检测结果
 */
export interface CategoryDetectionResult {
  total: number;
  categories: DetectedCategory[];
}

/**
 * 分类测试输入
 */
export interface ClassifyTestInput {
  vod_name: string;
  type_name?: string;
  vod_tag?: string;
  vod_content?: string;
}

/**
 * 分类测试结果
 */
export interface ClassifyTestResult {
  input: ClassifyTestInput;
  result: {
    typeId: number;
    typeName: string;
    subTypeId?: number;
    subTypeName?: string;
    classifyMethod: string;
    confidence: number;
  };
}

/**
 * 带子分类的分类数据
 */
export interface CategoryWithSubs {
  categories: Category[];
  subCategories: SubCategory[];
  flatSubCategories: Array<{
    id: number;
    parent_id: number;
    name: string;
    name_en: string;
  }>;
}
