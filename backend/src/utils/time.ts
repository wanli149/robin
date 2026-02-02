/**
 * Time Utilities
 * 统一的时间处理工具函数
 */

/**
 * 时间常量（秒）
 */
export const TIME_CONSTANTS = {
  SECOND: 1,
  MINUTE: 60,
  HOUR: 3600,
  DAY: 86400,
  WEEK: 604800,
  MONTH: 2592000,
  YEAR: 31536000,
} as const;

/**
 * 获取当前Unix时间戳（秒）
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 获取指定天数前的时间戳
 */
export function getDaysAgo(days: number): number {
  return getCurrentTimestamp() - days * TIME_CONSTANTS.DAY;
}

/**
 * 获取指定小时前的时间戳
 */
export function getHoursAgo(hours: number): number {
  return getCurrentTimestamp() - hours * TIME_CONSTANTS.HOUR;
}

/**
 * 获取指定分钟前的时间戳
 */
export function getMinutesAgo(minutes: number): number {
  return getCurrentTimestamp() - minutes * TIME_CONSTANTS.MINUTE;
}

/**
 * 检查时间戳是否过期
 */
export function isExpired(timestamp: number, maxAgeSeconds: number): boolean {
  return getCurrentTimestamp() - timestamp > maxAgeSeconds;
}

/**
 * 获取今天的开始时间戳
 */
export function getTodayStart(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor(now.getTime() / 1000);
}

/**
 * 获取今天的结束时间戳
 */
export function getTodayEnd(): number {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return Math.floor(now.getTime() / 1000);
}

/**
 * 格式化时间戳为ISO字符串
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * 解析ISO字符串为时间戳
 */
export function parseISOToTimestamp(isoString: string): number {
  return Math.floor(new Date(isoString).getTime() / 1000);
}
