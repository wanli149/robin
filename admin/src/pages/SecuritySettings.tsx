/**
 * API 安全配置页面
 * 可视化配置 API 签名验证、APP 白名单等安全功能
 */

import { useState, useEffect } from 'react';
import {
  Card, Form, Input, Switch, Button, Space, Tag,
  InputNumber, Typography, Row, Col, Statistic, Alert,
  Tooltip, Popconfirm, List,
} from 'antd';
import { useNotification } from '../components/providers';
import {
  SafetyCertificateOutlined, KeyOutlined, ReloadOutlined,
  PlusOutlined, DeleteOutlined, CopyOutlined, CheckCircleOutlined,
  CloseCircleOutlined, QuestionCircleOutlined,
} from '@ant-design/icons';
import {
  getSecurityConfig, updateSecurityConfig, toggleSecurityEnabled,
  generateSecurityKey, getSecurityStats, type SecurityConfig,
} from '../services/adminApi';

const { Text, Paragraph } = Typography;

const SecuritySettings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [stats, setStats] = useState<{ blocked: number; valid: number } | null>(null);
  const [newPackage, setNewPackage] = useState('');
  const [newProtectedPath, setNewProtectedPath] = useState('');
  const [newWhitelistPath, setNewWhitelistPath] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [form] = Form.useForm();
  const { success, error, warning } = useNotification();

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const result = await getSecurityConfig();
      setConfig(result);
      // 延迟设置表单值，确保 Form 已挂载
      setTimeout(() => {
        form.setFieldsValue({
          secretKey: result.secretKey,
          timestampTolerance: result.timestampTolerance,
          nonceTtl: result.nonceTtl,
        });
      }, 0);
    } catch (err: any) {
      error(err.message || '获取配置失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const result = await getSecurityStats();
      setStats(result.today);
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchStats();
  }, []);

  const handleToggle = async (enabled: boolean) => {
    try {
      await toggleSecurityEnabled(enabled);
      success(enabled ? 'API 安全已启用' : 'API 安全已关闭');
      fetchConfig();
    } catch (err: any) {
      error(err.message || '切换失败');
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const values = await form.validateFields();
      await updateSecurityConfig({
        ...config,
        secretKey: values.secretKey !== '******' ? values.secretKey : undefined,
        timestampTolerance: values.timestampTolerance,
        nonceTtl: values.nonceTtl,
      });
      success('配置已保存');
      setGeneratedKey('');
      fetchConfig();
    } catch (err: any) {
      if (err.errorFields) return;
      error(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateKey = async () => {
    try {
      const result = await generateSecurityKey();
      setGeneratedKey(result.key);
      form.setFieldValue('secretKey', result.key);
      success('密钥已生成，请保存配置');
    } catch (err: any) {
      error(err.message || '生成失败');
    }
  };

  const handleCopyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      success('密钥已复制到剪贴板');
    }
  };

  const handleAddPackage = () => {
    if (!newPackage || !config) return;
    if (config.allowedPackages.includes(newPackage)) {
      warning('包名已存在');
      return;
    }
    setConfig({
      ...config,
      allowedPackages: [...config.allowedPackages, newPackage],
    });
    setNewPackage('');
  };

  const handleRemovePackage = (pkg: string) => {
    if (!config) return;
    setConfig({
      ...config,
      allowedPackages: config.allowedPackages.filter((p) => p !== pkg),
    });
  };

  const handleAddProtectedPath = () => {
    if (!newProtectedPath || !config) return;
    if (config.protectedPaths.includes(newProtectedPath)) {
      warning('路径已存在');
      return;
    }
    setConfig({
      ...config,
      protectedPaths: [...config.protectedPaths, newProtectedPath],
    });
    setNewProtectedPath('');
  };

  const handleRemoveProtectedPath = (path: string) => {
    if (!config) return;
    setConfig({
      ...config,
      protectedPaths: config.protectedPaths.filter((p) => p !== path),
    });
  };

  const handleAddWhitelistPath = () => {
    if (!newWhitelistPath || !config) return;
    if (config.whitelistPaths.includes(newWhitelistPath)) {
      warning('路径已存在');
      return;
    }
    setConfig({
      ...config,
      whitelistPaths: [...config.whitelistPaths, newWhitelistPath],
    });
    setNewWhitelistPath('');
  };

  const handleRemoveWhitelistPath = (path: string) => {
    if (!config) return;
    setConfig({
      ...config,
      whitelistPaths: config.whitelistPaths.filter((p) => p !== path),
    });
  };

  const handleSavePathsAndPackages = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await updateSecurityConfig({
        allowedPackages: config.allowedPackages,
        protectedPaths: config.protectedPaths,
        whitelistPaths: config.whitelistPaths,
      });
      success('配置已保存');
    } catch (err: any) {
      error(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return <Card loading style={{ margin: 24 }} />;
  }

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]}>
        {/* 状态卡片 */}
        <Col span={24}>
          <Card>
            <Row gutter={16} align="middle">
              <Col flex="auto">
                <Space size="large">
                  <SafetyCertificateOutlined style={{ fontSize: 32, color: config.enabled ? '#52c41a' : '#999' }} />
                  <div>
                    <Text strong style={{ fontSize: 18 }}>API 安全防护</Text>
                    <br />
                    <Text type="secondary">
                      {config.enabled ? '已启用签名验证，保护 API 免受滥用' : '未启用，API 可被任意调用'}
                    </Text>
                  </div>
                </Space>
              </Col>
              <Col>
                <Space size="large">
                  {stats && (
                    <>
                      <Statistic
                        title="今日拦截"
                        value={stats.blocked}
                        valueStyle={{ color: stats.blocked > 0 ? '#cf1322' : '#999' }}
                        prefix={<CloseCircleOutlined />}
                      />
                      <Statistic
                        title="今日通过"
                        value={stats.valid}
                        valueStyle={{ color: '#3f8600' }}
                        prefix={<CheckCircleOutlined />}
                      />
                    </>
                  )}
                  <Switch
                    checked={config.enabled}
                    onChange={handleToggle}
                    checkedChildren="已启用"
                    unCheckedChildren="已关闭"
                    disabled={!config.hasSecretKey}
                  />
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* 密钥配置 */}
        <Col span={12}>
          <Card
            title={
              <Space>
                <KeyOutlined />
                密钥配置
              </Space>
            }
            extra={
              <Button type="primary" onClick={handleSave} loading={saving}>
                保存配置
              </Button>
            }
          >
            {!config.hasSecretKey && (
              <Alert
                message="未设置 API 密钥"
                description="请先生成或设置 API 密钥才能启用安全防护"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Form form={form} layout="vertical">
              <Form.Item
                name="secretKey"
                label={
                  <Space>
                    API 密钥
                    <Tooltip title="用于生成和验证请求签名的密钥，请妥善保管">
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
              >
                <Input.Password
                  placeholder="点击生成或手动输入"
                  addonAfter={
                    <Space>
                      <Tooltip title="生成新密钥">
                        <ReloadOutlined onClick={handleGenerateKey} style={{ cursor: 'pointer' }} />
                      </Tooltip>
                      {generatedKey && (
                        <Tooltip title="复制密钥">
                          <CopyOutlined onClick={handleCopyKey} style={{ cursor: 'pointer' }} />
                        </Tooltip>
                      )}
                    </Space>
                  }
                />
              </Form.Item>

              {generatedKey && (
                <Alert
                  message="新密钥已生成"
                  description={
                    <div>
                      <Paragraph copyable={{ text: generatedKey }}>
                        <code style={{ wordBreak: 'break-all' }}>{generatedKey}</code>
                      </Paragraph>
                      <Text type="warning">请复制并保存此密钥，保存配置后将无法再次查看</Text>
                    </div>
                  }
                  type="success"
                  style={{ marginBottom: 16 }}
                />
              )}

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="timestampTolerance"
                    label={
                      <Space>
                        时间戳容差（秒）
                        <Tooltip title="请求时间戳与服务器时间的最大允许差值">
                          <QuestionCircleOutlined />
                        </Tooltip>
                      </Space>
                    }
                  >
                    <InputNumber min={60} max={600} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="nonceTtl"
                    label={
                      <Space>
                        Nonce 有效期（秒）
                        <Tooltip title="防重放攻击的 Nonce 缓存时间">
                          <QuestionCircleOutlined />
                        </Tooltip>
                      </Space>
                    }
                  >
                    <InputNumber min={300} max={3600} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>

        {/* APP 白名单 */}
        <Col span={12}>
          <Card
            title={
              <Space>
                <SafetyCertificateOutlined />
                APP 包名白名单
                <Tooltip title="只允许指定包名的 APP 访问 API，留空则不限制">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            }
            extra={
              <Button onClick={handleSavePathsAndPackages} loading={saving}>
                保存
              </Button>
            }
          >
            <Space style={{ marginBottom: 16 }}>
              <Input
                placeholder="com.example.app"
                value={newPackage}
                onChange={(e) => setNewPackage(e.target.value)}
                onPressEnter={handleAddPackage}
                style={{ width: 250 }}
              />
              <Button icon={<PlusOutlined />} onClick={handleAddPackage}>
                添加
              </Button>
            </Space>

            <div>
              {config.allowedPackages.length === 0 ? (
                <Text type="secondary">未设置白名单，允许所有 APP 访问</Text>
              ) : (
                config.allowedPackages.map((pkg) => (
                  <Tag
                    key={pkg}
                    closable
                    onClose={() => handleRemovePackage(pkg)}
                    style={{ marginBottom: 8 }}
                  >
                    {pkg}
                  </Tag>
                ))
              )}
            </div>
          </Card>
        </Col>

        {/* 受保护路径 */}
        <Col span={12}>
          <Card
            title={
              <Space>
                受保护的 API 路径
                <Tooltip title="这些路径前缀的请求需要签名验证">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            }
            extra={
              <Button onClick={handleSavePathsAndPackages} loading={saving}>
                保存
              </Button>
            }
            styles={{ body: { maxHeight: 300, overflow: 'auto' } }}
          >
            <Space style={{ marginBottom: 16 }}>
              <Input
                placeholder="/api/xxx"
                value={newProtectedPath}
                onChange={(e) => setNewProtectedPath(e.target.value)}
                onPressEnter={handleAddProtectedPath}
                style={{ width: 200 }}
              />
              <Button icon={<PlusOutlined />} onClick={handleAddProtectedPath}>
                添加
              </Button>
            </Space>

            <List
              size="small"
              dataSource={config.protectedPaths}
              renderItem={(path) => (
                <List.Item
                  actions={[
                    <Popconfirm
                      title="确定移除？"
                      onConfirm={() => handleRemoveProtectedPath(path)}
                    >
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>,
                  ]}
                >
                  <code>{path}</code>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* 白名单路径 */}
        <Col span={12}>
          <Card
            title={
              <Space>
                免验证路径（白名单）
                <Tooltip title="这些路径前缀的请求不需要签名验证">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            }
            extra={
              <Button onClick={handleSavePathsAndPackages} loading={saving}>
                保存
              </Button>
            }
            styles={{ body: { maxHeight: 300, overflow: 'auto' } }}
          >
            <Space style={{ marginBottom: 16 }}>
              <Input
                placeholder="/api/xxx"
                value={newWhitelistPath}
                onChange={(e) => setNewWhitelistPath(e.target.value)}
                onPressEnter={handleAddWhitelistPath}
                style={{ width: 200 }}
              />
              <Button icon={<PlusOutlined />} onClick={handleAddWhitelistPath}>
                添加
              </Button>
            </Space>

            <List
              size="small"
              dataSource={config.whitelistPaths}
              renderItem={(path) => (
                <List.Item
                  actions={[
                    <Popconfirm
                      title="确定移除？"
                      onConfirm={() => handleRemoveWhitelistPath(path)}
                    >
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>,
                  ]}
                >
                  <code>{path}</code>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* 使用说明 */}
        <Col span={24}>
          <Card title="APP 端集成说明">
            <Paragraph>
              启用 API 安全后，APP 需要在每个请求中添加以下请求头：
            </Paragraph>
            <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
{`X-Timestamp: 当前时间戳（秒）
X-Nonce: 随机字符串（32位十六进制）
X-Sign: HMAC-SHA256 签名
X-App-Package: APP 包名
X-App-Version: APP 版本号`}
            </pre>
            <Paragraph>
              签名算法：
            </Paragraph>
            <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
{`signData = METHOD + "&" + PATH + "&" + TIMESTAMP + "&" + NONCE + "&" + PACKAGE + "&" + VERSION
sign = HMAC-SHA256(signData, secretKey)`}
            </pre>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SecuritySettings;
