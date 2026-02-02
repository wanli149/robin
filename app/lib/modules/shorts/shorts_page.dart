import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'shorts_controller.dart';
import 'widgets/shorts_video_item.dart';
import '../root/root_controller.dart';
import '../../core/player/global_player_manager.dart';
import '../../core/logger.dart';

/// 短剧页面
/// 竖屏全屏滑动播放短剧
class ShortsPage extends StatefulWidget {
  const ShortsPage({super.key});

  @override
  State<ShortsPage> createState() => _ShortsPageState();
}

class _ShortsPageState extends State<ShortsPage> with AutomaticKeepAliveClientMixin, WidgetsBindingObserver {
  late ShortsController controller;
  bool _isPageVisible = false;
  Worker? _indexWorker; // 保存 ever() 返回的 Worker 以便 dispose

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    controller = Get.put(ShortsController());
    
    // 添加应用生命周期监听
    WidgetsBinding.instance.addObserver(this);
    
    // 延迟监听根页面的切换，确保RootController已经初始化
    Future.delayed(const Duration(milliseconds: 100), () {
      if (!mounted) return; // 防止页面已销毁时继续执行
      
      try {
        final rootController = Get.find<RootController>();
        _isPageVisible = rootController.currentIndex.value == 2;
        
        _indexWorker = ever(rootController.currentIndex, (index) {
          if (!mounted) return; // 防止回调在页面销毁后执行
          
          final wasVisible = _isPageVisible;
          _isPageVisible = index == 2; // 短剧页面是第3个tab (index=2)
          
          if (_isPageVisible && !wasVisible) {
            // 🚀 页面变为可见时，允许播放并恢复当前视频
            GlobalPlayerManager.to.setPlayPermission(true);
            controller.resumeCurrentVideo();
          } else if (!_isPageVisible && wasVisible) {
            // 🚀 页面变为不可见时，禁止播放并暂停所有视频
            GlobalPlayerManager.to.setPlayPermission(false);
            controller.pauseAllVideos();
            // 🚀 清除临时播放进度（用户切换到其他导航）
            controller.clearTempProgress();
          }
          
          // 强制刷新UI以更新isActive状态
          if (mounted) {
            setState(() {});
          }
        });
      } catch (e) {
        // 找不到RootController，说明不是在根页面中使用
        // 如果找不到RootController，说明不是在根页面中使用
        _isPageVisible = true;
      }
    });
  }

  @override
  void dispose() {
    // 取消 ever() 监听
    _indexWorker?.dispose();
    _indexWorker = null;
    
    // 移除应用生命周期监听
    WidgetsBinding.instance.removeObserver(this);
    // 页面销毁时暂停所有视频
    controller.pauseAllVideos();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    
    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
        // 🚀 应用进入后台时，禁止播放并暂停
        Logger.player('[ShortsPage] App paused, disabling play permission');
        GlobalPlayerManager.to.setPlayPermission(false);
        controller.pauseAllVideos();
        break;
      case AppLifecycleState.resumed:
        // 🚀 应用回到前台时，如果页面可见则允许播放并恢复
        if (_isPageVisible) {
          Logger.player('[ShortsPage] App resumed, enabling play permission');
          GlobalPlayerManager.to.setPlayPermission(true);
          controller.resumeCurrentVideo();
        } else {
          Logger.player('[ShortsPage] App resumed but page not visible, keeping play disabled');
        }
        break;
      default:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    return Scaffold(
      backgroundColor: Colors.black,
      // 🚀 移除 SafeArea，实现全屏沉浸式体验
      body: Obx(() {
        // 加载中
        if (controller.isLoading.value && controller.shortsList.isEmpty) {
          return const Center(
            child: CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
            ),
          );
        }

        // 错误状态
        if (controller.error.value.isNotEmpty && controller.shortsList.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.error_outline,
                  size: 64,
                  color: Colors.white38,
                ),
                const SizedBox(height: 16),
                Text(
                  controller.error.value,
                  style: const TextStyle(
                    color: Colors.white54,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: controller.refresh,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFFC107),
                  ),
                  child: const Text('重试'),
                ),
              ],
            ),
          );
        }

        // 短剧列表为空
        if (controller.shortsList.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.play_circle_outline,
                  size: 80,
                  color: Colors.white38,
                ),
                const SizedBox(height: 16),
                const Text(
                  '暂无短剧',
                  style: TextStyle(
                    color: Colors.white54,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: controller.refresh,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFFC107),
                  ),
                  child: const Text('刷新'),
                ),
              ],
            ),
          );
        }

        // 短剧列表
        return PageView.builder(
          scrollDirection: Axis.vertical,
          itemCount: controller.shortsList.length,
          onPageChanged: controller.switchToIndex,
          itemBuilder: (context, index) {
            final short = controller.shortsList[index];
            return Obx(() => ShortsVideoItem(
              shortData: short,
              isActive: controller.currentIndex.value == index && _isPageVisible,
            ));
          },
        );
      }),
    );
  }
}
