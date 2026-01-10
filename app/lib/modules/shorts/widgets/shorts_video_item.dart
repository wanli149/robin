import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../widgets/net_image.dart';
import '../../../widgets/player/global_video_player.dart';
import '../../../services/share_service.dart';
import '../../../services/favorites_service.dart';
import '../../../core/global_player_manager.dart';
import '../../../core/user_store.dart';
import '../../../core/url_parser.dart';
import '../../../core/logger.dart';

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
      
      // 页面变为活跃时，检查是否需要重新初始化
      final vodId = widget.shortData['vod_id']?.toString() ?? '';
      final currentContentId = _globalPlayer.currentState.value.contentId;
      final currentContentType = _globalPlayer.currentState.value.contentType;
      
      // 🚀 如果当前播放的就是这个视频（从详情页返回），直接继续播放，不重新初始化
      if (currentContentId == vodId && 
          (currentContentType == ContentType.shortsFlow || currentContentType == ContentType.shorts)) {
        Logger.player('[ShortsVideoItem] Resuming video $vodId (returning from detail)');
        // 切换回 shortsFlow 模式但保持播放位置
        if (currentContentType == ContentType.shorts) {
          // 从详情页返回，需要切换 contentType 但保持播放
          _globalPlayer.currentState.value = _globalPlayer.currentState.value.copyWith(
            contentType: ContentType.shortsFlow,
          );
        }
        _addListeners();
        _globalPlayer.play();
        return;
      }
      
      Logger.player('[ShortsVideoItem] Activating video $vodId');
      _initializePlayer();
    } else if (!widget.isActive && oldWidget.isActive) {
      // 🚀 页面变为非活跃时，暂停播放并移除监听器
      Logger.player('[ShortsVideoItem] Deactivating video ${widget.shortData['vod_id']}');
      _globalPlayer.pause();
      _removeListeners();
    }
  }

  @override
  void dispose() {
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
  }

  /// 解析视频URL（使用统一解析器）
  String _parseVideoUrl(String playUrl) {
    return UrlParser.parseVideoUrl(playUrl);
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
      child: Stack(
        fit: StackFit.expand, // 确保Stack填充整个容器
        children: [
          // 封面（始终显示作为背景，使用高质量设置）
          Positioned.fill(
            child: NetImage(
              url: coverUrl,
              fit: BoxFit.cover,
              // 使用屏幕实际像素尺寸确保高质量显示
              memCacheWidth: (screenSize.width * pixelRatio).toInt(),
              memCacheHeight: (screenSize.height * pixelRatio).toInt(),
            ),
          ),
          
          // 视频播放器（覆盖在封面上，只在视频真正播放时才遮挡封面）
          if (widget.isActive)
            Positioned.fill(
              child: Obx(() {
                // 只有当contentType为shortsFlow且视频正在播放时才显示播放器
                final contentType = _globalPlayer.currentState.value.contentType;
                final isPlaying = _globalPlayer.currentState.value.isPlaying;
                final isLoading = _globalPlayer.isLoading.value;
                final isInitialized = _globalPlayer.player != null;
                
                // 只有视频初始化完成后才显示播放器，否则显示封面+加载指示器
                if (contentType == ContentType.shortsFlow && isInitialized) {
                  return GlobalVideoPlayer(
                    showControls: false, // 短剧流不显示控制栏
                  );
                } else if (isLoading) {
                  // 加载中：显示透明背景+加载指示器（封面可见）
                  return const Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
                      strokeWidth: 3,
                    ),
                  );
                } else {
                  // 等待初始化：显示透明背景（封面可见）
                  return const SizedBox.shrink();
                }
              }),
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
          if (!widget.isActive)
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

          // 播放/暂停图标
          Obx(() => !_globalPlayer.currentState.value.isPlaying && 
                    !_globalPlayer.isLoading.value &&
                    widget.isActive
              ? const IgnorePointer( // 忽略手势
                  child: Center(
                    child: Icon(
                      Icons.play_circle_outline,
                      color: Colors.white,
                      size: 80,
                    ),
                  ),
                )
              : const SizedBox.shrink()),

          // 右侧操作栏
          _buildRightActions(vodId, seriesId, vodName),

          // 底部信息栏
          _buildBottomInfo(vodName, category),

          // 引导提示（播放到30%时显示）
          if (_hasShownGuidance)
            _buildGuidance(seriesId),

          // 静音按钮（安全区域内）
          Positioned(
            right: 12,
            top: MediaQuery.of(context).padding.top + 60,
            child: SafeArea(
              child: Obx(() => GestureDetector(
                onTap: () {
                  _globalPlayer.toggleMute();
                },
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.5),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    _globalPlayer.currentState.value.isMuted 
                        ? Icons.volume_off 
                        : Icons.volume_up,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
              )),
            ),
          ),
        ],
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
      bottom: 80,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 短剧名称
          Text(
            vodName,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 8),

          // 集数信息和分类标签
          Row(
            children: [
              // 集数标签
              if (episodeIndex > 0 && totalEpisodes > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  margin: const EdgeInsets.only(right: 8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    episodeName.isNotEmpty 
                        ? '$episodeName / 共$totalEpisodes集'
                        : '第$episodeIndex集 / 共$totalEpisodes集',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                    ),
                  ),
                ),
              // 分类标签
              if (category.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFC107),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    category,
                    style: const TextStyle(
                      color: Colors.black,
                      fontSize: 12,
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