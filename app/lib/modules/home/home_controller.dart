import 'package:get/get.dart';
import '../../core/http_client.dart';
import '../../core/user_store.dart';
import '../../core/logger.dart';
import '../../core/cache_service.dart';
import '../../services/announcement_service.dart';

/// 首页控制器
/// 
/// 管理首页的频道切换、数据加载和缓存。
/// 
/// ## 核心功能
/// - 动态加载频道列表（从后端获取）
/// - 按频道加载模块数据
/// - 数据缓存（5分钟有效期）
/// - 继续观看模块（登录用户）
/// - 下拉刷新
/// 
/// ## 数据流
/// ```
/// 1. onInit() → _loadTabs() → loadChannelData('featured')
/// 2. 用户切换频道 → switchChannel() → loadChannelData()
/// 3. 检查缓存 → 有效则使用缓存，否则请求后端
/// 4. 登录用户 → 插入"继续观看"模块
/// ```
/// 
/// ## 缓存策略
/// - 缓存键：频道ID
/// - 缓存时间：5分钟
/// - 缓存内容：模块列表、跑马灯文本
/// - 清除时机：用户登录状态变化、手动刷新
/// 
/// ## 使用示例
/// ```dart
/// // 获取控制器
/// final controller = Get.find<HomeController>();
/// 
/// // 切换频道
/// controller.switchChannel(1);
/// 
/// // 刷新当前频道
/// await controller.refreshCurrentChannel();
/// 
/// // 清除所有缓存
/// controller.clearCache();
/// ```
class HomeController extends GetxController {
  final HttpClient _httpClient = HttpClient();

  // 频道列表（从后端动态获取）
  final RxList<Map<String, String>> channels = <Map<String, String>>[
    {'id': 'featured', 'name': '精选'}, // 默认频道
  ].obs;

  // 当前选中的频道索引
  final RxInt currentChannelIndex = 0.obs;

  // 当前频道 ID
  String get currentChannelId => channels.isNotEmpty 
      ? channels[currentChannelIndex.value]['id']! 
      : 'featured';

  // 加载状态
  final RxBool isLoading = false.obs;

  // 错误信息
  final RxString error = ''.obs;

  // 跑马灯文本
  final RxString marqueeText = ''.obs;

  // 跑马灯链接
  final RxString marqueeLink = ''.obs;

  // 模块列表
  final RxList<Map<String, dynamic>> modules = <Map<String, dynamic>>[].obs;

  // 🚀 缓存服务引用
  CacheService? _cacheService;
  CacheService get _cache {
    _cacheService ??= Get.find<CacheService>();
    return _cacheService!;
  }
  
  // 🚀 登录状态监听器（用于 onClose 时取消）
  Worker? _loginStatusWorker;

  @override
  void onInit() {
    super.onInit();
    
    // 🚀 监听用户登录状态变化（保存 Worker 引用以便 onClose 时取消）
    _loginStatusWorker = ever(UserStore.to.isLoggedInRx, (bool isLoggedIn) {
      Logger.info('User login status changed: $isLoggedIn');
      // 用户登录状态改变时，清除用户相关缓存并重新加载当前频道
      _cache.clearByType(CacheType.userData);
      loadChannelData(currentChannelId, forceRefresh: true);
    });
    
    // 延迟加载，等待用户状态和缓存服务初始化完成
    Future.delayed(const Duration(milliseconds: 500), () {
      // 先加载频道列表，再加载频道数据
      _loadTabs().then((_) {
        loadChannelData(currentChannelId).then((_) {
          // 数据加载完成后检查公告
          _checkAnnouncement();
        });
      });
    });
  }
  
  @override
  void onClose() {
    // 🚀 取消登录状态监听器，防止内存泄漏
    _loginStatusWorker?.dispose();
    _loginStatusWorker = null;
    super.onClose();
  }

  /// 从后端加载频道列表
  Future<void> _loadTabs() async {
    // 🚀 使用缓存服务的 getOrLoad 方法
    final cachedTabs = await _cache.getOrLoad<List>(
      CacheKeys.homeTabs,
      () async {
        try {
          final response = await _httpClient.get('/home_tabs');
          
          if (response.statusCode == 200 && response.data != null) {
            final tabs = response.data['tabs'] as List?;
            if (tabs != null && tabs.isNotEmpty) {
              return tabs;
            }
          }
        } catch (e) {
          Logger.warning('Failed to load tabs from server: $e');
        }
        return null;
      },
      type: CacheType.homeTabs,
    );
    
    if (cachedTabs != null && cachedTabs.isNotEmpty) {
      channels.value = cachedTabs.map((tab) => {
        'id': (tab['id'] as String?) ?? '',
        'name': (tab['title'] as String?) ?? '',
      }).toList();
      Logger.success('Loaded ${channels.length} tabs');
    } else {
      // 使用默认频道列表
      channels.value = [
        {'id': 'featured', 'name': '精选'},
        {'id': 'movie', 'name': '电影'},
        {'id': 'series', 'name': '剧集'},
        {'id': 'shorts', 'name': '短剧'},
        {'id': 'anime', 'name': '动漫'},
        {'id': 'variety', 'name': '综艺'},
      ];
      Logger.warning('Using default tabs');
    }
  }

  /// 切换频道
  void switchChannel(int index) {
    if (currentChannelIndex.value == index) return;

    currentChannelIndex.value = index;
    loadChannelData(currentChannelId);
  }

  /// 加载频道数据
  /// 
  /// [channelId] 频道ID
  /// [forceRefresh] 强制刷新（忽略缓存）
  Future<void> loadChannelData(String channelId, {bool forceRefresh = false}) async {
    final cacheKey = CacheKeys.homeLayout(channelId);
    
    // 🚀 非强制刷新时，先尝试从缓存加载
    if (!forceRefresh) {
      final cachedData = await _cache.get<Map<String, dynamic>>(cacheKey);
      if (cachedData != null) {
        _applyChannelData(cachedData, channelId);
        Logger.info('Using cached data for channel: $channelId');
        
        // 后台静默更新
        _backgroundUpdateChannel(channelId);
        return;
      }
    }

    // 从网络加载
    await _loadChannelDataFromNetwork(channelId);
  }
  
  /// 从网络加载频道数据
  Future<void> _loadChannelDataFromNetwork(String channelId) async {
    try {
      isLoading.value = true;
      error.value = '';

      final response = await _httpClient.get(
        '/home_layout',
        queryParameters: {'tab': channelId},
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;

        // 构建缓存数据
        final moduleList = (data['modules'] as List?)
                ?.map((e) => Map<String, dynamic>.from(e as Map))
                .toList() ??
            [];

        // 如果是精选频道且用户已登录，在顶部插入继续观看模块
        if (channelId == 'featured' && UserStore.to.isLoggedIn) {
          final continueWatchingModule = await _loadContinueWatching();
          if (continueWatchingModule != null) {
            moduleList.insert(0, continueWatchingModule);
          }
        }

        final cacheData = <String, dynamic>{
          'modules': moduleList,
          'marquee_text': data['marquee_text'] ?? '',
          'marquee_link': data['marquee_link'] ?? '',
        };

        // 🚀 保存到缓存
        await _cache.set(
          CacheKeys.homeLayout(channelId),
          cacheData,
          type: CacheType.homeLayout,
        );

        // 应用数据
        _applyChannelData(cacheData, channelId);

        Logger.success('Loaded ${moduleList.length} modules for channel: $channelId');
      } else {
        error.value = '服务器返回错误';
      }
    } catch (e) {
      Logger.error('Failed to load channel data: $e');
      
      // 🚀 网络失败时，尝试使用过期的缓存（离线模式）
      final cachedData = await _cache.get<Map<String, dynamic>>(
        CacheKeys.homeLayout(channelId),
        ignoreExpiry: true,
      );
      
      if (cachedData != null) {
        _applyChannelData(cachedData, channelId);
        Logger.info('Using expired cache for offline mode: $channelId');
        // 显示离线提示
        error.value = '网络不可用，显示缓存内容';
      } else {
        error.value = '网络连接失败，请检查网络设置';
      }
    } finally {
      isLoading.value = false;
    }
  }
  
  /// 应用频道数据到 UI
  void _applyChannelData(Map<String, dynamic> data, String channelId) {
    modules.value = List<Map<String, dynamic>>.from(data['modules'] as List? ?? []);
    marqueeText.value = (data['marquee_text'] ?? '') as String;
    marqueeLink.value = (data['marquee_link'] ?? '') as String;
  }
  
  /// 后台静默更新频道数据
  void _backgroundUpdateChannel(String channelId) async {
    try {
      final response = await _httpClient.get(
        '/home_layout',
        queryParameters: {'tab': channelId},
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        final moduleList = (data['modules'] as List?)
                ?.map((e) => Map<String, dynamic>.from(e as Map))
                .toList() ??
            [];

        if (channelId == 'featured' && UserStore.to.isLoggedIn) {
          final continueWatchingModule = await _loadContinueWatching();
          if (continueWatchingModule != null) {
            moduleList.insert(0, continueWatchingModule);
          }
        }

        final cacheData = <String, dynamic>{
          'modules': moduleList,
          'marquee_text': data['marquee_text'] ?? '',
          'marquee_link': data['marquee_link'] ?? '',
        };

        await _cache.set(
          CacheKeys.homeLayout(channelId),
          cacheData,
          type: CacheType.homeLayout,
        );

        // 如果当前还在这个频道，更新 UI
        if (currentChannelId == channelId) {
          _applyChannelData(cacheData, channelId);
        }

        Logger.debug('Background updated channel: $channelId');
      }
    } catch (e) {
      Logger.debug('Background update failed for $channelId: $e');
    }
  }

  /// 加载继续观看数据
  Future<Map<String, dynamic>?> _loadContinueWatching() async {
    try {
      final response = await _httpClient.get('/api/user/history');

      if (response.statusCode == 200 && response.data != null) {
        final historyList = (response.data['data'] as List?)
                ?.map((e) => e as Map<String, dynamic>)
                .toList() ??
            [];

        // 只取前 10 条
        final recentHistory = historyList.take(10).toList();

        if (recentHistory.isEmpty) {
          return null;
        }

        return {
          'id': 'continue_watching',
          'module_type': 'continue_watching',
          'title': '继续观看',
          'sort_order': -1, // 确保在最前面
          'data': recentHistory,
        };
      }
    } catch (e) {
      Logger.warning('Failed to load continue watching: $e');
    }

    return null;
  }

  /// 刷新当前频道
  Future<void> refreshCurrentChannel() async {
    // 🚀 强制刷新，忽略缓存
    await loadChannelData(currentChannelId, forceRefresh: true);
  }

  /// 清除所有缓存
  void clearCache() {
    // 🚀 使用缓存服务清除首页相关缓存
    _cache.clearByType(CacheType.homeLayout);
    _cache.clearByType(CacheType.homeTabs);
  }

  /// 检查并显示公告
  Future<void> _checkAnnouncement() async {
    try {
      // 延迟一点，确保页面已经渲染完成
      await Future.delayed(const Duration(milliseconds: 500));
      
      final context = Get.context;
      if (context != null && context.mounted) {
        await AnnouncementService.to.checkAndShowAnnouncement(context);
      }
    } catch (e) {
      Logger.warning('Check announcement error: $e');
    }
  }
}
