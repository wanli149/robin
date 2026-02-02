/**
 * Topic Modal Component
 * 专题创建/编辑弹窗 - 支持多种数据来源
 */

import { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Switch,
  InputNumber,
  Row,
  Col,
  Select,
  Divider,
  Alert,
} from 'antd';
import { useNotification } from './providers';
import { saveTopic, getCategoriesWithSubs } from '../services/adminApi';

const { Option } = Select;

interface TopicModalProps {
  visible: boolean;
  topic: any | null;
  onCancel: () => void;
  onSave: () => void;
}

// 数据来源类型
const DATA_SOURCE_TYPES = [
  { value: 'manual', label: '手动选择', desc: '手动添加视频到专题' },
  { value: 'actor', label: '按演员', desc: '自动获取指定演员的所有作品' },
  { value: 'keyword', label: '按关键词', desc: '搜索包含关键词的视频' },
  { value: 'company', label: '按公司/标签', desc: '搜索制作公司或标签' },
  { value: 'filter', label: '按条件筛选', desc: '按分类、年份、地区等筛选' },
];

const TopicModal: React.FC<TopicModalProps> = ({
  visible,
  topic,
  onCancel,
  onSave,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [dataSourceType, setDataSourceType] = useState<string>('manual');
  const [categories, setCategories] = useState<any[]>([]);
  const { success, error, warning } = useNotification();

  // 加载分类数据
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await getCategoriesWithSubs();
        setCategories(data.categories || []);
      } catch (e) {
        logger.admin.error('Failed to load categories:', { error: e });
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    if (visible && topic) {
      const sourceType = topic.data_source_type || 'manual';
      setDataSourceType(sourceType);
      form.setFieldsValue({
        ...topic,
        is_active: topic.is_active !== false,
        sort_order: topic.sort_order || 0,
        data_source_type: sourceType,
        // 展开 data_source_config
        ...(topic.data_source_config || {}),
      });
      if (topic.cover_img) {
        setPreviewImage(topic.cover_img);
      }
    } else if (visible) {
      form.resetFields();
      setDataSourceType('manual');
      form.setFieldsValue({
        is_active: true,
        sort_order: 0,
        data_source_type: 'manual',
      });
      setPreviewImage('');
    }
  }, [visible, topic, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // 构建 data_source_config
      let dataSourceConfig: any = null;
      const sourceType = values.data_source_type || 'manual';

      if (sourceType === 'actor') {
        dataSourceConfig = { actor_name: values.actor_name };
      } else if (sourceType === 'keyword') {
        dataSourceConfig = { keyword: values.keyword };
      } else if (sourceType === 'company') {
        dataSourceConfig = { company: values.company };
      } else if (sourceType === 'filter') {
        dataSourceConfig = {
          type_id: values.filter_type_id,
          year: values.filter_year,
          year_from: values.filter_year_from,
          year_to: values.filter_year_to,
          area: values.filter_area,
          min_score: values.filter_min_score,
        };
      }

      await saveTopic({
        id: values.id,
        title: values.title,
        cover_img: values.cover_img,
        description: values.description,
        is_active: values.is_active ? 1 : 0,
        sort_order: values.sort_order,
        data_source_type: sourceType,
        data_source_config: dataSourceConfig,
      });

      success(topic ? '更新成功' : '创建成功');
      form.resetFields();
      setPreviewImage('');
      onSave();
    } catch (err: any) {
      if (err.errorFields) return;
      error(err.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCoverUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreviewImage(e.target.value);
  };

  const handleDataSourceTypeChange = (value: string) => {
    setDataSourceType(value);
  };

  // 获取当前数据源类型的描述
  const currentSourceDesc = DATA_SOURCE_TYPES.find(t => t.value === dataSourceType)?.desc;

  return (
    <Modal
      title={topic ? '编辑专题' : '新建专题'}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      width={700}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={16}>
            <Form.Item
              label="专题ID"
              name="id"
              rules={[
                { required: true, message: '请输入专题ID' },
                { pattern: /^[a-z0-9_]+$/, message: '只能包含小写字母、数字和下划线' },
              ]}
              help="唯一标识，如: lin_zhengying"
            >
              <Input placeholder="lin_zhengying" disabled={!!topic} maxLength={50} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="状态" name="is_active" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={16}>
            <Form.Item
              label="专题标题"
              name="title"
              rules={[{ required: true, message: '请输入专题标题' }]}
            >
              <Input placeholder="林正英经典僵尸片" maxLength={100} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="排序权重" name="sort_order" help="数值越小越靠前">
              <InputNumber min={0} max={999} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="封面图URL" name="cover_img" rules={[{ type: 'url', message: '请输入有效的URL' }]}>
          <Input placeholder="https://example.com/cover.jpg" onChange={handleCoverUrlChange} />
        </Form.Item>

        {previewImage && (
          <Form.Item label="封面预览">
            <img
              src={previewImage}
              alt="预览"
              style={{ maxWidth: '100%', maxHeight: 150, objectFit: 'contain', border: '1px solid #d9d9d9', borderRadius: 4 }}
              onError={() => { warning('图片加载失败'); setPreviewImage(''); }}
            />
          </Form.Item>
        )}

        <Form.Item label="专题描述" name="description">
          <Input.TextArea placeholder="简短描述这个专题的内容" rows={3} maxLength={500} showCount />
        </Form.Item>

        <Divider>数据来源配置</Divider>

        <Form.Item
          label="数据来源方式"
          name="data_source_type"
          help={currentSourceDesc}
        >
          <Select onChange={handleDataSourceTypeChange}>
            {DATA_SOURCE_TYPES.map(type => (
              <Option key={type.value} value={type.value}>{type.label}</Option>
            ))}
          </Select>
        </Form.Item>

        {/* 按演员 */}
        {dataSourceType === 'actor' && (
          <Form.Item
            label="演员名称"
            name="actor_name"
            rules={[{ required: true, message: '请输入演员名称' }]}
            help="如：林正英、周星驰、成龙"
          >
            <Input placeholder="林正英" />
          </Form.Item>
        )}

        {/* 按关键词 */}
        {dataSourceType === 'keyword' && (
          <Form.Item
            label="搜索关键词"
            name="keyword"
            rules={[{ required: true, message: '请输入关键词' }]}
            help="搜索视频名称、简介中包含该关键词的视频"
          >
            <Input placeholder="国产大片" />
          </Form.Item>
        )}

        {/* 按公司/标签 */}
        {dataSourceType === 'company' && (
          <Form.Item
            label="公司/标签名称"
            name="company"
            rules={[{ required: true, message: '请输入公司或标签名称' }]}
            help="如：迪士尼、漫威、皮克斯"
          >
            <Input placeholder="迪士尼" />
          </Form.Item>
        )}

        {/* 按条件筛选 */}
        {dataSourceType === 'filter' && (
          <>
            <Alert
              message="条件筛选"
              description="设置筛选条件，系统会自动匹配符合条件的视频"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="分类" name="filter_type_id">
                  <Select allowClear placeholder="选择分类">
                    {categories.map(cat => (
                      <Option key={cat.id} value={cat.id}>{cat.name}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="地区" name="filter_area">
                  <Select allowClear placeholder="选择地区">
                    <Option value="中国大陆">中国大陆</Option>
                    <Option value="中国香港">中国香港</Option>
                    <Option value="中国台湾">中国台湾</Option>
                    <Option value="美国">美国</Option>
                    <Option value="日本">日本</Option>
                    <Option value="韩国">韩国</Option>
                    <Option value="英国">英国</Option>
                    <Option value="法国">法国</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="指定年份" name="filter_year">
                  <InputNumber min={1900} max={2030} placeholder="如 2024" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="年份起始" name="filter_year_from">
                  <InputNumber min={1900} max={2030} placeholder="如 2020" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="年份结束" name="filter_year_to">
                  <InputNumber min={1900} max={2030} placeholder="如 2024" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="最低评分" name="filter_min_score">
              <InputNumber min={0} max={10} step={0.1} placeholder="如 8.0" style={{ width: 150 }} />
            </Form.Item>
          </>
        )}

        {dataSourceType === 'manual' && (
          <Alert
            message="手动选择模式"
            description="保存专题后，点击「内容」按钮手动添加视频"
            type="info"
            showIcon
          />
        )}
      </Form>
    </Modal>
  );
};

export default TopicModal;
