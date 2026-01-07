/**
 * 采集任务相关类型定义
 */

/** collect_tasks_v2 表行类型 */
export interface CollectTaskDbRow {
  id: string;
  task_type: string;
  status: string;
  priority: number;
  config: string | null;
  current_source: string | null;
  current_source_id: number | null;
  current_page: number | null;
  total_pages: number | null;
  processed_count: number | null;
  new_count: number | null;
  update_count: number | null;
  skip_count: number | null;
  error_count: number | null;
  checkpoint: string | null;
  last_error: string | null;
  error_details: string | null;
  created_at: number;
  started_at: number | null;
  paused_at: number | null;
  completed_at: number | null;
  updated_at: number;
}
