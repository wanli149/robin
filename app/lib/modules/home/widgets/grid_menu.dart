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
      padding: const EdgeInsets.symmetric(vertical: 12),
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
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          childAspectRatio: 1.0,
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
    final iconUrl = item['icon_url'] as String? ?? '';
    final iconData = item['icon'] as String? ?? '';
    final label = item['label'] as String? ?? '';
    final jumpAction = item['jump_action'] as String? ?? '';

    return GestureDetector(
      onTap: () {
        if (jumpAction.isNotEmpty) {
          UniversalRouter.handleRoute(jumpAction);
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // 图标
            Expanded(
              child: _buildIcon(iconUrl, iconData),
            ),
            
            const SizedBox(height: 6),
            
            // 标签
            Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                color: Colors.white70,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  /// 构建图标
  Widget _buildIcon(String iconUrl, String iconData) {
    // 如果有图标 URL，显示网络图片
    if (iconUrl.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.network(
          iconUrl,
          width: 48,
          height: 48,
          fit: BoxFit.cover,
          loadingBuilder: (context, child, loadingProgress) {
            if (loadingProgress == null) return child;
            
            return Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFF2E2E2E),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      Color(0xFFFFC107),
                    ),
                  ),
                ),
              ),
            );
          },
          errorBuilder: (context, error, stackTrace) {
            return _buildDefaultIcon(iconData);
          },
        ),
      );
    }

    // 否则显示默认图标
    return _buildDefaultIcon(iconData);
  }

  /// 构建默认图标
  Widget _buildDefaultIcon(String iconData) {
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
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: const Color(0xFFFFC107).withOpacity(0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(
        icon,
        size: 28,
        color: const Color(0xFFFFC107),
      ),
    );
  }
}
