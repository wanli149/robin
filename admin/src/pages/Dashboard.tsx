/**
 * Dashboard Page
 * 管理后台仪表板
 */

import { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Badge,
  Button,
  Space,
  Spin,
  Typography,
  Table,
  Tabs,
} from 'antd';
import { useNotification } from '../components/providers';
import {
  UserOutlined,
  TeamOutlined,
  ApiOutlined,
  RocketOutlined,
  ClearOutlined,
  SwapOutlined,
  FireOutlined,
  StarOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Line, Pie } from '@ant-design/charts';
import {
  getDashboard,
  getRealtimeStats,
  getTrends,
  getCollectStatsV1,
  getHotVideos,
  getRatingDistribution,
  getRecommendationPerformance,
  purgeCache,
} from '../services/adminApi';
import type { DashboardStats } from '../services/adminApi';

const { Title } = Typography;

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardStats | null>(null);

  const [collectStats, setCollectStats] = useState<any>(null);
  const [hotVideos, setHotVideos] = useState<any[]>([]);
  const [ratingDistribution, setRatingDistribution] = useState<any[]>([]);
  const [recPerformance, setRecPerformance] = useState<any>(null);
  const [realtimeStats, setRealtimeStats] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  // trends 用于未来扩展趋势图表
  const [, setTrends] = useState<any[]>([]);
  const { success, error } = useNotification();

  // 获取仪表板数据
  const fetchDashboard = async () => {
    setLoading(true);
    try {
      // 基础统计
      const result = await getDashboard();
      setData(result);
      
      // 采集统计
      try {
        const collectData = await getCollectStatsV1();
        setCollectStats(collectData);
      } catch { /* 可能不可用 */ }

      // 热门视频
      try {
        const hotData = await getHotVideos(10, 'day');
        setHotVideos(hotData);
      } catch { /* 可能不可用 */ }

      // 评分分布
      try {
        const ratingData = await getRatingDistribution();
        setRatingDistribution(ratingData);
      } catch { /* 可能不可用 */ }

      // 推荐性能
      try {
        const recData = await getRecommendationPerformance();
        setRecPerformance(recData);
      } catch { /* 可能不可用 */ }

      // 实时统计
      try {
        const realtime = await getRealtimeStats();
        setRealtimeStats(realtime);
      } catch { /* 可能不可用 */ }

      // 趋势数据
      try {
        const trendData = await getTrends(30);
        setTrends(trendData);
      } catch { /* 可能不可用 */ }
    } catch (err: any) {
      error(err.message || '获取仪表板数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 自动刷新
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (autoRefresh) {
      interval = setInterval(fetchDashboard, 30000); // 30秒刷新一次
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  useEffect(() => {
    fetchDashboard();
  }, []);

  // 准备图表数据
  const chartData = data?.stats.map((stat) => [
    { date: stat.date, type: 'API调用', value: stat.api_calls },
    { date: stat.date, type: '活跃用户', value: stat.unique_users },
  ]).flat() || [];

  // 图表配置
  const chartConfig = {
    data: chartData,
    xField: 'date',
    yField: 'value',
    seriesField: 'type',
    smooth: true,
    animation: {
      appear: {
        animation: 'path-in',
        duration: 1000,
      },
    },
    color: ['#1890ff', '#52c41a'],
  };

  if (loading) {
    return (
      <Spin spinning size="large" tip="加载中...">
        <div style={{ height: '100vh' }} />
      </Spin>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>仪表板</Title>
        <Space>
          <span style={{ color: '#999', fontSize: 12 }}>
            {realtimeStats?.timestamp ? `更新于 ${new Date(realtimeStats.timestamp * 1000).toLocaleTimeString()}` : ''}
          </span>
          <Button onClick={fetchDashboard} loading={loading}>刷新</Button>
          <Button 
            type={autoRefresh ? 'primary' : 'default'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? '停止自动刷新' : '自动刷新'}
          </Button>
        </Space>
      </div>

      {/* 实时统计卡片 */}
      {realtimeStats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>视频总数</span>}
                value={realtimeStats.videos?.total || 0}
                valueStyle={{ color: '#fff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>今日新增</span>}
                value={realtimeStats.videos?.today_new || 0}
                valueStyle={{ color: '#fff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>活跃资源站</span>}
                value={realtimeStats.sources?.active || 0}
                suffix={`/ ${realtimeStats.sources?.total || 0}`}
                valueStyle={{ color: '#fff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>待处理反馈</span>}
                value={realtimeStats.pending_feedback || 0}
                valueStyle={{ color: '#fff' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={data?.total_users || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日活跃用户"
              value={data?.today_active || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日API调用"
              value={data?.today_api_calls || 0}
              prefix={<ApiOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="服务器状态"
              value={data?.server_status || 'unknown'}
              prefix={
                <Badge
                  status={data?.server_status === 'healthy' ? 'success' : 'error'}
                />
              }
              valueStyle={{
                color: data?.server_status === 'healthy' ? '#3f8600' : '#cf1322',
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 采集统计卡片 */}
      {collectStats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="视频总数"
                value={collectStats.total_videos || 0}
                prefix={<ApiOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="有效视频"
                value={collectStats.valid_videos || 0}
                valueStyle={{ color: '#3f8600' }}
                prefix={<ApiOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="今日新增"
                value={collectStats.today_new || 0}
                valueStyle={{ color: '#1890ff' }}
                prefix={<ApiOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="上次采集"
                value={
                  collectStats.last_task
                    ? `${collectStats.last_task.new_count}新`
                    : '暂无'
                }
                prefix={<ApiOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 趋势图表 */}
      <Card title="7天趋势" style={{ marginBottom: 24 }}>
        <Line {...chartConfig} />
      </Card>

      {/* 推荐系统统计 */}
      {recPerformance && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={6}>
            <Card>
              <Statistic
                title="推荐覆盖视频"
                value={recPerformance.total_videos}
                suffix={recPerformance.total_vod ? `/ ${recPerformance.total_vod}` : ''}
                prefix={<ThunderboltOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card>
              <Statistic
                title="覆盖率"
                value={recPerformance.coverage || 0}
                suffix="%"
                prefix={<StarOutlined />}
                valueStyle={{ color: recPerformance.coverage >= 50 ? '#3f8600' : '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card>
              <Statistic
                title="平均推荐数"
                value={recPerformance.avg_recommendations}
                prefix={<StarOutlined />}
                valueStyle={{ color: '#eb2f96' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card>
              <Statistic
                title="最后更新"
                value={
                  recPerformance.last_update
                    ? new Date(recPerformance.last_update * 1000).toLocaleDateString()
                    : '未计算'
                }
                prefix={<ApiOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 数据分析标签页 */}
      <Card style={{ marginBottom: 24 }}>
        <Tabs 
          defaultActiveKey="hot"
          items={[
            {
              key: 'hot',
              label: <span><FireOutlined />热门视频</span>,
              children: (
                <Table
                  dataSource={hotVideos}
                  rowKey="vod_id"
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: '排名',
                      key: 'rank',
                      width: 60,
                      render: (_, __, index) => (
                        <span style={{ 
                          fontSize: 16, 
                          fontWeight: 'bold',
                          color: index < 3 ? '#faad14' : undefined 
                        }}>
                          {index + 1}
                        </span>
                      ),
                    },
                    {
                      title: '封面',
                      dataIndex: 'vod_pic',
                      width: 80,
                      render: (pic: string) => (
                        pic ? <img src={pic} alt="" style={{ width: 50, height: 70, objectFit: 'cover' }} /> : null
                      ),
                    },
                    {
                      title: '视频名称',
                      dataIndex: 'vod_name',
                      ellipsis: true,
                    },
                    {
                      title: '评分',
                      dataIndex: 'vod_score',
                      width: 80,
                      render: (score: number) => score > 0 ? `⭐ ${score.toFixed(1)}` : '-',
                    },
                    {
                      title: '今日播放',
                      dataIndex: 'vod_hits_day',
                      width: 100,
                      render: (hits: number) => (
                        <span style={{ color: '#ff4d4f' }}>
                          <FireOutlined /> {hits.toLocaleString()}
                        </span>
                      ),
                    },
                    {
                      title: '总播放',
                      dataIndex: 'vod_hits',
                      width: 100,
                      render: (hits: number) => hits.toLocaleString(),
                    },
                  ]}
                />
              ),
            },
            {
              key: 'rating',
              label: <span><StarOutlined />评分分布</span>,
              children: (
                <Pie
                  data={ratingDistribution.map((item: any) => ({
                    type: item.score_range,
                    value: item.count,
                  }))}
                  angleField="value"
                  colorField="type"
                  radius={0.8}
                  label={{
                    type: 'outer',
                    content: '{name} {percentage}',
                  }}
                  interactions={[{ type: 'element-active' }]}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* 快捷操作 */}
      <Card title="快捷操作">
        <Space size="middle" wrap>
          <Button
            type="primary"
            icon={<RocketOutlined />}
            onClick={() => {
              window.location.href = '/version-management';
            }}
          >
            发布新版
          </Button>
          <Button
            icon={<ClearOutlined />}
            onClick={async () => {
              try {
                await purgeCache('all');
                success('缓存已清空');
                fetchDashboard(); // 刷新数据
              } catch (err: any) {
                error(err.message || '清空缓存失败');
              }
            }}
          >
            清空缓存
          </Button>
          <Button
            icon={<SwapOutlined />}
            onClick={() => {
              window.location.href = '/source-management';
            }}
          >
            资源站管理
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default Dashboard;
