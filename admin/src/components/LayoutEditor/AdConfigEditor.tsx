/**
 * 广告配置可视化编辑器（增强版）
 * 用于配置广告插入位置、类型、显示条件等
 * 支持从广告库选择已有广告
 */

import React, { useEffect, useState } from 'react';
import { InputNumber, Space, Typography, Switch, Radio, Select, Checkbox, Divider, Spin } from 'antd';
import { getAdsSimple } from '../../services/adminApi';

const { Text } = Typography;
const { Option } = Select;

interface AdItem {
  id: number;
  name: string;
  location: string;
  media_url: string;
}

interface AdConfigEditorProps {
  value?: any;
  onChange?: (value: any) => void;
}

const AdConfigEditor: React.FC<AdConfigEditorProps> = ({ value, onChange }) => {
  const safeValue = value || {};
  const [adList, setAdList] = useState<AdItem[]>([]);
  const [loadingAds, setLoadingAds] = useState(false);

  // 加载广告库列表
  useEffect(() => {
    const loadAds = async () => {
      setLoadingAds(true);
      try {
        const data = await getAdsSimple('insert_grid');
        setAdList(data);
      } catch (error) {
        logger.admin.error('Failed to load ads:', { error });
      } finally {
        setLoadingAds(false);
      }
    };
    loadAds();
  }, []);
  
  const handleChange = (field: string, fieldValue: any) => {
    const newValue = { ...safeValue, [field]: fieldValue };
    onChange?.(newValue);
  };

  const handleEnableChange = (enabled: boolean) => {
    if (!enabled) {
      onChange?.(null);
    } else {
      onChange?.({ 
        enabled: true,
        strategy: 'interval',
        interval: 3,
        ad_type: 'native',
        vip_filter: true,
      });
    }
  };

  const isEnabled = value !== null && value !== undefined && value.enabled !== false;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <div>
        <Space>
          <Switch 
            checked={isEnabled} 
            onChange={handleEnableChange}
          />
          <Text strong>启用广告</Text>
        </Space>
      </div>

      {isEnabled && (
        <>
          {/* 插入策略 */}
          <div>
            <Text strong>插入策略</Text>
            <Radio.Group
              style={{ width: '100%', marginTop: 8 }}
              value={safeValue.strategy || 'interval'}
              onChange={(e) => handleChange('strategy', e.target.value)}
            >
              <Space direction="vertical">
                <Radio value="fixed">固定位置（在指定位置插入一次）</Radio>
                <Radio value="interval">间隔插入（每N个内容插入一次）</Radio>
              </Space>
            </Radio.Group>
          </div>

          {/* 根据策略显示不同配置 */}
          {safeValue.strategy === 'fixed' ? (
            <div>
              <Text>插入位置</Text>
              <InputNumber
                style={{ width: '100%', marginTop: 8 }}
                value={safeValue.insert_index || 4}
                onChange={(v) => handleChange('insert_index', v)}
                placeholder="例如：4"
                min={0}
                max={50}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                在第几个内容后插入广告（从0开始）
              </Text>
            </div>
          ) : (
            <div>
              <Text>插入间隔</Text>
              <InputNumber
                style={{ width: '100%', marginTop: 8 }}
                value={safeValue.interval || 3}
                onChange={(v) => handleChange('interval', v)}
                placeholder="例如：3"
                min={1}
                max={20}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                每隔几个内容插入一次广告
              </Text>
            </div>
          )}

          <Divider style={{ margin: '8px 0' }} />

          {/* 广告类型 */}
          <div>
            <Text strong>广告类型</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={safeValue.ad_type || 'native'}
              onChange={(v) => handleChange('ad_type', v)}
            >
              <Option value="native">信息流广告（混在内容中）</Option>
              <Option value="banner">Banner广告（横幅）</Option>
              <Option value="video">视频广告</Option>
            </Select>
          </div>

          {/* 广告源 */}
          <div>
            <Text strong>广告源</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={safeValue.ad_source || 'custom'}
              onChange={(v) => handleChange('ad_source', v)}
            >
              <Option value="pangle">穿山甲</Option>
              <Option value="gdt">优量汇</Option>
              <Option value="admob">AdMob</Option>
              <Option value="custom">自定义</Option>
            </Select>
          </div>

          {/* 广告ID - 支持从广告库选择 */}
          <div>
            <Text strong>广告位ID / 选择广告</Text>
            {safeValue.ad_source === 'custom' ? (
              <Spin spinning={loadingAds}>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.ad_id}
                  onChange={(v) => handleChange('ad_id', v)}
                  placeholder="从广告库选择"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                >
                  {adList.map(ad => (
                    <Option key={ad.id} value={ad.id}>
                      {ad.name || `广告${ad.id}`}
                    </Option>
                  ))}
                </Select>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  从广告管理中选择已创建的广告
                </Text>
              </Spin>
            ) : (
              <>
                <InputNumber
                  style={{ width: '100%', marginTop: 8 }}
                  value={safeValue.ad_id}
                  onChange={(v) => handleChange('ad_id', v)}
                  placeholder="输入广告位ID"
                  min={1}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  从广告平台获取的广告位ID
                </Text>
              </>
            )}
          </div>

          <Divider style={{ margin: '8px 0' }} />

          {/* 显示条件 */}
          <div>
            <Text strong>显示条件</Text>
            <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
              <Checkbox
                checked={safeValue.vip_filter !== false}
                onChange={(e) => handleChange('vip_filter', e.target.checked)}
              >
                仅对非VIP用户显示
              </Checkbox>
              <Checkbox
                checked={safeValue.daily_limit_enabled || false}
                onChange={(e) => {
                  handleChange('daily_limit_enabled', e.target.checked);
                  if (e.target.checked && !safeValue.daily_limit) {
                    handleChange('daily_limit', 10);
                  }
                }}
              >
                限制每日展示次数
              </Checkbox>
              {safeValue.daily_limit_enabled && (
                <InputNumber
                  style={{ width: '100%', marginLeft: 24 }}
                  value={safeValue.daily_limit || 10}
                  onChange={(v) => handleChange('daily_limit', v)}
                  placeholder="每日最多展示次数"
                  min={1}
                  max={100}
                  addonAfter="次/天"
                />
              )}
            </Space>
          </div>

          {/* 预览效果 */}
          <div>
            <Text strong>预览效果</Text>
            <div
              style={{
                marginTop: 8,
                padding: 12,
                background: '#f5f5f5',
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              {safeValue.strategy === 'interval' ? (
                <>
                  <div>📄 内容1</div>
                  <div>📄 内容2</div>
                  <div>📄 内容3</div>
                  <div style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                    📢 广告（每{safeValue.interval || 3}个插入）
                  </div>
                  <div>📄 内容4</div>
                  <div>📄 内容5</div>
                  <div>📄 内容6</div>
                  <div style={{ color: '#ff4d4f', fontWeight: 'bold' }}>📢 广告</div>
                </>
              ) : (
                <>
                  {Array.from({ length: safeValue.insert_index || 4 }).map((_, i) => (
                    <div key={i}>📄 内容{i + 1}</div>
                  ))}
                  <div style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                    📢 广告（固定位置）
                  </div>
                  <div>📄 内容{(safeValue.insert_index || 4) + 1}</div>
                  <div>📄 内容{(safeValue.insert_index || 4) + 2}</div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </Space>
  );
};

export default AdConfigEditor;
