import 'dart:async';
import 'package:wakelock_plus/wakelock_plus.dart';

/// 防熄屏管理 Mixin
/// 
/// 智能管理屏幕常亮功能：
/// - 播放时保持屏幕常亮
/// - 暂停后延迟关闭（默认30秒）
/// - 画中画模式下保持常亮
/// 
/// ## 设计原理
/// 视频播放时用户需要观看屏幕，此时应保持屏幕常亮。
/// 暂停后用户可能只是临时暂停，不应立即关闭屏幕，
/// 因此设置30秒延迟，超时后才允许屏幕熄灭。
/// 
/// ## 使用方式
/// ```dart
/// class GlobalPlayerManager extends GetxController 
///     with PlayerWakelockMixin {
///   
///   void play() {
///     enableWakelock();
///     // ...
///   }
///   
///   void pause() {
///     scheduleDisableWakelock();
///     // ...
///   }
/// }
/// ```
mixin PlayerWakelockMixin {
  /// 防熄屏延迟定时器
  Timer? _wakelockTimer;

  /// 暂停后延迟禁用防熄屏的时间（秒）
  static const int _wakelockDelaySeconds = 30;

  // ==================== 抽象方法（由主类实现） ====================

  /// 检查是否在画中画模式
  bool get isInPipModeValue;

  /// 检查是否正在播放
  bool get isPlayingValue;

  // ==================== 公开方法 ====================

  /// 启用防熄屏
  /// 
  /// 立即启用屏幕常亮，并取消任何待执行的禁用定时器
  Future<void> enableWakelock() async {
    // 取消延迟禁用定时器
    _wakelockTimer?.cancel();
    _wakelockTimer = null;

    try {
      final isEnabled = await WakelockPlus.enabled;
      if (!isEnabled) {
        await WakelockPlus.enable();
        print('🔆 [Wakelock] Enabled - screen will stay on');
      }
    } catch (e) {
      print('❌ [Wakelock] Failed to enable: $e');
    }
  }

  /// 延迟禁用防熄屏
  /// 
  /// 设置定时器，在指定时间后禁用屏幕常亮。
  /// 如果在定时器触发前用户恢复播放，定时器会被取消。
  /// 
  /// 特殊情况：
  /// - 画中画模式下不禁用
  /// - 如果在定时器触发时正在播放，不禁用
  void scheduleDisableWakelock() {
    // 取消之前的定时器
    _wakelockTimer?.cancel();

    // 画中画模式下不禁用
    if (isInPipModeValue) {
      print('🔆 [Wakelock] In PIP mode, keeping enabled');
      return;
    }

    // 延迟禁用
    _wakelockTimer = Timer(Duration(seconds: _wakelockDelaySeconds), () {
      // 再次检查是否在播放
      if (!isPlayingValue) {
        disableWakelock();
      }
    });

    print('🔆 [Wakelock] Scheduled disable in ${_wakelockDelaySeconds}s');
  }

  /// 立即禁用防熄屏
  /// 
  /// 立即关闭屏幕常亮功能，允许系统自动熄屏
  Future<void> disableWakelock() async {
    _wakelockTimer?.cancel();
    _wakelockTimer = null;

    try {
      final isEnabled = await WakelockPlus.enabled;
      if (isEnabled) {
        await WakelockPlus.disable();
        print('🔅 [Wakelock] Disabled - screen can turn off');
      }
    } catch (e) {
      print('❌ [Wakelock] Failed to disable: $e');
    }
  }

  /// 释放防熄屏资源
  /// 
  /// 在播放器销毁时调用，确保禁用屏幕常亮
  void disposeWakelockMixin() {
    _wakelockTimer?.cancel();
    _wakelockTimer = null;
    disableWakelock();
  }
}
