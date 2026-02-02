/**
 * Ad Modal Component
 * 广告创建/编辑弹窗 - 增强版
 */

import { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, InputNumber, DatePicker, Switch, Row, Col } from 'antd';
import { useNotification } from './providers';
import dayjs from 'dayjs';

interface AdModalProps {
  visible: boolean;
  ad: any | null;
  onCancel: () => void;
  onSave: (values: any) => Promise<void>;
}

const LOCATION_OPTIONS = [
  { value: 'splash', label: '开屏广告' },
  { value: 'banner_home', label: '首页横幅' },
  { value: 'banner_module', label: '横幅模块（布局编辑器）' },
  { value: 'insert_grid', label: '网格插入' },
  { value: 'shorts_insert', label: '短剧插播' },
  { value: 'pause_overlay', label: '暂停贴片' },
  { value: 'video_pre', label: '视频前贴' },
  { value: 'video_mid', label: '视频中贴' },
  { value: 'video_post', label: '视频后贴' },
];

const AdModal: React.FC<AdModalProps> = ({ visible, ad, onCancel, onSave }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>('');
  const { warning } = useNotification();

  useEffect(() => {
    if (visible && ad) {
      form.setFieldsValue({
        ...ad,
        start_time: ad.start_time ? dayjs(ad.start_time * 1000) : null,
        end_time: ad.end_time ? dayjs(ad.end_time * 1000) : null,
      });
      if (ad.media_url) setPreviewImage(ad.media_url);
    } else if (visible) {
      form.resetFields();
      setPreviewImage('');
    }
  }, [visible, ad, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      // 转换时间戳
      const submitValues = {
        ...values,
        id: ad?.id,
        start_time: values.start_time ? Math.floor(values.start_time.valueOf() / 1000) : null,
        end_time: values.end_time ? Math.floor(values.end_time.valueOf() / 1000) : null,
      };
      
      await onSave(submitValues);
      form.resetFields();
      setPreviewImage('');
    } catch (error) {
      logger.admin.error('Validation failed:', { error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={ad ? '编辑广告' : '添加广告'}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      width={700}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ weight: 1, content_type: 'image', action_type: 'browser', daily_limit: 0, is_active: true }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="广告名称" name="name">
              <Input placeholder="便于识别的名称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="广告位置" name="location" rules={[{ required: true, message: '请选择广告位置' }]}>
              <Select placeholder="选择广告位置" options={LOCATION_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="内容类型" name="content_type" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="image">图片</Select.Option>
                <Select.Option value="video">视频</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="跳转类型" name="action_type" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="browser">外部浏览器</Select.Option>
                <Select.Option value="webview">内置WebView</Select.Option>
                <Select.Option value="deeplink">应用内跳转</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="素材URL" name="media_url" rules={[{ required: true, message: '请输入素材URL' }]}>
          <Input placeholder="https://example.com/ad.jpg" onChange={(e) => setPreviewImage(e.target.value)} />
        </Form.Item>

        {previewImage && (
          <Form.Item label="素材预览">
            <img
              src={previewImage}
              alt="预览"
              style={{ maxWidth: '100%', maxHeight: 150, objectFit: 'contain', border: '1px solid #d9d9d9', borderRadius: 4 }}
              onError={() => { warning('图片加载失败'); setPreviewImage(''); }}
            />
          </Form.Item>
        )}

        <Form.Item label="跳转地址" name="action_url" rules={[{ required: true, message: '请输入跳转地址' }]}>
          <Input placeholder="https://example.com 或 video://123" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="权重" name="weight" rules={[{ required: true }]} help="权重越高，展示概率越大">
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="每日展示上限" name="daily_limit" help="0表示不限制">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="启用状态" name="is_active" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="开始时间" name="start_time" help="不设置则立即开始">
              <DatePicker showTime style={{ width: '100%' }} placeholder="选择开始时间" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="结束时间" name="end_time" help="不设置则长期有效">
              <DatePicker showTime style={{ width: '100%' }} placeholder="选择结束时间" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="备注" name="remark">
          <Input.TextArea rows={2} placeholder="广告备注信息" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AdModal;
