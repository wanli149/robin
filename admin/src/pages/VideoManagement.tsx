/**
 * Video Management Page - Refactored
 * 视频管理页面 - 重构版（单页应用式布局，按分类浏览）
 * 整合了原短剧管理页面的所有功能
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,
  Tag,
  Modal,
  Form,
  message,
  Image,
  Popconfirm,
  Tooltip,
  Row,
  Col,
  Statistic,
  Dropdown,
  Drawer,
  Spin,
} from 'antd';
import {
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PictureOutlined,
  ExportOutlined,
  PlayCircleOutlined,
  DownOutlined,
  EyeOutlined,
  PushpinOutlined,
  SyncOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  ClearOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  batchVideos,
  exportVideos,
  getVideoSources,
  getSubCategories,
  triggerShortsFetch,
  migrateShorts,
  reclassifyShorts,
  clearShorts,
  clearVideos,
  pinShort,
  repairVideo,
  repairInvalidVideos,
  quickCategoryCollect,
  type SubCategory,
} from '../services/adminApi';

const { TextArea } = Input;

// 视频数据类型
interface Video {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_pic_vertical?: string;
  vod_remarks: string;
  vod_year: string;
  vod_area: string;
  vod_actor: string;
  vod_director: string;
  vod_writer: string;
  vod_score: number;
  vod_tmdb_score: number;
  vod_score_source: string;
  vod_hits: number;
  vod_hits_day: number;
  vod_tag: string;
  vod_duration: string;
  vod_total: number;
  type_id: number;
  type_name: string;
  sub_type_id?: number;
  sub_type_name?: string;
  category?: string; // 短剧子分类
  source_name: string;
  is_valid: number;
  updated_at: number;
  fetched_at?: number;
}

// 分类数据类型
interface Category {
  id: number;
  name: string;
  name_en: string;
  icon?: string;
  video_count?: number;
  today_new?: number;
}

// 分类统计类型
interface CategoryStats {
  id: number;
  name: string;
  video_count: number;
  today_new: number;
  week_new: number;
}

// 短剧分类颜色映射
const SHORTS_CATEGORY_COLORS: Record<string, string> = {
  '霸总': 'gold',
  '战神': 'red',
  '古装': 'purple',
  '都市': 'blue',
  '甜宠': 'pink',
  '复仇': 'orange',
  '玄幻': 'cyan',
  '重生': 'green',
  '萌宝': 'magenta',
  '虐恋': 'volcano',
  '其他': 'default',
};

const VideoManagement: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // 从URL获取初始分类ID
  const initialCategoryId = searchParams.get('category') || '';
  const initialSubCategoryId = searchParams.get('sub') || '';

  // 基础状态
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  
  // 分类相关状态
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialCategoryId);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string>(initialSubCategoryId);
  
  // 筛选状态
  const [keyword, setKeyword] = useState('');
  const [isValid, setIsValid] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('');
  const [areaFilter, setAreaFilter] = useState<string>('');
  
  // 弹窗状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [sourcesDrawerVisible, setSourcesDrawerVisible] = useState(false);
  const [videoSources, setVideoSources] = useState<any[]>([]);
  const [form] = Form.useForm();

  // 判断当前是否为短剧分类
  const isShorts = selectedCategoryId === '5';

  // 加载分类列表
  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch('/admin/categories', {
        headers: { 'x-admin-key': localStorage.getItem('admin_key') || '' },
      });
      const data = await response.json();
      if (data.code === 1) {
        setCategories(data.list || []);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, []);

  // 加载分类统计
  const loadCategoryStats = useCallback(async () => {
    try {
      const response = await fetch('/admin/categories/stats', {
        headers: { 'x-admin-key': localStorage.getItem('admin_key') || '' },
      });
      const data = await response.json();
      if (data.code === 1) {
        setCategoryStats(data.list || []);
      }
    } catch (error) {
      console.error('Failed to load category stats:', error);
    }
  }, []);

  // 加载子分类
  const loadSubCategories = useCallback(async (parentId?: number) => {
    try {
      const list = await getSubCategories(parentId);
      setSubCategories(list);
    } catch (error) {
      console.error('Failed to load sub-categories:', error);
    }
  }, []);

  // 加载视频列表
  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (keyword) params.append('keyword', keyword);
      if (selectedCategoryId) params.append('type_id', selectedCategoryId);
      if (selectedSubCategoryId) params.append('sub_type_id', selectedSubCategoryId);
      if (isValid) params.append('is_valid', isValid);

      const response = await fetch(`/admin/videos?${params}`, {
        headers: { 'x-admin-key': localStorage.getItem('admin_key') || '' },
      });
      const data = await response.json();
      if (data.code === 1) {
        let filteredList = data.list;
        // 前端筛选年份和地区
        if (yearFilter) {
          filteredList = filteredList.filter((v: Video) => v.vod_year === yearFilter);
        }
        if (areaFilter) {
          filteredList = filteredList.filter((v: Video) => v.vod_area?.includes(areaFilter));
        }
        setVideos(filteredList);
        setTotal(data.total);
      }
    } catch (error) {
      message.error('加载视频列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, keyword, selectedCategoryId, selectedSubCategoryId, isValid, yearFilter, areaFilter]);

  // 选择分类
  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedSubCategoryId('');
    setPage(1);
    // 更新URL
    const params = new URLSearchParams();
    if (categoryId) params.set('category', categoryId);
    navigate(`/video-management?${params.toString()}`, { replace: true });
    // 加载该分类的子分类
    if (categoryId) {
      loadSubCategories(parseInt(categoryId));
    } else {
      setSubCategories([]);
    }
  };

  // 选择子分类
  const handleSelectSubCategory = (subCategoryId: string) => {
    setSelectedSubCategoryId(subCategoryId);
    setPage(1);
    // 更新URL
    const params = new URLSearchParams();
    if (selectedCategoryId) params.set('category', selectedCategoryId);
    if (subCategoryId) params.set('sub', subCategoryId);
    navigate(`/video-management?${params.toString()}`, { replace: true });
  };

  // 编辑视频
  const handleEdit = (video: Video) => {
    setCurrentVideo(video);
    form.setFieldsValue(video);
    setEditModalVisible(true);
  };

  // 保存编辑
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const typeNames: Record<number, string> = {
        1: '电影', 2: '电视剧', 3: '综艺', 4: '动漫', 5: '短剧', 6: '体育', 7: '纪录片', 8: '预告片',
      };
      const payload = { ...values, type_name: typeNames[values.type_id] || '电影' };
      
      const response = await fetch(`/admin/video/${currentVideo?.vod_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': localStorage.getItem('admin_key') || '',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.code === 1) {
        message.success('保存成功');
        setEditModalVisible(false);
        loadVideos();
      } else {
        message.error(data.msg || '保存失败');
      }
    } catch (error) {
      message.error('保存失败');
    }
  };

  // 删除视频
  const handleDelete = async (vodId: string) => {
    try {
      const response = await fetch(`/admin/video/${vodId}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': localStorage.getItem('admin_key') || '' },
      });
      const data = await response.json();
      if (data.code === 1) {
        message.success('删除成功');
        loadVideos();
      } else {
        message.error(data.msg || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 切换有效状态
  const toggleValid = async (vodId: string, newIsValid: boolean) => {
    try {
      const response = await fetch(`/admin/video/${vodId}/valid`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': localStorage.getItem('admin_key') || '',
        },
        body: JSON.stringify({ is_valid: newIsValid }),
      });
      const data = await response.json();
      if (data.code === 1) {
        message.success('状态更新成功');
        loadVideos();
      } else {
        message.error(data.msg || '更新失败');
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  // 批量操作
  const handleBatchAction = async (action: string, data?: any) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要操作的视频');
      return;
    }

    try {
      const result = await batchVideos(selectedRowKeys, action as any, data);
      message.success(`已${action === 'delete' ? '删除' : '更新'} ${result.affected} 个视频`);
      setSelectedRowKeys([]);
      loadVideos();
    } catch (error: any) {
      message.error(error.message || '批量操作失败');
    }
  };

  // 导出视频
  const handleExport = async () => {
    try {
      const result = await exportVideos({
        type_id: selectedCategoryId ? parseInt(selectedCategoryId) : undefined,
        is_valid: isValid || undefined,
        limit: 5000,
      });
      
      const csvContent = result.list.map((v: any) => 
        `${v.vod_id},"${v.vod_name}",${v.type_name},${v.vod_year},${v.vod_area},${v.vod_score},${v.is_valid ? '有效' : '失效'}`
      ).join('\n');
      
      const header = 'ID,名称,分类,年份,地区,评分,状态\n';
      const blob = new Blob([header + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `videos_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      message.success(`已导出 ${result.total} 个视频`);
    } catch (error: any) {
      message.error(error.message || '导出失败');
    }
  };

  // 查看播放源
  const handleViewSources = async (video: Video) => {
    setCurrentVideo(video);
    try {
      const result = await getVideoSources(video.vod_id);
      setVideoSources(result.sources);
      setSourcesDrawerVisible(true);
    } catch (error: any) {
      message.error(error.message || '获取播放源失败');
    }
  };

  // 预览视频（短剧功能）
  const handlePreview = (video: Video) => {
    const previewUrl = `/shorts/preview/${video.vod_id}`;
    window.open(previewUrl, '_blank');
  };

  // 置顶视频（短剧功能）
  const handlePin = async (video: Video) => {
    try {
      await pinShort(video.vod_id);
      message.success('置顶成功');
      loadVideos();
    } catch (error: any) {
      message.error(error.message || '置顶失败');
    }
  };

  // 修复视频数据
  const fixVideoData = async () => {
    try {
      const response = await fetch('/admin/collect/fix-covers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': localStorage.getItem('admin_key') || '',
        },
        body: JSON.stringify({ limit: 100 }),
      });
      const data = await response.json();
      if (data.code === 1) {
        message.success('数据修复任务已触发');
        setTimeout(loadVideos, 3000);
      } else {
        message.error(data.msg || '触发失败');
      }
    } catch (error) {
      message.error('触发修复失败');
    }
  };

  // 重新分类视频
  const reclassifyVideos = async () => {
    try {
      message.loading('正在重新分类...', 0);
      const response = await fetch('/admin/videos/reclassify', {
        method: 'POST',
        headers: { 'x-admin-key': localStorage.getItem('admin_key') || '' },
      });
      message.destroy();
      const data = await response.json();
      if (data.code === 1) {
        message.success(`重新分类完成！更新: ${data.data.updated}, 未变: ${data.data.unchanged}`);
        loadVideos();
        loadCategoryStats();
      } else {
        message.error(data.msg || '重新分类失败');
      }
    } catch (error) {
      message.destroy();
      message.error('重新分类失败');
    }
  };

  // 合并重复视频
  const migrateVideos = async () => {
    try {
      message.loading('正在合并重复视频...', 0);
      const response = await fetch('/admin/collect/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': localStorage.getItem('admin_key') || '',
        },
      });
      message.destroy();
      const data = await response.json();
      if (data.code === 1) {
        message.success('合并任务已触发');
        setTimeout(loadVideos, 3000);
      } else {
        message.error(data.msg || '触发失败');
      }
    } catch (error) {
      message.destroy();
      message.error('触发合并失败');
    }
  };

  // ========== 短剧专用功能 ==========
  
  // 抓取短剧
  const handleTriggerShortsFetch = async () => {
    setLoading(true);
    try {
      const result = await triggerShortsFetch();
      message.success(`抓取完成！成功获取 ${result.fetched} 个短剧`);
      loadVideos();
      loadCategoryStats();
    } catch (error: any) {
      message.error(error.message || '抓取失败');
    } finally {
      setLoading(false);
    }
  };

  // 迁移短剧表结构
  const handleMigrateShorts = async () => {
    setLoading(true);
    try {
      await migrateShorts();
      message.success('表结构迁移成功！');
      loadVideos();
    } catch (error: any) {
      message.error(error.message || '迁移失败');
    } finally {
      setLoading(false);
    }
  };

  // 重新分类短剧
  const handleReclassifyShorts = async () => {
    setLoading(true);
    try {
      const result = await reclassifyShorts();
      message.success(`重新分类完成！已更新 ${result.updated} 个短剧`);
      loadVideos();
    } catch (error: any) {
      message.error(error.message || '重新分类失败');
    } finally {
      setLoading(false);
    }
  };

  // 清空短剧
  const handleClearShorts = async () => {
    setLoading(true);
    try {
      const result = await clearShorts();
      message.success(`清空完成！已删除 ${result.deleted} 个短剧`);
      loadVideos();
      loadCategoryStats();
    } catch (error: any) {
      message.error(error.message || '清空失败');
    } finally {
      setLoading(false);
    }
  };

  // 清空当前分类视频
  const handleClearCategory = async () => {
    if (!selectedCategoryId) {
      message.warning('请先选择一个分类');
      return;
    }
    setLoading(true);
    try {
      const result = await clearVideos(parseInt(selectedCategoryId));
      message.success(`清空完成！已删除 ${result.deleted} 个视频`);
      loadVideos();
      loadCategoryStats();
    } catch (error: any) {
      message.error(error.message || '清空失败');
    } finally {
      setLoading(false);
    }
  };

  // ========== 修复功能 ==========

  // 修复单个视频
  const handleRepairVideo = async (video: Video) => {
    const hide = message.loading(`正在修复 ${video.vod_name}...`, 0);
    try {
      const result = await repairVideo(video.vod_id);
      hide();
      message.success(`修复成功！从 ${result.foundCount} 个资源站获取到播放源`);
      loadVideos();
    } catch (error: any) {
      hide();
      message.error(error.message || '修复失败');
    }
  };

  // 批量修复失效视频
  const handleRepairInvalid = async () => {
    const hide = message.loading('正在批量修复失效视频...', 0);
    try {
      const result = await repairInvalidVideos({
        type_id: selectedCategoryId ? parseInt(selectedCategoryId) : undefined,
        sub_type_id: selectedSubCategoryId ? parseInt(selectedSubCategoryId) : undefined,
        limit: 20,
      });
      hide();
      message.success(`修复完成！成功: ${result.repaired}, 失败: ${result.failed}`);
      loadVideos();
    } catch (error: any) {
      hide();
      message.error(error.message || '批量修复失败');
    }
  };

  // 获取新内容（分类采集）
  const handleFetchNew = async () => {
    if (!selectedCategoryId) {
      message.warning('请先选择一个分类');
      return;
    }
    setLoading(true);
    try {
      const result = await quickCategoryCollect(parseInt(selectedCategoryId), { maxPages: 5 });
      message.success(`采集任务已启动，任务ID: ${result.taskId}`);
    } catch (error: any) {
      message.error(error.message || '启动采集失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载
  useEffect(() => {
    loadCategories();
    loadCategoryStats();
  }, [loadCategories, loadCategoryStats]);

  // 分类变化时加载子分类
  useEffect(() => {
    if (selectedCategoryId) {
      loadSubCategories(parseInt(selectedCategoryId));
    }
  }, [selectedCategoryId, loadSubCategories]);

  // 筛选条件变化时加载视频
  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // 批量操作菜单
  const batchMenuItems: MenuProps['items'] = [
    { key: 'mark_valid', label: '标记为有效' },
    { key: 'mark_invalid', label: '标记为失效' },
    { type: 'divider' },
    { key: 'change_1', label: '改为电影' },
    { key: 'change_2', label: '改为电视剧' },
    { key: 'change_3', label: '改为综艺' },
    { key: 'change_4', label: '改为动漫' },
    { key: 'change_5', label: '改为短剧' },
    { type: 'divider' },
    { key: 'delete', label: '批量删除', danger: true },
  ];

  const handleBatchMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key.startsWith('change_')) {
      const typeId = parseInt(key.split('_')[1]);
      handleBatchAction('change_category', { type_id: typeId });
    } else {
      handleBatchAction(key);
    }
  };



  // 表格列定义
  const columns: ColumnsType<Video> = [
    {
      title: '封面',
      dataIndex: isShorts ? 'vod_pic_vertical' : 'vod_pic',
      width: 80,
      render: (pic: string, record: Video) => {
        const imgSrc = isShorts ? (record.vod_pic_vertical || record.vod_pic) : pic;
        return imgSrc ? (
          <Image
            src={imgSrc}
            width={50}
            height={isShorts ? 80 : 70}
            style={{ objectFit: 'cover' }}
            fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='70'%3E%3Crect width='50' height='70' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='10'%3E暂无%3C/text%3E%3C/svg%3E"
          />
        ) : null;
      },
    },
    {
      title: '名称',
      dataIndex: 'vod_name',
      width: 180,
      ellipsis: true,
    },
    {
      title: '备注',
      dataIndex: 'vod_remarks',
      width: 100,
      ellipsis: true,
    },
    {
      title: isShorts ? '子分类' : '分类',
      dataIndex: isShorts ? 'sub_type_name' : 'type_name',
      width: 80,
      render: (value: string, record: Video) => {
        if (isShorts) {
          const subType = value || record.category || '';
          const color = SHORTS_CATEGORY_COLORS[subType] || 'blue';
          return <Tag color={color}>{subType || '未分类'}</Tag>;
        }
        return <Tag>{value}</Tag>;
      },
    },
    {
      title: '来源',
      dataIndex: 'source_name',
      width: 80,
      render: (source: string) => {
        if (!source) return '-';
        const sources = source.split(',').map(s => s.trim()).filter(Boolean);
        if (sources.length === 1) {
          return <Tag color="blue">{sources[0]}</Tag>;
        }
        return (
          <Tooltip title={sources.join(', ')}>
            <Tag color="blue">{sources.length}个源</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '地区',
      dataIndex: 'vod_area',
      width: 60,
      render: (area: string) => area || '-',
    },
    {
      title: '年份',
      dataIndex: 'vod_year',
      width: 50,
      render: (year: string) => year || '-',
    },
    {
      title: '评分',
      dataIndex: 'vod_score',
      width: 60,
      render: (score: number) => (
        <span style={{ color: score >= 8 ? '#52c41a' : score >= 6 ? '#1890ff' : '#999' }}>
          {score ? `${score.toFixed(1)}` : '-'}
        </span>
      ),
    },
    {
      title: '热度',
      dataIndex: 'vod_hits',
      width: 70,
      render: (hits: number) => hits?.toLocaleString() || 0,
    },
    {
      title: '状态',
      dataIndex: 'is_valid',
      width: 70,
      render: (valid: number) => (
        <Tag color={valid ? 'success' : 'error'}>{valid ? '有效' : '失效'}</Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 140,
      render: (time: number, record: Video) => {
        const t = time || record.fetched_at;
        return t ? new Date(t * 1000).toLocaleString() : '-';
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          {/* 短剧：预览、置顶；其他：播放源 */}
          {isShorts ? (
            <>
              <Tooltip title="预览"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handlePreview(record)} /></Tooltip>
              <Tooltip title="置顶"><Button type="text" size="small" icon={<PushpinOutlined />} onClick={() => handlePin(record)} /></Tooltip>
            </>
          ) : (
            <Tooltip title="播放源"><Button type="text" size="small" icon={<PlayCircleOutlined />} onClick={() => handleViewSources(record)} /></Tooltip>
          )}
          {/* 修复按钮 - 失效视频显示 */}
          {!record.is_valid && (
            <Tooltip title="修复"><Button type="text" size="small" icon={<ToolOutlined />} onClick={() => handleRepairVideo(record)} style={{ color: '#faad14' }} /></Tooltip>
          )}
          {/* 通用操作 */}
          <Tooltip title="编辑"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} /></Tooltip>
          <Tooltip title={record.is_valid ? '标记失效' : '标记有效'}>
            <Button type="text" size="small" icon={record.is_valid ? <CloseCircleOutlined /> : <CheckCircleOutlined />} onClick={() => toggleValid(record.vod_id, !record.is_valid)} />
          </Tooltip>
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.vod_id)}>
            <Tooltip title="删除"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ] as ColumnsType<Video>;

  return (
    <div style={{ padding: 24 }}>
      {/* 顶部分类卡片 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col>
          <Card
            size="small"
            hoverable
            style={{ 
              cursor: 'pointer', 
              minWidth: 90,
              borderColor: !selectedCategoryId ? '#1890ff' : undefined,
              background: !selectedCategoryId ? '#e6f7ff' : undefined,
            }}
            bodyStyle={{ padding: '12px 16px' }}
            onClick={() => handleSelectCategory('')}
          >
            <Statistic title="全部" value={categoryStats.reduce((sum, s) => sum + s.video_count, 0)} valueStyle={{ fontSize: 18 }} />
          </Card>
        </Col>
        {categoryStats.map(cat => (
          <Col key={cat.id}>
            <Card
              size="small"
              hoverable
              style={{ 
                cursor: 'pointer', 
                minWidth: 90,
                borderColor: selectedCategoryId === String(cat.id) ? '#1890ff' : undefined,
                background: selectedCategoryId === String(cat.id) ? '#e6f7ff' : undefined,
              }}
              bodyStyle={{ padding: '12px 16px' }}
              onClick={() => handleSelectCategory(String(cat.id))}
            >
              <Statistic 
                title={<span>{categories.find(c => c.id === cat.id)?.icon} {cat.name}</span>}
                value={cat.video_count} 
                valueStyle={{ fontSize: 18 }}
                suffix={cat.today_new > 0 ? <Tag color="green" style={{ fontSize: 10 }}>+{cat.today_new}</Tag> : null}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 子分类筛选 - 统一处理所有分类 */}
      {selectedCategoryId && subCategories.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Space wrap size={8}>
            <span style={{ color: '#666' }}>子分类:</span>
            <Tag color={!selectedSubCategoryId ? 'blue' : 'default'} style={{ cursor: 'pointer' }} onClick={() => handleSelectSubCategory('')}>全部</Tag>
            {subCategories.map(sub => (
              <Tag 
                key={sub.id} 
                color={selectedSubCategoryId === String(sub.id) ? (isShorts ? (SHORTS_CATEGORY_COLORS[sub.name] || 'blue') : 'blue') : 'default'} 
                style={{ cursor: 'pointer' }} 
                onClick={() => handleSelectSubCategory(String(sub.id))}
              >
                {sub.name}
              </Tag>
            ))}
          </Space>
        </div>
      )}

      {/* 搜索和操作栏 */}
        <Card style={{ marginBottom: 16 }}>
          <Space wrap>
            {/* 通用筛选 */}
            <Input
              placeholder="搜索视频名称或演员"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={() => { setPage(1); loadVideos(); }}
              style={{ width: 200 }}
              prefix={<SearchOutlined />}
            />
            <Select placeholder="状态" value={isValid} onChange={(v) => { setIsValid(v); setPage(1); }} style={{ width: 100 }} allowClear>
              <Select.Option value="1">有效</Select.Option>
              <Select.Option value="0">失效</Select.Option>
            </Select>
            <Input placeholder="年份" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} style={{ width: 80 }} />
            <Input placeholder="地区" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} style={{ width: 80 }} />
            <Button type="primary" icon={<SearchOutlined />} onClick={() => { setPage(1); loadVideos(); }}>搜索</Button>
            <Button icon={<ReloadOutlined />} onClick={() => { loadVideos(); loadCategoryStats(); }}>刷新</Button>
            
            {/* 批量操作 */}
            <Dropdown menu={{ items: batchMenuItems, onClick: handleBatchMenuClick }} disabled={selectedRowKeys.length === 0}>
              <Button>批量操作 <DownOutlined /></Button>
            </Dropdown>
            
            {/* 导出 */}
            <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
            
            {/* 采集和修复 - 需要选择分类 */}
            {selectedCategoryId && (
              <>
                <Tooltip title={`从资源站获取新的${categories.find(c => c.id === parseInt(selectedCategoryId))?.name || '内容'}`}>
                  <Button type="primary" ghost icon={<SyncOutlined />} onClick={handleFetchNew} loading={loading}>
                    获取新内容
                  </Button>
                </Tooltip>
                <Tooltip title="批量修复当前分类下的失效视频">
                  <Button icon={<ToolOutlined />} onClick={handleRepairInvalid} style={{ color: '#faad14', borderColor: '#faad14' }}>
                    修复失效
                  </Button>
                </Tooltip>
                <Popconfirm
                  title={`确定清空"${categories.find(c => c.id === parseInt(selectedCategoryId))?.name || '当前分类'}"的所有视频吗？`}
                  description="此操作不可恢复，清空后需要重新采集"
                  onConfirm={handleClearCategory}
                  okText="确定清空"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger icon={<ClearOutlined />} loading={loading}>
                    清空分类
                  </Button>
                </Popconfirm>
              </>
            )}
            
            {/* 短剧专用操作 */}
            {isShorts && (
              <>
                <Popconfirm
                  title="确定清空所有短剧数据吗？"
                  description="此操作不可恢复，清空后需要重新抓取"
                  onConfirm={handleClearShorts}
                  okText="确定清空"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger icon={<ClearOutlined />} loading={loading}>清空短剧</Button>
                </Popconfirm>
                <Button icon={<DatabaseOutlined />} onClick={handleMigrateShorts} loading={loading}>迁移表结构</Button>
                <Button icon={<SyncOutlined />} onClick={handleReclassifyShorts} loading={loading}>重新分类</Button>
                <Button type="primary" icon={<SyncOutlined />} onClick={handleTriggerShortsFetch} loading={loading}>抓取短剧</Button>
              </>
            )}
            
            {/* 普通视频专用操作 */}
            {!isShorts && (
              <>
                <Tooltip title="为缺少信息的视频补充数据">
                  <Button icon={<PictureOutlined />} onClick={fixVideoData}>修复数据</Button>
                </Tooltip>
                <Popconfirm title="确定重新分类所有视频？" onConfirm={reclassifyVideos}>
                  <Button icon={<SyncOutlined />}>重新分类</Button>
                </Popconfirm>
                <Button danger onClick={migrateVideos}>合并重复</Button>
              </>
            )}
          </Space>
        </Card>

        {/* 视频列表 */}
        <Card>
          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={videos}
              rowKey="vod_id"
              scroll={{ x: 1400 }}
              rowSelection={{
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys as string[]),
              }}
              pagination={{
                current: page,
                total,
                pageSize: 20,
                onChange: setPage,
                showTotal: (total) => `共 ${total} 条`,
                showSizeChanger: true,
              }}
            />
          </Spin>
        </Card>

      {/* 编辑弹窗 */}
      <Modal title="编辑视频" open={editModalVisible} onOk={handleSave} onCancel={() => setEditModalVisible(false)} width={800}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="视频名称" name="vod_name"><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="分类" name="type_id" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value={1}>电影</Select.Option>
                  <Select.Option value={2}>电视剧</Select.Option>
                  <Select.Option value={3}>综艺</Select.Option>
                  <Select.Option value={4}>动漫</Select.Option>
                  <Select.Option value={5}>短剧</Select.Option>
                  <Select.Option value={6}>体育</Select.Option>
                  <Select.Option value={7}>纪录片</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="封面图" name="vod_pic"><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={8}><Form.Item label="备注" name="vod_remarks"><Input placeholder="如：更新至20集" /></Form.Item></Col>
            <Col span={8}><Form.Item label="年份" name="vod_year"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item label="地区" name="vod_area"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item label="演员" name="vod_actor"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item label="导演" name="vod_director"><Input /></Form.Item></Col>
          </Row>
          <Form.Item label="简介" name="vod_content"><TextArea rows={4} /></Form.Item>
        </Form>
      </Modal>

      {/* 播放源抽屉 */}
      <Drawer
        title={`播放源 - ${currentVideo?.vod_name}`}
        open={sourcesDrawerVisible}
        onClose={() => setSourcesDrawerVisible(false)}
        width={600}
      >
        {videoSources.map((source, index) => (
          <Card key={index} title={source.name} size="small" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {source.episodes.slice(0, 20).map((ep: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{ep.title}</span>
                  <a href={ep.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                    播放
                  </a>
                </div>
              ))}
              {source.episodes.length > 20 && (
                <span style={{ color: '#999' }}>... 共 {source.episodes.length} 集</span>
              )}
            </Space>
          </Card>
        ))}
        {videoSources.length === 0 && <div style={{ textAlign: 'center', color: '#999' }}>暂无播放源</div>}
      </Drawer>
    </div>
  );
};

export default VideoManagement;
