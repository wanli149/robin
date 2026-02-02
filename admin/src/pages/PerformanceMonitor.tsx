/**
 * Performance Monitor Page
 * 性能监控页面 - 显示采集引擎的详细性能指标
 */

import { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Table,
  Button,
  Alert,
  Space,
} from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getCollectMetrics } from '../services/adminApi';

interface CollectorMetrics {
  totalVideos: number;
  validVideos: number;
  invalidVideos: number;
  avgQualityScore: number;
  excellentCount: number;
  goodCount: number;
  fairCount: number;
  poorCount: number;
  todayNew: number;
  todayUpdated: number;
  weekNew: number;
  totalTasks: number;
  successTasks: number;
  failedTasks: number;
  avgDuration: number;
  avgSuccessRate: number;
  sourceDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
}

interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
}

const PerformanceMonitor: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<CollectorMetrics | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [report, setReport] = useState<string>('');

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const data = await getCollectMetrics();
      setMetrics(data.metrics);
      setHealth(data.health);
      setReport(data.report);
    } catch (error) {
      logger.admin.error('Failed to load metrics:', { error });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
    // 每30秒自动刷新
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  // 健康状态配置
  const healthConfig = {
    healthy: {
      color: 'success',
      icon: <CheckCircleOutlined />,
      text: '健康',
      alertType: 'success' as const,
    },
    warning: {
      color: 'warning',
      icon: <WarningOutlined />,
      text: '警告',
      alertType: 'warning' as const,
    },
    critical: {
      color: 'error',
      icon: <CloseCircleOutlined />,
      text: '严重',
      alertType: 'error' as const,
    },
  };

  const currentHealth = health ? healthConfig[health.status] : healthConfig.healthy;

  // 数据源分布表格列
  const sourceColumns: ColumnsType<{ source: string; count: number }> = [
    {
      title: '数据源',
      dataIndex: 'source',
      key: 'source',
    },
    {
      title: '视频数量',
      dataIndex: 'count',
      key: 'count',
      sorter: (a, b) => b.count - a.count,
      render: (count: number) => count.toLocaleString(),
    },
    {
      title: '占比',
      key: 'percentage',
      render: (_, record) => {
        const percentage = metrics
          ? ((record.count / metrics.totalVideos) * 100).toFixed(1)
          : '0';
        return `${percentage}%`;
      },
    },
  ];

  // 分类分布表格列
  const typeColumns: ColumnsType<{ type: string; count: number }> = [
    {
      title: '分类',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: '视频数量',
      dataIndex: 'count',
      key: 'count',
      sorter: (a, b) => b.count - a.count,
      render: (count: number) => count.toLocaleString(),
    },
    {
      title: '占比',
      key: 'percentage',
      render: (_, record) => {
        const percentage = metrics
          ? ((record.count / metrics.totalVideos) * 100).toFixed(1)
          : '0';
        return `${percentage}%`;
      },
    },
  ];

  const sourceData = metrics
    ? Object.entries(metrics.sourceDistribution).map(([source, count]) => ({
        source,
        count,
      }))
    : [];

  const typeData = metrics
    ? Object.entries(metrics.typeDistribution).map(([type, count]) => ({
        type,
        count,
      }))
    : [];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2>性能监控</h2>
        <Button icon={<ReloadOutlined />} onClick={loadMetrics} loading={loading}>
          刷新
        </Button>
      </div>

      {/* 健康状态告警 */}
      {health && health.issues.length > 0 && (
        <Alert
          message={`系统状态：${currentHealth.text}`}
          description={
            <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
              {health.issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          }
          type={currentHealth.alertType}
          icon={currentHealth.icon}
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 核心指标 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总视频数"
              value={metrics?.totalVideos || 0}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="有效率"
              value={
                metrics
                  ? ((metrics.validVideos / metrics.totalVideos) * 100).toFixed(1)
                  : 0
              }
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{
                color:
                  metrics && metrics.validVideos / metrics.totalVideos >= 0.8
                    ? '#3f8600'
                    : '#ff4d4f',
              }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均质量分"
              value={metrics?.avgQualityScore || 0}
              suffix="/ 110"
              prefix={<ThunderboltOutlined />}
              valueStyle={{
                color: metrics && metrics.avgQualityScore >= 60 ? '#3f8600' : '#ff4d4f',
              }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="任务成功率"
              value={metrics?.avgSuccessRate || 0}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{
                color: metrics && metrics.avgSuccessRate >= 80 ? '#3f8600' : '#ff4d4f',
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 数据质量分布 */}
      <Card title="数据质量分布" style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={6}>
            <div style={{ padding: '12px 0' }}>
              <Statistic
                title="优秀 (80+)"
                value={metrics?.excellentCount || 0}
                valueStyle={{ color: '#52c41a' }}
              />
              <Progress
                percent={
                  metrics && metrics.totalVideos > 0
                    ? Number(((metrics.excellentCount / metrics.totalVideos) * 100).toFixed(1))
                    : 0
                }
                strokeColor="#52c41a"
                size="small"
                style={{ marginTop: 8 }}
              />
            </div>
          </Col>
          <Col span={6}>
            <div style={{ padding: '12px 0' }}>
              <Statistic
                title="良好 (60-79)"
                value={metrics?.goodCount || 0}
                valueStyle={{ color: '#1890ff' }}
              />
              <Progress
                percent={
                  metrics && metrics.totalVideos > 0
                    ? Number(((metrics.goodCount / metrics.totalVideos) * 100).toFixed(1))
                    : 0
                }
                strokeColor="#1890ff"
                size="small"
                style={{ marginTop: 8 }}
              />
            </div>
          </Col>
          <Col span={6}>
            <div style={{ padding: '12px 0' }}>
              <Statistic
                title="一般 (40-59)"
                value={metrics?.fairCount || 0}
                valueStyle={{ color: '#faad14' }}
              />
              <Progress
                percent={
                  metrics && metrics.totalVideos > 0
                    ? Number(((metrics.fairCount / metrics.totalVideos) * 100).toFixed(1))
                    : 0
                }
                strokeColor="#faad14"
                size="small"
                style={{ marginTop: 8 }}
              />
            </div>
          </Col>
          <Col span={6}>
            <div style={{ padding: '12px 0' }}>
              <Statistic
                title="较差 (<40)"
                value={metrics?.poorCount || 0}
                valueStyle={{ color: '#ff4d4f' }}
              />
              <Progress
                percent={
                  metrics && metrics.totalVideos > 0
                    ? Number(((metrics.poorCount / metrics.totalVideos) * 100).toFixed(1))
                    : 0
                }
                strokeColor="#ff4d4f"
                size="small"
                style={{ marginTop: 8 }}
              />
            </div>
          </Col>
        </Row>
      </Card>

      {/* 采集统计 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card title="采集统计">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Statistic title="今日新增" value={metrics?.todayNew || 0} />
              <Statistic title="今日更新" value={metrics?.todayUpdated || 0} />
              <Statistic title="本周新增" value={metrics?.weekNew || 0} />
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="任务统计">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Statistic title="总任务数" value={metrics?.totalTasks || 0} />
              <Statistic
                title="成功任务"
                value={metrics?.successTasks || 0}
                valueStyle={{ color: '#3f8600' }}
              />
              <Statistic
                title="失败任务"
                value={metrics?.failedTasks || 0}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="性能指标">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Statistic
                title="平均耗时"
                value={metrics?.avgDuration || 0}
                suffix="秒"
              />
              <Statistic
                title="成功率"
                value={metrics?.avgSuccessRate || 0}
                suffix="%"
                valueStyle={{
                  color: metrics && metrics.avgSuccessRate >= 80 ? '#3f8600' : '#ff4d4f',
                }}
              />
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 数据源分布 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="数据源分布">
            <Table
              columns={sourceColumns}
              dataSource={sourceData}
              rowKey="source"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="分类分布">
            <Table
              columns={typeColumns}
              dataSource={typeData}
              rowKey="type"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* 详细报告 */}
      {report && (
        <Card title="详细报告">
          <div
            style={{
              backgroundColor: '#f5f5f5',
              borderRadius: 8,
              padding: 16,
              maxHeight: 500,
              overflow: 'auto',
            }}
          >
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: 13,
                lineHeight: 1.6,
                margin: 0,
                color: '#333',
              }}
            >
              {report}
            </pre>
          </div>
        </Card>
      )}
    </div>
  );
};

export default PerformanceMonitor;
