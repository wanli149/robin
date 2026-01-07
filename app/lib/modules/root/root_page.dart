import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'root_controller.dart';

/// 根容器页面
/// 包含底部导航栏和 4 个 Tab：首页、片库、短剧、我的
class RootPage extends StatelessWidget {
  const RootPage({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = Get.put(RootController());

    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      body: Obx(() => IndexedStack(
            index: controller.currentIndex.value,
            children: controller.pages,
          )),
      bottomNavigationBar: Obx(() => _buildBottomNavigationBar(controller)),
    );
  }

  /// 构建底部导航栏（磨砂玻璃效果）
  Widget _buildBottomNavigationBar(RootController controller) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFF1E1E1E).withOpacity(0.8),
            border: const Border(
              top: BorderSide(
                color: Color(0xFF2E2E2E),
                width: 0.5,
              ),
            ),
          ),
          child: BottomNavigationBar(
            currentIndex: controller.currentIndex.value,
            onTap: controller.changePage,
            type: BottomNavigationBarType.fixed,
            backgroundColor: Colors.transparent,
            selectedItemColor: const Color(0xFFFFC107), // 琥珀金
            unselectedItemColor: Colors.white54,
            selectedFontSize: 12,
            unselectedFontSize: 12,
            elevation: 0,
            items: const [
              BottomNavigationBarItem(
                icon: Icon(Icons.home_outlined),
                activeIcon: Icon(Icons.home),
                label: '首页',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.video_library_outlined),
                activeIcon: Icon(Icons.video_library),
                label: '片库',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.play_circle_outline),
                activeIcon: Icon(Icons.play_circle),
                label: '短剧',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.person_outline),
                activeIcon: Icon(Icons.person),
                label: '我的',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
