/**
 * 通知工具函数
 * 支持钉钉、企业微信等通知渠道
 */

import { logger } from './logger';

/**
 * 发送钉钉通知
 */
export async function sendDingTalk(webhook: string, message: string): Promise<void> {
  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msgtype: 'text',
        text: {
          content: message,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`DingTalk notification failed: ${response.statusText}`);
    }

    logger.notify.info('DingTalk notification sent successfully');
  } catch (error) {
    logger.notify.error('Failed to send DingTalk notification', { error: error instanceof Error ? error.message : 'Unknown' });
    throw error;
  }
}

/** 设备信息类型 */
interface DeviceInfo {
  platform?: string;
  version?: string;
  model?: string;
  os_version?: string;
}

/**
 * 格式化崩溃报告
 */
export function formatCrashReport(data: {
  error: string;
  stack_trace?: string;
  context?: string;
  device_info?: DeviceInfo;
  user_id?: number | null;
  timestamp?: string;
}): string {
  const { error, stack_trace, context, device_info, user_id, timestamp } = data;
  
  let message = '🚨 应用崩溃报告\n\n';
  message += `错误信息：${error}\n`;
  
  if (context) {
    message += `上下文：${context}\n`;
  }
  
  if (user_id) {
    message += `用户ID：${user_id}\n`;
  }
  
  if (device_info) {
    const platform = device_info.platform || 'Unknown';
    const version = device_info.version || 'Unknown';
    message += `设备信息：${platform} - ${version}\n`;
  }
  
  if (timestamp) {
    message += `时间：${timestamp}\n`;
  }
  
  if (stack_trace) {
    const shortStack = stack_trace.substring(0, 200);
    message += `\n堆栈跟踪：\n${shortStack}${stack_trace.length > 200 ? '...' : ''}`;
  }
  
  return message;
}

/**
 * 格式化采集任务报告
 */
export function formatCollectReport(data: {
  source_name: string;
  task_type: string;
  status: string;
  total_count: number;
  new_count: number;
  update_count: number;
  error_count: number;
  duration: number;
}): string {
  const { source_name, task_type, status, total_count, new_count, update_count, error_count, duration } = data;
  
  const statusEmoji = status === 'success' ? '✅' : '❌';
  const taskTypeText = {
    full: '全量采集',
    incremental: '增量采集',
    update: '更新采集',
  }[task_type] || task_type;
  
  let message = `${statusEmoji} 采集任务完成\n\n`;
  message += `资源站：${source_name}\n`;
  message += `任务类型：${taskTypeText}\n`;
  message += `状态：${status}\n`;
  message += `总数：${total_count}\n`;
  message += `新增：${new_count}\n`;
  message += `更新：${update_count}\n`;
  
  if (error_count > 0) {
    message += `失败：${error_count}\n`;
  }
  
  message += `耗时：${duration}秒\n`;
  message += `时间：${new Date().toLocaleString('zh-CN')}`;
  
  return message;
}
