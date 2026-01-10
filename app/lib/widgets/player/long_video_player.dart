import 'dart:async';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:volume_controller/volume_controller.dart';
import 'package:screen_brightness/screen_brightness.dart';
import '../../core/player/global_player_manager.dart';
import '../../core/player/player_enums.dart';
import '../../core/player/player_state.dart';
import '../../core/pip_manager.dart';
import '../../core/logger.dart';
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
    VolumeController.instance.showSystemUI = true;
    super.dispose();
  }
  
  Future<void> _initVolumeAndBrightness() async {
    try {
      VolumeController.instance.showSystemUI = false;
      _currentVolume = await VolumeController.instance.getVolume();
    } catch (e) {
      Logger.error('[Player] Failed to get volume: $e');
    }
    try {
      _currentBrightness = await ScreenBrightness.instance.application;
    } catch (e) {
      Logger.error('[Player] Failed to get brightness: $e');
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
    if (_showControls) _resetHideControlsTimer();
  }

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final videoController = _manager.videoController;
      final state = _manager.currentState.value;
      final isLoading = _manager.isLoading.value;
      final error = _manager.error.value;

      if (state.isPlaying && _showControls) {
        _resetHideControlsTimer();
      }

      return GestureDetector(
        onTap: _toggleControls,
        onDoubleTap: _manager.togglePlayPause,
        onVerticalDragStart: _onVerticalDragStart,
        onVerticalDragUpdate: _onVerticalDragUpdate,
        onVerticalDragEnd: _onVerticalDragEnd,
        child: Container(
          color: Colors.black,
          child: Stack(
            fit: StackFit.expand,
            children: [
              _buildVideoPlayer(videoController),
              if (isLoading) _buildLoadingIndicator(),
              if (error.isNotEmpty) _buildErrorIndicator(error),
              if (widget.showControls && !isLoading && error.isEmpty)
                AnimatedOpacity(
                  opacity: _showControls ? 1.0 : 0.0,
                  duration: const Duration(milliseconds: 200),
                  child: IgnorePointer(
                    ignoring: !_showControls,
                    child: _buildControls(state),
                  ),
                ),
              if (_showVolumeIndicator) _buildVolumeIndicator(),
              if (_showBrightnessIndicator) _buildBrightnessIndicator(),
              Obx(() => _manager.showPauseAd.value
                  ? PauseOverlayAd(
                      adData: _manager.pauseAdData.value,
                      onAdTap: _manager.onPauseAdTap,
                      onClose: _manager.closePauseAd,
                    )
                  : const SizedBox.shrink()),
              if (widget.overlay != null) widget.overlay!,
            ],
          ),
        ),
      );
    });
  }

  Widget _buildVideoPlayer(VideoController? videoController) {
    if (videoController == null) {
      return Container(
        color: Colors.black,
        child: const Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(_accentColor),
          ),
        ),
      );
    }
    return SizedBox.expand(
      child: Video(
        controller: videoController,
        fit: BoxFit.contain,
        controls: NoVideoControls,
      ),
    );
  }

  Widget _buildControls(PlayerState state) {
    final isPipMode = _manager.playerMode.value == PlayerMode.pip;
    if (isPipMode) return _buildPipControls(state);
    return Stack(children: [_buildTopBar(state), _buildBottomBar(state)]);
  }

  Widget _buildTopBar(PlayerState state) {
    final isFullscreen = _manager.playerMode.value == PlayerMode.fullscreen;
    final topPadding = isFullscreen ? 8.0 : MediaQuery.of(context).padding.top;
    return Positioned(
      top: 0, left: 0, right: 0,
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter, end: Alignment.bottomCenter,
            colors: [Colors.black54, Colors.transparent],
          ),
        ),
        child: Padding(
          padding: EdgeInsets.only(
            left: isFullscreen ? 24 : 8, right: isFullscreen ? 24 : 8,
            top: topPadding + 8, bottom: 8,
          ),
          child: Row(children: [
            GestureDetector(
              onTap: _handleBack,
              child: const Padding(padding: EdgeInsets.all(8), child: Icon(Icons.arrow_back, color: Colors.white, size: 24)),
            ),
            const SizedBox(width: 12),
            Expanded(child: Text(PlayerControlsBase.getTitle(state), style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w500), maxLines: 1, overflow: TextOverflow.ellipsis)),
            Row(mainAxisSize: MainAxisSize.min, children: [
              _buildTopIconButton(icon: Icons.cast, onTap: () => PlayerUtils.showCastDialog()),
              _buildTopIconButton(icon: Icons.picture_in_picture_alt, onTap: () => PipManager.to.enterPipMode()),
              _buildTopIconButton(icon: Icons.settings, onTap: _showSettingsMenu),
            ]),
          ]),
        ),
      ),
    );
  }

  Widget _buildBottomBar(PlayerState state) {
    final isFullscreen = _manager.playerMode.value == PlayerMode.fullscreen;
    final bottomPadding = isFullscreen ? 8.0 : MediaQuery.of(context).padding.bottom;
    return Positioned(
      bottom: 0, left: 0, right: 0,
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [Colors.black54, Colors.transparent]),
        ),
        child: Padding(
          padding: EdgeInsets.only(left: isFullscreen ? 24 : 16, right: isFullscreen ? 24 : 16, top: 12, bottom: bottomPadding + 8),
          child: Row(children: [
            GestureDetector(onTap: _manager.togglePlayPause, child: Icon(state.isPlaying ? Icons.pause : Icons.play_arrow, color: Colors.white, size: 28)),
            const SizedBox(width: 12),
            Text(_formatDuration(state.position), style: const TextStyle(color: Colors.white, fontSize: 12)),
            const SizedBox(width: 12),
            Expanded(child: _buildProgressBar(state)),
            const SizedBox(width: 12),
            Text(_formatDuration(state.duration), style: const TextStyle(color: Colors.white, fontSize: 12)),
            const SizedBox(width: 16),
            GestureDetector(onTap: _showQualityMenu, child: const Text('流畅', style: TextStyle(color: Colors.white, fontSize: 12))),
            const SizedBox(width: 16),
            GestureDetector(onTap: _toggleFullscreen, child: Icon(isFullscreen ? Icons.fullscreen_exit : Icons.fullscreen, color: Colors.white, size: 24)),
          ]),
        ),
      ),
    );
  }

  Widget _buildProgressBar(PlayerState state) {
    final progress = state.duration.inMilliseconds > 0 ? state.position.inMilliseconds / state.duration.inMilliseconds : 0.0;
    return LayoutBuilder(builder: (context, constraints) {
      return GestureDetector(
        onHorizontalDragStart: (_) => _resetHideControlsTimer(),
        onHorizontalDragUpdate: (details) {
          final newProgress = (details.localPosition.dx / constraints.maxWidth).clamp(0.0, 1.0);
          _manager.seekTo(Duration(milliseconds: (state.duration.inMilliseconds * newProgress).round()));
        },
        onHorizontalDragEnd: (_) => _resetHideControlsTimer(),
        onTapDown: (details) {
          final newProgress = (details.localPosition.dx / constraints.maxWidth).clamp(0.0, 1.0);
          _manager.seekTo(Duration(milliseconds: (state.duration.inMilliseconds * newProgress).round()));
          _resetHideControlsTimer();
        },
        child: Container(
          height: 20, alignment: Alignment.center, color: Colors.transparent,
          child: Stack(alignment: Alignment.centerLeft, children: [
            Container(height: 3, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(1.5))),
            FractionallySizedBox(widthFactor: progress.clamp(0.0, 1.0), child: Container(height: 3, decoration: BoxDecoration(color: _accentColor, borderRadius: BorderRadius.circular(1.5)))),
            Positioned(left: (constraints.maxWidth * progress.clamp(0.0, 1.0) - 6).clamp(0.0, constraints.maxWidth - 12), child: Container(width: 12, height: 12, decoration: const BoxDecoration(color: _accentColor, shape: BoxShape.circle))),
          ]),
        ),
      );
    });
  }

  Widget _buildTopIconButton({required IconData icon, required VoidCallback onTap}) => GestureDetector(onTap: onTap, child: Padding(padding: const EdgeInsets.all(8), child: Icon(icon, color: Colors.white, size: 22)));

  void _handleBack() { if (_manager.playerMode.value == PlayerMode.fullscreen) _manager.exitFullscreen(); else Get.back(); }
  void _toggleFullscreen() { if (_manager.playerMode.value == PlayerMode.fullscreen) _manager.exitFullscreen(); else _manager.enterFullscreen(); }

  void _showSettingsMenu() {
    showModalBottomSheet(context: context, backgroundColor: Colors.black87, builder: (context) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
      ListTile(leading: const Icon(Icons.speed, color: Colors.white), title: const Text('播放速度', style: TextStyle(color: Colors.white)), trailing: Text('${_manager.currentState.value.playbackSpeed}x', style: const TextStyle(color: _accentColor)), onTap: () { Navigator.pop(context); PlayerUtils.showSpeedSelector(_manager); }),
      if (_manager.currentState.value.contentType == ContentType.tv) ListTile(leading: const Icon(Icons.list, color: Colors.white), title: const Text('选集', style: TextStyle(color: Colors.white)), onTap: () { Navigator.pop(context); PlayerUtils.showEpisodeSelector(_manager); }),
    ])));
  }

  void _showQualityMenu() {
    showModalBottomSheet(context: context, backgroundColor: Colors.black87, builder: (context) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
      _buildQualityOption('蓝光', '1080P'), _buildQualityOption('超清', '720P'), _buildQualityOption('高清', '480P'), _buildQualityOption('流畅', '360P', isSelected: true),
    ])));
  }

  Widget _buildQualityOption(String label, String resolution, {bool isSelected = false}) => ListTile(title: Text('$label $resolution', style: TextStyle(color: isSelected ? _accentColor : Colors.white)), trailing: isSelected ? const Icon(Icons.check, color: _accentColor) : null, onTap: () => Navigator.pop(context));
  Widget _buildLoadingIndicator() => const Center(child: CircularProgressIndicator(valueColor: AlwaysStoppedAnimation<Color>(_accentColor)));
  Widget _buildErrorIndicator(String error) => Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.error_outline, color: Colors.white54, size: 48), const SizedBox(height: 16), Padding(padding: const EdgeInsets.symmetric(horizontal: 32), child: Text(error, style: const TextStyle(color: Colors.white, fontSize: 14), textAlign: TextAlign.center)), const SizedBox(height: 16), ElevatedButton(onPressed: () { _manager.switchContent(contentType: _manager.currentState.value.contentType, contentId: _manager.currentState.value.contentId, episodeIndex: _manager.currentState.value.episodeIndex, config: _manager.currentConfig.value); }, style: ElevatedButton.styleFrom(backgroundColor: _accentColor), child: const Text('重试'))]));
  Widget _buildPipControls(PlayerState state) => Stack(children: [Center(child: GestureDetector(onTap: _manager.togglePlayPause, child: Container(width: 40, height: 40, decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.6), shape: BoxShape.circle), child: Icon(state.isPlaying ? Icons.pause : Icons.play_arrow, color: Colors.white, size: 24)))), Positioned(bottom: 0, left: 0, right: 0, child: Container(height: 3, margin: const EdgeInsets.symmetric(horizontal: 8), child: _buildSimpleProgressBar(state)))]);
  Widget _buildSimpleProgressBar(PlayerState state) { final progress = state.duration.inMilliseconds > 0 ? state.position.inMilliseconds / state.duration.inMilliseconds : 0.0; return Stack(alignment: Alignment.centerLeft, children: [Container(height: 3, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(1.5))), FractionallySizedBox(widthFactor: progress.clamp(0.0, 1.0), child: Container(height: 3, decoration: BoxDecoration(color: _accentColor, borderRadius: BorderRadius.circular(1.5))))]); }
  String _formatDuration(Duration duration) { final hours = duration.inHours; final minutes = duration.inMinutes.remainder(60); final seconds = duration.inSeconds.remainder(60); if (hours > 0) return '$hours:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}'; return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}'; }

  void _onVerticalDragStart(DragStartDetails details) { final screenWidth = MediaQuery.of(context).size.width; _isVerticalDragging = true; _isDraggingLeft = details.localPosition.dx < screenWidth / 2; _startDragY = details.localPosition.dy; setState(() { if (_isDraggingLeft) _showBrightnessIndicator = true; else _showVolumeIndicator = true; }); }
  void _onVerticalDragUpdate(DragUpdateDetails details) { if (!_isVerticalDragging) return; final screenHeight = MediaQuery.of(context).size.height; final deltaY = _startDragY - details.localPosition.dy; final deltaPercent = deltaY / (screenHeight * 0.5); if (_isDraggingLeft) _adjustBrightness(deltaPercent); else _adjustVolume(deltaPercent); _startDragY = details.localPosition.dy; }
  void _onVerticalDragEnd(DragEndDetails details) { _isVerticalDragging = false; Future.delayed(const Duration(milliseconds: 500), () { if (mounted && !_isVerticalDragging) setState(() { _showVolumeIndicator = false; _showBrightnessIndicator = false; }); }); }
  void _adjustVolume(double delta) { _currentVolume = (_currentVolume + delta).clamp(0.0, 1.0); try { VolumeController.instance.setVolume(_currentVolume); if (mounted) setState(() {}); } catch (e) { Logger.error('[Player] Failed to set volume: $e'); } }
  Future<void> _adjustBrightness(double delta) async { _currentBrightness = (_currentBrightness + delta).clamp(0.0, 1.0); try { await ScreenBrightness.instance.setApplicationScreenBrightness(_currentBrightness); if (mounted) setState(() {}); } catch (e) { Logger.error('[Player] Failed to set brightness: $e'); } }
  Widget _buildVolumeIndicator() => Center(child: Container(padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16), decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(8)), child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(_currentVolume == 0 ? Icons.volume_off : _currentVolume < 0.5 ? Icons.volume_down : Icons.volume_up, color: Colors.white, size: 28), const SizedBox(width: 12), SizedBox(width: 100, child: LinearProgressIndicator(value: _currentVolume, backgroundColor: Colors.white24, valueColor: const AlwaysStoppedAnimation<Color>(_accentColor))), const SizedBox(width: 8), Text('${(_currentVolume * 100).round()}%', style: const TextStyle(color: Colors.white, fontSize: 14))])));
  Widget _buildBrightnessIndicator() => Center(child: Container(padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16), decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(8)), child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(_currentBrightness < 0.3 ? Icons.brightness_low : _currentBrightness < 0.7 ? Icons.brightness_medium : Icons.brightness_high, color: Colors.white, size: 28), const SizedBox(width: 12), SizedBox(width: 100, child: LinearProgressIndicator(value: _currentBrightness, backgroundColor: Colors.white24, valueColor: const AlwaysStoppedAnimation<Color>(_accentColor))), const SizedBox(width: 8), Text('${(_currentBrightness * 100).round()}%', style: const TextStyle(color: Colors.white, fontSize: 14))])));
}
