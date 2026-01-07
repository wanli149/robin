/**
 * Admin API - 主入口
 * 聚合所有子模块，统一导出
 * 
 * 子模块结构：
 * - dashboard.ts  仪表板和统计
 * - layout.ts     布局管理
 * - ads.ts        广告管理
 * - topics.ts     专题管理
 * - config.ts     系统配置
 * - videos.ts     视频管理
 * - sources.ts    资源站管理
 * - shorts.ts     短剧管理
 * - categories.ts 分类管理
 * - collect.ts    采集管理（文章、演员）
 * - system.ts     系统管理（版本、缓存、去重等）
 * - misc.ts       其他功能（反馈、应用墙、热搜）
 */

import { Hono } from 'hono';
import { adminGuard } from '../../middleware/admin_guard';
import type { Bindings } from './types';

// 导入子模块
import dashboard from './dashboard';
import layout from './layout';
import ads from './ads';
import topics from './topics';
import config from './config';
import videos from './videos';
import sources from './sources';
import shorts from './shorts';
import categories from './categories';
import collect from './collect';
import system from './system';
import misc from './misc';
import scheduler from './scheduler';
import domains from './domains';
import announcements from './announcements';
import security from './security';

const admin = new Hono<{ Bindings: Bindings }>();

// 应用 Admin Guard 中间件到所有 /admin 路由
admin.use('/admin/*', adminGuard);

// 注册子模块路由
admin.route('/', dashboard);
admin.route('/', layout);
admin.route('/', ads);
admin.route('/', topics);
admin.route('/', config);
admin.route('/', videos);
admin.route('/', sources);
admin.route('/', shorts);
admin.route('/', categories);
admin.route('/', collect);
admin.route('/', system);
admin.route('/', misc);
admin.route('/', scheduler);
admin.route('/', domains);
admin.route('/', announcements);
admin.route('/', security);

export default admin;

// 导出布局预热函数供其他模块使用
export { warmupLayoutCache } from './layout';
