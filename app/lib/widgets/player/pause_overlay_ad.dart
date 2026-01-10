import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import '../../widgets/net_image.dart';
import '../../core/logger.dart';

/// 暂停广告覆盖层
/// 在视频暂停时显示广告内容，支持图片和视频广告
class PauseOverlayAd extends StatefulWidget {
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
  State<PauseOverlayAd> createState() => _PauseOverlayAdState();
}

class _PauseOverlayAdState extends State<PauseOverlayAd> {
  VideoPlayerController? _videoController;
  bool _isVideoInitialized = false;
  bool _isVideoPlaying = false;

  @override
  void initState() {
    super.initState();
    _initVideoIfNeeded();
  }

  @override
  void didUpdateWidget(PauseOverlayAd oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.adData != oldWidget.adData) {
      _disposeVideo();
      _initVideoIfNeeded();
    }
  }

  @override
  void dispose() {
    _disposeVideo();
    super.dispose();
  }

  void _disposeVideo() {
    _videoController?.dispose();
    _videoController = null;
    _isVideoInitialized = false;
    _isVideoPlaying = false;
  }

  Future<void> _initVideoIfNeeded() async {
    if (widget.adData == null) return;

    final contentType = widget.adData!['content_type'] as String? ?? 'image';
    final mediaUrl = widget.adData!['media_url'] as String? ?? '';

    if (contentType == 'video' && mediaUrl.isNotEmpty) {
      try {
        _videoController = VideoPlayerController.networkUrl(Uri.parse(mediaUrl));
        await _videoController!.initialize();
        _videoController!.setLooping(true);
        _videoController!.setVolume(0); // 默认静音

        if (mounted) {
          setState(() {
            _isVideoInitialized = true;
          });
          // 自动播放
          _videoController!.play();
          _isVideoPlaying = true;
        }
      } catch (e) {
        Logger.error('[PauseOverlayAd] Failed to init video: $e');
      }
    }
  }

  void _toggleVideoPlay() {
    if (_videoController == null || !_isVideoInitialized) return;

    setState(() {
      if (_isVideoPlaying) {
        _videoController!.pause();
      } else {
        _videoController!.play();
      }
      _isVideoPlaying = !_isVideoPlaying;
    });
  }

  void _toggleMute() {
    if (_videoController == null) return;
    final currentVolume = _videoController!.value.volume;
    _videoController!.setVolume(currentVolume > 0 ? 0 : 1);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    if (widget.adData == null) return const SizedBox.shrink();

    final contentType = widget.adData!['content_type'] as String? ?? 'image';
    final mediaUrl = widget.adData!['media_url'] as String? ?? '';
    final title = widget.adData!['title'] as String? ?? '';
    final description = widget.adData!['description'] as String? ?? '';

    return Container(
      color: Colors.black.withValues(alpha: 0.8),
      child: Stack(
        children: [
          // 广告内容
          Center(
            child: GestureDetector(
              onTap: widget.onAdTap,
              child: Container(
                margin: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.3),
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
          if (widget.onClose != null)
            Positioned(
              top: MediaQuery.of(context).padding.top + 16,
              right: 16,
              child: GestureDetector(
                onTap: widget.onClose,
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.6),
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
                color: Colors.black.withValues(alpha: 0.6),
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
        return ClipRRect(
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(12),
            topRight: Radius.circular(12),
          ),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: _buildVideoPlayer(),
          ),
        );
      default:
        return const SizedBox.shrink();
    }
  }

  /// 构建视频播放器
  Widget _buildVideoPlayer() {
    if (!_isVideoInitialized || _videoController == null) {
      return Container(
        color: Colors.black,
        child: const Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
            strokeWidth: 2,
          ),
        ),
      );
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        // 视频
        FittedBox(
          fit: BoxFit.cover,
          child: SizedBox(
            width: _videoController!.value.size.width,
            height: _videoController!.value.size.height,
            child: VideoPlayer(_videoController!),
          ),
        ),

        // 播放/暂停按钮
        Center(
          child: GestureDetector(
            onTap: _toggleVideoPlay,
            child: AnimatedOpacity(
              opacity: _isVideoPlaying ? 0.0 : 1.0,
              duration: const Duration(milliseconds: 200),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.6),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  _isVideoPlaying ? Icons.pause : Icons.play_arrow,
                  color: Colors.white,
                  size: 48,
                ),
              ),
            ),
          ),
        ),

        // 静音按钮
        Positioned(
          bottom: 8,
          right: 8,
          child: GestureDetector(
            onTap: _toggleMute,
            child: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.6),
                shape: BoxShape.circle,
              ),
              child: Icon(
                _videoController!.value.volume > 0
                    ? Icons.volume_up
                    : Icons.volume_off,
                color: Colors.white,
                size: 20,
              ),
            ),
          ),
        ),
      ],
    );
  }
}