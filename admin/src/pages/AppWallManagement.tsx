/**
 * App Wall Management Page
 * 应用墙管理页面
 */

import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  message,
  Popconfirm,
  Typography,
  Card,
  Image,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { getAppWall, saveAppWall, deleteAppWall } from '../services/adminApi';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

export interface AppWallItem {
  id?: number;
  app_name: string;
  icon_url: string;
  download_url: string;
  commission: number;
  sort_order: number;
  is_active: boolean;
}

const AppWallManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState<AppWallItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingApp, setEditingApp] = useState<AppWallItem | null>(null);
  const [form] = Form.useForm();
  const [saveLoading, setSaveLoading] = useState(false);

  // 加载应用列表
  const loadApps = async () => {
    setLoading(true);
    try {
      const data = await getAppWall();
      setApps(data);
    } catch (error: any) {
      message.error(error.message || '加载应用列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除应用
  const handleDelete = async (id: number) => {
    try {
      await deleteAppWall(id);
      message.success('删除成功');
      loadApps();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  // 打开添加应用弹窗
  const handleAdd = () => {
    setEditingApp(null);
    form.resetFields();
    form.setFieldsValue({
      commission: 0,
      sort_order: 0,
      is_active: true,
    });
    setModalVisible(true);
  };

  // 打开编辑应用弹窗
  const handleEdit = (app: AppWallItem) => {
    setEditingApp(app);
    form.setFieldsValue(app);
    setModalVisible(true);
  };

  // 保存应用
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaveLoading(true);
      
      const data: AppWallItem = {
        ...values,
        id: editingApp?.id,
      };
      
      await saveAppWall(data);
      message.success(editingApp ? '更新成功' : '创建成功');
      setModalVisible(false);
      form.resetFields();
      loadApps();
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误
        return;
      }
      message.error(error.message || '保存失败');
    } finally {
      setSaveLoading(false);
    }
  };

  useEffect(() => {
    loadApps();
  }, []);

  const columns: ColumnsType<AppWallItem> = [
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80,
    },
    {
      title: '图标',
      dataIndex: 'icon_url',
      key: 'icon_url',
      width: 80,
      render: (url: string) => (
        <Image
          src={url}
          alt="图标"
          width={50}
          height={50}
          style={{ objectFit: 'cover', borderRadius: 8 }}
        />
      ),
    },
    {
      title: '应用名称',
      dataIndex: 'app_name',
      key: 'app_name',
    },
    {
      title: '下载链接',
      dataIndex: 'download_url',
      key: 'download_url',
      ellipsis: true,
    },
    {
      title: '佣金',
      dataIndex: 'commission',
      key: 'commission',
      width: 100,
      render: (commission: number) => `¥${commission.toFixed(2)}`,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (is_active: boolean) => (
        <Switch checked={is_active} disabled />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: AppWallItem) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个应用吗？"
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

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>应用墙管理</Title>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增应用
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={apps}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个应用`,
          }}
        />
      </Card>

      {/* 应用编辑弹窗 */}
      <Modal
        title={editingApp ? '编辑应用' : '新增应用'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        confirmLoading={saveLoading}
        width={600}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="应用名称"
            name="app_name"
            rules={[{ required: true, message: '请输入应用名称' }]}
          >
            <Input placeholder="抖音" maxLength={50} />
          </Form.Item>

          <Form.Item
            label="图标URL"
            name="icon_url"
            rules={[
              { required: true, message: '请输入图标URL' },
              { type: 'url', message: '请输入有效的URL' },
            ]}
          >
            <Input placeholder="https://example.com/icon.png" />
          </Form.Item>

          <Form.Item
            label="下载链接"
            name="download_url"
            rules={[
              { required: true, message: '请输入下载链接' },
              { type: 'url', message: '请输入有效的URL' },
            ]}
          >
            <Input placeholder="https://example.com/download" />
          </Form.Item>

          <Form.Item
            label="佣金单价"
            name="commission"
            rules={[{ required: true, message: '请输入佣金单价' }]}
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="0.00"
              addonAfter="元"
            />
          </Form.Item>

          <Form.Item
            label="排序"
            name="sort_order"
            rules={[{ required: true, message: '请输入排序值' }]}
            help="数值越小越靠前"
          >
            <InputNumber
              min={0}
              style={{ width: '100%' }}
              placeholder="0"
            />
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

export default AppWallManagement;
