import 'package:get/get.dart';
import '../../core/http_client.dart';
import '../../core/user_store.dart';
import '../../core/global_player_manager.dart';
import '../../core/progress_sync_service.dart';
import '../../core/logger.dart';

/// 视频详情控制器
class DetailController extends GetxController {
  final String videoId;
  final HttpClient _httpClient = HttpClient();

  DetailController({required this.videoId});

  // 视频详情
  final Rx<Map<String, dynamic>?> videoDetail = Rx<Map<String, dynamic>?>(null);

  // 所有播放源列表 [{name: '超清1', episodes: [...], count: 10}]
  final RxList<Map<String, dynamic>> playSources = <Map<String, dynamic>>[].obs;
  
  // 当前选中的播放源索引
  final RxInt currentSourceIndex = 0.obs;

  // 当前播放源的选集列表
  final RxList<Map<String, dynamic>> episodes = <Map<String, dynamic>>[].obs;

  // 推荐视频列表
  final RxList<Map<String, dynamic>> recommendations = <Map<String, dynamic>>[].obs;

  // 当前选中的集数索引
  final RxInt currentEpisodeIndex = 0.obs;

  // 收藏状态
  final RxBool isFavorited = false.obs;

  // 预约状态
  final RxBool isAppointed = false.obs;

  // 加载状态
  final RxBool isLoading = false.obs;

  // 错误信息
  final RxString error = ''.obs;

  // 保存的播放位置
  final Rx<Duration> savedPosition = Duration.zero.obs;
  
  // 保存的集数索引（用于继续播放）
  final RxInt savedEpisodeIndex = 0.obs;

  /// 获取当前播放地址
  String get currentPlayUrl {
    if (episodes.isEmpty || currentEpisodeIndex.value >= episodes.length) {
      return '';
    }
    return episodes[currentEpisodeIndex.value]['url'] ?? '';
  }


  @override
  void onInit() {
    super.onInit();
    loadDetail();
  }

  /// 加载视频详情（使用合并后的多语言版本API）
  Future<void> loadDetail() async {
    try {
      isLoading.value = true;
      error.value = '';

      // 优先使用合并后的详情API（多语言版本合并）
      final response = await _httpClient.get(
        '/api/vod/detail/merged',
        queryParameters: {'ids': videoId},
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        
        if (data['code'] == 1 && data['data'] != null) {
          final vod = data['data'] as Map<String, dynamic>;
          videoDetail.value = vod;

          // 解析所有播放源（新格式：带语言信息）
          _parseAllSources(vod);
          
          // 加载保存的播放进度
          await loadSavedPosition();

          // 加载推荐视频
          final recs = data['recommendations'] as List?;
          if (recs != null && recs.isNotEmpty) {
            // 限制为9个（3x3网格）
            recommendations.value = recs
                .take(9)
                .map((e) => Map<String, dynamic>.from(e as Map))
                .toList();
          } else {
            _loadRecommendations();
          }

          // 检查收藏和预约状态
          _checkFavoriteStatus();
          _checkAppointmentStatus();

          Logger.success('[DetailController] Loaded merged video detail: ${vod['vod_name']}');
          
          // 打印可用语言和清晰度
          final availableLangs = vod['available_languages'] as List?;
          final availableQualities = vod['available_qualities'] as List?;
          if (availableLangs != null && availableLangs.isNotEmpty) {
            Logger.success('[DetailController] Available languages: $availableLangs');
          }
          if (availableQualities != null && availableQualities.isNotEmpty) {
            Logger.success('[DetailController] Available qualities: $availableQualities');
          }
        }
      }
    } catch (e) {
      Logger.error('[DetailController] Failed to load video detail: $e');
      error.value = '加载失败，请重试';
    } finally {
      isLoading.value = false;
    }
  }

  /// 解析所有播放源（新格式）
  void _parseAllSources(Map<String, dynamic> vod) {
    final playSources = vod['play_sources'] as List?;
    if (playSources == null || playSources.isEmpty) {
      Logger.warning('[DetailController] No play_sources found');
      return;
    }
    _parsePlaySources(playSources);
  }
  
  /// 解析播放源（优化版：支持多语言版本）
  void _parsePlaySources(List playSources) {
    int defaultSourceIndex = 0;
    
    // 直接使用后端返回的数据，保留语言和清晰度信息
    final parsedSources = <Map<String, dynamic>>[];
    
    for (var i = 0; i < playSources.length; i++) {
      final source = playSources[i] as Map<String, dynamic>;
      final episodes = source['episodes'] as List? ?? [];
      
      if (episodes.isNotEmpty) {
        parsedSources.add({
          'name': source['name'] ?? '线路${i + 1}',
          'language': source['language'] ?? '原声',  // 语言版本
          'quality': source['quality'],               // 清晰度
          'episodes': episodes,
          'count': episodes.length,
        });
        
        // 优先选择包含 m3u8 的播放源
        final sourceName = (source['name'] as String? ?? '').toLowerCase();
        if (defaultSourceIndex == 0 && 
            (sourceName.contains('m3u8') || sourceName.contains('ffm3u8'))) {
          defaultSourceIndex = parsedSources.length - 1;
        }
      }
    }
    
    this.playSources.value = parsedSources;
    Logger.success('[DetailController] Loaded ${parsedSources.length} play sources with language info');
    
    // 设置默认播放源
    if (parsedSources.isNotEmpty) {
      currentSourceIndex.value = defaultSourceIndex;
      _updateEpisodesFromSource(defaultSourceIndex);
    }
  }
  
  /// 更新当前播放源的选集列表
  void _updateEpisodesFromSource(int sourceIndex) {
    if (sourceIndex < 0 || sourceIndex >= playSources.length) return;
    
    final source = playSources[sourceIndex];
    final sourceEpisodes = (source['episodes'] as List?)
        ?.map((e) => Map<String, dynamic>.from(e as Map))
        .toList() ?? [];
    episodes.value = sourceEpisodes;
    
    Logger.success('[DetailController] Switched to source: ${source['name']}, ${sourceEpisodes.length} episodes');
  }
  
  /// 切换播放源（保持当前集数和播放位置）
  void switchSource(int sourceIndex) async {
    if (sourceIndex < 0 || sourceIndex >= playSources.length) return;
    if (sourceIndex == currentSourceIndex.value) return;
    
    // 保存当前播放状态
    final previousEpisodeIndex = currentEpisodeIndex.value;
    final previousPosition = GlobalPlayerManager.to.currentState.value.position;
    
    currentSourceIndex.value = sourceIndex;
    _updateEpisodesFromSource(sourceIndex);
    
    // 保持当前集数（如果新源有这一集的话）
    if (episodes.isNotEmpty) {
      // 确保集数索引在新源的范围内
      final targetEpisodeIndex = previousEpisodeIndex < episodes.length 
          ? previousEpisodeIndex 
          : episodes.length - 1;
      
      currentEpisodeIndex.value = targetEpisodeIndex;
      await _playCurrentEpisodeWithPosition(previousPosition);
    }
  }
  
  /// 播放当前集数并跳转到指定位置
  Future<void> _playCurrentEpisodeWithPosition(Duration position) async {
    final playUrl = currentPlayUrl;
    if (playUrl.isEmpty) return;
    
    final contentType = episodes.length > 1 ? ContentType.tv : ContentType.movie;
    final contentName = videoDetail.value?['vod_name'] as String? ?? '';
    
    await GlobalPlayerManager.to.switchContent(
      contentType: contentType,
      contentId: videoId,
      contentName: contentName,
      episodeIndex: currentEpisodeIndex.value + 1,
      config: PlayerConfig.tvWindow(),
      videoUrl: playUrl,
      autoPlay: true,
    );
    
    // 切换完成后跳转到之前的播放位置
    if (position.inSeconds > 0) {
      await GlobalPlayerManager.to.seekTo(position);
      Logger.success('[DetailController] Restored position after source switch: ${position.inSeconds}s');
    }
  }
  
  /// 播放当前选中的集数
  void _playCurrentEpisode() {
    final playUrl = currentPlayUrl;
    if (playUrl.isEmpty) return;
    
    final contentType = episodes.length > 1 ? ContentType.tv : ContentType.movie;
    final contentName = videoDetail.value?['vod_name'] as String? ?? '';
    
    GlobalPlayerManager.to.switchContent(
      contentType: contentType,
      contentId: videoId,
      contentName: contentName,
      episodeIndex: currentEpisodeIndex.value + 1,
      config: PlayerConfig.tvWindow(),
      videoUrl: playUrl,
      autoPlay: true,
    );
  }


  /// 检查收藏状态
  Future<void> _checkFavoriteStatus() async {
    if (!UserStore.to.isLoggedIn) return;

    try {
      final response = await _httpClient.get('/api/user/favorites');
      if (response.statusCode == 200 && response.data != null) {
        final favorites = (response.data['data'] as List?)
                ?.map((e) => Map<String, dynamic>.from(e as Map))
                .toList() ?? [];

        isFavorited.value = favorites.any((f) => f['vod_id'] == videoId);
      }
    } catch (e) {
      Logger.error('[DetailController] Failed to check favorite status: $e');
    }
  }

  /// 检查预约状态
  Future<void> _checkAppointmentStatus() async {
    if (!UserStore.to.isLoggedIn) return;

    try {
      final response = await _httpClient.get('/api/user/appointments');
      if (response.statusCode == 200 && response.data != null) {
        final appointments = (response.data['data'] as List?)
                ?.map((e) => Map<String, dynamic>.from(e as Map))
                .toList() ?? [];

        isAppointed.value = appointments.any((a) => a['vod_id'] == videoId);
      }
    } catch (e) {
      Logger.error('[DetailController] Failed to check appointment status: $e');
    }
  }

  /// 选择集数
  void selectEpisode(int index) {
    if (index < 0 || index >= episodes.length) return;

    currentEpisodeIndex.value = index;
    savedPosition.value = Duration.zero;
    _playCurrentEpisode();
    
    Logger.success('[DetailController] Selected episode: ${episodes[index]['name']}');
  }

  /// 切换收藏
  Future<void> toggleFavorite() async {
    if (!UserStore.to.requireLoginForFeature('favorites')) return;

    try {
      if (isFavorited.value) {
        await _httpClient.delete('/api/user/favorite/$videoId');
        isFavorited.value = false;
        Get.snackbar('提示', '已取消收藏', snackPosition: SnackPosition.BOTTOM);
      } else {
        await _httpClient.post('/api/user/favorite', data: {
          'vod_id': videoId,
          'vod_name': videoDetail.value?['vod_name'] ?? '',
          'vod_pic': videoDetail.value?['vod_pic'] ?? '',
        });
        isFavorited.value = true;
        Get.snackbar('提示', '已添加到收藏', snackPosition: SnackPosition.BOTTOM);
      }
    } catch (e) {
      Logger.error('[DetailController] Failed to toggle favorite: $e');
      Get.snackbar('错误', '操作失败，请重试', snackPosition: SnackPosition.BOTTOM);
    }
  }

  /// 切换预约
  Future<void> toggleAppointment() async {
    if (!UserStore.to.requireLoginForFeature('appointments')) return;

    try {
      if (isAppointed.value) {
        await _httpClient.delete('/api/appointment/$videoId');
        isAppointed.value = false;
        Get.snackbar('提示', '已取消预约', snackPosition: SnackPosition.BOTTOM);
      } else {
        await _httpClient.post('/api/appointment', data: {
          'vod_id': videoId,
          'vod_name': videoDetail.value?['vod_name'] ?? '',
          'release_date': videoDetail.value?['vod_time'] ?? videoDetail.value?['vod_year'] ?? '',
        });
        isAppointed.value = true;
        Get.snackbar('提示', '预约成功，更新时将通知您', snackPosition: SnackPosition.BOTTOM);
      }
    } catch (e) {
      Logger.error('[DetailController] Failed to toggle appointment: $e');
      Get.snackbar('错误', '操作失败，请重试', snackPosition: SnackPosition.BOTTOM);
    }
  }

  DateTime? _lastSyncTime;
  
  /// 播放进度更新回调
  void onProgressUpdate(Duration position, Duration duration) {
    final now = DateTime.now();
    if (_lastSyncTime == null || now.difference(_lastSyncTime!).inSeconds >= 30) {
      _syncProgress(position, duration);
      _lastSyncTime = now;
    }
  }

  /// 同步播放进度
  Future<void> _syncProgress(Duration position, Duration duration) async {
    final contentType = episodes.length > 1 ? 'tv' : 'movie';
    
    try {
      await ProgressSyncService.to.saveProgress(
        contentType: contentType,
        contentId: videoId,
        episodeIndex: currentEpisodeIndex.value + 1,
        positionSeconds: position.inSeconds,
        durationSeconds: duration.inSeconds,
      );
    } catch (e) {
      Logger.error('[DetailController] Failed to save progress: $e');
    }
    
    if (UserStore.to.isLoggedIn) {
      try {
        await _httpClient.post('/api/user/sync', data: {
          'vod_id': videoId,
          'vod_name': videoDetail.value?['vod_name'] ?? '',
          'vod_pic': videoDetail.value?['vod_pic'] ?? '',
          'progress': position.inSeconds,
          'duration': duration.inSeconds,
        });
      } catch (e) {
        Logger.error('[DetailController] Failed to sync history: $e');
      }
    }
  }

  /// 加载保存的播放位置（用于自动恢复）
  Future<void> loadSavedPosition() async {
    try {
      final contentType = episodes.length > 1 ? 'tv' : 'movie';
      
      // 尝试加载每一集的进度，找到最后观看的
      for (var i = episodes.length - 1; i >= 0; i--) {
        final position = await ProgressSyncService.to.loadProgress(
          contentType: contentType,
          contentId: videoId,
          episodeIndex: i + 1,
        );
        
        if (position.inSeconds > 0) {
          savedPosition.value = position;
          savedEpisodeIndex.value = i;
          Logger.success('[DetailController] Found saved position: episode ${i + 1}, ${position.inSeconds}s');
          return;
        }
      }
    } catch (e) {
      Logger.error('[DetailController] Failed to load saved position: $e');
    }
  }

  /// 加载推荐视频
  Future<void> _loadRecommendations() async {
    try {
      final response = await _httpClient.get(
        '/api/recommend/similar/$videoId',
        queryParameters: {'limit': '9'}, // 3x3 网格需要 9 个
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1 && data['data'] != null) {
          // 兼容两种格式：data['data'] 可能是列表或包含 list 字段的对象
          List? rawList;
          if (data['data'] is List) {
            rawList = data['data'] as List;
          } else if (data['data'] is Map && data['data']['list'] != null) {
            rawList = data['data']['list'] as List;
          }
          
          if (rawList != null && rawList.isNotEmpty) {
            // 限制为9个（3x3网格）
            final list = rawList
                .take(9)
                .map((e) => Map<String, dynamic>.from(e as Map))
                .toList();
            recommendations.value = list;
          }
        }
      }
    } catch (e) {
      Logger.error('[DetailController] Failed to load recommendations: $e');
    }
  }

  /// 搜索演员
  Future<Map<String, dynamic>?> searchActor(String actorName) async {
    try {
      final response = await _httpClient.get(
        '/api/actors/search',
        queryParameters: {'keyword': actorName, 'limit': '1'},
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1 && data['data'] != null) {
          final list = data['data'] as List;
          if (list.isNotEmpty) {
            return Map<String, dynamic>.from(list[0] as Map);
          }
        }
      }
      return null;
    } catch (e) {
      Logger.error('[DetailController] Failed to search actor: $e');
      return null;
    }
  }
}
