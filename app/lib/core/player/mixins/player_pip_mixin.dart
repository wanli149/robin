import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:video_player/video_player.dart';
import '../player_config.dart';
import '../player_enums.dart';
import '../player_state.dart';
import '../../pip_manager.dart';

/// 画中画管理 Mixin
/// 
/// 负责播放器画中画（Picture-in-Picture）功能：
/// - 注册/注销播放器到 PipManager
/// - 进入/退出画中画模式
/// - 处理画中画状态变化
/// 
/// ## Android 画中画原理
/// 1. 用户按 Home 键或切换应用时触发
/// 2. Android 系统自动将视频 Surface 显示为悬浮窗
/// 3. Flutter UI 被隐藏，只保留原生视频渲染
/// 
/// ## 使用方式
/// ```dart
/// class GlobalPlayerManager extends GetxController 
///     with PlayerPipMixin {
///   // ...
/// }
/// ```
mixin PlayerPipMixin on GetxController {
  // ==================== 抽象属性（由主类实现） ====================

  /// 获取播放器实例
  VideoPlayerController? get playerInstanceValue;

  /// 获取当前播放状态
  PlayerState get currentPlayerState;

  /// 获取播放器模式
  Rx<PlayerMode> get playerModeRx;

  /// 获取播放器配置
  Rx<PlayerConfig> get currentConfigRx;

  /// 通知状态监听器
  void notifyStateListeners();

  // ==================== 公开方法 ====================

  /// 注册播放器到画中画管理器
  /// 
  /// 当播放器开始播放时调用，告知系统有视频正在播放，
  /// 以便在用户切换应用时自动进入画中画模式
  void registerToPipManager() {
    final player = playerInstanceValue;
    if (player == null || !player.value.isPlaying) return;

    try {
      print('🎬 [PIP] Registering to PIP manager');

      final playerWidget = AspectRatio(
        aspectRatio: player.value.aspectRatio,
        child: VideoPlayer(player),
      );

      PipManager.to.registerPlayer('global_player', playerWidget);
    } catch (e) {
      print('❌ [PIP] Failed to register: $e');
    }
  }

  /// 从画中画管理器注销
  /// 
  /// 当播放器停止播放或销毁时调用
  void unregisterFromPipManager() {
    try {
      print('🎬 [PIP] Unregistering from PIP manager');
      PipManager.to.unregisterPlayer('global_player');
    } catch (e) {
      print('❌ [PIP] Failed to unregister: $e');
    }
  }

  /// 切换到画中画模式
  /// 
  /// 更新播放器配置和模式为画中画状态
  void switchToPipMode() {
    playerModeRx.value = PlayerMode.pip;
    currentConfigRx.value = PlayerConfig.pip();
    notifyStateListeners();
    print('🎬 [PIP] Switched to PIP mode');
  }

  /// 退出画中画模式
  /// 
  /// 恢复到之前的播放模式（通常是小窗模式）
  void exitPipMode() {
    // 恢复之前的模式
    playerModeRx.value = PlayerMode.window;

    // 根据内容类型选择配置
    PlayerConfig windowConfig;
    switch (currentPlayerState.contentType) {
      case ContentType.shorts:
      case ContentType.shortsFlow:
        windowConfig = PlayerConfig.shortsWindow();
        break;
      case ContentType.tv:
      case ContentType.movie:
        windowConfig = PlayerConfig.tvWindow();
        break;
    }

    currentConfigRx.value = windowConfig;
    notifyStateListeners();
    print('🎬 [PIP] Exited PIP mode');
  }

  /// 手动进入画中画模式
  /// 
  /// 调用系统 API 进入画中画
  void enterPipMode() {
    PipManager.to.enterPipMode();
  }

  /// 检查是否处于画中画模式
  bool get isInPipMode => playerModeRx.value == PlayerMode.pip;

  /// 检查设备是否支持画中画
  Future<bool> isPipSupported() async {
    return await PipManager.to.isPipSupported();
  }
}
