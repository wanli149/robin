import 'package:flutter/material.dart';
import '../../../core/router.dart';

/// 专题列表组件
class TopicList extends StatelessWidget {
  final String title;
  final List<Map<String, dynamic>> topics;
  final String? moreRoute;
  final String displayStyle; // card, banner, grid

  const TopicList({
    super.key,
    this.title = '精选专题',
    required this.topics,
    this.moreRoute,
    this.displayStyle = 'card',
  });

  @override
  Widget build(BuildContext context) {
    if (topics.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 标题栏
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
                        Text('更多', style: TextStyle(fontSize: 14, color: Colors.white54)),
                        Icon(Icons.chevron_right, size: 18, color: Colors.white54),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // 专题列表
          _buildTopicList(),
        ],
      ),
    );
  }

  Widget _buildTopicList() {
    switch (displayStyle) {
      case 'banner':
        return _buildBannerStyle();
      case 'grid':
        return _buildGridStyle();
      default:
        return _buildCardStyle();
    }
  }

  /// 卡片样式（横向滚动）
  Widget _buildCardStyle() {
    return SizedBox(
      height: 160,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: topics.length,
        itemBuilder: (context, index) {
          return Padding(
            padding: EdgeInsets.only(right: index < topics.length - 1 ? 12 : 0),
            child: _buildTopicCard(topics[index]),
          );
        },
      ),
    );
  }

  /// 横幅样式（纵向列表）
  Widget _buildBannerStyle() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: topics.take(3).map((topic) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _buildTopicBanner(topic),
          );
        }).toList(),
      ),
    );
  }

  /// 网格样式
  Widget _buildGridStyle() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.6,
        ),
        itemCount: topics.take(4).length,
        itemBuilder: (context, index) => _buildTopicGridItem(topics[index]),
      ),
    );
  }

  Widget _buildTopicCard(Map<String, dynamic> topic) {
    final name = topic['name'] as String? ?? topic['topic_name'] as String? ?? '';
    final cover = topic['cover'] as String? ?? topic['topic_pic'] as String? ?? '';
    final topicId = topic['id']?.toString() ?? topic['topic_id']?.toString() ?? '';
    final videoCount = topic['video_count'] as int? ?? 0;
    final description = topic['description'] as String? ?? '';

    return GestureDetector(
      onTap: () {
        if (topicId.isNotEmpty) {
          UniversalRouter.handleRoute('topic://$topicId');
        }
      },
      child: Container(
        width: 200,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: const Color(0xFF1E1E1E),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 封面
            Expanded(
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    _buildImage(cover),
                    // 渐变遮罩
                    Positioned(
                      bottom: 0,
                      left: 0,
                      right: 0,
                      child: Container(
                        height: 60,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.transparent,
                              Colors.black.withOpacity(0.8),
                            ],
                          ),
                        ),
                      ),
                    ),
                    // 视频数量
                    if (videoCount > 0)
                      Positioned(
                        bottom: 8,
                        right: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFC107),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            '$videoCount部',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: Colors.black,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            // 信息
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (description.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      description,
                      style: const TextStyle(fontSize: 11, color: Colors.white54),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTopicBanner(Map<String, dynamic> topic) {
    final name = topic['name'] as String? ?? '';
    final cover = topic['cover'] as String? ?? '';
    final topicId = topic['id']?.toString() ?? '';
    final videoCount = topic['video_count'] as int? ?? 0;

    return GestureDetector(
      onTap: () {
        if (topicId.isNotEmpty) {
          UniversalRouter.handleRoute('topic://$topicId');
        }
      },
      child: Container(
        height: 80,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Stack(
            fit: StackFit.expand,
            children: [
              _buildImage(cover),
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [
                      Colors.black.withOpacity(0.7),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            name,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          if (videoCount > 0)
                            Text(
                              '共$videoCount部',
                              style: const TextStyle(fontSize: 12, color: Colors.white70),
                            ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right, color: Colors.white54),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTopicGridItem(Map<String, dynamic> topic) {
    final name = topic['name'] as String? ?? '';
    final cover = topic['cover'] as String? ?? '';
    final topicId = topic['id']?.toString() ?? '';

    return GestureDetector(
      onTap: () {
        if (topicId.isNotEmpty) {
          UniversalRouter.handleRoute('topic://$topicId');
        }
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          fit: StackFit.expand,
          children: [
            _buildImage(cover),
            Container(color: Colors.black.withOpacity(0.4)),
            Center(
              child: Text(
                name,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildImage(String imageUrl) {
    if (imageUrl.isEmpty) {
      return Container(
        color: const Color(0xFF2E2E2E),
        child: const Icon(Icons.collections, size: 40, color: Colors.white24),
      );
    }
    return Image.network(
      imageUrl,
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => Container(
        color: const Color(0xFF2E2E2E),
        child: const Icon(Icons.broken_image, size: 40, color: Colors.white24),
      ),
    );
  }
}
