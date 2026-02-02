/**
 * Feedback Inbox Page
 * 反馈信箱页面 - 增强版
 */

import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Typography,
  Card,
  Tag,
  Space,
  Modal,
  Input,
  Select,
  Row,
  Col,
  Statistic,
  Popconfirm,
} from 'antd';
import { useNotification } from '../components/providers';
import {
  CheckOutlined,
  MessageOutlined,
  BugOutlined,
  BulbOutlined,
  FrownOutlined,
  QuestionOutlined,
  ExportOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getAllFeedback,
  replyFeedback,
  updateFeedbackCategory,
  batchProcessFeedback,
  getFeedbackStats,
  processFeedback,
  type FeedbackDetail,
} from '../services/adminApi';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const FeedbackInbox: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackDetail | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [stats, setStats] = useState<any>(null);
  const { success, error, warning } = useNotification();

  // 加载反馈列表
  const loadFeedback = async () => {
    setLoading(true);
    try {
      const result = await getAllFeedback({
        page,
        limit: 20,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
      });
      setFeedback(result.list);
      setTotal(result.total);
    } catch (err: any) {
      error(err.message || '加载反馈列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载统计数据
  const loadStats = async () => {
    try {
      const data = await getFeedbackStats();
      setStats(data);
    } catch (err) {
      logger.admin.info('Stats not available');
    }
  };

  // 标记为已处理
  const handleProcess = async (id: number) => {
    try {
      await processFeedback(id);
      success('已标记为已处理');
      loadFeedback();
      loadStats();
    } catch (err: any) {
      error(err.message || '操作失败');
    }
  };

  // 打开回复弹窗
  const handleOpenReply = (record: FeedbackDetail) => {
    setCurrentFeedback(record);
    setReplyContent(record.reply || '');
    setReplyModalVisible(true);
  };

  // 发送回复
  const handleSendReply = async () => {
    if (!currentFeedback || !replyContent.trim()) {
      warning('请输入回复内容');
      return;
    }

    try {
      await replyFeedback(currentFeedback.id, replyContent);
      success('回复成功');
      setReplyModalVisible(false);
      setReplyContent('');
      loadFeedback();
      loadStats();
    } catch (err: any) {
      error(err.message || '回复失败');
    }
  };

  // 更新分类
  const handleCategoryChange = async (id: number, category: string) => {
    try {
      await updateFeedbackCategory(id, category);
      success('分类已更新');
      loadFeedback();
    } catch (err: any) {
      error(err.message || '更新失败');
    }
  };

  // 批量处理
  const handleBatchProcess = async (action: 'process' | 'delete') => {
    if (selectedRowKeys.length === 0) {
      warning('请先选择要处理的反馈');
      return;
    }

    try {
      await batchProcessFeedback(selectedRowKeys, action);
      success(`已${action === 'process' ? '处理' : '删除'} ${selectedRowKeys.length} 条反馈`);
      setSelectedRowKeys([]);
      loadFeedback();
      loadStats();
    } catch (err: any) {
      error(err.message || '批量操作失败');
    }
  };

  // 导出数据
  const handleExport = () => {
    const csvContent = feedback.map(f => 
      `${f.id},${f.user_id},"${f.content.replace(/"/g, '""')}",${f.contact || ''},${f.status},${f.category || ''},${new Date(f.created_at * 1000).toLocaleString()}`
    ).join('\n');
    
    const header = 'ID,用户ID,内容,联系方式,状态,分类,提交时间\n';
    const blob = new Blob([header + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `feedback_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  useEffect(() => {
    loadFeedback();
    loadStats();
  }, [page, statusFilter, categoryFilter]);

  // 分类图标
  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'bug': return <BugOutlined style={{ color: '#ff4d4f' }} />;
      case 'suggestion': return <BulbOutlined style={{ color: '#faad14' }} />;
      case 'complaint': return <FrownOutlined style={{ color: '#ff7a45' }} />;
      default: return <QuestionOutlined style={{ color: '#1890ff' }} />;
    }
  };

  const columns: ColumnsType<FeedbackDetail> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '用户ID',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 80,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category: string, record) => (
        <Select
          value={category || 'other'}
          size="small"
          style={{ width: 100 }}
          onChange={(value) => handleCategoryChange(record.id, value)}
        >
          <Select.Option value="bug"><Space>{getCategoryIcon('bug')} Bug</Space></Select.Option>
          <Select.Option value="suggestion"><Space>{getCategoryIcon('suggestion')} 建议</Space></Select.Option>
          <Select.Option value="complaint"><Space>{getCategoryIcon('complaint')} 投诉</Space></Select.Option>
          <Select.Option value="other"><Space>{getCategoryIcon('other')} 其他</Space></Select.Option>
        </Select>
      ),
    },
    {
      title: '反馈内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: '联系方式',
      dataIndex: 'contact',
      key: 'contact',
      width: 150,
      render: (contact: string | null) => contact || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config: Record<string, { color: string; text: string }> = {
          pending: { color: 'orange', text: '待处理' },
          processed: { color: 'green', text: '已处理' },
          replied: { color: 'blue', text: '已回复' },
        };
        const { color, text } = config[status] || { color: 'default', text: status };
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (timestamp: number) => {
        if (!timestamp) return '-';
        return new Date(timestamp * 1000).toLocaleString('zh-CN');
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<MessageOutlined />}
            onClick={() => handleOpenReply(record)}
          >
            回复
          </Button>
          {record.status === 'pending' && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleProcess(record.id)}
            >
              处理
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>反馈信箱</Title>

      {/* 统计卡片 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总反馈数"
                value={stats.total}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="待处理"
                value={stats.pending}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已处理"
                value={stats.processed}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已回复"
                value={stats.replied}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        {/* 筛选和操作栏 */}
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Select
              placeholder="状态筛选"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120 }}
              allowClear
            >
              <Select.Option value="pending">待处理</Select.Option>
              <Select.Option value="processed">已处理</Select.Option>
              <Select.Option value="replied">已回复</Select.Option>
            </Select>
            <Select
              placeholder="分类筛选"
              value={categoryFilter}
              onChange={setCategoryFilter}
              style={{ width: 120 }}
              allowClear
            >
              <Select.Option value="bug">Bug</Select.Option>
              <Select.Option value="suggestion">建议</Select.Option>
              <Select.Option value="complaint">投诉</Select.Option>
              <Select.Option value="other">其他</Select.Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={loadFeedback}>
              刷新
            </Button>
          </Space>
          <Space>
            {selectedRowKeys.length > 0 && (
              <>
                <Text type="secondary">已选 {selectedRowKeys.length} 项</Text>
                <Button onClick={() => handleBatchProcess('process')}>
                  批量处理
                </Button>
                <Popconfirm
                  title="确定删除选中的反馈吗？"
                  onConfirm={() => handleBatchProcess('delete')}
                >
                  <Button danger>批量删除</Button>
                </Popconfirm>
              </>
            )}
            <Button icon={<ExportOutlined />} onClick={handleExport}>
              导出
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={feedback}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as number[]),
          }}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条反馈`,
          }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '12px 0' }}>
                <Paragraph>
                  <Text strong>完整内容：</Text>
                  <br />
                  {record.content}
                </Paragraph>
                {record.reply && (
                  <Paragraph>
                    <Text strong style={{ color: '#1890ff' }}>回复内容：</Text>
                    <br />
                    {record.reply}
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      回复时间：{record.replied_at ? new Date(record.replied_at * 1000).toLocaleString('zh-CN') : '-'}
                    </Text>
                  </Paragraph>
                )}
              </div>
            ),
          }}
        />
      </Card>

      {/* 回复弹窗 */}
      <Modal
        title={`回复反馈 #${currentFeedback?.id}`}
        open={replyModalVisible}
        onCancel={() => setReplyModalVisible(false)}
        onOk={handleSendReply}
        okText="发送回复"
        width={600}
      >
        {currentFeedback && (
          <div>
            <Card size="small" style={{ marginBottom: 16, background: '#f5f5f5' }}>
              <Text strong>用户反馈：</Text>
              <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                {currentFeedback.content}
              </Paragraph>
              {currentFeedback.contact && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  联系方式：{currentFeedback.contact}
                </Text>
              )}
            </Card>
            <TextArea
              rows={4}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="请输入回复内容..."
              maxLength={500}
              showCount
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FeedbackInbox;
