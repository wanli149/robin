import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../logger.dart';

/// 基础缓存服务
///
/// 提供通用的缓存功能：
/// - 内存缓存（L1）+ 持久化缓存（L2）
/// - LRU 淘汰策略
/// - 过期时间管理
/// - 自动清理
abstract mixin class BaseCacheService {
  // ==================== 配置 ====================

  /// 内存缓存最大条目数（子类可覆盖）
  int get maxMemoryCacheSize => 100;

  /// 缓存键前缀（子类必须实现）
  String get cachePrefix;

  // ==================== 内存缓存 ====================

  final Map<String, CacheEntry> _memoryCache = {};
  final List<String> _memoryCacheKeys = []; // LRU 顺序

  // ==================== 核心方法 ====================

  /// 从缓存获取数据
  ///
  /// [key] 缓存键
  /// [allowStale] 是否允许返回过期缓存
  Future<T?> get<T>(String key, {bool allowStale = false}) async {
    // L1: 检查内存缓存
    final memoryEntry = _memoryCache[key];
    if (memoryEntry != null) {
      if (!memoryEntry.isExpired || allowStale) {
        _updateLru(key);
        Logger.debug('[${runtimeType}] L1 HIT: $key');
        return memoryEntry.data as T?;
      } else {
        // 过期，移除
        _memoryCache.remove(key);
        _memoryCacheKeys.remove(key);
      }
    }

    // L2: 检查持久化缓存
    final localData = await _getFromLocal<T>(key, allowStale: allowStale);
    if (localData != null) {
      Logger.debug('[${runtimeType}] L2 HIT: $key');
      // 回填到内存缓存
      final meta = await _getMetadata(key);
      if (meta != null) {
        _setMemoryCache(key, localData, meta.expiryTime);
      }
      return localData;
    }

    Logger.debug('[${runtimeType}] MISS: $key');
    return null;
  }

  /// 设置缓存数据
  ///
  /// [key] 缓存键
  /// [data] 缓存数据
  /// [ttl] 过期时间（秒）
  /// [persist] 是否持久化
  Future<void> set<T>(
    String key,
    T data, {
    required int ttl,
    bool persist = true,
  }) async {
    final expiryTime = DateTime.now().add(Duration(seconds: ttl));

    // L1: 更新内存缓存
    _setMemoryCache(key, data, expiryTime);

    // L2: 更新持久化缓存
    if (persist) {
      await _setToLocal(key, data, expiryTime, ttl);
    }

    Logger.debug('[${runtimeType}] SET: $key (ttl: ${ttl}s)');
  }

  /// 删除缓存
  Future<void> remove(String key) async {
    _memoryCache.remove(key);
    _memoryCacheKeys.remove(key);

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('$cachePrefix$key');
    await prefs.remove('${cachePrefix}meta_$key');

    Logger.debug('[${runtimeType}] REMOVE: $key');
  }

  /// 清除所有缓存
  Future<void> clear() async {
    _memoryCache.clear();
    _memoryCacheKeys.clear();

    final prefs = await SharedPreferences.getInstance();
    final keysToRemove = prefs
        .getKeys()
        .where((k) => k.startsWith(cachePrefix))
        .toList();

    for (final key in keysToRemove) {
      await prefs.remove(key);
    }

    Logger.info(
      '[${runtimeType}] Cleared all cache (${keysToRemove.length} entries)',
    );
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

    // 清除持久化中的过期缓存
    final prefs = await SharedPreferences.getInstance();
    final metaKeys = prefs
        .getKeys()
        .where((k) => k.startsWith('${cachePrefix}meta_'))
        .toList();

    final keysToRemove = <String>[];
    for (final metaKey in metaKeys) {
      final metaJson = prefs.getString(metaKey);
      if (metaJson != null) {
        try {
          final meta = CacheMetadata.fromJson(jsonDecode(metaJson));
          if (meta.isExpired) {
            final cacheKey = metaKey.substring('${cachePrefix}meta_'.length);
            keysToRemove.add(cacheKey);
          }
        } catch (_) {
          // 元数据损坏，也删除
          final cacheKey = metaKey.substring('${cachePrefix}meta_'.length);
          keysToRemove.add(cacheKey);
        }
      }
    }

    for (final key in keysToRemove) {
      await remove(key);
    }

    if (keysToRemove.isNotEmpty) {
      Logger.info(
        '[${runtimeType}] Cleared ${keysToRemove.length} expired entries',
      );
    }
  }

  /// 获取缓存统计信息
  Map<String, int> getStats() {
    return {
      'memorySize': _memoryCache.length,
      'memoryMaxSize': maxMemoryCacheSize,
    };
  }

  // ==================== 私有方法 ====================

  /// 设置内存缓存
  void _setMemoryCache<T>(String key, T data, DateTime expiryTime) {
    // 如果已存在，先移除旧的
    if (_memoryCache.containsKey(key)) {
      _memoryCacheKeys.remove(key);
    }

    // 检查容量，移除最旧的（LRU）
    while (_memoryCache.length >= maxMemoryCacheSize) {
      final oldestKey = _memoryCacheKeys.removeAt(0);
      _memoryCache.remove(oldestKey);
    }

    _memoryCache[key] = CacheEntry(
      data: data,
      expiryTime: expiryTime,
      accessTime: DateTime.now(),
    );
    _memoryCacheKeys.add(key);
  }

  /// 更新 LRU 顺序
  void _updateLru(String key) {
    _memoryCacheKeys.remove(key);
    _memoryCacheKeys.add(key);
    _memoryCache[key]?.touch();
  }

  /// 从本地存储获取缓存
  Future<T?> _getFromLocal<T>(String key, {bool allowStale = false}) async {
    final prefs = await SharedPreferences.getInstance();
    final dataJson = prefs.getString('$cachePrefix$key');
    if (dataJson == null) return null;

    // 检查过期时间
    if (!allowStale) {
      final meta = await _getMetadata(key);
      if (meta == null || meta.isExpired) {
        return null;
      }
    }

    try {
      final decoded = jsonDecode(dataJson);
      return decoded as T?;
    } catch (e) {
      Logger.error('[${runtimeType}] Failed to decode cache for $key: $e');
      return null;
    }
  }

  /// 保存到本地存储
  Future<void> _setToLocal<T>(
    String key,
    T data,
    DateTime expiryTime,
    int ttl,
  ) async {
    try {
      final prefs = await SharedPreferences.getInstance();

      final dataJson = jsonEncode(data);
      await prefs.setString('$cachePrefix$key', dataJson);

      // 保存元数据
      final meta = CacheMetadata(
        expiryTime: expiryTime,
        ttl: ttl,
        createdAt: DateTime.now(),
      );
      await prefs.setString(
        '${cachePrefix}meta_$key',
        jsonEncode(meta.toJson()),
      );
    } catch (e) {
      Logger.error('[${runtimeType}] Failed to save cache for $key: $e');
    }
  }

  /// 获取缓存元数据
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
}

// ==================== 数据结构 ====================

/// 缓存条目
class CacheEntry {
  final dynamic data;
  final DateTime expiryTime;
  DateTime accessTime;

  CacheEntry({
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

/// 缓存元数据
class CacheMetadata {
  final DateTime expiryTime;
  final int ttl;
  final DateTime createdAt;

  CacheMetadata({
    required this.expiryTime,
    required this.ttl,
    required this.createdAt,
  });

  bool get isExpired => DateTime.now().isAfter(expiryTime);

  Map<String, dynamic> toJson() => {
    'expiryTime': expiryTime.toIso8601String(),
    'ttl': ttl,
    'createdAt': createdAt.toIso8601String(),
  };

  factory CacheMetadata.fromJson(Map<String, dynamic> json) {
    return CacheMetadata(
      expiryTime: DateTime.parse(json['expiryTime'] as String),
      ttl: json['ttl'] as int,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}
