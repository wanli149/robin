/**
 * Version Management Page
 * 版本管理页面 - 增强版
 */

import { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Form,
  Input,
  Button,
  Checkbox,
  Space,
  Alert,
  Table,
  Tag,
  Popconfirm,
  Select,
  Statistic,
  Row,
  Col,
} from 'antd';
import { useNotification } from '../components/providers';
import {
  RocketOutlined,
  DeleteOutlined,
  HistoryOutlined,
  AndroidOutlined,
  AppleOutlined,
  WindowsOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getVersions, releaseVersionV2, deleteVersion, type AppVersion } from '../services/adminApi';

const { Title, Text } = Typography;
const { TextArea } = Input;

const VersionManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const { success, error } = useNotification();

  // 加载历史版本
  const loadVersions = async () => {
    setLoadingVersions(true);
    try {
      const list = await getVersions();
      setVersions(list);
    } catch (err: any) {
      // 表可能不存在，静默处理
      logger.admin.info('No version history yet');
    } finally {
      setLoadingVersions(false);
    }
  };

  // 发布版本
  const handleRelease = async (values: any) => {
    setLoading(true);
    try {
      await releaseVersionV2({
        version: values.version,
        url: values.url,
        force: values.force || false,
        changelog: values.changelog,
        platform: values.platform || 'android',
      });
      success('版本发布成功');
      form.resetFields();
      loadVersions();
    } catch (err: any) {
      error(err.message || '发布失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除版本
  const handleDelete = async (id: number) => {
    try {
      await deleteVersion(id);
      success('删除成功');
      loadVersions();
    } catch (err: any) {
      error(err.message || '删除失败');
    }
  };

  useEffect(() => {
    loadVersions();
  }, []);

  // 获取平台图标
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'ios':
        return <AppleOutlined />;
      case 'windows':
        return <WindowsOutlined />;
      default:
        return <AndroidOutlined />;
    }
  };

  const columns: ColumnsType<AppVersion> = [
    {
      title: '版本号',
      dataIndex: 'version',
      key: 'version',
      width: 120,
      render: (version: string) => (
        <Tag color="blue" style={{ fontSize: 14 }}>v{version}</Tag>
      ),
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (platform: string) => (
        <Space>
          {getPlatformIcon(platform)}
          <span>{platform === 'ios' ? 'iOS' : platform === 'windows' ? 'Windows' : 'Android'}</span>
        </Space>
      ),
    },
    {
      title: '强制更新',
      dataIndex: 'force_update',
      key: 'force_update',
      width: 100,
      render: (force: boolean) => (
        <Tag color={force ? 'red' : 'default'}>
          {force ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '下载链接',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (url: string) => (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>
      ),
    },
    {
      title: '更新日志',
      dataIndex: 'changelog',
      key: 'changelog',
      ellipsis: true,
      width: 200,
    },
    {
      title: '下载次数',
      dataIndex: 'download_count',
      key: 'download_count',
      width: 100,
      render: (count: number) => count?.toLocaleString() || 0,
    },
    {
      title: '发布时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (timestamp: number) => {
        if (!timestamp) return '-';
        return new Date(timestamp * 1000).toLocaleString('zh-CN');
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="确定删除这个版本记录吗？"
          onConfirm={() => handleDelete(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" danger icon={<DeleteOutlined />} size="small">
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  // 统计数据
  const latestVersion = versions[0];
  const totalDownloads = versions.reduce((sum, v) => sum + (v.download_count || 0), 0);

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>版本管理</Title>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="当前版本"
              value={latestVersion?.version || '-'}
              prefix="v"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="历史版本数"
              value={versions.length}
              prefix={<HistoryOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总下载次数"
              value={totalDownloads}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="强制更新版本"
              value={versions.filter(v => v.force_update).length}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Alert
        message="版本发布说明"
        description={
          <div>
            <p>• 版本号格式：主版本号.次版本号.修订号（如：1.2.3）</p>
            <p>• 强制更新：勾选后，低于此版本的用户将无法跳过更新</p>
            <p>• 下载链接：APP 安装包的下载地址</p>
            <p>• 更新日志：向用户展示的更新内容</p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card title="发布新版本" style={{ marginBottom: 24 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleRelease}
          initialValues={{
            force: false,
            platform: 'android',
          }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="版本号"
                name="version"
                rules={[
                  { required: true, message: '请输入版本号' },
                  {
                    pattern: /^\d+\.\d+\.\d+$/,
                    message: '版本号格式不正确，应为 x.y.z',
                  },
                ]}
              >
                <Input placeholder="1.0.0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="平台"
                name="platform"
              >
                <Select>
                  <Select.Option value="android">
                    <Space><AndroidOutlined /> Android</Space>
                  </Select.Option>
                  <Select.Option value="ios">
                    <Space><AppleOutlined /> iOS</Space>
                  </Select.Option>
                  <Select.Option value="windows">
                    <Space><WindowsOutlined /> Windows</Space>
                  </Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="force" valuePropName="checked" style={{ marginTop: 30 }}>
                <Checkbox>
                  <Space>
                    <Text strong>强制更新</Text>
                    <Text type="secondary">（用户必须更新）</Text>
                  </Space>
                </Checkbox>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="下载链接"
            name="url"
            rules={[
              { required: true, message: '请输入下载链接' },
              { type: 'url', message: '请输入有效的URL' },
            ]}
          >
            <Input placeholder="https://example.com/app-v1.0.0.apk" />
          </Form.Item>

          <Form.Item
            label="更新日志"
            name="changelog"
            rules={[{ required: true, message: '请输入更新日志' }]}
          >
            <TextArea
              rows={6}
              placeholder={`1. 新增功能A\n2. 优化功能B\n3. 修复已知问题`}
              maxLength={1000}
              showCount
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<RocketOutlined />}
              loading={loading}
              size="large"
            >
              发布版本
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="历史版本记录">
        <Table
          columns={columns}
          dataSource={versions}
          rowKey="id"
          loading={loadingVersions}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个版本`,
          }}
        />
      </Card>
    </div>
  );
};

export default VersionManagement;
