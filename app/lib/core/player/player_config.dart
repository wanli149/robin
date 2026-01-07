import 'package:flutter/services.dart';
import 'player_enums.dart';

/// 播放器配置类
/// 
/// 定义播放器的各项配置参数，包括宽高比、屏幕方向、手势控制等。
/// 提供多种预设配置工厂方法，适用于不同的播放场景。
/// 
/// ## 使用示例
/// ```dart
/// // 使用预设配置
/// final config = PlayerConfig.tvWindow();
/// 
/// // 自定义配置
/// final customConfig = PlayerConfig(
///   aspectRatio: 16 / 9,
///   orientation: DeviceOrientation.landscapeLeft,
///   enableSwipeGesture: true,
/// );
/// ```
class PlayerConfig {
  /// 视频宽高比
  /// 
  /// 常见值：
  /// - 16/9: 标准横屏视频
  /// - 9/16: 竖屏短视频
  /// - 4/3: 老式电视比例
  final double aspectRatio;

  /// 屏幕方向
  /// 
  /// 控制播放时的屏幕旋转方向
  final DeviceOrientation orientation;

  /// 是否启用滑动手势
  /// 
  /// 启用后支持：
  /// - 左侧上下滑动调节亮度
  /// - 右侧上下滑动调节音量
  /// - 水平滑动快进/快退
  final bool enableSwipeGesture;

  /// 控制栏类型
  final PlayerControlsType controlsType;

  /// 是否自动播放
  final bool autoPlay;

  /// 是否显示进度条
  final bool showProgress;

  /// 是否启用画中画功能
  final bool enablePip;

  const PlayerConfig({
    required this.aspectRatio,
    required this.orientation,
    this.enableSwipeGesture = false,
    this.controlsType = PlayerControlsType.full,
    this.autoPlay = true,
    this.showProgress = true,
    this.enablePip = true,
  });

  /// 短剧小窗配置
  /// 
  /// 适用于短剧详情页的小窗播放模式
  /// - 16:9 横屏比例
  /// - 保持竖屏方向
  /// - 基础控制栏
  static PlayerConfig shortsWindow() => const PlayerConfig(
    aspectRatio: 16 / 9,
    orientation: DeviceOrientation.portraitUp,
    enableSwipeGesture: false,
    controlsType: PlayerControlsType.basic,
  );

  /// 短剧全屏配置
  /// 
  /// 适用于短剧全屏播放模式
  /// - 9:16 竖屏比例
  /// - 保持竖屏方向
  /// - 最小控制栏
  /// - 启用滑动手势
  static PlayerConfig shortsFullscreen() => const PlayerConfig(
    aspectRatio: 9 / 16,
    orientation: DeviceOrientation.portraitUp,
    enableSwipeGesture: true,
    controlsType: PlayerControlsType.minimal,
  );

  /// 短剧流配置
  /// 
  /// 适用于短剧流（类似抖音）的滑动播放模式
  /// - 9:16 竖屏比例（实际会根据视频调整）
  /// - 保持竖屏方向
  /// - 无控制栏（点击暂停/播放）
  /// - 不显示进度条
  static PlayerConfig shortsFlow() => const PlayerConfig(
    aspectRatio: 9 / 16,
    orientation: DeviceOrientation.portraitUp,
    enableSwipeGesture: true,
    controlsType: PlayerControlsType.none,
    showProgress: false,
  );

  /// 电视剧/电影小窗配置
  /// 
  /// 适用于详情页内嵌播放模式
  /// - 16:9 横屏比例
  /// - 保持竖屏方向（详情页整体竖屏）
  /// - 完整控制栏
  static PlayerConfig tvWindow() => const PlayerConfig(
    aspectRatio: 16 / 9,
    orientation: DeviceOrientation.portraitUp,
    enableSwipeGesture: false,
    controlsType: PlayerControlsType.full,
  );

  /// 电视剧/电影全屏配置
  /// 
  /// 适用于用户手动进入全屏的播放模式
  /// - 16:9 横屏比例
  /// - 横屏方向
  /// - 完整控制栏
  static PlayerConfig tvFullscreen() => const PlayerConfig(
    aspectRatio: 16 / 9,
    orientation: DeviceOrientation.landscapeLeft,
    enableSwipeGesture: false,
    controlsType: PlayerControlsType.full,
  );

  /// 画中画配置
  /// 
  /// 适用于画中画悬浮窗模式
  /// - 16:9 横屏比例
  /// - 保持竖屏方向
  /// - 无控制栏
  /// - 不显示进度条
  /// - 禁用画中画（避免嵌套）
  static PlayerConfig pip() => const PlayerConfig(
    aspectRatio: 16 / 9,
    orientation: DeviceOrientation.portraitUp,
    enableSwipeGesture: false,
    controlsType: PlayerControlsType.none,
    showProgress: false,
    enablePip: false,
  );

  /// 创建配置副本并修改部分参数
  PlayerConfig copyWith({
    double? aspectRatio,
    DeviceOrientation? orientation,
    bool? enableSwipeGesture,
    PlayerControlsType? controlsType,
    bool? autoPlay,
    bool? showProgress,
    bool? enablePip,
  }) {
    return PlayerConfig(
      aspectRatio: aspectRatio ?? this.aspectRatio,
      orientation: orientation ?? this.orientation,
      enableSwipeGesture: enableSwipeGesture ?? this.enableSwipeGesture,
      controlsType: controlsType ?? this.controlsType,
      autoPlay: autoPlay ?? this.autoPlay,
      showProgress: showProgress ?? this.showProgress,
      enablePip: enablePip ?? this.enablePip,
    );
  }

  @override
  String toString() {
    return 'PlayerConfig(aspectRatio: $aspectRatio, orientation: $orientation, '
        'controlsType: $controlsType, autoPlay: $autoPlay)';
  }
}
