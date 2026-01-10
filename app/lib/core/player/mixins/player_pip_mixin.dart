import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import '../player_config.dart';
import '../player_enums.dart';
import '../player_state.dart';
import '../../pip_manager.dart';
import '../../logger.dart';

/// 画中画管理 Mixin (基于 media_kit)
mixin PlayerPipMixin on GetxController {
  // ==================== 抽象属性 ====================

  /// 获取 media_kit Player 实例
  Player? get player;
  
  /// 获取 media_kit VideoController
  VideoController? get videoController;

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
  void registerToPipManager() {
    final p = player;
    final vc = videoController;
    if (p == null || vc == null || !p.state.playing) return;

    try {
      Logger.player('Registering to PIP manager');

      // 使用 media_kit 的 Video widget
      final playerWidget = Video(
        controller: vc,
        fit: BoxFit.contain,
      );

      PipManager.to.registerPlayer('global_player', playerWidget);
    } catch (e) {
      Logger.error('Failed to register to PIP: $e');
    }
  }

  /// 从画中画管理器注销
  void unregisterFromPipManager() {
    try {
      Logger.player('Unregistering from PIP manager');
      PipManager.to.unregisterPlayer('global_player');
    } catch (e) {
      Logger.error('Failed to unregister from PIP: $e');
    }
  }

  /// 切换到画中画模式
  void switchToPipMode() {
    playerModeRx.value = PlayerMode.pip;
    currentConfigRx.value = PlayerConfig.pip();
    notifyStateListeners();
    Logger.player('Switched to PIP mode');
  }

  /// 退出画中画模式
  void exitPipMode() {
    playerModeRx.value = PlayerMode.window;

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
    Logger.player('Exited PIP mode');
  }

  /// 手动进入画中画模式
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
