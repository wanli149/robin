/**
 * 前端日志工具
 * 统一管理日志输出，便于生产环境控制
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// 生产环境只输出 warn 和 error
const currentLevel: LogLevel = import.meta.env.PROD ? 'warn' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function createLogger(module: string) {
  const prefix = `[${module}]`;
  
  return {
    debug: (message: string, ...args: unknown[]) => {
      if (shouldLog('debug')) console.debug(prefix, message, ...args);
    },
    info: (message: string, ...args: unknown[]) => {
      if (shouldLog('info')) console.log(prefix, message, ...args);
    },
    warn: (message: string, ...args: unknown[]) => {
      if (shouldLog('warn')) console.warn(prefix, message, ...args);
    },
    error: (message: string, ...args: unknown[]) => {
      if (shouldLog('error')) console.error(prefix, message, ...args);
    },
  };
}

export const logger = {
  api: createLogger('API'),
  app: createLogger('App'),
};

export default logger;
