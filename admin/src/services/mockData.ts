/**
 * Mock Data
 * 用于开发测试的模拟数据
 */

import { DashboardStats } from './adminApi';

/**
 * 模拟仪表板数据
 */
export const mockDashboardData: DashboardStats = {
  stats: [
    { date: '2024-12-01', api_calls: 1250, unique_users: 85 },
    { date: '2024-12-02', api_calls: 1580, unique_users: 102 },
    { date: '2024-12-03', api_calls: 1420, unique_users: 95 },
    { date: '2024-12-04', api_calls: 1890, unique_users: 128 },
    { date: '2024-12-05', api_calls: 2100, unique_users: 145 },
    { date: '2024-12-06', api_calls: 1750, unique_users: 118 },
    { date: '2024-12-07', api_calls: 1650, unique_users: 110 },
  ],
  total_users: 1250,
  today_active: 110,
  today_api_calls: 1650,
  server_status: 'healthy',
};

/**
 * 是否使用模拟数据
 */
export const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK === 'true';
