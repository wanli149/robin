import 'dart:async';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:video_player/video_player.dart';
import 'package:volume_controller/volume_controller.dart';
import 'package:screen_brightness/screen_brightness.dart';
import '../../core/global_player_manager.dart';
import '../../core/pip_manager.dart';
import 'shared/player_controls_base.dart';
import 'shared/player_utils.dart';
import 'pause_overlay_ad.dart';

/// 长视频专用播放器UI
/// 参考设计：顶部（返回+标题 | 投屏+画中画+设置）底部（播放+时间+进度条+时间+清晰度+全屏）
class LongVideoPlayer extends StatefulWidget {
  final bool showControls;
  final VoidCallback? onTap;
  final Widget? overlay;

  const LongVideoPlayer({
    super.key,
    this.showControls = true,
    this.onTap,
    this.overlay,
  });

  @override
  State<LongVideoPlayer> createState() => _LongVideoPlayerState();
}

class _LongVideoPlayerState extends State<LongVideoPlayer> {
  final GlobalPlayerManager _manager = GlobalPlayerManager.to;
  
  // 主题色：黄色
  static const Color _accentColor = Color(0xFFFFB800);
  
  // 控制栏显示状态
  bool _showControls = true;
  
  // 控制栏自动隐藏定时器
  Timer? _hideControlsTimer;
  
  // 🚀 手势控制相关
  // 双击暂停
  DateTime? _lastTapTime;
  static const _doubleTapInterval = Duration(milliseconds: 300);
  
  // 滑动调节
  bool _isVerticalDragging = false;
  bool _isDraggingLeft = false; // true=亮度, false=音量
  double _startDragY = 0;
  double _currentVolume = 0.5;
  double _currentBrightness = 0.5;
  
  // 调节指示器显示
  bool _showVolumeIndicator = false;
  bool _showBrightnessIndicator = false;

  @override
  void initState() {
    super.initState();
    _initVolumeAndBrightness();
  }

  @override
  void dispose() {
    _hideControlsTimer?.cancel();
    // 恢复系统音量监听
    VolumeController().showSystemUI = true;
    super.dispose();
  }
  
  /// 初始化音量和亮度
  Future<void> _initVolumeAndBrightness() async {
    try {
      // 隐藏系统音量UI，使用自定义UI
      VolumeController().showSystemUI = false;
      _currentVolume = await VolumeController().getVolume();
    } catch (e) {
      print('❌ [Player] Failed to get volume: $e');
    }
    
    try {
      _currentBrightness = await ScreenBrightness().current;
    } catch (e) {
      print('❌ [Player] Failed to get brightness: $e');
    }
  }

  /// 重置控制栏自动隐藏定时器
  void _resetHideControlsTimer() {
    _hideControlsTimer?.cancel();
    if (_showControls && _manager.currentState.value.isPlaying) {
      _hideControlsTimer = Timer(const Duration(seconds: 4), () {
        if (mounted && _manager.currentState.value.isPlaying) {
          setState(() {
            _showControls = false;
          });
        }
      });
    }
  }

  /// 切换控制栏显示状态
  void _toggleControls() {
    setState(() {
      _showControls = !_showControls;
    });
    if (_showControls) {
      _resetHideControlsTimer();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final playerInstance = _manager.playerInstance;
      final state = _manager.currentState.value;
      final isLoading = _manager.isLoading.value;
      final error = _manager.error.value;

      // 播放状态变化时重置定时器
      if (state.isPlaying && _showControls) {
        _resetHideControlsTimer();
      }

      return GestureDetector(
        onTap: _toggleControls, // 单击：显示/隐藏控制栏
        onDoubleTap: _manager.togglePlayPause, // 双击：播放/暂停
        onVerticalDragStart: _onVerticalDragStart,
        onVerticalDragUpdate: _onVerticalDragUpdate,
        onVerticalDragEnd: _onVerticalDragEnd,
        child: Container(
          color: Colors.black,
          child: Stack(
            fit: StackFit.expand,
            children: [
              // 视频播放器
              _buildVideoPlayer(playerInstance),

              // 加载指示器
              if (isLoading) _buildLoadingIndicator(),

              // 错误提示
              if (error.isNotEmpty) _buildErrorIndicator(error),

              // 控制栏（带动画）
              if (widget.showControls && !isLoading && error.isEmpty)
                AnimatedOpacity(
                  opacity: _showControls ? 1.0 : 0.0,
                  duration: const Duration(milliseconds: 200),
                  child: IgnorePointer(
                    ignoring: !_showControls,
                    child: _buildControls(state),
                  ),
                ),

              // 🚀 音量调节指示器
              if (_showVolumeIndicator) _buildVolumeIndicator(),
              
              // 🚀 亮度调节指示器
              if (_showBrightnessIndicator) _buildBrightnessIndicator(),

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
          ),
        ),
      );
    });
  }

  /// 构建视频播放器
  Widget _buildVideoPlayer(VideoPlayerController? playerInstance) {
    // 播放器未初始化时显示加载状态而不是错误
    if (playerInstance == null || !playerInstance.value.isInitialized) {
      return Container(
        color: Colors.black,
        child: const Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(_accentColor),
          ),
        ),
      );
    }

    final isFullscreen = _manager.playerMode.value == PlayerMode.fullscreen;
    final isPipMode = _manager.playerMode.value == PlayerMode.pip;

    if (isFullscreen) {
      // 全屏模式：智能适配，优先填充屏幕
      return _buildFullscreenVideoPlayer(playerInstance);
    } else if (isPipMode) {
      // 画中画模式：保持完整视频
      return _buildPipVideoPlayer(playerInstance);
    } else {
      // 窗口模式：保持比例
      return _buildWindowVideoPlayer(playerInstance);
    }
  }

  /// 构建全屏视频播放器
  Widget _buildFullscreenVideoPlayer(VideoPlayerController playerInstance) {
    // 处理视频尺寸为0的边界情况
    final videoSize = playerInstance.value.size;
    final width = videoSize.width > 0 ? videoSize.width : 16.0;
    final height = videoSize.height > 0 ? videoSize.height : 9.0;
    
    return SizedBox.expand(
      child: FittedBox(
        fit: BoxFit.contain,
        child: SizedBox(
          width: width,
          height: height,
          child: VideoPlayer(playerInstance),
        ),
      ),
    );
  }

  /// 构建窗口视频播放器
  Widget _buildWindowVideoPlayer(VideoPlayerController playerInstance) {
    final videoSize = playerInstance.value.size;
    final width = videoSize.width > 0 ? videoSize.width : 16.0;
    final height = videoSize.height > 0 ? videoSize.height : 9.0;
    
    return SizedBox.expand(
      child: FittedBox(
        fit: BoxFit.contain,
        child: SizedBox(
          width: width,
          height: height,
          child: VideoPlayer(playerInstance),
        ),
      ),
    );
  }

  /// 构建画中画视频播放器
  Widget _buildPipVideoPlayer(VideoPlayerController playerInstance) {
    final videoSize = playerInstance.value.size;
    final width = videoSize.width > 0 ? videoSize.width : 16.0;
    final height = videoSize.height > 0 ? videoSize.height : 9.0;
    
    return SizedBox.expand(
      child: FittedBox(
        fit: BoxFit.contain,
        child: SizedBox(
          width: width,
          height: height,
          child: VideoPlayer(playerInstance),
        ),
      ),
    );
  }

  /// 构建控制栏
  Widget _buildControls(PlayerState state) {
    final isPipMode = _manager.playerMode.value == PlayerMode.pip;
    
    // 画中画模式下使用简化的控制栏，避免溢出
    if (isPipMode) {
      return _buildPipControls(state);
    }
    
    return Stack(
      children: [
        // 顶部栏
        _buildTopBar(state),
        // 底部栏
        _buildBottomBar(state),
      ],
    );
  }

  /// 构建顶部栏：返回 + 标题 | 投屏 + 画中画 + 设置
  Widget _buildTopBar(PlayerState state) {
    final isFullscreen = _manager.playerMode.value == PlayerMode.fullscreen;
    // 全屏模式下使用固定的小内边距，非全屏使用 SafeArea
    final topPadding = isFullscreen ? 8.0 : MediaQuery.of(context).padding.top;
    
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.black54, Colors.transparent],
          ),
        ),
        child: Padding(
          padding: EdgeInsets.only(
            left: isFullscreen ? 24 : 8,
            right: isFullscreen ? 24 : 8,
            top: topPadding + 8,
            bottom: 8,
          ),
          child: Row(
            children: [
              // 返回按钮
              GestureDetector(
                onTap: () => _handleBack(),
                child: const Padding(
                  padding: EdgeInsets.all(8),
                  child: Icon(
                    Icons.arrow_back,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              // 标题
              Expanded(
                child: Text(
                  PlayerControlsBase.getTitle(state),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              // 右侧按钮组
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // 投屏按钮
                  _buildTopIconButton(
                    icon: Icons.cast,
                    onTap: () => PlayerUtils.showCastDialog(),
                  ),
                  // 画中画按钮
                  _buildTopIconButton(
                    icon: Icons.picture_in_picture_alt,
                    onTap: () => PipManager.to.enterPipMode(),
                  ),
                  // 设置按钮
                  _buildTopIconButton(
                    icon: Icons.settings,
                    onTap: () => _showSettingsMenu(),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 构建底部栏：播放按钮 + 时间 + 进度条 + 时间 + 清晰度 + 全屏
  Widget _buildBottomBar(PlayerState state) {
    final isFullscreen = _manager.playerMode.value == PlayerMode.fullscreen;
    // 全屏模式下使用固定的小内边距，非全屏使用 SafeArea
    final bottomPadding = isFullscreen ? 8.0 : MediaQuery.of(context).padding.bottom;
    
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.bottomCenter,
            end: Alignment.topCenter,
            colors: [Colors.black54, Colors.transparent],
          ),
        ),
        child: Padding(
          padding: EdgeInsets.only(
            left: isFullscreen ? 24 : 16,
            right: isFullscreen ? 24 : 16,
            top: 12,
            bottom: bottomPadding + 8,
          ),
          child: Row(
            children: [
              // 播放/暂停按钮
              GestureDetector(
                onTap: _manager.togglePlayPause,
                child: Icon(
                  state.isPlaying ? Icons.pause : Icons.play_arrow,
                  color: Colors.white,
                  size: 28,
                ),
              ),
              const SizedBox(width: 12),
              // 当前时间
              Text(
                _formatDuration(state.position),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                ),
              ),
              const SizedBox(width: 12),
              // 进度条
              Expanded(
                child: _buildProgressBar(state),
              ),
              const SizedBox(width: 12),
              // 总时长
              Text(
                _formatDuration(state.duration),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                ),
              ),
              const SizedBox(width: 16),
              // 清晰度按钮
              GestureDetector(
                onTap: () => _showQualityMenu(),
                child: const Text(
                  '流畅',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              // 全屏按钮
              GestureDetector(
                onTap: () => _toggleFullscreen(),
                child: Icon(
                  isFullscreen ? Icons.fullscreen_exit : Icons.fullscreen,
                  color: Colors.white,
                  size: 24,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 构建黄色进度条
  Widget _buildProgressBar(PlayerState state) {
    final progress = state.duration.inMilliseconds > 0
        ? state.position.inMilliseconds / state.duration.inMilliseconds
        : 0.0;

    return LayoutBuilder(
      builder: (context, constraints) {
        return GestureDetector(
          onHorizontalDragStart: (details) {
            _resetHideControlsTimer();
          },
          onHorizontalDragUpdate: (details) {
            final localX = details.localPosition.dx;
            final newProgress = (localX / constraints.maxWidth).clamp(0.0, 1.0);
            final newPosition = Duration(
              milliseconds: (state.duration.inMilliseconds * newProgress).round(),
            );
            _manager.seekTo(newPosition);
          },
          onHorizontalDragEnd: (details) {
            _resetHideControlsTimer();
          },
          onTapDown: (details) {
            final localX = details.localPosition.dx;
            final newProgress = (localX / constraints.maxWidth).clamp(0.0, 1.0);
            final newPosition = Duration(
              milliseconds: (state.duration.inMilliseconds * newProgress).round(),
            );
            _manager.seekTo(newPosition);
            _resetHideControlsTimer();
          },
          child: Container(
            height: 20,
            alignment: Alignment.center,
            color: Colors.transparent, // 确保整个区域可点击
            child: Stack(
              alignment: Alignment.centerLeft,
              children: [
                // 背景轨道
                Container(
                  height: 3,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(1.5),
                  ),
                ),
                // 已播放进度
                FractionallySizedBox(
                  widthFactor: progress.clamp(0.0, 1.0),
                  child: Container(
                    height: 3,
                    decoration: BoxDecoration(
                      color: _accentColor,
                      borderRadius: BorderRadius.circular(1.5),
                    ),
                  ),
                ),
                // 圆形滑块
                Positioned(
                  left: (constraints.maxWidth * progress.clamp(0.0, 1.0) - 6).clamp(0.0, constraints.maxWidth - 12),
                  child: Container(
                    width: 12,
                    height: 12,
                    decoration: const BoxDecoration(
                      color: _accentColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  /// 顶部图标按钮
  Widget _buildTopIconButton({
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Icon(
          icon,
          color: Colors.white,
          size: 22,
        ),
      ),
    );
  }

  /// 处理返回
  void _handleBack() {
    if (_manager.playerMode.value == PlayerMode.fullscreen) {
      _manager.exitFullscreen();
    } else {
      Get.back();
    }
  }

  /// 切换全屏
  void _toggleFullscreen() {
    if (_manager.playerMode.value == PlayerMode.fullscreen) {
      _manager.exitFullscreen();
    } else {
      _manager.enterFullscreen();
    }
  }

  /// 显示设置菜单
  void _showSettingsMenu() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.black87,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.speed, color: Colors.white),
              title: const Text('播放速度', style: TextStyle(color: Colors.white)),
              trailing: Text(
                '${_manager.currentState.value.playbackSpeed}x',
                style: const TextStyle(color: _accentColor),
              ),
              onTap: () {
                Navigator.pop(context);
                PlayerUtils.showSpeedSelector(_manager);
              },
            ),
            if (_manager.currentState.value.contentType == ContentType.tv)
              ListTile(
                leading: const Icon(Icons.list, color: Colors.white),
                title: const Text('选集', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  PlayerUtils.showEpisodeSelector(_manager);
                },
              ),
          ],
        ),
      ),
    );
  }

  /// 显示清晰度菜单
  void _showQualityMenu() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.black87,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildQualityOption('蓝光', '1080P'),
            _buildQualityOption('超清', '720P'),
            _buildQualityOption('高清', '480P'),
            _buildQualityOption('流畅', '360P', isSelected: true),
          ],
        ),
      ),
    );
  }

  Widget _buildQualityOption(String label, String resolution, {bool isSelected = false}) {
    return ListTile(
      title: Text(
        '$label $resolution',
        style: TextStyle(
          color: isSelected ? _accentColor : Colors.white,
        ),
      ),
      trailing: isSelected
          ? const Icon(Icons.check, color: _accentColor)
          : null,
      onTap: () => Navigator.pop(context),
    );
  }

  /// 构建加载指示器
  Widget _buildLoadingIndicator() {
    return const Center(
      child: CircularProgressIndicator(
        valueColor: AlwaysStoppedAnimation<Color>(_accentColor),
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
              _manager.switchContent(
                contentType: _manager.currentState.value.contentType,
                contentId: _manager.currentState.value.contentId,
                episodeIndex: _manager.currentState.value.episodeIndex,
                config: _manager.currentConfig.value,
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: _accentColor,
            ),
            child: const Text('重试'),
          ),
        ],
      ),
    );
  }

  /// 构建画中画模式的简化控制栏
  Widget _buildPipControls(PlayerState state) {
    return Stack(
      children: [
        // 中央播放/暂停按钮
        Center(
          child: GestureDetector(
            onTap: _manager.togglePlayPause,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.6),
                shape: BoxShape.circle,
              ),
              child: Icon(
                state.isPlaying ? Icons.pause : Icons.play_arrow,
                color: Colors.white,
                size: 24,
              ),
            ),
          ),
        ),
        
        // 底部简化进度条
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          child: Container(
            height: 3,
            margin: const EdgeInsets.symmetric(horizontal: 8),
            child: _buildSimpleProgressBar(state),
          ),
        ),
      ],
    );
  }

  /// 构建简化的进度条（画中画模式用）
  Widget _buildSimpleProgressBar(PlayerState state) {
    final progress = state.duration.inMilliseconds > 0
        ? state.position.inMilliseconds / state.duration.inMilliseconds
        : 0.0;

    return Stack(
      alignment: Alignment.centerLeft,
      children: [
        // 背景轨道
        Container(
          height: 3,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.3),
            borderRadius: BorderRadius.circular(1.5),
          ),
        ),
        // 已播放进度
        FractionallySizedBox(
          widthFactor: progress.clamp(0.0, 1.0),
          child: Container(
            height: 3,
            decoration: BoxDecoration(
              color: _accentColor,
              borderRadius: BorderRadius.circular(1.5),
            ),
          ),
        ),
      ],
    );
  }

  /// 格式化时长
  String _formatDuration(Duration duration) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);

    if (hours > 0) {
      return '$hours:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    } else {
      return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    }
  }

  // ==================== 🚀 手势控制 ====================

  /// 处理点击（双击暂停/播放）
  void _handleTap() {
    final now = DateTime.now();
    
    if (_lastTapTime != null && 
        now.difference(_lastTapTime!) < _doubleTapInterval) {
      // 双击：切换播放/暂停
      _manager.togglePlayPause();
      _lastTapTime = null;
    } else {
      // 单击：切换控制栏
      _lastTapTime = now;
      
      // 延迟执行单击操作，等待可能的双击
      Future.delayed(_doubleTapInterval, () {
        if (_lastTapTime != null && 
            DateTime.now().difference(_lastTapTime!) >= _doubleTapInterval) {
          if (widget.onTap != null) {
            widget.onTap!();
          } else {
            _toggleControls();
          }
          _lastTapTime = null;
        }
      });
    }
  }

  /// 垂直滑动开始
  void _onVerticalDragStart(DragStartDetails details) {
    final screenWidth = MediaQuery.of(context).size.width;
    final touchX = details.localPosition.dx;
    
    _isVerticalDragging = true;
    _isDraggingLeft = touchX < screenWidth / 2;
    _startDragY = details.localPosition.dy;
    
    // 显示对应的指示器
    setState(() {
      if (_isDraggingLeft) {
        _showBrightnessIndicator = true;
      } else {
        _showVolumeIndicator = true;
      }
    });
  }

  /// 垂直滑动更新
  void _onVerticalDragUpdate(DragUpdateDetails details) {
    if (!_isVerticalDragging) return;
    
    final screenHeight = MediaQuery.of(context).size.height;
    final deltaY = _startDragY - details.localPosition.dy;
    final deltaPercent = deltaY / (screenHeight * 0.5); // 滑动半屏改变100%
    
    if (_isDraggingLeft) {
      // 左侧：调整亮度
      _adjustBrightness(deltaPercent);
    } else {
      // 右侧：调整音量
      _adjustVolume(deltaPercent);
    }
    
    _startDragY = details.localPosition.dy;
  }

  /// 垂直滑动结束
  void _onVerticalDragEnd(DragEndDetails details) {
    _isVerticalDragging = false;
    
    // 延迟隐藏指示器
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted && !_isVerticalDragging) {
        setState(() {
          _showVolumeIndicator = false;
          _showBrightnessIndicator = false;
        });
      }
    });
  }

  /// 调整音量
  void _adjustVolume(double delta) {
    _currentVolume = (_currentVolume + delta).clamp(0.0, 1.0);
    
    try {
      VolumeController().setVolume(_currentVolume);
      if (mounted) setState(() {});
    } catch (e) {
      print('❌ [Player] Failed to set volume: $e');
    }
  }

  /// 调整亮度
  Future<void> _adjustBrightness(double delta) async {
    _currentBrightness = (_currentBrightness + delta).clamp(0.0, 1.0);
    
    try {
      await ScreenBrightness().setScreenBrightness(_currentBrightness);
      if (mounted) setState(() {});
    } catch (e) {
      print('❌ [Player] Failed to set brightness: $e');
    }
  }

  /// 构建音量指示器
  Widget _buildVolumeIndicator() {
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _currentVolume == 0 
                  ? Icons.volume_off 
                  : _currentVolume < 0.5 
                      ? Icons.volume_down 
                      : Icons.volume_up,
              color: Colors.white,
              size: 28,
            ),
            const SizedBox(width: 12),
            SizedBox(
              width: 100,
              child: LinearProgressIndicator(
                value: _currentVolume,
                backgroundColor: Colors.white24,
                valueColor: const AlwaysStoppedAnimation<Color>(_accentColor),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '${(_currentVolume * 100).round()}%',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 构建亮度指示器
  Widget _buildBrightnessIndicator() {
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _currentBrightness < 0.3 
                  ? Icons.brightness_low 
                  : _currentBrightness < 0.7 
                      ? Icons.brightness_medium 
                      : Icons.brightness_high,
              color: Colors.white,
              size: 28,
            ),
            const SizedBox(width: 12),
            SizedBox(
              width: 100,
              child: LinearProgressIndicator(
                value: _currentBrightness,
                backgroundColor: Colors.white24,
                valueColor: const AlwaysStoppedAnimation<Color>(_accentColor),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '${(_currentBrightness * 100).round()}%',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
