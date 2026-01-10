/**
 * Cache Management Page
 * 缓存管理页面
 */

import { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Button,
  Space,
  Popconfirm,
  Alert,
  Descriptions,
} from 'antd';
import { useNotification } from '../components/providers';
import {
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { purgeCache, getCacheStats, deleteCache } from '../services/adminApi';

const { Title, Text } = Typography;

const CacheManagement: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const { success, error } = useNotification();

  // 加载缓存统计
  const loadCacheStats = async () => {
    setLoadingStats(true);
    try {
      const stats = await getCacheStats();
      setCacheStats(stats);
    } catch (err) {
      console.log('Cache stats not available');
    } finally {
      setLoadingStats(false);
    }
  };

  // 删除单个缓存
  const handleDeleteCache = async (key: string) => {
    try {
      await deleteCache(key);
      success('缓存已删除');
      loadCacheStats();
    } catch (err: any) {
      error(err.message || '删除失败');
    }
  };

  // 初始化加载缓存统计
  useEffect(() => {
    loadCacheStats();
  }, []);

  // 清除缓存
  const handlePurge = async (type: 'layout' | 'shorts' | 'all') => {
    setLoading(type);
    try {
      await purgeCache(type);
      success('缓存清除成功');
    } catch (err: any) {
      error(err.message || '清除缓存失败');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>缓存管理</Title>

      {/* 缓存状态 */}
      {cacheStats && (
        <Card title="缓存状态" style={{ marginBottom: 24 }} extra={<Button onClick={loadCacheStats} loading={loadingStats}>刷新</Button>}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>已缓存: {cacheStats.total_keys} 个键</Text>
            {cacheStats.caches?.map((cache: any) => (
              <div key={cache.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Space>
                  <span style={{ color: cache.exists ? '#52c41a' : '#999' }}>●</span>
                  <Text code>{cache.key}</Text>
                  {cache.exists && <Text type="secondary">({(cache.size / 1024).toFixed(1)} KB)</Text>}
                </Space>
                {cache.exists && (
                  <Popconfirm title="确定删除此缓存？" onConfirm={() => handleDeleteCache(cache.key)}>
                    <Button type="link" size="small" danger>删除</Button>
                  </Popconfirm>
                )}
              </div>
            ))}
          </Space>
        </Card>
      )}

      <Alert
        message="缓存说明"
        description={
          <div>
            <p>• 首页布局缓存：缓存各频道的布局配置，TTL 5分钟</p>
            <p>• 短剧缓存：缓存短剧列表数据，TTL 1小时</p>
            <p>• 清除缓存后，下次请求将从数据库重新加载数据</p>
            <p>• 建议在修改布局或配置后清除相应缓存</p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card title="首页布局缓存">
          <Descriptions column={1}>
            <Descriptions.Item label="缓存内容">
              所有频道的布局配置（精选、电影、剧集、Netflix、短剧、动漫、综艺、福利）
            </Descriptions.Item>
            <Descriptions.Item label="缓存时间">
              5 分钟
            </Descriptions.Item>
            <Descriptions.Item label="操作">
              <Popconfirm
                title="确定清除首页布局缓存吗？"
                description="清除后下次请求将从数据库重新加载"
                onConfirm={() => handlePurge('layout')}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="primary"
                  icon={<DeleteOutlined />}
                  loading={loading === 'layout'}
                >
                  清除布局缓存
                </Button>
              </Popconfirm>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="短剧缓存">
          <Descriptions column={1}>
            <Descriptions.Item label="缓存内容">
              短剧列表数据
            </Descriptions.Item>
            <Descriptions.Item label="缓存时间">
              1 小时
            </Descriptions.Item>
            <Descriptions.Item label="操作">
              <Popconfirm
                title="确定清除短剧缓存吗？"
                description="清除后下次请求将从数据库重新加载"
                onConfirm={() => handlePurge('shorts')}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="primary"
                  icon={<DeleteOutlined />}
                  loading={loading === 'shorts'}
                >
                  清除短剧缓存
                </Button>
              </Popconfirm>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="全部缓存">
          <Descriptions column={1}>
            <Descriptions.Item label="缓存内容">
              所有 KV 缓存数据（布局、短剧等）
            </Descriptions.Item>
            <Descriptions.Item label="说明">
              <Text type="warning">
                此操作将清除所有缓存，可能会短暂影响系统性能
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="操作">
              <Popconfirm
                title="确定清除所有缓存吗？"
                description="此操作将清除所有缓存数据"
                onConfirm={() => handlePurge('all')}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  danger
                  icon={<ReloadOutlined />}
                  loading={loading === 'all'}
                >
                  清除所有缓存
                </Button>
              </Popconfirm>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </Space>
    </div>
  );
};

export default CacheManagement;
