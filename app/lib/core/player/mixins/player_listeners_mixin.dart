import 'package:get/get.dart';
import '../player_state.dart';
import '../../logger.dart';

/// 状态监听器管理 Mixin
/// 
/// 负责管理播放器状态变化的监听器：
/// - 状态监听器：监听播放状态变化
/// - 错误监听器：监听播放错误
/// 
/// ## 使用方式
/// ```dart
/// class GlobalPlayerManager extends GetxController 
///     with PlayerListenersMixin {
///   // ...
/// }
/// ```
mixin PlayerListenersMixin on GetxController {
  /// 状态监听器列表
  final List<Function(PlayerState state)> _stateListeners = [];

  /// 错误监听器列表
  final List<Function(String error)> _errorListeners = [];

  // ==================== 状态监听器 ====================

  /// 添加状态监听器
  /// 
  /// 监听器会在播放状态变化时被调用
  /// 
  /// [listener] 回调函数，参数为当前播放状态
  void addStateListener(Function(PlayerState state) listener) {
    _stateListeners.add(listener);
  }

  /// 移除状态监听器
  void removeStateListener(Function(PlayerState state) listener) {
    _stateListeners.remove(listener);
  }

  /// 通知所有状态监听器
  void notifyStateListenersInternal(PlayerState state) {
    for (final listener in _stateListeners) {
      try {
        listener(state);
      } catch (e) {
        Logger.error('State listener error: $e');
      }
    }
  }

  // ==================== 错误监听器 ====================

  /// 添加错误监听器
  /// 
  /// 监听器会在播放出错时被调用
  /// 
  /// [listener] 回调函数，参数为错误信息
  void addErrorListener(Function(String error) listener) {
    _errorListeners.add(listener);
  }

  /// 移除错误监听器
  void removeErrorListener(Function(String error) listener) {
    _errorListeners.remove(listener);
  }

  /// 通知所有错误监听器
  void notifyErrorListeners(String error) {
    for (final listener in _errorListeners) {
      try {
        listener(error);
      } catch (e) {
        Logger.error('Error listener error: $e');
      }
    }
  }

  // ==================== 资源释放 ====================

  /// 释放监听器资源
  void disposeListenersMixin() {
    _stateListeners.clear();
    _errorListeners.clear();
  }
}
