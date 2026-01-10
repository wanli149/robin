/**
 * 统一通知管理组件
 * 提供全局通知上下文，统一管理 success/error/warning/info 通知
 */

import React, { createContext, useContext, useCallback } from 'react';
import { App } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import type { NotificationInstance } from 'antd/es/notification/interface';
import type { ModalStaticFunctions } from 'antd/es/modal/confirm';

interface NotificationContextType {
  // 简单消息（顶部提示，自动消失）
  success: (content: string) => void;
  error: (content: string) => void;
  warning: (content: string) => void;
  info: (content: string) => void;
  loading: (content: string) => () => void; // 返回关闭函数
  
  // 通知（右侧弹出，需手动关闭）
  notify: {
    success: (title: string, description?: string) => void;
    error: (title: string, description?: string) => void;
    warning: (title: string, description?: string) => void;
    info: (title: string, description?: string) => void;
  };
  
  // 确认对话框
  confirm: {
    delete: (title: string, onOk: () => Promise<void> | void) => void;
    danger: (title: string, content: string, onOk: () => Promise<void> | void) => void;
    warning: (title: string, content: string, onOk: () => Promise<void> | void) => void;
  };
  
  // 原始实例（高级用法）
  message: MessageInstance;
  notification: NotificationInstance;
  modal: Omit<ModalStaticFunctions, 'warn'>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

/**
 * 通知 Provider 组件
 */
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { message, notification, modal } = App.useApp();

  // 简单消息
  const success = useCallback((content: string) => {
    message.success(content);
  }, [message]);

  const error = useCallback((content: string) => {
    message.error(content);
  }, [message]);

  const warning = useCallback((content: string) => {
    message.warning(content);
  }, [message]);

  const info = useCallback((content: string) => {
    message.info(content);
  }, [message]);

  const loading = useCallback((content: string) => {
    const hide = message.loading(content, 0);
    return hide;
  }, [message]);

  // 通知
  const notify = {
    success: useCallback((title: string, description?: string) => {
      notification.success({ message: title, description, placement: 'topRight' });
    }, [notification]),
    
    error: useCallback((title: string, description?: string) => {
      notification.error({ message: title, description, placement: 'topRight', duration: 0 });
    }, [notification]),
    
    warning: useCallback((title: string, description?: string) => {
      notification.warning({ message: title, description, placement: 'topRight' });
    }, [notification]),
    
    info: useCallback((title: string, description?: string) => {
      notification.info({ message: title, description, placement: 'topRight' });
    }, [notification]),
  };

  // 确认对话框
  const confirm = {
    delete: useCallback((title: string, onOk: () => Promise<void> | void) => {
      modal.confirm({
        title: '确认删除',
        content: title,
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk,
      });
    }, [modal]),

    danger: useCallback((title: string, content: string, onOk: () => Promise<void> | void) => {
      modal.confirm({
        title,
        content,
        okText: '确认',
        okType: 'danger',
        cancelText: '取消',
        onOk,
      });
    }, [modal]),

    warning: useCallback((title: string, content: string, onOk: () => Promise<void> | void) => {
      modal.confirm({
        title,
        content,
        okText: '确认',
        cancelText: '取消',
        onOk,
      });
    }, [modal]),
  };

  const value: NotificationContextType = {
    success,
    error,
    warning,
    info,
    loading,
    notify,
    confirm,
    message,
    notification,
    modal,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

/**
 * 使用通知的 Hook
 */
export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

export default NotificationProvider;
