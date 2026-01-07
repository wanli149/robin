import 'package:flutter/material.dart';
import '../../../core/router.dart';

/// 时间树组件
/// 时间在下、内容在上的横滑列表，用于显示上映时间和视频信息
class TimeTree extends StatelessWidget {
  final String title;
  final List<Map<String, dynamic>> items;

  const TimeTree({
    super.key,
    this.title = '',
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const SizedBox.shrink();
    }

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

          // 横滑列表
          SizedBox(
            height: 220,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.zero,
              itemCount: items.length,
              itemBuilder: (context, index) {
                return _buildTimeTreeItem(items[index], index == 0);
              },
            ),
          ),
        ],
      ),
    );
  }

  /// 构建时间树项
  Widget _buildTimeTreeItem(Map<String, dynamic> item, bool isFirst) {
    final imageUrl = item['vod_pic'] as String? ?? item['image_url'] as String? ?? '';
    final title = item['vod_name'] as String? ?? item['title'] as String? ?? '';
    final vodIdRaw = item['vod_id'];
    final vodId = vodIdRaw != null ? vodIdRaw.toString() : '';
    final releaseTime = item['release_time'] as String? ?? item['time'] as String? ?? '';
    final releaseDate = item['release_date'] as String? ?? '';

    return GestureDetector(
      onTap: () {
        if (vodId.isNotEmpty) {
          UniversalRouter.handleRoute('video://$vodId');
        }
      },
      child: Container(
        width: 140,
        margin: EdgeInsets.only(
          left: isFirst ? 0 : 12,
          right: 12,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 封面图
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: _buildImage(imageUrl),
              ),
            ),

            const SizedBox(height: 8),

            // 标题
            Text(
              title,
              style: const TextStyle(
                fontSize: 13,
                color: Colors.white,
                fontWeight: FontWeight.w500,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),

            const SizedBox(height: 6),

            // 时间信息
            _buildTimeInfo(releaseTime, releaseDate),
          ],
        ),
      ),
    );
  }

  /// 构建时间信息
  Widget _buildTimeInfo(String releaseTime, String releaseDate) {
    // 优先显示具体时间，否则显示日期
    final displayTime = releaseTime.isNotEmpty ? releaseTime : releaseDate;

    if (displayTime.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFF2E2E2E),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.access_time,
            size: 12,
            color: Color(0xFFFFC107),
          ),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              displayTime,
              style: const TextStyle(
                fontSize: 11,
                color: Colors.white70,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
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
