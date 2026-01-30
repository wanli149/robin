import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:media_kit_video/media_kit_video.dart';
import '../../core/player/global_player_manager.dart';
import '../net_image.dart';

/// 短剧流专用播放器UI (基于 media_kit)
class ShortsFlowPlayer extends StatefulWidget {
  final bool showControls;
  final VoidCallback? onTap;
  final Widget? overlay;
  final String? coverUrl; // 封面图URL，加载时显示

  const ShortsFlowPlayer({
    super.key,
    this.showControls = false,
    this.onTap,
    this.overlay,
    this.coverUrl,
  });

  @override
  State<ShortsFlowPlayer> createState() => _ShortsFlowPlayerState();
}

class _ShortsFlowPlayerState extends State<ShortsFlowPlayer> {
  final GlobalPlayerManager _manager = GlobalPlayerManager.to;

  @override
  Widget build(BuildContext context) {
    // 🚀 性能优化：只监听必要的状态，避免整个 widget 树重建
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: widget.onTap,
      onDoubleTap: _manager.togglePlayPause,
      child: Container(
        width: double.infinity,
        height: double.infinity,
        color: Colors.black,
        child: RepaintBoundary( // 🚀 隔离重绘边界
          child: Stack(
            fit: StackFit.expand,
            children: [
              _VideoPlayerWidget(manager: _manager),
              _LoadingIndicator(manager: _manager, coverUrl: widget.coverUrl),
              _ErrorIndicator(manager: _manager),
              _PlayIcon(manager: _manager),
              if (widget.overlay != null) widget.overlay!,
            ],
          ),
        ),
      ),
    );
  }
}

/// 🚀 独立的视频播放器 widget - 只监听必要的状态
class _VideoPlayerWidget extends StatelessWidget {
  final GlobalPlayerManager manager;

  const _VideoPlayerWidget({required this.manager});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final videoController = manager.videoController;
      
      if (videoController == null) {
        return const SizedBox.shrink();
      }

      final hasFrame = manager.hasVideoFrame.value;
      
      return Stack(
        fit: StackFit.expand,
        children: [
          // 视频层（始终渲染）
          SizedBox.expand(
            child: Video(
              controller: videoController,
              fit: BoxFit.cover,
              controls: NoVideoControls,
            ),
          ),
          // 封面层：首帧未渲染时显示
          if (!hasFrame) _CoverPlaceholder(manager: manager),
        ],
      );
    });
  }
}

/// 🚀 独立的加载指示器 widget
class _LoadingIndicator extends StatelessWidget {
  final GlobalPlayerManager manager;
  final String? coverUrl;

  const _LoadingIndicator({required this.manager, this.coverUrl});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (!manager.isLoading.value) {
        return const SizedBox.shrink();
      }

      final url = coverUrl ?? manager.currentState.value.coverUrl;
      
      return Stack(
        fit: StackFit.expand,
        children: [
          // 封面背景
          if (url != null && url.isNotEmpty)
            NetImage(url: url, fit: BoxFit.contain)
          else
            Image.asset(
              'assets/images/player_background_vertical.webp',
              fit: BoxFit.cover,
            ),
          // 半透明遮罩
          Container(color: Colors.black.withValues(alpha: 0.3)),
          // 加载指示器
          const Center(
            child: CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
              strokeWidth: 3,
            ),
          ),
        ],
      );
    });
  }
}

/// 🚀 独立的错误指示器 widget
class _ErrorIndicator extends StatelessWidget {
  final GlobalPlayerManager manager;

  const _ErrorIndicator({required this.manager});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final error = manager.error.value;
      
      if (error.isEmpty) {
        return const SizedBox.shrink();
      }

      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: Colors.white54, size: 48),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Text(
                error,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                textAlign: TextAlign.center,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                manager.switchContent(
                  contentType: manager.currentState.value.contentType,
                  contentId: manager.currentState.value.contentId,
                  episodeIndex: manager.currentState.value.episodeIndex,
                  config: manager.currentConfig.value,
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFFC107),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
              child: const Text('重试', style: TextStyle(color: Colors.black)),
            ),
          ],
        ),
      );
    });
  }
}

/// 🚀 独立的播放图标 widget
class _PlayIcon extends StatelessWidget {
  final GlobalPlayerManager manager;

  const _PlayIcon({required this.manager});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final state = manager.currentState.value;
      final isLoading = manager.isLoading.value;
      final error = manager.error.value;
      
      if (state.isPlaying || isLoading || error.isNotEmpty) {
        return const SizedBox.shrink();
      }

      return const Center(
        child: Icon(Icons.play_circle_outline, color: Colors.white, size: 80),
      );
    });
  }
}

/// 🚀 封面占位符 widget
class _CoverPlaceholder extends StatelessWidget {
  final GlobalPlayerManager manager;

  const _CoverPlaceholder({required this.manager});

  @override
  Widget build(BuildContext context) {
    final coverUrl = manager.currentState.value.coverUrl;
    
    if (coverUrl == null || coverUrl.isEmpty) {
      return Image.asset(
        'assets/images/player_background_vertical.webp',
        fit: BoxFit.cover,
      );
    }
    
    return RepaintBoundary(
      child: Stack(
        fit: StackFit.expand,
        children: [
          NetImage(url: coverUrl, fit: BoxFit.cover),
          Container(color: Colors.black.withValues(alpha: 0.6)),
          NetImage(url: coverUrl, fit: BoxFit.contain),
        ],
      ),
    );
  }
}
