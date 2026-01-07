import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../core/http_client.dart';
import '../../core/user_store.dart';
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

  // 频道数据缓存（存储完整的缓存数据，包括时间戳）
  final Map<String, Map<String, dynamic>> _channelCache = {};

  @override
  void onInit() {
    super.onInit();
    
    // 监听用户登录状态变化
    ever(UserStore.to.isLoggedInRx, (bool isLoggedIn) {
      print('🔄 User login status changed: $isLoggedIn');
      // 用户登录状态改变时，清除缓存并重新加载当前频道
      clearCache();
      loadChannelData(currentChannelId);
    });
    
    // 延迟加载，等待用户状态初始化完成
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

  /// 从后端加载频道列表
  Future<void> _loadTabs() async {
    try {
      final response = await _httpClient.get('/home_tabs');
      
      if (response.statusCode == 200 && response.data != null) {
        final tabs = response.data['tabs'] as List?;
        if (tabs != null && tabs.isNotEmpty) {
          channels.value = tabs.map((tab) => {
            'id': (tab['id'] as String?) ?? '',
            'name': (tab['title'] as String?) ?? '',
          }).toList();
          print('✅ Loaded ${channels.length} tabs from server');
        }
      }
    } catch (e) {
      print('⚠️ Failed to load tabs, using defaults: $e');
      // 使用默认频道列表
      channels.value = [
        {'id': 'featured', 'name': '精选'},
        {'id': 'movie', 'name': '电影'},
        {'id': 'series', 'name': '剧集'},
        {'id': 'shorts', 'name': '短剧'},
        {'id': 'anime', 'name': '动漫'},
        {'id': 'variety', 'name': '综艺'},
      ];
    }
  }

  /// 切换频道
  void switchChannel(int index) {
    if (currentChannelIndex.value == index) return;

    currentChannelIndex.value = index;
    loadChannelData(currentChannelId);
  }

  /// 加载频道数据
  Future<void> loadChannelData(String channelId) async {
    // 检查缓存（5分钟内有效）
    if (_channelCache.containsKey(channelId)) {
      final cachedData = _channelCache[channelId]!;
      final cacheTime = cachedData['_cache_time'] as int?;
      
      // 如果缓存在5分钟内，直接使用
      if (cacheTime != null && 
          DateTime.now().millisecondsSinceEpoch - cacheTime < 300000) {
        modules.value = List<Map<String, dynamic>>.from(cachedData['modules'] as List);
        marqueeText.value = (cachedData['marquee_text'] ?? '') as String;
        marqueeLink.value = (cachedData['marquee_link'] ?? '') as String;
        print('📦 Using cached data for channel: $channelId');
        return;
      }
    }

    try {
      isLoading.value = true;
      error.value = '';

      final response = await _httpClient.get(
        '/home_layout',
        queryParameters: {'tab': channelId},
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;

        // 更新跑马灯
        marqueeText.value = data['marquee_text'] ?? '';
        marqueeLink.value = data['marquee_link'] ?? '';

        // 更新模块列表
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

        modules.value = moduleList;

        // 缓存数据（带时间戳）
        _channelCache[channelId] = <String, dynamic>{
          'modules': moduleList,
          'marquee_text': marqueeText.value,
          'marquee_link': marqueeLink.value,
          '_cache_time': DateTime.now().millisecondsSinceEpoch,
        };

        print('✅ Loaded ${moduleList.length} modules for channel: $channelId');
      } else {
        error.value = '服务器返回错误';
      }
    } catch (e) {
      print('❌ Failed to load channel data: $e');
      
      // 检查是否是 401 错误（需要登录的接口）
      if (e.toString().contains('401')) {
        // 401错误时，显示内容但不显示需要登录的模块
        print('⚠️ 401 error for channel $channelId, loading public content only');
        
        // 加载公开内容（不需要登录的模块）
        await _loadPublicContent(channelId);
      } else {
        error.value = '网络连接失败，请检查网络设置';
      }
    } finally {
      isLoading.value = false;
    }
  }

  /// 加载公开内容（不需要登录）
  Future<void> _loadPublicContent(String channelId) async {
    try {
      // 尝试加载不需要登录的内容
      final response = await _httpClient.get(
        '/home_layout',
        queryParameters: {
          'tab': channelId,
          'public_only': 'true', // 只获取公开内容
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;

        // 更新跑马灯
        marqueeText.value = data['marquee_text'] ?? '';
        marqueeLink.value = data['marquee_link'] ?? '';

        // 更新模块列表（只包含公开模块）
        final moduleList = (data['modules'] as List?)
                ?.map((e) => Map<String, dynamic>.from(e as Map))
                .toList() ??
            [];

        modules.value = moduleList;

        // 如果是精选频道且没有登录，显示登录提示模块
        if (channelId == 'featured' && !UserStore.to.isLoggedIn) {
          final loginPromptModule = _createLoginPromptModule();
          modules.insert(0, loginPromptModule);
        }

        print('✅ Loaded ${moduleList.length} public modules for channel: $channelId');
      } else {
        // 如果公开内容也加载失败，显示基本内容
        _loadFallbackContent(channelId);
      }
    } catch (e) {
      print('❌ Failed to load public content: $e');
      _loadFallbackContent(channelId);
    }
  }

  /// 加载备用内容
  void _loadFallbackContent(String channelId) {
    modules.value = [];
    
    // 显示登录提示（仅精选频道）
    if (channelId == 'featured') {
      final loginPromptModule = _createLoginPromptModule();
      modules.add(loginPromptModule);
    }
    
    marqueeText.value = '欢迎使用拾光影视';
    marqueeLink.value = '';
  }

  /// 创建登录提示模块
  Map<String, dynamic> _createLoginPromptModule() {
    return {
      'id': 'login_prompt',
      'module_type': 'login_prompt',
      'title': '登录获取更多内容',
      'sort_order': -2,
      'data': {
        'message': '登录后可查看个性化推荐、观看历史等更多内容',
        'login_text': '立即登录',
        'register_text': '注册账号',
      },
    };
  }

  /// 加载继续观看数据
  Future<Map<String, dynamic>?> _loadContinueWatching() async {
    try {
      final response = await _httpClient.get('/api/user/history');

      if (response.statusCode == 200 && response.data != null) {
        final historyList = (response.data['list'] as List?)
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
      print('⚠️ Failed to load continue watching: $e');
    }

    return null;
  }

  /// 刷新当前频道
  Future<void> refreshCurrentChannel() async {
    // 清除缓存
    _channelCache.remove(currentChannelId);
    await loadChannelData(currentChannelId);
  }

  /// 清除所有缓存
  void clearCache() {
    _channelCache.clear();
  }

  /// 检查并显示公告
  Future<void> _checkAnnouncement() async {
    try {
      // 延迟一点，确保页面已经渲染完成
      await Future.delayed(const Duration(milliseconds: 500));
      
      final context = Get.context;
      if (context != null) {
        await AnnouncementService.to.checkAndShowAnnouncement(context);
      }
    } catch (e) {
      print('⚠️ Check announcement error: $e');
    }
  }
}
