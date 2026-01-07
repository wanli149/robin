/**
 * Channel Selector Component
 * 频道选择器
 */

import { Menu } from 'antd';
import {
  StarOutlined,
  VideoCameraOutlined,
  PlaySquareOutlined,
  GlobalOutlined,
  ThunderboltOutlined,
  SmileOutlined,
  TrophyOutlined,
  HeartOutlined,
} from '@ant-design/icons';

interface ChannelSelectorProps {
  selectedTab: string;
  onTabChange: (tabId: string) => void;
}

const channels = [
  { id: 'featured', name: '精选', icon: <StarOutlined /> },
  { id: 'movie', name: '电影', icon: <VideoCameraOutlined /> },
  { id: 'series', name: '剧集', icon: <PlaySquareOutlined /> },
  { id: 'netflix', name: 'Netflix', icon: <GlobalOutlined /> },
  { id: 'shorts', name: '短剧', icon: <ThunderboltOutlined /> },
  { id: 'anime', name: '动漫', icon: <SmileOutlined /> },
  { id: 'variety', name: '综艺', icon: <TrophyOutlined /> },
  { id: 'welfare', name: '福利', icon: <HeartOutlined /> },
];

const ChannelSelector: React.FC<ChannelSelectorProps> = ({
  selectedTab,
  onTabChange,
}) => {
  const menuItems = channels.map((channel) => ({
    key: channel.id,
    icon: channel.icon,
    label: channel.name,
  }));

  return (
    <div>
      <div style={{ marginBottom: 16, fontWeight: 'bold', fontSize: 14 }}>
        选择频道
      </div>
      <Menu
        mode="inline"
        selectedKeys={[selectedTab]}
        items={menuItems}
        onClick={({ key }) => onTabChange(key)}
        style={{ border: 'none' }}
      />
    </div>
  );
};

export default ChannelSelector;
