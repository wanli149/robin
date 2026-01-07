/**
 * Reports Management Page
 * 上报管理页面 - 崩溃日志和播放失效
 */

import { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Tabs,
  Tag,
  Button,
  Space,
  message,
  Modal,
} from 'antd';
import {
  BugOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

interface CrashReport {
  id: number;
  user_id: number | null;
  error: string;
  context: string;
  device_info: string;
  app_version: string;
  created_at: number;
}

interface InvalidUrl {
  id: number;
  vod_id: string;
  vod_name: string;
  play_url: string;
  error_type: string;
  reported_by: string;
  reported_at: number;
  is_fixed: boolean;
}

const ReportsManagement: React.FC = () => {
  const [crashLoading, setcrashLoading] = useState(false);
  const [invalidLoading, setInvalidLoading] = useState(false);
  const [crashReports, setCrashReports] = useState<CrashReport[]>([]);
  const [invalidUrls, setInvalidUrls] = useState<InvalidUrl[]>([]);
  const [crashTotal, setCrashTotal] = useState(0);
  const [invalidTotal, setInvalidTotal] = useState(0);
  const [showFixed, setShowFixed] = useState(false);

  // 加载崩溃日志
  const loadCrashReports = async () => {
    setcrashLoading(true);
    try {
      const { getCrashReports } = await import('../services/adminApi');
      const data = await getCrashReports(50, 0);
      setCrashReports(data.list);
      setCrashTotal(data.total);
    } catch (error: any) {
      message.error(error.message || '加载崩溃日志失败');
    } finally {
      setcrashLoading(false);
    }
  };

  // 加载播放失效上报
  const loadInvalidUrls = async () => {
    setInvalidLoading(true);
    try {
      const { getInvalidUrls } = await import('../services/adminApi');
      const data = await getInvalidUrls(50, 0, showFixed ? undefined : false);
      setInvalidUrls(data.list);
      setInvalidTotal(data.total);
    } catch (error: any) {
      message.error(error.message || '加载失效上报失败');
    } finally {
      setInvalidLoading(false);
    }
  };

  // 标记为已修复
  const handleMarkFixed = async (id: number) => {
    try {
      const { markInvalidUrlFixed } = await import('../services/adminApi');
      await markInvalidUrlFixed(id);
      message.success('已标记为修复');
      loadInvalidUrls();
    } catch (error: any) {
      message.error(error.message || '标记失败');
    }
  };

  // 查看详情
  const showCrashDetail = (record: CrashReport) => {
    let deviceInfo = {};
    try {
      deviceInfo = JSON.parse(record.device_info);
    } catch (e) {
      deviceInfo = { raw: record.device_info };
    }

    Modal.info({
      title: '崩溃详情',
      width: 800,
      content: (
        <div style={{ maxHeight: 500, overflow: 'auto' }}>
          <p><strong>错误信息：</strong></p>
          <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
            {record.error}
          </pre>
          
          {record.context && (
            <>
              <p><strong>上下文：</strong></p>
              <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                {record.context}
              </pre>
            </>
          )}
          
          <p><strong>设备信息：</strong></p>
          <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
            {JSON.stringify(deviceInfo, null, 2)}
          </pre>
          
          <p><strong>应用版本：</strong> {record.app_version}</p>
          <p><strong>用户ID：</strong> {record.user_id || '未登录'}</p>
          <p><strong>时间：</strong> {new Date(record.created_at * 1000).toLocaleString()}</p>
        </div>
      ),
    });
  };

  useEffect(() => {
    loadCrashReports();
    loadInvalidUrls();
  }, [showFixed]);

  const crashColumns: ColumnsType<CrashReport> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '错误信息',
      dataIndex: 'error',
      key: 'error',
      ellipsis: true,
      render: (text: string) => (
        <span style={{ color: '#ff4d4f' }}>{text}</span>
      ),
    },
    {
      title: '上下文',
      dataIndex: 'context',
      key: 'context',
      width: 150,
      ellipsis: true,
    },
    {
      title: '版本',
      dataIndex: 'app_version',
      key: 'app_version',
      width: 100,
    },
    {
      title: '用户ID',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 100,
      render: (id: number | null) => id || '-',
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (timestamp: number) => new Date(timestamp * 1000).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: CrashReport) => (
        <Button
          type="link"
          size="small"
          onClick={() => showCrashDetail(record)}
        >
          查看详情
        </Button>
      ),
    },
  ];

  const invalidColumns: ColumnsType<InvalidUrl> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '视频ID',
      dataIndex: 'vod_id',
      key: 'vod_id',
      width: 120,
    },
    {
      title: '视频名称',
      dataIndex: 'vod_name',
      key: 'vod_name',
      ellipsis: true,
    },
    {
      title: '播放地址',
      dataIndex: 'play_url',
      key: 'play_url',
      ellipsis: true,
      width: 200,
    },
    {
      title: '错误类型',
      dataIndex: 'error_type',
      key: 'error_type',
      width: 120,
      render: (type: string) => {
        const colorMap: Record<string, string> = {
          timeout: 'orange',
          '404': 'red',
          '403': 'volcano',
          parse_error: 'purple',
          playback_failed: 'red',
        };
        return <Tag color={colorMap[type] || 'default'}>{type}</Tag>;
      },
    },
    {
      title: '上报来源',
      dataIndex: 'reported_by',
      key: 'reported_by',
      width: 100,
      render: (by: string) => (
        <Tag color={by === 'user' ? 'blue' : 'green'}>{by}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_fixed',
      key: 'is_fixed',
      width: 100,
      render: (fixed: boolean) => (
        <Tag color={fixed ? 'success' : 'warning'}>
          {fixed ? '已修复' : '待处理'}
        </Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'reported_at',
      key: 'reported_at',
      width: 180,
      render: (timestamp: number) => new Date(timestamp * 1000).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: InvalidUrl) => (
        <Space size="small">
          {!record.is_fixed && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleMarkFixed(record.id)}
            >
              标记修复
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>上报管理</Title>

      <Tabs
        defaultActiveKey="crash"
        items={[
          {
            key: 'crash',
            label: (
              <span>
                <BugOutlined />
                崩溃日志 ({crashTotal})
              </span>
            ),
            children: (
              <Card>
                <Table
                  columns={crashColumns}
                  dataSource={crashReports}
                  rowKey="id"
                  loading={crashLoading}
                  pagination={{
                    total: crashTotal,
                    pageSize: 50,
                    showTotal: (total) => `共 ${total} 条`,
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'invalid',
            label: (
              <span>
                <PlayCircleOutlined />
                播放失效 ({invalidTotal})
              </span>
            ),
            children: (
              <Card>
                <div style={{ marginBottom: 16 }}>
                  <Space>
                    <Button
                      type={!showFixed ? 'primary' : 'default'}
                      onClick={() => setShowFixed(false)}
                    >
                      待处理
                    </Button>
                    <Button
                      type={showFixed ? 'primary' : 'default'}
                      onClick={() => setShowFixed(true)}
                    >
                      全部
                    </Button>
                  </Space>
                </div>

                <Table
                  columns={invalidColumns}
                  dataSource={invalidUrls}
                  rowKey="id"
                  loading={invalidLoading}
                  pagination={{
                    total: invalidTotal,
                    pageSize: 50,
                    showTotal: (total) => `共 ${total} 条`,
                  }}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

export default ReportsManagement;
