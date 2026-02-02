/**
 * 统一响应格式类型定义
 * 
 * 所有API接口必须遵循此格式规范
 */

/**
 * 分页元数据
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * 基础响应格式
 */
export interface BaseResponse<T = unknown, M = Record<string, unknown>> {
  code: 1 | 0;  // 1=成功, 0=失败
  msg: string;
  data?: T;     // 业务数据
  meta?: M;     // 元数据（分页、统计等）
  error?: string; // 错误详情（仅失败时）
}

/**
 * 成功响应
 */
export interface SuccessResponse<T = unknown, M = Record<string, unknown>> {
  code: 1;
  msg: string;
  data: T;
  meta?: M;
}

/**
 * 失败响应
 */
export interface ErrorResponse {
  code: 0;
  msg: string;
  error?: string;
}

/**
 * 列表响应（带分页）
 */
export interface ListResponse<T = unknown> extends SuccessResponse<T[], PaginationMeta> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * 简单列表响应（无分页）
 */
export interface SimpleListResponse<T = unknown> extends SuccessResponse<T[]> {
  data: T[];
}

/**
 * 详情响应
 */
export interface DetailResponse<T = unknown> extends SuccessResponse<T> {
  data: T;
}

/**
 * 响应构建器
 */
export class ResponseBuilder {
  /**
   * 构建成功响应
   */
  static success<T = unknown, M = Record<string, unknown>>(
    data: T,
    meta?: M,
    msg: string = 'success'
  ): SuccessResponse<T, M> {
    const response: SuccessResponse<T, M> = {
      code: 1,
      msg,
      data,
    };
    if (meta) {
      response.meta = meta;
    }
    return response;
  }

  /**
   * 构建失败响应
   */
  static error(msg: string, error?: string): ErrorResponse {
    const response: ErrorResponse = {
      code: 0,
      msg,
    };
    if (error) {
      response.error = error;
    }
    return response;
  }

  /**
   * 构建列表响应（带分页）
   */
  static list<T = unknown>(
    data: T[],
    pagination: PaginationMeta,
    msg: string = 'success'
  ): ListResponse<T> {
    return {
      code: 1,
      msg,
      data,
      meta: pagination,
    };
  }

  /**
   * 构建简单列表响应（无分页）
   */
  static simpleList<T = unknown>(
    data: T[],
    msg: string = 'success'
  ): SimpleListResponse<T> {
    return {
      code: 1,
      msg,
      data,
    };
  }

  /**
   * 构建详情响应
   */
  static detail<T = unknown>(
    data: T,
    msg: string = 'success'
  ): DetailResponse<T> {
    return {
      code: 1,
      msg,
      data,
    };
  }
}
