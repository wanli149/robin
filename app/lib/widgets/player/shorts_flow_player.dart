import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:video_player/video_player.dart';
import '../../core/global_player_manager.dart';
import 'shared/player_utils.dart';

/// 短剧流专用播放器UI
/// 专门处理短剧流的竖屏填充播放
class ShortsFlowPlayer extends StatefulWidget {
  final bool showControls;
  final VoidCallback? onTap;
  final Widget? overlay;

  const ShortsFlowPlayer({
    super.key,
    this.showControls = false, // 短剧流默认不显示控制栏
    this.onTap,
    this.overlay,
  });

  @override
  State<ShortsFlowPlayer> createState() => _ShortsFlowPlayerState();
}

class _ShortsFlowPlayerState extends State<ShortsFlowPlayer> {
  final GlobalPlayerManager _manager = GlobalPlayerManager.to;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final playerInstance = _manager.playerInstance;
      final state = _manager.currentState.value;
      final isLoading = _manager.isLoading.value;
      final error = _manager.error.value;

      return GestureDetector(
        onTap: widget.onTap, // 单击：由外部处理（显示UI等）
        onDoubleTap: _manager.togglePlayPause, // 🚀 双击：播放/暂停
        onVerticalDragEnd: (details) => _handleVerticalSwipe(details, state),
        child: Container(
          width: double.infinity,
          height: double.infinity,
          color: Colors.black,
          child: Stack(
            fit: StackFit.expand,
            children: [
              // 视频播放器 - 填充整个屏幕
              _buildVideoPlayer(playerInstance),

              // 加载指示器
              if (isLoading) _buildLoadingIndicator(),

              // 错误提示
              if (error.isNotEmpty) _buildErrorIndicator(error),

              // 播放/暂停图标
              if (!state.isPlaying && !isLoading && error.isEmpty)
                _buildPlayIcon(),

              // 自定义覆盖层
              if (widget.overlay != null) widget.overlay!,
            ],
          ),
        ),
      );
    });
  }

  /// 构建视频播放器 - 专门优化短剧流渲染
  Widget _buildVideoPlayer(VideoPlayerController? playerInstance) {
    // 播放器未初始化时返回黑色背景，加载指示器由Stack中的if条件单独处理
    if (playerInstance == null || !playerInstance.value.isInitialized) {
      return Container(
        color: Colors.black,
      );
    }

    final videoValue = playerInstance.value;
    final aspectRatio = _getSafeAspectRatio(videoValue);
    
    // 短剧流模式：安全的填充渲染
    return Container(
      color: Colors.black, // 确保背景是黑色
      child: Center(
        child: AspectRatio(
          aspectRatio: aspectRatio,
          child: VideoPlayer(playerInstance),
        ),
      ),
    );
  }

  /// 获取安全的宽高比
  double _getSafeAspectRatio(dynamic videoValue) {
    final videoAspectRatio = videoValue.aspectRatio;
    
    // 检查视频比例是否有效
    if (videoAspectRatio.isFinite && 
        videoAspectRatio > 0 && 
        videoAspectRatio < 10) { // 防止极端比例
      return videoAspectRatio;
    }
    
    // 使用短剧流默认比例 9:16
    return 9 / 16;
  }

  /// 处理垂直滑动手势
  void _handleVerticalSwipe(DragEndDetails details, PlayerState state) {
    final velocity = details.primaryVelocity ?? 0;
    
    // 滑动速度阈值
    if (velocity.abs() < 500) return;
    
    if (velocity < 0) {
      // 向上滑动 - 下一个视频
      PlayerUtils.handleSwipeUp(_manager, state);
    } else {
      // 向下滑动 - 上一个视频
      PlayerUtils.handleSwipeDown(_manager, state);
    }
  }

  /// 构建加载指示器
  Widget _buildLoadingIndicator() {
    return const Center(
      child: CircularProgressIndicator(
        valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
        strokeWidth: 3,
      ),
    );
  }

  /// 构建错误指示器
  Widget _buildErrorIndicator(String error) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.error_outline,
            color: Colors.white54,
            size: 48,
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              error,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
              ),
              textAlign: TextAlign.center,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () {
              // 重试逻辑
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
            child: const Text(
              '重试',
              style: TextStyle(color: Colors.black),
            ),
          ),
        ],
      ),
    );
  }

  /// 构建播放图标
  Widget _buildPlayIcon() {
    return const Center(
      child: Icon(
        Icons.play_circle_outline,
        color: Colors.white,
        size: 80,
      ),
    );
  }
}