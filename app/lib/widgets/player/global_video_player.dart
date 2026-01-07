import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../core/global_player_manager.dart';
import 'shorts_flow_player.dart';
import 'shorts_detail_player.dart';
import 'long_video_player.dart';

/// 全局视频播放器UI组件 - 智能路由播放器
/// 根据内容类型和播放模式智能选择对应的专用播放器UI
/// 
/// 设计原则：
/// 1. 单一播放器实例：所有UI组件共享GlobalPlayerManager中的同一个VideoPlayerController
/// 2. 专用UI组件：每种内容类型使用专门优化的UI组件
/// 3. 智能路由：根据内容类型自动选择最适合的播放器UI
/// 4. 无状态设计：本组件只负责路由，不管理播放器状态
class GlobalVideoPlayer extends StatelessWidget {
  final bool showControls;
  final VoidCallback? onTap;
  final Widget? overlay;

  const GlobalVideoPlayer({
    super.key,
    this.showControls = true,
    this.onTap,
    this.overlay,
  });

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final manager = GlobalPlayerManager.to;
      final contentType = manager.currentState.value.contentType;
      
      // 根据内容类型和播放模式智能选择播放器UI
      switch (contentType) {
        case ContentType.shortsFlow:
          // 短剧流：竖屏填充播放，无控制栏，支持滑动切换
          return ShortsFlowPlayer(
            showControls: showControls,
            onTap: onTap,
            overlay: overlay,
          );
          
        case ContentType.shorts:
          // 短剧详情：支持窗口模式（横屏16:9）和全屏模式（竖屏填充+滑动换集）
          return ShortsDetailPlayer(
            showControls: showControls,
            onTap: onTap,
            overlay: overlay,
          );
          
        case ContentType.tv:
        case ContentType.movie:
          // 电视剧/电影：横屏AspectRatio播放，完整控制栏
          return LongVideoPlayer(
            showControls: showControls,
            onTap: onTap,
            overlay: overlay,
          );
        
        default:
          // 默认显示黑色背景，避免任何意外的显示
          return Container(
            color: Colors.black,
            child: const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
              ),
            ),
          );
      }
    });
  }
}

/// 播放器路由信息（用于调试和监控）
class PlayerRouteInfo {
  static String getCurrentRoute() {
    final manager = GlobalPlayerManager.to;
    final contentType = manager.currentState.value.contentType;
    final playerMode = manager.playerMode.value;
    
    switch (contentType) {
      case ContentType.shortsFlow:
        return 'ShortsFlowPlayer';
      case ContentType.shorts:
        return playerMode == PlayerMode.fullscreen 
            ? 'ShortsDetailPlayer(Fullscreen)' 
            : 'ShortsDetailPlayer(Window)';
      case ContentType.tv:
        switch (playerMode) {
          case PlayerMode.fullscreen:
            return 'LongVideoPlayer(Fullscreen)';
          case PlayerMode.pip:
            return 'LongVideoPlayer(PIP)';
          default:
            return 'LongVideoPlayer(Window)';
        }
      case ContentType.movie:
        switch (playerMode) {
          case PlayerMode.fullscreen:
            return 'LongVideoPlayer(Fullscreen)';
          case PlayerMode.pip:
            return 'LongVideoPlayer(PIP)';
          default:
            return 'LongVideoPlayer(Window)';
        }
    }
  }
  
  static void logRouteChange() {
    print('🎬 [PlayerRouter] Current route: ${getCurrentRoute()}');
  }
}