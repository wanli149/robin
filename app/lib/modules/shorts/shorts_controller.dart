import 'package:get/get.dart';
import '../../core/http_client.dart';
import '../../core/global_player_manager.dart';
import '../../core/url_parser.dart';

/// 短剧播放器控制器
/// 
/// 管理短剧随机流的加载和播放状态，实现类似抖音的上下滑动播放体验。
/// 
/// ## 功能特性
/// - 随机短剧流加载
/// - 无限滚动（自动预加载）
/// - 与全局播放器集成
/// - 播放状态管理
/// 
/// ## 使用方式
/// ```dart
/// // 在页面中获取控制器
/// final controller = Get.find<ShortsController>();
/// 
/// // 刷新短剧列表
/// await controller.refresh();
/// 
/// // 切换到指定索引
/// controller.switchToIndex(5);
/// 
/// // 获取当前短剧
/// final current = controller.currentShort;
/// ```
/// 
/// ## 数据流
/// 1. 页面初始化时调用 `loadRandomShorts()` 加载首批数据
/// 2. 用户滑动时调用 `switchToIndex()` 切换视频
/// 3. 接近列表末尾时自动预加载更多
/// 4. 通过 `GlobalPlayerManager` 控制视频播放
/// 
/// ## API 接口
/// - `GET /api/shorts/random`: 获取随机短剧列表
/// 
/// ## 响应数据格式
/// ```json
/// {
///   "list": [
///     {
///       "vod_id": "123",
///       "vod_name": "短剧标题",
///       "play_url": "https://...",
///       "vod_pic": "https://..."
///     }
///   ]
/// }
/// ```
class ShortsController extends GetxController {
  /// HTTP 客户端
  final HttpClient _httpClient = HttpClient();

  /// 短剧列表（响应式）
  /// 
  /// 存储从 API 获取的短剧数据
  final RxList<Map<String, dynamic>> shortsList = <Map<String, dynamic>>[].obs;

  /// 当前播放索引（响应式）
  /// 
  /// 对应 shortsList 中的位置
  final RxInt currentIndex = 0.obs;

  /// 初始加载状态
  /// 
  /// 首次加载或刷新时为 true
  final RxBool isLoading = false.obs;

  /// 加载更多状态
  /// 
  /// 滚动加载更多时为 true
  final RxBool isLoadingMore = false.obs;

  /// 错误信息
  /// 
  /// 加载失败时的错误提示
  final RxString error = ''.obs;

  /// 是否还有更多数据
  /// 
  /// 为 false 时停止加载更多
  final RxBool hasMore = true.obs;

  @override
  void onInit() {
    super.onInit();
    loadRandomShorts();
  }

  /// 加载随机短剧列表
  /// 
  /// 从服务端获取随机短剧数据，支持刷新和追加加载。
  /// 
  /// [isRefresh] 是否为刷新操作
  /// - true: 清空现有列表，重新加载
  /// - false: 追加到现有列表末尾
  /// 
  /// ## 加载流程
  /// 1. 设置加载状态
  /// 2. 调用 `/api/shorts/random` 接口
  /// 3. 解析响应数据并追加到列表
  /// 4. 更新 hasMore 状态
  /// 
  /// ## 错误处理
  /// 加载失败时设置 error 字段，UI 层可据此显示错误提示
  Future<void> loadRandomShorts({bool isRefresh = false}) async {
    if (isRefresh) {
      shortsList.clear();
      hasMore.value = true;
      currentIndex.value = 0;
    }

    if (!hasMore.value) return;

    try {
      if (isRefresh) {
        isLoading.value = true;
      } else {
        isLoadingMore.value = true;
      }
      error.value = '';

      final response = await _httpClient.get('/api/shorts/random');

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        final List<dynamic> newShorts = data['list'] ?? [];

        if (newShorts.isEmpty) {
          hasMore.value = false;
          return;
        }

        // 转换为 Map 列表
        final List<Map<String, dynamic>> shorts = newShorts
            .map((e) => e as Map<String, dynamic>)
            .toList();

        shortsList.addAll(shorts);

        // 加载成功
      }
    } catch (e) {
      // 加载失败
      error.value = '加载失败，请重试';
    } finally {
      isLoading.value = false;
      isLoadingMore.value = false;
    }
  }

  /// 切换到指定索引的短剧
  /// 
  /// 更新当前播放索引，并通知全局播放器切换视频。
  /// 
  /// [index] 目标索引（对应 shortsList 中的位置）
  /// 
  /// ## 执行流程
  /// 1. 更新 currentIndex
  /// 2. 获取对应短剧的播放 URL
  /// 3. 调用 GlobalPlayerManager.switchContent() 切换视频
  /// 4. 检查是否需要预加载更多数据
  /// 
  /// ## 预加载策略
  /// 当 index >= shortsList.length - 3 时，自动触发加载更多
  void switchToIndex(int index) {
    currentIndex.value = index;

    // 切换全局播放器到新视频
    if (index < shortsList.length) {
      final currentShort = shortsList[index];
      final vodId = currentShort['vod_id']?.toString() ?? '';
      final playUrl = currentShort['play_url'] as String? ?? '';
      
      if (vodId.isNotEmpty && playUrl.isNotEmpty) {
        // 解析视频URL
        String videoUrl = _parseVideoUrl(playUrl);
        
        GlobalPlayerManager.to.switchContent(
          contentType: ContentType.shortsFlow,
          contentId: vodId,
          episodeIndex: 1,
          config: PlayerConfig.shortsFlow(),
          videoUrl: videoUrl,
          autoPlay: true,
        );
      }
    }

    // 如果接近列表末尾，预加载更多
    if (index >= shortsList.length - 3 && !isLoadingMore.value && hasMore.value) {
      loadRandomShorts();
    }
  }

  /// 获取当前短剧
  Map<String, dynamic>? get currentShort {
    if (shortsList.isEmpty || currentIndex.value >= shortsList.length) {
      return null;
    }
    return shortsList[currentIndex.value];
  }

  /// 刷新
  @override
  Future<void> refresh() async {
    await loadRandomShorts(isRefresh: true);
  }

  /// 暂停所有视频
  void pauseAllVideos() {
    // 使用全局播放器管理器暂停
    try {
      GlobalPlayerManager.to.pause();
    } catch (e) {
      // 暂停失败，忽略错误
      print('❌ Failed to pause global player: $e');
    }
  }

  /// 恢复当前视频播放
  void resumeCurrentVideo() {
    if (shortsList.isEmpty || currentIndex.value >= shortsList.length) return;
    
    // 使用全局播放器管理器播放当前视频
    final currentShort = shortsList[currentIndex.value];
    final vodId = currentShort['vod_id']?.toString() ?? '';
    final playUrl = currentShort['play_url'] as String? ?? '';
    
    if (vodId.isNotEmpty && playUrl.isNotEmpty) {
      try {
        // 解析视频URL
        String videoUrl = _parseVideoUrl(playUrl);
        
        GlobalPlayerManager.to.switchContent(
          contentType: ContentType.shortsFlow,
          contentId: vodId,
          episodeIndex: 1,
          config: PlayerConfig.shortsFlow(),
          videoUrl: videoUrl,
          autoPlay: true,
        );
      } catch (e) {
        print('❌ Failed to resume global player: $e');
      }
    }
  }

  /// 解析视频 URL
  /// 
  /// 使用统一的 URL 解析器处理各种格式的播放地址。
  /// 
  /// [playUrl] 原始播放 URL（可能包含多种格式）
  /// 
  /// 返回：可直接播放的视频 URL
  /// 
  /// 支持的格式：
  /// - 直接 URL: `https://xxx.m3u8`
  /// - 带标签: `HD$https://xxx.m3u8`
  /// - 多线路: `线路1$url1#线路2$url2`
  String _parseVideoUrl(String playUrl) {
    return UrlParser.parseVideoUrl(playUrl);
  }
}
