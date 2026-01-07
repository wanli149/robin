import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../widgets/net_image.dart';
import '../../widgets/player/global_video_player.dart';
import '../../widgets/expandable_text.dart';
import '../../core/global_player_manager.dart';
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
  }

  @override
  void dispose() {
    // 🚀 离开页面时暂停播放器
    GlobalPlayerManager.to.pause();
    // 移除应用生命周期监听
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// 初始化全局播放器
  void _initializeGlobalPlayer(ShortsDetailController controller) {
    final episodes = controller.episodes;
    if (episodes.isEmpty) return;

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
    
    if (playUrl.isNotEmpty) {
      // 解析视频URL（处理旧格式兼容）
      String videoUrl = _parseVideoUrl(playUrl);
      
      GlobalPlayerManager.to.switchContent(
        contentType: ContentType.shorts,
        contentId: controller.shortId,
        episodeIndex: episodeIndex + 1,
        config: PlayerConfig.shortsWindow(),
        videoUrl: videoUrl,
        autoPlay: true, // 详情页自动播放
      );
    }
  }

  /// 解析视频URL（使用统一解析器）
  String _parseVideoUrl(String playUrl) {
    return UrlParser.parseVideoUrl(playUrl);
  }

  /// 构建播放器覆盖层
  Widget _buildPlayerOverlay(ShortsDetailController controller) {
    return Positioned(
      right: 16,
      bottom: 16,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 锁定模式按钮
          GestureDetector(
            onTap: () {
              controller.enterLockedMode();
            },
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.5),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.fullscreen,
                    color: Colors.white,
                    size: 16,
                  ),
                  SizedBox(width: 4),
                  Text(
                    '锁定模式',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

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
    return WillPopScope(
      onWillPop: _onWillPop,
      child: Scaffold(
        backgroundColor: const Color(0xFF121212),
        body: Obx(() => _buildContent(controller)),
      ),
    );
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

  /// 构建播放器
  Widget _buildPlayer(ShortsDetailController controller, Map<String, dynamic> detail) {
    final coverUrl = detail['cover'] as String? ?? '';
    final episodes = controller.episodes;
    
    return SafeArea(
      child: Stack(
        children: [
          // 播放器区域（16:9）
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Container(
              color: Colors.black,
              child: episodes.isNotEmpty 
                  ? _buildGlobalPlayer(controller, detail)
                  : _buildCoverPlayer(controller, detail, coverUrl),
            ),
          ),
        ],
      ),
    );
  }

  /// 构建全局播放器
  Widget _buildGlobalPlayer(ShortsDetailController controller, Map<String, dynamic> detail) {
    // 初始化全局播放器
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initializeGlobalPlayer(controller);
    });

    return GlobalVideoPlayer(
      showControls: true,
      overlay: _buildPlayerOverlay(controller),
      onTap: () {
        // 短剧详情页点击播放器切换播放/暂停
        GlobalPlayerManager.to.togglePlayPause();
      },
    );
  }

  /// 构建封面播放器
  Widget _buildCoverPlayer(ShortsDetailController controller, Map<String, dynamic> detail, String coverUrl) {
    return Stack(
      children: [
        // 封面图
        Positioned.fill(
          child: NetImage(
            url: coverUrl,
            fit: BoxFit.cover,
          ),
        ),

        // 播放按钮
        Center(
          child: GestureDetector(
            onTap: () {
              // 使用全局播放器进入全屏模式
              if (controller.episodes.isNotEmpty) {
                // 先初始化播放器（如果还没有初始化）
                _initializeGlobalPlayer(controller);
                // 然后进入全屏模式
                GlobalPlayerManager.to.enterFullscreen();
              } else {
                Get.snackbar(
                  '提示',
                  '暂无可播放的集数',
                  snackPosition: SnackPosition.BOTTOM,
                );
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
                    color: const Color(0xFFFFC107).withOpacity(0.5),
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

        // 全屏按钮
        Positioned(
          right: 12,
          bottom: 12,
          child: GestureDetector(
            onTap: () {
              // 切换到竖屏锁定模式
              controller.enterLockedMode();
            },
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.5),
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

        // 返回按钮
        Positioned(
          top: 0,
          left: 0,
          child: IconButton(
            onPressed: () => Get.back(),
            icon: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.5),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.arrow_back,
                color: Colors.white,
                size: 20,
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// 构建短剧信息
  Widget _buildInfo(Map<String, dynamic> detail) {
    final shortName = detail['name'] as String? ?? '未知短剧';
    final description = detail['description'] as String? ?? '';
    final category = detail['category'] as String? ?? '';
    final episodeCount = detail['episode_count'] as int? ?? 0;
    final viewCount = detail['view_count'] as int? ?? 0;

    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 短剧名称
          Text(
            shortName,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 12),

          // 标签行
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (category.isNotEmpty)
                _buildTag(category, const Color(0xFFFFC107)),
              _buildTag('共$episodeCount集', Colors.white24),
              _buildTag('${_formatViewCount(viewCount)}次播放', Colors.white24),
            ],
          ),
          const SizedBox(height: 16),

          // 简介（可折叠）
          if (description.isNotEmpty) ...[
            const Text(
              '剧情简介',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 8),
            ExpandableText(
              text: description,
              maxLines: 3,
              style: const TextStyle(
                fontSize: 14,
                color: Colors.white70,
                height: 1.5,
              ),
            ),
          ],
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

  /// 构建选集列表
  Widget _buildEpisodeList(ShortsDetailController controller, Map<String, dynamic> detail) {
    final episodes = controller.episodes;

    if (episodes.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
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
                style: const TextStyle(
                  fontSize: 14,
                  color: Colors.white54,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // 选集网格
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: episodes.asMap().entries.map((entry) {
              final index = entry.key;
              final isSelected = controller.currentEpisodeIndex.value == index;

              return GestureDetector(
                onTap: () => controller.selectEpisode(index),
                child: Container(
                  width: 60,
                  height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: isSelected
                        ? const Color(0xFFFFC107)
                        : const Color(0xFF1E1E1E),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(
                      color: isSelected
                          ? const Color(0xFFFFC107)
                          : const Color(0xFF2E2E2E),
                      width: 1,
                    ),
                  ),
                  child: Text(
                    '第${index + 1}集',
                    style: TextStyle(
                      fontSize: 12,
                      color: isSelected ? Colors.black : Colors.white70,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
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
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: NetImage(
                    url: coverUrl,
                    fit: BoxFit.cover,
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
                            Colors.black.withOpacity(0.8),
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

          // 名称
          Text(
            shortName,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 13,
              color: Colors.white,
              height: 1.3,
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

  /// 构建固定播放器布局
  Widget _buildFixedPlayerLayout(ShortsDetailController controller, Map<String, dynamic> detail) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      body: Column(
        children: [
          // 自适应播放器区域
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Container(
              width: double.infinity,
              color: Colors.black,
              child: _buildPlayer(controller, detail),
            ),
          ),

          // 可滚动内容区域
          Expanded(
            child: CustomScrollView(
              slivers: [
                // 短剧信息
                SliverToBoxAdapter(
                  child: _buildInfo(detail),
                ),

                // 选集列表
                SliverToBoxAdapter(
                  child: _buildEpisodeList(controller, detail),
                ),

                // 推荐短剧标题
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(16, 24, 16, 12),
                    child: Text(
                      '推荐短剧',
                      style: TextStyle(
                        fontSize: 18,
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
                      childAspectRatio: 0.6,
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
                const SliverToBoxAdapter(
                  child: SizedBox(height: 100),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 构建响应式播放器
  Widget _buildResponsivePlayer(ShortsDetailController controller, Map<String, dynamic> detail) {
    return Obx(() {
      switch (controller.playerMode.value) {
        case 'full':
          return _buildFullPlayer(controller, detail);
        case 'mini':
          return _buildMiniPlayer(controller, detail);
        default:
          return const SizedBox.shrink();
      }
    });
  }

  /// 构建全屏播放器
  Widget _buildFullPlayer(ShortsDetailController controller, Map<String, dynamic> detail) {
    return Builder(
      builder: (context) {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: Container(
        height: 250,
        decoration: const BoxDecoration(
          color: Colors.black,
          boxShadow: [
            BoxShadow(
              color: Colors.black26,
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Stack(
          children: [
            // 播放器内容
            _buildPlayer(controller, detail),

            // 控制按钮
            Positioned(
              top: MediaQuery.of(context).padding.top + 8,
              right: 8,
              child: _buildPlayerControls(controller),
            ),
          ],
        ),
      ),
    );
      },
    );
  }

  /// 构建小窗播放器
  Widget _buildMiniPlayer(ShortsDetailController controller, Map<String, dynamic> detail) {
    return Builder(
      builder: (context) => Positioned(
        top: MediaQuery.of(context).padding.top + 8,
        right: 8,
        child: GestureDetector(
          onTap: () {
            // 点击小窗播放器切换回全屏
            controller.setFullMode();
          },
          child: Container(
            width: 160,
            height: 90,
            decoration: BoxDecoration(
              color: Colors.black,
              borderRadius: BorderRadius.circular(8),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.5),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Stack(
              children: [
                // 小窗播放器内容
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: _buildPlayer(controller, detail),
                ),

                // 关闭按钮
                Positioned(
                  top: 4,
                  right: 4,
                  child: GestureDetector(
                    onTap: () {
                      controller.hidePlayer();
                    },
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.7),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.close,
                        color: Colors.white,
                        size: 16,
                      ),
                    ),
                  ),
                ),

                // 播放状态指示器
                const Positioned(
                  bottom: 4,
                  left: 4,
                  child: Icon(
                    Icons.play_arrow,
                    color: Colors.white,
                    size: 16,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }



  /// 构建播放器控制按钮
  Widget _buildPlayerControls(ShortsDetailController controller) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // 关闭按钮
        GestureDetector(
          onTap: () {
            Get.back();
          },
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.6),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(
              Icons.close,
              color: Colors.white,
              size: 20,
            ),
          ),
        ),
      ],
    );
  }
}
