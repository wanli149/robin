/**
 * Ad Management Page
 * 广告管理页面 - 增强版
 */

import { useState, useEffect } from 'react';
import {
  Table, Button, Space, Tag, Popconfirm, Switch,
  Typography, Card,
} from 'antd';
import { useNotification } from '../components/providers';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, WarningOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { getAds, deleteAd, toggleAdsGlobalSwitch, saveAd, migrateAds, type Ad } from '../services/adminApi';
import AdModal from '../components/AdModal';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

// 使用从 adminApi 导入的 Ad 类型

const LOCATION_NAMES: Record<string, string> = {
  splash: '开屏广告',
  banner_home: '首页横幅',
  banner_module: '横幅模块',
  insert_grid: '网格插入',
  shorts_insert: '短剧插播',
  pause_overlay: '暂停贴片',
  video_pre: '视频前贴',
  video_mid: '视频中贴',
  video_post: '视频后贴',
};

const AdManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [ads, setAds] = useState<Ad[]>([]);
  const [adsEnabled, setAdsEnabled] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const { success, error, loading: showLoading } = useNotification();

  const loadAds = async () => {
    setLoading(true);
    try {
      const data = await getAds();
      setAds(data);
    } catch (err: any) {
      error(err.message || '加载广告列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleMigrate = async () => {
    const hide = showLoading('正在迁移数据库...');
    try {
      await migrateAds();
      hide();
      success('迁移成功！');
      loadAds();
    } catch (err: any) {
      hide();
      error(err.message || '迁移失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAd(id);
      success('删除成功');
      loadAds();
    } catch (err: any) {
      error(err.message || '删除失败');
    }
  };

  const handleGlobalSwitch = async (enabled: boolean) => {
    try {
      await toggleAdsGlobalSwitch(enabled);
      setAdsEnabled(enabled);
      success(enabled ? '广告已启用' : '广告已熔断');
    } catch (err: any) {
      error(err.message || '操作失败');
    }
  };

  const handleAdd = () => {
    setEditingAd(null);
    setModalVisible(true);
  };

  const handleEdit = (ad: Ad) => {
    setEditingAd(ad);
    setModalVisible(true);
  };

  const handleSave = async (values: any) => {
    try {
      await saveAd(values);
      success(values.id ? '更新成功' : '添加成功');
      setModalVisible(false);
      loadAds();
    } catch (err: any) {
      error(err.message || '保存失败');
      throw err;
    }
  };

  useEffect(() => { loadAds(); }, []);

  const isAdActive = (ad: Ad) => {
    if (!ad.is_active) return false;
    const now = Math.floor(Date.now() / 1000);
    if (ad.start_time && now < ad.start_time) return false;
    if (ad.end_time && now > ad.end_time) return false;
    return true;
  };

  const columns: ColumnsType<Ad> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '广告名称', dataIndex: 'name', width: 150,
      render: (name: string, record: Ad) => (
        <div>
          <div>{name || `广告${record.id}`}</div>
          {record.remark && <Text type="secondary" style={{ fontSize: 12 }}>{record.remark}</Text>}
        </div>
      ),
    },
    {
      title: '广告位置', dataIndex: 'location', width: 120,
      render: (location: string) => <Tag color="blue">{LOCATION_NAMES[location] || location}</Tag>,
    },
    {
      title: '素材预览', dataIndex: 'media_url', width: 100,
      render: (url: string, record: Ad) => (
        record.content_type === 'image' ? (
          <img src={url} alt="广告" style={{ width: 80, height: 45, objectFit: 'cover', borderRadius: 4 }} />
        ) : <Tag>视频</Tag>
      ),
    },
    {
      title: '投放时间', key: 'schedule', width: 180,
      render: (_: any, record: Ad) => {
        if (!record.start_time && !record.end_time) return <Text type="secondary">长期投放</Text>;
        const start = record.start_time ? new Date(record.start_time * 1000).toLocaleDateString() : '不限';
        const end = record.end_time ? new Date(record.end_time * 1000).toLocaleDateString() : '不限';
        return <Text style={{ fontSize: 12 }}>{start} ~ {end}</Text>;
      },
    },
    { title: '权重', dataIndex: 'weight', width: 70 },
    {
      title: '每日上限', dataIndex: 'daily_limit', width: 90,
      render: (limit: number) => limit > 0 ? `${limit}次` : '不限',
    },
    {
      title: '状态', key: 'status', width: 100,
      render: (_: any, record: Ad) => {
        if (!record.is_active) return <Tag color="default">已禁用</Tag>;
        if (!isAdActive(record)) return <Tag color="orange">未到期/已过期</Tag>;
        return <Tag color="success">投放中</Tag>;
      },
    },
    {
      title: '操作', key: 'action', width: 150,
      render: (_: any, record: Ad) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除这条广告吗？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>广告管理</Title>
      <Card style={{ marginBottom: 16 }}>
        <Space size="large">
          <div>
            <span style={{ marginRight: 8 }}>全局广告开关：</span>
            <Switch checked={adsEnabled} onChange={handleGlobalSwitch} checkedChildren="启用" unCheckedChildren="禁用" />
          </div>
          <Popconfirm title="确定要一键熔断所有广告吗？" description="此操作将立即关闭所有广告展示" onConfirm={() => handleGlobalSwitch(false)} okText="确定" cancelText="取消" okButtonProps={{ danger: true }}>
            <Button danger icon={<WarningOutlined />} type="primary">一键熔断</Button>
          </Popconfirm>
          <Popconfirm title="初始化广告数据库？" description="将添加新字段和统计表" onConfirm={handleMigrate}>
            <Button icon={<DatabaseOutlined />}>初始化数据库</Button>
          </Popconfirm>
        </Space>
      </Card>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加广告</Button>
        </div>
        <Table columns={columns} dataSource={ads} rowKey="id" loading={loading} pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }} />
      </Card>
      <AdModal visible={modalVisible} ad={editingAd} onCancel={() => setModalVisible(false)} onSave={handleSave} />
    </div>
  );
};

export default AdManagement;
