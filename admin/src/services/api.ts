/**
 * API Client Service
 * 配置axios实例和拦截器
 */

import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { logger } from '../utils/logger';

// API基础URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

// 创建axios实例
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 请求拦截器
 * 自动添加 x-admin-key header
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 从 localStorage 获取管理员密钥
    const adminKey = localStorage.getItem('admin_key');
    
    if (adminKey && config.headers) {
      config.headers['x-admin-key'] = adminKey;
    }
    
    return config;
  },
  (error: AxiosError) => {
    logger.api.error('Request error:', error);
    return Promise.reject(error);
  }
);

/**
 * 响应拦截器
 * 处理 403 错误跳转登录
 */
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      const { status } = error.response;
      
      // 401 或 403 错误，清除密钥并跳转登录
      if (status === 401 || status === 403) {
        logger.api.warn('Authentication failed, redirecting to login');
        localStorage.removeItem('admin_key');
        
        // 跳转到登录页
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;

/**
 * API响应类型
 */
export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data?: T;
  list?: T[];
  page?: number;
  total?: number;
}

/**
 * 通用API错误处理
 */
export const handleApiError = (error: any): string => {
  if (error.response) {
    const data = error.response.data as ApiResponse;
    return data.msg || '请求失败';
  } else if (error.request) {
    return '网络错误，请检查连接';
  } else {
    return error.message || '未知错误';
  }
};
