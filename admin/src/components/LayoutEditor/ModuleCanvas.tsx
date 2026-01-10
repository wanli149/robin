/**
 * Module Canvas Component
 * 模块画布 - 支持拖拽排序
 */

import { useCallback, useState } from 'react';
import { Card, Button, Empty, Space } from 'antd';
import { useNotification } from '../providers';
import { SaveOutlined, PlusOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { Module } from '../../pages/LayoutEditor';
import { validateLayout, type ValidationResult } from '../../services/adminApi';
import ValidationModal from './ValidationModal';
import DraggableModule from './DraggableModule';
import AddModuleModal from './AddModuleModal';

interface ModuleCanvasProps {
  modules: Module[];
  onModulesReorder: (modules: Module[]) => void;
  onModuleSelect: (module: Module) => void;
  selectedModule: Module | null;
  onSave: () => void;
  saving: boolean;
  onModuleToggle?: (module: Module, enabled: boolean) => void;
  tabId: string; // 当前频道ID
}

const ModuleCanvas: React.FC<ModuleCanvasProps> = ({
  modules,
  onModulesReorder,
  onModuleSelect,
  selectedModule,
  onSave,
  saving,
  onModuleToggle,
  tabId,
}) => {
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [validationModalVisible, setValidationModalVisible] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [validating, setValidating] = useState(false);
  const { error } = useNotification();

  // 移动模块
  const moveModule = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      const dragModule = modules[dragIndex];
      const newModules = [...modules];
      newModules.splice(dragIndex, 1);
      newModules.splice(hoverIndex, 0, dragModule);
      onModulesReorder(newModules);
    },
    [modules, onModulesReorder]
  );

  // 添加新模块
  const handleAddModule = (newModule: Module) => {
    const updatedModules = [
      ...modules,
      {
        ...newModule,
        sort_order: modules.length,
      },
    ];
    onModulesReorder(updatedModules);
    setAddModalVisible(false);
  };

  // 验证布局
  const handleValidate = async () => {
    setValidating(true);
    try {
      // 转换 Module[] 为 LayoutModule[] 格式
      const layoutModules = modules.map(m => ({
        ...m,
        tab_id: m.tab_id || tabId,
      }));
      const results = await validateLayout(tabId, layoutModules);
      setValidationResults(results);
      setValidationModalVisible(true);
    } catch (err: any) {
      error(err.message || '验证失败');
    } finally {
      setValidating(false);
    }
  };

  // 确认保存（验证后）
  const handleConfirmSave = () => {
    setValidationModalVisible(false);
    onSave();
  };

  return (
    <div>
      {/* 顶部操作栏 */}
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontWeight: 'bold', fontSize: 16 }}>
          模块列表 ({modules.length})
        </div>
        <Space>
          <Button
            icon={<PlusOutlined />}
            onClick={() => setAddModalVisible(true)}
          >
            添加模块
          </Button>
          <Button
            icon={<CheckCircleOutlined />}
            onClick={handleValidate}
            loading={validating}
          >
            验证配置
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleValidate}
            loading={saving || validating}
          >
            验证并保存
          </Button>
        </Space>
      </div>

      {/* 模块列表 */}
      {modules.length === 0 ? (
        <Card>
          <Empty description="暂无模块，点击添加模块开始配置" />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {modules.map((module, index) => (
            <DraggableModule
              key={index}
              index={index}
              module={module}
              moveModule={moveModule}
              onSelect={() => onModuleSelect(module)}
              isSelected={
                selectedModule !== null && (
                  (selectedModule.id && module.id && selectedModule.id === module.id) ||
                  (!selectedModule.id && !module.id && 
                   selectedModule.sort_order === module.sort_order && 
                   selectedModule.module_type === module.module_type &&
                   selectedModule.title === module.title)
                )
              }
              onToggleEnable={onModuleToggle}
            />
          ))}
        </div>
      )}

      {/* 添加模块弹窗 */}
      <AddModuleModal
        visible={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onAdd={handleAddModule}
      />

      {/* 验证结果弹窗 */}
      <ValidationModal
        visible={validationModalVisible}
        results={validationResults}
        onConfirm={handleConfirmSave}
        onCancel={() => setValidationModalVisible(false)}
        loading={saving}
      />
    </div>
  );
};

export default ModuleCanvas;
