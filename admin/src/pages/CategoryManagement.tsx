/**
 * Category Management Page
 * 分类管理页面 - 管理视频分类、子分类和资源站分类映射
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Tabs,
  Statistic,
  Row,
  Col,
  Popconfirm,
  Select,
  Typography,
  Collapse,
  List,
  Badge,
  Tooltip,
  Alert,
} from 'antd';
import { useNotification } from '../components/providers';
import {
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  SyncOutlined,
  TagsOutlined,
  LinkOutlined,
  BarChartOutlined,
  ApartmentOutlined,
  DatabaseOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import {
  getSubCategories,
  saveSubCategory,
  deleteSubCategory,
  migrateSubCategories,
  getCategories,
  getCategoryStats,
  getSources,
  getCategoryMappings,
  saveCategory,
  deleteCategory,
  saveCategoryMapping,
  deleteCategoryMapping,
  type SubCategory,
} from '../services/adminApi';

const { Text } = Typography;

// 分类类型
interface Category {
  id: number;
  name: string;
  name_en: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  collect_enabled: boolean;
  video_count?: number;
}

// 资源站分类映射
interface SourceTypeMapping {
  id?: number;
  source_id: number;
  source_name: string;
  source_type_id: string;
  source_type_name?: string;
  target_category_id: number;
}

// 分类统计
interface CategoryStats {
  id: number;
  name: string;
  video_count: number;
  today_new: number;
  week_new: number;
}

const CategoryManagement: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mappings, setMappings] = useState<SourceTypeMapping[]>([]);
  const [stats, setStats] = useState<CategoryStats[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  
  // 弹窗状态
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [mappingModalVisible, setMappingModalVisible] = useState(false);
  const [subCategoryModalVisible, setSubCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingMapping, setEditingMapping] = useState<SourceTypeMapping | null>(null);
  const [editingSubCategory, setEditingSubCategory] = useState<SubCategory | null>(null);
  
  const [categoryForm] = Form.useForm();
  const [mappingForm] = Form.useForm();
  const [subCategoryForm] = Form.useForm();
  const { success, error, loading: showLoading } = useNotification();

  // 加载分类列表
  const loadCategories = useCallback(async () => {
    try {
      const data = await getCategories();
      setCategories(data as Category[]);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, []);

  // 加载分类统计
  const loadStats = useCallback(async () => {
    try {
      const data = await getCategoryStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  // 加载资源站列表
  const loadSources = useCallback(async () => {
    try {
      const data = await getSources();
      setSources(data);
    } catch (error) {
      console.error('Failed to load sources:', error);
    }
  }, []);

  // 加载分类映射
  const loadMappings = useCallback(async () => {
    try {
      const data = await getCategoryMappings();
      setMappings(data as SourceTypeMapping[]);
    } catch (error) {
      console.error('Failed to load mappings:', error);
    }
  }, []);

  // 加载子分类
  const loadSubCategories = useCallback(async () => {
    try {
      const list = await getSubCategories();
      setSubCategories(list);
    } catch (error) {
      console.error('Failed to load sub-categories:', error);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    setLoading(true);
    Promise.all([loadCategories(), loadStats(), loadSources(), loadMappings(), loadSubCategories()])
      .finally(() => setLoading(false));
  }, [loadCategories, loadStats, loadSources, loadMappings, loadSubCategories]);

  // 保存分类
  const handleSaveCategory = async () => {
    try {
      const values = await categoryForm.validateFields();
      await saveCategory({
        ...values,
        id: editingCategory?.id,
      });
      success(editingCategory ? '更新成功' : '添加成功');
      setCategoryModalVisible(false);
      loadCategories();
      loadStats();
    } catch (err: any) {
      error(err.message || '保存失败');
    }
  };

  // 删除分类
  const handleDeleteCategory = async (id: number) => {
    try {
      await deleteCategory(id);
      success('删除成功');
      loadCategories();
    } catch (err: any) {
      error(err.message || '删除失败');
    }
  };

  // 保存映射
  const handleSaveMapping = async () => {
    try {
      const values = await mappingForm.validateFields();
      const source = sources.find(s => s.id === values.source_id);
      
      await saveCategoryMapping({
        ...values,
        source_name: source?.name || '',
      });
      success('保存成功');
      setMappingModalVisible(false);
      loadMappings();
    } catch (err: any) {
      error(err.message || '保存失败');
    }
  };

  // 删除映射
  const handleDeleteMapping = async (id: number) => {
    try {
      await deleteCategoryMapping(id);
      success('删除成功');
      loadMappings();
    } catch (err: any) {
      error(err.message || '删除失败');
    }
  };

  // 保存子分类
  const handleSaveSubCategory = async () => {
    try {
      const values = await subCategoryForm.validateFields();
      await saveSubCategory({
        ...values,
        id: editingSubCategory?.id,
      });
      success(editingSubCategory ? '更新成功' : '添加成功');
      setSubCategoryModalVisible(false);
      loadSubCategories();
    } catch (err) {
      error('保存失败');
    }
  };

  // 删除子分类
  const handleDeleteSubCategory = async (id: number) => {
    try {
      await deleteSubCategory(id);
      success('删除成功');
      loadSubCategories();
    } catch (err) {
      error('删除失败');
    }
  };

  // 执行子分类迁移
  const handleMigrateSubCategories = async () => {
    const hide = showLoading('正在迁移...');
    try {
      const result = await migrateSubCategories();
      hide();
      if (result.success) {
        success(`迁移成功！创建了 ${result.subCategoriesCreated} 个子分类`);
        loadSubCategories();
      } else {
        error(result.message || '迁移失败');
      }
    } catch (err) {
      hide();
      error('迁移失败');
    }
  };

  // 打开编辑子分类弹窗
  const openSubCategoryModal = (subCategory?: SubCategory) => {
    setEditingSubCategory(subCategory || null);
    subCategoryForm.resetFields();
    if (subCategory) {
      subCategoryForm.setFieldsValue(subCategory);
    } else {
      subCategoryForm.setFieldsValue({
        parent_id: 1,
        sort_order: 0,
        is_active: true,
      });
    }
    setSubCategoryModalVisible(true);
  };

  // 打开编辑分类弹窗
  const openCategoryModal = (category?: Category) => {
    setEditingCategory(category || null);
    categoryForm.resetFields();
    if (category) {
      categoryForm.setFieldsValue(category);
    } else {
      categoryForm.setFieldsValue({
        sort_order: categories.length + 1,
        is_active: true,
        collect_enabled: true,
      });
    }
    setCategoryModalVisible(true);
  };

  // 打开编辑映射弹窗
  const openMappingModal = (mapping?: SourceTypeMapping) => {
    setEditingMapping(mapping || null);
    mappingForm.resetFields();
    if (mapping) {
      mappingForm.setFieldsValue(mapping);
    }
    setMappingModalVisible(true);
  };

  // 分类列表列定义
  const categoryColumns: ColumnsType<Category> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: '分类名称',
      dataIndex: 'name',
      width: 120,
      render: (name: string, record) => (
        <Space>
          {record.icon && <span>{record.icon}</span>}
          <span>{name}</span>
        </Space>
      ),
    },
    {
      title: '英文名',
      dataIndex: 'name_en',
      width: 100,
    },
    {
      title: '视频数量',
      dataIndex: 'video_count',
      width: 100,
      render: (count: number) => (
        <Tag color="blue">{count || 0}</Tag>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 80,
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'}>
          {active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '采集',
      dataIndex: 'collect_enabled',
      width: 80,
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'processing' : 'default'}>
          {enabled ? '开启' : '关闭'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openCategoryModal(record)}
          >
            编辑
          </Button>
          {record.id > 5 && (
            <Popconfirm
              title="确定删除此分类？"
              onConfirm={() => handleDeleteCategory(record.id)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // 按资源站分组的映射
  const mappingsBySource = sources.map(source => ({
    source,
    mappings: mappings.filter(m => m.source_id === source.id),
  })).filter(item => item.mappings.length > 0 || item.source.is_active);

  return (
    <div style={{ padding: 24 }}>
      <h2>分类管理</h2>

      {/* 统计卡片 - 点击跳转到视频管理 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {stats.map(stat => (
          <Col span={4} key={stat.id}>
            <Card 
              size="small" 
              hoverable
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/video-management?category=${stat.id}`)}
            >
              <Statistic
                title={
                  <Space>
                    <span>{stat.name}</span>
                    <RightOutlined style={{ fontSize: 10, color: '#999' }} />
                  </Space>
                }
                value={stat.video_count}
                suffix={
                  stat.today_new > 0 && (
                    <Text type="success" style={{ fontSize: 12 }}>
                      +{stat.today_new}
                    </Text>
                  )
                }
              />
            </Card>
          </Col>
        ))}
        <Col span={4}>
          <Card 
            size="small"
            hoverable
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/video-management')}
          >
            <Statistic
              title={
                <Space>
                  <span>总计</span>
                  <RightOutlined style={{ fontSize: 10, color: '#999' }} />
                </Space>
              }
              value={stats.reduce((sum, s) => sum + s.video_count, 0)}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 标签页 */}
      <Tabs
        defaultActiveKey="categories"
        items={[
          {
            key: 'categories',
            label: (
              <span><TagsOutlined /> 分类列表</span>
            ),
            children: (
              <Card
                extra={
                  <Space>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => openCategoryModal()}
                    >
                      添加分类
                    </Button>
                  </Space>
                }
              >
                <Table
                  columns={categoryColumns}
                  dataSource={categories}
                  rowKey="id"
                  loading={loading}
                  pagination={false}
                />
              </Card>
            ),
          },
          {
            key: 'mappings',
            label: (
              <span>
                <LinkOutlined /> 分类映射
                <Badge count={mappings.length} style={{ marginLeft: 8 }} />
              </span>
            ),
            children: (
              <Card
                extra={
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => openMappingModal()}
                  >
                    添加映射
                  </Button>
                }
              >
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary">
                    配置资源站的分类ID到标准分类的映射关系。采集时会自动根据映射转换分类。
                  </Text>
                </div>
                
                <Collapse
                  items={mappingsBySource.map(({ source, mappings: sourceMappings }) => ({
                    key: source.id,
                    label: (
                      <Space>
                        <span>{source.name}</span>
                        <Tag>{sourceMappings.length} 条映射</Tag>
                        {!source.is_active && <Tag color="default">已禁用</Tag>}
                      </Space>
                    ),
                    children: (
                      <List
                        size="small"
                        dataSource={sourceMappings}
                        renderItem={(mapping) => {
                          const targetCategory = categories.find(c => c.id === mapping.target_category_id);
                          return (
                            <List.Item
                              actions={[
                                <Button
                                  type="link"
                                  size="small"
                                  onClick={() => openMappingModal(mapping)}
                                >
                                  编辑
                                </Button>,
                                <Popconfirm
                                  title="确定删除此映射？"
                                  onConfirm={() => handleDeleteMapping(mapping.id!)}
                                >
                                  <Button type="link" size="small" danger>
                                    删除
                                  </Button>
                                </Popconfirm>,
                              ]}
                            >
                              <Space>
                                <Tag>{mapping.source_type_id}</Tag>
                                {mapping.source_type_name && (
                                  <Text type="secondary">({mapping.source_type_name})</Text>
                                )}
                                <span>→</span>
                                <Tag color="blue">{targetCategory?.name || '未知'}</Tag>
                              </Space>
                            </List.Item>
                          );
                        }}
                        locale={{ emptyText: '暂无映射配置' }}
                      />
                    ),
                  }))}
                />
              </Card>
            ),
          },
          {
            key: 'subCategories',
            label: (
              <span>
                <ApartmentOutlined /> 子分类
                <Badge count={subCategories.length} style={{ marginLeft: 8 }} />
              </span>
            ),
            children: (
              <Card
                extra={
                  <Space>
                    <Popconfirm
                      title="初始化子分类数据？"
                      description="将创建默认的子分类配置，已存在的不会重复创建"
                      onConfirm={handleMigrateSubCategories}
                    >
                      <Button icon={<DatabaseOutlined />}>
                        初始化数据
                      </Button>
                    </Popconfirm>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => openSubCategoryModal()}
                    >
                      添加子分类
                    </Button>
                  </Space>
                }
              >
                <Alert
                  message="子分类说明"
                  description="子分类用于更精细地分类视频内容。采集时会根据关键词自动识别子分类。关键词用英文逗号分隔。"
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                
                <Collapse
                  defaultActiveKey={categories.map(c => c.id)}
                  items={categories.map(category => {
                    const categorySubs = subCategories.filter(s => s.parent_id === category.id);
                    return {
                      key: category.id,
                      label: (
                        <Space>
                          {category.icon && <span>{category.icon}</span>}
                          <span>{category.name}</span>
                          <Tag color="blue">{categorySubs.length} 个子分类</Tag>
                        </Space>
                      ),
                      children: (
                        <Table
                          size="small"
                          dataSource={categorySubs}
                          rowKey="id"
                          pagination={false}
                          columns={[
                            {
                              title: '子分类名称',
                              dataIndex: 'name',
                              width: 120,
                              render: (name: string, record: SubCategory) => (
                                <Space>
                                  {record.icon && <span>{record.icon}</span>}
                                  <span>{name}</span>
                                </Space>
                              ),
                            },
                            {
                              title: '英文名',
                              dataIndex: 'name_en',
                              width: 100,
                            },
                            {
                              title: '关键词',
                              dataIndex: 'keywords',
                              ellipsis: true,
                              render: (keywords: string) => (
                                <Tooltip title={keywords}>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {keywords || '无'}
                                  </Text>
                                </Tooltip>
                              ),
                            },
                            {
                              title: '视频数',
                              dataIndex: 'video_count',
                              width: 80,
                              render: (count: number) => (
                                <Tag>{count || 0}</Tag>
                              ),
                            },
                            {
                              title: '状态',
                              dataIndex: 'is_active',
                              width: 70,
                              render: (active: boolean | number) => (
                                <Tag color={active ? 'success' : 'default'}>
                                  {active ? '启用' : '禁用'}
                                </Tag>
                              ),
                            },
                            {
                              title: '操作',
                              key: 'action',
                              width: 120,
                              render: (_: unknown, record: SubCategory) => (
                                <Space size="small">
                                  <Button
                                    type="link"
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => openSubCategoryModal(record)}
                                  >
                                    编辑
                                  </Button>
                                  <Popconfirm
                                    title="确定删除此子分类？"
                                    onConfirm={() => handleDeleteSubCategory(record.id)}
                                  >
                                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                                      删除
                                    </Button>
                                  </Popconfirm>
                                </Space>
                              ),
                            },
                          ]}
                          locale={{ emptyText: '暂无子分类' }}
                        />
                      ),
                    };
                  })}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* 编辑分类弹窗 */}
      <Modal
        title={editingCategory ? '编辑分类' : '添加分类'}
        open={categoryModalVisible}
        onOk={handleSaveCategory}
        onCancel={() => setCategoryModalVisible(false)}
        width={500}
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item
            label="分类名称"
            name="name"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input placeholder="如：电影" />
          </Form.Item>
          <Form.Item
            label="英文名"
            name="name_en"
            rules={[{ required: true, message: '请输入英文名' }]}
          >
            <Input placeholder="如：movie" />
          </Form.Item>
          <Form.Item label="图标" name="icon">
            <Input placeholder="如：🎬" />
          </Form.Item>
          <Form.Item label="排序" name="sort_order">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="启用" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="启用采集" name="collect_enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑映射弹窗 */}
      <Modal
        title={editingMapping ? '编辑映射' : '添加映射'}
        open={mappingModalVisible}
        onOk={handleSaveMapping}
        onCancel={() => setMappingModalVisible(false)}
        width={500}
      >
        <Form form={mappingForm} layout="vertical">
          <Form.Item
            label="资源站"
            name="source_id"
            rules={[{ required: true, message: '请选择资源站' }]}
          >
            <Select placeholder="选择资源站">
              {sources.filter(s => s.is_active).map(source => (
                <Select.Option key={source.id} value={source.id}>
                  {source.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="资源站分类ID"
            name="source_type_id"
            rules={[{ required: true, message: '请输入资源站分类ID' }]}
            help="资源站返回的原始分类ID，如：6、7、13等"
          >
            <Input placeholder="如：6" />
          </Form.Item>
          <Form.Item
            label="资源站分类名称"
            name="source_type_name"
            help="可选，便于识别"
          >
            <Input placeholder="如：动作片" />
          </Form.Item>
          <Form.Item
            label="映射到分类"
            name="target_category_id"
            rules={[{ required: true, message: '请选择目标分类' }]}
          >
            <Select placeholder="选择目标分类">
              {categories.filter(c => c.is_active).map(cat => (
                <Select.Option key={cat.id} value={cat.id}>
                  {cat.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑子分类弹窗 */}
      <Modal
        title={editingSubCategory ? '编辑子分类' : '添加子分类'}
        open={subCategoryModalVisible}
        onOk={handleSaveSubCategory}
        onCancel={() => setSubCategoryModalVisible(false)}
        width={550}
      >
        <Form form={subCategoryForm} layout="vertical">
          <Form.Item
            label="所属分类"
            name="parent_id"
            rules={[{ required: true, message: '请选择所属分类' }]}
          >
            <Select placeholder="选择所属分类">
              {categories.filter(c => c.is_active).map(cat => (
                <Select.Option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="子分类名称"
            name="name"
            rules={[{ required: true, message: '请输入子分类名称' }]}
          >
            <Input placeholder="如：动作片、都市剧" />
          </Form.Item>
          <Form.Item
            label="英文名"
            name="name_en"
          >
            <Input placeholder="如：action、urban" />
          </Form.Item>
          <Form.Item label="图标" name="icon">
            <Input placeholder="如：🎬" />
          </Form.Item>
          <Form.Item
            label="关键词"
            name="keywords"
            help="用于自动识别子分类，多个关键词用英文逗号分隔"
          >
            <Input.TextArea
              placeholder="如：动作,打斗,武打,功夫,枪战"
              rows={3}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="排序" name="sort_order">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="启用" name="is_active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default CategoryManagement;
