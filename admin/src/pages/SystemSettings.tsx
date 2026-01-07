/**
 * System Settings Page
 * 系统设置页面 - 增强版
 */

import { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Form,
  Input,
  Button,
  message,
  Space,
  Tag,
  Switch,
  Row,
  Col,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  SaveOutlined,
  SettingOutlined,
  SafetyOutlined,
  NotificationOutlined,
  AppstoreOutlined,
  ShareAltOutlined,
  DeleteOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Popconfirm } from 'antd';
import {
  getHotSearch,
  updateHotSearch,
  updateContactConfig,
  updateMarqueeConfig,
  updateWelfareSwitch,
  updateMarqueeSwitch,
  updateHotSearchSwitch,
  updateAdsSwitch,
  getSystemConfig,
  getAllConfig,
  batchUpdateConfig,
  toggleConfigSwitch,
  getShareConfig,
  updateShareConfig,
  clearVideos,
} from '../services/adminApi';

const { Title, Text } = Typography;

const SystemSettings: React.FC = () => {
  const [contactForm] = Form.useForm();
  const [marqueeForm] = Form.useForm();
  const [appForm] = Form.useForm();
  const [shareForm] = Form.useForm();
  
  const [loading, setLoading] = useState(false);
  const [hotKeywords, setHotKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [permanentUrls, setPermanentUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  
  // 开关状态
  const [switches, setSwitches] = useState({
    marquee_enabled: false,
    hot_search_enabled: false,
    welfare_enabled: false,
    ads_enabled: false,
    register_enabled: true,
    comment_enabled: true,
    danmaku_enabled: true,
    download_enabled: true,
    vip_enabled: false,
    maintenance_mode: false,
  });

  // 加载热搜关键词
  const loadHotSearch = async () => {
    try {
      const keywords = await getHotSearch();
      setHotKeywords(keywords);
    } catch (error: any) {
      message.error(error.message || '加载热搜关键词失败');
    }
  };

  // 添加热搜关键词
  const handleAddKeyword = () => {
    if (!newKeyword.trim()) {
      message.warning('请输入关键词');
      return;
    }
    if (hotKeywords.includes(newKeyword.trim())) {
      message.warning('关键词已存在');
      return;
    }
    setHotKeywords([...hotKeywords, newKeyword.trim()]);
    setNewKeyword('');
  };

  // 删除热搜关键词
  const handleRemoveKeyword = (keyword: string) => {
    setHotKeywords(hotKeywords.filter((k) => k !== keyword));
  };

  // 保存热搜关键词
  const handleSaveHotSearch = async () => {
    setLoading(true);
    try {
      await updateHotSearch(hotKeywords);
      message.success('热搜关键词保存成功');
    } catch (error: any) {
      message.error(error.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 保存联系方式配置
  const handleSaveContact = async () => {
    try {
      const values = await contactForm.validateFields();
      setLoading(true);
      await updateContactConfig(values.customer_service, values.official_group);
      message.success('联系方式配置保存成功');
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 保存滚动通告配置
  const handleSaveMarquee = async () => {
    try {
      const values = await marqueeForm.validateFields();
      setLoading(true);
      await updateMarqueeConfig(values.marquee_text, values.marquee_link);
      message.success('滚动通告配置保存成功');
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 切换开关
  const handleSwitchChange = async (key: string, enabled: boolean) => {
    setLoading(true);
    try {
      // 使用对应的 API
      switch (key) {
        case 'marquee_enabled':
          await updateMarqueeSwitch(enabled);
          break;
        case 'hot_search_enabled':
          await updateHotSearchSwitch(enabled);
          break;
        case 'welfare_enabled':
          await updateWelfareSwitch(enabled);
          break;
        case 'ads_enabled':
          await updateAdsSwitch(enabled);
          break;
        default:
          await toggleConfigSwitch(key, enabled);
      }
      setSwitches(prev => ({ ...prev, [key]: enabled }));
      message.success(`${enabled ? '已开启' : '已关闭'}`);
    } catch (error: any) {
      message.error(error.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载永久网址
  const loadPermanentUrls = async () => {
    try {
      const { getPermanentUrls } = await import('../services/adminApi');
      const urls = await getPermanentUrls();
      setPermanentUrls(urls);
    } catch (error: any) {
      message.error(error.message || '加载永久网址失败');
    }
  };

  // 添加永久网址
  const handleAddUrl = () => {
    if (!newUrl.trim()) {
      message.warning('请输入网址');
      return;
    }
    try {
      new URL(newUrl.trim());
    } catch {
      message.error('请输入有效的URL（如：https://example.com）');
      return;
    }
    if (permanentUrls.includes(newUrl.trim())) {
      message.warning('网址已存在');
      return;
    }
    setPermanentUrls([...permanentUrls, newUrl.trim()]);
    setNewUrl('');
  };

  // 删除永久网址
  const handleRemoveUrl = (url: string) => {
    setPermanentUrls(permanentUrls.filter((u) => u !== url));
  };

  // 保存永久网址
  const handleSavePermanentUrls = async () => {
    setLoading(true);
    try {
      const { updatePermanentUrls } = await import('../services/adminApi');
      await updatePermanentUrls(permanentUrls);
      message.success('永久网址保存成功');
    } catch (error: any) {
      message.error(error.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 保存APP配置
  const handleSaveAppConfig = async () => {
    try {
      const values = await appForm.validateFields();
      setLoading(true);
      await batchUpdateConfig({
        app_name: values.app_name,
        app_logo: values.app_logo,
        app_slogan: values.app_slogan,
      });
      message.success('APP配置保存成功');
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载分享配置
  const loadShareConfig = async () => {
    try {
      const config = await getShareConfig();
      shareForm.setFieldsValue({
        download_url: config.download_url || '',
        share_title: config.share_title || '',
        share_description: config.share_description || '',
      });
    } catch (error: any) {
      console.error('加载分享配置失败:', error);
    }
  };

  // 保存分享配置
  const handleSaveShareConfig = async () => {
    try {
      const values = await shareForm.validateFields();
      setLoading(true);
      await updateShareConfig(values);
      message.success('分享配置保存成功');
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载系统配置
  const loadSystemConfig = async () => {
    try {
      const config = await getSystemConfig();
      
      // 设置跑马灯配置
      marqueeForm.setFieldsValue({
        marquee_text: config.marquee_text || '',
        marquee_link: config.marquee_link || '',
      });
      
      // 设置联系方式配置
      contactForm.setFieldsValue({
        customer_service: config.customer_service || '',
        official_group: config.official_group || '',
      });
      
      // 设置开关状态
      setSwitches(prev => ({
        ...prev,
        marquee_enabled: config.marquee_enabled || false,
        hot_search_enabled: config.hot_search_enabled || false,
        welfare_enabled: config.welfare_enabled || false,
        ads_enabled: config.ads_enabled || false,
      }));

      // 尝试加载更多配置
      try {
        const allConfig = await getAllConfig();
        setSwitches(prev => ({
          ...prev,
          register_enabled: allConfig.register_enabled !== false,
          comment_enabled: allConfig.comment_enabled !== false,
          danmaku_enabled: allConfig.danmaku_enabled !== false,
          download_enabled: allConfig.download_enabled !== false,
          vip_enabled: allConfig.vip_enabled || false,
          maintenance_mode: allConfig.maintenance_mode || false,
        }));
        appForm.setFieldsValue({
          app_name: allConfig.app_name || '拾光影视',
          app_logo: allConfig.app_logo || '',
          app_slogan: allConfig.app_slogan || '',
        });
      } catch { /* 新配置可能不存在 */ }
    } catch (error: any) {
      message.error(error.message || '加载系统配置失败');
    }
  };

  useEffect(() => {
    loadHotSearch();
    loadPermanentUrls();
    loadSystemConfig();
    loadShareConfig();
  }, []);

  // 开关配置项
  const switchItems = [
    { key: 'marquee_enabled', label: '跑马灯通告', desc: '首页滚动通告' },
    { key: 'hot_search_enabled', label: '热搜关键词', desc: '搜索页热搜推荐' },
    { key: 'welfare_enabled', label: '福利频道', desc: '显示福利频道入口' },
    { key: 'ads_enabled', label: '全局广告', desc: '显示所有广告内容' },
  ];

  const advancedSwitchItems = [
    { key: 'register_enabled', label: '用户注册', desc: '允许新用户注册' },
    { key: 'comment_enabled', label: '评论功能', desc: '允许用户发表评论' },
    { key: 'danmaku_enabled', label: '弹幕功能', desc: '允许发送弹幕' },
    { key: 'download_enabled', label: '离线下载', desc: '允许下载视频' },
    { key: 'vip_enabled', label: 'VIP功能', desc: '启用VIP会员系统' },
    { key: 'maintenance_mode', label: '维护模式', desc: '开启后APP显示维护页面', danger: true },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>系统设置</Title>

      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 功能开关 */}
        <Card title={<><SettingOutlined /> 功能开关</>}>
          <Row gutter={[24, 16]}>
            {switchItems.map(item => (
              <Col span={6} key={item.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>{item.label}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.desc}</Text>
                  </div>
                  <Switch
                    checked={switches[item.key as keyof typeof switches]}
                    onChange={(checked) => handleSwitchChange(item.key, checked)}
                    loading={loading}
                  />
                </div>
              </Col>
            ))}
          </Row>
        </Card>

        {/* 高级开关 */}
        <Card title={<><SafetyOutlined /> 高级设置</>}>
          <Alert
            message="以下设置会影响APP核心功能，请谨慎操作"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Row gutter={[24, 16]}>
            {advancedSwitchItems.map(item => (
              <Col span={6} key={item.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong style={{ color: item.danger ? '#ff4d4f' : undefined }}>{item.label}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.desc}</Text>
                  </div>
                  <Switch
                    checked={switches[item.key as keyof typeof switches]}
                    onChange={(checked) => handleSwitchChange(item.key, checked)}
                    loading={loading}
                  />
                </div>
              </Col>
            ))}
          </Row>
        </Card>

        {/* APP基本配置 */}
        <Card title={<><AppstoreOutlined /> APP配置</>}>
          <Form form={appForm} layout="vertical">
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="APP名称" name="app_name">
                  <Input placeholder="拾光影视" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="APP Logo URL" name="app_logo">
                  <Input placeholder="https://example.com/logo.png" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="APP标语" name="app_slogan">
                  <Input placeholder="发现好电影" />
                </Form.Item>
              </Col>
            </Row>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveAppConfig} loading={loading}>
              保存APP配置
            </Button>
          </Form>
        </Card>

        {/* 热搜关键词配置 */}
        <Card title="热搜关键词配置">
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Text type="secondary">配置搜索页面显示的热搜关键词，用户点击可快速搜索</Text>
            
            <Space wrap>
              {hotKeywords.map((keyword, index) => (
                <Tag key={index} closable onClose={() => handleRemoveKeyword(keyword)} color="blue">
                  {keyword}
                </Tag>
              ))}
            </Space>

            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="输入关键词"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onPressEnter={handleAddKeyword}
                maxLength={20}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddKeyword}>
                添加
              </Button>
            </Space.Compact>

            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveHotSearch} loading={loading}>
              保存热搜关键词
            </Button>
          </Space>
        </Card>

        {/* 分享配置 */}
        <Card title={<><ShareAltOutlined /> 分享配置</>}>
          <Form form={shareForm} layout="vertical">
            <Alert
              message="分享功能说明"
              description="用户分享视频时会生成二维码，其他用户扫码后：已安装APP则直接打开播放，未安装则显示下载引导页面。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item 
                  label="APP下载地址" 
                  name="download_url"
                  rules={[{ type: 'url', message: '请输入有效的URL' }]}
                  help="用户扫码后未安装APP时的下载链接"
                >
                  <Input placeholder="https://example.com/download" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item 
                  label="分享标题" 
                  name="share_title"
                  help="分享落地页的默认标题"
                >
                  <Input placeholder="拾光影视 - 精彩影视，尽在掌握" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item 
                  label="分享描述" 
                  name="share_description"
                  help="分享落地页的默认描述"
                >
                  <Input placeholder="海量影视资源，高清流畅播放" />
                </Form.Item>
              </Col>
            </Row>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveShareConfig} loading={loading}>
              保存分享配置
            </Button>
          </Form>
        </Card>

        {/* 联系方式配置 */}
        <Card title="联系方式配置">
          <Form form={contactForm} layout="vertical">
            <Form.Item label="客服联系方式" name="customer_service" help="用户可在个人中心查看">
              <Input placeholder="QQ: 123456789 或 微信: example" />
            </Form.Item>
            <Form.Item label="官方群组链接" name="official_group" rules={[{ type: 'url', message: '请输入有效的URL' }]} help="用户点击后跳转到群组">
              <Input placeholder="https://qm.qq.com/..." />
            </Form.Item>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveContact} loading={loading}>
              保存联系方式
            </Button>
          </Form>
        </Card>

        {/* 滚动通告配置 */}
        <Card title={<><NotificationOutlined /> 滚动通告配置</>}>
          <Form form={marqueeForm} layout="vertical">
            <Form.Item label="通告文本" name="marquee_text" help="显示在首页轮播图下方的滚动通告">
              <Input placeholder="欢迎使用拾光影视！" maxLength={200} disabled={!switches.marquee_enabled} />
            </Form.Item>
            <Form.Item label="跳转链接" name="marquee_link" rules={[{ type: 'url', message: '请输入有效的URL' }]} help="用户点击通告后跳转的链接（可选）">
              <Input placeholder="https://example.com" disabled={!switches.marquee_enabled} />
            </Form.Item>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveMarquee} loading={loading} disabled={!switches.marquee_enabled}>
              保存通告配置
            </Button>
          </Form>
        </Card>

        {/* 钉钉通知配置 */}
        <Card title="钉钉通知配置">
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Text type="secondary">配置钉钉机器人Webhook，接收系统告警和重要通知</Text>

            <Form.Item label="Webhook地址">
              <Input.TextArea
                placeholder="https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN"
                rows={3}
                value={permanentUrls[0] || ''}
                onChange={(e) => {
                  const newUrls = [...permanentUrls];
                  newUrls[0] = e.target.value;
                  setPermanentUrls(newUrls);
                }}
              />
            </Form.Item>

            <Alert
              message="配置说明"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>在钉钉群中创建自定义机器人</li>
                  <li>复制机器人的Webhook地址</li>
                  <li>建议设置安全设置（关键词或IP白名单）</li>
                  <li>配置后将接收：崩溃报告、用户反馈、采集告警等通知</li>
                </ul>
              }
              type="info"
              showIcon
            />

            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const { updateDingTalkWebhook } = await import('../services/adminApi');
                    await updateDingTalkWebhook(permanentUrls[0] || '');
                    message.success('钉钉配置保存成功');
                  } catch (error: any) {
                    message.error(error.message || '保存失败');
                  } finally {
                    setLoading(false);
                  }
                }}
                loading={loading}
              >
                保存配置
              </Button>
              <Button
                onClick={async () => {
                  if (!permanentUrls[0]) {
                    message.warning('请先配置Webhook地址');
                    return;
                  }
                  setLoading(true);
                  try {
                    const { testDingTalk } = await import('../services/adminApi');
                    await testDingTalk();
                    message.success('测试消息已发送，请查看钉钉群');
                  } catch (error: any) {
                    message.error(error.message || '测试失败');
                  } finally {
                    setLoading(false);
                  }
                }}
                loading={loading}
              >
                发送测试消息
              </Button>
            </Space>
          </Space>
        </Card>

        {/* TVBox接口配置 */}
        <Card title="TVBox接口配置">
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Text strong>JSON接口地址：</Text>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  value={`${window.location.origin}/api.php/provide/vod`}
                  readOnly
                  style={{ flex: 1 }}
                />
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/api.php/provide/vod`);
                    message.success('已复制到剪贴板');
                  }}
                >
                  复制
                </Button>
              </Space.Compact>
            </div>
            
            <div>
              <Text strong>XML接口地址：</Text>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  value={`${window.location.origin}/api.php/provide/vod/at/xml`}
                  readOnly
                  style={{ flex: 1 }}
                />
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/api.php/provide/vod/at/xml`);
                    message.success('已复制到剪贴板');
                  }}
                >
                  复制
                </Button>
              </Space.Compact>
            </div>

            <Alert
              message="使用说明"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>将接口地址添加到TVBox配置文件中</li>
                  <li>支持标准苹果CMS参数：ac、t、pg、wd、ids等</li>
                  <li>同时支持JSON和XML两种格式</li>
                  <li>兼容主流TVBox客户端</li>
                </ul>
              }
              type="info"
              showIcon
            />

            <Button
              onClick={async () => {
                setLoading(true);
                try {
                  const response = await fetch('/api.php/provide/vod?ac=list&t=1&pg=1');
                  const data = await response.json();
                  if (data.code === 1) {
                    message.success(`接口测试成功！返回 ${data.total} 个视频`);
                  } else {
                    message.error('接口测试失败');
                  }
                } catch (error) {
                  message.error('接口测试失败');
                } finally {
                  setLoading(false);
                }
              }}
              loading={loading}
            >
              测试接口
            </Button>
          </Space>
        </Card>

        {/* 永久网址配置 */}
        <Card title="永久网址配置">
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Text type="secondary">配置 APP 的备用访问域名，用户可在个人中心查看</Text>
            
            <Space wrap>
              {permanentUrls.slice(1).map((url, index) => (
                <Tag key={index} closable onClose={() => handleRemoveUrl(url)} color="green">
                  {url}
                </Tag>
              ))}
            </Space>

            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="输入域名（如：https://example.com）"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onPressEnter={handleAddUrl}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddUrl}>
                添加
              </Button>
            </Space.Compact>

            <Button type="primary" icon={<SaveOutlined />} onClick={handleSavePermanentUrls} loading={loading}>
              保存永久网址
            </Button>
          </Space>
        </Card>

        {/* 危险操作 */}
        <Card 
          title={<><WarningOutlined style={{ color: '#ff4d4f' }} /> 危险操作</>}
          style={{ borderColor: '#ff4d4f' }}
        >
          <Alert
            message="警告"
            description="以下操作不可恢复，请谨慎操作！建议在执行前先备份数据。"
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div>
                <Text strong>清空所有视频数据</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>删除 vod_cache 表中的所有视频数据，清空后需要重新采集</Text>
              </div>
              <Popconfirm
                title="确定要清空所有视频数据吗？"
                description="此操作将删除所有视频数据，不可恢复！"
                onConfirm={async () => {
                  setLoading(true);
                  try {
                    const result = await clearVideos();
                    message.success(`清空完成！已删除 ${result.deleted} 个视频`);
                  } catch (error: any) {
                    message.error(error.message || '清空失败');
                  } finally {
                    setLoading(false);
                  }
                }}
                okText="确定清空"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<DeleteOutlined />} loading={loading}>
                  清空所有视频
                </Button>
              </Popconfirm>
            </div>
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default SystemSettings;
