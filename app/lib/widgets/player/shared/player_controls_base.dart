import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../core/global_player_manager.dart';
import '../../../core/player/player_state.dart' show AppPlayerState;

/// 播放器控制组件基类
/// 提供通用的控制按钮和工具方法
abstract class PlayerControlsBase {
  
  /// 构建控制按钮
  static Widget buildControlButton({
    required IconData icon,
    required VoidCallback onTap,
    double size = 48,
    Color? backgroundColor,
    Color? iconColor,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: backgroundColor ?? Colors.black.withValues(alpha: 0.5),
          shape: BoxShape.circle,
        ),
        child: Icon(
          icon,
          color: iconColor ?? Colors.white,
          size: size * 0.6,
        ),
      ),
    );
  }

  /// 构建底部按钮
  static Widget buildBottomButton({
    required String label,
    required VoidCallback onTap,
    Color? backgroundColor,
    Color? textColor,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: backgroundColor ?? Colors.white24,
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: textColor ?? Colors.white,
            fontSize: 12,
          ),
        ),
      ),
    );
  }

  /// 构建渐变背景
  static Widget buildGradientBackground({
    required Widget child,
    bool isTop = false,
  }) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: isTop ? Alignment.topCenter : Alignment.bottomCenter,
          end: isTop ? Alignment.bottomCenter : Alignment.topCenter,
          colors: [
            Colors.black.withValues(alpha: 0.7),
            Colors.transparent,
          ],
        ),
      ),
      child: child,
    );
  }

  /// 获取内容类型对应的标题
  static String getTitle(AppPlayerState state) {
    final name = state.contentName.isNotEmpty ? state.contentName : '未知视频';
    
    switch (state.contentType) {
      case ContentType.shorts:
        return '$name - 第${state.episodeIndex}集';
      case ContentType.tv:
        return '$name - 第${state.episodeIndex}集';
      case ContentType.movie:
        return name;
      case ContentType.shortsFlow:
        return name;
    }
  }

  /// 获取后退图标
  static IconData getBackwardIcon(ContentType contentType) {
    switch (contentType) {
      case ContentType.shorts:
      case ContentType.tv:
        return Icons.skip_previous;
      default:
        return Icons.replay_10;
    }
  }

  /// 获取前进图标
  static IconData getForwardIcon(ContentType contentType) {
    switch (contentType) {
      case ContentType.shorts:
      case ContentType.tv:
        return Icons.skip_next;
      default:
        return Icons.forward_10;
    }
  }

  /// 检查是否应该显示选集按钮
  static bool shouldShowEpisodeButton(ContentType contentType) {
    return contentType == ContentType.shorts || contentType == ContentType.tv;
  }

  /// 获取选集标签
  static String getEpisodeLabel(int episodeIndex) {
    return '第$episodeIndex集';
  }

  /// 处理返回按钮
  static void handleBackButton(GlobalPlayerManager manager) {
    if (manager.playerMode.value == PlayerMode.fullscreen) {
      // 全屏模式：退出全屏，不返回页面
      manager.exitFullscreen();
    } else {
      // 窗口模式：返回上一页
      Get.back();
    }
  }

  /// 切换全屏
  static void toggleFullscreen(GlobalPlayerManager manager) {
    if (manager.playerMode.value == PlayerMode.fullscreen) {
      manager.exitFullscreen();
    } else {
      manager.enterFullscreen();
    }
  }
}
