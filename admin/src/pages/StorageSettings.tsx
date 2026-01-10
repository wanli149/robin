/**
 * Storage Settings Page
 * 存储配置页面 - 管理播放进度同步
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
  Divider,
  Popconfirm,
} from 'antd';
import { useNotification } from '../components/providers';
import {
  SaveOutlined,
  CloudSyncOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import apiClient from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface StorageConfig {
  storage_type: string;
  connection_url: string;
  api_key: string;
  is_enabled: boolean;
  sync_strategy: string;
  sync_interval: number;
  last_sync_at: number | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
}

interface StorageStats {
  total_records: number;
  active_users: number;
  today_syncs: number;
  today_records: number;
  recent_logs: any[];
}

const StorageSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [config, setConfig] = useState<StorageConfig | null>(null);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const { success, error } = useNotification();

  // 加载配置
  const loadConfig = async () => {
    try {
      const response = await apiClient.get('/admin/storage/config');
      if (response.data.code === 1) {
        setConfig(response.data.data);
        form.setFieldsValue(response.data.data);
      }
    } catch (err: any) {
      error(err.message || '加载配置失败');
    }
  };

  // 加载统计
  const loadStats = async () => {
    try {
      const response = await apiClient.get('/admin/storage/stats');
      if (response.data.code === 1) {
        setStats(response.data.data);
      }
    } catch (error: any) {
      console.error('Load stats error:', error);
    }
  };

  // 保存配置
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      const response = await apiClient.post('/admin/storage/config', values);
      if (response.data.code === 1) {
        success('存储配置保存成功');
        loadConfig();
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

  // 测试连接
  const handleTestConnection = async () => {
    try {
      const values = await form.validateFields(['storage_type', 'connection_url', 'api_key']);
      setTestLoading(true);
      
      const response = await apiClient.post('/admin/storage/test', values);
      if (response.data.code === 1) {
        success('连接测试成功');
      } else {
        error(response.data.msg || '连接测试失败');
      }
    } catch (err: any) {
      if (err.errorFields) return;
      error(err.message || '连接测试失败');
    } finally {
      setTestLoading(false);
    }
  };

  // 清除所有进度数据
  const handleClearProgress = async () => {
    try {
      setLoading(true);
      const response = await apiClient.delete('/admin/storage/progress');
      if (response.data.code === 1) {
        success('播放进度数据已清除');
        loadStats();
      } else {
        error(response.data.msg || '清除失败');
      }
    } catch (err: any) {
      error(err.message || '清除失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    loadStats();
  }, []);

  // 同步日志表格列
  const logColumns = [
    {
      title: '类型',
      dataIndex: 'sync_type',
      key: 'sync_type',
      render: (type: string) => (
        <Tag color={type === 'upload' ? 'blue' : type === 'download' ? 'green' : 'purple'}>
          {type === 'upload' ? '上传' : type === 'download' ? '下载' : '全量'}
        </Tag>
      ),
    },
    {
      title: '记录数',
      dataIndex: 'records_count',
      key: 'records_count',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'success' ? 'green' : status === 'partial' ? 'orange' : 'red'}>
          {status === 'success' ? '成功' : status === 'partial' ? '部分成功' : '失败'}
        </Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (timestamp: number) => new Date(timestamp * 1000).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <DatabaseOutlined /> 存储配置
      </Title>
      <Paragraph type="secondary">
        配置播放进度的存储方式，支持本地存储和云端同步
      </Paragraph>

      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 功能说明 */}
        <Alert
          message="功能说明"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li><strong>本地存储</strong>：播放进度保存在用户设备本地，不同设备间无法同步</li>
              <li><strong>本地+云端</strong>：本地缓存 + 后台同步到云端，支持多设备同步</li>
              <li><strong>仅云端</strong>：所有进度直接存储在云端，需要网络连接</li>
            </ul>
          }
          type="info"
          showIcon
        />

        {/* 统计卡片 */}
        {stats && (
          <Row gutter={16}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总进度记录"
                  value={stats.total_records}
                  prefix={<DatabaseOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="活跃用户"
                  value={stats.active_users}
                  prefix={<CloudSyncOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="今日同步次数"
                  value={stats.today_syncs}
                  prefix={<SyncOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="今日同步记录"
                  value={stats.today_records}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* 存储配置表单 */}
        <Card 
          title="存储配置"
          extra={
            <Space>
              <Text type="secondary">云端同步</Text>
              <Switch
                checked={config?.is_enabled}
                checkedChildren="开启"
                unCheckedChildren="关闭"
                onChange={(checked) => {
                  form.setFieldValue('is_enabled', checked);
                  setConfig(prev => prev ? { ...prev, is_enabled: checked } : null);
                }}
              />
            </Space>
          }
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              storage_type: 'local',
              sync_strategy: 'local_only',
              sync_interval: 30,
              is_enabled: false,
            }}
          >
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  label="存储类型"
                  name="storage_type"
                  rules={[{ required: true, message: '请选择存储类型' }]}
                >
                  <Select>
                    <Option value="local">本地存储（D1数据库）</Option>
                    <Option value="supabase">Supabase</Option>
                    <Option value="firebase">Firebase</Option>
                    <Option value="custom">自定义数据库</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="同步策略"
                  name="sync_strategy"
                  rules={[{ required: true, message: '请选择同步策略' }]}
                >
                  <Select>
                    <Option value="local_only">仅本地</Option>
                    <Option value="local_cloud">本地 + 云端</Option>
                    <Option value="cloud_only">仅云端</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => 
                prevValues.storage_type !== currentValues.storage_type
              }
            >
              {({ getFieldValue }) => {
                const storageType = getFieldValue('storage_type');
                if (storageType === 'local') return null;

                return (
                  <>
                    <Form.Item
                      label="连接URL"
                      name="connection_url"
                      rules={[
                        { required: storageType !== 'local', message: '请输入连接URL' },
                        { type: 'url', message: '请输入有效的URL' },
                      ]}
                      help={
                        storageType === 'supabase' 
                          ? '格式：https://your-project.supabase.co'
                          : storageType === 'firebase'
                          ? '格式：https://your-project.firebaseio.com'
                          : '输入数据库连接URL'
                      }
                    >
                      <Input placeholder="https://..." />
                    </Form.Item>

                    <Form.Item
                      label="API密钥"
                      name="api_key"
                      help="API密钥将加密存储，不会明文显示"
                    >
                      <Input.Password placeholder="输入API密钥" />
                    </Form.Item>
                  </>
                );
              }}
            </Form.Item>

            <Form.Item
              label="同步间隔（秒）"
              name="sync_interval"
              help="APP后台同步进度的时间间隔"
            >
              <Select>
                <Option value={10}>10秒</Option>
                <Option value={30}>30秒</Option>
                <Option value={60}>1分钟</Option>
                <Option value={300}>5分钟</Option>
              </Select>
            </Form.Item>

            <Form.Item name="is_enabled" hidden>
              <Input />
            </Form.Item>

            <Divider />

            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={loading}
                >
                  保存配置
                </Button>
                <Button
                  icon={<CloudSyncOutlined />}
                  onClick={handleTestConnection}
                  loading={testLoading}
                >
                  测试连接
                </Button>
              </Space>
            </Form.Item>
          </Form>

          {/* 上次同步状态 */}
          {config?.last_sync_at && (
            <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <Space>
                {config.last_sync_status === 'success' ? (
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                )}
                <Text>
                  上次同步：{new Date(config.last_sync_at * 1000).toLocaleString('zh-CN')}
                </Text>
                <Tag color={config.last_sync_status === 'success' ? 'green' : 'red'}>
                  {config.last_sync_status === 'success' ? '成功' : '失败'}
                </Tag>
                {config.last_sync_error && (
                  <Text type="danger">{config.last_sync_error}</Text>
                )}
              </Space>
            </div>
          )}
        </Card>

        {/* 同步日志 */}
        {stats && stats.recent_logs.length > 0 && (
          <Card title="最近同步日志">
            <Table
              dataSource={stats.recent_logs}
              columns={logColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        )}

        {/* 危险操作 */}
        <Card title="危险操作" style={{ borderColor: '#ff4d4f' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert
              message="警告"
              description="以下操作不可恢复，请谨慎操作"
              type="warning"
              showIcon
            />
            <Popconfirm
              title="确定要清除所有播放进度数据吗？"
              description="此操作不可恢复，所有用户的播放进度将被删除"
              onConfirm={handleClearProgress}
              okText="确定清除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />} loading={loading}>
                清除所有播放进度
              </Button>
            </Popconfirm>
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default StorageSettings;
