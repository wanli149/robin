import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'home_controller.dart';
import 'widgets/marquee_bar.dart';
import 'dynamic_renderer.dart';

/// 首页
/// 支持动态渲染、频道切换、下拉刷新
class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    // 使用 lazyPut 避免重复创建控制器
    Get.lazyPut(() => HomeController());
    final controller = Get.find<HomeController>();

    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      body: SafeArea(
        child: Column(
          children: [
            // 顶部：Logo + 搜索框
            _buildHeader(controller),

            // 频道栏
            _buildChannelTabs(controller),

            // 内容区域
            Expanded(
              child: _buildContentWrapper(controller),
            ),
          ],
        ),
      ),
    );
  }

  /// 内容包装器（使用 Obx）
  Widget _buildContentWrapper(HomeController controller) {
    return Obx(() => _buildContent(controller));
  }

  /// 构建顶部 Header
  Widget _buildHeader(HomeController controller) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          // Logo
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFFFC107),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.play_circle_outline,
              color: Color(0xFF121212),
              size: 24,
            ),
          ),
          const SizedBox(width: 12),
          const Text(
            '拾光影视',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Color(0xFFFFC107),
            ),
          ),
          const Spacer(),
          // 搜索框
          GestureDetector(
            onTap: () => Get.toNamed('/search'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF1E1E1E),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Row(
                children: [
                  Icon(
                    Icons.search,
                    color: Colors.white54,
                    size: 20,
                  ),
                  SizedBox(width: 8),
                  Text(
                    '搜索影片',
                    style: TextStyle(
                      color: Colors.white54,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 构建频道 Tab
  Widget _buildChannelTabs(HomeController controller) {
    return Container(
      height: 48,
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: Color(0xFF2E2E2E),
            width: 0.5,
          ),
        ),
      ),
      child: Obx(() {
        final currentIndex = controller.currentChannelIndex.value;
        
        return ListView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 8),
          itemCount: controller.channels.length,
          itemBuilder: (context, index) {
            final channel = controller.channels[index];
            final isSelected = currentIndex == index;

            return GestureDetector(
              onTap: () => controller.switchChannel(index),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                alignment: Alignment.center,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      channel['name'] ?? '',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        color: isSelected
                            ? const Color(0xFFFFC107)
                            : Colors.white70,
                      ),
                    ),
                    const SizedBox(height: 4),
                    if (isSelected)
                      Container(
                        width: 20,
                        height: 3,
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFC107),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                  ],
                ),
              ),
            );
          },
        );
      }),
    );
  }

  /// 构建内容区域
  Widget _buildContent(HomeController controller) {
    // 直接在这里读取所有响应式变量，因为这个方法已经在 Obx 内部了
    if (controller.isLoading.value) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
        ),
      );
    }

    if (controller.error.value.isNotEmpty) {
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
              onPressed: controller.refreshCurrentChannel,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFFC107),
              ),
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: controller.refreshCurrentChannel,
      color: const Color(0xFFFFC107),
      child: ListView(
        padding: const EdgeInsets.only(bottom: 16),
        children: [
          // 跑马灯通告
          if (controller.marqueeText.value.isNotEmpty)
            MarqueeBar(
              text: controller.marqueeText.value,
              link: controller.marqueeLink.value,
            ),

          // 动态模块列表
          for (var module in controller.modules)
            _buildModule(module),
        ],
      ),
    );
  }

  /// 构建模块
  Widget _buildModule(Map<String, dynamic> module) {
    // 验证模块数据
    if (!DynamicRenderer.validateModule(module)) {
      return const SizedBox.shrink();
    }

    // 解析模块数据
    final parsedModule = DynamicRenderer.parseModuleData(module);

    // 使用动态渲染引擎渲染模块
    return DynamicRenderer.renderModule(parsedModule);
  }
}
