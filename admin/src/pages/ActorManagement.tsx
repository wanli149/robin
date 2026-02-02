/**
 * Actor Management Page
 * 演员管理页面
 */

import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Input,
  Button,
  Space,
  Tag,
  Avatar,
  Statistic,
  Row,
  Col,
  Modal,
  Tabs,
  Form,
  InputNumber,
  Popconfirm,
  Alert,
} from 'antd';
import { useNotification } from '../components/providers';
import {
  SearchOutlined,
  UserOutlined,
  FireOutlined,
  TrophyOutlined,
  CloudDownloadOutlined,
  DatabaseOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  collectActors,
  enrichActors,
  migrateArticlesActors,
  getCollectStats,
  updateActor,
  deleteActor,
  mergeActors,
  getPopularActors,
  searchActors as searchActorsApi,
  getActorDetail,
  rebuildActors as rebuildActorsApi,
} from '../services/adminApi';

const { Search } = Input;

interface Actor {
  id: number;
  name: string;
  name_en: string;
  avatar: string;
  bio: string;
  works_count: number;
  popularity: number;
  created_at: number;
}

interface ActorWork {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_year: string;
  vod_score: number;
  role_type: string;
}

const ActorManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [actors, setActors] = useState<Actor[]>([]);
  const [keyword, setKeyword] = useState('');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentActor, setCurrentActor] = useState<Actor | null>(null);
  const [actorWorks, setActorWorks] = useState<ActorWork[]>([]);
  const [collectModalVisible, setCollectModalVisible] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [stats, setStats] = useState<{ total: number; withAvatar: number; withWorks: number } | null>(null);
  const [collectForm] = Form.useForm();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [selectedActors, setSelectedActors] = useState<number[]>([]);
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const { success, error, warning, loading: showLoading } = useNotification();

  // 加载热门演员
  const loadPopularActors = async () => {
    setLoading(true);
    try {
      const data = await getPopularActors(100);
      setActors(data as Actor[]);
    } catch (err) {
      error('加载演员列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 搜索演员
  const searchActors = async (value: string) => {
    if (!value.trim()) {
      loadPopularActors();
      return;
    }

    setLoading(true);
    try {
      const data = await searchActorsApi(value);
      setActors(data as Actor[]);
    } catch (err) {
      error('搜索失败');
    } finally {
      setLoading(false);
    }
  };

  // 查看演员详情
  const viewActorDetail = async (actor: Actor) => {
    setCurrentActor(actor);
    setDetailModalVisible(true);
    
    try {
      const data = await getActorDetail(actor.id);
      if (data.works) {
        setActorWorks(data.works as ActorWork[]);
      }
    } catch (err) {
      error('加载作品列表失败');
    }
  };

  // 编辑演员
  const handleEdit = (actor: Actor) => {
    setCurrentActor(actor);
    editForm.setFieldsValue({
      name: actor.name,
      name_en: actor.name_en,
      avatar: actor.avatar,
      bio: actor.bio,
    });
    setEditModalVisible(true);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!currentActor) return;
    try {
      const values = await editForm.validateFields();
      await updateActor(currentActor.id, values);
      success('保存成功');
      setEditModalVisible(false);
      loadPopularActors();
    } catch (err: any) {
      error(err.message || '保存失败');
    }
  };

  // 删除演员
  const handleDelete = async (id: number) => {
    try {
      await deleteActor(id);
      success('删除成功');
      loadPopularActors();
      loadStats();
    } catch (err: any) {
      error(err.message || '删除失败');
    }
  };

  // 合并演员
  const handleMerge = async () => {
    if (selectedActors.length < 2) {
      warning('请至少选择2个演员进行合并');
      return;
    }
    setMergeModalVisible(true);
  };

  // 执行合并
  const doMerge = async (targetId: number) => {
    const sourceIds = selectedActors.filter(id => id !== targetId);
    try {
      await mergeActors(sourceIds, targetId);
      success('合并成功');
      setMergeModalVisible(false);
      setSelectedActors([]);
      loadPopularActors();
      loadStats();
    } catch (err: any) {
      error(err.message || '合并失败');
    }
  };

  // 重建演员关联
  const rebuildActors = async () => {
    const hide = showLoading('正在重建演员关联，这可能需要几分钟...');
    try {
      const result = await rebuildActorsApi();
      hide();
      success(`演员关联重建完成！处理: ${result.processed}, 创建: ${result.created}`);
      setTimeout(loadPopularActors, 2000);
    } catch (err: any) {
      hide();
      error(err.message || '触发重建失败');
    }
  };

  // 加载统计数据
  const loadStats = async () => {
    try {
      const data = await getCollectStats();
      setStats(data.actors);
    } catch (err) {
      logger.admin.error('Failed to load stats:', { error: err });
    }
  };

  // 执行数据库迁移
  const handleMigrate = async () => {
    const hide = showLoading('正在迁移数据库...');
    try {
      const result = await migrateArticlesActors();
      hide();
      if (result.success) {
        success(`迁移成功！创建表: ${result.tables.join(', ')}`);
        loadStats();
      } else {
        error(result.message || '迁移失败');
      }
    } catch (err) {
      hide();
      error('迁移失败');
    }
  };

  // 采集演员
  const handleCollect = async () => {
    try {
      const values = await collectForm.validateFields();
      setCollecting(true);
      
      const result = await collectActors({
        apiUrl: values.apiUrl,
        sourceName: values.sourceName || '量子资源',
        page: values.page || 1,
        maxPages: values.maxPages || 50,
      });
      
      success(`采集完成！新增: ${result.newCount}, 更新: ${result.updateCount}, 匹配: ${result.matchedCount}`);
      setCollectModalVisible(false);
      loadPopularActors();
      loadStats();
    } catch (err) {
      error('采集失败');
    } finally {
      setCollecting(false);
    }
  };

  // 补充演员详情
  const handleEnrich = async () => {
    try {
      const values = await collectForm.validateFields();
      setCollecting(true);
      
      const result = await enrichActors({
        apiUrl: values.apiUrl,
        sourceName: values.sourceName || '量子资源',
        limit: values.enrichLimit || 100,
      });
      
      success(`补充完成！成功: ${result.enriched}, 未找到: ${result.notFound}`);
      loadPopularActors();
      loadStats();
    } catch (err) {
      error('补充失败');
    } finally {
      setCollecting(false);
    }
  };

  useEffect(() => {
    loadPopularActors();
    loadStats();
  }, []);

  const columns: ColumnsType<Actor> = [
    {
      title: '排名',
      key: 'rank',
      width: 80,
      render: (_, __, index) => {
        const rank = index + 1;
        return (
          <span style={{ 
            fontSize: 18, 
            fontWeight: 'bold',
            color: rank <= 3 ? '#faad14' : undefined 
          }}>
            {rank <= 3 && <TrophyOutlined style={{ marginRight: 4 }} />}
            {rank}
          </span>
        );
      },
    },
    {
      title: '演员',
      dataIndex: 'name',
      width: 200,
      render: (name: string, record: Actor) => (
        <Space>
          <Avatar icon={<UserOutlined />} src={record.avatar} />
          <div>
            <div>{name}</div>
            {record.name_en && (
              <div style={{ fontSize: 12, color: '#999' }}>{record.name_en}</div>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: '作品数',
      dataIndex: 'works_count',
      width: 100,
      sorter: (a, b) => a.works_count - b.works_count,
      render: (count: number) => (
        <Tag color="blue">{count} 部</Tag>
      ),
    },
    {
      title: '人气值',
      dataIndex: 'popularity',
      width: 120,
      sorter: (a, b) => a.popularity - b.popularity,
      render: (popularity: number) => (
        <Space>
          <FireOutlined style={{ color: '#ff4d4f' }} />
          <span>{popularity.toLocaleString()}</span>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => viewActorDetail(record)}>
            详情
          </Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除此演员？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const workColumns: ColumnsType<ActorWork> = [
    {
      title: '封面',
      dataIndex: 'vod_pic',
      width: 80,
      render: (pic: string) => (
        <img src={pic} alt="" style={{ width: 50, height: 70, objectFit: 'cover' }} />
      ),
    },
    {
      title: '作品名称',
      dataIndex: 'vod_name',
      width: 200,
    },
    {
      title: '年份',
      dataIndex: 'vod_year',
      width: 80,
    },
    {
      title: '评分',
      dataIndex: 'vod_score',
      width: 80,
      render: (score: number) => score > 0 ? `⭐ ${score.toFixed(1)}` : '-',
    },
    {
      title: '角色',
      dataIndex: 'role_type',
      width: 80,
      render: (type: string) => {
        const config = {
          director: { text: '导演', color: 'gold' },
          actor: { text: '演员', color: 'blue' },
          writer: { text: '编剧', color: 'green' },
        }[type] || { text: type, color: 'default' };
        
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>演员管理</h2>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="演员总数"
              value={stats?.total || actors.length}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="有头像"
              value={stats?.withAvatar || 0}
              prefix={<PictureOutlined />}
              suffix={stats?.total ? `/ ${stats.total}` : ''}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="有作品"
              value={stats?.withWorks || 0}
              prefix={<FireOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总人气值"
              value={actors.reduce((sum, a) => sum + a.popularity, 0).toLocaleString()}
              prefix={<TrophyOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Search
            placeholder="搜索演员名称"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={searchActors}
            enterButton={<SearchOutlined />}
            style={{ width: 300 }}
          />
          <Popconfirm
            title="初始化数据库？"
            description="将创建演员扩展字段和文章表"
            onConfirm={handleMigrate}
          >
            <Button icon={<DatabaseOutlined />}>
              初始化数据库
            </Button>
          </Popconfirm>
          <Button 
            type="primary" 
            icon={<CloudDownloadOutlined />}
            onClick={() => {
              collectForm.setFieldsValue({
                apiUrl: 'https://cj.lziapi.com/api.php/provide/actor/',
                sourceName: '量子资源',
                page: 1,
                maxPages: 50,
                enrichLimit: 100,
              });
              setCollectModalVisible(true);
            }}
          >
            采集演员
          </Button>
          <Button onClick={rebuildActors}>
            重建演员关联
          </Button>
        </Space>
      </Card>

      {/* 演员列表 */}
      <Card
        extra={
          selectedActors.length >= 2 && (
            <Button type="primary" onClick={handleMerge}>
              合并选中 ({selectedActors.length})
            </Button>
          )
        }
      >
        <Table
          columns={columns}
          dataSource={actors}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 50 }}
          rowSelection={{
            selectedRowKeys: selectedActors,
            onChange: (keys) => setSelectedActors(keys as number[]),
          }}
        />
      </Card>

      {/* 演员详情弹窗 */}
      <Modal
        title={`${currentActor?.name} - 作品列表`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={900}
        footer={null}
      >
        {currentActor && (
          <div>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* 演员信息 */}
              <Card size="small">
                <Space size="large">
                  <Avatar size={64} icon={<UserOutlined />} src={currentActor.avatar} />
                  <div>
                    <h3>{currentActor.name}</h3>
                    {currentActor.name_en && <p style={{ color: '#999' }}>{currentActor.name_en}</p>}
                    <Space>
                      <Tag color="blue">{currentActor.works_count} 部作品</Tag>
                      <Tag color="red">人气 {currentActor.popularity.toLocaleString()}</Tag>
                    </Space>
                  </div>
                </Space>
                {currentActor.bio && (
                  <p style={{ marginTop: 16, color: '#666' }}>{currentActor.bio}</p>
                )}
              </Card>

              {/* 作品列表 */}
              <Table
                columns={workColumns}
                dataSource={actorWorks}
                rowKey="vod_id"
                pagination={{ pageSize: 10 }}
                size="small"
              />
            </Space>
          </div>
        )}
      </Modal>

      {/* 编辑演员弹窗 */}
      <Modal
        title="编辑演员"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleSaveEdit}
        okText="保存"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item label="姓名" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="英文名" name="name_en">
            <Input />
          </Form.Item>
          <Form.Item label="头像URL" name="avatar">
            <Input />
          </Form.Item>
          <Form.Item label="简介" name="bio">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 合并演员弹窗 */}
      <Modal
        title="合并演员"
        open={mergeModalVisible}
        onCancel={() => setMergeModalVisible(false)}
        footer={null}
      >
        <Alert
          message="选择要保留的演员"
          description="其他演员的作品将合并到选中的演员，然后删除其他演员"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Space direction="vertical" style={{ width: '100%' }}>
          {actors.filter(a => selectedActors.includes(a.id)).map(actor => (
            <Card key={actor.id} size="small" hoverable onClick={() => doMerge(actor.id)}>
              <Space>
                <Avatar icon={<UserOutlined />} src={actor.avatar} />
                <div>
                  <div>{actor.name}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{actor.works_count} 部作品</div>
                </div>
              </Space>
            </Card>
          ))}
        </Space>
      </Modal>

      {/* 采集演员弹窗 */}
      <Modal
        title="采集演员"
        open={collectModalVisible}
        onCancel={() => setCollectModalVisible(false)}
        footer={null}
        width={600}
      >
        <Alert
          message="演员采集说明"
          description="采集会从资源站API获取演员详细信息（头像、简介等），并自动匹配已有演员进行补充。"
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
            <Input placeholder="https://cj.lziapi.com/api.php/provide/actor/" />
          </Form.Item>
          <Form.Item label="来源名称" name="sourceName">
            <Input placeholder="量子资源" />
          </Form.Item>
          
          <Tabs
            items={[
              {
                key: 'collect',
                label: '全量采集',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="起始页" name="page">
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="最大页数" name="maxPages">
                          <InputNumber min={1} max={500} style={{ width: '100%' }} />
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
                  </Space>
                ),
              },
              {
                key: 'enrich',
                label: '补充详情',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Alert
                      message="为已有演员（从视频中提取的）补充头像、简介等详细信息"
                      type="warning"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                    <Form.Item label="补充数量" name="enrichLimit">
                      <InputNumber min={1} max={500} style={{ width: '100%' }} />
                    </Form.Item>
                    <Button 
                      type="primary" 
                      block 
                      loading={collecting}
                      onClick={handleEnrich}
                    >
                      开始补充
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        </Form>
      </Modal>
    </div>
  );
};

export default ActorManagement;
