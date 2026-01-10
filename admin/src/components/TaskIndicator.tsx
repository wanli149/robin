/**
 * 任务状态指示器组件
 * 显示在顶部导航栏，点击打开任务面板
 */

import React from 'react';
import { Badge, Button, Tooltip } from 'antd';
import { SyncOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useTaskPolling } from './providers';

const TaskIndicator: React.FC = () => {
  const { runningCount, hasRunningTasks, openTaskPanel } = useTaskPolling();

  return (
    <Tooltip title={hasRunningTasks ? `${runningCount} 个任务运行中` : '任务管理'}>
      <Badge count={runningCount} size="small" offset={[-5, 5]}>
        <Button
          type="text"
          icon={hasRunningTasks ? <SyncOutlined spin /> : <UnorderedListOutlined />}
          onClick={openTaskPanel}
          style={{ 
            color: hasRunningTasks ? '#1890ff' : undefined,
          }}
        />
      </Badge>
    </Tooltip>
  );
};

export default TaskIndicator;
