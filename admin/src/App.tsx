/**
 * Main App Component
 * 配置路由和全局布局
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/MainLayout';
import { NotificationProvider, TaskPollingProvider, ErrorBoundary } from './components/providers';
import './App.css';

// 懒加载页面组件
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LayoutEditor = lazy(() => import('./pages/LayoutEditor'));
const AdManagement = lazy(() => import('./pages/AdManagement'));
const TopicManagement = lazy(() => import('./pages/TopicManagement'));
const SourceManagement = lazy(() => import('./pages/SourceManagement'));
const VersionManagement = lazy(() => import('./pages/VersionManagement'));
const CacheManagement = lazy(() => import('./pages/CacheManagement'));
const FeedbackInbox = lazy(() => import('./pages/FeedbackInbox'));
const AppWallManagement = lazy(() => import('./pages/AppWallManagement'));
const SystemSettings = lazy(() => import('./pages/SystemSettings'));
const CollectManagement = lazy(() => import('./pages/CollectManagement'));
const CollectManagementV2 = lazy(() => import('./pages/CollectManagementV2'));
const CategoryManagement = lazy(() => import('./pages/CategoryManagement'));
const VideoManagement = lazy(() => import('./pages/VideoManagement'));
const ActorManagement = lazy(() => import('./pages/ActorManagement'));
const ArticleManagement = lazy(() => import('./pages/ArticleManagement'));
const PerformanceMonitor = lazy(() => import('./pages/PerformanceMonitor'));
const ReportsManagement = lazy(() => import('./pages/ReportsManagement'));
const StorageSettings = lazy(() => import('./pages/StorageSettings'));
const SchedulerManagement = lazy(() => import('./pages/SchedulerManagement'));
const DomainManagement = lazy(() => import('./pages/DomainManagement'));
const AnnouncementManagement = lazy(() => import('./pages/AnnouncementManagement'));
const SecuritySettings = lazy(() => import('./pages/SecuritySettings'));
const ImageStorageSettings = lazy(() => import('./pages/ImageStorageSettings'));

// 页面加载中的占位组件
const PageLoading = () => (
  <Spin size="large" tip="加载中..." fullscreen />
);

// 受保护的页面包装器
const ProtectedPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute>
    <MainLayout>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </MainLayout>
  </ProtectedRoute>
);

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <AntApp>
        <NotificationProvider>
          <TaskPollingProvider>
            <ErrorBoundary>
              <BrowserRouter>
                <Suspense fallback={<PageLoading />}>
                  <Routes>
                    {/* 登录页 */}
                    <Route path="/login" element={<Login />} />

                    {/* 受保护的路由 */}
                    <Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
                    <Route path="/layout-editor" element={<ProtectedPage><LayoutEditor /></ProtectedPage>} />
                    <Route path="/ad-management" element={<ProtectedPage><AdManagement /></ProtectedPage>} />
                    <Route path="/topic-management" element={<ProtectedPage><TopicManagement /></ProtectedPage>} />
                    <Route path="/source-management" element={<ProtectedPage><SourceManagement /></ProtectedPage>} />
                    <Route path="/version-management" element={<ProtectedPage><VersionManagement /></ProtectedPage>} />
                    <Route path="/cache-management" element={<ProtectedPage><CacheManagement /></ProtectedPage>} />
                    <Route path="/feedback-inbox" element={<ProtectedPage><FeedbackInbox /></ProtectedPage>} />
                    <Route path="/app-wall-management" element={<ProtectedPage><AppWallManagement /></ProtectedPage>} />
                    <Route path="/system-settings" element={<ProtectedPage><SystemSettings /></ProtectedPage>} />
                    <Route path="/collect-management" element={<ProtectedPage><CollectManagementV2 /></ProtectedPage>} />
                    <Route path="/collect-management-old" element={<ProtectedPage><CollectManagement /></ProtectedPage>} />
                    <Route path="/video-management" element={<ProtectedPage><VideoManagement /></ProtectedPage>} />
                    <Route path="/category-management" element={<ProtectedPage><CategoryManagement /></ProtectedPage>} />
                    <Route path="/actor-management" element={<ProtectedPage><ActorManagement /></ProtectedPage>} />
                    <Route path="/article-management" element={<ProtectedPage><ArticleManagement /></ProtectedPage>} />
                    <Route path="/performance-monitor" element={<ProtectedPage><PerformanceMonitor /></ProtectedPage>} />
                    <Route path="/reports" element={<ProtectedPage><ReportsManagement /></ProtectedPage>} />
                    <Route path="/storage-settings" element={<ProtectedPage><StorageSettings /></ProtectedPage>} />
                    <Route path="/scheduler-management" element={<ProtectedPage><SchedulerManagement /></ProtectedPage>} />
                    <Route path="/domain-management" element={<ProtectedPage><DomainManagement /></ProtectedPage>} />
                    <Route path="/announcement-management" element={<ProtectedPage><AnnouncementManagement /></ProtectedPage>} />
                    <Route path="/security-settings" element={<ProtectedPage><SecuritySettings /></ProtectedPage>} />
                    <Route path="/image-storage-settings" element={<ProtectedPage><ImageStorageSettings /></ProtectedPage>} />

                    {/* 默认重定向到仪表板 */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />

                    {/* 404 */}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </ErrorBoundary>
          </TaskPollingProvider>
        </NotificationProvider>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
