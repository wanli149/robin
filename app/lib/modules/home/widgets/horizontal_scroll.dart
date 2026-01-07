import 'package:flutter/material.dart';
import '../../../core/router.dart';

/// 横向滚动组件
/// 视频卡片横向排列，可左右滑动
class HorizontalScroll extends StatelessWidget {
  final String title;
  final List<Map<String, dynamic>> items;
  final double itemWidth;
  final double itemHeight;
  final String? moreRoute;

  const HorizontalScroll({
    super.key,
    this.title = '',
    required this.items,
    this.itemWidth = 120,
    this.itemHeight = 180,
    this.moreRoute,
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 标题栏
          if (title.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
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
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  if (moreRoute != null)
                    GestureDetector(
                      onTap: () => UniversalRouter.handleRoute(moreRoute!),
                      child: const Row(
                        children: [
                          Text(
                            '更多',
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.white54,
                            ),
                          ),
                          Icon(
                            Icons.chevron_right,
                            size: 18,
                            color: Colors.white54,
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),

          const SizedBox(height: 12),

          // 横向滚动列表
          SizedBox(
            height: itemHeight + 40, // 额外空间给标题
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: items.length,
              itemBuilder: (context, index) {
                return Padding(
                  padding: EdgeInsets.only(
                    right: index < items.length - 1 ? 12 : 0,
                  ),
                  child: _buildVideoCard(items[index]),
                );
              },
            ),
          ),
        ],
      ),
    );
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
        if (vodId.isNotEmpty) {
          UniversalRouter.handleRoute('video://$vodId');
        }
      },
      child: SizedBox(
        width: itemWidth,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 封面图
            SizedBox(
              width: itemWidth,
              height: itemHeight,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    _buildImage(imageUrl),

                    // 备注标签
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

            const SizedBox(height: 6),

            // 标题
            Text(
              title,
              style: const TextStyle(
                fontSize: 12,
                color: Colors.white,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
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
          child: const Center(
            child: SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
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
