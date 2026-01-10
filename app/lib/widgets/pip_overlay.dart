import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../core/pip_manager.dart';

/// 画中画覆盖层
/// 在应用顶层显示小窗播放器，支持拖拽移动
class PipOverlay extends StatefulWidget {
  const PipOverlay({super.key});

  @override
  State<PipOverlay> createState() => _PipOverlayState();
}

class _PipOverlayState extends State<PipOverlay> {
  // PIP 窗口位置
  double _posX = 16;
  double _posY = 100;
  
  // 窗口尺寸
  static const double _pipWidth = 160;
  static const double _pipHeight = 90;
  
  // 是否正在拖拽
  bool _isDragging = false;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final pipManager = PipManager.to;
      
      if (!pipManager.isInPipMode.value || pipManager.currentPlayerWidget == null) {
        return const SizedBox.shrink();
      }

      // 获取屏幕尺寸
      final screenSize = MediaQuery.of(context).size;
      final safeArea = MediaQuery.of(context).padding;
      
      // 确保位置在屏幕范围内
      _posX = _posX.clamp(8, screenSize.width - _pipWidth - 8);
      _posY = _posY.clamp(safeArea.top + 8, screenSize.height - _pipHeight - safeArea.bottom - 8);

      return Positioned(
        left: _posX,
        top: _posY,
        child: _buildPipWindow(context, pipManager, screenSize, safeArea),
      );
    });
  }

  /// 构建画中画窗口
  Widget _buildPipWindow(BuildContext context, PipManager pipManager, Size screenSize, EdgeInsets safeArea) {
    return GestureDetector(
      onPanStart: (details) {
        setState(() {
          _isDragging = true;
        });
      },
      onPanUpdate: (details) {
        setState(() {
          _posX += details.delta.dx;
          _posY += details.delta.dy;
          
          // 限制在屏幕范围内
          _posX = _posX.clamp(8, screenSize.width - _pipWidth - 8);
          _posY = _posY.clamp(safeArea.top + 8, screenSize.height - _pipHeight - safeArea.bottom - 8);
        });
      },
      onPanEnd: (details) {
        setState(() {
          _isDragging = false;
        });
        
        // 自动吸附到边缘
        _snapToEdge(screenSize);
      },
      onTap: () {
        // 点击画中画窗口返回原页面
        _returnToOriginalPage();
      },
      child: AnimatedContainer(
        duration: _isDragging ? Duration.zero : const Duration(milliseconds: 200),
        width: _pipWidth,
        height: _pipHeight,
        decoration: BoxDecoration(
          color: Colors.black,
          borderRadius: BorderRadius.circular(8),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: _isDragging ? 0.7 : 0.5),
              blurRadius: _isDragging ? 12 : 8,
              offset: const Offset(0, 4),
            ),
          ],
          border: _isDragging
              ? Border.all(color: const Color(0xFFFFC107), width: 2)
              : null,
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
                    color: Colors.black.withValues(alpha: 0.7),
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
            
            // 拖拽提示（拖拽时显示）
            if (_isDragging)
              Positioned(
                bottom: 4,
                right: 4,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.7),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Icon(
                    Icons.open_with,
                    color: Color(0xFFFFC107),
                    size: 12,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// 自动吸附到边缘
  void _snapToEdge(Size screenSize) {
    final centerX = _posX + _pipWidth / 2;
    final screenCenterX = screenSize.width / 2;
    
    setState(() {
      // 吸附到左边或右边
      if (centerX < screenCenterX) {
        _posX = 8; // 吸附到左边
      } else {
        _posX = screenSize.width - _pipWidth - 8; // 吸附到右边
      }
    });
  }

  /// 返回原页面
  void _returnToOriginalPage() {
    // 退出画中画模式，返回原播放页面
    PipManager.to.exitPipMode();
    // 这里可以添加导航逻辑，返回到播放器所在的页面
  }
}