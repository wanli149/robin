import 'dart:io';
import 'package:flutter/foundation.dart';

/// 平台工具类
/// 
/// 提供跨平台功能检测和适配
class PlatformUtils {
  /// 是否为移动端（Android/iOS）
  static bool get isMobile => isAndroid || isIOS;
  
  /// 是否为桌面端（Windows/macOS/Linux）
  static bool get isDesktop => isWindows || isMacOS || isLinux;
  
  /// 是否为 Android
  static bool get isAndroid => !kIsWeb && Platform.isAndroid;
  
  /// 是否为 iOS
  static bool get isIOS => !kIsWeb && Platform.isIOS;
  
  /// 是否为 Windows
  static bool get isWindows => !kIsWeb && Platform.isWindows;
  
  /// 是否为 macOS
  static bool get isMacOS => !kIsWeb && Platform.isMacOS;
  
  /// 是否为 Linux
  static bool get isLinux => !kIsWeb && Platform.isLinux;
  
  /// 是否为 Web
  static bool get isWeb => kIsWeb;
  
  /// 是否支持音量手势控制
  static bool get supportsVolumeGesture => isMobile;
  
  /// 是否支持亮度手势控制
  static bool get supportsBrightnessGesture => isMobile;
  
  /// 是否支持画中画（PIP）
  static bool get supportsPIP => isAndroid || isIOS;
  
  /// 是否支持防止熄屏
  static bool get supportsWakelock => isMobile;
  
  /// 获取平台名称
  static String get platformName {
    if (isAndroid) return 'Android';
    if (isIOS) return 'iOS';
    if (isWindows) return 'Windows';
    if (isMacOS) return 'macOS';
    if (isLinux) return 'Linux';
    if (isWeb) return 'Web';
    return 'Unknown';
  }
}
