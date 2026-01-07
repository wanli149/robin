import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// 屏幕适配工具类
/// 处理不同屏幕尺寸和方向的适配问题
class ScreenAdapter {
  /// 获取屏幕信息
  static ScreenInfo getScreenInfo(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    final size = mediaQuery.size;
    final padding = mediaQuery.padding;
    
    return ScreenInfo(
      width: size.width,
      height: size.height,
      aspectRatio: size.width / size.height,
      isLandscape: size.width > size.height,
      safeAreaTop: padding.top,
      safeAreaBottom: padding.bottom,
      safeAreaLeft: padding.left,
      safeAreaRight: padding.right,
    );
  }

  /// 计算视频播放器的最佳尺寸
  static VideoPlayerSize calculateVideoPlayerSize({
    required BuildContext context,
    required double videoAspectRatio,
    required VideoPlayerMode mode,
  }) {
    final screenInfo = getScreenInfo(context);
    
    switch (mode) {
      case VideoPlayerMode.fullScreen:
        return _calculateFullScreenSize(screenInfo, videoAspectRatio);
      case VideoPlayerMode.window:
        return _calculateWindowSize(screenInfo, videoAspectRatio);
      case VideoPlayerMode.flow:
        return _calculateFlowSize(screenInfo);
    }
  }

  /// 计算全屏模式尺寸
  static VideoPlayerSize _calculateFullScreenSize(
    ScreenInfo screenInfo,
    double videoAspectRatio,
  ) {
    // 全屏模式：保持视频比例，居中显示
    double width, height;
    
    if (videoAspectRatio > screenInfo.aspectRatio) {
      // 视频更宽，以屏幕宽度为准
      width = screenInfo.width;
      height = width / videoAspectRatio;
    } else {
      // 视频更高，以屏幕高度为准
      height = screenInfo.height;
      width = height * videoAspectRatio;
    }
    
    return VideoPlayerSize(
      width: width,
      height: height,
      fit: BoxFit.contain,
    );
  }

  /// 计算小窗模式尺寸
  static VideoPlayerSize _calculateWindowSize(
    ScreenInfo screenInfo,
    double videoAspectRatio,
  ) {
    // 小窗模式：限制最大尺寸
    final maxWidth = screenInfo.width;
    final maxHeight = screenInfo.height * 0.6; // 最大60%屏幕高度
    
    double width, height;
    
    if (videoAspectRatio > maxWidth / maxHeight) {
      // 以宽度为准
      width = maxWidth;
      height = width / videoAspectRatio;
    } else {
      // 以高度为准
      height = maxHeight;
      width = height * videoAspectRatio;
    }
    
    return VideoPlayerSize(
      width: width,
      height: height,
      fit: BoxFit.contain,
    );
  }

  /// 计算流模式尺寸（短剧流）
  static VideoPlayerSize _calculateFlowSize(ScreenInfo screenInfo) {
    // 流模式：填充整个屏幕
    return VideoPlayerSize(
      width: screenInfo.width,
      height: screenInfo.height,
      fit: BoxFit.cover, // 裁剪填充
    );
  }

  /// 设置屏幕方向
  static Future<void> setOrientation(DeviceOrientation orientation) async {
    await SystemChrome.setPreferredOrientations([orientation]);
  }

  /// 设置全屏模式
  static Future<void> enterFullScreen() async {
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersive);
  }

  /// 退出全屏模式
  static Future<void> exitFullScreen() async {
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  }

  /// 判断是否为刘海屏
  static bool hasNotch(BuildContext context) {
    final padding = MediaQuery.of(context).padding;
    return padding.top > 24; // 通常刘海屏的顶部padding会大于24
  }

  /// 获取安全区域高度
  static double getSafeAreaHeight(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    return mediaQuery.size.height - mediaQuery.padding.top - mediaQuery.padding.bottom;
  }

  /// 获取安全区域宽度
  static double getSafeAreaWidth(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    return mediaQuery.size.width - mediaQuery.padding.left - mediaQuery.padding.right;
  }
}

/// 屏幕信息
class ScreenInfo {
  final double width;
  final double height;
  final double aspectRatio;
  final bool isLandscape;
  final double safeAreaTop;
  final double safeAreaBottom;
  final double safeAreaLeft;
  final double safeAreaRight;

  const ScreenInfo({
    required this.width,
    required this.height,
    required this.aspectRatio,
    required this.isLandscape,
    required this.safeAreaTop,
    required this.safeAreaBottom,
    required this.safeAreaLeft,
    required this.safeAreaRight,
  });

  /// 是否为竖屏
  bool get isPortrait => !isLandscape;

  /// 安全区域尺寸
  Size get safeAreaSize => Size(
    width - safeAreaLeft - safeAreaRight,
    height - safeAreaTop - safeAreaBottom,
  );
}

/// 视频播放器尺寸
class VideoPlayerSize {
  final double width;
  final double height;
  final BoxFit fit;

  const VideoPlayerSize({
    required this.width,
    required this.height,
    required this.fit,
  });

  /// 宽高比
  double get aspectRatio => width / height;
}

/// 视频播放器模式
enum VideoPlayerMode {
  fullScreen, // 全屏模式
  window,     // 小窗模式
  flow,       // 流模式
}