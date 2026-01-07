import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';

/// 性能优化配置
/// 配置缓存大小、图片懒加载等性能优化策略
class PerformanceConfig {
  // 私有构造函数，防止实例化
  PerformanceConfig._();

  // ==================== 缓存配置 ====================

  /// 图片缓存大小（字节）- 200MB
  static const int imageCacheSize = 200 * 1024 * 1024;

  /// 图片缓存有效期（天）
  static const int imageCacheDuration = 30;

  /// 最大缓存对象数量
  static const int maxCacheObjects = 1000;

  /// 自定义缓存管理器
  static final CacheManager customCacheManager = CacheManager(
    Config(
      'robin_cache',
      stalePeriod: const Duration(days: imageCacheDuration),
      maxNrOfCacheObjects: maxCacheObjects,
      repo: JsonCacheInfoRepository(databaseName: 'robin_cache'),
      fileService: HttpFileService(),
    ),
  );

  // ==================== 列表优化配置 ====================

  /// ListView 缓存范围（屏幕数量）
  static const double listViewCacheExtent = 500.0;

  /// 是否添加自动保持活动状态
  static const bool addAutomaticKeepAlives = true;

  /// 是否添加重绘边界
  static const bool addRepaintBoundaries = true;

  /// 是否添加语义索引
  static const bool addSemanticIndexes = true;

  // ==================== 图片加载配置 ====================

  /// 图片淡入动画时长
  static const Duration imageFadeInDuration = Duration(milliseconds: 300);

  /// 图片占位符淡出动画时长
  static const Duration imageFadeOutDuration = Duration(milliseconds: 300);

  /// 图片最大宽度（用于缩放）
  static const int imageMaxWidth = 1080;

  /// 图片最大高度（用于缩放）
  static const int imageMaxHeight = 1920;

  /// 图片内存缓存大小（MB）
  static const int imageMemoryCacheSize = 100;

  // ==================== 性能监控 ====================

  /// 是否启用性能监控
  static bool get enablePerformanceMonitoring => kDebugMode;

  /// 是否启用帧率监控
  static bool get enableFrameRateMonitoring => kDebugMode;

  // ==================== 初始化方法 ====================

  /// 初始化性能配置
  static Future<void> initialize() async {
    // 配置图片缓存
    await _configureImageCache();

    // 清理过期缓存
    await _cleanExpiredCache();

    print('⚡ Performance config initialized');
    print('📦 Image cache size: ${imageCacheSize ~/ (1024 * 1024)}MB');
    print('🖼️ Max cache objects: $maxCacheObjects');
  }

  /// 配置图片缓存
  static Future<void> _configureImageCache() async {
    // Flutter 的图片缓存配置
    PaintingBinding.instance.imageCache.maximumSizeBytes = imageCacheSize;
    PaintingBinding.instance.imageCache.maximumSize = maxCacheObjects;
  }

  /// 清理过期缓存
  static Future<void> _cleanExpiredCache() async {
    try {
      await customCacheManager.emptyCache();
      print('🧹 Expired cache cleaned');
    } catch (e) {
      print('❌ Failed to clean cache: $e');
    }
  }

  /// 获取缓存大小
  static Future<int> getCacheSize() async {
    try {
      // 获取图片缓存大小
      final imageCache = PaintingBinding.instance.imageCache;
      final imageCacheSize = imageCache.currentSizeBytes;

      return imageCacheSize;
    } catch (e) {
      print('❌ Failed to get cache size: $e');
      return 0;
    }
  }

  /// 清除所有缓存
  static Future<void> clearAllCache() async {
    try {
      // 清除图片缓存
      PaintingBinding.instance.imageCache.clear();
      PaintingBinding.instance.imageCache.clearLiveImages();

      // 清除自定义缓存
      await customCacheManager.emptyCache();

      // 清除 CachedNetworkImage 缓存
      await CachedNetworkImage.evictFromCache('');

      print('🧹 All cache cleared');
    } catch (e) {
      print('❌ Failed to clear cache: $e');
    }
  }

  // ==================== 性能优化建议 ====================

  /// 获取性能优化建议
  static List<String> getOptimizationTips() {
    return [
      '✅ 使用 ListView.builder 实现虚拟滚动',
      '✅ 使用 const 构造函数减少重建',
      '✅ 使用 GetX 响应式状态管理避免不必要的重建',
      '✅ 使用 CachedNetworkImage 缓存图片',
      '✅ 使用 Hero 动画优化页面过渡',
      '✅ 使用 RepaintBoundary 隔离重绘区域',
      '✅ 使用 AutomaticKeepAliveClientMixin 保持页面状态',
      '✅ 延迟加载非关键资源',
      '✅ 使用 Isolate 处理耗时操作',
      '✅ 优化图片大小和格式',
    ];
  }
}

/// 性能监控工具
class PerformanceMonitor {
  // 私有构造函数
  PerformanceMonitor._();

  /// 记录页面加载时间
  static final Map<String, DateTime> _pageLoadTimes = {};

  /// 开始记录页面加载
  static void startPageLoad(String pageName) {
    if (PerformanceConfig.enablePerformanceMonitoring) {
      _pageLoadTimes[pageName] = DateTime.now();
      print('⏱️ Page load started: $pageName');
    }
  }

  /// 结束记录页面加载
  static void endPageLoad(String pageName) {
    if (PerformanceConfig.enablePerformanceMonitoring) {
      final startTime = _pageLoadTimes[pageName];
      if (startTime != null) {
        final duration = DateTime.now().difference(startTime);
        print('⏱️ Page load completed: $pageName (${duration.inMilliseconds}ms)');
        _pageLoadTimes.remove(pageName);
      }
    }
  }

  /// 记录操作耗时
  static Future<T> measureOperation<T>({
    required String operationName,
    required Future<T> Function() operation,
  }) async {
    if (PerformanceConfig.enablePerformanceMonitoring) {
      final startTime = DateTime.now();
      print('⏱️ Operation started: $operationName');

      try {
        final result = await operation();
        final duration = DateTime.now().difference(startTime);
        print(
            '⏱️ Operation completed: $operationName (${duration.inMilliseconds}ms)');
        return result;
      } catch (e) {
        final duration = DateTime.now().difference(startTime);
        print(
            '❌ Operation failed: $operationName (${duration.inMilliseconds}ms) - $e');
        rethrow;
      }
    } else {
      return await operation();
    }
  }

  /// 记录内存使用情况
  static void logMemoryUsage() {
    if (PerformanceConfig.enablePerformanceMonitoring) {
      // 获取图片缓存信息
      final imageCache = PaintingBinding.instance.imageCache;
      final currentSize = imageCache.currentSizeBytes;
      final maxSize = imageCache.maximumSizeBytes;
      final currentCount = imageCache.currentSize;
      final maxCount = imageCache.maximumSize;

      print('📊 Memory Usage:');
      print(
          '   Image Cache: ${currentSize ~/ (1024 * 1024)}MB / ${maxSize ~/ (1024 * 1024)}MB');
      print('   Image Count: $currentCount / $maxCount');
    }
  }
}

/// 列表性能优化 Mixin
mixin ListPerformanceOptimization {
  /// 获取优化的 ListView 配置
  double get cacheExtent => PerformanceConfig.listViewCacheExtent;
  bool get addAutomaticKeepAlives =>
      PerformanceConfig.addAutomaticKeepAlives;
  bool get addRepaintBoundaries => PerformanceConfig.addRepaintBoundaries;
  bool get addSemanticIndexes => PerformanceConfig.addSemanticIndexes;
}
