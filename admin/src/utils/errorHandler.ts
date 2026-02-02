/**
 * Error Handler Utilities
 * 统一的错误处理工具
 */

import { logger } from './logger';

/**
 * 从错误对象中提取错误消息
 */
export function getErrorMessage(error: unknown, defaultMessage = '操作失败'): string {
  if (error instanceof Error) {
    return error.message || defaultMessage;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  // 处理 Ant Design Form 的验证错误
  if (error && typeof error === 'object' && 'errorFields' in error) {
    return '表单验证失败';
  }
  
  return defaultMessage;
}

/**
 * 记录并返回错误消息
 */
export function handleError(
  error: unknown,
  context: string,
  defaultMessage = '操作失败'
): string {
  const message = getErrorMessage(error, defaultMessage);
  logger.error(`[${context}]`, error);
  return message;
}

/**
 * 检查是否为表单验证错误
 */
export function isFormValidationError(error: unknown): boolean {
  return error !== null && 
         typeof error === 'object' && 
         'errorFields' in error;
}
