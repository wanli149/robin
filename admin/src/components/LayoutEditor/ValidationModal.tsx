/**
 * 布局验证结果弹窗
 * 显示保存前的验证结果
 */

import React from 'react';
import { Modal, List, Tag, Space, Typography, Alert } from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { ValidationResult } from '../../services/adminApi';

const { Text } = Typography;

interface ValidationModalProps {
  visible: boolean;
  results: ValidationResult[];
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const ValidationModal: React.FC<ValidationModalProps> = ({
  visible,
  results,
  onConfirm,
  onCancel,
  loading,
}) => {
  // 统计结果
  const successCount = results.filter((r) => r.status === 'success').length;
  const warningCount = results.filter((r) => r.status === 'warning').length;
  const errorCount = results.filter((r) => r.status === 'error').length;

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />;
      case 'warning':
        return <WarningOutlined style={{ color: '#faad14', fontSize: 18 }} />;
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />;
      default:
        return <InfoCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />;
    }
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'success':
        return <Tag color="success">验证通过</Tag>;
      case 'warning':
        return <Tag color="warning">警告</Tag>;
      case 'error':
        return <Tag color="error">错误</Tag>;
      default:
        return <Tag>未知</Tag>;
    }
  };

  // 是否有错误
  const hasErrors = errorCount > 0;

  return (
    <Modal
      title="布局验证结果"
      open={visible}
      onOk={onConfirm}
      onCancel={onCancel}
      confirmLoading={loading}
      okText={hasErrors ? '仍然保存' : '确认保存'}
      okButtonProps={{ danger: hasErrors }}
      cancelText="返回修改"
      width={700}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 统计信息 */}
        <Alert
          message={
            <Space>
              <Text>验证完成：</Text>
              <Text type="success">{successCount} 个通过</Text>
              {warningCount > 0 && <Text type="warning">{warningCount} 个警告</Text>}
              {errorCount > 0 && <Text type="danger">{errorCount} 个错误</Text>}
            </Space>
          }
          type={hasErrors ? 'error' : warningCount > 0 ? 'warning' : 'success'}
          showIcon
        />

        {/* 验证结果列表 */}
        <List
          size="small"
          dataSource={results}
          renderItem={(result) => (
            <List.Item>
              <List.Item.Meta
                avatar={getStatusIcon(result.status)}
                title={
                  <Space>
                    <Text strong>
                      {result.module_title || `模块 ${result.module_index + 1}`}
                    </Text>
                    {getStatusTag(result.status)}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {result.module_type}
                    </Text>
                  </Space>
                }
                description={
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Text>{result.message}</Text>
                    {result.data_count !== undefined && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        数据量：{result.data_count} 条
                      </Text>
                    )}
                    {result.details && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {JSON.stringify(result.details)}
                      </Text>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
        />

        {/* 错误提示 */}
        {hasErrors && (
          <Alert
            message="发现配置错误"
            description="建议返回修改配置，或者点击「仍然保存」强制保存（可能导致APP端显示异常）"
            type="error"
            showIcon
          />
        )}
      </Space>
    </Modal>
  );
};

export default ValidationModal;
