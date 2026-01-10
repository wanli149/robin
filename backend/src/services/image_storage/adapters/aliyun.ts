/**
 * Aliyun OSS Storage Adapter
 * 阿里云 OSS 存储适配器
 */

import { BaseStorageAdapter } from './base';
import type { ConnectionTestResult } from '../types';

export class AliyunOSSAdapter extends BaseStorageAdapter {
  private endpoint: string = '';

  async initialize(config: any): Promise<void> {
    await super.initialize(config);
    
    // 设置 endpoint
    const region = config.region || 'oss-cn-hangzhou';
    this.endpoint = `https://${config.bucket_name}.${region}.aliyuncs.com`;
  }

  /**
   * 生成 OSS 签名
   */
  private async generateSignature(
    method: string,
    contentType: string,
    date: string,
    resource: string
  ): Promise<string> {
    this.ensureInitialized();
    
    const secretKey = this.config!.secret_key!;
    const stringToSign = `${method}\n\n${contentType}\n${date}\n${resource}`;
    
    // 使用 Web Crypto API 生成 HMAC-SHA1 签名
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const data = encoder.encode(stringToSign);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, data);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  async upload(key: string, data: ArrayBuffer, contentType: string): Promise<string> {
    this.ensureInitialized();
    
    const bucket = this.config!.bucket_name!;
    const accessKey = this.config!.access_key!;
    const date = new Date().toUTCString();
    const resource = `/${bucket}/${key}`;
    
    const signature = await this.generateSignature('PUT', contentType, date, resource);
    const authorization = `OSS ${accessKey}:${signature}`;
    
    const url = `${this.endpoint}/${key}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': authorization,
        'Content-Type': contentType,
        'Date': date,
        'x-oss-storage-class': 'Standard',
      },
      body: data,
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Aliyun OSS upload failed: ${error}`);
    }
    
    return this.getPublicUrl(key);
  }

  async delete(key: string): Promise<void> {
    this.ensureInitialized();
    
    const bucket = this.config!.bucket_name!;
    const accessKey = this.config!.access_key!;
    const date = new Date().toUTCString();
    const resource = `/${bucket}/${key}`;
    
    const signature = await this.generateSignature('DELETE', '', date, resource);
    const authorization = `OSS ${accessKey}:${signature}`;
    
    const url = `${this.endpoint}/${key}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': authorization,
        'Date': date,
      },
    });
    
    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(`Aliyun OSS delete failed: ${error}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    this.ensureInitialized();
    
    const bucket = this.config!.bucket_name!;
    const accessKey = this.config!.access_key!;
    const date = new Date().toUTCString();
    const resource = `/${bucket}/${key}`;
    
    const signature = await this.generateSignature('HEAD', '', date, resource);
    const authorization = `OSS ${accessKey}:${signature}`;
    
    const url = `${this.endpoint}/${key}`;
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'Authorization': authorization,
        'Date': date,
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
    
    return `${this.endpoint}/${key}`;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      this.ensureInitialized();
      
      const bucket = this.config!.bucket_name!;
      const accessKey = this.config!.access_key!;
      const date = new Date().toUTCString();
      const resource = `/${bucket}/`;
      
      const signature = await this.generateSignature('GET', '', date, resource);
      const authorization = `OSS ${accessKey}:${signature}`;
      
      const response = await fetch(`${this.endpoint}/?max-keys=1`, {
        method: 'GET',
        headers: {
          'Authorization': authorization,
          'Date': date,
        },
        signal: AbortSignal.timeout(10000),
      });
      
      const latency = Date.now() - startTime;
      
      if (response.ok) {
        return {
          success: true,
          message: 'Aliyun OSS connection successful',
          latency,
        };
      } else if (response.status === 403) {
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
}
