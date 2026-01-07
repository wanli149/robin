/**
 * Robin Video Platform - Backend API
 * Main entry point
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createLogger } from './utils/logger';

const appLogger = createLogger('App');
const cronLogger = createLogger('Cron');

// Import routes
import layout from './routes/layout';
import vod from './routes/vod';
import shorts from './routes/shorts';
import types from './routes/types';
import proxy from './routes/proxy';
import auth from './routes/auth';
import system from './routes/system';
import admin from './routes/admin/index';  // 🚀 使用拆分后的 admin 模块
import share from './routes/share';
import cms from './routes/cms';
import stats from './routes/stats';
import recommend from './routes/recommend';  // 推荐系统

// Define bindings type
export type Bindings = {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
  JWT_SECRET: string;
  DINGTALK_WEBHOOK?: string;
  ADMIN_SECRET_KEY: string;
  TMDB_API_KEY?: string;
  DOUBAN_API_KEY?: string;
  // API 安全配置（可选）
  API_SECRET_KEY?: string;  // 启用 API 签名验证
  APP_PACKAGES?: string;    // 允许的 APP 包名列表（逗号分隔）
};

// Create Hono app
const app = new Hono<{ Bindings: Bindings }>();

// CORS middleware
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'Robin Video Platform API',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Import collect routes
import collect from './routes/collect';
import collectV2 from './routes/collect_v2';
import storage from './routes/storage';

// Register routes - 注意顺序很重要！
// CMS路由必须在admin和collect之前注册，避免被拦截
app.route('/', cms);          // /api.php/provide/vod (苹果CMS兼容接口，支持TVBox) - 必须最先注册
app.route('/', layout);      // /home_layout, /home_tabs
app.route('/', vod);          // /api/vod, /api/vod/detail, /api/search, /api/hot_search
app.route('/', shorts);       // /api/shorts/*
app.route('/', types);        // /api/types, /api/types/:id
app.route('/', proxy);        // /img, /video
app.route('/', auth);         // /auth/*, /user/*, /api/user/*, /api/appointment
app.route('/', system);       // /api/version, /api/config, /api/system/*, /api/feedback, /api/app_wall
app.route('/', share);        // /share/*, /api/share/*
app.route('/', stats);        // /api/stats/* (统计上报接口)
app.route('/', recommend);    // /api/recommend/* (推荐系统)
app.route('/', admin);        // /admin/* - admin路由放在后面
app.route('/', collect);      // /admin/collect/*, /api/report_invalid, /api/search_cache
app.route('/', collectV2);    // /admin/collect/v2/* - 采集引擎V2
app.route('/', storage);      // /api/storage/*, /api/progress/*, /admin/storage/* - 存储配置和进度同步

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      code: 0,
      msg: 'Not Found',
      path: c.req.path,
    },
    404
  );
});

// Error handler
app.onError((err, c) => {
  appLogger.error('Request error', { error: err.message });
  return c.json(
    {
      code: 0,
      msg: 'Internal Server Error',
      error: err.message,
    },
    500
  );
});

/**
 * Scheduled handler for Cron triggers
 * 智能任务调度：根据时间执行不同任务
 */
export async function scheduled(
  event: ScheduledEvent,
  env: Bindings,
  ctx: ExecutionContext
): Promise<void> {
  cronLogger.info('Scheduled task triggered', { cron: event.cron });

  try {
    // 使用统一的调度器
    const { runScheduledTasks } = await import('./services/scheduler');
    await runScheduledTasks(env, new Date());
    
    cronLogger.info('Scheduled task completed successfully');
  } catch (error) {
    cronLogger.error('Scheduled task failed', { error: error instanceof Error ? error.message : 'Unknown' });
    
    // 发送告警（如果配置了钉钉）
    if (env.DINGTALK_WEBHOOK) {
      try {
        await fetch(env.DINGTALK_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            msgtype: 'text',
            text: {
              content: `🚨 定时任务执行失败\n\n错误：${error instanceof Error ? error.message : 'Unknown error'}\n时间：${new Date().toLocaleString('zh-CN')}`,
            },
          }),
        });
      } catch (alertError) {
        cronLogger.error('Failed to send alert', { error: alertError instanceof Error ? alertError.message : 'Unknown' });
      }
    }
  }
}

// Export default handler
export default app;
