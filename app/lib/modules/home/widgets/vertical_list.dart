import 'package:flutter/material.dart';
import '../../../core/router.dart';

/// 竖向列表组件
/// 视频卡片纵向排列，带封面+详细信息
class VerticalList extends StatelessWidget {
  final String title;
  final List<Map<String, dynamic>> items;
  final String? moreRoute;

  const VerticalList({
    super.key,
    this.title = '',
    required this.items,
    this.moreRoute,
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
          // 标题栏
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

          // 列表
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: items.length,
            separatorBuilder: (context, index) => const SizedBox(height: 12),
            itemBuilder: (context, index) => _buildListItem(items[index]),
          ),
        ],
      ),
    );
  }

  /// 构建列表项
  Widget _buildListItem(Map<String, dynamic> item) {
    final imageUrl = item['vod_pic'] as String? ?? item['image_url'] as String? ?? '';
    final title = item['vod_name'] as String? ?? item['title'] as String? ?? '';
    final vodIdRaw = item['vod_id'];
    final vodId = vodIdRaw != null ? vodIdRaw.toString() : '';
    final remarks = item['vod_remarks'] as String? ?? '';
    final desc = item['vod_blurb'] as String? ?? item['vod_content'] as String? ?? '';
    final score = item['vod_score'] as String? ?? '';
    final year = item['vod_year'] as String? ?? '';
    final area = item['vod_area'] as String? ?? '';
    final typeName = item['type_name'] as String? ?? '';

    return GestureDetector(
      onTap: () {
        if (vodId.isNotEmpty) {
          UniversalRouter.handleRoute('video://$vodId');
        }
      },
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF1E1E1E),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 封面图
            ClipRRect(
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(12),
                bottomLeft: Radius.circular(12),
              ),
              child: SizedBox(
                width: 100,
                height: 140,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    _buildImage(imageUrl),

                    // 备注标签
                    if (remarks.isNotEmpty)
                      Positioned(
                        top: 6,
                        left: 6,
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

            // 详情
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 标题
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),

                    const SizedBox(height: 6),

                    // 标签行（评分、年份、地区、类型）
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      children: [
                        if (score.isNotEmpty && score != '0' && score != '0.0')
                          _buildTag('⭐ $score', isHighlight: true),
                        if (year.isNotEmpty)
                          _buildTag(year),
                        if (area.isNotEmpty)
                          _buildTag(area),
                        if (typeName.isNotEmpty)
                          _buildTag(typeName),
                      ],
                    ),

                    const SizedBox(height: 8),

                    // 简介
                    if (desc.isNotEmpty)
                      Text(
                        _cleanDesc(desc),
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.white54,
                          height: 1.4,
                        ),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ),
            ),

            // 播放按钮
            Padding(
              padding: const EdgeInsets.all(12),
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFC107),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Icon(
                  Icons.play_arrow,
                  color: Color(0xFF121212),
                  size: 20,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 构建标签
  Widget _buildTag(String text, {bool isHighlight = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: isHighlight 
            ? const Color(0xFFFFC107).withOpacity(0.2)
            : const Color(0xFF2E2E2E),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          color: isHighlight ? const Color(0xFFFFC107) : Colors.white54,
        ),
      ),
    );
  }

  /// 清理简介文本
  String _cleanDesc(String desc) {
    // 移除HTML标签
    return desc
        .replaceAll(RegExp(r'<[^>]*>'), '')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .trim();
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
