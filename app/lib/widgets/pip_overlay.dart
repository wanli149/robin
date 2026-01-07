import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../core/pip_manager.dart';

/// 画中画覆盖层
/// 在应用顶层显示小窗播放器
class PipOverlay extends StatelessWidget {
  const PipOverlay({super.key});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final pipManager = PipManager.to;
      
      if (!pipManager.isInPipMode.value || pipManager.currentPlayerWidget == null) {
        return const SizedBox.shrink();
      }

      return Positioned(
        top: MediaQuery.of(context).padding.top + 16,
        right: 16,
        child: _buildPipWindow(context, pipManager),
      );
    });
  }

  /// 构建画中画窗口
  Widget _buildPipWindow(BuildContext context, PipManager pipManager) {
    return GestureDetector(
      onPanUpdate: (details) {
        // TODO: 实现拖拽功能
      },
      onTap: () {
        // 点击画中画窗口返回原页面
        _returnToOriginalPage();
      },
      child: Container(
        width: 160,
        height: 90,
        decoration: BoxDecoration(
          color: Colors.black,
          borderRadius: BorderRadius.circular(8),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.5),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Stack(
          children: [
            // 播放器内容
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: pipManager.currentPlayerWidget!,
            ),

            // 关闭按钮
            Positioned(
              top: 4,
              right: 4,
              child: GestureDetector(
                onTap: () {
                  pipManager.exitPipMode();
                },
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.7),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.close,
                    color: Colors.white,
                    size: 16,
                  ),
                ),
              ),
            ),

            // 播放状态指示器
            const Positioned(
              bottom: 4,
              left: 4,
              child: Icon(
                Icons.play_arrow,
                color: Colors.white,
                size: 16,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 返回原页面
  void _returnToOriginalPage() {
    // 退出画中画模式，返回原播放页面
    PipManager.to.exitPipMode();
    // 这里可以添加导航逻辑，返回到播放器所在的页面
  }
}