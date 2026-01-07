/**
 * API 参数可视化编辑器
 * 根据模块类型显示不同的表单字段
 * 分类数据从数据库动态获取
 */

import React, { useEffect, useState } from 'react';
import { Select, InputNumber, Space, Typography, Spin, Button } from 'antd';
import GridIconsEditor from './GridIconsEditor';
import { getCategoriesWithSubs, type CategoryWithSubs } from '../../services/adminApi';

const { Option } = Select;
const { Text } = Typography;

interface ApiParamsEditorProps {
  moduleType: string;
  value?: any;
  onChange?: (value: any) => void;
}

const ApiParamsEditor: React.FC<ApiParamsEditorProps> = ({ moduleType, value, onChange }) => {
  const safeValue = value || {};
  const [categories, setCategories] = useState<CategoryWithSubs[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 加载分类数据
  useEffect(() => {
    const loadCategories = async () => {
      setLoading(true);
      try {
        const data = await getCategoriesWithSubs();
        setCategories(data.categories || []);
      } catch (error) {
        console.error('Failed to load categories:', error);
        // 使用默认分类作为降级
        setCategories(getDefaultCategories());
      } finally {
        setLoading(false);
      }
    };
    loadCategories();
  }, []);
  
  const handleChange = (field: string, fieldValue: any) => {
    const newValue = { ...safeValue, [field]: fieldValue };
    // 如果切换了视频类型，清空分类选择
    if (field === 't') {
      delete newValue.class;
    }
    onChange?.(newValue);
  };

  // 获取当前选中类型的子分类
  const getCurrentSubCategories = () => {
    if (!safeValue.t) return [];
    const category = categories.find(c => c.id === safeValue.t);
    return category?.subCategories || [];
  };

  // 根据模块类型渲染不同的表单
  const renderFields = () => {
    switch (moduleType) {
      case 'carousel':
        return (
          <Spin spinning={loading}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>视频类型 (t)</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.t}
                  onChange={(v) => handleChange('t', v)}
                  placeholder="选择类型"
                >
                  {categories.map(cat => (
                    <Option key={cat.id} value={cat.id}>
                      {cat.icon && `${cat.icon} `}{cat.name}
                    </Option>
                  ))}
                </Select>
              </div>

              <div>
                <Text strong>排序方式 (sort)</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.sort}
                  onChange={(v) => handleChange('sort', v)}
                  placeholder="选择排序"
                >
                  <Option value="time">最新</Option>
                  <Option value="hits">最热</Option>
                  <Option value="score">评分</Option>
                </Select>
              </div>

              <div>
                <Text strong>显示数量 (limit)</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.limit || 8}
                  onChange={(v) => handleChange('limit', v)}
                  min={3}
                  max={10}
                />
              </div>

              <div>
                <Text strong>轮播图高度 (height)</Text>
                <Space.Compact style={{ width: '100%', marginTop: 8 }}>
                  <InputNumber
                    style={{ width: '100%' }}
                    value={safeValue.height || 220}
                    onChange={(v) => handleChange('height', v)}
                    min={150}
                    max={300}
                  />
                  <Button disabled>px</Button>
                </Space.Compact>
              </div>

              <div>
                <Text strong>自动播放间隔 (auto_play_seconds)</Text>
                <Space.Compact style={{ width: '100%', marginTop: 8 }}>
                  <InputNumber
                    style={{ width: '100%' }}
                    value={safeValue.auto_play_seconds || 5}
                    onChange={(v) => handleChange('auto_play_seconds', v)}
                    min={2}
                    max={15}
                  />
                  <Button disabled>秒</Button>
                </Space.Compact>
              </div>
            </Space>
          </Spin>
        );

      case 'grid_3x2':
      case 'grid_3x3':
      case 'grid_3x2_ad':
      case 'grid_3x3_ad':
      case 'waterfall':
      case 'waterfall_2col':
      case 'waterfall_3col':
        return (
          <Spin spinning={loading}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>视频类型 (t)</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.t}
                  onChange={(v) => handleChange('t', v)}
                  placeholder="选择类型"
                >
                  {categories.map(cat => (
                    <Option key={cat.id} value={cat.id}>
                      {cat.icon && `${cat.icon} `}{cat.name}
                    </Option>
                  ))}
                </Select>
              </div>

              <div>
                <Text strong>视频分类 (class)</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {!safeValue.t && '请先选择视频类型'}
                  {safeValue.t && getCurrentSubCategories().length === 0 && '该类型暂无子分类'}
                  {safeValue.t && getCurrentSubCategories().length > 0 && '不选则显示该类型所有视频'}
                </Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.class}
                  onChange={(v) => handleChange('class', v)}
                  placeholder="选择分类（可选）"
                  allowClear
                  disabled={!safeValue.t || getCurrentSubCategories().length === 0}
                >
                  {getCurrentSubCategories().map(sub => (
                    <Option key={sub.id} value={sub.name}>
                      {sub.name}
                    </Option>
                  ))}
                </Select>
              </div>

              <div>
                <Text strong>地区 (area)</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.area}
                  onChange={(v) => handleChange('area', v)}
                  placeholder="选择地区（可选）"
                  allowClear
                >
                  <Option value="大陆">大陆</Option>
                  <Option value="香港">香港</Option>
                  <Option value="台湾">台湾</Option>
                  <Option value="美国">美国</Option>
                  <Option value="韩国">韩国</Option>
                  <Option value="日本">日本</Option>
                  <Option value="泰国">泰国</Option>
                  <Option value="英国">英国</Option>
                  <Option value="法国">法国</Option>
                  <Option value="德国">德国</Option>
                  <Option value="印度">印度</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </div>

              <div>
                <Text strong>年份 (year)</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.year}
                  onChange={(v) => handleChange('year', v)}
                  placeholder="例如：2024"
                  min={1900}
                  max={2030}
                />
              </div>

              <div>
                <Text strong>排序方式 (sort)</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.sort}
                  onChange={(v) => handleChange('sort', v)}
                  placeholder="选择排序"
                >
                  <Option value="time">最新</Option>
                  <Option value="hits">最热</Option>
                  <Option value="score">评分</Option>
                </Select>
              </div>

              <div>
                <Text strong>每页数量 (limit)</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.limit || 6}
                  onChange={(v) => handleChange('limit', v)}
                  min={1}
                  max={50}
                />
              </div>

              <div>
                <Text strong>页码 (pg)</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.pg || 1}
                  onChange={(v) => handleChange('pg', v)}
                  min={1}
                />
              </div>
            </Space>
          </Spin>
        );

      case 'grid_icons':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>金刚区配置</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                可视化配置金刚区图标，无需手写JSON
              </Text>
            </div>
            <GridIconsEditor
              value={safeValue}
              onChange={(newValue) => onChange?.(newValue)}
            />
          </Space>
        );

      case 'timeline':
      case 'week_timeline':
        return (
          <Spin spinning={loading}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>数据源类型</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.source || 'api'}
                  onChange={(v) => handleChange('source', v)}
                >
                  <Option value="api">API 数据</Option>
                  <Option value="manual">手动配置</Option>
                </Select>
              </div>

              {(safeValue.source || 'api') === 'api' && (
                <>
                  <div>
                    <Text strong>视频类型 (t)</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      时间轴适合有更新概念的内容类型
                    </Text>
                    <Select
                      style={{ width: '100%', marginTop: 8 }}
                      value={safeValue.t}
                      onChange={(v) => handleChange('t', v)}
                    >
                      {categories
                        .filter(c => [2, 4, 5].includes(c.id)) // 电视剧、动漫、短剧
                        .map(cat => (
                          <Option key={cat.id} value={cat.id}>
                            {cat.icon && `${cat.icon} `}{cat.name}
                          </Option>
                        ))}
                    </Select>
                  </div>

                  <div>
                    <Text strong>视频分类 (class)</Text>
                    <Select
                      style={{ width: '100%', marginTop: 8 }}
                      value={safeValue.class}
                      onChange={(v) => handleChange('class', v)}
                      placeholder="选择分类（可选）"
                      allowClear
                      disabled={!safeValue.t}
                    >
                      {getCurrentSubCategories().map(sub => (
                        <Option key={sub.id} value={sub.name}>
                          {sub.name}
                        </Option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Text strong>每页数量 (limit)</Text>
                    <InputNumber
                      style={{ width: '100%', marginTop: 8 }}
                      value={safeValue.limit || 10}
                      onChange={(v) => handleChange('limit', v)}
                      min={1}
                      max={50}
                    />
                  </div>
                </>
              )}
            </Space>
          </Spin>
        );

      case 'continue_watching':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text type="secondary">继续观看组件自动从用户历史记录获取数据</Text>
              <br />
              <Text type="secondary">不需要配置 API 参数</Text>
            </div>
          </Space>
        );

      case 'login_prompt':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>提示文案</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                引导用户登录的说明文字
              </Text>
              <input
                type="text"
                style={{ 
                  width: '100%', 
                  marginTop: 8, 
                  padding: '8px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: 6,
                  fontSize: 14
                }}
                value={safeValue.message || ''}
                onChange={(e) => handleChange('message', e.target.value)}
                placeholder="登录后可查看个性化推荐、观看历史等更多内容"
              />
            </div>
            <div>
              <Text strong>登录按钮文字</Text>
              <input
                type="text"
                style={{ 
                  width: '100%', 
                  marginTop: 8, 
                  padding: '8px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: 6,
                  fontSize: 14
                }}
                value={safeValue.login_text || ''}
                onChange={(e) => handleChange('login_text', e.target.value)}
                placeholder="立即登录"
              />
            </div>
            <div>
              <Text strong>注册按钮文字</Text>
              <input
                type="text"
                style={{ 
                  width: '100%', 
                  marginTop: 8, 
                  padding: '8px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: 6,
                  fontSize: 14
                }}
                value={safeValue.register_text || ''}
                onChange={(e) => handleChange('register_text', e.target.value)}
                placeholder="注册账号"
              />
            </div>
          </Space>
        );

      case 'horizontal_scroll':
      case 'vertical_list':
        return (
          <Spin spinning={loading}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>视频类型 (t)</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.t}
                  onChange={(v) => handleChange('t', v)}
                  placeholder="选择类型"
                >
                  {categories.map(cat => (
                    <Option key={cat.id} value={cat.id}>
                      {cat.icon && `${cat.icon} `}{cat.name}
                    </Option>
                  ))}
                </Select>
              </div>

              <div>
                <Text strong>视频分类 (class)</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.class}
                  onChange={(v) => handleChange('class', v)}
                  placeholder="选择分类（可选）"
                  allowClear
                  disabled={!safeValue.t || getCurrentSubCategories().length === 0}
                >
                  {getCurrentSubCategories().map(sub => (
                    <Option key={sub.id} value={sub.name}>
                      {sub.name}
                    </Option>
                  ))}
                </Select>
              </div>

              <div>
                <Text strong>地区 (area)</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.area}
                  onChange={(v) => handleChange('area', v)}
                  placeholder="选择地区（可选）"
                  allowClear
                >
                  <Option value="大陆">大陆</Option>
                  <Option value="香港">香港</Option>
                  <Option value="台湾">台湾</Option>
                  <Option value="美国">美国</Option>
                  <Option value="韩国">韩国</Option>
                  <Option value="日本">日本</Option>
                  <Option value="泰国">泰国</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </div>

              <div>
                <Text strong>排序方式 (sort)</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.sort}
                  onChange={(v) => handleChange('sort', v)}
                  placeholder="选择排序"
                >
                  <Option value="time">最新</Option>
                  <Option value="hits">最热</Option>
                  <Option value="score">评分</Option>
                </Select>
              </div>

              <div>
                <Text strong>每页数量 (limit)</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.limit || (moduleType === 'horizontal_scroll' ? 10 : 5)}
                  onChange={(v) => handleChange('limit', v)}
                  min={1}
                  max={50}
                />
              </div>

              {moduleType === 'horizontal_scroll' && (
                <>
                  <div>
                    <Text strong>卡片宽度 (item_width)</Text>
                    <Space.Compact style={{ width: '100%', marginTop: 8 }}>
                      <InputNumber
                        style={{ width: '100%' }}
                        value={safeValue.item_width || 120}
                        onChange={(v) => handleChange('item_width', v)}
                        min={80}
                        max={200}
                      />
                      <Button disabled>px</Button>
                    </Space.Compact>
                  </div>
                  <div>
                    <Text strong>卡片高度 (item_height)</Text>
                    <Space.Compact style={{ width: '100%', marginTop: 8 }}>
                      <InputNumber
                        style={{ width: '100%' }}
                        value={safeValue.item_height || 180}
                        onChange={(v) => handleChange('item_height', v)}
                        min={100}
                        max={300}
                      />
                      <Button disabled>px</Button>
                    </Space.Compact>
                  </div>
                </>
              )}
            </Space>
          </Spin>
        );

      case 'banner':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>横幅图片URL</Text>
              <input
                type="text"
                style={{ width: '100%', marginTop: 8, padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6 }}
                value={safeValue.image_url || ''}
                onChange={(e) => handleChange('image_url', e.target.value)}
                placeholder="https://example.com/banner.jpg"
              />
            </div>
            <div>
              <Text strong>点击跳转链接</Text>
              <input
                type="text"
                style={{ width: '100%', marginTop: 8, padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6 }}
                value={safeValue.action_url || ''}
                onChange={(e) => handleChange('action_url', e.target.value)}
                placeholder="https://example.com 或 video://123"
              />
            </div>
            <div>
              <Text strong>跳转类型</Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                value={safeValue.action_type || 'browser'}
                onChange={(v) => handleChange('action_type', v)}
              >
                <Option value="browser">外部浏览器</Option>
                <Option value="webview">内置WebView</Option>
                <Option value="deeplink">应用内跳转</Option>
              </Select>
            </div>
            <div>
              <Text strong>横幅高度</Text>
              <Space.Compact style={{ width: '100%', marginTop: 8 }}>
                <InputNumber
                  style={{ width: '100%' }}
                  value={safeValue.height || 100}
                  onChange={(v) => handleChange('height', v)}
                  min={60}
                  max={200}
                />
                <Button disabled>px</Button>
              </Space.Compact>
            </div>
          </Space>
        );

      case 'notice':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>公告标题</Text>
              <input
                type="text"
                style={{ width: '100%', marginTop: 8, padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6 }}
                value={safeValue.title || ''}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="系统公告"
              />
            </div>
            <div>
              <Text strong>公告内容</Text>
              <textarea
                style={{ width: '100%', marginTop: 8, padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, minHeight: 60 }}
                value={safeValue.content || ''}
                onChange={(e) => handleChange('content', e.target.value)}
                placeholder="公告内容..."
              />
            </div>
            <div>
              <Text strong>公告类型</Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                value={safeValue.type || 'info'}
                onChange={(v) => handleChange('type', v)}
              >
                <Option value="info">📘 信息</Option>
                <Option value="warning">⚠️ 警告</Option>
                <Option value="success">✅ 成功</Option>
                <Option value="error">❌ 错误</Option>
              </Select>
            </div>
            <div>
              <Text strong>点击跳转链接（可选）</Text>
              <input
                type="text"
                style={{ width: '100%', marginTop: 8, padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6 }}
                value={safeValue.action_url || ''}
                onChange={(e) => handleChange('action_url', e.target.value)}
                placeholder="点击公告跳转的链接"
              />
            </div>
          </Space>
        );

      case 'ranking':
        return (
          <Spin spinning={loading}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>排行榜类型</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.rank_type || 'hot'}
                  onChange={(v) => handleChange('rank_type', v)}
                >
                  <Option value="hot">🔥 热播榜</Option>
                  <Option value="rising">📈 飙升榜</Option>
                  <Option value="rating">⭐ 好评榜</Option>
                </Select>
              </div>
              <div>
                <Text strong>视频类型</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.t}
                  onChange={(v) => handleChange('t', v)}
                  placeholder="选择类型"
                  allowClear
                >
                  {categories.map(cat => (
                    <Option key={cat.id} value={cat.id}>{cat.name}</Option>
                  ))}
                </Select>
              </div>
              <div>
                <Text strong>显示数量</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.limit || 10}
                  onChange={(v) => handleChange('limit', v)}
                  min={5}
                  max={20}
                />
              </div>
            </Space>
          </Spin>
        );

      case 'category_tabs':
        return (
          <Spin spinning={loading}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>主分类</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.t}
                  onChange={(v) => handleChange('t', v)}
                  placeholder="选择主分类"
                >
                  {categories.map(cat => (
                    <Option key={cat.id} value={cat.id}>{cat.name}</Option>
                  ))}
                </Select>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  选择主分类后，将自动显示该分类下的所有子分类作为标签
                </Text>
              </div>
              <div>
                <Text strong>每个标签显示数量</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.limit || 10}
                  onChange={(v) => handleChange('limit', v)}
                  min={4}
                  max={20}
                />
              </div>
            </Space>
          </Spin>
        );

      case 'actor_list':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text type="secondary">演员列表从数据库自动获取热门演员</Text>
            </div>
            <div>
              <Text strong>显示数量</Text>
              <InputNumber
                style={{ width: '100%', marginTop: 8 }}
                value={safeValue.limit || 10}
                onChange={(v) => handleChange('limit', v)}
                min={5}
                max={20}
              />
            </div>
          </Space>
        );

      case 'topic_list':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>显示样式</Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                value={safeValue.display_style || 'card'}
                onChange={(v) => handleChange('display_style', v)}
              >
                <Option value="card">🃏 卡片样式（横向滚动）</Option>
                <Option value="banner">🖼️ 横幅样式（纵向列表）</Option>
                <Option value="grid">📱 网格样式（2x2）</Option>
              </Select>
            </div>
            <div>
              <Text strong>显示数量</Text>
              <InputNumber
                style={{ width: '100%', marginTop: 8 }}
                value={safeValue.limit || 6}
                onChange={(v) => handleChange('limit', v)}
                min={2}
                max={10}
              />
            </div>
          </Space>
        );

      case 'article_list':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text type="secondary">文章列表从数据库自动获取最新文章</Text>
            </div>
            <div>
              <Text strong>显示样式</Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                value={safeValue.display_style || 'card'}
                onChange={(v) => handleChange('display_style', v)}
              >
                <Option value="card">🃏 卡片样式（横向滚动）</Option>
                <Option value="list">📋 列表样式（纵向）</Option>
              </Select>
            </div>
            <div>
              <Text strong>显示数量</Text>
              <InputNumber
                style={{ width: '100%', marginTop: 8 }}
                value={safeValue.limit || 10}
                onChange={(v) => handleChange('limit', v)}
                min={3}
                max={20}
              />
            </div>
          </Space>
        );

      default:
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text type="warning">未知模块类型，请手动编辑 JSON</Text>
            </div>
          </Space>
        );
    }
  };

  return (
    <div style={{ padding: '16px 0' }}>
      {renderFields()}
    </div>
  );
};

// 默认分类数据（作为降级方案）
function getDefaultCategories(): CategoryWithSubs[] {
  return [
    {
      id: 1, name: '电影', name_en: 'movie', sort_order: 1, is_active: true,
      subCategories: [
        { id: 1, parent_id: 1, name: '动作', name_en: 'action', sort_order: 1, is_active: true },
        { id: 2, parent_id: 1, name: '喜剧', name_en: 'comedy', sort_order: 2, is_active: true },
        { id: 3, parent_id: 1, name: '爱情', name_en: 'romance', sort_order: 3, is_active: true },
        { id: 4, parent_id: 1, name: '科幻', name_en: 'scifi', sort_order: 4, is_active: true },
        { id: 5, parent_id: 1, name: '恐怖', name_en: 'horror', sort_order: 5, is_active: true },
        { id: 6, parent_id: 1, name: '悬疑', name_en: 'mystery', sort_order: 6, is_active: true },
        { id: 7, parent_id: 1, name: '战争', name_en: 'war', sort_order: 7, is_active: true },
        { id: 8, parent_id: 1, name: '剧情', name_en: 'drama', sort_order: 8, is_active: true },
        { id: 9, parent_id: 1, name: '伦理', name_en: 'ethics', sort_order: 9, is_active: true },
      ],
    },
    {
      id: 2, name: '电视剧', name_en: 'series', sort_order: 2, is_active: true,
      subCategories: [
        { id: 10, parent_id: 2, name: '国产剧', name_en: 'chinese', sort_order: 1, is_active: true },
        { id: 11, parent_id: 2, name: '韩剧', name_en: 'korean', sort_order: 2, is_active: true },
        { id: 12, parent_id: 2, name: '日剧', name_en: 'japanese', sort_order: 3, is_active: true },
        { id: 13, parent_id: 2, name: '美剧', name_en: 'american', sort_order: 4, is_active: true },
        { id: 14, parent_id: 2, name: '港台剧', name_en: 'hktw', sort_order: 5, is_active: true },
        { id: 15, parent_id: 2, name: '泰剧', name_en: 'thai', sort_order: 6, is_active: true },
      ],
    },
    {
      id: 3, name: '综艺', name_en: 'variety', sort_order: 3, is_active: true,
      subCategories: [
        { id: 20, parent_id: 3, name: '真人秀', name_en: 'reality', sort_order: 1, is_active: true },
        { id: 21, parent_id: 3, name: '访谈', name_en: 'talk', sort_order: 2, is_active: true },
        { id: 22, parent_id: 3, name: '选秀', name_en: 'talent', sort_order: 3, is_active: true },
        { id: 23, parent_id: 3, name: '晚会', name_en: 'gala', sort_order: 4, is_active: true },
      ],
    },
    {
      id: 4, name: '动漫', name_en: 'anime', sort_order: 4, is_active: true,
      subCategories: [
        { id: 30, parent_id: 4, name: '国产动漫', name_en: 'chinese', sort_order: 1, is_active: true },
        { id: 31, parent_id: 4, name: '日本动漫', name_en: 'japanese', sort_order: 2, is_active: true },
        { id: 32, parent_id: 4, name: '欧美动漫', name_en: 'western', sort_order: 3, is_active: true },
      ],
    },
    {
      id: 5, name: '短剧', name_en: 'shorts', sort_order: 5, is_active: true,
      subCategories: [
        { id: 40, parent_id: 5, name: '霸总', name_en: 'ceo', sort_order: 1, is_active: true },
        { id: 41, parent_id: 5, name: '战神', name_en: 'warrior', sort_order: 2, is_active: true },
        { id: 42, parent_id: 5, name: '古装', name_en: 'costume', sort_order: 3, is_active: true },
        { id: 43, parent_id: 5, name: '甜宠', name_en: 'sweet', sort_order: 4, is_active: true },
      ],
    },
    {
      id: 6, name: '体育', name_en: 'sports', sort_order: 6, is_active: true,
      subCategories: [
        { id: 50, parent_id: 6, name: '足球', name_en: 'football', sort_order: 1, is_active: true },
        { id: 51, parent_id: 6, name: '篮球', name_en: 'basketball', sort_order: 2, is_active: true },
        { id: 52, parent_id: 6, name: '电竞', name_en: 'esports', sort_order: 3, is_active: true },
      ],
    },
    {
      id: 7, name: '纪录片', name_en: 'documentary', sort_order: 7, is_active: true,
      subCategories: [
        { id: 60, parent_id: 7, name: '历史', name_en: 'history', sort_order: 1, is_active: true },
        { id: 61, parent_id: 7, name: '自然', name_en: 'nature', sort_order: 2, is_active: true },
        { id: 62, parent_id: 7, name: '科技', name_en: 'technology', sort_order: 3, is_active: true },
      ],
    },
    {
      id: 8, name: '预告片', name_en: 'trailer', sort_order: 8, is_active: true,
      subCategories: [
        { id: 70, parent_id: 8, name: '电影预告', name_en: 'movie', sort_order: 1, is_active: true },
        { id: 71, parent_id: 8, name: '剧集预告', name_en: 'series', sort_order: 2, is_active: true },
      ],
    },
  ];
}

export default ApiParamsEditor;
