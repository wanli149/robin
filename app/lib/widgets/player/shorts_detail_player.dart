import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:video_player/video_player.dart';
import '../../core/global_player_manager.dart';
import 'shared/player_controls_base.dart';
import 'shared/player_progress_bar.dart';
import 'shared/player_utils.dart';
import 'pause_overlay_ad.dart';

/// 短剧详情页专用播放器UI
/// 专门处理短剧详情页的横屏16:9播放和全屏竖屏播放
class ShortsDetailPlayer extends StatefulWidget {
  final bool showControls;
  final VoidCallback? onTap;
  final Widget? overlay;

  const ShortsDetailPlayer({
    super.key,
    this.showControls = true,
    this.onTap,
    this.overlay,
  });

  @override
  State<ShortsDetailPlayer> createState() => _ShortsDetailPlayerState();
}

class _ShortsDetailPlayerState extends State<ShortsDetailPlayer> {
  final GlobalPlayerManager _manager = GlobalPlayerManager.to;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final playerInstance = _manager.playerInstance;
      final config = _manager.currentConfig.value;
      final state = _manager.currentState.value;
      final isLoading = _manager.isLoading.value;
      final error = _manager.error.value;
      final isFullscreen = _manager.playerMode.value == PlayerMode.fullscreen;

      Widget playerWidget = Container(
        color: Colors.black,
        child: LayoutBuilder(
          builder: (context, constraints) {
            return Stack(
              fit: StackFit.expand,
              children: [
                // 视频播放器
                _buildVideoPlayer(playerInstance, isFullscreen),

                // 加载指示器
                if (isLoading) _buildLoadingIndicator(),

                // 错误提示
                if (error.isNotEmpty) _buildErrorIndicator(error),

                // 播放/暂停图标
                if (!state.isPlaying && !isLoading && error.isEmpty)
                  _buildPlayIcon(),

                // 控制栏
                if (widget.showControls)
                  _buildControls(state, constraints, isFullscreen),

                // 暂停广告覆盖层
                Obx(() => _manager.showPauseAd.value
                    ? PauseOverlayAd(
                        adData: _manager.pauseAdData.value,
                        onAdTap: _manager.onPauseAdTap,
                        onClose: _manager.closePauseAd,
                      )
                    : const SizedBox.shrink()),

                // 自定义覆盖层
                if (widget.overlay != null) widget.overlay!,
              ],
            );
          },
        ),
      );

      // 如果是全屏模式且启用了滑动手势，包装在GestureDetector中
      if (isFullscreen && config.enableSwipeGesture) {
        return GestureDetector(
          onTap: widget.onTap, // 单击：由外部处理
          onDoubleTap: _manager.togglePlayPause, // 🚀 双击：播放/暂停
          onVerticalDragEnd: (details) => _handleVerticalSwipe(details, state),
          child: playerWidget,
        );
      } else {
        return GestureDetector(
          onTap: widget.onTap, // 单击：由外部处理
          onDoubleTap: _manager.togglePlayPause, // 🚀 双击：播放/暂停
          child: playerWidget,
        );
      }
    });
  }

  /// 构建视频播放器 - 根据模式选择渲染方式
  Widget _buildVideoPlayer(VideoPlayerController? playerInstance, bool isFullscreen) {
    if (playerInstance == null || !playerInstance.value.isInitialized) {
      return const SizedBox.shrink();
    }

    final videoValue = playerInstance.value;
    
    if (isFullscreen) {
      // 全屏模式：竖屏填充渲染（类似短剧流）
      return Center(
        child: AspectRatio(
          aspectRatio: _getSafeAspectRatio(videoValue, true),
          child: SizedBox(
            width: double.infinity,
            height: double.infinity,
            child: FittedBox(
              fit: BoxFit.cover,
              child: SizedBox(
                width: videoValue.size.width > 0 ? videoValue.size.width : 9,
                height: videoValue.size.height > 0 ? videoValue.size.height : 16,
                child: VideoPlayer(playerInstance),
              ),
            ),
          ),
        ),
      );
    } else {
      // 窗口模式：横屏16:9 AspectRatio渲染
      return Center(
        child: AspectRatio(
          aspectRatio: _getSafeAspectRatio(videoValue, false),
          child: VideoPlayer(playerInstance),
        ),
      );
    }
  }

  /// 获取安全的宽高比
  double _getSafeAspectRatio(dynamic videoValue, bool isFullscreen) {
    final videoAspectRatio = videoValue.aspectRatio;
    
    // 检查视频比例是否有效
    if (videoAspectRatio.isFinite && 
        videoAspectRatio > 0 && 
        videoAspectRatio < 10) { // 防止极端比例
      return videoAspectRatio;
    }
    
    // 根据模式返回默认比例
    return isFullscreen ? 9 / 16 : 16 / 9;
  }

  /// 处理垂直滑动手势（仅全屏模式）
  void _handleVerticalSwipe(DragEndDetails details, PlayerState state) {
    final velocity = details.primaryVelocity ?? 0;
    
    // 滑动速度阈值
    if (velocity.abs() < 500) return;
    
    if (velocity < 0) {
      // 向上滑动 - 下一集
      PlayerUtils.handleSwipeUp(_manager, state);
    } else {
      // 向下滑动 - 上一集
      PlayerUtils.handleSwipeDown(_manager, state);
    }
  }

  /// 构建控制栏
  Widget _buildControls(PlayerState state, BoxConstraints constraints, bool isFullscreen) {
    final availableHeight = constraints.maxHeight;
    final isCompactMode = availableHeight < 300;
    
    if (isFullscreen) {
      // 全屏模式：简化控制栏
      return _buildFullscreenControls(state, isCompactMode);
    } else {
      // 窗口模式：基础控制栏
      return _buildWindowControls(state);
    }
  }

  /// 构建全屏控制栏
  Widget _buildFullscreenControls(PlayerState state, bool isCompactMode) {
    return Stack(
      children: [
        // 顶部返回按钮
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: SafeArea(
            bottom: false,
            child: PlayerControlsBase.buildGradientBackground(
              isTop: true,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Row(
                  children: [
                    // 返回按钮
                    IconButton(
                      onPressed: () => PlayerControlsBase.handleBackButton(_manager),
                      icon: const Icon(
                        Icons.arrow_back,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                    const Spacer(),
                    // 全屏退出按钮
                    IconButton(
                      onPressed: () => PlayerControlsBase.toggleFullscreen(_manager),
                      icon: const Icon(
                        Icons.fullscreen_exit,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        
        // 中间播放控制
        _buildCenterControls(),
        
        // 底部进度条
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          child: SafeArea(
            top: false,
            child: PlayerControlsBase.buildGradientBackground(
              child: CompactProgressBar(
                state: state,
                manager: _manager,
                isCompactMode: isCompactMode,
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// 构建窗口模式控制栏
  Widget _buildWindowControls(PlayerState state) {
    return Stack(
      children: [
        // 中间控制按钮
        _buildCenterControls(),
        // 底部进度条
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          child: PlayerProgressBar(
            state: state,
            manager: _manager,
            showTime: false,
            height: 4,
          ),
        ),
      ],
    );
  }

  /// 构建中间控制按钮
  Widget _buildCenterControls() {
    return Center(
      child: Obx(() {
        final state = _manager.currentState.value;
        
        return Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            // 上一集
            PlayerControlsBase.buildControlButton(
              icon: PlayerControlsBase.getBackwardIcon(state.contentType),
              onTap: () => PlayerUtils.handleBackwardTap(_manager),
              size: 48,
            ),
            const SizedBox(width: 32),
            // 播放/暂停
            PlayerControlsBase.buildControlButton(
              icon: state.isPlaying ? Icons.pause : Icons.play_arrow,
              onTap: _manager.togglePlayPause,
              size: 64,
            ),
            const SizedBox(width: 32),
            // 下一集
            PlayerControlsBase.buildControlButton(
              icon: PlayerControlsBase.getForwardIcon(state.contentType),
              onTap: () => PlayerUtils.handleForwardTap(_manager),
              size: 48,
            ),
          ],
        );
      }),
    );
  }

  /// 构建加载指示器
  Widget _buildLoadingIndicator() {
    return const Center(
      child: CircularProgressIndicator(
        valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
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
            ),
            child: const Text('重试'),
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
        size: 64,
      ),
    );
  }
}