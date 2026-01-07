/**
 * Domain Management Page
 * 域名管理页面 - 管理 API 域名配置、健康检测
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Modal, message, Form, Input, InputNumber,
  Switch, Typography, Row, Col, Statistic, Tooltip, Popconfirm, Alert
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined,
  CloseCircleOutlined, QuestionCircleOutlined, ReloadOutlined,
  CrownOutlined, ThunderboltOutlined, GlobalOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getDomains, addDomain, updateDomain, deleteDomain,
  checkDomain, checkAllDomains, setDomainPrimary,
  type ApiDomain
} from '../services/adminApi';

const { Title, Text } = Typography;

const DomainManagement: React.FC = () => {
  const [domains, setDomains] = useState<ApiDomain[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkingId, setCheckingId] = useState<number | null>(null);
  
  // 编辑弹窗
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDomain, setEditingDomain] = useState<ApiDomain | null>(null);
  const [form] = Form.useForm();

  // 加载域名列表
  const loadDomains = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDomains();
      setDomains(data.domains);
    } catch (error: any) {
      message.error(error.message || '加载域名列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  // 打开编辑弹窗
  const handleEdit = (domain?: ApiDomain) => {
    setEditingDomain(domain || null);
    if (domain) {
      form.setFieldsValue({
        domain: domain.domain,
        name: domain.name,
        priority: domain.priority,
        is_active: domain.is_active,
        is_primary: domain.is_primary,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ priority: 100, is_active: true });
    }
    setModalVisible(true);
  };

  // 保存域名
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingDomain) {
        await updateDomain(editingDomain.id, values);
        message.success('域名更新成功');
      } else {
        await addDomain(values);
        message.success('域名添加成功');
      }
      
      setModalVisible(false);
      loadDomains();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error.message);
    }
  };

  // 删除域名
  const handleDelete = async (id: number) => {
    try {
      await deleteDomain(id);
      message.success('域名已删除');
      loadDomains();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  // 设为主域名
  const handleSetPrimary = async (id: number) => {
    try {
      await setDomainPrimary(id);
      message.success('已设为主域名');
      loadDomains();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  // 检测单个域名
  const handleCheck = async (id: number) => {
    setCheckingId(id);
    try {
      const result = await checkDomain(id);
      if (result.data?.healthy) {
        message.success(`域名可用，响应时间 ${result.data.responseTime}ms`);
      } else {
        message.warning(`域名不可用: ${result.data?.error || '未知错误'}`);
      }
      loadDomains();
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setCheckingId(null);
    }
  };

  // 检测所有域名
  const handleCheckAll = async () => {
    setCheckingAll(true);
    try {
      const result = await checkAllDomains();
      message.success(result.msg);
      loadDomains();
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setCheckingAll(false);
    }
  };

  // 健康状态图标
  const renderHealthStatus = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Tag icon={<CheckCircleOutlined />} color="success">健康</Tag>;
      case 'unhealthy':
        return <Tag icon={<CloseCircleOutlined />} color="error">异常</Tag>;
      default:
        return <Tag icon={<QuestionCircleOutlined />} color="default">未知</Tag>;
    }
  };

  // 表格列定义
  const columns: ColumnsType<ApiDomain> = [
    {
      title: '域名',
      dataIndex: 'domain',
      key: 'domain',
      render: (domain, record) => (
        <Space>
          <GlobalOutlined />
          <Text copyable={{ text: domain }}>{domain}</Text>
          {record.is_primary && (
            <Tag icon={<CrownOutlined />} color="gold">主域名</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '备注',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (name) => name || '-',
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      sorter: (a, b) => b.priority - a.priority,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (active) => (
        <Tag color={active ? 'green' : 'default'}>
          {active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '健康状态',
      dataIndex: 'health_status',
      key: 'health_status',
      width: 100,
      render: renderHealthStatus,
    },
    {
      title: '响应时间',
      dataIndex: 'response_time',
      key: 'response_time',
      width: 100,
      render: (time) => time ? `${time}ms` : '-',
      sorter: (a, b) => (a.response_time || 0) - (b.response_time || 0),
    },
    {
      title: '上次检测',
      dataIndex: 'last_check_at',
      key: 'last_check_at',
      width: 160,
      render: (time) => time ? new Date(time).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="检测">
            <Button
              size="small"
              icon={<ThunderboltOutlined />}
              loading={checkingId === record.id}
              onClick={() => handleCheck(record.id)}
            />
          </Tooltip>
          {!record.is_primary && (
            <Tooltip title="设为主域名">
              <Button
                size="small"
                icon={<CrownOutlined />}
                onClick={() => handleSetPrimary(record.id)}
              />
            </Tooltip>
          )}
          <Tooltip title="编辑">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          {!record.is_primary && (
            <Popconfirm
              title="确定删除此域名？"
              onConfirm={() => handleDelete(record.id)}
            >
              <Tooltip title="删除">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // 统计数据
  const stats = {
    total: domains.length,
    active: domains.filter(d => d.is_active).length,
    healthy: domains.filter(d => d.health_status === 'healthy').length,
    unhealthy: domains.filter(d => d.health_status === 'unhealthy').length,
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={4}>域名管理</Title>

      <Alert
        message="域名管理说明"
        description="配置多个 API 域名，APP 会自动获取并切换到可用域名。主域名被封时，APP 会自动使用备用域名。建议至少配置 3 个不同的域名。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="域名总数" value={stats.total} suffix="个" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已启用"
              value={stats.active}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="健康"
              value={stats.healthy}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="异常"
              value={stats.unhealthy}
              valueStyle={{ color: stats.unhealthy > 0 ? '#ff4d4f' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        extra={
          <Space>
            <Button
              icon={<ThunderboltOutlined />}
              loading={checkingAll}
              onClick={handleCheckAll}
            >
              检测全部
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleEdit()}
            >
              添加域名
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadDomains}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={domains}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      {/* 编辑弹窗 */}
      <Modal
        title={editingDomain ? '编辑域名' : '添加域名'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="domain"
            label="域名"
            rules={[
              { required: true, message: '请输入域名' },
              { type: 'url', message: '请输入有效的 URL（需包含 https://）' },
            ]}
          >
            <Input placeholder="https://api.example.com" />
          </Form.Item>
          
          <Form.Item name="name" label="备注名称">
            <Input placeholder="例如：主站、备用1" />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="priority"
                label="优先级"
                help="数值越大优先级越高"
              >
                <InputNumber min={1} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="is_active" label="启用" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="is_primary" label="主域名" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default DomainManagement;
