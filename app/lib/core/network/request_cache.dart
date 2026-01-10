import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../logger.dart';

/// 请求缓存服务
/// 
/// 提供 HTTP 请求结果的本地缓存，支持：
/// - 内存缓存（快速访问）
/// - 持久化缓存（离线支持）
/// - 缓存过期管理
/// - 缓存大小限制
class RequestCache {
  static final RequestCache _instance = RequestCache._internal();
  factory RequestCache() => _instance;
  RequestCache._internal();
  
  // ==================== 配置 ====================
  
  /// 内存缓存最大条目数
  static const int _maxMemoryCacheSize = 100;
  
  /// 持久化缓存最大条目数
  static const int _maxDiskCacheSize = 500;
  
  /// 默认缓存过期时间（秒）
  static const int _defaultTtl = 300; // 5分钟
  
  /// 缓存键前缀
  static const String _cachePrefix = 'http_cache_';
  
  // ==================== 内存缓存 ====================
  
  final Map<String, _CacheEntry> _memoryCache = {};
  final List<String> _memoryCacheKeys = []; // LRU 顺序
  
  // ==================== 公共方法 ====================
  
  /// 获取缓存
  /// 
  /// [key] 缓存键（通常是请求 URL + 参数的哈希）
  /// [allowStale] 是否允许返回过期缓存（离线模式）
  Future<dynamic> get(String key, {bool allowStale = false}) async {
    // 1. 先检查内存缓存
    final memoryEntry = _memoryCache[key];
    if (memoryEntry != null) {
      if (!memoryEntry.isExpired) {
        _updateLru(key);
        Logger.debug('[RequestCache] Memory hit: $key');
        return memoryEntry.data;
      } else if (allowStale) {
        Logger.debug('[RequestCache] Memory stale hit: $key');
        return memoryEntry.data;
      }
    }
    
    // 2. 检查持久化缓存
    try {
      final prefs = await SharedPreferences.getInstance();
      final cacheJson = prefs.getString('$_cachePrefix$key');
      
      if (cacheJson != null) {
        final entry = _CacheEntry.fromJson(jsonDecode(cacheJson));
        
        if (!entry.isExpired) {
          // 写入内存缓存
          _setMemoryCache(key, entry);
          Logger.debug('[RequestCache] Disk hit: $key');
          return entry.data;
        } else if (allowStale) {
          Logger.debug('[RequestCache] Disk stale hit: $key');
          return entry.data;
        }
      }
    } catch (e) {
      Logger.error('[RequestCache] Disk read error: $e');
    }
    
    return null;
  }
  
  /// 设置缓存
  /// 
  /// [key] 缓存键
  /// [data] 缓存数据
  /// [ttl] 过期时间（秒），默认 5 分钟
  /// [persist] 是否持久化到磁盘
  Future<void> set(
    String key,
    dynamic data, {
    int ttl = _defaultTtl,
    bool persist = true,
  }) async {
    final entry = _CacheEntry(
      data: data,
      createdAt: DateTime.now(),
      ttl: ttl,
    );
    
    // 写入内存缓存
    _setMemoryCache(key, entry);
    
    // 持久化到磁盘
    if (persist) {
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('$_cachePrefix$key', jsonEncode(entry.toJson()));
        Logger.debug('[RequestCache] Cached: $key (ttl: ${ttl}s)');
      } catch (e) {
        Logger.error('[RequestCache] Disk write error: $e');
      }
    }
  }
  
  /// 删除缓存
  Future<void> remove(String key) async {
    _memoryCache.remove(key);
    _memoryCacheKeys.remove(key);
    
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('$_cachePrefix$key');
    } catch (e) {
      Logger.error('[RequestCache] Remove error: $e');
    }
  }
  
  /// 清除所有缓存
  Future<void> clear() async {
    _memoryCache.clear();
    _memoryCacheKeys.clear();
    
    try {
      final prefs = await SharedPreferences.getInstance();
      final keys = prefs.getKeys().where((k) => k.startsWith(_cachePrefix));
      for (final key in keys) {
        await prefs.remove(key);
      }
      Logger.info('[RequestCache] Cache cleared');
    } catch (e) {
      Logger.error('[RequestCache] Clear error: $e');
    }
  }
  
  /// 清除过期缓存
  Future<void> clearExpired() async {
    // 清除内存中的过期缓存
    final expiredKeys = _memoryCache.entries
        .where((e) => e.value.isExpired)
        .map((e) => e.key)
        .toList();
    
    for (final key in expiredKeys) {
      _memoryCache.remove(key);
      _memoryCacheKeys.remove(key);
    }
    
    // 清除磁盘中的过期缓存
    try {
      final prefs = await SharedPreferences.getInstance();
      final keys = prefs.getKeys().where((k) => k.startsWith(_cachePrefix)).toList();
      
      for (final key in keys) {
        final cacheJson = prefs.getString(key);
        if (cacheJson != null) {
          try {
            final entry = _CacheEntry.fromJson(jsonDecode(cacheJson));
            if (entry.isExpired) {
              await prefs.remove(key);
            }
          } catch (_) {
            // 解析失败，删除无效缓存
            await prefs.remove(key);
          }
        }
      }
      
      Logger.info('[RequestCache] Expired cache cleared');
    } catch (e) {
      Logger.error('[RequestCache] Clear expired error: $e');
    }
  }
  
  /// 生成缓存键
  /// 
  /// 根据请求 URL 和参数生成唯一的缓存键
  static String generateKey(String url, [Map<String, dynamic>? params]) {
    final buffer = StringBuffer(url);
    
    if (params != null && params.isNotEmpty) {
      final sortedKeys = params.keys.toList()..sort();
      for (final key in sortedKeys) {
        buffer.write('_${key}_${params[key]}');
      }
    }
    
    // 简单哈希
    return buffer.toString().hashCode.toRadixString(16);
  }
  
  /// 获取缓存统计信息
  Map<String, dynamic> getStats() {
    return {
      'memorySize': _memoryCache.length,
      'memoryMaxSize': _maxMemoryCacheSize,
      'memoryCacheKeys': _memoryCacheKeys.length,
    };
  }
  
  // ==================== 私有方法 ====================
  
  void _setMemoryCache(String key, _CacheEntry entry) {
    // 如果已存在，先移除旧的
    if (_memoryCache.containsKey(key)) {
      _memoryCacheKeys.remove(key);
    }
    
    // 检查容量，移除最旧的
    while (_memoryCache.length >= _maxMemoryCacheSize) {
      final oldestKey = _memoryCacheKeys.removeAt(0);
      _memoryCache.remove(oldestKey);
    }
    
    _memoryCache[key] = entry;
    _memoryCacheKeys.add(key);
  }
  
  void _updateLru(String key) {
    _memoryCacheKeys.remove(key);
    _memoryCacheKeys.add(key);
  }
}

/// 缓存条目
class _CacheEntry {
  final dynamic data;
  final DateTime createdAt;
  final int ttl; // 秒
  
  _CacheEntry({
    required this.data,
    required this.createdAt,
    required this.ttl,
  });
  
  bool get isExpired {
    return DateTime.now().difference(createdAt).inSeconds > ttl;
  }
  
  Map<String, dynamic> toJson() {
    return {
      'data': data,
      'createdAt': createdAt.toIso8601String(),
      'ttl': ttl,
    };
  }
  
  factory _CacheEntry.fromJson(Map<String, dynamic> json) {
    return _CacheEntry(
      data: json['data'],
      createdAt: DateTime.parse(json['createdAt']),
      ttl: json['ttl'] as int,
    );
  }
}

/// 缓存策略
enum CacheStrategy {
  /// 优先使用缓存，缓存不存在或过期时请求网络
  cacheFirst,
  
  /// 优先请求网络，失败时使用缓存
  networkFirst,
  
  /// 只使用缓存
  cacheOnly,
  
  /// 只使用网络（不缓存）
  networkOnly,
  
  /// 同时返回缓存和网络结果（先返回缓存，再更新）
  staleWhileRevalidate,
}

/// 缓存配置
class CacheConfig {
  /// 缓存策略
  final CacheStrategy strategy;
  
  /// 过期时间（秒）
  final int ttl;
  
  /// 是否持久化
  final bool persist;
  
  const CacheConfig({
    this.strategy = CacheStrategy.cacheFirst,
    this.ttl = 300,
    this.persist = true,
  });
  
  /// 首页数据缓存配置（较长时间）
  static const CacheConfig homeData = CacheConfig(
    strategy: CacheStrategy.staleWhileRevalidate,
    ttl: 600, // 10分钟
    persist: true,
  );
  
  /// 视频详情缓存配置
  static const CacheConfig videoDetail = CacheConfig(
    strategy: CacheStrategy.cacheFirst,
    ttl: 300, // 5分钟
    persist: true,
  );
  
  /// 搜索结果缓存配置（较短时间）
  static const CacheConfig searchResult = CacheConfig(
    strategy: CacheStrategy.networkFirst,
    ttl: 60, // 1分钟
    persist: false,
  );
  
  /// 配置数据缓存（较长时间）
  static const CacheConfig configData = CacheConfig(
    strategy: CacheStrategy.cacheFirst,
    ttl: 1800, // 30分钟
    persist: true,
  );
}
