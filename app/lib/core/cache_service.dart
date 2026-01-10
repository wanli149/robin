import 'dart:convert';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'logger.dart';

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
/// await CacheService.to.set('home_featured', data, 
///   type: CacheType.homeLayout,
/// );
/// 
/// // 检查缓存是否有效
/// final isValid = await CacheService.to.isValid('home_featured');
/// ```
class CacheService extends GetxService {
  static CacheService get to => Get.find<CacheService>();
  
  late SharedPreferences _prefs;
  
  // L1: 内存缓存
  final Map<String, _CacheEntry> _memoryCache = {};
  
  // 内存缓存最大条目数
  static const int _maxMemoryCacheEntries = 100;
  
  // 缓存键前缀
  static const String _cachePrefix = 'cache_';
  static const String _metaPrefix = 'cache_meta_';
  
  // 🚀 初始化状态标志
  bool _isInitialized = false;
  
  /// 检查是否已初始化
  bool get isInitialized => _isInitialized;
  
  /// 🚀 确保已初始化（内部使用）
  void _ensureInitialized() {
    if (!_isInitialized) {
      throw StateError('CacheService not initialized. Call init() first.');
    }
  }
  
  /// 初始化缓存服务
  Future<CacheService> init() async {
    if (_isInitialized) {
      Logger.warning('[CacheService] Already initialized, skipping');
      return this;
    }
    
    _prefs = await SharedPreferences.getInstance();
    
    // 启动时清理过期缓存
    await _cleanExpiredCache();
    
    // 预加载关键缓存到内存
    await _preloadCriticalCache();
    
    // 🚀 标记初始化完成
    _isInitialized = true;
    
    Logger.success('[CacheService] Initialized');
    return this;
  }
  
  // ==================== 公开 API ====================
  
  /// 获取缓存数据
  /// 
  /// 按优先级查找：内存缓存 → 本地缓存 → 返回 null
  /// 
  /// [key] 缓存键
  /// [ignoreExpiry] 是否忽略过期时间（离线模式使用）
  Future<T?> get<T>(String key, {bool ignoreExpiry = false}) async {
    // 🚀 检查初始化状态
    _ensureInitialized();
    
    // L1: 检查内存缓存
    final memoryEntry = _memoryCache[key];
    if (memoryEntry != null) {
      if (ignoreExpiry || !memoryEntry.isExpired) {
        Logger.debug('[CacheService] L1 HIT: $key');
        return memoryEntry.data as T?;
      } else {
        // 内存缓存过期，移除
        _memoryCache.remove(key);
      }
    }
    
    // L2: 检查本地持久化缓存
    final localData = await _getFromLocal<T>(key, ignoreExpiry: ignoreExpiry);
    if (localData != null) {
      Logger.debug('[CacheService] L2 HIT: $key');
      // 回填到内存缓存
      final meta = await _getMetadata(key);
      if (meta != null) {
        _setMemoryCache(key, localData, meta.expiryTime);
      }
      return localData;
    }
    
    Logger.debug('[CacheService] MISS: $key');
    return null;
  }
  
  /// 设置缓存数据
  /// 
  /// 同时更新内存缓存和本地持久化缓存
  /// 
  /// [key] 缓存键
  /// [data] 缓存数据
  /// [type] 缓存类型（决定过期时间）
  /// [customTtl] 自定义过期时间（覆盖类型默认值）
  Future<void> set<T>(
    String key, 
    T data, {
    CacheType type = CacheType.general,
    Duration? customTtl,
  }) async {
    // 🚀 检查初始化状态
    _ensureInitialized();
    
    final ttl = customTtl ?? type.ttl;
    final expiryTime = DateTime.now().add(ttl);
    
    // L1: 更新内存缓存
    _setMemoryCache(key, data, expiryTime);
    
    // L2: 更新本地持久化缓存
    await _setToLocal(key, data, expiryTime, type);
    
    Logger.debug('[CacheService] SET: $key (expires: $expiryTime)');
  }
  
  /// 删除缓存
  Future<void> remove(String key) async {
    _memoryCache.remove(key);
    await _prefs.remove('$_cachePrefix$key');
    await _prefs.remove('$_metaPrefix$key');
    Logger.debug('[CacheService] REMOVE: $key');
  }
  
  /// 清除指定类型的所有缓存
  Future<void> clearByType(CacheType type) async {
    final keysToRemove = <String>[];
    
    // 查找所有该类型的缓存
    for (final key in _prefs.getKeys()) {
      if (key.startsWith(_metaPrefix)) {
        final metaJson = _prefs.getString(key);
        if (metaJson != null) {
          try {
            final meta = _CacheMetadata.fromJson(jsonDecode(metaJson));
            if (meta.type == type) {
              final cacheKey = key.substring(_metaPrefix.length);
              keysToRemove.add(cacheKey);
            }
          } catch (_) {}
        }
      }
    }
    
    // 删除缓存
    for (final key in keysToRemove) {
      await remove(key);
    }
    
    Logger.info('[CacheService] Cleared ${keysToRemove.length} entries of type: ${type.name}');
  }
  
  /// 清除所有缓存
  Future<void> clearAll() async {
    _memoryCache.clear();
    
    final keysToRemove = _prefs.getKeys()
        .where((k) => k.startsWith(_cachePrefix) || k.startsWith(_metaPrefix))
        .toList();
    
    for (final key in keysToRemove) {
      await _prefs.remove(key);
    }
    
    Logger.info('[CacheService] Cleared all cache (${keysToRemove.length} entries)');
  }
  
  /// 检查缓存是否有效（未过期）
  Future<bool> isValid(String key) async {
    // 检查内存缓存
    final memoryEntry = _memoryCache[key];
    if (memoryEntry != null && !memoryEntry.isExpired) {
      return true;
    }
    
    // 检查本地缓存
    final meta = await _getMetadata(key);
    return meta != null && !meta.isExpired;
  }
  
  /// 获取缓存的过期时间
  Future<DateTime?> getExpiryTime(String key) async {
    final memoryEntry = _memoryCache[key];
    if (memoryEntry != null) {
      return memoryEntry.expiryTime;
    }
    
    final meta = await _getMetadata(key);
    return meta?.expiryTime;
  }
  
  /// 获取缓存统计信息
  CacheStats getStats() {
    int memoryCount = _memoryCache.length;
    int localCount = _prefs.getKeys()
        .where((k) => k.startsWith(_cachePrefix))
        .length;
    
    return CacheStats(
      memoryCacheCount: memoryCount,
      localCacheCount: localCount,
      maxMemoryCacheEntries: _maxMemoryCacheEntries,
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
        await set(key, data, type: type);
      }
      return data;
    } catch (e) {
      Logger.error('[CacheService] Load failed for $key: $e');
      // 加载失败时，尝试返回过期的缓存（离线模式）
      return await get<T>(key, ignoreExpiry: true);
    }
  }
  
  // ==================== 私有方法 ====================
  
  /// 设置内存缓存
  void _setMemoryCache<T>(String key, T data, DateTime expiryTime) {
    // 检查内存缓存大小，必要时清理
    if (_memoryCache.length >= _maxMemoryCacheEntries) {
      _evictMemoryCache();
    }
    
    _memoryCache[key] = _CacheEntry(
      data: data,
      expiryTime: expiryTime,
      accessTime: DateTime.now(),
    );
  }
  
  /// 清理内存缓存（LRU 策略）
  void _evictMemoryCache() {
    if (_memoryCache.isEmpty) return;
    
    // 按访问时间排序，移除最久未访问的 20%
    final entries = _memoryCache.entries.toList()
      ..sort((a, b) => a.value.accessTime.compareTo(b.value.accessTime));
    
    final removeCount = (_memoryCache.length * 0.2).ceil();
    for (var i = 0; i < removeCount && i < entries.length; i++) {
      _memoryCache.remove(entries[i].key);
    }
    
    Logger.debug('[CacheService] Evicted $removeCount memory cache entries');
  }
  
  /// 从本地存储获取缓存
  Future<T?> _getFromLocal<T>(String key, {bool ignoreExpiry = false}) async {
    final dataJson = _prefs.getString('$_cachePrefix$key');
    if (dataJson == null) return null;
    
    // 检查过期时间
    if (!ignoreExpiry) {
      final meta = await _getMetadata(key);
      if (meta == null || meta.isExpired) {
        return null;
      }
    }
    
    try {
      final decoded = jsonDecode(dataJson);
      return decoded as T?;
    } catch (e) {
      Logger.error('[CacheService] Failed to decode cache for $key: $e');
      return null;
    }
  }
  
  /// 保存到本地存储
  Future<void> _setToLocal<T>(
    String key, 
    T data, 
    DateTime expiryTime,
    CacheType type,
  ) async {
    try {
      final dataJson = jsonEncode(data);
      await _prefs.setString('$_cachePrefix$key', dataJson);
      
      // 保存元数据
      final meta = _CacheMetadata(
        expiryTime: expiryTime,
        type: type,
        createdAt: DateTime.now(),
      );
      await _prefs.setString('$_metaPrefix$key', jsonEncode(meta.toJson()));
    } catch (e) {
      Logger.error('[CacheService] Failed to save cache for $key: $e');
    }
  }
  
  /// 获取缓存元数据
  Future<_CacheMetadata?> _getMetadata(String key) async {
    final metaJson = _prefs.getString('$_metaPrefix$key');
    if (metaJson == null) return null;
    
    try {
      return _CacheMetadata.fromJson(jsonDecode(metaJson));
    } catch (e) {
      return null;
    }
  }
  
  /// 清理过期缓存
  Future<void> _cleanExpiredCache() async {
    final keysToRemove = <String>[];
    
    for (final key in _prefs.getKeys()) {
      if (key.startsWith(_metaPrefix)) {
        final metaJson = _prefs.getString(key);
        if (metaJson != null) {
          try {
            final meta = _CacheMetadata.fromJson(jsonDecode(metaJson));
            if (meta.isExpired) {
              final cacheKey = key.substring(_metaPrefix.length);
              keysToRemove.add(cacheKey);
            }
          } catch (_) {
            // 元数据损坏，也删除
            final cacheKey = key.substring(_metaPrefix.length);
            keysToRemove.add(cacheKey);
          }
        }
      }
    }
    
    for (final key in keysToRemove) {
      await remove(key);
    }
    
    if (keysToRemove.isNotEmpty) {
      Logger.info('[CacheService] Cleaned ${keysToRemove.length} expired entries');
    }
  }
  
  /// 预加载关键缓存到内存
  Future<void> _preloadCriticalCache() async {
    final criticalKeys = [
      'home_tabs',
      'home_featured',
      'shorts_flow_state',
    ];
    
    for (final key in criticalKeys) {
      final data = await _getFromLocal(key, ignoreExpiry: true);
      if (data != null) {
        final meta = await _getMetadata(key);
        if (meta != null) {
          _setMemoryCache(key, data, meta.expiryTime);
        }
      }
    }
    
    Logger.debug('[CacheService] Preloaded ${_memoryCache.length} critical cache entries');
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
          await set(key, data, type: type);
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

/// 内存缓存条目
class _CacheEntry {
  final dynamic data;
  final DateTime expiryTime;
  DateTime accessTime;
  
  _CacheEntry({
    required this.data,
    required this.expiryTime,
    required this.accessTime,
  });
  
  bool get isExpired => DateTime.now().isAfter(expiryTime);
  
  /// 更新访问时间
  void touch() {
    accessTime = DateTime.now();
  }
}

/// 缓存元数据（持久化存储）
class _CacheMetadata {
  final DateTime expiryTime;
  final CacheType type;
  final DateTime createdAt;
  
  _CacheMetadata({
    required this.expiryTime,
    required this.type,
    required this.createdAt,
  });
  
  bool get isExpired => DateTime.now().isAfter(expiryTime);
  
  Map<String, dynamic> toJson() => {
    'expiryTime': expiryTime.toIso8601String(),
    'type': type.name,
    'createdAt': createdAt.toIso8601String(),
  };
  
  factory _CacheMetadata.fromJson(Map<String, dynamic> json) {
    return _CacheMetadata(
      expiryTime: DateTime.parse(json['expiryTime'] as String),
      type: CacheType.values.firstWhere(
        (t) => t.name == json['type'],
        orElse: () => CacheType.general,
      ),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

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
