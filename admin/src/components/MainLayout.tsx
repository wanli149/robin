/**
 * Main Layout Component
 * 主布局组件，包含侧边栏和顶部导航
 */

import { useState } from 'react';
import { Layout, Menu, Button, Dropdown, Avatar, Space, Typography, Divider } from 'antd';
import {
  DashboardOutlined,
  LayoutOutlined,
  NotificationOutlined,
  AppstoreOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { logout } from '../services/auth';
import TaskIndicator from './TaskIndicator';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // 菜单项
  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表板',
    },
    {
      key: '/layout-editor',
      icon: <LayoutOutlined />,
      label: '布局编辑器',
    },
    {
      key: '/ad-management',
      icon: <NotificationOutlined />,
      label: '广告管理',
    },
    {
      key: '/topic-management',
      icon: <AppstoreOutlined />,
      label: '专题管理',
    },
    {
      key: '/content-management',
      icon: <AppstoreOutlined />,
      label: '内容管理',
      children: [
        { key: '/collect-management', label: '采集管理' },
        { key: '/category-management', label: '分类管理' },
        { key: '/video-management', label: '视频管理' },
        { key: '/actor-management', label: '演员管理' },
        { key: '/article-management', label: '文章管理' },
        { key: '/performance-monitor', label: '性能监控' },
      ],
    },
    {
      key: '/system-config',
      icon: <SettingOutlined />,
      label: '系统配置',
      children: [
        { key: '/source-management', label: '资源站管理' },
        { key: '/version-management', label: '版本管理' },
        { key: '/cache-management', label: '缓存管理' },
        { key: '/feedback-inbox', label: '反馈信箱' },
        { key: '/reports', label: '上报管理' },
        { key: '/app-wall-management', label: '应用墙管理' },
        { key: '/system-settings', label: '系统设置' },
        { key: '/storage-settings', label: '存储配置' },
        { key: '/image-storage-settings', label: '图片云存储' },
        { key: '/scheduler-management', label: '定时任务' },
        { key: '/domain-management', label: '域名管理' },
        { key: '/announcement-management', label: '公告管理' },
        { key: '/security-settings', label: 'API 安全' },
      ],
    },
  ];

  // 用户下拉菜单
  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        logout();
      },
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: collapsed ? 16 : 20,
            fontWeight: 'bold',
          }}
        >
          {collapsed ? 'RC' : '拾光影视'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      {/* 主内容区 */}
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'all 0.2s' }}>
        {/* 顶部导航 */}
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,21,41,.08)',
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16 }}
          />

          <Space>
            <TaskIndicator />
            <Divider type="vertical" />
            <Text type="secondary">Robin Commander</Text>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Avatar
                icon={<UserOutlined />}
                style={{ cursor: 'pointer', backgroundColor: '#1890ff' }}
              />
            </Dropdown>
          </Space>
        </Header>

        {/* 内容区 */}
        <Content
          style={{
            margin: 0,
            minHeight: 280,
            background: '#f0f2f5',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
