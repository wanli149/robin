/**
 * Collect Management Page
 * 采集管理页面
 */

import { useState, useEffect } from 'react';
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
  InputNumber,
  Tooltip,
} from 'antd';
import { useNotification } from '../components/providers';
import {
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  PictureOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  getCollectStatsV1,
  getCollectTasksV1,
  triggerCollect as triggerCollectApi,
  triggerValidate as triggerValidateApi,
  fixCovers as fixCoversApi,
  rebuildActors,
} from '../services/adminApi';
import type { ColumnsType } from 'antd/es/table';

interface CollectTask {
  id: number;
  source_name?: string;
  type?: string;
  task_type?: string;
  status: string;
  total_count?: number;
  new_count: number;
  update_count: number;
  error_count: number;
  duration?: number;
  started_at?: number;
  created_at?: number;
  completed_at?: number;
}

interface CollectStats {
  total_videos: number;
  valid_videos: number;
  today_new: number;
  last_task?: CollectTask | null;
}

const CollectManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<CollectStats | null>(null);
  const [tasks, setTasks] = useState<CollectTask[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [taskType, setTaskType] = useState<'incremental' | 'full'>('incremental');
  const [limit, setLimit] = useState<number>(100);
  const { success, error } = useNotification();

  // 加载统计数据
  const loadStats = async () => {
    try {
      const data = await getCollectStatsV1();
      setStats(data as unknown as CollectStats);
    } catch (err) {
      logger.admin.error('Failed to load stats:', { error: err });
    }
  };

  // 加载任务列表
  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await getCollectTasksV1();
      setTasks(data as unknown as CollectTask[]);
    } catch (err) {
      error('加载任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 触发采集
  const triggerCollect = async () => {
    try {
      await triggerCollectApi();
      success('采集任务已触发，请稍后查看结果');
      setModalVisible(false);
      setTimeout(loadTasks, 2000);
    } catch (err: any) {
      error(err.message || '触发采集失败');
    }
  };

  // 触发URL检测
  const triggerValidate = async () => {
    try {
      await triggerValidateApi();
      success('URL检测任务已触发');
    } catch (err: any) {
      error(err.message || '触发检测失败');
    }
  };

  // 修复视频封面
  const fixCovers = async () => {
    try {
      await fixCoversApi(100);
      success('封面修复任务已触发，将为最多100个视频补充封面');
    } catch (err: any) {
      error(err.message || '触发修复失败');
    }
  };

  // 重建演员关联
  const handleRebuildActors = async () => {
    Modal.confirm({
      title: '重建演员关联',
      content: '此操作将重新建立视频与演员的关联关系，可能需要几分钟时间。确定继续吗？',
      onOk: async () => {
        try {
          const result = await rebuildActors();
          success(`演员关联重建完成！处理: ${result.processed}, 创建: ${result.created}`);
        } catch (err: any) {
          error(err.message || '触发重建失败');
        }
      },
    });
  };

  useEffect(() => {
    loadStats();
    loadTasks();
  }, []);

  const columns: ColumnsType<CollectTask> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '任务类型',
      dataIndex: 'task_type',
      width: 120,
      render: (type: string) => (
        <Tag color={type === 'full' ? 'blue' : 'green'}>
          {type === 'full' ? '全量采集' : '增量采集'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => {
        const config = {
          success: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
          failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
          running: { color: 'processing', icon: <SyncOutlined spin />, text: '运行中' },
          pending: { color: 'default', icon: <ClockCircleOutlined />, text: '等待中' },
        }[status] || { color: 'default', icon: null, text: status };

        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: '总数',
      dataIndex: 'total_count',
      width: 80,
    },
    {
      title: '新增',
      dataIndex: 'new_count',
      width: 80,
      render: (count: number) => <span style={{ color: '#52c41a' }}>{count}</span>,
    },
    {
      title: '更新',
      dataIndex: 'update_count',
      width: 80,
      render: (count: number) => <span style={{ color: '#1890ff' }}>{count}</span>,
    },
    {
      title: '失败',
      dataIndex: 'error_count',
      width: 80,
      render: (count: number) => (
        <span style={{ color: count > 0 ? '#ff4d4f' : undefined }}>{count}</span>
      ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      width: 100,
      render: (duration: number) => `${duration}秒`,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      render: (time: number) => new Date(time * 1000).toLocaleString(),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>采集管理</h2>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总视频数"
              value={stats?.total_videos || 0}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="有效视频"
              value={stats?.valid_videos || 0}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日新增"
              value={stats?.today_new || 0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<SyncOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="上次采集"
              value={
                stats?.last_task
                  ? `${stats.last_task.new_count}新/${stats.last_task.update_count}更新`
                  : '暂无'
              }
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 操作按钮 */}
      <Card style={{ marginBottom: 24 }}>
        <Space wrap>
          <Button
            type="primary"
            icon={<SyncOutlined />}
            onClick={() => setModalVisible(true)}
          >
            手动采集
          </Button>
          <Button icon={<CheckCircleOutlined />} onClick={triggerValidate}>
            检测失效
          </Button>
          <Tooltip title="为缺少封面、年份、地区、演员等信息的视频补充完整数据">
            <Button icon={<PictureOutlined />} onClick={fixCovers}>
              修复数据
            </Button>
          </Tooltip>
          <Tooltip title="重新建立视频与演员的关联关系">
            <Button icon={<TeamOutlined />} onClick={handleRebuildActors}>
              重建演员
            </Button>
          </Tooltip>
          <Button icon={<ReloadOutlined />} onClick={() => { loadStats(); loadTasks(); }}>
            刷新
          </Button>
        </Space>
      </Card>

      {/* 任务列表 */}
      <Card title="采集历史">
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      {/* 采集配置弹窗 */}
      <Modal
        title="手动触发采集"
        open={modalVisible}
        onOk={triggerCollect}
        onCancel={() => setModalVisible(false)}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <label>任务类型：</label>
            <Select
              value={taskType}
              onChange={setTaskType}
              style={{ width: '100%', marginTop: 8 }}
            >
              <Select.Option value="incremental">增量采集（推荐）</Select.Option>
              <Select.Option value="full">全量采集</Select.Option>
            </Select>
          </div>
          <div>
            <label>采集数量限制：</label>
            <InputNumber
              value={limit}
              onChange={(val) => setLimit(val || 100)}
              min={10}
              max={1000}
              style={{ width: '100%', marginTop: 8 }}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default CollectManagement;
