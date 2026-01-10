import 'package:flutter/material.dart';
import '../../../core/router.dart';
import '../../../core/logger.dart';

/// 混合网格组件（带广告）
/// 3列网格布局，支持在指定位置插入广告
class MixedGrid extends StatelessWidget {
  final String title;
  final List<Map<String, dynamic>> items;
  final Map<String, dynamic>? adConfig;
  final int crossAxisCount;

  const MixedGrid({
    super.key,
    this.title = '',
    required this.items,
    this.adConfig,
    this.crossAxisCount = 3,
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const SizedBox.shrink();
    }

    // 处理广告注入
    final displayItems = _injectAds(items, adConfig);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 标题
          if (title.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Container(
                    width: 4,
                    height: 18,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFC107),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),

          // 网格
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: EdgeInsets.zero,
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: crossAxisCount,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 0.58, // 调整比例，给标题更多空间
            ),
            itemCount: displayItems.length,
            itemBuilder: (context, index) {
              final item = displayItems[index];
              final isAd = item['is_ad'] == true;

              return isAd
                  ? _buildAdCard(item)
                  : _buildVideoCard(item);
            },
          ),
        ],
      ),
    );
  }

  /// 注入广告
  List<Map<String, dynamic>> _injectAds(
    List<Map<String, dynamic>> items,
    Map<String, dynamic>? adConfig,
  ) {
    if (adConfig == null || adConfig['enable'] == false) {
      return items;
    }

    final insertIndex = adConfig['insert_index'] as int? ?? 4;
    final adData = adConfig['ad_data'] as Map<String, dynamic>?;

    if (adData == null || insertIndex >= items.length) {
      return items;
    }

    // 复制列表，移除最后一个视频，然后插入广告
    // 这样保持总数不变
    final result = List<Map<String, dynamic>>.from(items);
    if (result.isNotEmpty) {
      result.removeLast(); // 移除最后一个视频
    }
    result.insert(insertIndex, {
      ...adData,
      'is_ad': true,
    });

    return result;
  }

  /// 构建视频卡片
  Widget _buildVideoCard(Map<String, dynamic> item) {
    final imageUrl = item['vod_pic'] as String? ?? item['image_url'] as String? ?? '';
    final title = item['vod_name'] as String? ?? item['title'] as String? ?? '';
    final vodIdRaw = item['vod_id'];
    final vodId = vodIdRaw != null ? vodIdRaw.toString() : '';
    final remarks = item['vod_remarks'] as String? ?? '';

    return GestureDetector(
      onTap: () {
        Logger.debug('[MixedGrid] Card tapped! vodId: $vodId');
        if (vodId.isNotEmpty) {
          Logger.debug('[MixedGrid] Navigating to: video://$vodId');
          UniversalRouter.handleRoute('video://$vodId');
        } else {
          Logger.warning('[MixedGrid] vodId is empty!');
        }
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 封面图
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  _buildImage(imageUrl),

                  // 备注标签（更新至、HD等）
                  if (remarks.isNotEmpty)
                    Positioned(
                      top: 6,
                      right: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFC107),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          remarks,
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF121212),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 8),

          // 标题 - 固定高度，最多2行
          SizedBox(
            height: 36, // 固定高度确保一致性
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 13,
                color: Colors.white,
                height: 1.3,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  /// 构建广告卡片
  Widget _buildAdCard(Map<String, dynamic> adData) {
    final mediaUrl = adData['media_url'] as String? ?? '';
    final actionUrl = adData['action_url'] as String? ?? '';
    final actionType = adData['action_type'] as String? ?? 'browser';

    return GestureDetector(
      onTap: () {
        if (actionUrl.isNotEmpty) {
          // 根据 action_type 处理跳转
          switch (actionType) {
            case 'browser':
              UniversalRouter.handleRoute('browser://$actionUrl');
              break;
            case 'webview':
              UniversalRouter.handleRoute('webview://$actionUrl');
              break;
            case 'deeplink':
              UniversalRouter.handleRoute(actionUrl);
              break;
            default:
              UniversalRouter.handleRoute('browser://$actionUrl');
          }
        }
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          fit: StackFit.expand,
          children: [
            _buildImage(mediaUrl),

            // 广告标识
            Positioned(
              top: 6,
              left: 6,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 6,
                  vertical: 2,
                ),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  '广告',
                  style: TextStyle(
                    fontSize: 10,
                    color: Colors.white70,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 构建图片
  Widget _buildImage(String imageUrl) {
    if (imageUrl.isEmpty) {
      return Container(
        color: const Color(0xFF2E2E2E),
        child: const Center(
          child: Icon(
            Icons.image_not_supported,
            size: 32,
            color: Colors.white24,
          ),
        ),
      );
    }

    return Image.network(
      imageUrl,
      fit: BoxFit.cover,
      loadingBuilder: (context, child, loadingProgress) {
        if (loadingProgress == null) return child;

        return Container(
          color: const Color(0xFF2E2E2E),
          child: Center(
            child: SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                value: loadingProgress.expectedTotalBytes != null
                    ? loadingProgress.cumulativeBytesLoaded /
                        loadingProgress.expectedTotalBytes!
                    : null,
                strokeWidth: 2,
                valueColor: const AlwaysStoppedAnimation<Color>(
                  Color(0xFFFFC107),
                ),
              ),
            ),
          ),
        );
      },
      errorBuilder: (context, error, stackTrace) {
        return Container(
          color: const Color(0xFF2E2E2E),
          child: const Center(
            child: Icon(
              Icons.broken_image,
              size: 32,
              color: Colors.white24,
            ),
          ),
        );
      },
    );
  }
}
