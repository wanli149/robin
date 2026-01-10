/// UI 常量定义
/// 
/// 统一管理应用中的 UI 相关常量，避免硬编码魔法数字。
/// 
/// ## 使用示例
/// ```dart
/// import 'package:robin_video/core/ui_constants.dart';
/// 
/// Container(
///   height: UIConstants.playerMinHeightRatio * screenHeight,
/// )
/// ```
library;

import 'package:flutter/material.dart';

/// UI 常量
class UIConstants {
  UIConstants._();
  
  // ==================== 播放器相关 ====================
  
  /// 短剧详情页播放器最大高度比例
  static const double playerMaxHeightRatio = 0.55;
  
  /// 短剧详情页播放器最小高度比例
  static const double playerMinHeightRatio = 0.25;
  
  /// 播放器滚动缩放触发距离（屏幕高度的百分比）
  static const double playerShrinkScrollRatio = 0.3;
  
  /// 播放器动画时长（毫秒）
  static const int playerAnimationDurationMs = 50;
  
  // ==================== 防抖相关 ====================
  
  /// 视频切换防抖时间（毫秒）
  static const int videoSwitchDebounceMs = 300;
  
  /// 播放/暂停切换防抖时间（毫秒）
  static const int playPauseDebounceMs = 300;
  
  // ==================== 尺寸相关 ====================
  
  /// 播放按钮大小
  static const double playButtonSize = 64.0;
  
  /// 播放按钮图标大小
  static const double playButtonIconSize = 40.0;
  
  /// 暂停图标大小（短剧流）
  static const double pauseIconSize = 80.0;
  
  /// 操作按钮容器大小
  static const double actionButtonSize = 48.0;
  
  /// 操作按钮图标大小
  static const double actionButtonIconSize = 28.0;
  
  /// 静音按钮图标大小
  static const double muteButtonIconSize = 24.0;
  
  /// 全屏按钮图标大小
  static const double fullscreenButtonIconSize = 24.0;
  
  // ==================== 间距相关 ====================
  
  /// 标准水平内边距
  static const double horizontalPadding = 16.0;
  
  /// 标准垂直内边距
  static const double verticalPadding = 12.0;
  
  /// 小间距
  static const double smallSpacing = 8.0;
  
  /// 中等间距
  static const double mediumSpacing = 12.0;
  
  /// 大间距
  static const double largeSpacing = 24.0;
  
  // ==================== 圆角相关 ====================
  
  /// 小圆角
  static const double smallRadius = 4.0;
  
  /// 中等圆角
  static const double mediumRadius = 8.0;
  
  /// 大圆角
  static const double largeRadius = 24.0;
  
  // ==================== 字体大小 ====================
  
  /// 超小字体
  static const double fontSizeXs = 10.0;
  
  /// 小字体
  static const double fontSizeSm = 12.0;
  
  /// 中等字体
  static const double fontSizeMd = 14.0;
  
  /// 大字体
  static const double fontSizeLg = 16.0;
  
  /// 超大字体
  static const double fontSizeXl = 18.0;
  
  /// 标题字体
  static const double fontSizeTitle = 20.0;
  
  // ==================== 透明度 ====================
  
  /// 半透明遮罩
  static const double overlayOpacity = 0.5;
  
  /// 深色遮罩
  static const double darkOverlayOpacity = 0.7;
  
  /// 更深遮罩
  static const double darkerOverlayOpacity = 0.8;
  
  // ==================== 网格相关 ====================
  
  /// 推荐列表列数
  static const int recommendGridColumns = 3;
  
  /// 推荐列表宽高比
  static const double recommendItemAspectRatio = 0.58;
  
  /// 选集按钮宽度
  static const double episodeButtonWidth = 56.0;
  
  /// 选集按钮高度
  static const double episodeButtonHeight = 36.0;
}

/// 应用主题颜色
class AppColors {
  AppColors._();
  
  /// 主色调（金色）
  static const Color primary = Color(0xFFFFC107);
  
  /// 背景色（深色）
  static const Color background = Color(0xFF121212);
  
  /// 卡片背景色
  static const Color cardBackground = Color(0xFF1E1E1E);
  
  /// 边框色
  static const Color border = Color(0xFF2E2E2E);
  
  /// 文字颜色 - 主要
  static const Color textPrimary = Colors.white;
  
  /// 文字颜色 - 次要
  static const Color textSecondary = Colors.white70;
  
  /// 文字颜色 - 提示
  static const Color textHint = Colors.white54;
  
  /// 文字颜色 - 禁用
  static const Color textDisabled = Colors.white38;
  
  /// 错误颜色
  static const Color error = Colors.redAccent;
  
  /// 成功颜色
  static const Color success = Colors.greenAccent;
}

/// 动画时长常量
class AnimationDurations {
  AnimationDurations._();
  
  /// 快速动画
  static const Duration fast = Duration(milliseconds: 150);
  
  /// 标准动画
  static const Duration normal = Duration(milliseconds: 300);
  
  /// 慢速动画
  static const Duration slow = Duration(milliseconds: 500);
  
  /// 页面切换动画
  static const Duration pageTransition = Duration(milliseconds: 250);
}
