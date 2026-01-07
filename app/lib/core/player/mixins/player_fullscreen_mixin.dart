import 'package:flutter/services.dart';
import 'package:get/get.dart';
import '../player_config.dart';
import '../player_enums.dart';
import '../player_state.dart';

/// 全屏管理 Mixin
/// 
/// 负责播放器全屏模式的进入和退出：
/// - 屏幕方向切换
/// - 系统UI显示/隐藏
/// - 播放器配置切换
/// 
/// ## 全屏逻辑
/// - 电视剧/电影：全屏时横屏，退出时竖屏
/// - 短剧：全屏时保持竖屏
/// 
/// ## 使用方式
/// ```dart
/// class GlobalPlayerManager extends GetxController 
///     with PlayerFullscreenMixin {
///   // ...
/// }
/// ```
mixin PlayerFullscreenMixin on GetxController {
  // ==================== 抽象属性（由主类实现） ====================

  /// 获取当前播放状态
  PlayerState get currentPlayerState;

  /// 获取当前播放器模式
  Rx<PlayerMode> get playerModeRx;

  /// 获取当前播放器配置
  Rx<PlayerConfig> get currentConfigRx;

  /// 播放器实例是否正在播放
  bool get isPlayerInstancePlaying;

  /// 恢复播放
  Future<void> resumePlay();

  /// 通知状态监听器
  void notifyStateListeners();

  // ==================== 公开方法 ====================

  /// 进入全屏模式
  /// 
  /// 根据内容类型自动选择合适的全屏配置：
  /// - 电视剧/电影：横屏全屏
  /// - 短剧：竖屏全屏
  /// 
  /// 执行顺序：
  /// 1. 设置屏幕方向
  /// 2. 隐藏系统UI
  /// 3. 等待方向切换完成
  /// 4. 更新播放器配置和模式
  Future<void> enterFullscreen() async {
    print('🎬 [Fullscreen] Entering fullscreen mode');

    // 根据内容类型选择全屏配置
    PlayerConfig fullscreenConfig;
    switch (currentPlayerState.contentType) {
      case ContentType.shorts:
      case ContentType.shortsFlow:
        fullscreenConfig = PlayerConfig.shortsFullscreen();
        break;
      case ContentType.tv:
      case ContentType.movie:
        fullscreenConfig = PlayerConfig.tvFullscreen();
        break;
    }

    // 先设置屏幕方向和系统UI，再更新playerMode触发UI重建
    // 这样可以避免先显示竖屏全屏再切换到横屏的问题
    if (currentPlayerState.contentType == ContentType.tv ||
        currentPlayerState.contentType == ContentType.movie) {
      // 电视剧/电影：先切换到横屏
      await SystemChrome.setPreferredOrientations([
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
    }

    // 隐藏系统UI（状态栏、导航栏）
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersive);

    // 等待方向切换完成
    await Future.delayed(const Duration(milliseconds: 150));

    // 最后更新配置和模式，触发UI重建
    currentConfigRx.value = fullscreenConfig;
    playerModeRx.value = PlayerMode.fullscreen;

    notifyStateListeners();
    print('🎬 [Fullscreen] Fullscreen mode entered');
  }

  /// 退出全屏模式
  /// 
  /// 恢复到小窗模式：
  /// 1. 恢复竖屏方向
  /// 2. 恢复系统UI
  /// 3. 更新播放器配置和模式
  /// 4. 如果之前在播放，继续播放
  Future<void> exitFullscreen() async {
    print('🎬 [Fullscreen] Exiting fullscreen mode');

    // 保存当前播放状态，退出全屏后继续播放
    final wasPlaying = currentPlayerState.isPlaying;

    // 根据内容类型选择小窗配置
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

    // 先恢复竖屏方向，再更新playerMode触发UI重建
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
    ]);

    // 恢复系统UI
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);

    // 等待方向切换完成
    await Future.delayed(const Duration(milliseconds: 150));

    // 最后更新配置和模式，触发UI重建
    currentConfigRx.value = windowConfig;
    playerModeRx.value = PlayerMode.window;

    // 如果之前在播放，确保继续播放
    if (wasPlaying && !isPlayerInstancePlaying) {
      await resumePlay();
    }

    notifyStateListeners();
    print('🎬 [Fullscreen] Fullscreen mode exited');
  }

  /// 切换全屏状态
  /// 
  /// 如果当前是全屏则退出，否则进入全屏
  Future<void> toggleFullscreen() async {
    if (playerModeRx.value == PlayerMode.fullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }

  /// 检查是否处于全屏模式
  bool get isFullscreen => playerModeRx.value == PlayerMode.fullscreen;
}
