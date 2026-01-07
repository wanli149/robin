/**
 * Layout Editor Page
 * 布局编辑器 - 三栏布局
 */

import { useState, useEffect } from 'react';
import { Layout, Typography, message, Spin } from 'antd';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ChannelSelector from '../components/LayoutEditor/ChannelSelector';
import ModuleCanvas from '../components/LayoutEditor/ModuleCanvas';
import ModuleInspector from '../components/LayoutEditor/ModuleInspector';
import { getLayout, updateLayout } from '../services/adminApi';

const { Sider, Content } = Layout;
const { Title } = Typography;

export interface Module {
  id?: number;
  tab_id?: string;
  module_type: string;
  title: string | null;
  api_params: any;
  ad_config: any;
  sort_order: number;
  is_enabled?: boolean;
}

const LayoutEditor: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState('featured');
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [saving, setSaving] = useState(false);

  // 加载布局数据
  const loadLayout = async (tabId: string) => {
    setLoading(true);
    try {
      const data = await getLayout(tabId);
      setModules(data.modules || []);
      setSelectedModule(null);
    } catch (error: any) {
      message.error(error.message || '加载布局失败');
    } finally {
      setLoading(false);
    }
  };

  // 切换频道
  const handleTabChange = (tabId: string) => {
    setSelectedTab(tabId);
    loadLayout(tabId);
  };

  // 更新模块顺序
  const handleModulesReorder = (newModules: Module[]) => {
    const reorderedModules = newModules.map((module, index) => ({
      ...module,
      sort_order: index,
    }));
    setModules(reorderedModules);
  };

  // 选择模块
  const handleModuleSelect = (module: Module) => {
    setSelectedModule(module);
  };

  // 更新模块属性
  const handleModuleUpdate = (updatedModule: Module) => {
    const moduleIndex = modules.findIndex((m) => 
      m.id ? m.id === updatedModule.id : m.sort_order === updatedModule.sort_order && m.module_type === updatedModule.module_type
    );
    
    if (moduleIndex === -1) return;
    
    const updatedModules = [...modules];
    updatedModules[moduleIndex] = updatedModule;
    setModules(updatedModules);
    setSelectedModule(updatedModule);
  };

  // 删除模块
  const handleModuleDelete = (moduleToDelete: Module) => {
    const moduleIndex = modules.findIndex((m) => 
      m.id ? m.id === moduleToDelete.id : m.sort_order === moduleToDelete.sort_order && m.module_type === moduleToDelete.module_type && m.title === moduleToDelete.title
    );
    
    if (moduleIndex === -1) return;
    
    const updatedModules = modules
      .filter((_, index) => index !== moduleIndex)
      .map((m, index) => ({ ...m, sort_order: index }));
    setModules(updatedModules);
    setSelectedModule(null);
    message.success('模块已删除');
  };

  // 切换模块启用/禁用
  const handleModuleToggle = (module: Module, enabled: boolean) => {
    // 使用索引来精确定位模块，避免 sort_order 重复导致的问题
    const moduleIndex = modules.findIndex((m) => 
      m.id ? m.id === module.id : m.sort_order === module.sort_order && m.module_type === module.module_type && m.title === module.title
    );
    
    if (moduleIndex === -1) return;
    
    const updatedModules = [...modules];
    updatedModules[moduleIndex] = { ...updatedModules[moduleIndex], is_enabled: enabled };
    setModules(updatedModules);
    
    // 如果当前选中的模块被切换，更新选中状态
    if (selectedModule && (
      (selectedModule.id && selectedModule.id === module.id) ||
      (selectedModule.sort_order === module.sort_order && selectedModule.module_type === module.module_type && selectedModule.title === module.title)
    )) {
      setSelectedModule({ ...module, is_enabled: enabled });
    }
    
    message.success(enabled ? '模块已启用' : '模块已禁用');
  };

  // 保存布局
  const handleSave = async () => {
    setSaving(true);
    try {
      // 确保每个模块都有 tab_id
      const modulesWithTabId = modules.map(m => ({
        ...m,
        tab_id: selectedTab,
      }));
      await updateLayout(selectedTab, modulesWithTabId);
      message.success('布局保存成功');
    } catch (error: any) {
      message.error(error.message || '保存布局失败');
    } finally {
      setSaving(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadLayout(selectedTab);
  }, []);

  return (
    <DndProvider backend={HTML5Backend}>
      <div style={{ padding: 24 }}>
        <Title level={2}>布局编辑器</Title>

        <Layout style={{ background: '#fff', minHeight: 'calc(100vh - 200px)' }}>
          {/* 左侧：频道选择器 */}
          <Sider 
            width={180} 
            style={{ 
              background: '#fafafa', 
              padding: 12,
              borderRight: '1px solid #f0f0f0',
            }}
          >
            <ChannelSelector
              selectedTab={selectedTab}
              onTabChange={handleTabChange}
            />
          </Sider>

          {/* 中间：模块画布 */}
          <Content 
            style={{ 
              padding: '0 16px',
              flex: 1,
              minWidth: 0,  // 防止 flex 子元素溢出
              overflow: 'auto',
            }}
          >
            {loading ? (
              <Spin spinning size="large" tip="加载中...">
                <div style={{ height: 400 }} />
              </Spin>
            ) : (
              <ModuleCanvas
                modules={modules}
                onModulesReorder={handleModulesReorder}
                onModuleSelect={handleModuleSelect}
                selectedModule={selectedModule}
                onSave={handleSave}
                saving={saving}
                onModuleToggle={handleModuleToggle}
                tabId={selectedTab}
              />
            )}
          </Content>

          {/* 右侧：属性编辑器 */}
          <Sider 
            width={380} 
            style={{ 
              background: '#fafafa', 
              padding: 12,
              borderLeft: '1px solid #f0f0f0',
              overflow: 'auto',
            }}
          >
            <ModuleInspector
              module={selectedModule}
              onModuleUpdate={handleModuleUpdate}
              onModuleDelete={handleModuleDelete}
              tabId={selectedTab}
            />
          </Sider>
        </Layout>
      </div>
    </DndProvider>
  );
};

export default LayoutEditor;
