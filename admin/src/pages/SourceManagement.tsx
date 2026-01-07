/**
 * Source Management Page
 * 资源站管理页面 - 可视化配置
 */

import { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Button,
  Space,
  Switch,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  message,
  Popconfirm,
  App,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DragOutlined,
  ThunderboltOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

interface Source {
  id?: number;
  name: string;
  api_url: string;
  weight: number;
  is_active: boolean;
  response_format?: 'json' | 'xml' | 'auto';
}

const SourceManagement: React.FC = () => {
  const { message: messageApi, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [form] = Form.useForm();

  // 加载资源站列表
  const loadSources = async () => {
    setLoading(true);
    try {
      const { getSources } = await import('../services/adminApi');
      const data = await getSources();
      setSources(data);
    } catch (error: any) {
      message.error(error.message || '加载资源站列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 打开添加/编辑弹窗
  const handleAdd = () => {
    setEditingSource(null);
    form.resetFields();
    form.setFieldsValue({ weight: 50, is_active: true, response_format: 'auto' });
    setModalVisible(true);
  };

  const handleEdit = (source: Source) => {
    setEditingSource(source);
    form.setFieldsValue(source);
    setModalVisible(true);
  };

  // 保存资源站
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const { saveSource } = await import('../services/adminApi');
      await saveSource({
        ...values,
        id: editingSource?.id,
      });

      message.success(editingSource ? '更新成功' : '添加成功');
      setModalVisible(false);
      loadSources();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除资源站
  const handleDelete = async (id: number) => {
    try {
      setLoading(true);
      const { deleteSource } = await import('../services/adminApi');
      await deleteSource(id);
      message.success('删除成功');
      loadSources();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    } finally {
      setLoading(false);
    }
  };

  // 切换启用状态
  const handleToggleActive = async (source: Source) => {
    try {
      const { toggleSource } = await import('../services/adminApi');
      await toggleSource(source.id!);
      message.success(`已${source.is_active ? '禁用' : '启用'}`);
      loadSources();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  // 测试资源站连接
  const handleTest = async (source: Source) => {
    console.log('[Test] Starting test for source:', source);
    const hide = messageApi.loading(`正在测试 ${source.name}...`, 0);
    try {
      const { testSource } = await import('../services/adminApi');
      console.log('[Test] Calling testSource API...');
      const result = await testSource(source.id!);
      console.log('[Test] Result:', result);
      
      hide();
      
      if (result.success) {
        console.log('[Test] Showing success modal');
        modal.success({
          title: '连接成功',
          content: `✅ 资源站连接正常\n响应时间: ${result.responseTime || 0}ms${
            result.videoCount !== undefined ? `\n返回视频数: ${result.videoCount}` : ''
          }${result.format ? `\n数据格式: ${result.format.toUpperCase()}` : ''}`,
        });
        // 刷新列表以显示更新后的格式
        loadSources();
      } else {
        console.log('[Test] Showing error modal');
        modal.error({
          title: '连接失败',
          content: `❌ ${result.message}${
            result.responseTime ? `\n响应时间: ${result.responseTime}ms` : ''
          }`,
        });
      }
    } catch (error: any) {
      console.error('[Test] Error:', error);
      hide();
      messageApi.error(error.message || '测试失败');
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const columns: ColumnsType<Source> = [
    {
      title: '排序',
      width: 60,
      render: () => <DragOutlined style={{ cursor: 'move', color: '#999' }} />,
    },
    {
      title: '资源站名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'API 地址',
      dataIndex: 'api_url',
      key: 'api_url',
      ellipsis: true,
    },
    {
      title: '格式',
      dataIndex: 'response_format',
      key: 'response_format',
      width: 80,
      render: (format: string) => {
        const formatConfig: Record<string, { color: string; text: string }> = {
          json: { color: 'blue', text: 'JSON' },
          xml: { color: 'orange', text: 'XML' },
          auto: { color: 'default', text: '自动' },
        };
        const config = formatConfig[format] || formatConfig.auto;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '权重',
      dataIndex: 'weight',
      key: 'weight',
      width: 80,
      sorter: (a, b) => b.weight - a.weight,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (is_active: boolean, record: Source) => (
        <Switch
          checked={is_active}
          onChange={() => handleToggleActive(record)}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_: any, record: Source) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => handleTest(record)}
          >
            测试
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SyncOutlined />}
            onClick={() => handleSyncCategories(record)}
          >
            同步分类
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个资源站吗？"
            onConfirm={() => handleDelete(record.id!)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 自动发现常用资源站
  const handleAutoDiscover = () => {
    Modal.confirm({
      title: '自动添加常用资源站',
      content: '将自动添加以下常用资源站：非凡资源、量子资源、新浪资源。是否继续？',
      onOk: async () => {
        try {
          setLoading(true);
          const { autoDiscoverSources } = await import('../services/adminApi');
          const result = await autoDiscoverSources();
          message.success(`成功添加 ${result.added} 个资源站`);
          loadSources();
        } catch (error: any) {
          message.error(error.message || '自动发现失败');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // 同步所有资源站的分类映射
  const handleSyncAllCategories = async () => {
    const hide = messageApi.loading('正在同步所有资源站的分类映射...', 0);
    try {
      const { syncAllSourceCategories } = await import('../services/adminApi');
      const result = await syncAllSourceCategories();
      hide();
      modal.success({
        title: '同步完成',
        content: result.msg,
      });
    } catch (error: any) {
      hide();
      messageApi.error(error.message || '同步失败');
    }
  };

  // 同步单个资源站的分类映射
  const handleSyncCategories = async (source: Source) => {
    const hide = messageApi.loading(`正在同步 ${source.name} 的分类映射...`, 0);
    try {
      const { syncSourceCategories } = await import('../services/adminApi');
      const result = await syncSourceCategories(source.id!);
      hide();
      const mappings = result.data?.mappings || [];
      modal.success({
        title: '同步完成',
        content: `${result.msg}\n\n映射详情:\n${mappings.slice(0, 10).map((m: any) => 
          `${m.sourceTypeName} (${m.sourceTypeId}) → ${m.targetCategoryName}`
        ).join('\n') || '无'}${mappings.length > 10 ? '\n...' : ''}`,
      });
    } catch (error: any) {
      hide();
      messageApi.error(error.message || '同步失败');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>资源站管理</Title>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              添加资源站
            </Button>
            <Button icon={<ThunderboltOutlined />} onClick={handleAutoDiscover}>
              自动发现常用资源站
            </Button>
            <Button icon={<SyncOutlined />} onClick={handleSyncAllCategories}>
              同步所有分类映射
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={sources}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      {/* 添加/编辑弹窗 */}
      <Modal
        title={editingSource ? '编辑资源站' : '添加资源站'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        confirmLoading={loading}
        width={600}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="资源站名称"
            name="name"
            rules={[{ required: true, message: '请输入资源站名称' }]}
          >
            <Input placeholder="非凡资源 / 量子资源" />
          </Form.Item>

          <Form.Item
            label="API 地址"
            name="api_url"
            rules={[
              { required: true, message: '请输入 API 地址' },
              { type: 'url', message: '请输入有效的 URL' },
            ]}
            help="示例：https://cj.ffzyapi.com/api.php/provide/vod"
          >
            <Input placeholder="https://api.example.com/api.php/provide/vod" />
          </Form.Item>

          <Form.Item
            label="响应格式"
            name="response_format"
            help="选择资源站返回的数据格式，自动会在测试时自动检测"
          >
            <Select>
              <Select.Option value="auto">自动检测</Select.Option>
              <Select.Option value="json">JSON 格式</Select.Option>
              <Select.Option value="xml">XML 格式</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="权重"
            name="weight"
            rules={[{ required: true, message: '请输入权重' }]}
            help="权重越高，优先级越高（1-100）"
          >
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="状态"
            name="is_active"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SourceManagement;
