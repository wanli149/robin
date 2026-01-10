import 'package:flutter/material.dart';
import '../../../core/router.dart';

/// 金刚区网格菜单组件
/// 显示图标和文字的网格布局，支持点击跳转
class GridMenu extends StatelessWidget {
  final List<Map<String, dynamic>> items;
  final int crossAxisCount;
  final double itemHeight;

  const GridMenu({
    super.key,
    required this.items,
    this.crossAxisCount = 5,
    this.itemHeight = 80,
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(12),
      ),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: crossAxisCount,
          mainAxisSpacing: 12,
          crossAxisSpacing: 4,
          childAspectRatio: 0.75, // 宽高比，给标签留空间
        ),
        itemCount: items.length,
        itemBuilder: (context, index) {
          return _buildMenuItem(items[index]);
        },
      ),
    );
  }

  /// 构建菜单项
  Widget _buildMenuItem(Map<String, dynamic> item) {
    // 兼容多种字段名
    final iconUrl = item['icon_url'] as String? ?? '';
    final iconData = item['icon'] as String? ?? '';
    final iconType = item['icon_type'] as String? ?? '';
    final label = item['label'] as String? ?? '';
    final target = item['target'] as String? ?? item['jump_action'] as String? ?? '';

    // 根据 icon_type 判断图标类型
    String effectiveIconUrl = iconUrl;
    String effectiveIconData = iconData;
    
    if (iconType == 'url' && iconData.startsWith('http')) {
      effectiveIconUrl = iconData;
      effectiveIconData = '';
    } else if (iconType == 'emoji' || _isEmoji(iconData)) {
      effectiveIconUrl = '';
      effectiveIconData = iconData;
    }

    return GestureDetector(
      onTap: () {
        if (target.isNotEmpty) {
          UniversalRouter.handleRoute(target);
        }
      },
      child: Column(
        mainAxisAlignment: MainAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // 图标
          _buildIcon(effectiveIconUrl, effectiveIconData),
          
          const SizedBox(height: 6),
          
          // 标签
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: Colors.white70,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  /// 构建图标
  Widget _buildIcon(String iconUrl, String iconData) {
    const double containerSize = 48.0;
    
    // 如果有图标 URL，显示网络图片
    if (iconUrl.isNotEmpty) {
      return Container(
        width: containerSize,
        height: containerSize,
        decoration: BoxDecoration(
          color: const Color(0xFF2A2A2A),
          borderRadius: BorderRadius.circular(12),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.network(
            iconUrl,
            width: containerSize,
            height: containerSize,
            fit: BoxFit.cover,
            loadingBuilder: (context, child, loadingProgress) {
              if (loadingProgress == null) return child;
              
              return const Center(
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      Color(0xFFFFC107),
                    ),
                  ),
                ),
              );
            },
            errorBuilder: (context, error, stackTrace) {
              return _buildDefaultIcon(iconData);
            },
          ),
        ),
      );
    }

    // 检查是否是 emoji
    if (iconData.isNotEmpty && _isEmoji(iconData)) {
      return Container(
        width: containerSize,
        height: containerSize,
        decoration: BoxDecoration(
          color: const Color(0xFF2A2A2A),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Center(
          child: Text(
            iconData,
            style: const TextStyle(
              fontSize: 24,
              height: 1.0,
            ),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    // 否则显示默认图标
    return _buildDefaultIcon(iconData);
  }

  /// 检查是否是 emoji
  bool _isEmoji(String text) {
    if (text.isEmpty) return false;
    // emoji 通常是非 ASCII 字符
    final runes = text.runes;
    if (runes.isEmpty) return false;
    // 检查第一个字符是否在 emoji 范围内
    final firstRune = runes.first;
    return firstRune > 127; // 非 ASCII 字符
  }

  /// 构建默认图标
  Widget _buildDefaultIcon(String iconData) {
    const double containerSize = 48.0;
    IconData icon;
    
    // 根据 iconData 字符串映射到对应的图标
    switch (iconData.toLowerCase()) {
      case 'movie':
      case 'video':
        icon = Icons.movie;
        break;
      case 'tv':
      case 'series':
        icon = Icons.tv;
        break;
      case 'search':
        icon = Icons.search;
        break;
      case 'favorite':
      case 'heart':
        icon = Icons.favorite;
        break;
      case 'history':
        icon = Icons.history;
        break;
      case 'download':
        icon = Icons.download;
        break;
      case 'settings':
        icon = Icons.settings;
        break;
      case 'star':
        icon = Icons.star;
        break;
      case 'play':
        icon = Icons.play_circle_outline;
        break;
      case 'category':
        icon = Icons.category;
        break;
      case 'trending':
        icon = Icons.trending_up;
        break;
      case 'new':
        icon = Icons.fiber_new;
        break;
      case 'hot':
        icon = Icons.local_fire_department;
        break;
      case 'calendar':
        icon = Icons.calendar_today;
        break;
      case 'person':
      case 'user':
        icon = Icons.person;
        break;
      default:
        icon = Icons.apps;
    }

    return Container(
      width: containerSize,
      height: containerSize,
      decoration: BoxDecoration(
        color: const Color(0xFF2A2A2A),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Icon(
        icon,
        size: 24,
        color: const Color(0xFFFFC107),
      ),
    );
  }
}
