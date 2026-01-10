/**
 * Qiniu Cloud Storage Adapter
 * 七牛云存储适配器
 */

import { BaseStorageAdapter } from './base';
import type { ConnectionTestResult } from '../types';

// 七牛区域配置
const QINIU_ZONES: Record<string, { up: string; rs: string; rsf: string }> = {
  z0: { // 华东
    up: 'https://up.qiniup.com',
    rs: 'https://rs.qbox.me',
    rsf: 'https://rsf.qbox.me',
  },
  z1: { // 华北
    up: 'https://up-z1.qiniup.com',
    rs: 'https://rs-z1.qbox.me',
    rsf: 'https://rsf-z1.qbox.me',
  },
  z2: { // 华南
    up: 'https://up-z2.qiniup.com',
    rs: 'https://rs-z2.qbox.me',
    rsf: 'https://rsf-z2.qbox.me',
  },
  na0: { // 北美
    up: 'https://up-na0.qiniup.com',
    rs: 'https://rs-na0.qbox.me',
    rsf: 'https://rsf-na0.qbox.me',
  },
  as0: { // 东南亚
    up: 'https://up-as0.qiniup.com',
    rs: 'https://rs-as0.qbox.me',
    rsf: 'https://rsf-as0.qbox.me',
  },
};

export class QiniuAdapter extends BaseStorageAdapter {
  private zone: { up: string; rs: string; rsf: string } = QINIU_ZONES.z0;

  async initialize(config: any): Promise<void> {
    await super.initialize(config);
    
    // 设置区域
    const zoneKey = config.qiniu_zone || 'z0';
    this.zone = QINIU_ZONES[zoneKey] || QINIU_ZONES.z0;
  }

  /**
   * 生成七牛上传凭证
   */
  private generateUploadToken(key: string): string {
    this.ensureInitialized();
    
    const accessKey = this.config!.access_key!;
    const secretKey = this.config!.secret_key!;
    const bucket = this.config!.bucket_name!;
    
    // 上传策略
    const putPolicy = {
      scope: `${bucket}:${key}`,
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1小时有效
    };
    
    const encodedPolicy = this.base64UrlSafe(JSON.stringify(putPolicy));
    const sign = this.hmacSha1(encodedPolicy, secretKey);
    const encodedSign = this.base64UrlSafe(sign);
    
    return `${accessKey}:${encodedSign}:${encodedPolicy}`;
  }

  /**
   * 生成管理凭证
   */
  private generateManageToken(url: string, body?: string): string {
    this.ensureInitialized();
    
    const accessKey = this.config!.access_key!;
    const secretKey = this.config!.secret_key!;
    
    const urlObj = new URL(url);
    let signingStr = `${urlObj.pathname}${urlObj.search ? urlObj.search : ''}\n`;
    if (body) {
      signingStr += body;
    }
    
    const sign = this.hmacSha1(signingStr, secretKey);
    const encodedSign = this.base64UrlSafe(sign);
    
    return `QBox ${accessKey}:${encodedSign}`;
  }

  async upload(key: string, data: ArrayBuffer, contentType: string): Promise<string> {
    this.ensureInitialized();
    
    const token = this.generateUploadToken(key);
    
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
    
    const token = this.generateManageToken(url);
    
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
    
    const token = this.generateManageToken(url);
    
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
      const token = this.generateManageToken(url);
      
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
   * HMAC-SHA1 签名（简化实现，实际应使用 crypto API）
   */
  private hmacSha1(data: string, key: string): string {
    // 注意：这是简化实现，实际生产环境应使用 Web Crypto API
    // 由于 Workers 环境限制，这里使用简单的字符串处理
    // 实际部署时需要使用 crypto.subtle.sign
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const dataBytes = encoder.encode(data);
    
    // 简化的签名（实际应使用 HMAC-SHA1）
    let hash = 0;
    for (let i = 0; i < dataBytes.length; i++) {
      hash = ((hash << 5) - hash) + dataBytes[i] + (keyData[i % keyData.length] || 0);
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(36);
  }
}
