import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'splash_controller.dart';

/// 启动页
/// 显示 Logo、开屏广告、检查更新
class SplashPage extends StatelessWidget {
  const SplashPage({super.key});

  @override
  Widget build(BuildContext context) {
    // 初始化控制器
    final controller = Get.put(SplashController());

    return Directionality(
      textDirection: TextDirection.ltr,
      child: Scaffold(
        backgroundColor: const Color(0xFF121212), // 暗黑背景
        body: Stack(
        children: [
          // Logo 和加载动画
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo
                Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFC107), // 琥珀金
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: const Icon(
                    Icons.play_circle_outline,
                    size: 80,
                    color: Color(0xFF121212),
                  ),
                ),
                const SizedBox(height: 24),
                // APP 名称
                const Text(
                  '拾光影视',
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFFFC107),
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Robin Video',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.white54,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 48),
                // 加载指示器
                Obx(() => controller.showLoading.value
                    ? const CircularProgressIndicator(
                        valueColor: AlwaysStoppedAnimation<Color>(
                          Color(0xFFFFC107),
                        ),
                      )
                    : const SizedBox.shrink()),
              ],
            ),
          ),

          // 开屏广告
          Obx(() {
            if (controller.showAd.value && controller.adImageUrl.value.isNotEmpty) {
              return _buildAdOverlay(controller);
            }
            return const SizedBox.shrink();
          }),
          ],
        ),
      ),
    );
  }

  /// 构建广告覆盖层
  Widget _buildAdOverlay(SplashController controller) {
    return Container(
      color: Colors.black,
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Stack(
        children: [
          // 广告图片
          Positioned.fill(
            child: Image.network(
              controller.adImageUrl.value,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) {
                // 图片加载失败，跳过广告
                controller.skipAd();
                return const SizedBox.shrink();
              },
            ),
          ),

          // 跳过按钮
          Positioned(
            top: 50,
            right: 20,
            child: GestureDetector(
              onTap: controller.skipAd,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Obx(() => Text(
                      '跳过 ${controller.adCountdown.value}s',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                      ),
                    )),
              ),
            ),
          ),

          // 广告点击区域
          Positioned.fill(
            child: GestureDetector(
              onTap: controller.onAdClick,
              child: Container(
                color: Colors.transparent,
              ),
            ),
          ),
          ],
        ),
      ),
    );
  }
}
