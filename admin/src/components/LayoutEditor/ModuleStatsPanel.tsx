/**
 * 模块统计面板
 * 显示模块的使用统计数据
 */

import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Progress, Empty, Spin, Select, Space, Typography } from 'antd';
import { EyeOutlined, ThunderboltOutlined, PercentageOutlined } from '@ant-design/icons';
import { getModuleStats, type ModuleStats } from '../../services/adminApi';

const { Text } = Typography;
const { Option } = Select;

interface ModuleStatsPanelProps {
  tabId: string;
  moduleId?: number;
}

const ModuleStatsPanel: React.FC<ModuleStatsPanelProps> = ({ tabId, moduleId }) => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ModuleStats[]>([]);
  const [days, setDays] = useState(7);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);

  // 加载统计数据
  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await getModuleStats(tabId, days);
      setStats(data.stats);
      setDateRange(data.date_range);
    } catch (error: any) {
      logger.admin.error('Failed to load stats:', { error });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [tabId, days]);

  // 查找当前模块的统计
  const currentModuleStats = moduleId !== undefined
    ? stats.find((s) => s.module_id === moduleId)
    : null;

  // 计算排名
  const getRank = (moduleId: number) => {
    const sorted = [...stats].sort((a, b) => b.total_clicks - a.total_clicks);
    return sorted.findIndex((s) => s.module_id === moduleId) + 1;
  };

  if (loading) {
    return (
      <Card>
        <Spin tip="加载统计数据..." spinning={true}>
          <div style={{ textAlign: 'center', padding: '40px 0' }} />
        </Spin>
      </Card>
    );
  }

  return (
    <Card
      title="使用统计"
      extra={
        <Select
          size="small"
          value={days}
          onChange={setDays}
          style={{ width: 100 }}
        >
          <Option value={1}>今天</Option>
          <Option value={7}>最近7天</Option>
          <Option value={30}>最近30天</Option>
        </Select>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {dateRange && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            统计周期：{dateRange.start} 至 {dateRange.end}
          </Text>
        )}

        {currentModuleStats ? (
          <>
            {/* 当前模块统计 */}
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="曝光次数"
                  value={currentModuleStats.total_views}
                  prefix={<EyeOutlined />}
                  valueStyle={{ fontSize: 20 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="点击次数"
                  value={currentModuleStats.total_clicks}
                  prefix={<ThunderboltOutlined />}
                  valueStyle={{ fontSize: 20 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="点击率"
                  value={currentModuleStats.click_rate?.toFixed(1) || 0}
                  suffix="%"
                  prefix={<PercentageOutlined />}
                  valueStyle={{ fontSize: 20 }}
                />
              </Col>
            </Row>

            {/* 点击率进度条 */}
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                点击率表现
              </Text>
              <Progress
                percent={Math.min(currentModuleStats.click_rate || 0, 100)}
                status={
                  (currentModuleStats.click_rate || 0) > 20
                    ? 'success'
                    : (currentModuleStats.click_rate || 0) > 10
                    ? 'normal'
                    : 'exception'
                }
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
            </div>

            {/* 排名 */}
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                点击量排名：第 {getRank(currentModuleStats.module_id)} / {stats.length} 名
              </Text>
            </div>

            {/* 优化建议 */}
            <div
              style={{
                padding: 12,
                background: '#f5f5f5',
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              <Text strong>💡 优化建议：</Text>
              <br />
              {(currentModuleStats.click_rate || 0) < 5 && (
                <Text type="danger">
                  点击率过低，建议调整内容或位置
                </Text>
              )}
              {(currentModuleStats.click_rate || 0) >= 5 &&
                (currentModuleStats.click_rate || 0) < 15 && (
                  <Text type="warning">
                    点击率一般，可以尝试优化标题或内容
                  </Text>
                )}
              {(currentModuleStats.click_rate || 0) >= 15 && (
                <Text type="success">
                  点击率良好，保持当前配置
                </Text>
              )}
            </div>
          </>
        ) : moduleId !== undefined ? (
          <Empty
            description="暂无统计数据"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Empty
            description="请选择一个模块查看统计"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}

        {/* 频道整体统计 */}
        {stats.length > 0 && (
          <div>
            <Text strong>频道整体数据</Text>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                总曝光：{stats.reduce((sum, s) => sum + s.total_views, 0)} 次
                <br />
                总点击：{stats.reduce((sum, s) => sum + s.total_clicks, 0)} 次
                <br />
                平均点击率：
                {(
                  (stats.reduce((sum, s) => sum + s.total_clicks, 0) /
                    stats.reduce((sum, s) => sum + s.total_views, 0)) *
                  100
                ).toFixed(1)}
                %
              </Text>
            </div>
          </div>
        )}
      </Space>
    </Card>
  );
};

export default ModuleStatsPanel;
