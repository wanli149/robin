import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../core/router.dart';
import '../core/logger.dart';
import 'net_image.dart';

/// 横幅广告组件
/// 支持图片和视频广告，实现点击跳转逻辑
class AdBanner extends StatefulWidget {
  final AdBannerData data;
  final double? height;
  final EdgeInsetsGeometry? margin;

  const AdBanner({
    super.key,
    required this.data,
    this.height,
    this.margin,
  });

  @override
  State<AdBanner> createState() => _AdBannerState();
}

class _AdBannerState extends State<AdBanner> {
  VideoPlayerController? _videoController;
  bool _isVideoInitialized = false;
  bool _isVideoPlaying = false;

  @override
  void initState() {
    super.initState();
    if (widget.data.contentType == 'video') {
      _initVideoPlayer();
    }
  }

  @override
  void dispose() {
    _videoController?.dispose();
    super.dispose();
  }

  /// 初始化视频播放器
  Future<void> _initVideoPlayer() async {
    if (widget.data.mediaUrl.isEmpty) return;

    try {
      _videoController = VideoPlayerController.networkUrl(
        Uri.parse(widget.data.mediaUrl),
      );

      await _videoController!.initialize();
      _videoController!.setLooping(true);
      _videoController!.setVolume(0); // 默认静音

      if (mounted) {
        setState(() {
          _isVideoInitialized = true;
        });
      }
    } catch (e) {
      Logger.error('[AdBanner] Failed to init video: $e');
    }
  }

  /// 切换视频播放状态
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

  @override
  Widget build(BuildContext context) {
    return Container(
      height: widget.height ?? 120,
      margin: widget.margin ?? const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _handleAdClick(context),
          borderRadius: BorderRadius.circular(12),
          child: Stack(
            children: [
              // 广告内容
              _buildAdContent(),

              // 广告标识
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    '广告',
                    style: TextStyle(
                      fontSize: 10,
                      color: Colors.white70,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 构建广告内容
  Widget _buildAdContent() {
    if (widget.data.contentType == 'image') {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: NetImage(
          url: widget.data.mediaUrl,
          width: double.infinity,
          height: double.infinity,
          fit: BoxFit.cover,
        ),
      );
    } else if (widget.data.contentType == 'video') {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: _buildVideoAd(),
      );
    } else {
      return Container(
        decoration: BoxDecoration(
          color: const Color(0xFF1E1E1E),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Center(
          child: Text(
            '广告加载中...',
            style: TextStyle(color: Colors.white54),
          ),
        ),
      );
    }
  }

  /// 构建视频广告
  Widget _buildVideoAd() {
    if (!_isVideoInitialized || _videoController == null) {
      // 视频未初始化，显示加载状态
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
        // 视频播放器
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
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.6),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  _isVideoPlaying ? Icons.pause : Icons.play_arrow,
                  color: Colors.white,
                  size: 32,
                ),
              ),
            ),
          ),
        ),

        // 静音/取消静音按钮
        Positioned(
          bottom: 8,
          right: 8,
          child: GestureDetector(
            onTap: () {
              final currentVolume = _videoController!.value.volume;
              _videoController!.setVolume(currentVolume > 0 ? 0 : 1);
              setState(() {});
            },
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.6),
                shape: BoxShape.circle,
              ),
              child: Icon(
                _videoController!.value.volume > 0
                    ? Icons.volume_up
                    : Icons.volume_off,
                color: Colors.white,
                size: 16,
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// 处理广告点击
  Future<void> _handleAdClick(BuildContext context) async {
    if (widget.data.actionUrl.isEmpty) return;

    try {
      // 暂停视频广告
      if (_isVideoPlaying) {
        _videoController?.pause();
        setState(() {
          _isVideoPlaying = false;
        });
      }

      // 使用通用路由处理跳转
      await UniversalRouter.handleRoute(widget.data.actionUrl);
    } catch (e) {
      Logger.error('Failed to handle ad click: $e');
    }
  }
}

/// 广告横幅数据模型
class AdBannerData {
  final int id;
  final String location;
  final String contentType; // 'image' 或 'video'
  final String mediaUrl;
  final String actionType; // 'browser', 'webview', 'deeplink', 'video'
  final String actionUrl;
  final int weight;
  final bool isActive;

  AdBannerData({
    required this.id,
    required this.location,
    required this.contentType,
    required this.mediaUrl,
    required this.actionType,
    required this.actionUrl,
    this.weight = 1,
    this.isActive = true,
  });

  factory AdBannerData.fromJson(Map<String, dynamic> json) {
    return AdBannerData(
      id: json['id'] ?? 0,
      location: json['location'] ?? '',
      contentType: json['content_type'] ?? 'image',
      mediaUrl: json['media_url'] ?? '',
      actionType: json['action_type'] ?? 'browser',
      actionUrl: json['action_url'] ?? '',
      weight: json['weight'] ?? 1,
      isActive: json['is_active'] == 1 || json['is_active'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'location': location,
      'content_type': contentType,
      'media_url': mediaUrl,
      'action_type': actionType,
      'action_url': actionUrl,
      'weight': weight,
      'is_active': isActive,
    };
  }
}
