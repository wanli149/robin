import 'package:flutter/foundation.dart';

/// 日志管理器
/// 开发环境输出日志，生产环境自动禁用
class Logger {
  static const String _tag = 'RobinVideo';
  
  /// 调试日志
  static void debug(String message, [String? tag]) {
    if (kDebugMode) {
      print('🐛 [$_tag${tag != null ? ':$tag' : ''}] $message');
    }
  }
  
  /// 信息日志
  static void info(String message, [String? tag]) {
    if (kDebugMode) {
      print('ℹ️ [$_tag${tag != null ? ':$tag' : ''}] $message');
    }
  }
  
  /// 警告日志
  static void warning(String message, [String? tag]) {
    if (kDebugMode) {
      print('⚠️ [$_tag${tag != null ? ':$tag' : ''}] $message');
    }
  }
  
  /// 错误日志
  static void error(String message, [String? tag, Object? error]) {
    if (kDebugMode) {
      print('❌ [$_tag${tag != null ? ':$tag' : ''}] $message');
      if (error != null) {
        print('   Error: $error');
      }
    }
  }
  
  /// 成功日志
  static void success(String message, [String? tag]) {
    if (kDebugMode) {
      print('✅ [$_tag${tag != null ? ':$tag' : ''}] $message');
    }
  }
  
  /// 网络请求日志
  static void network(String method, String url, [int? statusCode]) {
    if (kDebugMode) {
      final status = statusCode != null ? ' ($statusCode)' : '';
      print('🌐 [$_tag:Network] $method $url$status');
    }
  }
  
  /// 播放器日志
  static void player(String message) {
    debug(message, 'Player');
  }
  
  /// 画中画日志
  static void pip(String message) {
    debug(message, 'PIP');
  }
}