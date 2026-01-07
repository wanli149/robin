import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'detail_controller.dart';
import '../../widgets/player/global_video_player.dart';
import '../../widgets/net_image.dart';
import '../../widgets/episode_selector.dart';
import '../../widgets/expandable_text.dart';
import '../../core/router.dart';
import '../../core/global_player_manager.dart';
import '../../services/share_service.dart';

/// 视频详情页
/// 显示视频播放器、详情信息、选集列表、推荐视频
class DetailPage extends StatefulWidget {
  final String videoId;

  const DetailPage({
    super.key,
    required this.videoId,
  });

  @override
  State<DetailPage> createState() => _DetailPageState();
}

class _DetailPageState extends State<DetailPage> {
  late DetailController controller;
  bool _isInitializing = false; // 防止重复初始化
  bool _hasInitialized = false; // 标记是否已经初始化过

  @override
  void initState() {
    super.initState();
    controller = Get.put(
      DetailController(videoId: widget.videoId),
      tag: widget.videoId,
    );
    
    // 在 initState 中初始化播放器，只执行一次
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initializePlayerOnce();
    });
  }
  
  /// 只在首次加载时初始化播放器
  void _initializePlayerOnce() {
    if (_hasInitialized || !mounted) return;
    
    final detail = controller.videoDetail.value;
    if (detail != null) {
      _initializeGlobalPlayerIfNeeded(controller, detail);
      _hasInitialized = true;
    } else if (!controller.error.value.isNotEmpty) {
      // 如果详情还没加载完且没有错误，等待一下再试
      Future.delayed(const Duration(milliseconds: 100), () {
        if (mounted) {
          _initializePlayerOnce();
        }
      });
    }
  }

  @override
  void dispose() {
    // 🚀 离开页面时暂停播放器并保存进度
    print('🎬 [DetailPage] Disposing, pausing player and saving progress');
    GlobalPlayerManager.to.pause();
    // 立即保存进度
    GlobalPlayerManager.to.saveProgress();
    // 离开页面时删除控制器
    Get.delete<DetailController>(tag: widget.videoId);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        
        // 如果全局播放器处于全屏模式，先退出全屏
        if (GlobalPlayerManager.to.playerMode.value == PlayerMode.fullscreen) {
          GlobalPlayerManager.to.exitFullscreen();
        } else {
          // 否则允许正常返回
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF121212),
        body: Obx(() => _buildContent(context, controller)),
      ),
    );
  }



  /// 构建内容
  Widget _buildContent(BuildContext context, DetailController controller) {
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

    final detail = controller.videoDetail.value;
    if (detail == null) {
      return const Center(
        child: Text(
          '视频不存在',
          style: TextStyle(
            color: Colors.white54,
            fontSize: 16,
          ),
        ),
      );
    }

    // 使用 Stack 避免全屏切换时的 Widget 重建
    final isFullscreen = GlobalPlayerManager.to.playerMode.value == PlayerMode.fullscreen;
    
    // 全屏模式：只显示播放器
    if (isFullscreen) {
      return Container(
        color: Colors.black,
        child: GlobalVideoPlayer(
          showControls: true,
          onTap: () {
            GlobalPlayerManager.to.togglePlayPause();
          },
        ),
      );
    }
    
    // 窗口模式：正常布局
    return Column(
      children: [
        // 播放器区域
        _buildPlayer(controller, detail),
        
        // 可滚动内容区域
        Expanded(
          child: CustomScrollView(
            slivers: [
              // 视频信息
              SliverToBoxAdapter(
                child: _buildInfo(controller, detail),
              ),

              // 操作按钮行
              SliverToBoxAdapter(
                child: _buildActionButtons(context, controller, detail),
              ),

              // 选集列表
              if (controller.episodes.isNotEmpty)
                SliverToBoxAdapter(
                  child: _buildEpisodeList(controller),
                ),

              // 推荐视频标题
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(16, 24, 16, 12),
                  child: Text(
                    '猜你喜欢',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),

              // 推荐视频列表
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.65,
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

              // 底部间距
              const SliverToBoxAdapter(
                child: SizedBox(height: 24),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// 构建播放器
  Widget _buildPlayer(DetailController controller, Map<String, dynamic> detail) {
    final playUrl = controller.currentPlayUrl;

    if (playUrl.isEmpty) {
      return AspectRatio(
        aspectRatio: 16 / 9,
        child: Container(
          color: Colors.black,
          child: const Center(
            child: Text(
              '暂无播放源',
              style: TextStyle(
                color: Colors.white54,
                fontSize: 16,
              ),
            ),
          ),
        ),
      );
    }

    // 播放器初始化已在 initState 中处理，这里不再重复初始化

    return SafeArea(
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: Hero(
          tag: 'video_${widget.videoId}',
          child: GlobalVideoPlayer(
            showControls: true,
            onTap: () {
              // 电视剧/电影详情页点击播放器切换播放/暂停
              GlobalPlayerManager.to.togglePlayPause();
            },
          ),
        ),
      ),
    );
  }

  /// 智能初始化全局播放器（避免重复初始化）
  void _initializeGlobalPlayerIfNeeded(DetailController controller, Map<String, dynamic> detail) {
    final playUrl = controller.currentPlayUrl;
    if (playUrl.isEmpty) return;

    // 防抖：如果正在初始化，跳过
    if (_isInitializing) {
      print('🎬 [DetailPage] Already initializing, skipping');
      return;
    }

    final manager = GlobalPlayerManager.to;
    final currentState = manager.currentState.value;
    
    // 简化逻辑：只在播放器不存在或内容完全不匹配时才重新初始化
    final hasPlayerInstance = manager.playerInstance != null;
    final isContentMatching = currentState.contentId == widget.videoId;
    
    // 如果播放器存在且内容ID匹配，则不重新初始化（忽略集数差异，因为可能是UI状态延迟）
    if (hasPlayerInstance && isContentMatching) {
      print('🎬 [DetailPage] Player already initialized for ${widget.videoId}, skipping reinit');
      return;
    }
    
    // 只有在播放器不存在或内容ID不匹配时才重新初始化
    print('🎬 [DetailPage] Need initialization: hasPlayer=$hasPlayerInstance, contentMatch=$isContentMatching');
    
    _isInitializing = true;

    // 判断内容类型（根据选集数量）
    final contentType = controller.episodes.length > 1 ? ContentType.tv : ContentType.movie;
    
    print('🎬 [DetailPage] Initializing player for ${widget.videoId}');
    
    // 切换到新内容时，不要保留旧视频的进度和播放状态
    // 新视频应该从头开始播放
    GlobalPlayerManager.to.switchContent(
      contentType: contentType,
      contentId: widget.videoId,
      episodeIndex: controller.currentEpisodeIndex.value + 1,
      config: PlayerConfig.tvWindow(),
      videoUrl: playUrl,
      autoPlay: true, // 新视频自动播放
    ).then((_) {
      _isInitializing = false; // 初始化完成
    }).catchError((error) {
      _isInitializing = false; // 初始化失败也要重置状态
      print('🎬 [DetailPage] Initialization failed: $error');
    });
  }



  /// 构建视频信息
  Widget _buildInfo(DetailController controller, Map<String, dynamic> detail) {
    final vodName = detail['vod_name'] as String? ?? '未知视频';
    final vodYear = detail['vod_year']?.toString() ?? '';
    final vodArea = detail['vod_area'] as String? ?? '';
    final vodDirector = detail['vod_director'] as String? ?? '';
    final vodActor = detail['vod_actor'] as String? ?? '';
    final vodWriter = detail['vod_writer'] as String? ?? '';
    final vodContent = detail['vod_content'] as String? ?? '';
    final vodRemarks = detail['vod_remarks'] as String? ?? '';
    final vodDuration = detail['vod_duration'] as String? ?? '';
    final vodTag = detail['vod_tag'] as String? ?? '';
    
    // 🆕 评分信息
    final vodScore = (detail['vod_score'] as num?)?.toDouble() ?? 0.0;
    final vodTmdbScore = (detail['vod_tmdb_score'] as num?)?.toDouble() ?? 0.0;

    final vodHits = (detail['vod_hits'] as num?)?.toInt() ?? 0;
    final vodHitsDay = (detail['vod_hits_day'] as num?)?.toInt() ?? 0;

    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 视频标题
          Text(
            vodName,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 12),

          // 🆕 评分和热度行
          Row(
            children: [
              // 评分
              if (vodScore > 0) ...[
                Icon(
                  Icons.star,
                  color: vodScore >= 8 ? Colors.amber : vodScore >= 6 ? Colors.blue : Colors.grey,
                  size: 20,
                ),
                const SizedBox(width: 4),
                Text(
                  vodScore.toStringAsFixed(1),
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: vodScore >= 8 ? Colors.amber : vodScore >= 6 ? Colors.blue : Colors.grey,
                  ),
                ),
                if (vodTmdbScore > 0) ...[
                  const SizedBox(width: 8),
                  Text(
                    'TMDB: ${vodTmdbScore.toStringAsFixed(1)}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Colors.white54,
                    ),
                  ),
                ],
                const SizedBox(width: 16),
              ],
              // 热度
              if (vodHits > 0) ...[
                const Icon(
                  Icons.visibility,
                  color: Colors.white54,
                  size: 16,
                ),
                const SizedBox(width: 4),
                Text(
                  '$vodHits次播放',
                  style: const TextStyle(
                    fontSize: 12,
                    color: Colors.white54,
                  ),
                ),
                if (vodHitsDay > 0) ...[
                  const SizedBox(width: 8),
                  Text(
                    '今日$vodHitsDay',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFFFFC107),
                    ),
                  ),
                ],
              ],
            ],
          ),
          const SizedBox(height: 12),

          // 标签行
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (vodYear.isNotEmpty) _buildTag(vodYear),
              if (vodArea.isNotEmpty) _buildTag(vodArea),
              if (vodDuration.isNotEmpty) _buildTag(vodDuration),
              if (vodRemarks.isNotEmpty) _buildTag(vodRemarks, color: const Color(0xFFFFC107)),
              // 🆕 标签
              if (vodTag.isNotEmpty)
                ...vodTag.split(',').take(3).map((tag) => _buildTag(tag.trim())),
            ],
          ),

          // 导演和演员（可点击）
          if (vodDirector.isNotEmpty) ...[
            const SizedBox(height: 12),
            _buildInfoRow('导演', vodDirector, clickable: true),
          ],
          if (vodActor.isNotEmpty) ...[
            const SizedBox(height: 8),
            _buildInfoRow('主演', vodActor, clickable: true),
          ],
          if (vodWriter.isNotEmpty) ...[
            const SizedBox(height: 8),
            _buildInfoRow('编剧', vodWriter),
          ],

          // 剧情简介（可折叠）
          if (vodContent.isNotEmpty) ...[
            const SizedBox(height: 16),
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
              text: vodContent,
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
  Widget _buildTag(String text, {Color? color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color ?? Colors.white24,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 12,
          color: color != null ? Colors.black87 : Colors.white70,
        ),
      ),
    );
  }

  /// 构建信息行（支持演员点击）
  Widget _buildInfoRow(String label, String value, {bool clickable = false}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$label：',
          style: const TextStyle(
            fontSize: 14,
            color: Colors.white54,
          ),
        ),
        Expanded(
          child: clickable && (label == '主演' || label == '导演')
              ? _buildClickableActors(value)
              : Text(
                  value,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.white70,
                  ),
                ),
        ),
      ],
    );
  }

  /// 构建可点击的演员列表
  Widget _buildClickableActors(String actorsStr) {
    final actors = actorsStr.split(RegExp(r'[,，、/\s]+')).where((a) => a.isNotEmpty).toList();
    
    return Wrap(
      spacing: 8,
      runSpacing: 4,
      children: actors.map((actor) {
        return GestureDetector(
          onTap: () async {
            // 搜索演员并跳转
            try {
              final response = await Get.find<DetailController>(tag: widget.videoId).searchActor(actor);
              if (response != null && response['id'] != null) {
                UniversalRouter.toActor(response['id'], actor);
              } else {
                Get.snackbar(
                  '提示',
                  '未找到演员信息',
                  snackPosition: SnackPosition.BOTTOM,
                );
              }
            } catch (e) {
              Get.snackbar(
                '错误',
                '搜索演员失败',
                snackPosition: SnackPosition.BOTTOM,
              );
            }
          },
          child: Text(
            actor,
            style: const TextStyle(
              fontSize: 14,
              color: Color(0xFFFFC107),
              decoration: TextDecoration.underline,
            ),
          ),
        );
      }).toList(),
    );
  }

  /// 构建操作按钮行
  Widget _buildActionButtons(BuildContext context, DetailController controller, Map<String, dynamic> detail) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          // 收藏按钮
          Expanded(
            child: _buildActionButton(
              icon: Obx(() => Icon(
                    controller.isFavorited.value
                        ? Icons.favorite
                        : Icons.favorite_border,
                    color: controller.isFavorited.value
                        ? Colors.red
                        : Colors.white,
                    size: 20,
                  )),
              label: '收藏',
              onTap: controller.toggleFavorite,
            ),
          ),
          const SizedBox(width: 12),

          // 预约按钮
          Expanded(
            child: _buildActionButton(
              icon: Obx(() => Icon(
                    controller.isAppointed.value
                        ? Icons.notifications_active
                        : Icons.notifications_none,
                    color: controller.isAppointed.value
                        ? const Color(0xFFFFC107)
                        : Colors.white,
                    size: 20,
                  )),
              label: '预约',
              onTap: controller.toggleAppointment,
            ),
          ),
          const SizedBox(width: 12),

          // 分享按钮
          Expanded(
            child: _buildActionButton(
              icon: const Icon(
                Icons.share,
                color: Colors.white,
                size: 20,
              ),
              label: '分享',
              onTap: () {
                final videoName = detail['vod_name'] as String? ?? '未知影片';
                
                ShareService.showShareDialog(
                  context: context,
                  type: 'video',
                  id: widget.videoId,
                  title: videoName,
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  /// 构建操作按钮
  Widget _buildActionButton({
    required Widget icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF1E1E1E),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            icon,
            const SizedBox(height: 4),
            Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                color: Colors.white70,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 构建选集列表（支持多播放源）
  Widget _buildEpisodeList(DetailController controller) {
    return Obx(() => EpisodeSelector(
      playSources: controller.playSources,
      currentSourceIndex: controller.currentSourceIndex.value,
      currentEpisodeIndex: controller.currentEpisodeIndex.value,
      onSourceChanged: controller.switchSource,
      onEpisodeSelected: controller.selectEpisode,
      continueInfo: controller.continuePlayInfo,
      onContinuePlay: controller.continuePlay,
    ));
  }

  /// 构建推荐项
  Widget _buildRecommendItem(Map<String, dynamic> recommend) {
    final vodId = recommend['vod_id']?.toString() ?? '';
    final vodName = recommend['vod_name'] as String? ?? '未知视频';
    final vodPic = recommend['vod_pic'] as String? ?? recommend['vod_pic_thumb'] as String? ?? '';
    final vodRemarks = recommend['vod_remarks'] as String? ?? '';
    final vodScore = (recommend['vod_score'] as num?)?.toDouble() ?? 0.0;

    return GestureDetector(
      onTap: () {
        // 跳转到视频详情页
        Get.toNamed('/video/detail', arguments: {'vodId': vodId});
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
                    url: vodPic,
                    fit: BoxFit.cover,
                  ),
                ),
                // 评分角标
                if (vodScore > 0)
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
                        vodScore.toStringAsFixed(1),
                        style: const TextStyle(
                          fontSize: 10,
                          color: Colors.black,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                // 更新状态角标
                if (vodRemarks.isNotEmpty)
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
                        vodRemarks,
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
            vodName,
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
}
