/**
 * Authentication Service
 * 认证相关工具函数
 */

/**
 * 检查是否已登录
 */
export const isAuthenticated = (): boolean => {
  const adminKey = localStorage.getItem('admin_key');
  return !!adminKey;
};

/**
 * 获取管理员密钥
 */
export const getAdminKey = (): string | null => {
  return localStorage.getItem('admin_key');
};

/**
 * 设置管理员密钥
 */
export const setAdminKey = (key: string): void => {
  localStorage.setItem('admin_key', key);
};

/**
 * 清除管理员密钥（登出）
 */
export const logout = (): void => {
  localStorage.removeItem('admin_key');
  window.location.href = '/login';
};

/**
 * 验证管理员密钥格式
 */
export const validateAdminKey = (key: string): boolean => {
  // 至少8位字符
  return key.length >= 8;
};
