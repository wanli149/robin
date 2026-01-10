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
    return Obx(() {
      final videoController = _manager.videoController;
      final state = _manager.currentState.value;
      final isLoading = _manager.isLoading.value;
      final error = _manager.error.value;

      return GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: widget.onTap,
        onDoubleTap: _manager.togglePlayPause,
        child: Container(
          width: double.infinity,
          height: double.infinity,
          color: Colors.black,
          child: Stack(
            fit: StackFit.expand,
            children: [
              _buildVideoPlayer(videoController),
              if (isLoading) _buildLoadingIndicator(),
              if (error.isNotEmpty) _buildErrorIndicator(error),
              if (!state.isPlaying && !isLoading && error.isEmpty)
                _buildPlayIcon(),
              if (widget.overlay != null) widget.overlay!,
            ],
          ),
        ),
      );
    });
  }

  Widget _buildVideoPlayer(VideoController? videoController) {
    if (videoController == null) {
      // 播放器未初始化时显示封面
      return _buildCoverPlaceholder();
    }

    // 使用 media_kit 的 Video widget，填充整个容器
    return SizedBox.expand(
      child: Video(
        controller: videoController,
        fit: BoxFit.cover, // 短剧流使用 cover 填充
        controls: NoVideoControls,
      ),
    );
  }

  /// 构建封面占位符
  Widget _buildCoverPlaceholder() {
    final coverUrl = widget.coverUrl ?? _manager.currentState.value.coverUrl;
    
    if (coverUrl == null || coverUrl.isEmpty) {
      return Container(color: Colors.black);
    }
    
    return NetImage(
      url: coverUrl,
      fit: BoxFit.cover,
    );
  }

  Widget _buildLoadingIndicator() {
    final coverUrl = widget.coverUrl ?? _manager.currentState.value.coverUrl;
    
    return Stack(
      fit: StackFit.expand,
      children: [
        // 封面背景
        if (coverUrl != null && coverUrl.isNotEmpty)
          NetImage(
            url: coverUrl,
            fit: BoxFit.cover,
          ),
        // 半透明遮罩
        Container(
          color: Colors.black.withValues(alpha: 0.3),
        ),
        // 加载指示器
        const Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
            strokeWidth: 3,
          ),
        ),
      ],
    );
  }

  Widget _buildErrorIndicator(String error) {
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
              _manager.switchContent(
                contentType: _manager.currentState.value.contentType,
                contentId: _manager.currentState.value.contentId,
                episodeIndex: _manager.currentState.value.episodeIndex,
                config: _manager.currentConfig.value,
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
  }

  Widget _buildPlayIcon() {
    return const Center(
      child: Icon(Icons.play_circle_outline, color: Colors.white, size: 80),
    );
  }
}
