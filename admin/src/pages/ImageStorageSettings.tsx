/**
 * Image Storage Settings Page
 * 图片云存储配置页面
 */

import { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Form,
  Input,
  Button,
  Space,
  Switch,
  Select,
  Statistic,
  Row,
  Col,
  Table,
  Tag,
  Alert,
  Popconfirm,
  Modal,
  Tabs,
  Tooltip,
  Badge,
} from 'antd';
import { useNotification } from '../components/providers';
import {
  CloudUploadOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  PlusOutlined,
  EditOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import apiClient from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

interface StorageConfig {
  id: number;
  name: string;
  provider: string;
  bucket: string;
  region: string | null;
  endpoint: string | null;
  access_key: string | null;
  secret_key: string | null;
  custom_domain: string | null;
  path_prefix: string;
  is_enabled: number;
  is_default: number;
  created_at: number;
  updated_at: number;
}

interface StorageStats {
  configs: { total: number; enabled: number };
  mappings: { total: number; synced: number; pending: number; failed: number; totalSize: number };
  queue: { total: number; pending: number; processing: number; completed: number; failed: number };
  byProvider: { provider: string; count: number; size: number }[];
  todayUploads: number;
}

interface ImageMapping {
  id: number;
  original_url: string;
  storage_path: string;
  cdn_url: string;
  status: string;
  file_size: number;
  config_name: string;
  provider: string;
  created_at: number;
}

interface QueueItem {
  id: number;
  original_url: string;
  image_type: string;
  reference_id: string;
  status: string;
  retry_count: number;
  error_message: string | null;
  created_at: number;
}

const PROVIDER_OPTIONS = [
  { value: 'r2', label: 'Cloudflare R2', color: 'orange' },
  { value: 'qiniu', label: '七牛云', color: 'blue' },
  { value: 'aliyun', label: '阿里云 OSS', color: 'red' },
  { value: 'tencent', label: '腾讯云 COS', color: 'green' },
];

const ImageStorageSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<StorageConfig[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [mappings, setMappings] = useState<ImageMapping[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [mappingTotal, setMappingTotal] = useState(0);
  const [queueTotal, setQueueTotal] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<StorageConfig | null>(null);
  const [activeTab, setActiveTab] = useState('configs');
  const { success, error } = useNotification();

  // 加载配置列表
  const loadConfigs = async () => {
    try {
      const response = await apiClient.get('/admin/image-storage/configs');
      if (response.data.code === 1) {
        setConfigs(response.data.data);
      }
    } catch (err: any) {
      error(err.message || '加载配置失败');
    }
  };

  // 加载统计
  const loadStats = async () => {
    try {
      const response = await apiClient.get('/admin/image-storage/stats');
      if (response.data.code === 1) {
        setStats(response.data.data);
      }
    } catch (err: any) {
      logger.admin.error('Load stats error:', { error: err });
    }
  };

  // 加载映射列表
  const loadMappings = async (page = 1) => {
    try {
      const response = await apiClient.get('/admin/image-storage/mappings', {
        params: { page, pageSize: 10 },
      });
      if (response.data.code === 1) {
        setMappings(response.data.data.list);
        setMappingTotal(response.data.data.total);
      }
    } catch (err: any) {
      logger.admin.error('Load mappings error:', { error: err });
    }
  };

  // 加载队列
  const loadQueue = async (page = 1) => {
    try {
      const response = await apiClient.get('/admin/image-storage/queue', {
        params: { page, pageSize: 10 },
      });
      if (response.data.code === 1) {
        setQueue(response.data.data.list);
        setQueueTotal(response.data.data.total);
      }
    } catch (err: any) {
      logger.admin.error('Load queue error:', { error: err });
    }
  };

  // 保存配置
  const handleSaveConfig = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const url = editingConfig
        ? `/admin/image-storage/configs/${editingConfig.id}`
        : '/admin/image-storage/configs';
      const method = editingConfig ? 'put' : 'post';

      const response = await apiClient[method](url, values);
      if (response.data.code === 1) {
        success(editingConfig ? '配置更新成功' : '配置创建成功');
        setModalVisible(false);
        form.resetFields();
        setEditingConfig(null);
        loadConfigs();
        loadStats();
      } else {
        error(response.data.msg || '保存失败');
      }
    } catch (err: any) {
      if (err.errorFields) return;
      error(err.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除配置
  const handleDeleteConfig = async (id: number) => {
    try {
      const response = await apiClient.delete(`/admin/image-storage/configs/${id}`);
      if (response.data.code === 1) {
        success('删除成功');
        loadConfigs();
        loadStats();
      } else {
        error(response.data.msg || '删除失败');
      }
    } catch (err: any) {
      error(err.message || '删除失败');
    }
  };

  // 测试连接
  const handleTestConnection = async (id: number) => {
    try {
      setLoading(true);
      const response = await apiClient.post(`/admin/image-storage/configs/${id}/test`);
      if (response.data.code === 1) {
        success('连接测试成功');
      } else {
        error(response.data.msg || '连接测试失败');
      }
    } catch (err: any) {
      error(err.message || '连接测试失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理队列
  const handleProcessQueue = async () => {
    try {
      setLoading(true);
      const response = await apiClient.post('/admin/image-storage/process-queue');
      if (response.data.code === 1) {
        success(response.data.msg);
        loadStats();
        loadQueue();
      } else {
        error(response.data.msg || '处理失败');
      }
    } catch (err: any) {
      error(err.message || '处理失败');
    } finally {
      setLoading(false);
    }
  };

  // 重试失败任务
  const handleRetryAll = async () => {
    try {
      const response = await apiClient.post('/admin/image-storage/queue/retry-all');
      if (response.data.code === 1) {
        success(response.data.msg);
        loadQueue();
        loadStats();
      } else {
        error(response.data.msg || '重试失败');
      }
    } catch (err: any) {
      error(err.message || '重试失败');
    }
  };

  // 清理已完成任务
  const handleClearCompleted = async () => {
    try {
      const response = await apiClient.delete('/admin/image-storage/queue/completed');
      if (response.data.code === 1) {
        success(response.data.msg);
        loadQueue();
        loadStats();
      } else {
        error(response.data.msg || '清理失败');
      }
    } catch (err: any) {
      error(err.message || '清理失败');
    }
  };

  // 打开编辑弹窗
  const openEditModal = (config?: StorageConfig) => {
    setEditingConfig(config || null);
    if (config) {
      form.setFieldsValue({
        ...config,
        is_enabled: config.is_enabled === 1,
        is_default: config.is_default === 1,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        provider: 'r2',
        path_prefix: 'images',
        is_enabled: true,
        is_default: false,
      });
    }
    setModalVisible(true);
  };

  useEffect(() => {
    loadConfigs();
    loadStats();
    loadMappings();
    loadQueue();
  }, []);

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 配置表格列
  const configColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: StorageConfig) => (
        <Space>
          {name}
          {record.is_default === 1 && <Tag color="gold">默认</Tag>}
        </Space>
      ),
    },
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      render: (provider: string) => {
        const opt = PROVIDER_OPTIONS.find(p => p.value === provider);
        return <Tag color={opt?.color || 'default'}>{opt?.label || provider}</Tag>;
      },
    },
    {
      title: '存储桶',
      dataIndex: 'bucket',
      key: 'bucket',
    },
    {
      title: '自定义域名',
      dataIndex: 'custom_domain',
      key: 'custom_domain',
      render: (domain: string) => domain || '-',
    },
    {
      title: '状态',
      dataIndex: 'is_enabled',
      key: 'is_enabled',
      render: (enabled: number) => (
        <Badge status={enabled === 1 ? 'success' : 'default'} text={enabled === 1 ? '启用' : '禁用'} />
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: StorageConfig) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            编辑
          </Button>
          <Button size="small" icon={<SyncOutlined />} onClick={() => handleTestConnection(record.id)}>
            测试
          </Button>
          <Popconfirm
            title="确定删除此配置？"
            onConfirm={() => handleDeleteConfig(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 映射表格列
  const mappingColumns = [
    {
      title: '原始URL',
      dataIndex: 'original_url',
      key: 'original_url',
      ellipsis: true,
      width: 200,
      render: (url: string) => (
        <Tooltip title={url}>
          <Text copyable={{ text: url }} style={{ maxWidth: 180 }} ellipsis>
            {url}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'CDN URL',
      dataIndex: 'cdn_url',
      key: 'cdn_url',
      ellipsis: true,
      width: 200,
      render: (url: string) => url ? (
        <Tooltip title={url}>
          <Text copyable={{ text: url }} style={{ maxWidth: 180 }} ellipsis>
            {url}
          </Text>
        </Tooltip>
      ) : '-',
    },
    {
      title: '存储',
      dataIndex: 'config_name',
      key: 'config_name',
      render: (name: string, record: ImageMapping) => (
        <Space>
          <Tag color={PROVIDER_OPTIONS.find(p => p.value === record.provider)?.color}>
            {name}
          </Tag>
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'file_size',
      key: 'file_size',
      render: (size: number) => formatSize(size || 0),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = {
          synced: 'green',
          pending: 'orange',
          failed: 'red',
        };
        const labels: Record<string, string> = {
          synced: '已同步',
          pending: '待同步',
          failed: '失败',
        };
        return <Tag color={colors[status] || 'default'}>{labels[status] || status}</Tag>;
      },
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (ts: number) => new Date(ts * 1000).toLocaleString('zh-CN'),
    },
  ];

  // 队列表格列
  const queueColumns = [
    {
      title: '原始URL',
      dataIndex: 'original_url',
      key: 'original_url',
      ellipsis: true,
      width: 250,
    },
    {
      title: '类型',
      dataIndex: 'image_type',
      key: 'image_type',
      render: (type: string) => {
        const labels: Record<string, string> = {
          cover: '封面',
          thumb: '缩略图',
          actor: '演员',
          other: '其他',
        };
        return labels[type] || type;
      },
    },
    {
      title: '关联ID',
      dataIndex: 'reference_id',
      key: 'reference_id',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = {
          pending: 'orange',
          processing: 'blue',
          completed: 'green',
          failed: 'red',
        };
        const labels: Record<string, string> = {
          pending: '等待中',
          processing: '处理中',
          completed: '已完成',
          failed: '失败',
        };
        return <Tag color={colors[status] || 'default'}>{labels[status] || status}</Tag>;
      },
    },
    {
      title: '重试',
      dataIndex: 'retry_count',
      key: 'retry_count',
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      key: 'error_message',
      ellipsis: true,
      render: (msg: string) => msg ? (
        <Tooltip title={msg}>
          <Text type="danger" ellipsis style={{ maxWidth: 150 }}>{msg}</Text>
        </Tooltip>
      ) : '-',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <CloudServerOutlined /> 图片云存储
      </Title>
      <Paragraph type="secondary">
        配置图片云存储服务，支持 Cloudflare R2、七牛云、阿里云 OSS、腾讯云 COS
      </Paragraph>

      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 功能说明 */}
        <Alert
          message="功能说明"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li><strong>图片本地化</strong>：将资源站图片同步到自有云存储，提高访问速度和稳定性</li>
              <li><strong>多云支持</strong>：支持 R2、七牛、阿里云、腾讯云等主流云存储</li>
              <li><strong>异步上传</strong>：采集时自动加入队列，后台异步处理，不影响采集速度</li>
              <li><strong>自动压缩</strong>：支持 WebP 转换和图片压缩，节省存储空间</li>
            </ul>
          }
          type="info"
          showIcon
        />

        {/* 统计卡片 */}
        {stats && (
          <Row gutter={16}>
            <Col span={4}>
              <Card>
                <Statistic
                  title="存储配置"
                  value={stats.configs.enabled}
                  suffix={`/ ${stats.configs.total}`}
                  prefix={<CloudServerOutlined />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="已同步图片"
                  value={stats.mappings.synced}
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="待处理队列"
                  value={stats.queue.pending}
                  prefix={<SyncOutlined style={{ color: '#faad14' }} />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="失败任务"
                  value={stats.queue.failed}
                  prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="今日上传"
                  value={stats.todayUploads}
                  prefix={<CloudUploadOutlined />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="总存储大小"
                  value={formatSize(stats.mappings.totalSize || 0)}
                  prefix={<DatabaseOutlined />}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* 标签页 */}
        <Card>
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane tab="存储配置" key="configs">
              <Space style={{ marginBottom: 16 }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditModal()}>
                  添加配置
                </Button>
                <Button icon={<ReloadOutlined />} onClick={loadConfigs}>
                  刷新
                </Button>
              </Space>
              <Table
                dataSource={configs}
                columns={configColumns}
                rowKey="id"
                pagination={false}
              />
            </TabPane>

            <TabPane tab="图片映射" key="mappings">
              <Space style={{ marginBottom: 16 }}>
                <Button icon={<ReloadOutlined />} onClick={() => loadMappings()}>
                  刷新
                </Button>
              </Space>
              <Table
                dataSource={mappings}
                columns={mappingColumns}
                rowKey="id"
                pagination={{
                  total: mappingTotal,
                  pageSize: 10,
                  onChange: (page) => loadMappings(page),
                }}
              />
            </TabPane>

            <TabPane tab="上传队列" key="queue">
              <Space style={{ marginBottom: 16 }}>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleProcessQueue}
                  loading={loading}
                >
                  立即处理
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleRetryAll}>
                  重试失败
                </Button>
                <Popconfirm
                  title="确定清理所有已完成的任务？"
                  onConfirm={handleClearCompleted}
                >
                  <Button icon={<DeleteOutlined />}>
                    清理已完成
                  </Button>
                </Popconfirm>
                <Button icon={<ReloadOutlined />} onClick={() => loadQueue()}>
                  刷新
                </Button>
              </Space>
              <Table
                dataSource={queue}
                columns={queueColumns}
                rowKey="id"
                pagination={{
                  total: queueTotal,
                  pageSize: 10,
                  onChange: (page) => loadQueue(page),
                }}
              />
            </TabPane>
          </Tabs>
        </Card>
      </Space>

      {/* 配置编辑弹窗 */}
      <Modal
        title={editingConfig ? '编辑存储配置' : '添加存储配置'}
        open={modalVisible}
        onOk={handleSaveConfig}
        onCancel={() => {
          setModalVisible(false);
          setEditingConfig(null);
          form.resetFields();
        }}
        confirmLoading={loading}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="配置名称"
                name="name"
                rules={[{ required: true, message: '请输入配置名称' }]}
              >
                <Input placeholder="如：主存储、备用存储" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="存储提供商"
                name="provider"
                rules={[{ required: true, message: '请选择提供商' }]}
              >
                <Select>
                  {PROVIDER_OPTIONS.map(opt => (
                    <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="存储桶名称"
                name="bucket"
                rules={[{ required: true, message: '请输入存储桶名称' }]}
              >
                <Input placeholder="bucket name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="区域" name="region">
                <Input placeholder="如：us-east-1, cn-hangzhou" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Endpoint" name="endpoint" help="自定义端点地址（可选）">
            <Input placeholder="https://..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Access Key" name="access_key">
                <Input.Password placeholder="访问密钥" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Secret Key" name="secret_key">
                <Input.Password placeholder="密钥" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="自定义域名"
            name="custom_domain"
            help="用于生成 CDN URL，如：https://cdn.example.com"
          >
            <Input placeholder="https://cdn.example.com" />
          </Form.Item>

          <Form.Item
            label="路径前缀"
            name="path_prefix"
            help="图片存储的目录前缀"
          >
            <Input placeholder="images" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="启用" name="is_enabled" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="设为默认" name="is_default" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default ImageStorageSettings;
