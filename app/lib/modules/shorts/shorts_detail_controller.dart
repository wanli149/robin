import 'package:get/get.dart';
import '../../core/http_client.dart';
import '../../core/global_player_manager.dart';
import '../../core/url_parser.dart';
import '../../core/logger.dart';

/// 短剧详情控制器
class ShortsDetailController extends GetxController {
  final String shortId;
  final HttpClient _httpClient = HttpClient();

  ShortsDetailController({required this.shortId});

  // 短剧详情
  final Rx<Map<String, dynamic>?> shortDetail = Rx<Map<String, dynamic>?>(null);

  // 选集列表
  final RxList<Map<String, dynamic>> episodes = <Map<String, dynamic>>[].obs;

  // 推荐短剧列表
  final RxList<Map<String, dynamic>> recommendations = <Map<String, dynamic>>[].obs;

  // 当前选中的集数索引
  final RxInt currentEpisodeIndex = 0.obs;

  // 加载状态
  final RxBool isLoading = false.obs;

  // 错误信息
  final RxString error = ''.obs;

  // 播放器模式：full(全屏), mini(小窗), pip(画中画), hidden(隐藏)
  final RxString playerMode = 'full'.obs;

  // 播放器是否可见
  final RxBool isPlayerVisible = true.obs;

  @override
  void onInit() {
    super.onInit();
    loadDetail();
  }

  /// 加载短剧详情
  Future<void> loadDetail() async {
    try {
      isLoading.value = true;
      error.value = '';

      // 新版API：GET /api/shorts/series/:seriesId
      final response = await _httpClient.get('/api/shorts/series/$shortId');

      if (response.statusCode == 200 && response.data != null) {
        final result = response.data;
        
        if (result['code'] == 1 && result['data'] != null) {
          final data = result['data'];
          
          // 短剧基本信息（使用后端返回的完整字段）
          shortDetail.value = {
            'id': data['series_id'] ?? shortId,
            'name': data['vod_name'] ?? '未知短剧',
            'cover': data['vod_pic_vertical'] ?? '',
            'description': data['vod_content'] ?? '',
            'category': data['category'] ?? '',
            'episode_count': data['total_episodes'] ?? 0,
            'view_count': data['vod_hits'] ?? 0,
            'vod_year': data['vod_year'] ?? '',
            'vod_area': data['vod_area'] ?? '',
            'vod_actor': data['vod_actor'] ?? '',
            'vod_director': data['vod_director'] ?? '',
            'vod_score': (data['vod_score'] as num?)?.toDouble() ?? 0.0,
            'vod_remarks': data['vod_remarks'] ?? '',
          };

          // 选集列表（新版API返回的episodes数组）
          final episodeList = (data['episodes'] as List?)
                  ?.map((e) => Map<String, dynamic>.from({
                        'vod_id': e['vod_id'],
                        'episode_index': e['episode_index'],
                        'episode_name': e['episode_name'],
                        'play_url': e['play_url'],
                      }))
                  .toList() ??
              [];
          episodes.value = episodeList;

          Logger.success('Loaded short detail: ${shortDetail.value!['name']}, ${episodes.length} episodes');
          
          // 加载推荐短剧
          _loadRecommendations();
        } else {
          error.value = result['msg'] ?? '加载失败';
        }
      } else {
        error.value = '网络请求失败';
      }
    } catch (e) {
      Logger.error('Failed to load short detail: $e');
      error.value = '加载失败，请重试';
    } finally {
      isLoading.value = false;
    }
  }

  /// 选择集数
  void selectEpisode(int index) {
    if (index < 0 || index >= episodes.length) return;

    currentEpisodeIndex.value = index;
    
    // 切换全局播放器到新集数
    final episode = episodes[index];
    final playUrl = episode['play_url'] as String? ?? '';
    
    if (playUrl.isNotEmpty) {
      // 解析视频URL（处理旧格式兼容）
      String videoUrl = _parseVideoUrl(playUrl);
      
      // 切换全局播放器到新集数
      GlobalPlayerManager.to.switchContent(
        contentType: ContentType.shorts,
        contentId: shortId,
        episodeIndex: index + 1,
        config: PlayerConfig.shortsWindow(),
        videoUrl: videoUrl,
        autoPlay: true,
      );
      
      Logger.success('Switched to episode: ${index + 1}');
    }
  }

  /// 解析视频URL（使用统一解析器）
  String _parseVideoUrl(String playUrl) {
    return UrlParser.parseVideoUrl(playUrl);
  }

  /// 进入锁定模式（竖屏全屏播放）
  void enterLockedMode() {
    if (episodes.isEmpty) {
      Get.snackbar(
        '提示',
        '暂无可播放的集数',
        snackPosition: SnackPosition.BOTTOM,
      );
      return;
    }

    // 使用全局播放器进入全屏模式
    GlobalPlayerManager.to.enterFullscreen();
  }

  /// 切换播放器模式
  void switchPlayerMode(String mode) {
    playerMode.value = mode;
  }

  /// 切换播放器可见性
  void togglePlayerVisibility() {
    isPlayerVisible.value = !isPlayerVisible.value;
  }

  /// 设置小窗模式
  void setMiniMode() {
    playerMode.value = 'mini';
  }

  /// 设置全屏模式
  void setFullMode() {
    playerMode.value = 'full';
  }

  /// 隐藏播放器
  void hidePlayer() {
    playerMode.value = 'hidden';
    isPlayerVisible.value = false;
  }

  /// 设置画中画模式
  void setPipMode() {
    playerMode.value = 'pip';
  }

  /// 检查是否在画中画模式
  bool get isPipMode => playerMode.value == 'pip';

  /// 加载推荐短剧
  Future<void> _loadRecommendations() async {
    try {
      final response = await _httpClient.get(
        '/api/recommend/shorts/$shortId',
        queryParameters: {'limit': '9'}, // 3x3 网格需要 9 个
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1 && data['data'] != null) {
          final list = (data['data']['list'] as List?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ?? [];
          
          recommendations.value = list;
          Logger.success('Loaded ${list.length} short recommendations');
        }
      }
    } catch (e) {
      Logger.error('Failed to load short recommendations: $e');
    }
  }

  /// 刷新推荐列表
  Future<void> refreshRecommendations() async {
    await _loadRecommendations();
  }
}
