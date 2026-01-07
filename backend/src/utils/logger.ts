/**
 * 结构化日志工具
 * 替代 console.log，提供统一的日志格式和级别控制
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

// 日志级别优先级
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// 当前日志级别（可通过环境变量配置）
// 生产环境默认 info，开发环境默认 debug
// 在 Cloudflare Workers 环境中，使用 info 作为默认级别
const currentLevel: LogLevel = 'info';

/**
 * 检查是否应该输出该级别的日志
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

/**
 * 格式化日志输出
 */
function formatLog(entry: LogEntry): string {
  const { level, module, message, timestamp, data } = entry;
  const prefix = `[${module}]`;
  
  if (data && Object.keys(data).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  }
  return `${prefix} ${message}`;
}

/**
 * 输出日志
 */
function log(level: LogLevel, module: string, message: string, data?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  
  const entry: LogEntry = {
    level,
    module,
    message,
    timestamp: new Date().toISOString(),
    data,
  };
  
  const formatted = formatLog(entry);
  
  switch (level) {
    case 'debug':
      console.debug(formatted);
      break;
    case 'info':
      console.log(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }
}

/**
 * 创建模块专用的 logger
 */
export function createLogger(module: string) {
  return {
    debug: (message: string, data?: Record<string, unknown>) => log('debug', module, message, data),
    info: (message: string, data?: Record<string, unknown>) => log('info', module, message, data),
    warn: (message: string, data?: Record<string, unknown>) => log('warn', module, message, data),
    error: (message: string, data?: Record<string, unknown>) => log('error', module, message, data),
  };
}

// 预定义的模块 logger
export const logger = {
  scheduler: createLogger('Scheduler'),
  collector: createLogger('Collector'),
  collectorV2: createLogger('CollectorV2'),
  aggregator: createLogger('Aggregator'),
  validator: createLogger('Validator'),
  rating: createLogger('Rating'),
  recommend: createLogger('Recommend'),
  recommendV2: createLogger('RecommendV2'),
  metadata: createLogger('Metadata'),
  hits: createLogger('Hits'),
  healthCheck: createLogger('HealthCheck'),
  taskManager: createLogger('TaskManager'),
  notify: createLogger('Notify'),
  stats: createLogger('Stats'),
  search: createLogger('Search'),
  vod: createLogger('VOD'),
  shorts: createLogger('Shorts'),
  admin: createLogger('Admin'),
  dedup: createLogger('Dedup'),
  classify: createLogger('Classify'),
  repair: createLogger('Repair'),
  adInjector: createLogger('AdInjector'),
  articleCollector: createLogger('ArticleCollector'),
  actorManager: createLogger('ActorManager'),
  actorCollector: createLogger('ActorCollector'),
  collectLogger: createLogger('CollectLogger'),
  migration: createLogger('Migration'),
};

export default logger;
