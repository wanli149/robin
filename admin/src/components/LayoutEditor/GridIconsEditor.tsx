/**
 * 金刚区可视化编辑器
 * 用于配置金刚区图标，无需手写JSON
 * 支持分类快捷选择
 */

import React, { useState, useEffect } from 'react';
import {
  Button,
  Space,
  Card,
  Input,
  Select,
  Modal,
  Form,
  Typography,
  Popconfirm,
  Radio,
} from 'antd';
import { useNotification } from '../providers';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  SearchOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { getCategoriesWithSubs, getTopics, getArticleCategories, type CategoryWithSubs } from '../../services/adminApi';

const { Text } = Typography;
const { Option, OptGroup } = Select;

interface GridIcon {
  icon: string;
  icon_type?: 'emoji' | 'url'; // 图标类型
  label: string;
  action: 'navigate' | 'webview' | 'search';
  target: string;
}

interface GridIconsEditorProps {
  value?: { items?: GridIcon[] };
  onChange?: (value: { items: GridIcon[] }) => void;
}

const GridIconsEditor: React.FC<GridIconsEditorProps> = ({ value, onChange }) => {
  const items = value?.items || [];
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [categories, setCategories] = useState<CategoryWithSubs[]>([]);
  const [topics, setTopics] = useState<Array<{ id: string; title: string }>>([]);
  const [articleCategories, setArticleCategories] = useState<Array<{ id: number; name: string }>>([]);
  const { success } = useNotification();

  // 加载分类、专题和文章分类数据
  useEffect(() => {
    const loadData = async () => {
      try {
        const [catData, topicData, artCatData] = await Promise.all([
          getCategoriesWithSubs(),
          getTopics(),
          getArticleCategories().catch((error) => {
            logger.admin.warn('Article categories not available', error);
            return [];
          }),
        ]);
        setCategories(catData.categories || []);
        setTopics(topicData || []);
        setArticleCategories(artCatData || []);
      } catch (error) {
        logger.admin.error('Failed to load categories/topics:', { error });
      }
    };
    loadData();
  }, []);

  // 常用Emoji图标
  const commonEmojis = [
    '🎬', '📺', '🎭', '🎪', '🎨', '🎮', '🎯', '🎲',
    '📱', '💻', '🖥️', '⌚', '📷', '📹', '🎥', '📽️',
    '🔥', '⭐', '💎', '🏆', '🎁', '🎉', '🎊', '🎈',
    '❤️', '💛', '💚', '💙', '💜', '🧡', '🖤', '🤍',
    '🌟', '✨', '💫', '⚡', '🔆', '🌈', '🌙', '☀️',
  ];

  // 添加/编辑图标
  const handleAddOrEdit = () => {
    setEditModalVisible(true);
    if (editingIndex === null) {
      // 添加新图标
      form.resetFields();
      form.setFieldsValue({
        icon_type: 'emoji',
        icon: '🎬',
        action: 'navigate',
      });
    }
  };

  // 编辑图标
  const handleEdit = (index: number) => {
    setEditingIndex(index);
    const item = items[index];
    form.setFieldsValue({
      icon_type: item.icon_type || (item.icon.startsWith('http') ? 'url' : 'emoji'),
      icon: item.icon,
      label: item.label,
      action: item.action,
      target: item.target,
    });
    setEditModalVisible(true);
  };

  // 保存图标
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const newItem: GridIcon = {
        icon: values.icon,
        icon_type: values.icon_type,
        label: values.label,
        action: values.action,
        target: values.target,
      };

      let newItems: GridIcon[];
      if (editingIndex !== null) {
        // 编辑现有图标
        newItems = [...items];
        newItems[editingIndex] = newItem;
      } else {
        // 添加新图标
        newItems = [...items, newItem];
      }

      onChange?.({ items: newItems });
      setEditModalVisible(false);
      setEditingIndex(null);
      form.resetFields();
      success(editingIndex !== null ? '图标已更新' : '图标已添加');
    } catch (error) {
      logger.admin.error('Validation failed:', { error });
    }
  };

  // 删除图标
  const handleDelete = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange?.({ items: newItems });
    success('图标已删除');
  };

  // 上移
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    onChange?.({ items: newItems });
  };

  // 下移
  const handleMoveDown = (index: number) => {
    if (index === items.length - 1) return;
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    onChange?.({ items: newItems });
  };

  // 获取动作类型图标
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'navigate':
        return <AppstoreOutlined />;
      case 'webview':
        return <LinkOutlined />;
      case 'search':
        return <SearchOutlined />;
      default:
        return null;
    }
  };

  // 获取动作类型文本
  const getActionText = (action: string) => {
    switch (action) {
      case 'navigate':
        return '页面导航';
      case 'webview':
        return '打开网页';
      case 'search':
        return '搜索关键词';
      default:
        return action;
    }
  };

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 图标列表 */}
        {items.length > 0 ? (
          <div style={{ border: '1px solid #d9d9d9', borderRadius: 4 }}>
            {items.map((item, index) => (
              <div
                key={index}
                style={{
                  padding: '12px',
                  borderBottom: index < items.length - 1 ? '1px solid #f0f0f0' : 'none',
                  textAlign: 'center',
                }}
              >
                {/* 第一行：图标 + 标题 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
                  <div
                    style={{
                      fontSize: 20,
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#f5f5f5',
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  >
                    {item.icon.startsWith('http') ? (
                      <img
                        src={item.icon}
                        alt={item.label}
                        style={{ width: 20, height: 20, objectFit: 'cover', borderRadius: 2 }}
                      />
                    ) : (
                      <span style={{ fontSize: 16 }}>{item.icon}</span>
                    )}
                  </div>
                  <Text strong>{item.label}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {getActionIcon(item.action)} {getActionText(item.action)}
                  </Text>
                </div>

                {/* 第二行：路径 */}
                <div style={{ marginBottom: 8 }}>
                  <Text 
                    type="secondary" 
                    style={{ 
                      fontFamily: 'monospace', 
                      fontSize: 11,
                      wordBreak: 'break-all',
                    }}
                  >
                    {item.target}
                  </Text>
                </div>

                {/* 第三行：操作按钮 - 居中紧凑布局 */}
                <Space size={4}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(index)}
                    style={{ padding: '0 6px' }}
                  />
                  <Popconfirm
                    title="确定删除？"
                    onConfirm={() => handleDelete(index)}
                    okText="是"
                    cancelText="否"
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      style={{ padding: '0 6px' }}
                    />
                  </Popconfirm>
                  <Button
                    type="text"
                    size="small"
                    disabled={index === 0}
                    onClick={() => handleMoveUp(index)}
                    style={{ padding: '0 6px' }}
                  >
                    ↑
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    disabled={index === items.length - 1}
                    onClick={() => handleMoveDown(index)}
                    style={{ padding: '0 6px' }}
                  >
                    ↓
                  </Button>
                </Space>
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Text type="secondary">暂无图标，点击下方按钮添加</Text>
            </div>
          </Card>
        )}

        {/* 添加按钮 */}
        <Button
          type="dashed"
          block
          icon={<PlusOutlined />}
          onClick={handleAddOrEdit}
        >
          添加图标
        </Button>

        {/* 提示信息 */}
        <Text type="secondary" style={{ fontSize: 12 }}>
          💡 建议配置 5-10 个图标，每行显示 5 个
        </Text>
      </Space>

      {/* 编辑弹窗 */}
      <Modal
        title={editingIndex !== null ? '编辑图标' : '添加图标'}
        open={editModalVisible}
        onOk={handleSave}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingIndex(null);
          form.resetFields();
        }}
        width={600}
      >
        <Form form={form} layout="vertical">
          {/* 图标类型 */}
          <Form.Item
            label="图标类型"
            name="icon_type"
            rules={[{ required: true, message: '请选择图标类型' }]}
          >
            <Radio.Group>
              <Radio value="emoji">Emoji 表情</Radio>
              <Radio value="url">图片URL</Radio>
            </Radio.Group>
          </Form.Item>

          {/* 图标选择 */}
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.icon_type !== curr.icon_type}>
            {({ getFieldValue }) => {
              const iconType = getFieldValue('icon_type');
              
              if (iconType === 'emoji') {
                return (
                  <Form.Item
                    label="选择图标"
                    name="icon"
                    rules={[{ required: true, message: '请选择图标' }]}
                  >
                    <Select
                      showSearch
                      placeholder="选择或搜索Emoji"
                      style={{ width: '100%' }}
                      optionLabelProp="label"
                    >
                      {commonEmojis.map((emoji) => (
                        <Option key={emoji} value={emoji} label={emoji}>
                          <span style={{ fontSize: 20, marginRight: 8 }}>{emoji}</span>
                          {emoji}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                );
              } else {
                return (
                  <Form.Item
                    label="图片URL"
                    name="icon"
                    rules={[
                      { required: true, message: '请输入图片URL' },
                      { type: 'url', message: '请输入有效的URL' },
                    ]}
                  >
                    <Input placeholder="https://example.com/icon.png" />
                  </Form.Item>
                );
              }
            }}
          </Form.Item>

          {/* 图标文字 */}
          <Form.Item
            label="图标文字"
            name="label"
            rules={[
              { required: true, message: '请输入图标文字' },
              { max: 6, message: '文字不超过6个字符' },
            ]}
          >
            <Input placeholder="例如：电影" maxLength={6} />
          </Form.Item>

          {/* 动作类型 */}
          <Form.Item
            label="点击动作"
            name="action"
            rules={[{ required: true, message: '请选择动作类型' }]}
          >
            <Select placeholder="选择点击后的动作">
              <Option value="navigate">
                <Space>
                  <AppstoreOutlined />
                  页面导航（跳转到APP内页面）
                </Space>
              </Option>
              <Option value="webview">
                <Space>
                  <LinkOutlined />
                  打开网页（在WebView中打开）
                </Space>
              </Option>
              <Option value="search">
                <Space>
                  <SearchOutlined />
                  搜索关键词（跳转到搜索页）
                </Space>
              </Option>
            </Select>
          </Form.Item>

          {/* 目标地址 */}
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.action !== curr.action}>
            {({ getFieldValue, setFieldsValue }) => {
              const action = getFieldValue('action');
              let label = '目标地址';
              let placeholder = '';
              let help = '';

              switch (action) {
                case 'navigate':
                  label = '页面路径';
                  placeholder = 'deeplink://shorts';
                  help = '可从下方快捷选择，或手动输入路径';
                  break;
                case 'webview':
                  label = '网页URL';
                  placeholder = 'https://example.com';
                  help = '输入完整的网页地址';
                  break;
                case 'search':
                  label = '搜索关键词';
                  placeholder = '热门电影';
                  help = '用户点击后会搜索这个关键词';
                  break;
              }

              return (
                <>
                  <Form.Item
                    label={label}
                    name="target"
                    rules={[{ required: true, message: `请输入${label}` }]}
                    help={help}
                  >
                    <Input placeholder={placeholder} />
                  </Form.Item>
                  
                  {/* 导航类型的快捷选择 */}
                  {action === 'navigate' && (
                    <Form.Item label="快捷选择">
                      <Select
                        placeholder="选择常用页面或分类"
                        allowClear
                        showSearch
                        optionFilterProp="children"
                        onChange={(value) => {
                          if (value) {
                            setFieldsValue({ target: value });
                          }
                        }}
                        style={{ width: '100%' }}
                      >
                        <OptGroup label="📱 常用页面">
                          <Option value="deeplink://home">🏠 首页</Option>
                          <Option value="deeplink://shorts">🎬 短剧</Option>
                          <Option value="deeplink://search">🔍 搜索</Option>
                          <Option value="deeplink://history">📜 观看历史</Option>
                          <Option value="deeplink://favorites">❤️ 我的收藏</Option>
                          <Option value="deeplink://profile">👤 个人中心</Option>
                          <Option value="deeplink://ranking">🏆 排行榜</Option>
                        </OptGroup>
                        
                        <OptGroup label="⭐ 明星">
                          <Option value="deeplink://actors">⭐ 明星列表</Option>
                          <Option value="deeplink://actors/popular">🔥 热门明星</Option>
                        </OptGroup>
                        
                        <OptGroup label="📰 文章">
                          <Option value="deeplink://articles">📰 文章列表</Option>
                          {articleCategories.map(cat => (
                            <Option key={`art-${cat.id}`} value={`deeplink://articles?type=${cat.id}`}>
                              📄 {cat.name}
                            </Option>
                          ))}
                        </OptGroup>
                        
                        <OptGroup label="🎬 视频分类">
                          {categories.map(cat => (
                            <Option key={cat.id} value={`video://?t=${cat.id}`}>
                              {cat.icon || '📁'} {cat.name}
                            </Option>
                          ))}
                        </OptGroup>
                        
                        {/* 子分类 */}
                        {categories.filter(cat => cat.subCategories && cat.subCategories.length > 0).map(cat => (
                          <OptGroup key={`sub-${cat.id}`} label={`└─ ${cat.name} 子分类`}>
                            {cat.subCategories.map(sub => (
                              <Option key={`sub-${sub.id}`} value={`video://?t=${cat.id}&sub=${sub.id}`}>
                                　📂 {sub.name}
                              </Option>
                            ))}
                          </OptGroup>
                        ))}
                        
                        {topics.length > 0 && (
                          <OptGroup label="📚 专题">
                            {topics.map(topic => (
                              <Option key={topic.id} value={`deeplink://topic?id=${topic.id}`}>
                                📚 {topic.title}
                              </Option>
                            ))}
                          </OptGroup>
                        )}
                      </Select>
                    </Form.Item>
                  )}
                </>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GridIconsEditor;
