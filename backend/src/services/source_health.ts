/**
 * Source Health Service
 * 资源站健康检测服务
 */

import { parseResponse, detectFormat, type ResponseFormat } from './response_parser';
import { logger } from '../utils/logger';
import { HEALTH_THRESHOLDS } from '../config';
import type { VideoSourceRow, SourceHealthRow } from '../types/database';

interface Env {
  DB: D1Database;
}

export interface SourceHealth {
  sourceId: number;
  sourceName: string;
  status: 'healthy' | 'slow' | 'error' | 'timeout' | 'unknown';
  responseTime: number;
  avgResponseTime: number;
  successRate: number;
  totalChecks: number;
  successChecks: number;
  lastError?: string;
  lastErrorAt?: number;
  consecutiveFailures: number;
  videoCount: number;
  lastCheckAt: number;
  updatedAt: number;
}

export interface HealthCheckResult {
  success: boolean;
  status: SourceHealth['status'];
  responseTime: number;
  videoCount?: number;
  error?: string;
}

// 健康状态阈值（使用配置常量）
const THRESHOLDS = HEALTH_THRESHOLDS;

/**
 * 检测单个资源站健康状态
 */
export async function checkSourceHealth(
  env: Env,
  sourceId: number,
  apiUrl: string,
  sourceName: string,
  responseFormat: ResponseFormat = 'auto'
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    // 构建测试请求URL
    const url = new URL(apiUrl);
    url.searchParams.set('ac', 'list');
    url.searchParams.set('pg', '1');
    
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(THRESHOLDS.errorResponseTime),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        success: false,
        status: 'error',
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    // 使用多格式解析器
    const parsed = await parseResponse(response, responseFormat);
    const videoCount = parsed.list?.length || 0;
    
    // 判断状态
    let status: SourceHealth['status'] = 'healthy';
    if (responseTime > THRESHOLDS.slowResponseTime) {
      status = 'slow';
    }
    
    // 更新数据库
    await updateHealthRecord(env, sourceId, sourceName, {
      success: true,
      status,
      responseTime,
      videoCount,
    });
    
    return {
      success: true,
      status,
      responseTime,
      videoCount,
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    let status: SourceHealth['status'] = 'error';
    if (errorMessage.includes('timeout') || errorMessage.includes('abort')) {
      status = 'timeout';
    }
    
    // 更新数据库
    await updateHealthRecord(env, sourceId, sourceName, {
      success: false,
      status,
      responseTime,
      error: errorMessage,
    });
    
    return {
      success: false,
      status,
      responseTime,
      error: errorMessage,
    };
  }
}

/**
 * 更新健康记录
 */
async function updateHealthRecord(
  env: Env,
  sourceId: number,
  sourceName: string,
  result: HealthCheckResult
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  
  // 获取现有记录
  const existing = await env.DB.prepare(`
    SELECT * FROM source_health WHERE source_id = ?
  `).bind(sourceId).first();
  
  if (!existing) {
    // 创建新记录
    await env.DB.prepare(`
      INSERT INTO source_health (
        source_id, source_name, last_check_at, status, response_time, avg_response_time,
        success_rate, total_checks, success_checks, last_error, last_error_at,
        consecutive_failures, video_count, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
    `).bind(
      sourceId,
      sourceName,
      now,
      result.status,
      result.responseTime,
      result.responseTime,
      result.success ? 100 : 0,
      result.success ? 1 : 0,
      result.error || null,
      result.success ? null : now,
      result.success ? 0 : 1,
      result.videoCount || 0,
      now
    ).run();
  } else {
    // 更新现有记录
    const totalChecks = (existing.total_checks as number) + 1;
    const successChecks = (existing.success_checks as number) + (result.success ? 1 : 0);
    const successRate = (successChecks / totalChecks) * 100;
    
    // 计算移动平均响应时间
    const avgResponseTime = Math.round(
      ((existing.avg_response_time as number) * 0.7) + (result.responseTime * 0.3)
    );
    
    const consecutiveFailures = result.success 
      ? 0 
      : (existing.consecutive_failures as number) + 1;
    
    // 如果连续失败次数过多，强制标记为错误
    let finalStatus = result.status;
    if (consecutiveFailures >= THRESHOLDS.maxConsecutiveFailures) {
      finalStatus = 'error';
    }
    
    await env.DB.prepare(`
      UPDATE source_health SET
        last_check_at = ?,
        status = ?,
        response_time = ?,
        avg_response_time = ?,
        success_rate = ?,
        total_checks = ?,
        success_checks = ?,
        last_error = CASE WHEN ? IS NOT NULL THEN ? ELSE last_error END,
        last_error_at = CASE WHEN ? THEN ? ELSE last_error_at END,
        consecutive_failures = ?,
        video_count = CASE WHEN ? > 0 THEN ? ELSE video_count END,
        updated_at = ?
      WHERE source_id = ?
    `).bind(
      now,
      finalStatus,
      result.responseTime,
      avgResponseTime,
      Math.round(successRate * 100) / 100,
      totalChecks,
      successChecks,
      result.error || null,
      result.error || null,
      !result.success,
      now,
      consecutiveFailures,
      result.videoCount || 0,
      result.videoCount || 0,
      now,
      sourceId
    ).run();
  }
}

/**
 * 获取所有资源站健康状态
 */
export async function getAllSourceHealth(env: Env): Promise<SourceHealth[]> {
  const result = await env.DB.prepare(`
    SELECT 
      s.id as source_id,
      s.name as source_name,
      s.api_url,
      s.is_active,
      h.status,
      h.response_time,
      h.avg_response_time,
      h.success_rate,
      h.total_checks,
      h.success_checks,
      h.last_error,
      h.last_error_at,
      h.consecutive_failures,
      h.video_count,
      h.last_check_at,
      h.updated_at
    FROM video_sources s
    LEFT JOIN source_health h ON s.id = h.source_id
    WHERE s.is_active = 1
    ORDER BY s.weight DESC
  `).all();
  
  interface SourceHealthJoinRow extends SourceHealthRow {
    api_url: string;
    is_active: number;
  }
  
  return result.results.map((row: SourceHealthJoinRow) => ({
    sourceId: row.source_id,
    sourceName: row.source_name,
    status: row.status || 'unknown',
    responseTime: row.response_time || 0,
    avgResponseTime: row.avg_response_time || 0,
    successRate: row.success_rate || 0,
    totalChecks: row.total_checks || 0,
    successChecks: row.success_checks || 0,
    lastError: row.last_error,
    lastErrorAt: row.last_error_at,
    consecutiveFailures: row.consecutive_failures || 0,
    videoCount: row.video_count || 0,
    lastCheckAt: row.last_check_at || 0,
    updatedAt: row.updated_at || 0,
  }));
}

/**
 * 获取单个资源站健康状态
 */
export async function getSourceHealth(
  env: Env,
  sourceId: number
): Promise<SourceHealth | null> {
  const result = await env.DB.prepare(`
    SELECT 
      s.id as source_id,
      s.name as source_name,
      h.*
    FROM video_sources s
    LEFT JOIN source_health h ON s.id = h.source_id
    WHERE s.id = ?
  `).bind(sourceId).first();
  
  if (!result) return null;
  
  return {
    sourceId: result.source_id as number,
    sourceName: result.source_name as string,
    status: (result.status as SourceHealth['status']) || 'unknown',
    responseTime: (result.response_time as number) || 0,
    avgResponseTime: (result.avg_response_time as number) || 0,
    successRate: (result.success_rate as number) || 0,
    totalChecks: (result.total_checks as number) || 0,
    successChecks: (result.success_checks as number) || 0,
    lastError: result.last_error as string | undefined,
    lastErrorAt: result.last_error_at as number | undefined,
    consecutiveFailures: (result.consecutive_failures as number) || 0,
    videoCount: (result.video_count as number) || 0,
    lastCheckAt: (result.last_check_at as number) || 0,
    updatedAt: (result.updated_at as number) || 0,
  };
}

/**
 * 批量检测所有资源站
 */
export async function checkAllSourcesHealth(env: Env): Promise<HealthCheckResult[]> {
  const sources = await env.DB.prepare(`
    SELECT id, name, api_url, response_format FROM video_sources WHERE is_active = 1
  `).all();
  
  const results: HealthCheckResult[] = [];
  
  for (const source of sources.results as Pick<VideoSourceRow, 'id' | 'name' | 'api_url' | 'response_format'>[]) {
    logger.healthCheck.info(`Checking ${source.name}...`);
    
    const result = await checkSourceHealth(
      env,
      source.id,
      source.api_url,
      source.name,
      source.response_format || 'auto'
    );
    
    results.push(result);
    
    // 间隔500ms避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}

/**
 * 获取健康的资源站列表（用于采集）
 */
export async function getHealthySources(env: Env): Promise<Array<{
  id: number;
  name: string;
  apiUrl: string;
  weight: number;
}>> {
  const result = await env.DB.prepare(`
    SELECT 
      s.id,
      s.name,
      s.api_url,
      s.weight
    FROM video_sources s
    LEFT JOIN source_health h ON s.id = h.source_id
    WHERE s.is_active = 1
    AND (h.status IS NULL OR h.status IN ('healthy', 'slow', 'unknown'))
    AND (h.consecutive_failures IS NULL OR h.consecutive_failures < ?)
    ORDER BY s.weight DESC
  `).bind(THRESHOLDS.maxConsecutiveFailures).all();
  
  return result.results.map((row: Pick<VideoSourceRow, 'id' | 'name' | 'api_url' | 'weight'>) => ({
    id: row.id,
    name: row.name,
    apiUrl: row.api_url,
    weight: row.weight,
  }));
}
