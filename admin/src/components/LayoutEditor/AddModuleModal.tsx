/**
 * Add Module Modal Component
 * 添加模块弹窗
 */

import { useState } from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import type { Module } from '../../pages/LayoutEditor';
import ApiParamsEditor from './ApiParamsEditor';
import AdConfigEditor from './AdConfigEditor';

interface AddModuleModalProps {
  visible: boolean;
  onCancel: () => void;
  onAdd: (module: Module) => void;
}

// 模块类型分组配置
const MODULE_TYPE_GROUPS = [
  {
    label: '基础模块',
    options: [
      { value: 'carousel', label: '🎠 轮播图' },
      { value: 'grid_icons', label: '🔲 金刚区' },
      { value: 'continue_watching', label: '▶️ 继续观看' },
      { value: 'login_prompt', label: '🔐 登录提示' },
    ],
  },
  {
    label: '推广模块',
    options: [
      { value: 'banner', label: '🖼️ 横幅广告' },
      { value: 'notice', label: '📢 公告通知' },
    ],
  },
  {
    label: '网格模块',
    options: [
      { value: 'grid_3x2', label: '📱 3x2网格' },
      { value: 'grid_3x3', label: '📱 3x3网格' },
      { value: 'grid_3x2_ad', label: '📱 3x2网格+广告' },
      { value: 'grid_3x3_ad', label: '📱 3x3网格+广告' },
    ],
  },
  {
    label: '瀑布流模块',
    options: [
      { value: 'waterfall', label: '🌊 瀑布流(默认)' },
      { value: 'waterfall_2col', label: '🌊 瀑布流(2列)' },
      { value: 'waterfall_3col', label: '🌊 瀑布流(3列)' },
    ],
  },
  {
    label: '列表模块',
    options: [
      { value: 'horizontal_scroll', label: '↔️ 横向滚动' },
      { value: 'vertical_list', label: '↕️ 竖向列表' },
      { value: 'ranking', label: '🏆 排行榜' },
    ],
  },
  {
    label: '分类模块',
    options: [
      { value: 'category_tabs', label: '🏷️ 分类标签页' },
      { value: 'actor_list', label: '👤 演员列表' },
      { value: 'topic_list', label: '📚 专题列表' },
      { value: 'article_list', label: '📰 文章列表' },
    ],
  },
  {
    label: '时间轴模块',
    options: [
      { value: 'timeline', label: '📅 时间轴' },
      { value: 'week_timeline', label: '📆 周更新表' },
    ],
  },
];

const AddModuleModal: React.FC<AddModuleModalProps> = ({
  visible,
  onCancel,
  onAdd,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedModuleType, setSelectedModuleType] = useState<string>('');
  const [apiParams, setApiParams] = useState<any>(null);
  const [adConfig, setAdConfig] = useState<any>(null);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const newModule: Module = {
        module_type: values.module_type,
        title: values.title || null,
        api_params: apiParams,
        ad_config: adConfig,
        sort_order: 0, // 将在父组件中设置
      };

      onAdd(newModule);
      form.resetFields();
      setSelectedModuleType('');
      setApiParams(null);
      setAdConfig(null);
      message.success('模块添加成功');
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setSelectedModuleType('');
    setApiParams(null);
    setAdConfig(null);
    onCancel();
  };

  return (
    <Modal
      title="添加新模块"
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      width={600}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="模块类型"
          name="module_type"
          rules={[{ required: true, message: '请选择模块类型' }]}
        >
          <Select
            placeholder="选择模块类型"
            options={MODULE_TYPE_GROUPS}
            onChange={(value) => {
              setSelectedModuleType(value);
              setApiParams(null);
              setAdConfig(null);
            }}
          />
        </Form.Item>

        <Form.Item label="模块标题" name="title">
          <Input placeholder="输入模块标题（可选）" />
        </Form.Item>

        {selectedModuleType && (
          <>
            <Form.Item label="API参数" help="根据模块类型配置数据源参数">
              <ApiParamsEditor
                moduleType={selectedModuleType}
                value={apiParams}
                onChange={setApiParams}
              />
            </Form.Item>

            <Form.Item label="广告配置" help="配置广告插入位置和ID">
              <AdConfigEditor value={adConfig} onChange={setAdConfig} />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
};

export default AddModuleModal;
