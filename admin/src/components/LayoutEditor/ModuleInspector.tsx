/**
 * Module Inspector Component
 * 模块属性编辑器
 */

import { Form, Input, Select, InputNumber, Card, Empty, Button, Popconfirm, Space } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { Module } from '../../pages/LayoutEditor';
import { useEffect } from 'react';
import ApiParamsEditor from './ApiParamsEditor';
import ModuleStatsPanel from './ModuleStatsPanel';
import AdConfigEditor from './AdConfigEditor';

interface ModuleInspectorProps {
  module: Module | null;
  onModuleUpdate: (module: Module) => void;
  onModuleDelete?: (module: Module) => void;
  tabId: string; // 当前频道ID
}

const ModuleInspector: React.FC<ModuleInspectorProps> = ({
  module,
  onModuleUpdate,
  onModuleDelete,
  tabId,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (module) {
      form.setFieldsValue({
        title: module.title,
        module_type: module.module_type,
      });
    }
  }, [module, form]);

  const handleValuesChange = (_: any, allValues: any) => {
    if (!module) return;

    const updatedModule: Module = {
      ...module,
      title: allValues.title,
      module_type: allValues.module_type,
    };
    onModuleUpdate(updatedModule);
  };

  if (!module) {
    return (
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Card>
          <Empty description="请选择一个模块进行编辑" />
        </Card>
        <ModuleStatsPanel tabId={tabId} />
      </Space>
    );
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Card>
        <div
          style={{
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 'bold', fontSize: 14 }}>模块属性</span>
          {onModuleDelete && (
            <Popconfirm
              title="确定删除这个模块吗？"
              onConfirm={() => onModuleDelete(module)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="text" danger size="small" icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </div>
        <Form
          form={form}
          layout="vertical"
          onValuesChange={handleValuesChange}
          size="small"
        >
          <Form.Item label="模块标题" name="title">
            <Input placeholder="输入模块标题" />
          </Form.Item>

          <Form.Item label="模块类型" name="module_type">
            <Select>
              <Select.Option value="carousel">轮播图</Select.Option>
              <Select.Option value="grid_icons">金刚区</Select.Option>
              <Select.Option value="grid_3x2">3x2网格</Select.Option>
              <Select.Option value="grid_3x3">3x3网格</Select.Option>
              <Select.Option value="grid_3x2_ad">3x2网格+广告</Select.Option>
              <Select.Option value="grid_3x3_ad">3x3网格+广告</Select.Option>
              <Select.Option value="waterfall">瀑布流</Select.Option>
              <Select.Option value="timeline">时间轴</Select.Option>
              <Select.Option value="week_timeline">周更新表</Select.Option>
              <Select.Option value="horizontal_scroll">横向滚动</Select.Option>
              <Select.Option value="vertical_list">竖向列表</Select.Option>
              <Select.Option value="continue_watching">继续观看</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="API参数" help="根据模块类型配置数据源参数">
            <ApiParamsEditor
              moduleType={module.module_type}
              value={module.api_params}
              onChange={(newParams) => {
                const updatedModule = { ...module, api_params: newParams };
                onModuleUpdate(updatedModule);
              }}
            />
          </Form.Item>

          <Form.Item label="广告配置" help="配置广告插入位置和ID">
            <AdConfigEditor
              value={module.ad_config}
              onChange={(newConfig) => {
                const updatedModule = { ...module, ad_config: newConfig };
                onModuleUpdate(updatedModule);
              }}
            />
          </Form.Item>

          <Form.Item label="排序" help="拖拽模块可调整顺序">
            <InputNumber value={module.sort_order} disabled style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Card>

      {/* 统计面板 */}
      <ModuleStatsPanel tabId={tabId} moduleId={module.id} />
    </Space>
  );
};

export default ModuleInspector;
