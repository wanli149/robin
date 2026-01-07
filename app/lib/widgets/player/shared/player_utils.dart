import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../core/global_player_manager.dart';

/// 播放器工具类
class PlayerUtils {
  
  /// 检查是否有下一集
  static bool hasNextEpisode(PlayerState state) {
    try {
      // 尝试获取内容控制器
      final controller = Get.find<dynamic>(tag: state.contentId);
      if (controller != null && controller.episodes != null) {
        final episodes = controller.episodes as List;
        return state.episodeIndex < episodes.length;
      }
    } catch (e) {
      print('❌ Failed to check next episode: $e');
    }
    
    // 如果无法获取集数信息，默认允许切换（由播放器内部处理错误）
    return true;
  }

  /// 显示倍速选择器
  static void showSpeedSelector(GlobalPlayerManager manager) {
    Get.bottomSheet(
      Container(
        decoration: const BoxDecoration(
          color: Color(0xFF1E1E1E),
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(16),
            topRight: Radius.circular(16),
          ),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  '播放速度',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
              ...[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((speed) {
                return ListTile(
                  title: Text(
                    '${speed}x',
                    style: const TextStyle(color: Colors.white),
                  ),
                  trailing: manager.currentState.value.playbackSpeed == speed
                      ? const Icon(
                          Icons.check,
                          color: Color(0xFFFFC107),
                        )
                      : null,
                  onTap: () {
                    manager.setPlaybackSpeed(speed);
                    Get.back();
                  },
                );
              }),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  /// 显示选集选择器
  static void showEpisodeSelector(GlobalPlayerManager manager) {
    final state = manager.currentState.value;
    
    try {
      // 获取当前内容的控制器
      final controller = Get.find<dynamic>(tag: state.contentId);
      if (controller == null || controller.episodes == null) {
        Get.snackbar(
          '提示',
          '无法获取集数信息',
          snackPosition: SnackPosition.BOTTOM,
        );
        return;
      }

      final episodes = controller.episodes as List;
      if (episodes.isEmpty) {
        Get.snackbar(
          '提示',
          '暂无可选集数',
          snackPosition: SnackPosition.BOTTOM,
        );
        return;
      }

      Get.bottomSheet(
        Container(
          decoration: const BoxDecoration(
            color: Color(0xFF1E1E1E),
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(16),
              topRight: Radius.circular(16),
            ),
          ),
          child: SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text(
                    '选择集数',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
                Container(
                  constraints: const BoxConstraints(maxHeight: 300),
                  child: GridView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    shrinkWrap: true,
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 4,
                      mainAxisSpacing: 8,
                      crossAxisSpacing: 8,
                      childAspectRatio: 2,
                    ),
                    itemCount: episodes.length,
                    itemBuilder: (context, index) {
                      final isSelected = state.episodeIndex == index + 1;
                      return GestureDetector(
                        onTap: () {
                          Get.back();
                          manager.switchEpisode(index + 1);
                        },
                        child: Container(
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: isSelected
                                ? const Color(0xFFFFC107)
                                : const Color(0xFF2E2E2E),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            '第${index + 1}集',
                            style: TextStyle(
                              color: isSelected ? Colors.black : Colors.white,
                              fontSize: 12,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      );
    } catch (e) {
      print('❌ Failed to show episode selector: $e');
      Get.snackbar(
        '提示',
        '选集功能暂时不可用',
        snackPosition: SnackPosition.BOTTOM,
      );
    }
  }

  /// 显示投屏对话框
  static void showCastDialog() {
    Get.bottomSheet(
      Container(
        decoration: const BoxDecoration(
          color: Color(0xFF1E1E1E),
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(16),
            topRight: Radius.circular(16),
          ),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  '投屏设备',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
              ListTile(
                leading: const Icon(
                  Icons.search,
                  color: Colors.white54,
                ),
                title: const Text(
                  '搜索设备中...',
                  style: TextStyle(color: Colors.white54),
                ),
                subtitle: const Text(
                  '请确保设备在同一WiFi网络下',
                  style: TextStyle(color: Colors.white38, fontSize: 12),
                ),
              ),
              ListTile(
                leading: const Icon(
                  Icons.info_outline,
                  color: Colors.white54,
                ),
                title: const Text(
                  '投屏功能开发中',
                  style: TextStyle(color: Colors.white54),
                ),
                subtitle: const Text(
                  '敬请期待后续版本',
                  style: TextStyle(color: Colors.white38, fontSize: 12),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  /// 处理前进操作
  static void handleForwardTap(GlobalPlayerManager manager) {
    final state = manager.currentState.value;
    switch (state.contentType) {
      case ContentType.shorts:
      case ContentType.tv:
        // 检查是否有下一集
        if (hasNextEpisode(state)) {
          manager.switchEpisode(state.episodeIndex + 1);
        } else {
          Get.snackbar(
            '提示',
            '已经是最后一集了',
            snackPosition: SnackPosition.BOTTOM,
            duration: const Duration(seconds: 1),
          );
        }
        break;
      default:
        final newPosition = state.position + const Duration(seconds: 10);
        manager.seekTo(newPosition > state.duration ? state.duration : newPosition);
        break;
    }
  }

  /// 处理后退操作
  static void handleBackwardTap(GlobalPlayerManager manager) {
    final state = manager.currentState.value;
    switch (state.contentType) {
      case ContentType.shorts:
      case ContentType.tv:
        if (state.episodeIndex > 1) {
          manager.switchEpisode(state.episodeIndex - 1);
        } else {
          Get.snackbar(
            '提示',
            '已经是第一集了',
            snackPosition: SnackPosition.BOTTOM,
            duration: const Duration(seconds: 1),
          );
        }
        break;
      default:
        final newPosition = state.position - const Duration(seconds: 10);
        manager.seekTo(newPosition.isNegative ? Duration.zero : newPosition);
        break;
    }
  }

  /// 处理滑动换集
  static void handleSwipeUp(GlobalPlayerManager manager, PlayerState state) {
    switch (state.contentType) {
      case ContentType.shorts:
        // 短剧全屏模式：播放下一集
        if (hasNextEpisode(state)) {
          manager.switchEpisode(state.episodeIndex + 1);
        } else {
          Get.snackbar(
            '提示',
            '已经是最后一集了',
            snackPosition: SnackPosition.BOTTOM,
            duration: const Duration(seconds: 1),
          );
        }
        break;
      case ContentType.shortsFlow:
        // 短剧流：通知短剧控制器切换下一个
        try {
          final shortsController = Get.find<dynamic>(); // ShortsController
          final currentIndex = shortsController.currentIndex.value;
          shortsController.switchToIndex(currentIndex + 1);
        } catch (e) {
          print('❌ Failed to switch to next shorts: $e');
        }
        break;
      default:
        // 电视剧/电影：不支持滑动换集
        break;
    }
  }

  /// 处理向下滑动
  static void handleSwipeDown(GlobalPlayerManager manager, PlayerState state) {
    switch (state.contentType) {
      case ContentType.shorts:
        // 短剧全屏模式：播放上一集
        if (state.episodeIndex > 1) {
          manager.switchEpisode(state.episodeIndex - 1);
        } else {
          Get.snackbar(
            '提示',
            '已经是第一集了',
            snackPosition: SnackPosition.BOTTOM,
            duration: const Duration(seconds: 1),
          );
        }
        break;
      case ContentType.shortsFlow:
        // 短剧流：通知短剧控制器切换上一个
        try {
          final shortsController = Get.find<dynamic>(); // ShortsController
          final currentIndex = shortsController.currentIndex.value;
          if (currentIndex > 0) {
            shortsController.switchToIndex(currentIndex - 1);
          }
        } catch (e) {
          print('❌ Failed to switch to previous shorts: $e');
        }
        break;
      default:
        // 电视剧/电影：不支持滑动换集
        break;
    }
  }
}