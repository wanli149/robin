/**
 * Collect Management V2 Page
 * 采集管理页面 V2 - 支持任务管理、实时进度、资源站健康检测
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Table,
  Space,
  Statistic,
  Row,
  Col,
  Tag,
  Modal,
  Select,
  Progress,
  Tabs,
  Badge,
  Descriptions,
  List,
  Typography,
  Popconfirm,
  Tooltip,
} from 'antd';
import { useNotification, useTaskPolling } from '../components/providers';
import {
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  PauseCircleOutlined,
  StopOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { CollectTaskV2, SourceHealthStatus } from '../services/adminApi';
import {
  getCollectTasks,
  getCollectTaskProgress,
  cancelCollectTask,
  deleteCollectTask,
  pauseCollectTask,
  resumeCollectTask,
  getCollectTaskLogs,
  quickIncrementalCollect,
  quickFullCollect,
  quickCategoryCollect,
  quickSourceCollect,
  getSourcesHealth,
  checkSourceHealthStatus,
  checkAllSourcesHealthStatus,
  getCollectStatsV2,
  getCollectCategories,
  getSources,
} from '../services/adminApi';

const { Text } = Typography;

const CollectManagementV2: React.FC = () => {
  const { success, error } = useNotification();
  const { watchTask } = useTaskPolling();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [tasks, setTasks] = useState<CollectTaskV2[]>([]);
  const [healthList, setHealthList] = useState<SourceHealthStatus[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  
  // 任务详情弹窗
  const [taskDetailVisible, setTaskDetailVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CollectTaskV2 | null>(null);
  const [taskLogs, setTaskLogs] = useState<any[]>([]);
  
  // 轮询运行中的任务
  const [pollingTaskId, setPollingTaskId] = useState<string | null>(null);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      const data = await getCollectStatsV2();
      setStats(data);
      
      // 如果有运行中的任务，开始轮询
      if (data.tasks.running) {
        setPollingTaskId(data.tasks.running.id);
      } else {
        setPollingTaskId(null);
      }
    } catch (err: any) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  // 加载任务列表
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCollectTasks({ limit: 20 });
      setTasks(result.tasks);
    } catch (err: any) {
      error(err.message || '加载任务列表失败');
    } finally {
      setLoading(false);
    }
  }, [error]);

  // 加载资源站健康状态
  const loadHealth = useCallback(async () => {
    try {
      const list = await getSourcesHealth();
      setHealthList(list);
    } catch (err: any) {
      console.error('Failed to load health:', err);
    }
  }, []);

  // 加载分类和资源站
  const loadOptions = useCallback(async () => {
    try {
      const [cats, srcs] = await Promise.all([
        getCollectCategories(),
        getSources(),
      ]);
      setCategories(cats);
      setSources(srcs);
    } catch (error) {
      console.error('Failed to load options:', error);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    loadStats();
    loadTasks();
    loadHealth();
    loadOptions();
  }, [loadStats, loadTasks, loadHealth, loadOptions]);

  // 轮询任务进度
  useEffect(() => {
    if (!pollingTaskId) return;
    
    const interval = setInterval(async () => {
      try {
        const progress = await getCollectTaskProgress(pollingTaskId);
        
        // 更新统计
        setStats((prev: any) => ({
          ...prev,
          tasks: {
            ...prev?.tasks,
            running: progress.status === 'running' ? {
              id: pollingTaskId,
              progress: progress.progress,
            } : null,
          },
        }));
        
        // 如果任务完成，停止轮询并刷新
        if (progress.status !== 'running') {
          setPollingTaskId(null);
          loadTasks();
          loadStats();
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [pollingTaskId, loadTasks, loadStats]);

  // 快速采集
  const handleQuickCollect = async (type: string, options?: any) => {
    try {
      let result;
      switch (type) {
        case 'incremental':
          result = await quickIncrementalCollect(options);
          break;
        case 'full':
          result = await quickFullCollect();
          break;
        case 'category':
          result = await quickCategoryCollect(options.categoryId, options);
          break;
        case 'source':
          result = await quickSourceCollect(options.sourceId, options);
          break;
        default:
          throw new Error('Unknown type');
      }
      
      success('采集任务已启动');
      // 添加到任务监控
      watchTask(result.taskId, type, `${type === 'incremental' ? '增量' : type === 'full' ? '全量' : type === 'category' ? '分类' : '资源站'}采集`);
      setPollingTaskId(result.taskId);
      loadTasks();
      loadStats();
    } catch (err: any) {
      error(err.message || '启动采集失败');
    }
  };

  // 查看任务详情
  const handleViewTask = async (task: CollectTaskV2) => {
    setSelectedTask(task);
    setTaskDetailVisible(true);
    
    try {
      const result = await getCollectTaskLogs(task.id, { limit: 50 });
      setTaskLogs(result.logs);
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  };

  // 取消任务
  const handleCancelTask = async (taskId: string) => {
    try {
      await cancelCollectTask(taskId);
      success('任务已取消');
      loadTasks();
      loadStats();
    } catch (err: any) {
      error(err.message || '取消失败');
    }
  };

  // 暂停任务
  const handlePauseTask = async (taskId: string) => {
    try {
      await pauseCollectTask(taskId);
      success('任务已暂停');
      loadTasks();
    } catch (err: any) {
      error(err.message || '暂停失败');
    }
  };

  // 恢复任务
  const handleResumeTask = async (taskId: string) => {
    try {
      await resumeCollectTask(taskId);
      success('任务已恢复');
      setPollingTaskId(taskId);
      loadTasks();
    } catch (err: any) {
      error(err.message || '恢复失败');
    }
  };

  // 删除任务
  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteCollectTask(taskId);
      success('任务已删除');
      loadTasks();
      loadStats();
    } catch (err: any) {
      error(err.message || '删除失败');
    }
  };

  // 检测资源站健康
  const handleCheckHealth = async (sourceId?: number) => {
    try {
      if (sourceId) {
        const result = await checkSourceHealthStatus(sourceId);
        success(`检测完成: ${result.status} (${result.responseTime}ms)`);
      } else {
        await checkAllSourcesHealthStatus();
        success('已开始检测所有资源站');
      }
      setTimeout(loadHealth, 2000);
    } catch (err: any) {
      error(err.message || '检测失败');
    }
  };

  // 任务状态标签
  const renderTaskStatus = (status: string) => {
    const config: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      pending: { color: 'default', icon: <ClockCircleOutlined />, text: '等待中' },
      running: { color: 'processing', icon: <SyncOutlined spin />, text: '运行中' },
      paused: { color: 'warning', icon: <PauseCircleOutlined />, text: '已暂停' },
      completed: { color: 'success', icon: <CheckCircleOutlined />, text: '已完成' },
      failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
      cancelled: { color: 'default', icon: <StopOutlined />, text: '已取消' },
    };
    const c = config[status] || config.pending;
    return <Tag color={c.color} icon={c.icon}>{c.text}</Tag>;
  };

  // 任务类型标签
  const renderTaskType = (type: string) => {
    const config: Record<string, { color: string; text: string }> = {
      full: { color: 'blue', text: '全量采集' },
      incremental: { color: 'green', text: '增量采集' },
      category: { color: 'purple', text: '分类采集' },
      source: { color: 'orange', text: '资源站采集' },
      shorts: { color: 'cyan', text: '短剧采集' },
    };
    const c = config[type] || { color: 'default', text: type };
    return <Tag color={c.color}>{c.text}</Tag>;
  };

  // 健康状态标签
  const renderHealthStatus = (status: string) => {
    const config: Record<string, { color: string; text: string }> = {
      healthy: { color: 'success', text: '正常' },
      slow: { color: 'warning', text: '较慢' },
      error: { color: 'error', text: '错误' },
      timeout: { color: 'error', text: '超时' },
      unknown: { color: 'default', text: '未知' },
    };
    const c = config[status] || config.unknown;
    return <Tag color={c.color}>{c.text}</Tag>;
  };

  // 任务列表列定义
  const taskColumns: ColumnsType<CollectTaskV2> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 100,
      render: (id: string) => <Text copyable={{ text: id }}>{id.substring(0, 8)}...</Text>,
    },
    {
      title: '类型',
      dataIndex: 'taskType',
      width: 120,
      render: renderTaskType,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: renderTaskStatus,
    },
    {
      title: '进度',
      key: 'progress',
      width: 200,
      render: (_, record) => (
        <div>
          <Progress 
            percent={record.progress.percentage} 
            size="small" 
            status={record.status === 'failed' ? 'exception' : undefined}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            新增: {record.progress.newCount} | 更新: {record.progress.updateCount}
          </Text>
        </div>
      ),
    },
    {
      title: '当前',
      key: 'current',
      width: 150,
      render: (_, record) => (
        <div>
          <div>{record.progress.currentSource || '-'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            第 {record.progress.currentPage}/{record.progress.totalPages} 页
          </Text>
        </div>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (time: number) => new Date(time * 1000).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleViewTask(record)}>
            详情
          </Button>
          {record.status === 'running' && (
            <Button type="link" size="small" onClick={() => handlePauseTask(record.id)}>
              暂停
            </Button>
          )}
          {record.status === 'paused' && (
            <Button type="link" size="small" onClick={() => handleResumeTask(record.id)}>
              恢复
            </Button>
          )}
          {['pending', 'running', 'paused'].includes(record.status) && (
            <Button type="link" size="small" danger onClick={() => handleCancelTask(record.id)}>
              取消
            </Button>
          )}
          {['completed', 'failed', 'cancelled'].includes(record.status) && (
            <Popconfirm
              title="确认删除"
              description="确定要删除这个任务吗？相关日志也会被删除。"
              onConfirm={() => handleDeleteTask(record.id)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // 健康状态列表列定义
  const healthColumns: ColumnsType<SourceHealthStatus> = [
    {
      title: '资源站',
      dataIndex: 'sourceName',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: renderHealthStatus,
    },
    {
      title: '响应时间',
      dataIndex: 'responseTime',
      width: 90,
      render: (time: number) => `${time}ms`,
    },
    {
      title: '平均响应',
      dataIndex: 'avgResponseTime',
      width: 90,
      render: (time: number) => `${time}ms`,
    },
    {
      title: '成功率',
      dataIndex: 'successRate',
      width: 80,
      render: (rate: number) => (
        <span style={{ color: rate < 80 ? '#ff4d4f' : rate < 95 ? '#faad14' : '#52c41a' }}>
          {rate.toFixed(1)}%
        </span>
      ),
    },
    {
      title: '视频数',
      dataIndex: 'videoCount',
      width: 80,
    },
    {
      title: '最后检测',
      dataIndex: 'lastCheckAt',
      width: 150,
      render: (time: number) => time ? new Date(time * 1000).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 100,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="检测健康状态">
            <Button 
              type="text" 
              size="small" 
              icon={<ThunderboltOutlined />}
              onClick={() => handleCheckHealth(record.sourceId)}
            />
          </Tooltip>
          <Tooltip title="采集此资源站">
            <Button 
              type="text" 
              size="small"
              icon={<SyncOutlined />}
              onClick={() => handleQuickCollect('source', { sourceId: record.sourceId })}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>采集管理 V2</h2>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总视频数"
              value={stats?.videos?.total || 0}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日新增"
              value={stats?.videos?.todayNew || 0}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本周新增"
              value={stats?.videos?.weekNew || 0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<SyncOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="资源站状态"
              value={`${stats?.sources?.healthy || 0}/${stats?.sources?.total || 0}`}
              prefix={<CloudServerOutlined />}
              suffix={
                (stats?.sources?.error || 0) > 0 && (
                  <Badge count={stats?.sources?.error} style={{ marginLeft: 8 }} />
                )
              }
            />
          </Card>
        </Col>
      </Row>

      {/* 运行中的任务 */}
      {stats?.tasks?.running && (
        <Card style={{ marginBottom: 24 }} title="当前任务">
          <Row gutter={16} align="middle">
            <Col span={12}>
              <Progress 
                percent={stats.tasks.running.progress?.percentage || 0} 
                status="active"
                strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
              />
            </Col>
            <Col span={12}>
              <Space size="large">
                <Statistic title="当前资源站" value={stats.tasks.running.progress?.currentSource || '-'} />
                <Statistic title="页码" value={`${stats.tasks.running.progress?.currentPage || 0}/${stats.tasks.running.progress?.totalPages || 0}`} />
                <Statistic title="新增" value={stats.tasks.running.progress?.newCount || 0} valueStyle={{ color: '#3f8600' }} />
                <Statistic title="更新" value={stats.tasks.running.progress?.updateCount || 0} valueStyle={{ color: '#1890ff' }} />
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* 快速操作 */}
      <Card style={{ marginBottom: 24 }}>
        <Space wrap>
          <Button
            type="primary"
            icon={<SyncOutlined />}
            onClick={() => handleQuickCollect('incremental', { maxPages: 5 })}
            disabled={!!pollingTaskId}
          >
            增量采集
          </Button>
          <Button
            icon={<DatabaseOutlined />}
            onClick={() => handleQuickCollect('full')}
            disabled={!!pollingTaskId}
          >
            全量采集
          </Button>
          
          <Select
            mode="multiple"
            placeholder="指定分类全量采集"
            style={{ minWidth: 200 }}
            disabled={!!pollingTaskId}
            allowClear
            maxTagCount={2}
            onChange={(values: number[]) => {
              if (values && values.length > 0) {
                handleQuickCollect('full', { categoryIds: values });
              }
            }}
          >
            {categories.map((cat) => (
              <Select.Option key={cat.id} value={cat.id}>{cat.name}</Select.Option>
            ))}
          </Select>
          
          <Select
            placeholder="按分类采集"
            style={{ width: 150 }}
            disabled={!!pollingTaskId}
            onChange={(value) => handleQuickCollect('category', { categoryId: value })}
          >
            {categories.map((cat) => (
              <Select.Option key={cat.id} value={cat.id}>{cat.name}</Select.Option>
            ))}
          </Select>
          
          <Select
            placeholder="按资源站采集"
            style={{ width: 150 }}
            disabled={!!pollingTaskId}
            onChange={(value) => handleQuickCollect('source', { sourceId: value })}
          >
            {sources.filter(s => s.is_active).map((src) => (
              <Select.Option key={src.id} value={src.id}>{src.name}</Select.Option>
            ))}
          </Select>
          
          <Button 
            icon={<ThunderboltOutlined />} 
            onClick={() => handleCheckHealth()}
          >
            检测所有资源站
          </Button>
          
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => { loadStats(); loadTasks(); loadHealth(); }}
          >
            刷新
          </Button>
        </Space>
      </Card>

      {/* 标签页 */}
      <Tabs defaultActiveKey="tasks" items={[
        {
          key: 'tasks',
          label: '采集任务',
          children: (
            <Card>
              <Table
                columns={taskColumns}
                dataSource={tasks}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
              />
            </Card>
          ),
        },
        {
          key: 'health',
          label: (
            <span>
              资源站健康
              {(stats?.sources?.error || 0) > 0 && (
                <Badge count={stats?.sources?.error} style={{ marginLeft: 8 }} />
              )}
            </span>
          ),
          children: (
            <Card>
              <Table
                columns={healthColumns}
                dataSource={healthList}
                rowKey="sourceId"
                pagination={false}
                scroll={{ x: 830 }}
              />
            </Card>
          ),
        },
      ]} />

      {/* 任务详情弹窗 */}
      <Modal
        title="任务详情"
        open={taskDetailVisible}
        onCancel={() => setTaskDetailVisible(false)}
        footer={null}
        width={800}
      >
        {selectedTask && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="任务ID">{selectedTask.id}</Descriptions.Item>
              <Descriptions.Item label="类型">{renderTaskType(selectedTask.taskType)}</Descriptions.Item>
              <Descriptions.Item label="状态">{renderTaskStatus(selectedTask.status)}</Descriptions.Item>
              <Descriptions.Item label="优先级">{selectedTask.priority}</Descriptions.Item>
              <Descriptions.Item label="已处理">{selectedTask.progress.processedCount}</Descriptions.Item>
              <Descriptions.Item label="新增">{selectedTask.progress.newCount}</Descriptions.Item>
              <Descriptions.Item label="更新">{selectedTask.progress.updateCount}</Descriptions.Item>
              <Descriptions.Item label="跳过">{selectedTask.progress.skipCount}</Descriptions.Item>
              <Descriptions.Item label="错误">{selectedTask.progress.errorCount}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(selectedTask.createdAt * 1000).toLocaleString()}
              </Descriptions.Item>
              {selectedTask.lastError && (
                <Descriptions.Item label="错误信息" span={2}>
                  <Text type="danger">{selectedTask.lastError}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
            
            <div style={{ marginTop: 16 }}>
              <h4><FileTextOutlined /> 最近日志</h4>
              <List
                size="small"
                dataSource={taskLogs}
                renderItem={(log: any) => (
                  <List.Item>
                    <Space>
                      <Tag color={
                        log.level === 'error' ? 'error' : 
                        log.level === 'warn' ? 'warning' : 
                        log.level === 'info' ? 'blue' : 'default'
                      }>
                        {log.level}
                      </Tag>
                      <Text type="secondary">{log.action}</Text>
                      <Text>{log.message}</Text>
                      {log.vodName && <Text type="secondary">({log.vodName})</Text>}
                    </Space>
                  </List.Item>
                )}
                style={{ maxHeight: 300, overflow: 'auto' }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CollectManagementV2;
