/**
 * 公告管理页面
 * 管理 APP 公告弹窗，支持紧急通知、版本更新、域名变更等
 */

import { useState, useEffect } from 'react';
import {
  Card, Table, Button, Space, Modal, Form, Input, Select,
  Switch, InputNumber, DatePicker, Tag, Popconfirm,
  Typography, Row, Col, Statistic, Tooltip,
} from 'antd';
import { useNotification } from '../components/providers';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  NotificationOutlined, WarningOutlined, RocketOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getAnnouncements, createAnnouncement, updateAnnouncement,
  deleteAnnouncement, toggleAnnouncement, getAnnouncementStats,
  type Announcement,
} from '../services/adminApi';

const { TextArea } = Input;
const { Text } = Typography;
const { RangePicker } = DatePicker;

const typeOptions = [
  { value: 'info', label: '普通通知', color: 'blue' },
  { value: 'warning', label: '警告提醒', color: 'orange' },
  { value: 'update', label: '版本更新', color: 'green' },
  { value: 'urgent', label: '紧急公告', color: 'red' },
];

const actionTypeOptions = [
  { value: 'none', label: '无操作' },
  { value: 'url', label: '打开链接' },
  { value: 'update', label: '跳转更新' },
  { value: 'close', label: '仅关闭' },
];

const platformOptions = [
  { value: 'all', label: '全平台' },
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
];

const AnnouncementManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [currentStats, setCurrentStats] = useState<any>(null);
  const [form] = Form.useForm();
  const { success, error } = useNotification();

  const fetchList = async () => {
    setLoading(true);
    try {
      const result = await getAnnouncements({ page, limit: 20 });
      setList(result.list);
      setTotal(result.total);
    } catch (err: any) {
      error(err.message || '获取公告列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [page]);

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'info',
      action_type: 'none',
      target_platform: 'all',
      priority: 0,
      is_active: true,
      show_once: false,
      force_show: false,
    });
    setModalVisible(true);
  };

  const handleEdit = (record: Announcement) => {
    setEditingItem(record);
    form.setFieldsValue({
      ...record,
      time_range: record.start_time && record.end_time
        ? [dayjs.unix(record.start_time), dayjs.unix(record.end_time)]
        : undefined,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAnnouncement(id);
      success('删除成功');
      fetchList();
    } catch (err: any) {
      error(err.message || '删除失败');
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await toggleAnnouncement(id);
      success('状态已切换');
      fetchList();
    } catch (err: any) {
      error(err.message || '切换失败');
    }
  };

  const handleViewStats = async (record: Announcement) => {
    try {
      const stats = await getAnnouncementStats(record.id);
      setCurrentStats({ ...stats, title: record.title });
      setStatsModalVisible(true);
    } catch (err: any) {
      error(err.message || '获取统计失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      // 处理时间范围
      if (values.time_range) {
        values.start_time = values.time_range[0].unix();
        values.end_time = values.time_range[1].unix();
        delete values.time_range;
      }

      if (editingItem) {
        await updateAnnouncement(editingItem.id, values);
        success('更新成功');
      } else {
        await createAnnouncement(values);
        success('创建成功');
      }
      
      setModalVisible(false);
      fetchList();
    } catch (err: any) {
      if (err.errorFields) return; // 表单验证错误
      error(err.message || '操作失败');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'warning': return <WarningOutlined />;
      case 'update': return <RocketOutlined />;
      case 'urgent': return <ExclamationCircleOutlined />;
      default: return <NotificationOutlined />;
    }
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      render: (text: string, record: Announcement) => (
        <Space>
          {getTypeIcon(record.type)}
          <Text strong={record.is_active}>{text}</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => {
        const opt = typeOptions.find(o => o.value === type);
        return <Tag color={opt?.color}>{opt?.label || type}</Tag>;
      },
    },
    {
      title: '平台',
      dataIndex: 'target_platform',
      key: 'target_platform',
      width: 80,
      render: (platform: string) => {
        const opt = platformOptions.find(o => o.value === platform);
        return opt?.label || platform;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      sorter: (a: Announcement, b: Announcement) => a.priority - b.priority,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (active: boolean, record: Announcement) => (
        <Switch
          checked={active}
          onChange={() => handleToggle(record.id)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    {
      title: '查看/点击',
      key: 'stats',
      width: 100,
      render: (_: any, record: Announcement) => (
        <Text type="secondary">
          {record.view_count || 0} / {record.click_count || 0}
        </Text>
      ),
    },
    {
      title: '有效期',
      key: 'time_range',
      width: 180,
      render: (_: any, record: Announcement) => {
        if (!record.start_time && !record.end_time) {
          return <Text type="secondary">永久有效</Text>;
        }
        const start = record.start_time ? dayjs.unix(record.start_time).format('MM-DD HH:mm') : '无限';
        const end = record.end_time ? dayjs.unix(record.end_time).format('MM-DD HH:mm') : '无限';
        return <Text type="secondary">{start} ~ {end}</Text>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (ts: number) => dayjs.unix(ts).format('YYYY-MM-DD'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: any, record: Announcement) => (
        <Space size="small">
          <Tooltip title="统计">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewStats(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除此公告？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Tooltip title="删除">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <NotificationOutlined />
            公告管理
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建公告
          </Button>
        }
      >
        <Table
          loading={loading}
          dataSource={list}
          columns={columns}
          rowKey="id"
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>

      {/* 编辑弹窗 */}
      <Modal
        title={editingItem ? '编辑公告' : '新建公告'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="title"
                label="标题"
                rules={[{ required: true, message: '请输入标题' }]}
              >
                <Input placeholder="公告标题" maxLength={100} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="type" label="类型">
                <Select options={typeOptions} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <TextArea rows={4} placeholder="公告内容，支持简单文本" maxLength={1000} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="action_type" label="操作类型">
                <Select options={actionTypeOptions} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                noStyle
                shouldUpdate={(prev, cur) => prev.action_type !== cur.action_type}
              >
                {({ getFieldValue }) =>
                  getFieldValue('action_type') === 'url' && (
                    <Form.Item name="action_url" label="跳转链接">
                      <Input placeholder="https://..." />
                    </Form.Item>
                  )
                }
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="action_text" label="按钮文字">
                <Input placeholder="如：立即查看" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="image_url" label="图片URL">
                <Input placeholder="可选，公告配图" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="target_platform" label="目标平台">
                <Select options={platformOptions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="target_version" label="目标版本">
                <Input placeholder="如 <2.0.0 或 >=1.5.0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="priority" label="优先级">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="time_range" label="有效期">
            <RangePicker
              showTime
              style={{ width: '100%' }}
              placeholder={['开始时间', '结束时间']}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="is_active" label="启用" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="show_once" label="仅显示一次" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="force_show" label="强制显示" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 统计弹窗 */}
      <Modal
        title={`公告统计 - ${currentStats?.title || ''}`}
        open={statsModalVisible}
        onCancel={() => setStatsModalVisible(false)}
        footer={null}
        width={500}
      >
        {currentStats && (
          <Row gutter={16}>
            <Col span={8}>
              <Statistic title="查看次数" value={currentStats.view_count} />
            </Col>
            <Col span={8}>
              <Statistic title="点击次数" value={currentStats.click_count} />
            </Col>
            <Col span={8}>
              <Statistic title="点击率" value={currentStats.click_rate} />
            </Col>
            <Col span={24} style={{ marginTop: 16 }}>
              <Statistic title="独立用户已读" value={currentStats.unique_reads} />
            </Col>
          </Row>
        )}
      </Modal>
    </div>
  );
};

export default AnnouncementManagement;
