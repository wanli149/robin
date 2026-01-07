/**
 * Main App Component
 * 配置路由和全局布局
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LayoutEditor from './pages/LayoutEditor';
import AdManagement from './pages/AdManagement';
import TopicManagement from './pages/TopicManagement';
import SourceManagement from './pages/SourceManagement';
import VersionManagement from './pages/VersionManagement';
import CacheManagement from './pages/CacheManagement';
import FeedbackInbox from './pages/FeedbackInbox';
import AppWallManagement from './pages/AppWallManagement';
import SystemSettings from './pages/SystemSettings';
import CollectManagement from './pages/CollectManagement';
import CollectManagementV2 from './pages/CollectManagementV2';
import CategoryManagement from './pages/CategoryManagement';
import VideoManagement from './pages/VideoManagement';
import ActorManagement from './pages/ActorManagement';
import ArticleManagement from './pages/ArticleManagement';
import PerformanceMonitor from './pages/PerformanceMonitor';
import ReportsManagement from './pages/ReportsManagement';
import StorageSettings from './pages/StorageSettings';
import SchedulerManagement from './pages/SchedulerManagement';
import DomainManagement from './pages/DomainManagement';
import AnnouncementManagement from './pages/AnnouncementManagement';
import SecuritySettings from './pages/SecuritySettings';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/MainLayout';
import './App.css';

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <AntApp>
        <BrowserRouter>
          <Routes>
          {/* 登录页 */}
          <Route path="/login" element={<Login />} />

          {/* 受保护的路由 - 使用MainLayout包裹 */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Dashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/layout-editor"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <LayoutEditor />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ad-management"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <AdManagement />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/topic-management"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <TopicManagement />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/source-management"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SourceManagement />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/version-management"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <VersionManagement />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cache-management"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <CacheManagement />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/feedback-inbox"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <FeedbackInbox />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/app-wall-management"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <AppWallManagement />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/system-settings"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SystemSettings />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/collect-management"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <CollectManagementV2 />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/collect-management-old"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <CollectManagement />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/video-management"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <VideoManagement />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/category-management"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <CategoryManagement />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/actor-management"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <ActorManagement />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/article-management"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <ArticleManagement />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/performance-monitor"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <PerformanceMonitor />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <ReportsManagement />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/storage-settings"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <StorageSettings />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/scheduler-management"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SchedulerManagement />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/domain-management"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <DomainManagement />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/announcement-management"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <AnnouncementManagement />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/security-settings"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SecuritySettings />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* 默认重定向到仪表板 */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
