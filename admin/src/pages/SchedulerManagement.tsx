/**
 * Scheduler Management Page
 * 定时任务管理页面 - 支持查看、编辑、添加、删除任务
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Switch, Button, Tag, Space, Modal, Tabs, Tooltip,
  Typography, Row, Col, Statistic, Progress, Popconfirm, Form, Input, Select
} from 'antd';
import { useNotification } from '../components/providers';
import {
  PlayCircleOutlined, ClockCircleOutlined, CheckCircleOutlined,
  CloseCircleOutlined, DeleteOutlined, ReloadOutlined, HistoryOutlined,
  PlusOutlined, EditOutlined, UndoOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getSchedulerTasks, toggleSchedulerTask, runSchedulerTask,
  getSchedulerHistory, clearSchedulerHistory, createSchedulerTask,
  updateSchedulerTask, deleteSchedulerTask, resetSchedulerTask,
  getSchedulerTaskTypes,
  type SchedulerTask, type SchedulerHistory, type SchedulerTaskType
} from '../services/adminApi';

const { Title, Text } = Typography;
const { TextArea } = Input;

const SchedulerManagement: React.FC = () => {
  const [tasks, setTasks] = useState<SchedulerTask[]>([]);
  const [history, setHistory] = useState<SchedulerHistory[]>([]);
  const [taskTypes, setTaskTypes] = useState<SchedulerTaskType[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const { success, error } = useNotification();
  
  // 编辑弹窗
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<SchedulerTask | null>(null);
  const [form] = Form.useForm();

  // 加载任务类型
  const loadTaskTypes = useCallback(async () => {
    try {
      const data = await getSchedulerTaskTypes();
      setTaskTypes(data.types);
    } catch (error) {
      logger.admin.error('Load task types error:', { error });
    }
  }, []);

  // 加载任务列表
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSchedulerTasks();
      setTasks(data.tasks);
    } catch (err: any) {
      error(err.message || '加载任务列表失败');
    } finally {
      setLoading(false);
    }
  }, [error]);

  // 加载执行历史
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await getSchedulerHistory();
      setHistory(data.history);
    } catch (err: any) {
      error(err.message || '加载执行历史失败');
    } finally {
      setHistoryLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadTaskTypes();
    loadTasks();
    loadHistory();
  }, [loadTaskTypes, loadTasks, loadHistory]);

  // 切换任务状态
  const handleToggle = async (taskId: string, enabled: boolean) => {
    try {
      await toggleSchedulerTask(taskId, enabled);
      success(enabled ? '任务已启用' : '任务已禁用');
      loadTasks();
    } catch (err: any) {
      error(err.message);
    }
  };

  // 手动执行任务
  const handleRun = async (taskId: string) => {
    setRunningTaskId(taskId);
    try {
      const result = await runSchedulerTask(taskId);
      if (result.code === 1) {
        success(`执行成功，耗时 ${result.data?.duration || 0}ms`);
      } else {
        error(result.msg || '执行失败');
      }
      loadTasks();
      loadHistory();
    } catch (err: any) {
      error(err.message);
    } finally {
      setRunningTaskId(null);
    }
  };

  // 打开编辑弹窗
  const handleEdit = (task?: SchedulerTask) => {
    setEditingTask(task || null);
    if (task) {
      form.setFieldsValue({
        name: task.name,
        description: task.description,
        cron: task.cron,
        category: task.category,
        task_type: task.task_type,
        task_params: task.task_params ? JSON.stringify(task.task_params, null, 2) : '',
      });
    } else {
      form.resetFields();
    }
    setEditModalVisible(true);
  };

  // 保存任务
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      // 解析参数
      let task_params = null;
      if (values.task_params) {
        try {
          task_params = JSON.parse(values.task_params);
        } catch {
          error('任务参数必须是有效的 JSON 格式');
          return;
        }
      }
      
      const data = {
        ...values,
        task_params,
      };
      
      if (editingTask) {
        await updateSchedulerTask(editingTask.id, data);
        success('任务更新成功');
      } else {
        await createSchedulerTask(data);
        success('任务创建成功');
      }
      
      setEditModalVisible(false);
      loadTasks();
    } catch (err: any) {
      if (err.errorFields) return; // 表单验证错误
      error(err.message);
    }
  };

  // 删除任务
  const handleDelete = async (taskId: string) => {
    try {
      await deleteSchedulerTask(taskId);
      success('任务已删除');
      loadTasks();
    } catch (err: any) {
      error(err.message);
    }
  };

  // 重置内置任务
  const handleReset = async (taskId: string) => {
    try {
      await resetSchedulerTask(taskId);
      success('任务已重置为默认配置');
      loadTasks();
    } catch (err: any) {
      error(err.message);
    }
  };

  // 清理历史
  const handleClearHistory = async () => {
    try {
      await clearSchedulerHistory(30);
      success('历史记录已清理');
      loadHistory();
    } catch (err: any) {
      error(err.message);
    }
  };

  // 分类颜色
  const categoryColors: Record<string, string> = {
    cache: 'blue',
    collect: 'green',
    maintenance: 'orange',
    monitor: 'purple',
    custom: 'cyan',
  };

  const categoryNames: Record<string, string> = {
    cache: '缓存',
    collect: '采集',
    maintenance: '维护',
    monitor: '监控',
    custom: '自定义',
  };

  // 任务列表列定义
  const taskColumns: ColumnsType<SchedulerTask> = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space direction="vertical" size={0}>
          <Space>
            <Text strong>{name}</Text>
            {record.is_builtin && <Tag color="default">内置</Tag>}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 80,
      render: (category) => (
        <Tag color={categoryColors[category] || 'default'}>
          {categoryNames[category] || category}
        </Tag>
      ),
    },
    {
      title: 'Cron 表达式',
      dataIndex: 'cron',
      key: 'cron',
      width: 180,
      render: (cron, record) => (
        <Tooltip title={record.cronDescription}>
          <Space direction="vertical" size={0}>
            <code style={{ fontSize: 12 }}>{cron}</code>
            <Text type="secondary" style={{ fontSize: 11 }}>{record.cronDescription}</Text>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled, record) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleToggle(record.id, checked)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    {
      title: '上次执行',
      dataIndex: 'lastRun',
      key: 'lastRun',
      width: 180,
      render: (lastRun, record) => {
        if (!lastRun) return <Text type="secondary">从未执行</Text>;
        return (
          <Space>
            {record.lastStatus === 'success' ? (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            ) : (
              <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
            )}
            <Text style={{ fontSize: 12 }}>{new Date(lastRun).toLocaleString()}</Text>
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="执行">
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              loading={runningTaskId === record.id}
              onClick={() => handleRun(record.id)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          {record.is_builtin ? (
            <Tooltip title="重置为默认">
              <Popconfirm
                title="确定重置为默认配置？"
                onConfirm={() => handleReset(record.id)}
              >
                <Button size="small" icon={<UndoOutlined />} />
              </Popconfirm>
            </Tooltip>
          ) : (
            <Tooltip title="删除">
              <Popconfirm
                title="确定删除此任务？"
                onConfirm={() => handleDelete(record.id)}
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // 历史记录列定义
  const historyColumns: ColumnsType<SchedulerHistory> = [
    {
      title: '任务',
      dataIndex: 'task_id',
      key: 'task_id',
      render: (taskId) => {
        const task = tasks.find(t => t.id === taskId);
        return task?.name || taskId;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Tag color={status === 'success' ? 'success' : 'error'}>
          {status === 'success' ? '成功' : '失败'}
        </Tag>
      ),
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (duration) => duration ? `${duration}ms` : '-',
    },
    {
      title: '执行时间',
      dataIndex: 'executed_at',
      key: 'executed_at',
      width: 180,
      render: (time) => new Date(time).toLocaleString(),
    },
  ];

  // 统计数据
  const stats = {
    total: tasks.length,
    enabled: tasks.filter(t => t.enabled).length,
    builtin: tasks.filter(t => t.is_builtin).length,
    custom: tasks.filter(t => !t.is_builtin).length,
    successRate: history.length > 0
      ? Math.round((history.filter(h => h.status === 'success').length / history.length) * 100)
      : 100,
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={4}>定时任务管理</Title>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={5}>
          <Card>
            <Statistic title="任务总数" value={stats.total} suffix="个" />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="已启用"
              value={stats.enabled}
              suffix={`/ ${stats.total}`}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="内置任务" value={stats.builtin} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="自定义任务" value={stats.custom} valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="secondary">成功率</Text>
              <Progress percent={stats.successRate} size="small" status={stats.successRate < 80 ? 'exception' : 'success'} />
            </Space>
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="tasks"
        items={[
          {
            key: 'tasks',
            label: (
              <span>
                <ClockCircleOutlined />
                任务列表
              </span>
            ),
            children: (
              <Card
                extra={
                  <Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => handleEdit()}>
                      添加任务
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={loadTasks}>
                      刷新
                    </Button>
                  </Space>
                }
              >
                <Table
                  columns={taskColumns}
                  dataSource={tasks}
                  rowKey="id"
                  loading={loading}
                  pagination={false}
                />
              </Card>
            ),
          },
          {
            key: 'history',
            label: (
              <span>
                <HistoryOutlined />
                执行历史
              </span>
            ),
            children: (
              <Card
                extra={
                  <Space>
                    <Button icon={<ReloadOutlined />} onClick={loadHistory}>
                      刷新
                    </Button>
                    <Popconfirm
                      title="确定清理30天前的历史记录？"
                      onConfirm={handleClearHistory}
                    >
                      <Button icon={<DeleteOutlined />} danger>
                        清理历史
                      </Button>
                    </Popconfirm>
                  </Space>
                }
              >
                <Table
                  columns={historyColumns}
                  dataSource={history}
                  rowKey="id"
                  loading={historyLoading}
                  pagination={{ pageSize: 20 }}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* 编辑/创建任务弹窗 */}
      <Modal
        title={editingTask ? '编辑任务' : '添加任务'}
        open={editModalVisible}
        onOk={handleSave}
        onCancel={() => setEditModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="任务名称"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="例如：每日数据备份" />
          </Form.Item>
          
          <Form.Item name="description" label="任务描述">
            <Input placeholder="任务的详细描述" />
          </Form.Item>
          
          <Form.Item
            name="cron"
            label="Cron 表达式"
            rules={[{ required: true, message: '请输入 Cron 表达式' }]}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                格式：分 时 日 月 周，例如：0 2 * * * (每天凌晨2点)，0 */6 * * * (每6小时)
              </Text>
            }
          >
            <Input placeholder="0 * * * *" />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="task_type"
                label="任务类型"
                rules={[{ required: true, message: '请选择任务类型' }]}
              >
                <Select
                  placeholder="选择任务类型"
                  disabled={editingTask?.is_builtin}
                  options={taskTypes.map(t => ({ value: t.value, label: t.label }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="分类">
                <Select
                  placeholder="选择分类"
                  disabled={editingTask?.is_builtin}
                  options={[
                    { value: 'cache', label: '缓存' },
                    { value: 'collect', label: '采集' },
                    { value: 'maintenance', label: '维护' },
                    { value: 'monitor', label: '监控' },
                    { value: 'custom', label: '自定义' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            name="task_params"
            label="任务参数 (JSON)"
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                可选，JSON 格式。例如：{`{"maxPages": 5, "maxVideos": 200}`}
              </Text>
            }
          >
            <TextArea rows={3} placeholder='{"maxPages": 5}' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SchedulerManagement;
