/**
 * 响应签名工具
 * 用于对敏感 API 响应进行签名，防止中间人篡改
 */

/**
 * 生成响应签名
 * @param data 响应数据
 * @param secretKey 签名密钥
 * @param timestamp 时间戳
 */
export async function signResponse(
  data: unknown,
  secretKey: string,
  timestamp: number
): Promise<string> {
  const dataStr = JSON.stringify(data);
  const signData = `${dataStr}|${timestamp}|${secretKey}`;
  
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(signData);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padLeft(2, '0')).join('');
  
  return hashHex;
}

/**
 * 创建带签名的响应
 */
export async function createSignedResponse(
  data: unknown,
  secretKey: string
): Promise<{
  data: unknown;
  timestamp: number;
  signature: string;
}> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await signResponse(data, secretKey, timestamp);
  
  return {
    data,
    timestamp,
    signature,
  };
}

/**
 * 验证响应签名
 */
export async function verifyResponseSignature(
  data: unknown,
  timestamp: number,
  signature: string,
  secretKey: string,
  maxAge: number = 300 // 默认 5 分钟有效期
): Promise<boolean> {
  // 检查时间戳是否过期
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > maxAge) {
    return false;
  }
  
  // 验证签名
  const expectedSignature = await signResponse(data, secretKey, timestamp);
  return signature === expectedSignature;
}

// Polyfill for padLeft
declare global {
  interface String {
    padLeft(length: number, char: string): string;
  }
}

String.prototype.padLeft = function(length: number, char: string): string {
  return char.repeat(Math.max(0, length - this.length)) + this;
};
