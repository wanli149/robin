/**
 * JWT Authentication Utilities
 * 使用 Web Crypto API 实现 JWT 令牌生成和验证
 */

import { logger } from './logger';

interface JWTPayload {
  user_id: number;
  username: string;
  is_vip: boolean;
  iat: number; // issued at
  exp: number; // expiration time
}

/**
 * Base64 URL 编码
 */
function base64UrlEncode(data: ArrayBuffer | ArrayBufferLike): string {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64 URL 解码
 */
function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad) {
    str += '='.repeat(4 - pad);
  }
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 生成 HMAC-SHA256 签名
 */
async function sign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );
  
  return base64UrlEncode(signature);
}

/**
 * 生成 JWT Token
 * 
 * @param payload - JWT 载荷数据
 * @param secret - JWT 密钥
 * @param expiresIn - 过期时间（秒），默认 7 天
 * @returns JWT Token 字符串
 */
export async function generateToken(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  secret: string,
  expiresIn: number = 7 * 24 * 60 * 60 // 7 days
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)).buffer);
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(fullPayload)).buffer);
  
  const data = `${headerB64}.${payloadB64}`;
  const signature = await sign(data, secret);
  
  return `${data}.${signature}`;
}

/**
 * 验证 JWT Token
 * 
 * @param token - JWT Token 字符串
 * @param secret - JWT 密钥
 * @returns JWT 载荷数据，验证失败返回 null
 */
export async function verifyToken(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    
    // 验证签名
    const data = `${headerB64}.${payloadB64}`;
    const expectedSignature = await sign(data, secret);
    
    if (signatureB64 !== expectedSignature) {
      logger.admin.error('JWT Invalid signature');
      return null;
    }

    // 解码载荷
    const decoder = new TextDecoder();
    const payloadBytes = base64UrlDecode(payloadB64);
    const payload = JSON.parse(decoder.decode(payloadBytes)) as JWTPayload;

    // 检查过期时间
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      logger.admin.error('JWT Token expired');
      return null;
    }

    return payload;
  } catch (error) {
    logger.admin.error('JWT Verification failed', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * 从请求头中提取 JWT Token
 * 
 * @param authHeader - Authorization 请求头
 * @returns Token 字符串，未找到返回 null
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}
