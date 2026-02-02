/**
 * Qiniu Cloud Storage Adapter
 * 七牛云存储适配器
 */

import { BaseStorageAdapter } from './base';
import type { ConnectionTestResult, ImageStorageConfig } from '../types';
import { getCurrentTimestamp, TIME_CONSTANTS } from '../../../utils/time';
import { QINIU_ZONES } from '../../../config';

export class QiniuAdapter extends BaseStorageAdapter {
  private zone: { up: string; rs: string; rsf: string } = QINIU_ZONES.z0;

  async initialize(config: ImageStorageConfig): Promise<void> {
    await super.initialize(config);
    
    // 设置区域
    const zoneKey = config.qiniu_zone || 'z0';
    this.zone = QINIU_ZONES[zoneKey] || QINIU_ZONES.z0;
  }

  /**
   * 生成七牛上传凭证
   */
  private async generateUploadToken(key: string): Promise<string> {
    this.ensureInitialized();
    
    const accessKey = this.config!.access_key!;
    const secretKey = this.config!.secret_key!;
    const bucket = this.config!.bucket_name!;
    
    // 上传策略
    const putPolicy = {
      scope: `${bucket}:${key}`,
      deadline: getCurrentTimestamp() + TIME_CONSTANTS.HOUR,
    };
    
    const encodedPolicy = this.base64UrlSafe(JSON.stringify(putPolicy));
    const sign = await this.hmacSha1(encodedPolicy, secretKey);
    const encodedSign = this.base64UrlSafe(sign);
    
    return `${accessKey}:${encodedSign}:${encodedPolicy}`;
  }

  /**
   * 生成管理凭证
   */
  private async generateManageToken(url: string, body?: string): Promise<string> {
    this.ensureInitialized();
    
    const accessKey = this.config!.access_key!;
    const secretKey = this.config!.secret_key!;
    
    const urlObj = new URL(url);
    let signingStr = `${urlObj.pathname}${urlObj.search ? urlObj.search : ''}\n`;
    if (body) {
      signingStr += body;
    }
    
    const sign = await this.hmacSha1(signingStr, secretKey);
    const encodedSign = this.base64UrlSafe(sign);
    
    return `QBox ${accessKey}:${encodedSign}`;
  }

  async upload(key: string, data: ArrayBuffer, contentType: string): Promise<string> {
    this.ensureInitialized();
    
    const token = await this.generateUploadToken(key);
    
    // 构建 multipart/form-data
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const encoder = new TextEncoder();
    
    const parts: Uint8Array[] = [];
    
    // token 字段
    parts.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="token"\r\n\r\n${token}\r\n`));
    
    // key 字段
    parts.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="key"\r\n\r\n${key}\r\n`));
    
    // file 字段
    parts.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${key}"\r\nContent-Type: ${contentType}\r\n\r\n`));
    parts.push(new Uint8Array(data));
    parts.push(encoder.encode(`\r\n--${boundary}--\r\n`));
    
    // 合并所有部分
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      body.set(part, offset);
      offset += part.length;
    }
    
    const response = await fetch(this.zone.up, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: body,
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Qiniu upload failed: ${error}`);
    }
    
    return this.getPublicUrl(key);
  }

  async delete(key: string): Promise<void> {
    this.ensureInitialized();
    
    const bucket = this.config!.bucket_name!;
    const encodedEntry = this.base64UrlSafe(`${bucket}:${key}`);
    const url = `${this.zone.rs}/delete/${encodedEntry}`;
    
    const token = await this.generateManageToken(url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    if (!response.ok && response.status !== 612) { // 612 = 文件不存在
      const error = await response.text();
      throw new Error(`Qiniu delete failed: ${error}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    this.ensureInitialized();
    
    const bucket = this.config!.bucket_name!;
    const encodedEntry = this.base64UrlSafe(`${bucket}:${key}`);
    const url = `${this.zone.rs}/stat/${encodedEntry}`;
    
    const token = await this.generateManageToken(url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': token,
      },
    });
    
    return response.ok;
  }

  getPublicUrl(key: string): string {
    this.ensureInitialized();
    
    // 优先使用自定义域名
    if (this.config?.custom_domain) {
      const domain = this.config.custom_domain.replace(/\/$/, '');
      return `${domain}/${key}`;
    }
    
    // 七牛默认域名（需要绑定自定义域名才能访问）
    return `https://${this.config?.bucket_name}.qiniudn.com/${key}`;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      this.ensureInitialized();
      
      // 尝试获取存储空间信息
      const bucket = this.config!.bucket_name!;
      const url = `${this.zone.rsf}/list?bucket=${bucket}&limit=1`;
      const token = await this.generateManageToken(url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': token,
        },
        signal: AbortSignal.timeout(10000),
      });
      
      const latency = Date.now() - startTime;
      
      if (response.ok) {
        return {
          success: true,
          message: 'Qiniu connection successful',
          latency,
        };
      } else if (response.status === 401) {
        return {
          success: false,
          message: 'Authentication failed',
          error: 'Invalid Access Key or Secret Key',
          latency,
        };
      } else {
        const error = await response.text();
        return {
          success: false,
          message: 'Connection failed',
          error: `HTTP ${response.status}: ${error}`,
          latency,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * Base64 URL Safe 编码
   */
  private base64UrlSafe(str: string): string {
    const base64 = btoa(str);
    return base64.replace(/\+/g, '-').replace(/\//g, '_');
  }

  /**
   * HMAC-SHA1 签名（使用 Web Crypto API）
   */
  private async hmacSha1(data: string, key: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const dataBytes = encoder.encode(data);
    
    // 导入密钥
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    
    // 生成签名
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBytes);
    
    // 转换为字符串
    const signatureArray = Array.from(new Uint8Array(signature));
    return String.fromCharCode(...signatureArray);
  }
}
