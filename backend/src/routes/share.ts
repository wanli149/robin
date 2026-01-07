/**
 * Share Routes
 * 分享功能路由
 */

import { Hono } from 'hono';
import { logger } from '../utils/logger';

type Bindings = {
  DB: D1Database;
  ROBIN_CACHE: KVNamespace;
};

const share = new Hono<{ Bindings: Bindings }>();

/**
 * GET /share/:type/:id
 * 分享落地页（H5页面）
 * 
 * 参数：
 * - type: 分享类型 (video, shorts, topic)
 * - id: 内容ID
 */
share.get('/share/:type/:id', async (c) => {
  const type = c.req.param('type');
  const id = c.req.param('id');
  
  try {
    let title = '拾光影视';
    let description = '精彩影视，尽在掌握';
    let coverImage = '';
    let downloadUrl = '';
    
    // 获取下载链接配置
    const downloadConfig = await c.env.DB.prepare(`
      SELECT value FROM system_config WHERE key = 'app_download_url'
    `).first();
    downloadUrl = downloadConfig?.value as string || 'https://robin.com/download';
    
    // 根据类型获取内容信息
    if (type === 'video') {
      const video = await c.env.DB.prepare(`
        SELECT vod_name, vod_pic, vod_content FROM vod_cache WHERE vod_id = ?
      `).bind(id).first();
      
      if (video) {
        title = video.vod_name as string;
        description = (video.vod_content as string)?.substring(0, 100) || '精彩影视，尽在掌握';
        coverImage = video.vod_pic as string;
      }
    } else if (type === 'shorts') {
      // 短剧数据现在存储在 vod_cache（type_id=5）
      const shorts = await c.env.DB.prepare(`
        SELECT vod_name, vod_pic_thumb, shorts_category FROM vod_cache WHERE vod_id = ? AND type_id = 5
      `).bind(id).first();
      
      if (shorts) {
        title = shorts.vod_name as string;
        description = `${shorts.shorts_category || '短剧'} - 精彩短剧，一刷到底`;
        coverImage = shorts.vod_pic_thumb as string;
      }
    } else if (type === 'topic') {
      const topic = await c.env.DB.prepare(`
        SELECT title, description, cover_img FROM topics WHERE id = ?
      `).bind(id).first();
      
      if (topic) {
        title = topic.title as string;
        description = topic.description as string || '精选专题，不容错过';
        coverImage = topic.cover_img as string || '';
      }
    }
    
    // 生成分享落地页 HTML
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title} - 拾光影视</title>
  <meta name="description" content="${description}">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px 30px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .cover {
      width: 200px;
      height: 280px;
      margin: 0 auto 30px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    h1 {
      font-size: 24px;
      color: #333;
      margin-bottom: 15px;
      font-weight: 600;
    }
    .description {
      font-size: 14px;
      color: #666;
      line-height: 1.6;
      margin-bottom: 30px;
    }
    .download-btn {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 40px;
      border-radius: 50px;
      text-decoration: none;
      font-size: 16px;
      font-weight: 600;
      box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .download-btn:active {
      transform: translateY(2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }
    .tip {
      margin-top: 20px;
      font-size: 12px;
      color: #999;
    }
    .logo {
      font-size: 32px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🎬</div>
    ${coverImage ? `
    <div class="cover">
      <img src="${coverImage}" alt="${title}">
    </div>
    ` : ''}
    <h1>${title}</h1>
    <p class="description">${description}</p>
    <a href="${downloadUrl}" class="download-btn">下载拾光影视 APP</a>
    <p class="tip">下载 APP 即可观看完整内容</p>
  </div>
  
  <script>
    // 尝试唤起 APP
    const appScheme = 'robin://${type}/${id}';
    window.location.href = appScheme;
    
    // 如果 2 秒后还在页面，说明没有安装 APP
    setTimeout(() => {
      // 用户可以选择下载
    }, 2000);
  </script>
</body>
</html>
    `;
    
    return c.html(html);
  } catch (error) {
    logger.vod.error('Share error', { error: error instanceof Error ? error.message : String(error) });
    return c.html(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>分享失败 - 拾光影视</title>
</head>
<body>
  <h1>分享内容不存在</h1>
  <p>该内容可能已被删除或不存在</p>
</body>
</html>
    `, 404);
  }
});

/**
 * GET /api/share/config
 * 获取分享配置
 */
share.get('/api/share/config', async (c) => {
  try {
    const config = await c.env.DB.prepare(`
      SELECT key, value FROM system_config 
      WHERE key IN ('app_download_url', 'share_title', 'share_description')
    `).all();
    
    const result: Record<string, string> = {};
    for (const row of config.results) {
      result[row.key as string] = row.value as string;
    }
    
    return c.json({
      code: 1,
      msg: 'success',
      data: {
        download_url: result.app_download_url || 'https://robin.com/download',
        share_title: result.share_title || '拾光影视 - 精彩影视，尽在掌握',
        share_description: result.share_description || '海量影视资源，高清流畅播放',
      },
    });
  } catch (error) {
    logger.vod.error('Get share config error', { error: error instanceof Error ? error.message : String(error) });
    return c.json(
      {
        code: 0,
        msg: 'Failed to get share config',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default share;
