import 'package:get/get.dart';
import '../player_enums.dart';
import '../player_state.dart' show AppPlayerState;
import '../../logger.dart';

/// 预加载管理 Mixin
/// 
/// 负责视频预加载功能，提升切换集数时的播放体验：
/// - 预加载下一集的视频 URL
/// - 管理预加载缓存
/// - 在播放到 50% 时自动触发预加载
/// 
/// ## 预加载策略
/// 1. 当前视频播放到 50% 时，开始预加载下一集 URL
/// 2. 预加载只获取 URL，不下载视频数据
/// 3. 切换集数时优先使用预加载的 URL
/// 
/// ## 使用方式
/// ```dart
/// class GlobalPlayerManager extends GetxController 
///     with PlayerPreloadMixin {
///   // ...
/// }
/// ```
mixin PlayerPreloadMixin on GetxController {
  /// 预加载的 URL 缓存
  /// 
  /// Key: contentId_episodeIndex
  /// Value: videoUrl
  final Map<String, String> _preloadedUrls = {};

  /// 是否正在预加载
  final RxBool isPreloading = false.obs;

  // ==================== 抽象方法（由主类实现） ====================

  /// 获取当前播放状态
  AppPlayerState get currentPlayerState;

  /// 获取视频 URL
  Future<String> getVideoUrl(
    ContentType contentType,
    String contentId,
    int episodeIndex,
  );

  // ==================== 公开方法 ====================

  /// 预加载下一集
  /// 
  /// 获取下一集的视频 URL 并缓存，以便切换时快速播放
  Future<void> preloadNextEpisode() async {
    if (isPreloading.value) return;

    try {
      isPreloading.value = true;

      final state = currentPlayerState;
      final nextEpisodeIndex = state.episodeIndex + 1;
      
      // 🚀 检查是否有下一集（需要从控制器获取总集数）
      // 如果当前是最后一集，不预加载
      try {
        if (state.contentId.isNotEmpty && Get.isRegistered<dynamic>(tag: state.contentId)) {
          final controller = Get.find<dynamic>(tag: state.contentId);
          if (controller != null && controller.episodes != null) {
            final episodes = controller.episodes as List;
            if (nextEpisodeIndex > episodes.length) {
              Logger.debug('No next episode to preload (current: ${state.episodeIndex}, total: ${episodes.length})');
              return;
            }
          }
        }
      } catch (e) {
        // 找不到控制器，继续尝试预加载
        Logger.debug('No controller found for preload check: $e');
      }
      
      final preloadKey = _getPreloadKey(state.contentId, nextEpisodeIndex);

      // 如果已经预加载过，跳过
      if (_preloadedUrls.containsKey(preloadKey)) {
        Logger.debug('Already preloaded: $preloadKey');
        return;
      }

      // 获取下一集的视频 URL
      final nextUrl = await getVideoUrl(
        state.contentType,
        state.contentId,
        nextEpisodeIndex,
      );

      if (nextUrl.isNotEmpty) {
        _preloadedUrls[preloadKey] = nextUrl;
        Logger.success('Preloaded episode $nextEpisodeIndex: $preloadKey');
      } else {
        Logger.warning('No URL for episode $nextEpisodeIndex');
      }
    } catch (e) {
      Logger.error('Failed to preload: $e');
    } finally {
      isPreloading.value = false;
    }
  }

  /// 获取预加载的 URL
  /// 
  /// 如果指定集数已预加载，返回缓存的 URL，否则返回 null
  String? getPreloadedUrl(String contentId, int episodeIndex) {
    final key = _getPreloadKey(contentId, episodeIndex);
    return _preloadedUrls[key];
  }

  /// 清理预加载缓存
  /// 
  /// 在切换到不同内容时调用，避免缓存过多无用数据
  void clearPreloadCache() {
    _preloadedUrls.clear();
    Logger.debug('Cache cleared');
  }

  /// 清理指定内容的预加载缓存
  void clearPreloadCacheForContent(String contentId) {
    _preloadedUrls.removeWhere((key, value) => key.startsWith('${contentId}_'));
    Logger.debug('Cache cleared for: $contentId');
  }

  /// 生成预加载缓存键
  String _getPreloadKey(String contentId, int episodeIndex) {
    return '${contentId}_$episodeIndex';
  }

  /// 获取预加载缓存大小
  int get preloadCacheSize => _preloadedUrls.length;

  /// 释放预加载资源
  void disposePreloadMixin() {
    _preloadedUrls.clear();
    isPreloading.value = false;
  }
}
