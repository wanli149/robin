import 'platform_utils.dart';

/// 平台相关配置
class PlatformConfig {
  /// 是否显示底部导航栏
  static bool get showBottomNavigation => PlatformUtils.isMobile;
  
  /// 是否支持短剧流（竖屏滑动）
  static bool get supportsShortsFlow => PlatformUtils.isMobile;
  
  /// 默认窗口宽度（桌面端）
  static double get defaultWindowWidth => 1280;
  
  /// 默认窗口高度（桌面端）
  static double get defaultWindowHeight => 720;
  
  /// 是否使用侧边栏导航（桌面端）
  static bool get useSidebarNavigation => PlatformUtils.isDesktop;
  
  /// 视频播放器默认宽高比
  static double get videoAspectRatio => PlatformUtils.isMobile ? 16 / 9 : 16 / 9;
  
  /// 是否启用手势控制
  static bool get enableGestureControls => PlatformUtils.isMobile;
  
  /// 是否显示鼠标悬停控制（桌面端）
  static bool get showHoverControls => PlatformUtils.isDesktop;
  
  /// 网格列数（首页）
  static int getGridColumns(double screenWidth) {
    if (PlatformUtils.isDesktop) {
      if (screenWidth > 1600) return 6;
      if (screenWidth > 1200) return 5;
      if (screenWidth > 800) return 4;
      return 3;
    } else {
      // 移动端
      if (screenWidth > 600) return 3;
      return 2;
    }
  }
  
  /// 内容间距
  static double get contentPadding => PlatformUtils.isDesktop ? 24.0 : 16.0;
  
  /// 卡片圆角
  static double get cardBorderRadius => PlatformUtils.isDesktop ? 12.0 : 8.0;
}
