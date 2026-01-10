import 'package:flutter/material.dart';
import '../../../core/router.dart';

/// 单图横幅广告组件
/// 用于活动推广、VIP推广等
class Banner extends StatelessWidget {
  final String imageUrl;
  final String? actionUrl;
  final String? actionType;
  final double height;
  final EdgeInsets margin;

  const Banner({
    super.key,
    required this.imageUrl,
    this.actionUrl,
    this.actionType = 'browser',
    this.height = 100,
    this.margin = const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _handleTap,
      child: Container(
        margin: margin,
        height: height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.2),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Stack(
            fit: StackFit.expand,
            children: [
              _buildImage(),
              // 广告标识
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    '广告',
                    style: TextStyle(fontSize: 10, color: Colors.white70),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _handleTap() {
    if (actionUrl == null || actionUrl!.isEmpty) return;
    
    switch (actionType) {
      case 'browser':
        UniversalRouter.handleRoute('browser://$actionUrl');
        break;
      case 'webview':
        UniversalRouter.handleRoute('webview://$actionUrl');
        break;
      case 'deeplink':
        UniversalRouter.handleRoute(actionUrl!);
        break;
      default:
        UniversalRouter.handleRoute('browser://$actionUrl');
    }
  }

  Widget _buildImage() {
    if (imageUrl.isEmpty) {
      return Container(
        color: const Color(0xFF2E2E2E),
        child: const Center(
          child: Icon(Icons.image, size: 40, color: Colors.white24),
        ),
      );
    }

    return Image.network(
      imageUrl,
      fit: BoxFit.cover,
      loadingBuilder: (context, child, loadingProgress) {
        if (loadingProgress == null) return child;
        return Container(
          color: const Color(0xFF2E2E2E),
          child: const Center(
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
            ),
          ),
        );
      },
      errorBuilder: (context, error, stackTrace) {
        return Container(
          color: const Color(0xFF2E2E2E),
          child: const Center(
            child: Icon(Icons.broken_image, size: 40, color: Colors.white24),
          ),
        );
      },
    );
  }
}
