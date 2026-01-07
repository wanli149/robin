/**
 * Draggable Module Component
 * 可拖拽的模块卡片
 */

import { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Card, Tag, Space, Switch } from 'antd';
import { HolderOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import type { Module } from '../../pages/LayoutEditor';

interface DraggableModuleProps {
  index: number;
  module: Module;
  moveModule: (dragIndex: number, hoverIndex: number) => void;
  onSelect: () => void;
  isSelected: boolean;
  onToggleEnable?: (module: Module, enabled: boolean) => void; // 新增：开关回调
}

const MODULE_TYPE_NAMES: Record<string, string> = {
  carousel: '轮播图',
  grid_icons: '金刚区',
  grid_3x2_ad: '3x2网格+广告',
  timeline: '时间轴',
  week_timeline: '周更新表',
  horizontal_scroll: '横向滚动',
  vertical_list: '竖向列表',
};

const DraggableModule: React.FC<DraggableModuleProps> = ({
  index,
  module,
  moveModule,
  onSelect,
  isSelected,
  onToggleEnable,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ handlerId }, drop] = useDrop({
    accept: 'module',
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: { index: number }, monitor) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) {
        return;
      }

      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientY = clientOffset!.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      moveModule(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: 'module',
    item: () => {
      return { index };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(ref));

  const isEnabled = module.is_enabled !== false; // 默认启用

  return (
    <div
      ref={ref}
      data-handler-id={handlerId}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <Card
        size="small"
        hoverable
        onClick={onSelect}
        style={{
          cursor: 'move',
          border: isSelected ? '2px solid #1890ff' : '1px solid #d9d9d9',
          backgroundColor: isSelected ? '#e6f7ff' : (isEnabled ? '#fff' : '#f5f5f5'),
          opacity: isEnabled ? 1 : 0.6,
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <HolderOutlined style={{ color: '#999' }} />
            {isEnabled ? (
              <EyeOutlined style={{ color: '#52c41a' }} />
            ) : (
              <EyeInvisibleOutlined style={{ color: '#999' }} />
            )}
            <span style={{ fontWeight: isSelected ? 'bold' : 'normal' }}>
              {module.title || '未命名模块'}
            </span>
          </Space>
          <Space>
            <Tag color="blue">
              {MODULE_TYPE_NAMES[module.module_type] || module.module_type}
            </Tag>
            <Switch
              size="small"
              checked={isEnabled}
              onChange={(checked) => {
                if (onToggleEnable) {
                  onToggleEnable(module, checked);
                }
              }}
              onClick={(_, e) => e.stopPropagation()} // 阻止冒泡，避免触发选中
            />
          </Space>
        </Space>
      </Card>
    </div>
  );
};

export default DraggableModule;
