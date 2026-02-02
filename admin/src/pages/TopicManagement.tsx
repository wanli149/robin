/**
 * Topic Management Page
 * 专题管理页面 - 增强版
 */

import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Popconfirm,
  Typography,
  Card,
  Image,
  Switch,
  Row,
  Col,
  Statistic,
  Tag,
} from 'antd';
import { useNotification } from '../components/providers';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  HolderOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import { getTopics, deleteTopic, toggleTopic, getTopicsStats } from '../services/adminApi';
import TopicModal from '../components/TopicModal';
import TopicContentModal from '../components/TopicContentModal';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

export interface Topic {
  id: string;
  title: string;
  cover_img: string | null;
  description: string | null;
  is_active?: boolean;
  sort_order?: number;
  video_count?: number;
}

const TopicManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [contentModalVisible, setContentModalVisible] = useState(false);
  const [managingTopic, setManagingTopic] = useState<Topic | null>(null);
  const [stats, setStats] = useState<any[]>([]);
  const { success, error } = useNotification();

  // 加载专题列表
  const loadTopics = async () => {
    setLoading(true);
    try {
      const data = await getTopics();
      // 转换类型：将 is_active 从 number | boolean | undefined 转为 boolean | undefined
      const normalizedTopics: Topic[] = data.map(t => ({
        ...t,
        is_active: t.is_active === undefined ? undefined : Boolean(t.is_active),
      }));
      setTopics(normalizedTopics);
      // 加载统计
      try {
        const statsData = await getTopicsStats();
        setStats(statsData);
      } catch (error) {
        logger.topic.warn('Failed to load topic stats', error);
        // 统计可能不可用，不影响主功能
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载专题列表失败';
      error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 切换专题状态
  const handleToggle = async (id: string) => {
    try {
      await toggleTopic(id);
      success('状态已更新');
      loadTopics();
    } catch (err: any) {
      error(err.message || '操作失败');
    }
  };

  // 获取专题视频数量
  const getVideoCount = (id: string) => {
    const stat = stats.find(s => s.id === id);
    return stat?.video_count || 0;
  };

  // 删除专题
  const handleDelete = async (id: string) => {
    try {
      await deleteTopic(id);
      success('删除成功');
      loadTopics();
    } catch (err: any) {
      error(err.message || '删除失败');
    }
  };

  // 打开添加专题弹窗
  const handleAdd = () => {
    setEditingTopic(null);
    setModalVisible(true);
  };

  // 打开编辑专题弹窗
  const handleEdit = (topic: Topic) => {
    setEditingTopic(topic);
    setModalVisible(true);
  };

  // 保存专题
  const handleSave = async () => {
    setModalVisible(false);
    loadTopics();
  };

  // 打开内容管理弹窗
  const handleManageContent = (topic: Topic) => {
    setManagingTopic(topic);
    setContentModalVisible(true);
  };

  useEffect(() => {
    loadTopics();
  }, []);

  const columns: ColumnsType<Topic> = [
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 70,
      render: (sortOrder: number) => (
        <Space>
          <HolderOutlined style={{ cursor: 'grab', color: '#999' }} />
          <span style={{ color: '#999', fontSize: 12 }}>{sortOrder || 0}</span>
        </Space>
      ),
    },
    {
      title: '封面',
      dataIndex: 'cover_img',
      key: 'cover_img',
      width: 120,
      render: (url: string | null) =>
        url ? (
          <Image
            src={url}
            alt="封面"
            width={100}
            height={56}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjU2IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iNTYiIGZpbGw9IiNmMGYwZjAiLz48dGV4dCB4PSI1MCIgeT0iMjgiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPuWKoOi9veWksei0pTwvdGV4dD48L3N2Zz4="
            placeholder={
              <div style={{ 
                width: 100, 
                height: 56, 
                background: '#f5f5f5', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                borderRadius: 4,
              }}>
                <span style={{ color: '#999', fontSize: 12 }}>加载中...</span>
              </div>
            }
          />
        ) : (
          <div style={{ 
            width: 100, 
            height: 56, 
            background: '#f5f5f5', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            borderRadius: 4,
            border: '1px dashed #d9d9d9',
          }}>
            <span style={{ color: '#999', fontSize: 12 }}>无封面</span>
          </div>
        ),
    },
    {
      title: '专题信息',
      key: 'info',
      render: (_: any, record: Topic) => (
        <div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>{record.title}</div>
          <div style={{ fontSize: 12, color: '#999' }}>ID: {record.id}</div>
          {record.description && (
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }} title={record.description}>
              {record.description.length > 30 ? record.description.slice(0, 30) + '...' : record.description}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '视频数',
      key: 'video_count',
      width: 90,
      render: (_: any, record: Topic) => {
        const count = getVideoCount(record.id);
        return (
          <Tag color={count > 0 ? 'blue' : 'default'}>{count} 个</Tag>
        );
      },
    },
    {
      title: '状态',
      key: 'is_active',
      width: 80,
      render: (_: any, record: Topic) => (
        <Switch
          checked={record.is_active !== false}
          checkedChildren={<EyeOutlined />}
          unCheckedChildren={<EyeInvisibleOutlined />}
          onChange={() => handleToggle(record.id)}
          size="small"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: Topic) => (
        <Space size="small">
          <Button type="link" size="small" icon={<AppstoreOutlined />} onClick={() => handleManageContent(record)}>
            内容
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个专题吗？"
            description="删除后专题内的内容也会被清空"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 统计数据
  const totalVideos = stats.reduce((sum, s) => sum + (s.video_count || 0), 0);
  const activeTopics = topics.filter(t => t.is_active !== false).length;

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>专题管理</Title>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="专题总数" value={topics.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已启用" value={activeTopics} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已禁用" value={topics.length - activeTopics} valueStyle={{ color: '#999' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总视频数" value={totalVideos} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建专题
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={topics}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个专题`,
          }}
        />
      </Card>

      {/* 专题编辑弹窗 */}
      <TopicModal
        visible={modalVisible}
        topic={editingTopic}
        onCancel={() => setModalVisible(false)}
        onSave={handleSave}
      />

      {/* 专题内容管理弹窗 */}
      {managingTopic && (
        <TopicContentModal
          visible={contentModalVisible}
          topicId={managingTopic.id}
          topicTitle={managingTopic.title}
          onCancel={() => setContentModalVisible(false)}
        />
      )}
    </div>
  );
};

export default TopicManagement;
