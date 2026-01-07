/**
 * Topic Content Management Modal
 * 专题内容管理弹窗
 */

import { useState, useEffect } from 'react';
import {
  Modal,
  Input,
  Table,
  Button,
  Space,
  message,
  Empty,
  Image,
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getTopicItems,
  searchVideos,
  addTopicItems,
  deleteTopicItem,
  updateTopicItemsOrder,
} from '../services/adminApi';

const { Search } = Input;

interface Video {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_year?: string;
  vod_area?: string;
}

interface TopicItem extends Video {
  sort_order: number;
}

interface TopicContentModalProps {
  visible: boolean;
  topicId: string;
  topicTitle: string;
  onCancel: () => void;
}

const TopicContentModal: React.FC<TopicContentModalProps> = ({
  visible,
  topicId,
  topicTitle,
  onCancel,
}) => {
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [topicItems, setTopicItems] = useState<TopicItem[]>([]);
  const [searchResults, setSearchResults] = useState<Video[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);

  // 加载专题内容
  const loadTopicItems = async () => {
    if (!topicId) return;
    setLoading(true);
    try {
      const data = await getTopicItems(topicId);
      setTopicItems(data);
    } catch (error: any) {
      message.error(error.message || '加载专题内容失败');
    } finally {
      setLoading(false);
    }
  };

  // 搜索视频
  const handleSearch = async (keyword: string) => {
    if (!keyword.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchKeyword(keyword);
    setSearchLoading(true);
    try {
      const data = await searchVideos(keyword);
      setSearchResults(data);
    } catch (error: any) {
      message.error(error.message || '搜索失败');
    } finally {
      setSearchLoading(false);
    }
  };

  // 添加视频到专题
  const handleAddVideos = async () => {
    if (selectedVideos.length === 0) {
      message.warning('请先选择要添加的视频');
      return;
    }
    try {
      await addTopicItems(topicId, selectedVideos);
      message.success(`成功添加 ${selectedVideos.length} 个视频`);
      setSelectedVideos([]);
      setSearchResults([]);
      setSearchKeyword('');
      loadTopicItems();
    } catch (error: any) {
      message.error(error.message || '添加失败');
    }
  };

  // 删除专题内容
  const handleDelete = async (vodId: string) => {
    try {
      await deleteTopicItem(topicId, vodId);
      message.success('删除成功');
      loadTopicItems();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  // 上移
  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newItems = [...topicItems];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    await updateOrder(newItems);
  };

  // 下移
  const handleMoveDown = async (index: number) => {
    if (index === topicItems.length - 1) return;
    const newItems = [...topicItems];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    await updateOrder(newItems);
  };

  // 更新排序
  const updateOrder = async (newItems: TopicItem[]) => {
    const vodIds = newItems.map((item) => item.vod_id);
    try {
      await updateTopicItemsOrder(topicId, vodIds);
      setTopicItems(newItems);
      message.success('排序已更新');
    } catch (error: any) {
      message.error(error.message || '更新排序失败');
    }
  };

  useEffect(() => {
    if (visible) {
      loadTopicItems();
    } else {
      setSearchResults([]);
      setSearchKeyword('');
      setSelectedVideos([]);
    }
  }, [visible, topicId]);

  // 专题内容列表列定义
  const topicItemColumns: ColumnsType<TopicItem> = [
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80,
      render: (_, __, index) => index + 1,
    },
    {
      title: '封面',
      dataIndex: 'vod_pic',
      key: 'vod_pic',
      width: 100,
      render: (url: string) => (
        <Image
          src={url}
          alt="封面"
          width={60}
          height={80}
          style={{ objectFit: 'cover' }}
        />
      ),
    },
    {
      title: '视频名称',
      dataIndex: 'vod_name',
      key: 'vod_name',
    },
    {
      title: '年份',
      dataIndex: 'vod_year',
      key: 'vod_year',
      width: 80,
    },
    {
      title: '地区',
      dataIndex: 'vod_area',
      key: 'vod_area',
      width: 100,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, __: TopicItem, index: number) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            disabled={index === 0}
            onClick={() => handleMoveUp(index)}
          >
            上移
          </Button>
          <Button
            type="link"
            size="small"
            disabled={index === topicItems.length - 1}
            onClick={() => handleMoveDown(index)}
          >
            下移
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(__.vod_id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 搜索结果列定义
  const searchColumns: ColumnsType<Video> = [
    {
      title: '封面',
      dataIndex: 'vod_pic',
      key: 'vod_pic',
      width: 100,
      render: (url: string) => (
        <Image
          src={url}
          alt="封面"
          width={60}
          height={80}
          style={{ objectFit: 'cover' }}
        />
      ),
    },
    {
      title: '视频名称',
      dataIndex: 'vod_name',
      key: 'vod_name',
    },
    {
      title: '年份',
      dataIndex: 'vod_year',
      key: 'vod_year',
      width: 80,
    },
    {
      title: '地区',
      dataIndex: 'vod_area',
      key: 'vod_area',
      width: 100,
    },
  ];

  return (
    <Modal
      title={`管理专题内容 - ${topicTitle}`}
      open={visible}
      onCancel={onCancel}
      width={1000}
      footer={null}
      destroyOnHidden
    >
      <div style={{ marginBottom: 24 }}>
        <h3>当前专题内容 ({topicItems.length})</h3>
        <Table
          columns={topicItemColumns}
          dataSource={topicItems}
          rowKey="vod_id"
          loading={loading}
          pagination={false}
          size="small"
          locale={{
            emptyText: <Empty description="暂无内容，请搜索并添加视频" />,
          }}
          scroll={{ y: 300 }}
        />
      </div>

      <div>
        <h3>搜索并添加视频</h3>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Search
            placeholder="输入视频名称搜索"
            enterButton={<SearchOutlined />}
            size="large"
            onSearch={handleSearch}
            loading={searchLoading}
          />

          {searchResults.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  搜索结果 ({searchResults.length}) - 已选择 {selectedVideos.length} 个
                </span>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAddVideos}
                  disabled={selectedVideos.length === 0}
                >
                  添加选中的视频
                </Button>
              </div>
              <Table
                columns={searchColumns}
                dataSource={searchResults}
                rowKey="vod_id"
                pagination={false}
                size="small"
                scroll={{ y: 300 }}
                rowSelection={{
                  selectedRowKeys: selectedVideos,
                  onChange: (selectedRowKeys) => {
                    setSelectedVideos(selectedRowKeys as string[]);
                  },
                  getCheckboxProps: (record) => ({
                    disabled: topicItems.some((item) => item.vod_id === record.vod_id),
                  }),
                }}
              />
            </>
          )}

          {searchKeyword && searchResults.length === 0 && !searchLoading && (
            <Empty description="未找到相关视频" />
          )}
        </Space>
      </div>
    </Modal>
  );
};

export default TopicContentModal;
