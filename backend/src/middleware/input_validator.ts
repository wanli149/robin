/**
 * Input Validation Middleware
 * 输入验证中间件，使用 Zod 进行类型安全的验证
 */

import { Context, Next } from 'hono';
import { createLogger } from '../utils/logger';

const logger = createLogger('InputValidator');

// 简化的 Zod 实现（避免引入外部依赖）
interface ValidationSchema {
  parse(data: any): any;
  safeParse(data: any): { success: boolean; data?: any; error?: any };
}

class SimpleValidator {
  private rules: Array<(value: any) => string | null> = [];
  private defaultValue?: any;
  private isOptional = false;

  static string() {
    return new SimpleValidator().addRule((value) => {
      if (typeof value !== 'string') return 'Expected string';
      return null;
    });
  }

  static number() {
    return new SimpleValidator().addRule((value) => {
      const num = Number(value);
      if (isNaN(num)) return 'Expected number';
      return null;
    });
  }

  static coerce = {
    number: () => new SimpleValidator().addRule((value) => {
      const num = Number(value);
      if (isNaN(num)) return 'Expected number';
      return null;
    }).transform((value) => Number(value))
  };

  private transformFn?: (value: any) => any;

  private addRule(rule: (value: any) => string | null) {
    this.rules.push(rule);
    return this;
  }

  min(minValue: number) {
    return this.addRule((value) => {
      const val = typeof value === 'string' ? value.length : Number(value);
      if (val < minValue) return `Minimum value is ${minValue}`;
      return null;
    });
  }

  max(maxValue: number) {
    return this.addRule((value) => {
      const val = typeof value === 'string' ? value.length : Number(value);
      if (val > maxValue) return `Maximum value is ${maxValue}`;
      return null;
    });
  }

  int() {
    return this.addRule((value) => {
      const num = Number(value);
      if (!Number.isInteger(num)) return 'Expected integer';
      return null;
    });
  }

  default(value: any) {
    this.defaultValue = value;
    return this;
  }

  optional() {
    this.isOptional = true;
    return this;
  }

  transform(fn: (value: any) => any) {
    this.transformFn = fn;
    return this;
  }

  parse(value: any): any {
    if (value === undefined || value === null || value === '') {
      if (this.isOptional) {
        return this.defaultValue;
      }
      if (this.defaultValue !== undefined) {
        return this.defaultValue;
      }
      throw new Error('Required field is missing');
    }

    for (const rule of this.rules) {
      const error = rule(value);
      if (error) {
        throw new Error(error);
      }
    }

    return this.transformFn ? this.transformFn(value) : value;
  }

  safeParse(value: any): { success: boolean; data?: any; error?: any } {
    try {
      const data = this.parse(value);
      return { success: true, data };
    } catch (error) {
      return { success: false, error };
    }
  }
}

class ObjectValidator {
  constructor(private schema: Record<string, SimpleValidator>) {}

  parse(data: any): any {
    const result: any = {};
    const errors: string[] = [];

    for (const [key, validator] of Object.entries(this.schema)) {
      try {
        result[key] = validator.parse(data[key]);
      } catch (error) {
        errors.push(`${key}: ${error instanceof Error ? error.message : 'Invalid'}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    return result;
  }

  safeParse(data: any): { success: boolean; data?: any; error?: any } {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
}

// 简化的 z 对象
const z = {
  string: () => SimpleValidator.string(),
  number: () => SimpleValidator.number(),
  coerce: SimpleValidator.coerce,
  object: (schema: Record<string, SimpleValidator>) => new ObjectValidator(schema)
};

/**
 * 预定义的验证模式
 */
export const ValidationSchemas = {
  // 分页参数验证
  pagination: z.object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pg: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  }),

  // 搜索参数验证
  search: z.object({
    wd: z.string().min(1).max(100),
    pg: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20)
  }),

  // 视频列表参数验证
  vodList: z.object({
    t: z.coerce.number().int().min(0).optional(),
    pg: z.coerce.number().int().min(1).max(1000).default(1),
    area: z.string().max(50).optional(),
    year: z.string().max(10).optional(),
    sort: z.string().max(20).optional(),
    ids: z.string().max(1000).optional(),
    wd: z.string().max(100).optional()
  }),

  // 视频详情参数验证
  vodDetail: z.object({
    ids: z.string().min(1).max(1000)
  }),

  // 类型参数验证
  typeParams: z.object({
    id: z.coerce.number().int().min(1),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sub_type: z.string().max(50).optional()
  }),

  // 短视频参数验证
  shorts: z.object({
    category: z.string().max(50).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20)
  }),

  // 管理员参数验证
  adminList: z.object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    keyword: z.string().max(100).optional(),
    type_id: z.coerce.number().int().min(0).optional(),
    status: z.string().max(20).optional()
  })
};

/**
 * 创建输入验证中间件
 */
export function validateQuery(schema: ValidationSchema) {
  return async function inputValidator(c: Context, next: Next): Promise<Response | void> {
    try {
      // 获取查询参数
      const queryParams: Record<string, string> = {};
      const url = new URL(c.req.url);
      
      for (const [key, value] of url.searchParams.entries()) {
        queryParams[key] = value;
      }

      // 验证参数
      const result = schema.safeParse(queryParams);
      
      if (!result.success) {
        logger.warn('Input validation failed', { 
          path: c.req.path,
          params: queryParams,
          error: result.error instanceof Error ? result.error.message : 'Validation failed'
        });
        
        return c.json({
          code: 0,
          msg: 'Invalid parameters',
          details: result.error instanceof Error ? result.error.message : 'Validation failed'
        }, 400);
      }

      // 将验证后的参数存储到上下文中
      c.set('validatedQuery', result.data);
      
      await next();
    } catch (error) {
      logger.error('Input validator error', { 
        error: error instanceof Error ? error.message : 'Unknown',
        path: c.req.path
      });
      
      return c.json({
        code: 0,
        msg: 'Parameter validation error'
      }, 400);
    }
  };
}

/**
 * 创建请求体验证中间件
 */
export function validateBody(schema: ValidationSchema) {
  return async function bodyValidator(c: Context, next: Next): Promise<Response | void> {
    try {
      // 获取请求体
      const body = await c.req.json().catch(() => ({}));

      // 验证请求体
      const result = schema.safeParse(body);
      
      if (!result.success) {
        logger.warn('Body validation failed', { 
          path: c.req.path,
          error: result.error instanceof Error ? result.error.message : 'Validation failed'
        });
        
        return c.json({
          code: 0,
          msg: 'Invalid request body',
          details: result.error instanceof Error ? result.error.message : 'Validation failed'
        }, 400);
      }

      // 将验证后的数据存储到上下文中
      c.set('validatedBody', result.data);
      
      await next();
    } catch (error) {
      logger.error('Body validator error', { 
        error: error instanceof Error ? error.message : 'Unknown',
        path: c.req.path
      });
      
      return c.json({
        code: 0,
        msg: 'Request body validation error'
      }, 400);
    }
  };
}

/**
 * 获取验证后的查询参数
 */
export function getValidatedQuery<T = any>(c: Context): T {
  return c.get('validatedQuery') as T;
}

/**
 * 获取验证后的请求体
 */
export function getValidatedBody<T = any>(c: Context): T {
  return c.get('validatedBody') as T;
}

/**
 * 通用参数清理函数
 */
export function sanitizeString(str: string, maxLength: number = 1000): string {
  if (typeof str !== 'string') return '';
  
  return str
    .trim()
    .slice(0, maxLength)
    .replace(/[<>'"&]/g, '') // 移除潜在的XSS字符
    .replace(/\0/g, ''); // 移除null字节
}

/**
 * 验证和清理数字参数
 */
export function sanitizeNumber(
  value: any, 
  min: number = 1, 
  max: number = Number.MAX_SAFE_INTEGER, 
  defaultValue: number = min
): number {
  const num = parseInt(String(value), 10);
  
  if (isNaN(num) || num < min || num > max) {
    return defaultValue;
  }
  
  return num;
}

/**
 * 批量验证和清理查询参数的辅助函数
 */
export function sanitizeQueryParams(c: Context): {
  page: number;
  limit: number;
  keyword?: string;
  type_id?: number;
} {
  const page = sanitizeNumber(c.req.query('page') || c.req.query('pg'), 1, 10000, 1);
  const limit = sanitizeNumber(c.req.query('limit'), 1, 100, 20);
  const keyword = c.req.query('keyword');
  const type_id = c.req.query('type_id') ? sanitizeNumber(c.req.query('type_id'), 0) : undefined;

  return {
    page,
    limit,
    keyword: keyword ? sanitizeString(keyword, 100) : undefined,
    type_id
  };
}