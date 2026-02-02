/**
 * 采集引擎性能监控脚本
 * 用于监控采集质量和性能指标
 */

import type { SourceDistributionRow, TypeDistributionRow } from '../types/database';
import { logger } from '../utils/logger';

interface Env {
  DB: D1Database;
}

interface CollectorMetrics {
  // 基础统计
  totalVideos: number;
  validVideos: number;
  invalidVideos: number;
  
  // 质量统计
  avgQualityScore: number;
  excellentCount: number;  // 80+
  goodCount: number;       // 60-79
  fairCount: number;       // 40-59
  poorCount: number;       // <40
  
  // 采集统计
  todayNew: number;
  todayUpdated: number;
  weekNew: number;
  
  // 任务统计
  totalTasks: number;
  successTasks: number;
  failedTasks: number;
  avgDuration: number;
  avgSuccessRate: number;
  
  // 数据源统计
  sourceDistribution: Record<string, number>;
  
  // 分类统计
  typeDistribution: Record<string, number>;
}

/**
 * 获取采集引擎性能指标
 */
export async function getCollectorMetrics(env: Env): Promise<CollectorMetrics> {
  const now = getCurrentTimestamp();
  const oneDayAgo = getDaysAgo(1);
  const oneWeekAgo = getDaysAgo(7);
  
  // 1. 基础统计
  const totalResult = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM vod_cache
  `).first();
  
  const validResult = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM vod_cache WHERE is_valid = 1
  `).first();
  
  const invalidResult = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM vod_cache WHERE is_valid = 0
  `).first();
  
  // 2. 质量统计
  const qualityResult = await env.DB.prepare(`
    SELECT AVG(quality_score) as avg_score FROM vod_cache
  `).first();
  
  const qualityDistribution = await env.DB.prepare(`
    SELECT 
      SUM(CASE WHEN quality_score >= 80 THEN 1 ELSE 0 END) as excellent,
      SUM(CASE WHEN quality_score >= 60 AND quality_score < 80 THEN 1 ELSE 0 END) as good,
      SUM(CASE WHEN quality_score >= 40 AND quality_score < 60 THEN 1 ELSE 0 END) as fair,
      SUM(CASE WHEN quality_score < 40 THEN 1 ELSE 0 END) as poor
    FROM vod_cache
  `).first();
  
  // 3. 采集统计
  const todayNewResult = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM vod_cache WHERE created_at > ?
  `).bind(oneDayAgo).first();
  
  const todayUpdatedResult = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM vod_cache WHERE updated_at > ? AND created_at <= ?
  `).bind(oneDayAgo, oneDayAgo).first();
  
  const weekNewResult = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM vod_cache WHERE created_at > ?
  `).bind(oneWeekAgo).first();
  
  // 4. 任务统计
  const taskStatsResult = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      AVG(duration) as avg_duration
    FROM collect_tasks
  `).first();
  
  const successRate = taskStatsResult && (taskStatsResult.total as number) > 0
    ? ((taskStatsResult.success as number) / (taskStatsResult.total as number)) * 100
    : 0;
  
  // 5. 数据源统计
  const sourceResult = await env.DB.prepare(`
    SELECT source_name, COUNT(*) as count
    FROM vod_cache
    GROUP BY source_name
    ORDER BY count DESC
  `).all();
  
  const sourceDistribution: Record<string, number> = {};
  (sourceResult.results as SourceDistributionRow[]).forEach((row) => {
    sourceDistribution[row.source_name] = row.count;
  });
  
  // 6. 分类统计
  const typeResult = await env.DB.prepare(`
    SELECT type_name, COUNT(*) as count
    FROM vod_cache
    GROUP BY type_name
    ORDER BY count DESC
  `).all();
  
  const typeDistribution: Record<string, number> = {};
  (typeResult.results as TypeDistributionRow[]).forEach((row) => {
    typeDistribution[row.type_name] = row.count;
  });
  
  return {
    totalVideos: (totalResult?.count as number) || 0,
    validVideos: (validResult?.count as number) || 0,
    invalidVideos: (invalidResult?.count as number) || 0,
    
    avgQualityScore: Math.round((qualityResult?.avg_score as number) || 0),
    excellentCount: (qualityDistribution?.excellent as number) || 0,
    goodCount: (qualityDistribution?.good as number) || 0,
    fairCount: (qualityDistribution?.fair as number) || 0,
    poorCount: (qualityDistribution?.poor as number) || 0,
    
    todayNew: (todayNewResult?.count as number) || 0,
    todayUpdated: (todayUpdatedResult?.count as number) || 0,
    weekNew: (weekNewResult?.count as number) || 0,
    
    totalTasks: (taskStatsResult?.total as number) || 0,
    successTasks: (taskStatsResult?.success as number) || 0,
    failedTasks: (taskStatsResult?.failed as number) || 0,
    avgDuration: Math.round((taskStatsResult?.avg_duration as number) || 0),
    avgSuccessRate: Math.round(successRate * 100) / 100,
    
    sourceDistribution,
    typeDistribution,
  };
}

/**
 * 生成监控报告
 */
export function generateReport(metrics: CollectorMetrics): string {
  const report = `
📊 采集引擎性能监控报告
========================

📈 基础统计
-----------
总视频数：${metrics.totalVideos.toLocaleString()}
有效视频：${metrics.validVideos.toLocaleString()} (${((metrics.validVideos / metrics.totalVideos) * 100).toFixed(1)}%)
失效视频：${metrics.invalidVideos.toLocaleString()} (${((metrics.invalidVideos / metrics.totalVideos) * 100).toFixed(1)}%)

⭐ 数据质量
-----------
平均质量分：${metrics.avgQualityScore}/110
优秀(80+)：${metrics.excellentCount.toLocaleString()} (${((metrics.excellentCount / metrics.totalVideos) * 100).toFixed(1)}%)
良好(60-79)：${metrics.goodCount.toLocaleString()} (${((metrics.goodCount / metrics.totalVideos) * 100).toFixed(1)}%)
一般(40-59)：${metrics.fairCount.toLocaleString()} (${((metrics.fairCount / metrics.totalVideos) * 100).toFixed(1)}%)
较差(<40)：${metrics.poorCount.toLocaleString()} (${((metrics.poorCount / metrics.totalVideos) * 100).toFixed(1)}%)

🔄 采集统计
-----------
今日新增：${metrics.todayNew.toLocaleString()}
今日更新：${metrics.todayUpdated.toLocaleString()}
本周新增：${metrics.weekNew.toLocaleString()}

📋 任务统计
-----------
总任务数：${metrics.totalTasks}
成功任务：${metrics.successTasks}
失败任务：${metrics.failedTasks}
平均耗时：${metrics.avgDuration}秒
成功率：${metrics.avgSuccessRate}%

📦 数据源分布
-------------
${Object.entries(metrics.sourceDistribution)
  .map(([source, count]) => `${source}: ${count.toLocaleString()}`)
  .join('\n')}

🎬 分类分布
-----------
${Object.entries(metrics.typeDistribution)
  .map(([type, count]) => `${type}: ${count.toLocaleString()}`)
  .join('\n')}

========================
生成时间：${new Date().toLocaleString('zh-CN')}
`;
  
  return report;
}

/**
 * 检查健康状态
 */
export function checkHealth(metrics: CollectorMetrics): {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
} {
  const issues: string[] = [];
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  
  // 检查有效率
  const validRate = (metrics.validVideos / metrics.totalVideos) * 100;
  if (validRate < 80) {
    issues.push(`有效视频率过低: ${validRate.toFixed(1)}% (建议 > 80%)`);
    status = 'warning';
  }
  if (validRate < 60) {
    status = 'critical';
  }
  
  // 检查平均质量分
  if (metrics.avgQualityScore < 60) {
    issues.push(`平均质量分过低: ${metrics.avgQualityScore} (建议 > 60)`);
    status = status === 'critical' ? 'critical' : 'warning';
  }
  if (metrics.avgQualityScore < 40) {
    status = 'critical';
  }
  
  // 检查任务成功率
  if (metrics.avgSuccessRate < 80) {
    issues.push(`任务成功率过低: ${metrics.avgSuccessRate}% (建议 > 80%)`);
    status = status === 'critical' ? 'critical' : 'warning';
  }
  if (metrics.avgSuccessRate < 60) {
    status = 'critical';
  }
  
  // 检查今日新增
  if (metrics.todayNew === 0) {
    issues.push('今日无新增视频，可能采集任务未运行');
    status = status === 'critical' ? 'critical' : 'warning';
  }
  
  return { status, issues };
}

/**
 * 发送钉钉告警（如果配置了）
 */
export async function sendDingTalkAlert(
  webhook: string,
  metrics: CollectorMetrics,
  health: { status: string; issues: string[] }
): Promise<void> {
  if (!webhook || health.status === 'healthy') {
    return;
  }
  
  const emoji = health.status === 'critical' ? '🚨' : '⚠️';
  const title = `${emoji} 采集引擎${health.status === 'critical' ? '严重' : ''}告警`;
  
  const message = {
    msgtype: 'markdown',
    markdown: {
      title,
      text: `### ${title}\n\n` +
        `**问题列表：**\n${health.issues.map(issue => `- ${issue}`).join('\n')}\n\n` +
        `**基础指标：**\n` +
        `- 总视频数：${metrics.totalVideos.toLocaleString()}\n` +
        `- 有效率：${((metrics.validVideos / metrics.totalVideos) * 100).toFixed(1)}%\n` +
        `- 平均质量分：${metrics.avgQualityScore}/110\n` +
        `- 任务成功率：${metrics.avgSuccessRate}%\n\n` +
        `**时间：** ${new Date().toLocaleString('zh-CN')}`,
    },
  };
  
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  } catch (error) {
    logger.notify.error('Failed to send DingTalk alert', { error: error instanceof Error ? error.message : 'Unknown' });
  }
}
