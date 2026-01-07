import 'package:flutter/material.dart';
import '../../widgets/net_image.dart';

/// 暂停广告覆盖层
/// 在视频暂停时显示广告内容
class PauseOverlayAd extends StatelessWidget {
  final Map<String, dynamic>? adData;
  final VoidCallback? onAdTap;
  final VoidCallback? onClose;

  const PauseOverlayAd({
    super.key,
    this.adData,
    this.onAdTap,
    this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    if (adData == null) return const SizedBox.shrink();

    final contentType = adData!['content_type'] as String? ?? 'image';
    final mediaUrl = adData!['media_url'] as String? ?? '';
    final title = adData!['title'] as String? ?? '';
    final description = adData!['description'] as String? ?? '';

    return Container(
      color: Colors.black.withOpacity(0.8),
      child: Stack(
        children: [
          // 广告内容
          Center(
            child: GestureDetector(
              onTap: onAdTap,
              child: Container(
                margin: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.3),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // 广告媒体内容
                    if (mediaUrl.isNotEmpty) _buildAdMedia(contentType, mediaUrl),

                    // 广告文本内容
                    if (title.isNotEmpty || description.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          children: [
                            if (title.isNotEmpty)
                              Text(
                                title,
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.black87,
                                ),
                                textAlign: TextAlign.center,
                              ),
                            if (title.isNotEmpty && description.isNotEmpty)
                              const SizedBox(height: 8),
                            if (description.isNotEmpty)
                              Text(
                                description,
                                style: const TextStyle(
                                  fontSize: 14,
                                  color: Colors.black54,
                                ),
                                textAlign: TextAlign.center,
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                              ),
                          ],
                        ),
                      ),

                    // 点击提示
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: const BoxDecoration(
                        color: Color(0xFFFFC107),
                        borderRadius: BorderRadius.only(
                          bottomLeft: Radius.circular(12),
                          bottomRight: Radius.circular(12),
                        ),
                      ),
                      child: const Text(
                        '点击查看详情',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // 关闭按钮
          if (onClose != null)
            Positioned(
              top: MediaQuery.of(context).padding.top + 16,
              right: 16,
              child: GestureDetector(
                onTap: onClose,
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.6),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.close,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
              ),
            ),

          // 广告标识
          Positioned(
            top: MediaQuery.of(context).padding.top + 16,
            left: 16,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.6),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                '广告',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 构建广告媒体内容
  Widget _buildAdMedia(String contentType, String mediaUrl) {
    switch (contentType) {
      case 'image':
        return ClipRRect(
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(12),
            topRight: Radius.circular(12),
          ),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: NetImage(
              url: mediaUrl,
              fit: BoxFit.cover,
            ),
          ),
        );
      case 'video':
        // TODO: 实现视频广告播放
        return Container(
          height: 200,
          decoration: const BoxDecoration(
            color: Colors.black,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(12),
              topRight: Radius.circular(12),
            ),
          ),
          child: const Center(
            child: Icon(
              Icons.play_circle_outline,
              color: Colors.white,
              size: 64,
            ),
          ),
        );
      default:
        return const SizedBox.shrink();
    }
  }
}