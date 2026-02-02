import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../widgets/net_image.dart';
import '../../widgets/player/global_video_player.dart';
import '../../core/player/global_player_manager.dart';
import '../../core/player/player_enums.dart';
import '../../core/player/player_config.dart';
import '../../core/url_parser.dart';

import 'shorts_detail_controller.dart';

/// 短剧详情页
/// 顶部16:9播放器，中间显示剧名、简介、选集列表，底部显示推荐短剧
class ShortsDetailPage extends StatefulWidget {
  final String shortId;

  const ShortsDetailPage({
    super.key,
    required this.shortId,
  });

  @override
  State<ShortsDetailPage> createState() => _ShortsDetailPageState();
}

class _ShortsDetailPageState extends State<ShortsDetailPage> with WidgetsBindingObserver {
  late ShortsDetailController controller;
  bool _playerInitialized = false; // 🚀 跟踪播放器是否已初始化
  bool _isInitializing = false; // 🚀 初始化互斥锁，防止竞态条件
  
  // 🚀 滚动控制器和播放器高度
  final ScrollController _scrollController = ScrollController();
  double _playerHeightRatio = 0.55; // 播放器高度比例 (55% - 25%)
  static const double _maxRatio = 0.55;
  static const double _minRatio = 0.25;

  @override
  void initState() {
    super.initState();
    
    // 初始化控制器
    controller = Get.put(
      ShortsDetailController(shortId: widget.shortId),
      tag: widget.shortId,
    );
    
    // 添加应用生命周期监听
    WidgetsBinding.instance.addObserver(this);
    
    // 🚀 监听滚动事件
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    // 🚀 取消正在进行的播放器初始化操作
    GlobalPlayerManager.to.cancelCurrentOperation();
    // 🚀 离开页面时暂停播放器
    GlobalPlayerManager.to.pause();
    // 移除应用生命周期监听
    WidgetsBinding.instance.removeObserver(this);
    // 🚀 移除滚动监听
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  /// 🚀 处理滚动事件，动态调整播放器高度
  void _onScroll() {
    final screenHeight = MediaQuery.of(context).size.height;
    final maxScrollForShrink = screenHeight * 0.3; // 滚动 30% 屏幕高度时达到最小
    
    final scrollOffset = _scrollController.offset;
    
    // 计算新的高度比例
    double newRatio;
    if (scrollOffset <= 0) {
      newRatio = _maxRatio;
    } else if (scrollOffset >= maxScrollForShrink) {
      newRatio = _minRatio;
    } else {
      // 线性插值
      newRatio = _maxRatio - (scrollOffset / maxScrollForShrink) * (_maxRatio - _minRatio);
    }
    
    if (newRatio != _playerHeightRatio) {
      setState(() {
        _playerHeightRatio = newRatio;
      });
    }
  }

  /// 初始化全局播放器（只执行一次，带互斥锁防止竞态条件）
  void _initializeGlobalPlayer(ShortsDetailController controller) {
    // 🚀 防止重复初始化（双重检查锁定模式）
    if (_playerInitialized || _isInitializing) return;
    
    final episodes = controller.episodes;
    if (episodes.isEmpty) return;
    
    // 🚀 设置初始化锁
    _isInitializing = true;
    _playerInitialized = true;

    // 检查是否从短剧流跳转过来，如果是则从第1集开始
    final args = Get.arguments as Map<String, dynamic>?;
    final fromShortsFlow = args?['fromShortsFlow'] == true;
    
    // 如果从短剧流跳转，强制从第1集开始；否则使用当前选中的集数
    final episodeIndex = fromShortsFlow ? 0 : controller.currentEpisodeIndex.value;
    
    // 更新控制器的当前集数
    if (fromShortsFlow) {
      controller.currentEpisodeIndex.value = 0;
    }
    
    final episode = episodes[episodeIndex];
    final playUrl = episode['play_url'] as String? ?? '';
    
    // 获取封面图
    final coverUrl = controller.shortDetail.value?['cover'] as String? ?? '';
    
    if (playUrl.isNotEmpty) {
      // 解析视频URL（处理旧格式兼容）
      String videoUrl = _parseVideoUrl(playUrl);
      
      GlobalPlayerManager.to.switchContent(
        contentType: ContentType.shorts,
        contentId: controller.shortId,
        episodeIndex: episodeIndex + 1,
        config: PlayerConfig.shortsWindow(),
        videoUrl: videoUrl,
        coverUrl: coverUrl,
        autoPlay: true, // 详情页自动播放
      ).whenComplete(() {
        // 🚀 初始化完成后释放锁
        _isInitializing = false;
      });
    } else {
      // 🚀 无播放URL时也要释放锁
      _isInitializing = false;
    }
  }

  /// 解析视频URL（使用统一解析器）
  String _parseVideoUrl(String playUrl) {
    return UrlParser.parseVideoUrl(playUrl);
  }

  /// 构建播放器覆盖层（窗口模式下显示全屏按钮）
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    
    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
        // 应用进入后台时暂停播放
        break;
      case AppLifecycleState.resumed:
        // 应用回到前台时恢复播放
        break;
      default:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      onPopInvokedWithResult: (didPop, result) async {
        if (!didPop) {
          final shouldPop = await _onWillPop();
          if (shouldPop && context.mounted) {
            Navigator.of(context).pop();
          }
        }
      },
      child: Obx(() {
        // 根据播放器模式决定显示全屏播放器还是详情页
        final isFullscreen = GlobalPlayerManager.to.playerMode.value == PlayerMode.fullscreen;
        
        if (isFullscreen) {
          return _buildFullscreenPlayer();
        }
        
        return Scaffold(
          backgroundColor: const Color(0xFF121212),
          body: Obx(() => _buildContent(controller)),
        );
      }),
    );
  }

  /// 构建全屏播放器（竖屏，支持上下滑动切换集数）
  Widget _buildFullscreenPlayer() {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // 全屏播放器 - 使用 PageView 支持上下滑动切换集数
          _buildFullscreenPageView(),
          
          // 顶部控制栏（带渐变）
          _buildFullscreenTopBar(),
          
          // 底部控制栏（进度条 + 集数指示）
          _buildFullscreenBottomControls(),
        ],
      ),
    );
  }

  /// 构建全屏 PageView（上下滑动切换集数）
  Widget _buildFullscreenPageView() {
    final episodes = controller.episodes;
    
    return PageView.builder(
      scrollDirection: Axis.vertical,
      controller: PageController(initialPage: controller.currentEpisodeIndex.value),
      itemCount: episodes.length,
      onPageChanged: (index) {
        // 切换集数
        controller.selectEpisode(index);
      },
      itemBuilder: (context, index) {
        final isCurrentEpisode = index == controller.currentEpisodeIndex.value;
        
        return GestureDetector(
          onTap: () {
            // 单击切换播放/暂停
            GlobalPlayerManager.to.togglePlayPause();
          },
          child: Container(
            color: Colors.black,
            child: ClipRect(
              child: isCurrentEpisode
                  ? GlobalVideoPlayer(
                      showControls: false,
                      onTap: () => GlobalPlayerManager.to.togglePlayPause(),
                    )
                  : _buildEpisodePlaceholder(index),
            ),
          ),
        );
      },
    );
  }

  /// 构建集数占位符（非当前播放集数）
  Widget _buildEpisodePlaceholder(int index) {
    final coverUrl = controller.shortDetail.value?['cover'] as String? ?? '';
    
    return Stack(
      fit: StackFit.expand,
      children: [
        // 封面
        NetImage(
          url: coverUrl,
          fit: BoxFit.cover,
        ),
        // 半透明遮罩
        Container(
          color: Colors.black.withValues(alpha: 0.5),
        ),
        // 集数信息
        Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.play_circle_outline,
                color: Colors.white,
                size: 64,
              ),
              const SizedBox(height: 16),
              Text(
                '第${index + 1}集',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// 构建全屏顶部控制栏
  Widget _buildFullscreenTopBar() {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: Container(
        padding: EdgeInsets.only(
          top: MediaQuery.of(context).padding.top + 8,
          left: 8,
          right: 8,
          bottom: 8,
        ),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Colors.black.withValues(alpha: 0.7),
              Colors.transparent,
            ],
          ),
        ),
        child: Row(
          children: [
            // 返回按钮（退出全屏）
            IconButton(
              onPressed: () {
                GlobalPlayerManager.to.exitFullscreen();
              },
              icon: const Icon(
                Icons.arrow_back,
                color: Colors.white,
                size: 24,
              ),
            ),
            const SizedBox(width: 8),
            // 短剧名称
            Expanded(
              child: Text(
                controller.shortDetail.value?['name'] as String? ?? '',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 构建全屏底部控制栏（进度条 + 播放按钮 + 集数指示）
  Widget _buildFullscreenBottomControls() {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).padding.bottom + 12,
          left: 16,
          right: 16,
          top: 40,
        ),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.bottomCenter,
            end: Alignment.topCenter,
            colors: [
              Colors.black.withValues(alpha: 0.8),
              Colors.black.withValues(alpha: 0.4),
              Colors.transparent,
            ],
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 进度条
            _buildFullscreenProgressBar(),
            const SizedBox(height: 12),
            // 底部控制行
            _buildFullscreenControlRow(),
          ],
        ),
      ),
    );
  }

  /// 构建全屏进度条
  Widget _buildFullscreenProgressBar() {
    return Obx(() {
      final state = GlobalPlayerManager.to.currentState.value;
      final progress = state.duration.inMilliseconds > 0
          ? state.position.inMilliseconds / state.duration.inMilliseconds
          : 0.0;

      return LayoutBuilder(
        builder: (context, constraints) {
          return GestureDetector(
            onHorizontalDragUpdate: (details) {
              final localX = details.localPosition.dx;
              final newProgress = (localX / constraints.maxWidth).clamp(0.0, 1.0);
              final newPosition = Duration(
                milliseconds: (state.duration.inMilliseconds * newProgress).round(),
              );
              GlobalPlayerManager.to.seekTo(newPosition);
            },
            onTapDown: (details) {
              final localX = details.localPosition.dx;
              final newProgress = (localX / constraints.maxWidth).clamp(0.0, 1.0);
              final newPosition = Duration(
                milliseconds: (state.duration.inMilliseconds * newProgress).round(),
              );
              GlobalPlayerManager.to.seekTo(newPosition);
            },
            child: Container(
              height: 24,
              alignment: Alignment.center,
              color: Colors.transparent,
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
                        color: const Color(0xFFFFC107),
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
                        color: Color(0xFFFFC107),
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
    });
  }

  /// 构建全屏控制行（播放按钮 + 时间 + 集数）
  Widget _buildFullscreenControlRow() {
    return Obx(() {
      final state = GlobalPlayerManager.to.currentState.value;
      final currentIndex = controller.currentEpisodeIndex.value;
      final totalEpisodes = controller.episodes.length;

      return Row(
        children: [
          // 播放/暂停按钮
          GestureDetector(
            onTap: () => GlobalPlayerManager.to.togglePlayPause(),
            child: Icon(
              state.isPlaying ? Icons.pause : Icons.play_arrow,
              color: Colors.white,
              size: 28,
            ),
          ),
          const SizedBox(width: 12),
          // 时间显示
          Text(
            '${_formatDuration(state.position)} / ${_formatDuration(state.duration)}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
            ),
          ),
          const Spacer(),
          // 集数指示
          Text(
            '第${currentIndex + 1}集 / 共${totalEpisodes}集',
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 12,
            ),
          ),
          const SizedBox(width: 8),
          // 滑动提示图标
          const Icon(
            Icons.swipe_vertical,
            color: Colors.white54,
            size: 16,
          ),
        ],
      );
    });
  }

  /// 格式化时长
  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  /// 处理系统返回键
  Future<bool> _onWillPop() async {
    // 如果全局播放器处于全屏模式，先退出全屏
    if (GlobalPlayerManager.to.playerMode.value == PlayerMode.fullscreen) {
      GlobalPlayerManager.to.exitFullscreen();
      return false; // 阻止页面返回
    }
    
    // 否则允许正常返回
    return true;
  }

  /// 构建内容
  Widget _buildContent(ShortsDetailController controller) {
    if (controller.isLoading.value) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
        ),
      );
    }

    if (controller.error.value.isNotEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline,
              size: 64,
              color: Colors.white38,
            ),
            const SizedBox(height: 16),
            Text(
              controller.error.value,
              style: const TextStyle(
                color: Colors.white54,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: controller.loadDetail,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFFC107),
              ),
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    final detail = controller.shortDetail.value;
    if (detail == null) {
      return const Center(
        child: Text(
          '短剧不存在',
          style: TextStyle(
            color: Colors.white54,
            fontSize: 16,
          ),
        ),
      );
    }

    return _buildFixedPlayerLayout(controller, detail);
  }
  /// 构建推荐项
  Widget _buildRecommendItem(Map<String, dynamic> recommend) {
    // 兼容新旧字段名
    final shortId = recommend['vod_id']?.toString() ?? recommend['id']?.toString() ?? '';
    final shortName = recommend['vod_name'] as String? ?? recommend['name'] as String? ?? '未知短剧';
    final coverUrl = recommend['vod_pic_vertical'] as String? ?? 
                     recommend['vod_pic'] as String? ?? 
                     recommend['cover'] as String? ?? '';
    final remarks = recommend['vod_remarks'] as String? ?? '';
    final category = recommend['category'] as String? ?? '';

    return GestureDetector(
      // 🚀 确保手势可以穿透到子组件
      behavior: HitTestBehavior.opaque,
      onTap: () {
        // 跳转到短剧详情页
        Get.toNamed('/shorts/detail', arguments: {'shortId': shortId});
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 封面
          Expanded(
            child: Stack(
              children: [
                // 🚀 使用 Positioned.fill 确保图片填充整个区域
                Positioned.fill(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: NetImage(
                      url: coverUrl,
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                // 分类标签
                if (category.isNotEmpty)
                  Positioned(
                    top: 4,
                    left: 4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFC107),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        category,
                        style: const TextStyle(
                          fontSize: 10,
                          color: Colors.black,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                // 更新状态
                if (remarks.isNotEmpty)
                  Positioned(
                    bottom: 0,
                    left: 0,
                    right: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.8),
                          ],
                        ),
                        borderRadius: const BorderRadius.only(
                          bottomLeft: Radius.circular(8),
                          bottomRight: Radius.circular(8),
                        ),
                      ),
                      child: Text(
                        remarks,
                        style: const TextStyle(
                          fontSize: 10,
                          color: Colors.white,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // 名称 - 固定高度，与首页模块保持一致
          SizedBox(
            height: 36,
            child: Text(
              shortName,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13,
                color: Colors.white,
                height: 1.3,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 格式化播放次数
  String _formatViewCount(int count) {
    if (count >= 10000) {
      return '${(count / 10000).toStringAsFixed(1)}万';
    }
    return count.toString();
  }

  /// 构建固定播放器布局 - 短剧使用竖屏播放器，支持滑动缩放
  Widget _buildFixedPlayerLayout(ShortsDetailController controller, Map<String, dynamic> detail) {
    final screenHeight = MediaQuery.of(context).size.height;
    // 🚀 使用动态高度比例
    final playerHeight = screenHeight * _playerHeightRatio;
    
    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      body: Column(
        children: [
          // 🚀 动态高度播放器区域，带动画过渡
          AnimatedContainer(
            duration: const Duration(milliseconds: 50), // 快速响应滚动
            height: playerHeight,
            child: _buildVerticalPlayer(controller, detail),
          ),

          // 可滚动内容区域
          Expanded(
            child: CustomScrollView(
              controller: _scrollController, // 🚀 使用滚动控制器
              slivers: [
                // 短剧信息（精简版）
                SliverToBoxAdapter(
                  child: _buildCompactInfo(detail),
                ),

                // 选集列表（横向滚动）
                SliverToBoxAdapter(
                  child: _buildHorizontalEpisodeList(controller),
                ),

                // 推荐短剧标题
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                    child: Text(
                      '推荐短剧',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),

                // 推荐短剧列表
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.58,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final recommend = controller.recommendations[index];
                        return _buildRecommendItem(recommend);
                      },
                      childCount: controller.recommendations.length,
                    ),
                  ),
                ),

                // 底部安全区域
                SliverToBoxAdapter(
                  child: SizedBox(height: MediaQuery.of(context).padding.bottom + 16),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 构建竖屏播放器
  Widget _buildVerticalPlayer(ShortsDetailController controller, Map<String, dynamic> detail) {
    final coverUrl = detail['cover'] as String? ?? '';
    final episodes = controller.episodes;
    
    return Container(
      color: Colors.black,
      // 🚀 使用 ClipRect 裁剪超出部分，防止视频溢出
      child: ClipRect(
        child: Stack(
          children: [
            // 播放器内容
            Positioned.fill(
              child: episodes.isNotEmpty 
                  ? _buildVerticalGlobalPlayer(controller, detail)
                  : _buildVerticalCoverPlayer(controller, detail, coverUrl),
            ),
            
            // 顶部安全区域 + 返回按钮
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Container(
                padding: EdgeInsets.only(
                  top: MediaQuery.of(context).padding.top,
                ),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.5),
                      Colors.transparent,
                    ],
                  ),
                ),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => Get.back(),
                      icon: const Icon(
                        Icons.arrow_back,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            
            // 全屏按钮（右上角）
            Positioned(
              top: MediaQuery.of(context).padding.top + 8,
              right: 8,
              child: GestureDetector(
                onTap: () {
                  GlobalPlayerManager.to.enterFullscreen();
                },
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Icon(
                    Icons.fullscreen,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 构建竖屏全局播放器
  Widget _buildVerticalGlobalPlayer(ShortsDetailController controller, Map<String, dynamic> detail) {
    // 初始化播放器
    if (!_playerInitialized && controller.episodes.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _initializeGlobalPlayer(controller);
      });
    }

    return Obx(() {
      final contentType = GlobalPlayerManager.to.currentState.value.contentType;
      final isInitialized = GlobalPlayerManager.to.player != null;
      
      if (contentType == ContentType.shorts && isInitialized) {
        return GestureDetector(
          onTap: () => GlobalPlayerManager.to.togglePlayPause(),
          child: GlobalVideoPlayer(
            showControls: false,
            onTap: () => GlobalPlayerManager.to.togglePlayPause(),
          ),
        );
      } else {
        // 播放器未就绪时显示封面和加载指示器
        final coverUrl = detail['cover'] as String? ?? '';
        return Stack(
          fit: StackFit.expand,
          children: [
            NetImage(
              url: coverUrl,
              fit: BoxFit.cover,
            ),
            const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
                strokeWidth: 3,
              ),
            ),
          ],
        );
      }
    });
  }

  /// 构建竖屏封面播放器（无集数时显示）
  Widget _buildVerticalCoverPlayer(ShortsDetailController controller, Map<String, dynamic> detail, String coverUrl) {
    return Stack(
      fit: StackFit.expand,
      children: [
        NetImage(
          url: coverUrl,
          fit: BoxFit.cover,
        ),
        Center(
          child: GestureDetector(
            onTap: () {
              if (controller.episodes.isNotEmpty) {
                _initializeGlobalPlayer(controller);
                GlobalPlayerManager.to.enterFullscreen();
              } else {
                Get.snackbar('提示', '暂无可播放的集数', snackPosition: SnackPosition.BOTTOM);
              }
            },
            child: Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: const Color(0xFFFFC107),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFFFC107).withValues(alpha: 0.5),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(
                Icons.play_arrow,
                color: Colors.black,
                size: 40,
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// 构建精简版短剧信息
  Widget _buildCompactInfo(Map<String, dynamic> detail) {
    final shortName = detail['name'] as String? ?? '未知短剧';
    final category = detail['category'] as String? ?? '';
    final episodeCount = detail['episode_count'] as int? ?? 0;
    final viewCount = detail['view_count'] as int? ?? 0;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 短剧名称
          Text(
            shortName,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 8),
          // 标签行
          Wrap(
            spacing: 8,
            children: [
              if (category.isNotEmpty)
                _buildTag(category, const Color(0xFFFFC107)),
              _buildTag('共$episodeCount集', Colors.white24),
              _buildTag('${_formatViewCount(viewCount)}播放', Colors.white24),
            ],
          ),
        ],
      ),
    );
  }

  /// 构建标签
  Widget _buildTag(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 12,
          color: color == const Color(0xFFFFC107) ? Colors.black : Colors.white70,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  /// 构建横向选集列表
  Widget _buildHorizontalEpisodeList(ShortsDetailController controller) {
    final episodes = controller.episodes;
    if (episodes.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                const Text(
                  '选集',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const Spacer(),
                Text(
                  '共${episodes.length}集',
                  style: const TextStyle(fontSize: 12, color: Colors.white54),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 36,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: episodes.length,
              itemBuilder: (context, index) {
                final isSelected = controller.currentEpisodeIndex.value == index;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: GestureDetector(
                    onTap: () => controller.selectEpisode(index),
                    child: Container(
                      width: 56,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFFFFC107) : const Color(0xFF1E1E1E),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        '${index + 1}',
                        style: TextStyle(
                          fontSize: 14,
                          color: isSelected ? Colors.black : Colors.white70,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
