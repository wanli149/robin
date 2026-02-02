/**
 * 任务轮询管理组件
 * 提供全局任务状态轮询，用于采集任务等长时间操作的进度跟踪
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Badge, Drawer, List, Progress, Tag, Button, Space, Typography, Empty } from 'antd';
import { SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, PauseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { getCollectTaskProgress } from '../../services/adminApi';

const { Text } = Typography;

// 任务状态类型
export interface TaskStatus {
  taskId: string;
  taskType: string;
  taskName: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: {
    percentage: number;
    currentStep?: string;
    processedCount?: number;
    totalCount?: number;
    newCount?: number;
    errorCount?: number;
  };
  startedAt?: number;
  error?: string;
}

interface TaskPollingContextType {
  // 任务列表
  tasks: TaskStatus[];
  
  // 添加任务监控
  watchTask: (taskId: string, taskType: string, taskName: string) => void;
  
  // 移除任务监控
  unwatchTask: (taskId: string) => void;
  
  // 清除已完成任务
  clearCompleted: () => void;
  
  // 打开任务面板
  openTaskPanel: () => void;
  
  // 关闭任务面板
  closeTaskPanel: () => void;
  
  // 是否有运行中的任务
  hasRunningTasks: boolean;
  
  // 运行中任务数量
  runningCount: number;
}

const TaskPollingContext = createContext<TaskPollingContextType | null>(null);

// 轮询间隔（毫秒）
const POLL_INTERVAL = 2000;

/**
 * 任务轮询 Provider 组件
 */
export const TaskPollingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<TaskStatus[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 轮询任务状态
  const pollTasks = useCallback(async () => {
    const runningTasks = tasks.filter(t => t.status === 'running' || t.status === 'pending');
    
    if (runningTasks.length === 0) {
      return;
    }

    for (const task of runningTasks) {
      try {
        const result = await getCollectTaskProgress(task.taskId);
        
        setTasks(prev => prev.map(t => {
          if (t.taskId !== task.taskId) return t;
          
          return {
            ...t,
            status: result.status as TaskStatus['status'],
            progress: {
              percentage: result.progress?.percentage || 0,
              currentStep: result.progress?.currentSource,
              processedCount: result.progress?.processedCount,
              totalCount: result.progress?.totalPages,
              newCount: result.progress?.newCount,
              errorCount: result.progress?.errorCount,
            },
            startedAt: result.startedAt,
            error: result.lastError,
          };
        }));
      } catch (error) {
        logger.admin.error(`Failed to poll task ${task.taskId}:`, { error });
      }
    }
  }, [tasks]);

  // 启动/停止轮询
  useEffect(() => {
    const hasRunning = tasks.some(t => t.status === 'running' || t.status === 'pending');
    
    if (hasRunning && !pollTimerRef.current) {
      pollTimerRef.current = setInterval(pollTasks, POLL_INTERVAL);
    } else if (!hasRunning && pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [tasks, pollTasks]);

  // 添加任务监控
  const watchTask = useCallback((taskId: string, taskType: string, taskName: string) => {
    setTasks(prev => {
      // 避免重复添加
      if (prev.some(t => t.taskId === taskId)) {
        return prev;
      }
      
      return [...prev, {
        taskId,
        taskType,
        taskName,
        status: 'pending',
        progress: { percentage: 0 },
      }];
    });
    
    // 立即轮询一次
    setTimeout(pollTasks, 500);
  }, [pollTasks]);

  // 移除任务监控
  const unwatchTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.taskId !== taskId));
  }, []);

  // 清除已完成任务
  const clearCompleted = useCallback(() => {
    setTasks(prev => prev.filter(t => t.status === 'running' || t.status === 'pending'));
  }, []);

  const hasRunningTasks = tasks.some(t => t.status === 'running' || t.status === 'pending');
  const runningCount = tasks.filter(t => t.status === 'running' || t.status === 'pending').length;

  // 获取状态图标
  const getStatusIcon = (status: TaskStatus['status']) => {
    switch (status) {
      case 'running': return <SyncOutlined spin style={{ color: '#1890ff' }} />;
      case 'completed': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'paused': return <PauseCircleOutlined style={{ color: '#faad14' }} />;
      default: return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  // 获取状态标签
  const getStatusTag = (status: TaskStatus['status']) => {
    const config: Record<string, { color: string; text: string }> = {
      pending: { color: 'default', text: '等待中' },
      running: { color: 'processing', text: '运行中' },
      paused: { color: 'warning', text: '已暂停' },
      completed: { color: 'success', text: '已完成' },
      failed: { color: 'error', text: '失败' },
      cancelled: { color: 'default', text: '已取消' },
    };
    const { color, text } = config[status] || config.pending;
    return <Tag color={color}>{text}</Tag>;
  };

  const value: TaskPollingContextType = {
    tasks,
    watchTask,
    unwatchTask,
    clearCompleted,
    openTaskPanel: () => setDrawerVisible(true),
    closeTaskPanel: () => setDrawerVisible(false),
    hasRunningTasks,
    runningCount,
  };

  return (
    <TaskPollingContext.Provider value={value}>
      {children}
      
      {/* 任务面板 */}
      <Drawer
        title={
          <Space>
            <span>任务管理</span>
            {runningCount > 0 && <Badge count={runningCount} />}
          </Space>
        }
        placement="right"
        width={400}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        extra={
          <Button size="small" onClick={clearCompleted} disabled={!tasks.some(t => t.status !== 'running' && t.status !== 'pending')}>
            清除已完成
          </Button>
        }
      >
        {tasks.length === 0 ? (
          <Empty description="暂无任务" />
        ) : (
          <List
            dataSource={tasks}
            renderItem={task => (
              <List.Item>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Space>
                      {getStatusIcon(task.status)}
                      <Text strong>{task.taskName}</Text>
                    </Space>
                    {getStatusTag(task.status)}
                  </div>
                  
                  {(task.status === 'running' || task.status === 'pending') && (
                    <Progress 
                      percent={task.progress.percentage} 
                      size="small" 
                      status={task.status === 'running' ? 'active' : 'normal'}
                    />
                  )}
                  
                  {task.progress.currentStep && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {task.progress.currentStep}
                    </Text>
                  )}
                  
                  {task.progress.processedCount !== undefined && (
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                      已处理: {task.progress.processedCount}
                      {task.progress.newCount !== undefined && ` | 新增: ${task.progress.newCount}`}
                      {task.progress.errorCount !== undefined && task.progress.errorCount > 0 && (
                        <Text type="danger"> | 错误: {task.progress.errorCount}</Text>
                      )}
                    </div>
                  )}
                  
                  {task.error && (
                    <Text type="danger" style={{ fontSize: 12 }}>
                      错误: {task.error}
                    </Text>
                  )}
                </div>
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </TaskPollingContext.Provider>
  );
};

/**
 * 使用任务轮询的 Hook
 */
export const useTaskPolling = (): TaskPollingContextType => {
  const context = useContext(TaskPollingContext);
  if (!context) {
    throw new Error('useTaskPolling must be used within TaskPollingProvider');
  }
  return context;
};

export default TaskPollingProvider;
