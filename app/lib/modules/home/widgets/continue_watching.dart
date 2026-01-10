import 'package:flutter/material.dart';
import '../../../core/router.dart';
import '../../../widgets/net_image.dart';

/// 继续观看组件
/// 显示用户的观看历史，支持断点续播
class ContinueWatching extends StatelessWidget {
  final List<Map<String, dynamic>> items;

  const ContinueWatching({
    super.key,
    required this.items,
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
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                const Icon(
                  Icons.history,
                  color: Color(0xFFFFC107),
                  size: 20,
                ),
                const SizedBox(width: 8),
                const Text(
                  '继续观看',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: () {
                    // 跳转到观看历史页面
                    UniversalRouter.handleRoute('deeplink://history');
                  },
                  child: const Row(
                    children: [
                      Text(
                        '查看全部',
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.white54,
                        ),
                      ),
                      SizedBox(width: 4),
                      Icon(
                        Icons.chevron_right,
                        color: Colors.white54,
                        size: 16,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // 横向滚动列表
          SizedBox(
            height: 180,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: items.length,
              itemBuilder: (context, index) {
                return _buildHistoryItem(items[index]);
              },
            ),
          ),
        ],
      ),
    );
  }

  /// 构建历史记录项
  Widget _buildHistoryItem(Map<String, dynamic> item) {
    final vodIdRaw = item['vod_id'];
    final vodId = vodIdRaw != null ? vodIdRaw.toString() : '';
    final vodName = item['vod_name'] as String? ?? '未知影片';
    final vodPic = item['vod_pic'] as String? ?? '';
    final progress = (item['progress'] as num?)?.toDouble() ?? 0.0;
    final duration = (item['duration'] as num?)?.toDouble() ?? 1.0;
    final lastWatchTime = item['last_watch_time'] as String? ?? '';

    // 计算进度百分比
    final progressPercent = duration > 0 ? (progress / duration).clamp(0.0, 1.0) : 0.0;

    return GestureDetector(
      onTap: () {
        // 跳转到视频详情页，并自动续播
        UniversalRouter.handleRoute('video://$vodId?resume=true');
      },
      child: Container(
        width: 120,
        margin: const EdgeInsets.symmetric(horizontal: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 封面图 + 进度条
            Stack(
              children: [
                // 封面
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: NetImage(
                    url: vodPic,
                    width: 120,
                    height: 160,
                    fit: BoxFit.cover,
                  ),
                ),

                // 播放图标遮罩
                Positioned.fill(
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.transparent,
                          Colors.black.withValues(alpha: 0.6),
                        ],
                      ),
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.play_circle_outline,
                        color: Colors.white,
                        size: 40,
                      ),
                    ),
                  ),
                ),

                // 进度条
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: Container(
                    height: 3,
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: const BorderRadius.only(
                        bottomLeft: Radius.circular(8),
                        bottomRight: Radius.circular(8),
                      ),
                    ),
                    child: FractionallySizedBox(
                      alignment: Alignment.centerLeft,
                      widthFactor: progressPercent,
                      child: Container(
                        decoration: const BoxDecoration(
                          color: Color(0xFFFFC107),
                          borderRadius: BorderRadius.only(
                            bottomLeft: Radius.circular(8),
                            bottomRight: Radius.circular(8),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),

                // 进度百分比标签
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.7),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      '${(progressPercent * 100).toInt()}%',
                      style: const TextStyle(
                        fontSize: 10,
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 8),

            // 影片名称
            Text(
              vodName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13,
                color: Colors.white,
                fontWeight: FontWeight.w500,
              ),
            ),

            const SizedBox(height: 2),

            // 观看时间
            if (lastWatchTime.isNotEmpty)
              Text(
                _formatWatchTime(lastWatchTime),
                style: const TextStyle(
                  fontSize: 11,
                  color: Colors.white54,
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// 格式化观看时间
  String _formatWatchTime(String timestamp) {
    try {
      final dateTime = DateTime.parse(timestamp);
      final now = DateTime.now();
      final difference = now.difference(dateTime);

      if (difference.inMinutes < 1) {
        return '刚刚观看';
      } else if (difference.inHours < 1) {
        return '${difference.inMinutes}分钟前';
      } else if (difference.inDays < 1) {
        return '${difference.inHours}小时前';
      } else if (difference.inDays < 7) {
        return '${difference.inDays}天前';
      } else {
        return '${dateTime.month}月${dateTime.day}日';
      }
    } catch (e) {
      return '';
    }
  }
}
