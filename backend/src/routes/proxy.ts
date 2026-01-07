/**
 * Image Proxy API
 * 图片代理接口，解决跨域和防盗链问题
 * 
 * 优化：
 * - 缩短超时时间（5秒）
 * - 超时/失败时返回占位图
 * - 支持重试机制
 */

import { Hono } from 'hono';
import { logger } from '../utils/logger';

type Bindings = {
  ROBIN_CACHE: KVNamespace;
};

const proxy = new Hono<{ Bindings: Bindings }>();

// 1x1 透明 PNG 占位图（Base64）
const PLACEHOLDER_PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));

/**
 * 带重试的图片获取
 */
async function fetchImageWithRetry(
  url: string,
  maxRetries: number = 2,
  timeout: number = 5000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': '',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(timeout),
      });
      
      if (response.ok) {
        return response;
      }
      
      // 4xx 错误不重试
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      lastError = new Error(`HTTP ${response.status}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('Unknown error');
      // 超时错误可以重试
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 500)); // 等待 500ms 后重试
      }
    }
  }
  
  throw lastError || new Error('Failed to fetch image');
}

/**
 * 返回占位图响应
 */
function placeholderResponse(): Response {
  return new Response(PLACEHOLDER_PNG, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=60', // 短缓存，便于重试
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * GET /img
 * 代理图片请求
 * 
 * Query params:
 * - url: 图片 URL（必需）
 * 
 * 优化：
 * - 5秒超时（快速失败）
 * - 自动重试 1 次
 * - 失败时返回透明占位图（避免页面显示错误图标）
 */
proxy.get('/img', async (c) => {
  const url = c.req.query('url');

  if (!url) {
    return placeholderResponse();
  }

  // 验证 URL 格式
  let imageUrl: URL;
  try {
    imageUrl = new URL(url);
  } catch {
    return placeholderResponse();
  }

  try {
    const response = await fetchImageWithRetry(imageUrl.toString(), 2, 5000);
    
    // 获取图片内容
    const imageData = await response.arrayBuffer();
    const contentType = response.headers.get('Content-Type') || 'image/jpeg';

    // 返回图片，设置长期缓存
    return new Response(imageData, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // 1 年
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    // 静默失败，返回占位图
    logger.vod.warn('Image proxy failed', { hostname: imageUrl.hostname, error: error instanceof Error ? error.message : '' });
    return placeholderResponse();
  }
});

/**
 * GET /video
 * 代理视频请求（支持 Range 请求）
 * 
 * Query params:
 * - url: 视频 URL（必需）
 */
proxy.get('/video', async (c) => {
  try {
    const url = c.req.query('url');

    if (!url) {
      return c.json({ error: 'Missing required parameter: url' }, 400);
    }

    // 验证 URL 格式
    let videoUrl: URL;
    try {
      videoUrl = new URL(url);
    } catch {
      return c.json({ error: 'Invalid URL format' }, 400);
    }

    // 获取客户端的 Range 请求头
    const range = c.req.header('Range');

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': '',
    };

    if (range) {
      headers['Range'] = range;
    }

    // 代理请求视频（30秒超时）
    const response = await fetch(videoUrl.toString(), {
      headers,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      logger.vod.error('Video fetch failed', { status: response.status });
      return c.json({ error: 'Failed to fetch video', status: response.status }, 502);
    }

    // 构建响应头
    const responseHeaders: Record<string, string> = {
      'Content-Type': response.headers.get('Content-Type') || 'video/mp4',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    };

    // 转发 Range 相关头
    const contentRange = response.headers.get('Content-Range');
    const contentLength = response.headers.get('Content-Length');
    const acceptRanges = response.headers.get('Accept-Ranges');

    if (contentRange) responseHeaders['Content-Range'] = contentRange;
    if (contentLength) responseHeaders['Content-Length'] = contentLength;
    if (acceptRanges) responseHeaders['Accept-Ranges'] = acceptRanges;

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    logger.vod.error('Video proxy error', { error: error instanceof Error ? error.message : String(error) });
    
    if (error instanceof Error && error.name === 'TimeoutError') {
      return c.json({ error: 'Video fetch timeout' }, 504);
    }

    return c.json({
      error: 'Failed to proxy video',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default proxy;
