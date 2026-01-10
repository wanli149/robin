/**
 * Channel Selector Component
 * 频道选择器 - 从数据库获取频道列表，支持管理
 */

import { useState, useEffect } from 'react';
import { Menu, Button, Modal, Form, Input, Space, List, Popconfirm, Tooltip } from 'antd';
import { useNotification } from '../providers';
import {
  SettingOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import { getTabs, createTab, updateTab, deleteTab, reorderTabs } from '../../services/adminApi';
import type { HomeTab } from '../../services/adminApi';

interface ChannelSelectorProps {
  selectedTab: string;
  onTabChange: (tabId: string) => void;
}

const ChannelSelector: React.FC<ChannelSelectorProps> = ({
  selectedTab,
  onTabChange,
}) => {
  const [tabs, setTabs] = useState<HomeTab[]>([]);
  const [loading, setLoading] = useState(false);
  const [manageVisible, setManageVisible] = useState(false);
  const [editingTab, setEditingTab] = useState<HomeTab | null>(null);
  const [addVisible, setAddVisible] = useState(false);
  const [form] = Form.useForm();
  const [addForm] = Form.useForm();
  const { success, error } = useNotification();

  // 加载频道列表
  const loadTabs = async () => {
    setLoading(true);
    try {
      const data = await getTabs();
      setTabs(data);
    } catch (err: any) {
      error(err.message || '加载频道失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTabs();
  }, []);

  // 菜单项（只显示可见的频道）
  const menuItems = tabs
    .filter(tab => tab.is_visible)
    .map((tab) => ({
      key: tab.id,
      label: tab.title,
    }));

  // 切换显示/隐藏
  const handleToggleVisible = async (tab: HomeTab) => {
    try {
      await updateTab(tab.id, { is_visible: tab.is_visible ? 0 : 1 });
      success(tab.is_visible ? '已隐藏' : '已显示');
      loadTabs();
    } catch (err: any) {
      error(err.message);
    }
  };

  // 编辑频道
  const handleEdit = (tab: HomeTab) => {
    setEditingTab(tab);
    form.setFieldsValue({ title: tab.title });
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingTab) return;
    try {
      const values = await form.validateFields();
      await updateTab(editingTab.id, { title: values.title });
      success('更新成功');
      setEditingTab(null);
      loadTabs();
    } catch (err: any) {
      error(err.message || '更新失败');
    }
  };

  // 删除频道
  const handleDelete = async (id: string) => {
    try {
      await deleteTab(id);
      success('删除成功');
      loadTabs();
    } catch (err: any) {
      error(err.message);
    }
  };

  // 添加频道
  const handleAdd = async () => {
    try {
      const values = await addForm.validateFields();
      await createTab(values.id, values.title);
      success('创建成功');
      setAddVisible(false);
      addForm.resetFields();
      loadTabs();
    } catch (err: any) {
      error(err.message || '创建失败');
    }
  };

  // 移动排序
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newTabs = [...tabs];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newTabs.length) return;
    
    [newTabs[index], newTabs[targetIndex]] = [newTabs[targetIndex], newTabs[index]];
    
    const orders = newTabs.map((tab, i) => ({ id: tab.id, sort_order: i + 1 }));
    try {
      await reorderTabs(orders);
      loadTabs();
    } catch (err: any) {
      error(err.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontWeight: 'bold', fontSize: 14 }}>选择频道</span>
        <Tooltip title="管理频道">
          <Button 
            type="text" 
            size="small" 
            icon={<SettingOutlined />} 
            onClick={() => setManageVisible(true)}
          />
        </Tooltip>
      </div>
      
      <Menu
        mode="inline"
        selectedKeys={[selectedTab]}
        items={menuItems}
        onClick={({ key }) => onTabChange(key)}
        style={{ border: 'none' }}
      />

      {/* 频道管理弹窗 */}
      <Modal
        title="频道管理"
        open={manageVisible}
        onCancel={() => setManageVisible(false)}
        footer={null}
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddVisible(true)}>
            添加频道
          </Button>
        </div>
        
        <List
          loading={loading}
          dataSource={tabs}
          renderItem={(tab, index) => (
            <List.Item
              actions={[
                <Tooltip title={tab.is_visible ? '隐藏' : '显示'} key="visible">
                  <Button 
                    type="text" 
                    size="small"
                    icon={tab.is_visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                    onClick={() => handleToggleVisible(tab)}
                  />
                </Tooltip>,
                <Tooltip title="编辑" key="edit">
                  <Button 
                    type="text" 
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(tab)}
                  />
                </Tooltip>,
                <Popconfirm
                  key="delete"
                  title="确定删除此频道？"
                  description="删除后该频道下的模块也会失效"
                  onConfirm={() => handleDelete(tab.id)}
                >
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Space size={4}>
                  <Button 
                    type="text" 
                    size="small" 
                    disabled={index === 0}
                    onClick={() => handleMove(index, 'up')}
                  >
                    ↑
                  </Button>
                  <Button 
                    type="text" 
                    size="small" 
                    disabled={index === tabs.length - 1}
                    onClick={() => handleMove(index, 'down')}
                  >
                    ↓
                  </Button>
                </Space>
                <span style={{ opacity: tab.is_visible ? 1 : 0.5 }}>
                  {tab.title}
                  {tab.is_locked ? ' 🔒' : ''}
                </span>
                <span style={{ color: '#999', fontSize: 12 }}>({tab.id})</span>
              </div>
            </List.Item>
          )}
        />
      </Modal>

      {/* 编辑频道弹窗 */}
      <Modal
        title="编辑频道"
        open={!!editingTab}
        onOk={handleSaveEdit}
        onCancel={() => setEditingTab(null)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="频道ID">
            <Input value={editingTab?.id} disabled />
          </Form.Item>
          <Form.Item 
            name="title" 
            label="频道名称"
            rules={[{ required: true, message: '请输入频道名称' }]}
          >
            <Input placeholder="请输入频道名称" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加频道弹窗 */}
      <Modal
        title="添加频道"
        open={addVisible}
        onOk={handleAdd}
        onCancel={() => { setAddVisible(false); addForm.resetFields(); }}
        okText="创建"
        cancelText="取消"
      >
        <Form form={addForm} layout="vertical">
          <Form.Item 
            name="id" 
            label="频道ID"
            rules={[
              { required: true, message: '请输入频道ID' },
              { pattern: /^[a-z_]+$/, message: '只能使用小写字母和下划线' }
            ]}
          >
            <Input placeholder="如: documentary" />
          </Form.Item>
          <Form.Item 
            name="title" 
            label="频道名称"
            rules={[{ required: true, message: '请输入频道名称' }]}
          >
            <Input placeholder="如: 纪录片" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ChannelSelector;
