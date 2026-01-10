/**
 * Tencent Cloud COS Storage Adapter
 * 腾讯云 COS 存储适配器
 */

import { BaseStorageAdapter } from './base';
import type { ConnectionTestResult } from '../types';

export class TencentCOSAdapter extends BaseStorageAdapter {
  private host: string = '';

  async initialize(config: any): Promise<void> {
    await super.initialize(config);
    
    // 设置 host
    const bucket = config.bucket_name;
    const region = config.region || 'ap-guangzhou';
    this.host = `${bucket}.cos.${region}.myqcloud.com`;
  }

  /**
   * 生成 COS 签名
   */
  private async generateAuthorization(
    method: string,
    key: string,
    headers: Record<string, string> = {}
  ): Promise<string> {
    this.ensureInitialized();
    
    const secretId = this.config!.access_key!;
    const secretKey = this.config!.secret_key!;
    
    const now = Math.floor(Date.now() / 1000);
    const expireTime = now + 3600; // 1小时有效
    const keyTime = `${now};${expireTime}`;
    
    // 生成 SignKey
    const signKey = await this.hmacSha1(keyTime, secretKey);
    
    // 生成 HttpString
    const httpString = `${method.toLowerCase()}\n/${key}\n\n\n`;
    
    // 生成 StringToSign
    const sha1HttpString = await this.sha1(httpString);
    const stringToSign = `sha1\n${keyTime}\n${sha1HttpString}\n`;
    
    // 生成 Signature
    const signature = await this.hmacSha1(stringToSign, signKey);
    
    // 组装 Authorization
    return `q-sign-algorithm=sha1&q-ak=${secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=&q-url-param-list=&q-signature=${signature}`;
  }

  /**
   * HMAC-SHA1
   */
  private async hmacSha1(data: string, key: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const dataBytes = encoder.encode(data);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBytes);
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * SHA1
   */
  private async sha1(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const hash = await crypto.subtle.digest('SHA-1', dataBytes);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async upload(key: string, data: ArrayBuffer, contentType: string): Promise<string> {
    this.ensureInitialized();
    
    const authorization = await this.generateAuthorization('PUT', key);
    const url = `https://${this.host}/${key}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': authorization,
        'Content-Type': contentType,
        'Content-Length': String(data.byteLength),
      },
      body: data,
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Tencent COS upload failed: ${error}`);
    }
    
    return this.getPublicUrl(key);
  }

  async delete(key: string): Promise<void> {
    this.ensureInitialized();
    
    const authorization = await this.generateAuthorization('DELETE', key);
    const url = `https://${this.host}/${key}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': authorization,
      },
    });
    
    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(`Tencent COS delete failed: ${error}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    this.ensureInitialized();
    
    const authorization = await this.generateAuthorization('HEAD', key);
    const url = `https://${this.host}/${key}`;
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'Authorization': authorization,
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
    
    return `https://${this.host}/${key}`;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      this.ensureInitialized();
      
      const authorization = await this.generateAuthorization('GET', '');
      const url = `https://${this.host}/?max-keys=1`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': authorization,
        },
        signal: AbortSignal.timeout(10000),
      });
      
      const latency = Date.now() - startTime;
      
      if (response.ok) {
        return {
          success: true,
          message: 'Tencent COS connection successful',
          latency,
        };
      } else if (response.status === 403) {
        return {
          success: false,
          message: 'Authentication failed',
          error: 'Invalid Secret ID or Secret Key',
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
}
