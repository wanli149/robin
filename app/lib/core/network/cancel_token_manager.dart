import 'package:dio/dio.dart';
import '../logger.dart';

/// 请求取消令牌管理器
/// 
/// 管理页面级别的请求取消，当页面销毁时自动取消所有进行中的请求。
/// 
/// ## 使用示例
/// ```dart
/// class MyController extends GetxController {
///   final _cancelManager = CancelTokenManager();
///   
///   Future<void> loadData() async {
///     final response = await httpClient.get(
///       '/api/data',
///       cancelToken: _cancelManager.createToken('loadData'),
///     );
///   }
///   
///   @override
///   void onClose() {
///     _cancelManager.cancelAll();
///     super.onClose();
///   }
/// }
/// ```
class CancelTokenManager {
  /// 存储所有活跃的取消令牌
  final Map<String, CancelToken> _tokens = {};
  
  /// 是否已全部取消
  bool _isCancelled = false;
  
  /// 创建一个新的取消令牌
  /// 
  /// [tag] 令牌标识，用于后续单独取消
  /// 
  /// 如果已存在相同 tag 的令牌，会先取消旧的再创建新的
  CancelToken createToken(String tag) {
    // 如果管理器已被取消，返回一个已取消的令牌
    if (_isCancelled) {
      final token = CancelToken();
      token.cancel('Manager cancelled');
      return token;
    }
    
    // 取消已存在的同名令牌
    if (_tokens.containsKey(tag)) {
      cancelToken(tag);
    }
    
    final token = CancelToken();
    _tokens[tag] = token;
    
    Logger.debug('[CancelTokenManager] Created token: $tag');
    return token;
  }
  
  /// 获取已存在的令牌
  /// 
  /// 如果不存在则创建新的
  CancelToken getOrCreate(String tag) {
    if (_tokens.containsKey(tag) && !_tokens[tag]!.isCancelled) {
      return _tokens[tag]!;
    }
    return createToken(tag);
  }
  
  /// 取消指定的令牌
  void cancelToken(String tag, [String? reason]) {
    final token = _tokens[tag];
    if (token != null && !token.isCancelled) {
      token.cancel(reason ?? 'Cancelled by user');
      Logger.debug('[CancelTokenManager] Cancelled token: $tag');
    }
    _tokens.remove(tag);
  }
  
  /// 取消所有令牌
  void cancelAll([String? reason]) {
    _isCancelled = true;
    
    for (final entry in _tokens.entries) {
      if (!entry.value.isCancelled) {
        entry.value.cancel(reason ?? 'All cancelled');
        Logger.debug('[CancelTokenManager] Cancelled token: ${entry.key}');
      }
    }
    
    _tokens.clear();
    Logger.info('[CancelTokenManager] All tokens cancelled');
  }
  
  /// 移除已完成的令牌
  void removeToken(String tag) {
    _tokens.remove(tag);
  }
  
  /// 清理已取消的令牌
  void cleanup() {
    _tokens.removeWhere((_, token) => token.isCancelled);
  }
  
  /// 获取活跃令牌数量
  int get activeCount => _tokens.values.where((t) => !t.isCancelled).length;
  
  /// 是否有活跃的请求
  bool get hasActiveRequests => activeCount > 0;
  
  /// 重置管理器（用于页面重新进入）
  void reset() {
    cancelAll();
    _isCancelled = false;
  }
}

/// 全局请求取消管理器
/// 
/// 用于管理全局级别的请求，如应用退出时取消所有请求
class GlobalCancelTokenManager {
  static final GlobalCancelTokenManager _instance = GlobalCancelTokenManager._internal();
  factory GlobalCancelTokenManager() => _instance;
  GlobalCancelTokenManager._internal();
  
  /// 页面级别的管理器
  final Map<String, CancelTokenManager> _pageManagers = {};
  
  /// 获取或创建页面级别的管理器
  CancelTokenManager getPageManager(String pageId) {
    if (!_pageManagers.containsKey(pageId)) {
      _pageManagers[pageId] = CancelTokenManager();
    }
    return _pageManagers[pageId]!;
  }
  
  /// 取消指定页面的所有请求
  void cancelPage(String pageId) {
    final manager = _pageManagers[pageId];
    if (manager != null) {
      manager.cancelAll('Page disposed');
      _pageManagers.remove(pageId);
    }
  }
  
  /// 取消所有页面的所有请求
  void cancelAll() {
    for (final manager in _pageManagers.values) {
      manager.cancelAll('App closing');
    }
    _pageManagers.clear();
    Logger.info('[GlobalCancelTokenManager] All page requests cancelled');
  }
  
  /// 获取统计信息
  Map<String, int> getStats() {
    final stats = <String, int>{};
    for (final entry in _pageManagers.entries) {
      stats[entry.key] = entry.value.activeCount;
    }
    return stats;
  }
}
