import 'dart:async';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:volume_controller/volume_controller.dart';
import 'package:screen_brightness/screen_brightness.dart';
import '../../core/player/global_player_manager.dart';
import '../../core/player/player_enums.dart';
import '../../core/player/player_state.dart' show AppPlayerState;
import '../../core/pip_manager.dart';
import '../../core/logger.dart';
import '../../core/platform_utils.dart';
import 'shared/player_controls_base.dart';
import 'shared/player_utils.dart';
import 'pause_overlay_ad.dart';

/// 长视频专用播放器UI (基于 media_kit)
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
  
  static const Color _accentColor = Color(0xFFFFB800);
  
  bool _showControls = true;
  Timer? _hideControlsTimer;
  
  bool _isVerticalDragging = false;
  bool _isDraggingLeft = false;
  double _startDragY = 0;
  double _currentVolume = 0.5;
  double _currentBrightness = 0.5;
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
    // 仅在移动端恢复系统音量 UI
    if (PlatformUtils.supportsVolumeGesture) {
      VolumeController.instance.showSystemUI = true;
    }
    super.dispose();
  }
  
  Future<void> _initVolumeAndBrightness() async {
    // 仅在移动端初始化音量和亮度控制
    if (PlatformUtils.supportsVolumeGesture) {
      try {
        VolumeController.instance.showSystemUI = false;
        _currentVolume = await VolumeController.instance.getVolume();
      } catch (e) {
        Logger.error('[Player] Failed to get volume: $e');
      }
    }
    
    if (PlatformUtils.supportsBrightnessGesture) {
      try {
        _currentBrightness = await ScreenBrightness.instance.application;
      } catch (e) {
        Logger.error('[Player] Failed to get brightness: $e');
      }
    }
  }

  void _resetHideControlsTimer() {
    _hideControlsTimer?.cancel();
    if (_showControls && _manager.currentState.value.isPlaying) {
      _hideControlsTimer = Timer(const Duration(seconds: 4), () {
        if (mounted && _manager.currentState.value.isPlaying) {
          setState(() => _showControls = false);
        }
      });
    }
  }

  void _toggleControls() {
    setState(() => _showControls = !_showControls);
    if (_showControls) {
      _resetHideControlsTimer();
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _toggleControls,
      onDoubleTap: _manager.togglePlayPause,
      // 仅在移动端启用音量/亮度手势控制
      onVerticalDragStart: PlatformUtils.isMobile ? _onVerticalDragStart : null,
      onVerticalDragUpdate: PlatformUtils.isMobile ? _onVerticalDragUpdate : null,
      onVerticalDragEnd: PlatformUtils.isMobile ? _onVerticalDragEnd : null,
      child: Container(
        color: Colors.black,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // 🚀 视频播放器层（独立 Obx + RepaintBoundary）
            RepaintBoundary(
              child: _VideoPlayerWidget(manager: _manager),
            ),
            // 🚀 加载指示器（独立 Obx）
            _LoadingIndicator(manager: _manager),
            // 🚀 错误指示器（独立 Obx）
            _ErrorIndicator(manager: _manager),
            // 🚀 控制栏（独立 Obx + RepaintBoundary）
            if (widget.showControls)
              RepaintBoundary(
                child: _ControlsOverlay(
                  manager: _manager,
                  showControls: _showControls,
                  onToggleControls: _toggleControls,
                  onResetTimer: _resetHideControlsTimer,
                ),
              ),
            // 音量/亮度指示器（StatefulWidget 内部状态）
            if (_showVolumeIndicator) _buildVolumeIndicator(),
            if (_showBrightnessIndicator) _buildBrightnessIndicator(),
            // 🚀 暂停广告（独立 Obx）
            _PauseAdOverlay(manager: _manager),
            // 自定义覆盖层
            if (widget.overlay != null) widget.overlay!,
          ],
        ),
      ),
    );
  }

  /// 构建背景占位图（静态方法，供独立 widget 使用）
  static Widget _buildBackgroundPlaceholder() {
    return Stack(
      fit: StackFit.expand,
      children: [
        Image.asset(
          'assets/images/player_background.webp',
          fit: BoxFit.cover,
        ),
        Container(
          color: Colors.black.withValues(alpha: 0.3),
        ),
        const Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(_accentColor),
          ),
        ),
      ],
    );
  }


  void _onVerticalDragStart(DragStartDetails details) {
    final screenWidth = MediaQuery.of(context).size.width;
    _isVerticalDragging = true;
    _isDraggingLeft = details.localPosition.dx < screenWidth / 2;
    _startDragY = details.localPosition.dy;
    setState(() {
      if (_isDraggingLeft) {
        _showBrightnessIndicator = true;
      } else {
        _showVolumeIndicator = true;
      }
    });
  }
  void _onVerticalDragUpdate(DragUpdateDetails details) {
    if (!_isVerticalDragging) return;
    final screenHeight = MediaQuery.of(context).size.height;
    final deltaY = _startDragY - details.localPosition.dy;
    final deltaPercent = deltaY / (screenHeight * 0.5);
    if (_isDraggingLeft) {
      _adjustBrightness(deltaPercent);
    } else {
      _adjustVolume(deltaPercent);
    }
    _startDragY = details.localPosition.dy;
  }
  void _onVerticalDragEnd(DragEndDetails details) {
    _isVerticalDragging = false;
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted && !_isVerticalDragging) {
        setState(() {
          _showVolumeIndicator = false;
          _showBrightnessIndicator = false;
        });
      }
    });
  }
  void _adjustVolume(double delta) {
    _currentVolume = (_currentVolume + delta).clamp(0.0, 1.0);
    // 仅在移动端调整音量
    if (PlatformUtils.supportsVolumeGesture) {
      try {
        VolumeController.instance.setVolume(_currentVolume);
        if (mounted) {
          setState(() {});
        }
      } catch (e) {
        Logger.error('[Player] Failed to set volume: $e');
      }
    }
  }
  Future<void> _adjustBrightness(double delta) async {
    _currentBrightness = (_currentBrightness + delta).clamp(0.0, 1.0);
    // 仅在移动端调整亮度
    if (PlatformUtils.supportsBrightnessGesture) {
      try {
        await ScreenBrightness.instance.setApplicationScreenBrightness(_currentBrightness);
        if (mounted) {
          setState(() {});
        }
      } catch (e) {
        Logger.error('[Player] Failed to set brightness: $e');
      }
    }
  }
  Widget _buildVolumeIndicator() => Center(child: Container(padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16), decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(8)), child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(_currentVolume == 0 ? Icons.volume_off : _currentVolume < 0.5 ? Icons.volume_down : Icons.volume_up, color: Colors.white, size: 28), const SizedBox(width: 12), SizedBox(width: 100, child: LinearProgressIndicator(value: _currentVolume, backgroundColor: Colors.white24, valueColor: const AlwaysStoppedAnimation<Color>(_accentColor))), const SizedBox(width: 8), Text('${(_currentVolume * 100).round()}%', style: const TextStyle(color: Colors.white, fontSize: 14))])));
  Widget _buildBrightnessIndicator() => Center(child: Container(padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16), decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(8)), child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(_currentBrightness < 0.3 ? Icons.brightness_low : _currentBrightness < 0.7 ? Icons.brightness_medium : Icons.brightness_high, color: Colors.white, size: 28), const SizedBox(width: 12), SizedBox(width: 100, child: LinearProgressIndicator(value: _currentBrightness, backgroundColor: Colors.white24, valueColor: const AlwaysStoppedAnimation<Color>(_accentColor))), const SizedBox(width: 8), Text('${(_currentBrightness * 100).round()}%', style: const TextStyle(color: Colors.white, fontSize: 14))])));
}


// ==================== 独立 Widget 组件（优化重建性能）====================

/// 🚀 视频播放器 Widget（独立 Obx，仅在视频控制器或首帧状态变化时重建）
class _VideoPlayerWidget extends StatelessWidget {
  final GlobalPlayerManager manager;

  const _VideoPlayerWidget({required this.manager});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final videoController = manager.videoController;
      final hasFrame = manager.hasVideoFrame.value;

      if (videoController == null) {
        return _LongVideoPlayerState._buildBackgroundPlaceholder();
      }

      return Stack(
        fit: StackFit.expand,
        children: [
          SizedBox.expand(
            child: Video(
              controller: videoController,
              fit: BoxFit.contain,
              controls: NoVideoControls,
            ),
          ),
          if (!hasFrame) _LongVideoPlayerState._buildBackgroundPlaceholder(),
        ],
      );
    });
  }
}

/// 🚀 加载指示器（独立 Obx，仅在加载状态变化时重建）
class _LoadingIndicator extends StatelessWidget {
  final GlobalPlayerManager manager;

  const _LoadingIndicator({required this.manager});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (!manager.isLoading.value) return const SizedBox.shrink();
      return _LongVideoPlayerState._buildBackgroundPlaceholder();
    });
  }
}

/// 🚀 错误指示器（独立 Obx，仅在错误状态变化时重建）
class _ErrorIndicator extends StatelessWidget {
  final GlobalPlayerManager manager;

  const _ErrorIndicator({required this.manager});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final error = manager.error.value;
      if (error.isEmpty) return const SizedBox.shrink();

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
                backgroundColor: const Color(0xFFFFB800),
              ),
              child: const Text('重试'),
            ),
          ],
        ),
      );
    });
  }
}

/// 🚀 控制栏覆盖层（独立 Obx，仅在相关状态变化时重建）
class _ControlsOverlay extends StatelessWidget {
  final GlobalPlayerManager manager;
  final bool showControls;
  final VoidCallback onToggleControls;
  final VoidCallback onResetTimer;

  const _ControlsOverlay({
    required this.manager,
    required this.showControls,
    required this.onToggleControls,
    required this.onResetTimer,
  });

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final isLoading = manager.isLoading.value;
      final error = manager.error.value;
      final state = manager.currentState.value;

      if (isLoading || error.isNotEmpty) {
        return const SizedBox.shrink();
      }

      return AnimatedOpacity(
        opacity: showControls ? 1.0 : 0.0,
        duration: const Duration(milliseconds: 200),
        child: IgnorePointer(
          ignoring: !showControls,
          child: _buildControls(context, state),
        ),
      );
    });
  }

  Widget _buildControls(BuildContext context, AppPlayerState state) {
    final isPipMode = manager.playerMode.value == PlayerMode.pip;
    if (isPipMode) {
      return _buildPipControls(state);
    }
    return Stack(
      children: [
        _buildTopBar(context, state),
        _buildBottomBar(context, state),
      ],
    );
  }

  Widget _buildTopBar(BuildContext context, AppPlayerState state) {
    final isFullscreen = manager.playerMode.value == PlayerMode.fullscreen;
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
              GestureDetector(
                onTap: () => _handleBack(context),
                child: const Padding(
                  padding: EdgeInsets.all(8),
                  child: Icon(Icons.arrow_back, color: Colors.white, size: 24),
                ),
              ),
              const SizedBox(width: 12),
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
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _buildTopIconButton(
                    icon: Icons.cast,
                    onTap: () => PlayerUtils.showCastDialog(),
                  ),
                  _buildTopIconButton(
                    icon: Icons.picture_in_picture_alt,
                    onTap: () => PipManager.to.enterPipMode(),
                  ),
                  _buildTopIconButton(
                    icon: Icons.settings,
                    onTap: () => _showSettingsMenu(context),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBottomBar(BuildContext context, AppPlayerState state) {
    final isFullscreen = manager.playerMode.value == PlayerMode.fullscreen;
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
              GestureDetector(
                onTap: manager.togglePlayPause,
                child: Icon(
                  state.isPlaying ? Icons.pause : Icons.play_arrow,
                  color: Colors.white,
                  size: 28,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                _formatDuration(state.position),
                style: const TextStyle(color: Colors.white, fontSize: 12),
              ),
              const SizedBox(width: 12),
              Expanded(child: _buildProgressBar(state)),
              const SizedBox(width: 12),
              Text(
                _formatDuration(state.duration),
                style: const TextStyle(color: Colors.white, fontSize: 12),
              ),
              const SizedBox(width: 16),
              GestureDetector(
                onTap: () => _showQualityMenu(context),
                child: const Text(
                  '流畅',
                  style: TextStyle(color: Colors.white, fontSize: 12),
                ),
              ),
              const SizedBox(width: 16),
              GestureDetector(
                onTap: _toggleFullscreen,
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

  Widget _buildProgressBar(AppPlayerState state) {
    final progress = state.duration.inMilliseconds > 0
        ? state.position.inMilliseconds / state.duration.inMilliseconds
        : 0.0;
    
    return LayoutBuilder(
      builder: (context, constraints) {
        return GestureDetector(
          onHorizontalDragStart: (_) => onResetTimer(),
          onHorizontalDragUpdate: (details) {
            final newProgress = (details.localPosition.dx / constraints.maxWidth).clamp(0.0, 1.0);
            manager.seekTo(Duration(milliseconds: (state.duration.inMilliseconds * newProgress).round()));
          },
          onHorizontalDragEnd: (_) => onResetTimer(),
          onTapDown: (details) {
            final newProgress = (details.localPosition.dx / constraints.maxWidth).clamp(0.0, 1.0);
            manager.seekTo(Duration(milliseconds: (state.duration.inMilliseconds * newProgress).round()));
            onResetTimer();
          },
          child: Container(
            height: 20,
            alignment: Alignment.center,
            color: Colors.transparent,
            child: Stack(
              alignment: Alignment.centerLeft,
              children: [
                Container(
                  height: 3,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(1.5),
                  ),
                ),
                FractionallySizedBox(
                  widthFactor: progress.clamp(0.0, 1.0),
                  child: Container(
                    height: 3,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFB800),
                      borderRadius: BorderRadius.circular(1.5),
                    ),
                  ),
                ),
                Positioned(
                  left: (constraints.maxWidth * progress.clamp(0.0, 1.0) - 6).clamp(0.0, constraints.maxWidth - 12),
                  child: Container(
                    width: 12,
                    height: 12,
                    decoration: const BoxDecoration(
                      color: Color(0xFFFFB800),
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

  Widget _buildTopIconButton({required IconData icon, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Icon(icon, color: Colors.white, size: 22),
      ),
    );
  }

  void _handleBack(BuildContext context) {
    if (manager.playerMode.value == PlayerMode.fullscreen) {
      manager.exitFullscreen();
    } else {
      Get.back();
    }
  }

  void _toggleFullscreen() {
    if (manager.playerMode.value == PlayerMode.fullscreen) {
      manager.exitFullscreen();
    } else {
      manager.enterFullscreen();
    }
  }

  void _showSettingsMenu(BuildContext context) {
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
                '${manager.currentState.value.playbackSpeed}x',
                style: const TextStyle(color: Color(0xFFFFB800)),
              ),
              onTap: () {
                Navigator.pop(context);
                PlayerUtils.showSpeedSelector(manager);
              },
            ),
            if (manager.currentState.value.contentType == ContentType.tv)
              ListTile(
                leading: const Icon(Icons.list, color: Colors.white),
                title: const Text('选集', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  PlayerUtils.showEpisodeSelector(manager);
                },
              ),
          ],
        ),
      ),
    );
  }

  void _showQualityMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.black87,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildQualityOption(context, '蓝光', '1080P'),
            _buildQualityOption(context, '超清', '720P'),
            _buildQualityOption(context, '高清', '480P'),
            _buildQualityOption(context, '流畅', '360P', isSelected: true),
          ],
        ),
      ),
    );
  }

  Widget _buildQualityOption(BuildContext context, String label, String resolution, {bool isSelected = false}) {
    return ListTile(
      title: Text(
        '$label $resolution',
        style: TextStyle(color: isSelected ? const Color(0xFFFFB800) : Colors.white),
      ),
      trailing: isSelected ? const Icon(Icons.check, color: Color(0xFFFFB800)) : null,
      onTap: () => Navigator.pop(context),
    );
  }

  Widget _buildPipControls(AppPlayerState state) {
    return Stack(
      children: [
        Center(
          child: GestureDetector(
            onTap: manager.togglePlayPause,
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

  Widget _buildSimpleProgressBar(AppPlayerState state) {
    final progress = state.duration.inMilliseconds > 0
        ? state.position.inMilliseconds / state.duration.inMilliseconds
        : 0.0;
    
    return Stack(
      alignment: Alignment.centerLeft,
      children: [
        Container(
          height: 3,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.3),
            borderRadius: BorderRadius.circular(1.5),
          ),
        ),
        FractionallySizedBox(
          widthFactor: progress.clamp(0.0, 1.0),
          child: Container(
            height: 3,
            decoration: BoxDecoration(
              color: const Color(0xFFFFB800),
              borderRadius: BorderRadius.circular(1.5),
            ),
          ),
        ),
      ],
    );
  }

  String _formatDuration(Duration duration) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);
    
    if (hours > 0) {
      return '$hours:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    }
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }
}

/// 🚀 暂停广告覆盖层（独立 Obx，仅在广告状态变化时重建）
class _PauseAdOverlay extends StatelessWidget {
  final GlobalPlayerManager manager;

  const _PauseAdOverlay({required this.manager});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (!manager.showPauseAd.value) return const SizedBox.shrink();
      
      return PauseOverlayAd(
        adData: manager.pauseAdData.value,
        onAdTap: manager.onPauseAdTap,
        onClose: manager.closePauseAd,
      );
    });
  }
}
