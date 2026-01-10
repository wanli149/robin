import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../home/home_page.dart';
import '../library/library_page.dart';
import '../profile/profile_page.dart';
import '../shorts/shorts_page.dart';
import '../../core/global_player_manager.dart';
import '../../core/logger.dart';

/// 根容器控制器
/// 管理底部导航栏的 Tab 切换
class RootController extends GetxController {
  // 当前选中的 Tab 索引
  final RxInt currentIndex = 0.obs;
  
  // 短剧页面索引
  static const int shortsTabIndex = 2;

  // 页面列表
  final List<Widget> pages = [
    const HomePage(), // 首页
    const LibraryPage(), // 片库
    const ShortsPage(), // 短剧
    const ProfilePage(), // 我的
  ];

  /// 切换页面
  void changePage(int index) {
    // final previousIndex = currentIndex.value; // 暂未使用
    currentIndex.value = index;
    
    // 🚀 管理播放许可：只在短剧页面允许播放
    if (index == shortsTabIndex) {
      // 切换到短剧页面，允许播放
      Logger.player('[RootController] Switched to shorts tab, enabling play permission');
      GlobalPlayerManager.to.setPlayPermission(true);
    } else {
      // 切换到其他页面，禁止播放
      Logger.player('[RootController] Switched away from shorts tab, disabling play permission');
      GlobalPlayerManager.to.setPlayPermission(false);
      _pauseGlobalPlayer();
    }
  }

  /// 跳转到指定 Tab
  void jumpToTab(int index) {
    if (index >= 0 && index < pages.length) {
      changePage(index);
    }
  }
  
  /// 🚀 暂停全局播放器
  void _pauseGlobalPlayer() {
    try {
      // 只有当播放器正在播放短剧流时才暂停
      final playerManager = GlobalPlayerManager.to;
      if (playerManager.currentState.value.contentType == ContentType.shortsFlow) {
        playerManager.pause();
        Logger.player('[RootController] Paused shorts flow player on tab change');
      }
    } catch (e) {
      Logger.error('[RootController] Failed to pause player: $e');
    }
  }
}
