/**
 * Article Management Page
 * 文章/资讯管理页面
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Statistic,
  Row,
  Col,
  Popconfirm,
  Image,
  Typography,
  Alert,
} from 'antd';
import DOMPurify from 'dompurify';
import { useNotification } from '../components/providers';
import {
  SearchOutlined,
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  CloudDownloadOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getArticles,
  getArticleDetail,
  deleteArticle,
  collectArticles,
  getArticleCategories,
  migrateArticlesActors,
  type Article,
  type ArticleCategory,
} from '../services/adminApi';

const { Search } = Input;
const { Text, Paragraph } = Typography;

const ArticleManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [typeId, setTypeId] = useState<number | undefined>();
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);
  const [collectModalVisible, setCollectModalVisible] = useState(false);
  const [collecting, setCollecting] = useState(false);
  
  const [collectForm] = Form.useForm();
  const { success, error, loading: showLoading } = useNotification();

  // 加载文章列表
  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getArticles({
        page,
        limit: pageSize,
        keyword: keyword || undefined,
        typeId,
      });
      setArticles(result.list);
      setTotal(result.total);
    } catch (err) {
      error('加载文章失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, typeId, error]);

  // 加载分类
  const loadCategories = useCallback(async () => {
    try {
      const list = await getArticleCategories();
      setCategories(list);
    } catch (err) {
      logger.admin.error('Failed to load categories:', { error: err });
    }
  }, []);

  // 查看文章详情
  const viewArticle = async (article: Article) => {
    try {
      const detail = await getArticleDetail(article.id);
      setCurrentArticle(detail);
      setDetailModalVisible(true);
    } catch (err) {
      error('加载文章详情失败');
    }
  };

  // 删除文章
  const handleDelete = async (id: number) => {
    try {
      await deleteArticle(id);
      success('删除成功');
      loadArticles();
    } catch (err) {
      error('删除失败');
    }
  };

  // 执行数据库迁移
  const handleMigrate = async () => {
    const hide = showLoading('正在初始化...');
    try {
      const result = await migrateArticlesActors();
      hide();
      if (result.success) {
        success('初始化成功');
        loadCategories();
      } else {
        error(result.message || '初始化失败');
      }
    } catch (err) {
      hide();
      error('初始化失败');
    }
  };

  // 采集文章
  const handleCollect = async () => {
    try {
      const values = await collectForm.validateFields();
      setCollecting(true);
      
      const result = await collectArticles({
        apiUrl: values.apiUrl,
        sourceName: values.sourceName || '量子资源',
        page: values.page || 1,
        maxPages: values.maxPages || 10,
        typeId: values.typeId,
      });
      
      success(`采集完成！新增: ${result.newCount}, 更新: ${result.updateCount}`);
      setCollectModalVisible(false);
      loadArticles();
    } catch (err) {
      error('采集失败');
    } finally {
      setCollecting(false);
    }
  };

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const columns: ColumnsType<Article> = [
    {
      title: '封面',
      dataIndex: 'cover',
      width: 80,
      render: (cover: string) => (
        <Image
          src={cover}
          width={60}
          height={40}
          style={{ objectFit: 'cover' }}
          fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88P/BfwYABQAB/auX/QAAAABJRU5ErkJggg=="
        />
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (title: string, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{title}</div>
          {record.summary && (
            <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
              {record.summary.substring(0, 50)}...
            </Text>
          )}
        </div>
      ),
    },
    {
      title: '分类',
      dataIndex: 'type_name',
      width: 100,
      render: (name: string) => <Tag>{name || '未分类'}</Tag>,
    },
    {
      title: '作者',
      dataIndex: 'author',
      width: 100,
      render: (author: string) => author || '-',
    },
    {
      title: '点击',
      dataIndex: 'hits',
      width: 80,
      sorter: (a, b) => a.hits - b.hits,
    },
    {
      title: '发布时间',
      dataIndex: 'published_at',
      width: 160,
      render: (time: number) => time ? new Date(time * 1000).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => viewArticle(record)}
          >
            查看
          </Button>
          <Popconfirm
            title="确定删除此文章？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>文章管理</h2>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="文章总数"
              value={total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        {categories.map(cat => (
          <Col span={6} key={cat.id}>
            <Card 
              hoverable 
              onClick={() => { setTypeId(cat.id); setPage(1); }}
              style={{ cursor: 'pointer' }}
            >
              <Statistic 
                title={cat.name} 
                value={cat.article_count ?? 0} 
                suffix="篇"
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 搜索和操作栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Search
            placeholder="搜索文章标题"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={() => { setPage(1); loadArticles(); }}
            enterButton={<SearchOutlined />}
            style={{ width: 300 }}
          />
          <Select
            placeholder="选择分类"
            allowClear
            style={{ width: 150 }}
            value={typeId}
            onChange={(v) => { setTypeId(v); setPage(1); }}
            options={categories.map(c => ({ label: c.name, value: c.id }))}
          />
          <Popconfirm
            title="初始化文章表？"
            description="将创建文章表和分类表"
            onConfirm={handleMigrate}
          >
            <Button icon={<PlusOutlined />}>
              初始化数据库
            </Button>
          </Popconfirm>
          <Button
            type="primary"
            icon={<CloudDownloadOutlined />}
            onClick={() => {
              collectForm.setFieldsValue({
                apiUrl: 'https://cj.lziapi.com/api.php/provide/art/',
                sourceName: '量子资源',
                page: 1,
                maxPages: 10,
              });
              setCollectModalVisible(true);
            }}
          >
            采集文章
          </Button>
        </Space>
      </Card>

      {/* 文章列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={articles}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p) => setPage(p),
            showTotal: (t) => `共 ${t} 篇文章`,
          }}
        />
      </Card>

      {/* 文章详情弹窗 */}
      <Modal
        title={currentArticle?.title}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={800}
        footer={null}
      >
        {currentArticle && (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Tag>{currentArticle.type_name}</Tag>
              {currentArticle.author && <span>作者: {currentArticle.author}</span>}
              <span>发布: {new Date(currentArticle.published_at * 1000).toLocaleString()}</span>
            </Space>
            
            {currentArticle.cover && (
              <Image
                src={currentArticle.cover}
                style={{ maxWidth: '100%', marginBottom: 16 }}
              />
            )}
            
            {currentArticle.summary && (
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                {currentArticle.summary}
              </Paragraph>
            )}
            
            {currentArticle.content && (
              <div 
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentArticle.content) }}
                style={{ lineHeight: 1.8 }}
              />
            )}
          </div>
        )}
      </Modal>

      {/* 采集弹窗 */}
      <Modal
        title="采集文章"
        open={collectModalVisible}
        onCancel={() => setCollectModalVisible(false)}
        footer={null}
        width={500}
      >
        <Alert
          message="文章采集说明"
          description="从资源站API采集影视资讯、娱乐新闻等文章内容。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Form form={collectForm} layout="vertical">
          <Form.Item
            label="API地址"
            name="apiUrl"
            rules={[{ required: true, message: '请输入API地址' }]}
          >
            <Input placeholder="https://cj.lziapi.com/api.php/provide/art/" />
          </Form.Item>
          <Form.Item label="来源名称" name="sourceName">
            <Input placeholder="量子资源" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="起始页" name="page">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="最大页数" name="maxPages">
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="分类ID" name="typeId">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Button
            type="primary"
            block
            loading={collecting}
            onClick={handleCollect}
          >
            开始采集
          </Button>
        </Form>
      </Modal>
    </div>
  );
};

export default ArticleManagement;
