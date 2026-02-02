import 'dart:convert';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'logger.dart';
import 'network/base_cache_service.dart';

/// 统一缓存服务
///
/// 提供多级缓存策略，支持内存缓存和持久化缓存。
///
/// ## 设计原则
/// 1. 离线优先：先显示缓存数据，后台静默更新
/// 2. 智能过期：不同数据类型使用不同的过期策略
/// 3. 内存优化：限制内存缓存大小，自动清理
/// 4. 数据一致性：缓存更新时同步内存和持久化存储
///
/// ## 缓存层级
/// ```
/// ┌─────────────────────────────────────────┐
/// │  L1: 内存缓存 (最快，应用生命周期内有效)   │
/// ├─────────────────────────────────────────┤
/// │  L2: 本地持久化 (SharedPreferences)      │
/// ├─────────────────────────────────────────┤
/// │  L3: 网络请求 (最慢，需要网络连接)        │
/// └─────────────────────────────────────────┘
/// ```
///
/// ## 使用示例
/// ```dart
/// // 获取缓存数据（自动处理多级缓存）
/// final data = await CacheService.to.get<Map>('home_featured');
///
/// // 设置缓存数据
/// await CacheService.to.setWithType('home_featured', data,
///   type: CacheType.homeLayout,
/// );
///
/// // 检查缓存是否有效
/// final isValid = await CacheService.to.isValid('home_featured');
/// ```
class CacheService extends GetxService with BaseCacheService {
  static CacheService get to => Get.find<CacheService>();

  // ==================== 配置 ====================

  @override
  int get maxMemoryCacheSize => 100;

  @override
  String get cachePrefix => 'cache_';

  // 🚀 初始化状态标志
  bool _isInitialized = false;

  /// 检查是否已初始化
  bool get isInitialized => _isInitialized;

  /// 初始化缓存服务
  Future<CacheService> init() async {
    if (_isInitialized) {
      Logger.warning('[CacheService] Already initialized, skipping');
      return this;
    }

    Logger.info('[CacheService] Starting initialization...', 'Init');

    // 🚀 先标记初始化完成，避免循环依赖
    _isInitialized = true;

    // 启动时清理过期缓存
    await clearExpired();
    Logger.info('[CacheService] Expired cache cleared', 'Init');

    // 预加载关键缓存到内存
    await _preloadCriticalCache();
    Logger.info('[CacheService] Critical cache preloaded', 'Init');

    Logger.success('[CacheService] Initialized');
    return this;
  }

  // ==================== 公开 API ====================

  /// 获取缓存数据（重写以添加类型支持）
  @override
  Future<T?> get<T>(String key, {bool allowStale = false}) async {
    _ensureInitialized();
    return super.get<T>(key, allowStale: allowStale);
  }

  /// 设置缓存数据（带类型支持）
  Future<void> setWithType<T>(
    String key,
    T data, {
    CacheType type = CacheType.general,
    Duration? customTtl,
  }) async {
    _ensureInitialized();

    final ttl = customTtl ?? type.ttl;
    await set(key, data, ttl: ttl.inSeconds, persist: true);

    // 保存类型信息到元数据
    await _saveTypeMetadata(key, type);
  }

  /// 清除指定类型的所有缓存
  Future<void> clearByType(CacheType type) async {
    final prefs = await SharedPreferences.getInstance();
    final keysToRemove = <String>[];

    // 查找所有该类型的缓存
    for (final key in prefs.getKeys()) {
      if (key.startsWith('${cachePrefix}type_')) {
        final typeJson = prefs.getString(key);
        if (typeJson != null && typeJson == type.name) {
          final cacheKey = key.substring('${cachePrefix}type_'.length);
          keysToRemove.add(cacheKey);
        }
      }
    }

    // 删除缓存
    for (final key in keysToRemove) {
      await remove(key);
    }

    Logger.info(
      '[CacheService] Cleared ${keysToRemove.length} entries of type: ${type.name}',
    );
  }

  /// 检查缓存是否有效（未过期）
  Future<bool> isValid(String key) async {
    final meta = await _getMetadata(key);
    return meta != null && !meta.isExpired;
  }

  /// 获取缓存的过期时间
  Future<DateTime?> getExpiryTime(String key) async {
    final meta = await _getMetadata(key);
    return meta?.expiryTime;
  }

  /// 获取缓存统计信息
  CacheStats getCacheStats() {
    final stats = getStats();
    return CacheStats(
      memoryCacheCount: stats['memorySize']!,
      localCacheCount: 0, // 需要异步获取，这里简化
      maxMemoryCacheEntries: stats['memoryMaxSize']!,
    );
  }

  // ==================== 便捷方法 ====================

  /// 获取或加载数据（带自动缓存）
  ///
  /// 如果缓存有效则返回缓存，否则调用 loader 加载数据并缓存
  ///
  /// [key] 缓存键
  /// [loader] 数据加载函数
  /// [type] 缓存类型
  /// [forceRefresh] 强制刷新（忽略缓存）
  Future<T?> getOrLoad<T>(
    String key,
    Future<T?> Function() loader, {
    CacheType type = CacheType.general,
    bool forceRefresh = false,
  }) async {
    // 非强制刷新时，先检查缓存
    if (!forceRefresh) {
      final cached = await get<T>(key);
      if (cached != null) {
        // 后台静默更新（如果缓存即将过期）
        _backgroundRefreshIfNeeded(key, loader, type);
        return cached;
      }
    }

    // 加载新数据
    try {
      final data = await loader();
      if (data != null) {
        await setWithType(key, data, type: type);
      }
      return data;
    } catch (e) {
      Logger.error('[CacheService] Load failed for $key: $e');
      // 加载失败时，尝试返回过期的缓存（离线模式）
      return await get<T>(key, allowStale: true);
    }
  }

  // ==================== 私有方法 ====================

  /// 🚀 确保已初始化（内部使用）
  void _ensureInitialized() {
    if (!_isInitialized) {
      throw StateError('CacheService not initialized. Call init() first.');
    }
  }

  /// 保存类型元数据
  Future<void> _saveTypeMetadata(String key, CacheType type) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('${cachePrefix}type_$key', type.name);
  }

  /// 获取缓存元数据（重写以支持类型）
  Future<CacheMetadata?> _getMetadata(String key) async {
    final prefs = await SharedPreferences.getInstance();
    final metaJson = prefs.getString('${cachePrefix}meta_$key');
    if (metaJson == null) return null;

    try {
      return CacheMetadata.fromJson(jsonDecode(metaJson));
    } catch (e) {
      return null;
    }
  }

  /// 预加载关键缓存到内存
  Future<void> _preloadCriticalCache() async {
    final criticalKeys = ['home_tabs', 'home_featured', 'shorts_flow_state'];

    for (final key in criticalKeys) {
      final data = await get(key, allowStale: true);
      if (data != null) {
        Logger.debug('[CacheService] Preloaded: $key');
      }
    }
  }

  /// 后台静默刷新（如果缓存即将过期）
  void _backgroundRefreshIfNeeded<T>(
    String key,
    Future<T?> Function() loader,
    CacheType type,
  ) async {
    final meta = await _getMetadata(key);
    if (meta == null) return;

    // 如果缓存剩余时间少于 20%，后台刷新
    final totalTtl = type.ttl.inMilliseconds;
    final remaining = meta.expiryTime.difference(DateTime.now()).inMilliseconds;

    if (remaining < totalTtl * 0.2) {
      Logger.debug('[CacheService] Background refresh for $key');
      try {
        final data = await loader();
        if (data != null) {
          await setWithType(key, data, type: type);
        }
      } catch (e) {
        // 后台刷新失败，忽略错误
        Logger.debug('[CacheService] Background refresh failed for $key: $e');
      }
    }
  }
}

// ==================== 缓存类型 ====================

/// 缓存类型枚举
///
/// 不同类型的数据使用不同的过期策略
enum CacheType {
  /// 首页布局数据（频道、模块）
  /// 过期时间：10分钟
  /// 理由：首页数据更新频率中等，需要保持一定新鲜度
  homeLayout(Duration(minutes: 10)),

  /// 频道列表
  /// 过期时间：1小时
  /// 理由：频道列表变化不频繁
  homeTabs(Duration(hours: 1)),

  /// 短剧流数据
  /// 过期时间：5分钟
  /// 理由：短剧流需要保持新鲜，但也要支持快速恢复
  shortsFlow(Duration(minutes: 5)),

  /// 短剧流状态（当前位置、播放进度等）
  /// 过期时间：30分钟
  /// 理由：用户可能短暂离开后返回
  shortsFlowState(Duration(minutes: 30)),

  /// 视频详情
  /// 过期时间：30分钟
  /// 理由：详情数据相对稳定
  videoDetail(Duration(minutes: 30)),

  /// 搜索结果
  /// 过期时间：5分钟
  /// 理由：搜索结果需要保持新鲜
  searchResult(Duration(minutes: 5)),

  /// 用户数据（收藏、历史等）
  /// 过期时间：2分钟
  /// 理由：用户数据需要及时同步
  userData(Duration(minutes: 2)),

  /// 配置数据（全局配置、广告配置等）
  /// 过期时间：1小时
  /// 理由：配置数据变化不频繁
  config(Duration(hours: 1)),

  /// 通用缓存
  /// 过期时间：5分钟
  general(Duration(minutes: 5));

  final Duration ttl;
  const CacheType(this.ttl);
}

// ==================== 内部数据结构 ====================

/// 缓存统计信息
class CacheStats {
  final int memoryCacheCount;
  final int localCacheCount;
  final int maxMemoryCacheEntries;

  CacheStats({
    required this.memoryCacheCount,
    required this.localCacheCount,
    required this.maxMemoryCacheEntries,
  });

  @override
  String toString() {
    return 'CacheStats(memory: $memoryCacheCount/$maxMemoryCacheEntries, local: $localCacheCount)';
  }
}

// ==================== 缓存键常量 ====================

/// 缓存键常量
///
/// 统一管理所有缓存键，避免硬编码
class CacheKeys {
  CacheKeys._();

  /// 首页频道列表
  static const String homeTabs = 'home_tabs';

  /// 首页布局数据（按频道）
  static String homeLayout(String channelId) => 'home_layout_$channelId';

  /// 短剧流列表
  static const String shortsFlowList = 'shorts_flow_list';

  /// 短剧流状态
  static const String shortsFlowState = 'shorts_flow_state';

  /// 视频详情
  static String videoDetail(String vodId) => 'video_detail_$vodId';

  /// 短剧详情
  static String shortsDetail(String shortId) => 'shorts_detail_$shortId';

  /// 搜索结果
  static String searchResult(String keyword) => 'search_$keyword';

  /// 全局配置
  static const String globalConfig = 'global_config';

  /// 广告配置
  static const String adConfig = 'ad_config';

  /// 继续观看列表
  static const String continueWatching = 'continue_watching';
}
