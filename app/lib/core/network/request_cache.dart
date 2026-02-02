import 'base_cache_service.dart';

/// 请求缓存服务
///
/// 提供 HTTP 请求结果的本地缓存，支持：
/// - 内存缓存（快速访问）
/// - 持久化缓存（离线支持）
/// - 缓存过期管理
/// - 缓存大小限制
/// - 多种缓存策略
class RequestCache extends BaseCacheService {
  static final RequestCache _instance = RequestCache._internal();
  factory RequestCache() => _instance;
  RequestCache._internal();

  // ==================== 配置 ====================

  @override
  int get maxMemoryCacheSize => 100;

  @override
  String get cachePrefix => 'http_cache_';

  // ==================== 公共方法 ====================

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
