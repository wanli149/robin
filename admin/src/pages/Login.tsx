/**
 * Login Page
 * 管理员登录页面
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography } from 'antd';
import { LockOutlined, KeyOutlined } from '@ant-design/icons';
import { useNotification } from '../components/providers';
import { getDashboard } from '../services/adminApi';

const { Title, Text } = Typography;

interface LoginFormValues {
  adminKey: string;
}

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { success, error } = useNotification();

  const onFinish = async (values: LoginFormValues) => {
    setLoading(true);
    
    try {
      // 先存储密钥
      localStorage.setItem('admin_key', values.adminKey);
      
      // 验证密钥是否有效（调用需要认证的 API）
      await getDashboard();
      
      success('登录成功');
      navigate('/dashboard');
    } catch (err: any) {
      // 验证失败，清除密钥
      localStorage.removeItem('admin_key');
      
      if (err.response?.status === 401 || err.response?.status === 403) {
        error('密钥无效，请检查后重试');
      } else {
        error(err.message || '登录失败，请检查网络连接');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{
          width: 400,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <LockOutlined style={{ fontSize: 48, color: '#667eea' }} />
          <Title level={2} style={{ marginTop: 16, marginBottom: 8 }}>
            拾光影视管理后台
          </Title>
          <Text type="secondary">Robin Commander</Text>
        </div>

        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="adminKey"
            rules={[
              { required: true, message: '请输入管理员密钥' },
              { min: 8, message: '密钥长度至少8位' },
            ]}
          >
            <Input.Password
              prefix={<KeyOutlined />}
              placeholder="请输入管理员密钥"
              autoComplete="off"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
              }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            请妥善保管管理员密钥，切勿泄露
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Login;
