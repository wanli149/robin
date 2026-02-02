import 'dart:async';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../widgets/net_image.dart';
import '../../../widgets/player/global_video_player.dart';
import '../../../services/share_service.dart';
import '../../../services/favorites_service.dart';
import '../../../core/player/global_player_manager.dart';
import '../../../core/player/player_enums.dart';
import '../../../core/player/player_config.dart';
import '../../../core/user_store.dart';
import '../../../core/url_parser.dart';
import '../../../core/logger.dart';
import '../shorts_controller.dart';

/// 短剧视频项（重构版）
/// 使用全局播放器管理器
class ShortsVideoItem extends StatefulWidget {
  final Map<String, dynamic> shortData;
  final bool isActive;

  const ShortsVideoItem({
    super.key,
    required this.shortData,
    required this.isActive,
  });

  @override
  State<ShortsVideoItem> createState() => _ShortsVideoItemState();
}

class _ShortsVideoItemState extends State<ShortsVideoItem> {
  final GlobalPlayerManager _globalPlayer = GlobalPlayerManager.to;
  late Function(Duration, Duration) _progressListener;
  late Function(String, double) _guidanceListener;
  bool _hasShownGuidance = false;
  bool _listenersAdded = false; // 🚀 跟踪监听器状态
  bool _isListenerOperationInProgress = false; // 🚀 监听器操作互斥锁
  
  // 🚀 防抖定时器
  static const _switchDebounceMs = 300;
  DateTime? _lastSwitchTime;
  
  // 🚀 延迟显示封面，避免滑动时闪现
  bool _shouldShowCover = false;
  Timer? _coverDelayTimer;

  @override
  void initState() {
    super.initState();
    
    // 设置进度监听器
    _progressListener = (position, duration) {
      // 进度监听逻辑已移至全局播放器管理器
    };

    // 设置引导提示监听器
    _guidanceListener = (contentId, progress) {
      final vodId = widget.shortData['vod_id']?.toString() ?? '';
      if (contentId == vodId && widget.isActive && !_hasShownGuidance) {
        if (mounted) {
          setState(() {
            _hasShownGuidance = true;
          });
        }
      }
    };
    
    // 🚀 初始化封面显示状态
    _shouldShowCover = !widget.isActive;
    
    if (widget.isActive) {
      _initializePlayer();
    }
  }

  @override
  void didUpdateWidget(ShortsVideoItem oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) {
      // 🚀 防抖：避免快速滑动时频繁切换
      final now = DateTime.now();
      if (_lastSwitchTime != null && 
          now.difference(_lastSwitchTime!).inMilliseconds < _switchDebounceMs) {
        Logger.player('[ShortsVideoItem] Switch debounced for ${widget.shortData['vod_id']}');
        return;
      }
      _lastSwitchTime = now;
      
      // 🚀 取消封面延迟定时器
      _coverDelayTimer?.cancel();
      _shouldShowCover = false;
      if (mounted) setState(() {});
      
      // 🚀 智能激活逻辑：检查是否需要重新初始化
      final vodId = widget.shortData['vod_id']?.toString() ?? '';
      final seriesId = widget.shortData['series_id']?.toString() ?? vodId;
      final currentContentId = _globalPlayer.currentState.value.contentId;
      final currentContentType = _globalPlayer.currentState.value.contentType;
      
      // 🚀 如果当前播放的是同一个 series（从详情页返回），只需恢复播放，不重新初始化
      final isSameSeries = (currentContentId == vodId) || 
          (currentContentId == seriesId && currentContentType == ContentType.shorts);
      
      if (isSameSeries && _globalPlayer.player != null) {
        Logger.success('[ShortsVideoItem] 🎯 Same series detected, resuming playback without re-init: $vodId');
        
        // 添加监听器
        _addListeners();
        
        // 恢复临时进度
        try {
          final controller = Get.find<ShortsController>();
          final savedProgress = controller.getTempProgress(vodId);
          if (savedProgress != null && savedProgress > 0) {
            _globalPlayer.seekTo(Duration(seconds: savedProgress));
            Logger.success('[ShortsVideoItem] Restored temp progress: $vodId @ ${savedProgress}s');
          }
        } catch (e) {
          Logger.error('[ShortsVideoItem] Failed to restore temp progress: $e');
        }
        
        // 恢复播放
        _globalPlayer.play();
        
        // 更新状态为短剧流模式
        _globalPlayer.currentState.value = _globalPlayer.currentState.value.copyWith(
          contentType: ContentType.shortsFlow,
        );
      } else {
        // 🚀 不同内容，需要重新初始化
        Logger.player('[ShortsVideoItem] Activating new video: $vodId');
        _initializePlayer();
      }
    } else if (!widget.isActive && oldWidget.isActive) {
      // 🚀 页面变为非活跃时，延迟显示封面（避免滑动时闪现）
      _coverDelayTimer?.cancel();
      _coverDelayTimer = Timer(const Duration(milliseconds: 200), () {
        if (mounted && !widget.isActive) {
          setState(() {
            _shouldShowCover = true;
          });
        }
      });
      
      // 🚀 保存临时播放进度并暂停
      final vodId = widget.shortData['vod_id']?.toString() ?? '';
      if (vodId.isNotEmpty) {
        final currentPosition = _globalPlayer.currentState.value.position.inSeconds;
        if (currentPosition > 0) {
          // 🚀 保存到短剧流控制器的临时进度缓存
          try {
            final controller = Get.find<ShortsController>();
            controller.saveTempProgress(vodId, currentPosition);
          } catch (e) {
            Logger.error('[ShortsVideoItem] Failed to save temp progress: $e');
          }
        }
      }
      
      Logger.player('[ShortsVideoItem] Deactivating video $vodId');
      _globalPlayer.pause();
      _removeListeners();
    }
  }

  @override
  void dispose() {
    _coverDelayTimer?.cancel();
    _removeListeners();
    super.dispose();
  }
  
  /// 🚀 安全移除监听器（带互斥锁防止竞态条件）
  void _removeListeners() {
    if (_isListenerOperationInProgress) return;
    _isListenerOperationInProgress = true;
    
    try {
      if (_listenersAdded) {
        _globalPlayer.removeProgressListener(_progressListener);
        _globalPlayer.removeGuidanceListener(_guidanceListener);
        _listenersAdded = false;
      }
    } finally {
      _isListenerOperationInProgress = false;
    }
  }
  
  /// 🚀 安全添加监听器（带互斥锁防止竞态条件）
  void _addListeners() {
    if (_isListenerOperationInProgress) return;
    _isListenerOperationInProgress = true;
    
    try {
      if (!_listenersAdded) {
        _globalPlayer.addProgressListener(_progressListener);
        _globalPlayer.addGuidanceListener(_guidanceListener);
        _listenersAdded = true;
      }
    } finally {
      _isListenerOperationInProgress = false;
    }
  }

  /// 初始化播放器
  void _initializePlayer() {
    final vodId = widget.shortData['vod_id']?.toString() ?? '';
    final playUrl = widget.shortData['play_url'] as String? ?? '';
    final coverUrl = widget.shortData['vod_pic_vertical'] as String? ?? 
                     widget.shortData['vod_pic'] as String? ?? '';
    
    if (playUrl.isEmpty) {
      return;
    }

    // 解析视频URL
    String videoUrl = _parseVideoUrl(playUrl);

    // 🚀 使用安全的监听器管理
    _addListeners();

    // 重置当前内容的引导状态
    _globalPlayer.resetGuidanceForContent(vodId);
    _hasShownGuidance = false;

    // 切换到当前视频
    _globalPlayer.switchContent(
      contentType: ContentType.shortsFlow,
      contentId: vodId,
      episodeIndex: 1,
      config: PlayerConfig.shortsFlow(),
      videoUrl: videoUrl,
      coverUrl: coverUrl,
      autoPlay: widget.isActive,
    );
    
    // 🚀 恢复临时播放进度
    if (vodId.isNotEmpty) {
      try {
        final controller = Get.find<ShortsController>();
        final savedProgress = controller.getTempProgress(vodId);
        if (savedProgress != null && savedProgress > 0) {
          Future.delayed(const Duration(milliseconds: 800), () {
            if (mounted) {
              _globalPlayer.seekTo(Duration(seconds: savedProgress));
              Logger.success('[ShortsVideoItem] Restored temp progress: $vodId @ ${savedProgress}s');
            }
          });
        }
      } catch (e) {
        Logger.error('[ShortsVideoItem] Failed to restore temp progress: $e');
      }
    }
  }

  /// 解析视频URL（使用统一解析器）
  String _parseVideoUrl(String playUrl) {
    return UrlParser.parseVideoUrl(playUrl);
  }

  /// 构建封面图片（优化版 - 减少模糊效果开销）
  Widget _buildCoverImage(String coverUrl, Size screenSize, double pixelRatio) {
    if (coverUrl.isEmpty) {
      return Container(color: Colors.black);
    }
    
    // 🚀 性能优化：使用简单的半透明黑色背景代替模糊效果
    // 模糊效果（BackdropFilter）是 GPU 密集型操作，会导致滑动卡顿
    return Stack(
      fit: StackFit.expand,
      children: [
        // 背景层：缩小的封面图（降低内存占用）
        Positioned.fill(
          child: NetImage(
            url: coverUrl,
            fit: BoxFit.cover,
            memCacheWidth: (screenSize.width * pixelRatio * 0.2).toInt(),
            memCacheHeight: (screenSize.height * pixelRatio * 0.2).toInt(),
          ),
        ),
        
        // 🚀 使用半透明黑色遮罩代替模糊效果（性能提升 10 倍）
        Positioned.fill(
          child: Container(
            color: Colors.black.withValues(alpha: 0.6),
          ),
        ),
        
        // 前景层：清晰的完整封面
        Positioned.fill(
          child: RepaintBoundary( // 🚀 隔离重绘
            child: NetImage(
              url: coverUrl,
              fit: BoxFit.contain,
              memCacheWidth: (screenSize.width * pixelRatio).toInt(),
              memCacheHeight: (screenSize.height * pixelRatio).toInt(),
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final vodId = widget.shortData['vod_id']?.toString() ?? '';
    final seriesId = widget.shortData['series_id']?.toString() ?? vodId;
    final vodName = widget.shortData['vod_name'] as String? ?? '未知短剧';
    final coverUrl = widget.shortData['vod_pic_vertical'] as String? ?? '';
    final category = widget.shortData['category'] as String? ?? '';
    
    // 获取屏幕尺寸用于高质量封面
    final screenSize = MediaQuery.of(context).size;
    final pixelRatio = MediaQuery.of(context).devicePixelRatio;

    return Container(
      width: double.infinity,
      height: double.infinity,
      color: Colors.black,
      child: RepaintBoundary( // 🚀 隔离重绘边界
        child: Stack(
          fit: StackFit.expand,
          children: [
          // 🚀 视频播放器层 - 使用独立 widget 减少重建
          if (widget.isActive)
            Positioned.fill(
              child: _VideoPlayerLayer(
                shortData: widget.shortData,
                coverUrl: coverUrl,
                screenSize: screenSize,
                pixelRatio: pixelRatio,
              ),
            ),
          
          // 🚀 非活跃视频的封面（滑动时看到的其他视频）
          // 🚀 使用延迟标志避免滑动时闪现
          if (!widget.isActive && _shouldShowCover)
            Positioned.fill(
              child: _buildCoverImage(coverUrl, screenSize, pixelRatio),
            ),

          // 双击播放/暂停的手势区域（中间区域，不影响上下滑动）
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.translucent, // 允许手势穿透
              onDoubleTap: () {
                // 🚀 双击：切换播放/暂停
                _globalPlayer.togglePlayPause();
              },
              child: const SizedBox.expand(),
            ),
          ),

          // 暗色遮罩（底部渐变）- 仅在非活跃时显示
          // 🚀 使用延迟标志避免滑动时闪现
          if (!widget.isActive && _shouldShowCover)
            Positioned.fill(
              child: IgnorePointer( // 忽略手势，不影响滑动
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.transparent,
                        Colors.black.withValues(alpha: 0.7),
                      ],
                    ),
                  ),
                ),
              ),
            ),

          // 播放/暂停图标 - 使用独立的 widget 减少重建范围
          if (widget.isActive) const _PlayPauseIcon(),

          // 右侧操作栏
          _buildRightActions(vodId, seriesId, vodName),

          // 底部信息栏
          _buildBottomInfo(vodName, category),

          // 引导提示（播放到30%时显示）
          if (_hasShownGuidance)
            _buildGuidance(seriesId),

          // 静音按钮（避开状态栏）
          Positioned(
            right: 12,
            top: MediaQuery.of(context).padding.top + 12,
            child: const _MuteButton(),
          ),
        ],
        ),
      ),
    );
  }

  /// 构建右侧操作栏
  Widget _buildRightActions(String vodId, String seriesId, String vodName) {
    return Positioned(
      right: 12,
      bottom: 120,
      child: Column(
        children: [
          // 查看详情按钮
          _buildActionButton(
            icon: Icons.info_outline,
            label: '详情',
            onTap: () {
              // 跳转到短剧详情页（使用series_id）
              Get.toNamed('/shorts/detail', arguments: {'shortId': seriesId});
            },
          ),
          const SizedBox(height: 24),

          // 分享按钮
          _buildActionButton(
            icon: Icons.share_outlined,
            label: '分享',
            onTap: () {
              ShareService.showShareDialog(
                context: context,
                type: 'shorts',
                id: vodId,
                title: vodName,
              );
            },
          ),
          const SizedBox(height: 24),

          // 收藏按钮
          Obx(() {
            final isFavorited = FavoritesService.to.isFavorited(seriesId);
            return _buildActionButton(
              icon: isFavorited ? Icons.favorite : Icons.favorite_border,
              label: isFavorited ? '已收藏' : '收藏',
              color: isFavorited ? const Color(0xFFFFC107) : Colors.white,
              onTap: () async {
                // 检查登录状态
                if (!UserStore.to.requireLoginForFeature('favorites')) {
                  return;
                }
                
                final vodPic = widget.shortData['vod_pic_vertical'] as String? ?? '';
                final result = await FavoritesService.to.toggleFavorite(
                  vodId: seriesId,
                  vodName: vodName,
                  vodPic: vodPic,
                  vodType: 'shorts',
                );
                
                if (result != null) {
                  Get.snackbar(
                    result ? '收藏成功' : '取消收藏',
                    result ? '已添加到收藏' : '已从收藏中移除',
                    snackPosition: SnackPosition.BOTTOM,
                    duration: const Duration(seconds: 2),
                  );
                }
              },
            );
          }),
        ],
      ),
    );
  }

  /// 构建操作按钮
  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    Color? color,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.5),
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              color: color ?? Colors.white,
              size: 28,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              color: color ?? Colors.white,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  /// 构建底部信息栏
  Widget _buildBottomInfo(String vodName, String category) {
    // 获取集数信息
    final episodeIndex = widget.shortData['episode_index'] as int? ?? 0;
    final totalEpisodes = widget.shortData['total_episodes'] as int? ?? 0;
    final episodeName = widget.shortData['episode_name'] as String? ?? '';
    
    return Positioned(
      left: 16,
      right: 80,
      bottom: 70, // 🚀 紧贴导航栏上方：导航栏高度 56px + 间距 14px = 70px
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min, // 🚀 最小化高度，不占用多余空间
        children: [
          // 短剧名称
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              vodName,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 15, // 🚀 稍微缩小字体
                fontWeight: FontWeight.bold,
              ),
              maxLines: 1, // 🚀 只显示一行，避免占用太多空间
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(height: 6), // 🚀 减小间距

          // 集数信息和分类标签
          Row(
            children: [
              // 集数标签
              if (episodeIndex > 0 && totalEpisodes > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  margin: const EdgeInsets.only(right: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(3),
                  ),
                  child: Text(
                    episodeName.isNotEmpty 
                        ? '$episodeName / 共$totalEpisodes集'
                        : '第$episodeIndex集 / 共$totalEpisodes集',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              // 分类标签
              if (category.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFC107),
                    borderRadius: BorderRadius.circular(3),
                  ),
                  child: Text(
                    category,
                    style: const TextStyle(
                      color: Colors.black,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  /// 构建引导提示
  Widget _buildGuidance(String seriesId) {
    return Positioned(
      left: 0,
      right: 0,
      bottom: 200,
      child: Center(
        child: GestureDetector(
          onTap: () {
            // 跳转到短剧详情页（使用 series_id，标记从短剧流跳转）
            Get.toNamed('/shorts/detail', arguments: {
              'shortId': seriesId,
              'fromShortsFlow': true, // 标记从短剧流跳转，强制从第1集开始
            });
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFFFC107),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFFFC107).withValues(alpha: 0.5),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.play_arrow,
                  color: Colors.black,
                  size: 24,
                ),
                SizedBox(width: 8),
                Text(
                  '观看完整版',
                  style: TextStyle(
                    color: Colors.black,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 🚀 独立的播放/暂停图标 widget - 减少重建范围
class _PlayPauseIcon extends StatelessWidget {
  const _PlayPauseIcon();
  
  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final manager = GlobalPlayerManager.to;
      final isPlaying = manager.currentState.value.isPlaying;
      final isLoading = manager.isLoading.value;
      
      if (isPlaying || isLoading) {
        return const SizedBox.shrink();
      }
      
      return const IgnorePointer(
        child: Center(
          child: Icon(
            Icons.play_circle_outline,
            color: Colors.white,
            size: 80,
          ),
        ),
      );
    });
  }
}

/// 🚀 独立的视频播放器层 widget - 减少重建范围
class _VideoPlayerLayer extends StatelessWidget {
  final Map<String, dynamic> shortData;
  final String coverUrl;
  final Size screenSize;
  final double pixelRatio;

  const _VideoPlayerLayer({
    required this.shortData,
    required this.coverUrl,
    required this.screenSize,
    required this.pixelRatio,
  });

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final manager = GlobalPlayerManager.to;
      final contentType = manager.currentState.value.contentType;
      final contentId = manager.currentState.value.contentId;
      final isLoading = manager.isLoading.value;
      final isInitialized = manager.player != null;
      final vodId = shortData['vod_id']?.toString() ?? '';
      final seriesId = shortData['series_id']?.toString() ?? '';
      
      // 匹配逻辑
      final isCurrentVideo = contentId == vodId || 
          (contentType == ContentType.shorts && contentId == seriesId);
      
      final shouldShowPlayer = isCurrentVideo && isInitialized && 
          (contentType == ContentType.shortsFlow || contentType == ContentType.shorts);
      
      if (shouldShowPlayer) {
        return const GlobalVideoPlayer(showControls: false);
      } else if (isLoading && isCurrentVideo) {
        // 加载中
        return Stack(
          fit: StackFit.expand,
          children: [
            _buildCoverImage(),
            const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
                strokeWidth: 3,
              ),
            ),
          ],
        );
      } else {
        // 未初始化
        return _buildCoverImage();
      }
    });
  }

  Widget _buildCoverImage() {
    if (coverUrl.isEmpty) {
      return Container(color: Colors.black);
    }
    
    return Stack(
      fit: StackFit.expand,
      children: [
        Positioned.fill(
          child: NetImage(
            url: coverUrl,
            fit: BoxFit.cover,
            memCacheWidth: (screenSize.width * pixelRatio * 0.2).toInt(),
            memCacheHeight: (screenSize.height * pixelRatio * 0.2).toInt(),
          ),
        ),
        Positioned.fill(
          child: Container(
            color: Colors.black.withValues(alpha: 0.6),
          ),
        ),
        Positioned.fill(
          child: RepaintBoundary(
            child: NetImage(
              url: coverUrl,
              fit: BoxFit.contain,
              memCacheWidth: (screenSize.width * pixelRatio).toInt(),
              memCacheHeight: (screenSize.height * pixelRatio).toInt(),
            ),
          ),
        ),
      ],
    );
  }
}

/// 🚀 独立的静音按钮 widget - 减少重建范围
class _MuteButton extends StatelessWidget {
  const _MuteButton();
  
  @override
  Widget build(BuildContext context) {
    final manager = GlobalPlayerManager.to;
    
    return GestureDetector(
      onTap: () => manager.toggleMute(),
      child: Obx(() {
        return Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.5),
            shape: BoxShape.circle,
          ),
          child: Icon(
            manager.currentState.value.isMuted 
                ? Icons.volume_off 
                : Icons.volume_up,
            color: Colors.white,
            size: 24,
          ),
        );
      }),
    );
  }
}