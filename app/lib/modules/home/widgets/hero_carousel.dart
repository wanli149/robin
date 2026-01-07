import 'package:flutter/material.dart';

import 'dart:async';
import '../../../core/router.dart';

/// 轮播图组件
/// 支持自动播放、手动滑动、点击跳转、自适应高度
class HeroCarousel extends StatefulWidget {
  final List<Map<String, dynamic>> items;
  final double height;
  final Duration autoPlayDuration;
  final bool autoPlay;
  final double aspectRatio; // 宽高比，用于自适应

  const HeroCarousel({
    super.key,
    required this.items,
    this.height = 200,
    this.autoPlayDuration = const Duration(seconds: 5),
    this.autoPlay = true,
    this.aspectRatio = 16 / 9, // 默认16:9宽高比
  });

  @override
  State<HeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends State<HeroCarousel> {
  late PageController _pageController;
  int _currentPage = 0;
  Timer? _autoPlayTimer;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: 0);
    
    if (widget.autoPlay && widget.items.length > 1) {
      _startAutoPlay();
    }
  }

  @override
  void dispose() {
    _autoPlayTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  /// 启动自动播放
  void _startAutoPlay() {
    _autoPlayTimer?.cancel();
    _autoPlayTimer = Timer.periodic(widget.autoPlayDuration, (timer) {
      if (!mounted) return;
      
      final nextPage = (_currentPage + 1) % widget.items.length;
      _pageController.animateToPage(
        nextPage,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    });
  }

  /// 停止自动播放
  void _stopAutoPlay() {
    _autoPlayTimer?.cancel();
  }

  /// 处理页面变化
  void _onPageChanged(int page) {
    setState(() {
      _currentPage = page;
    });
  }

  /// 处理点击事件
  void _onItemTap(Map<String, dynamic> item) {
    final jumpAction = item['jump_action'] as String?;
    if (jumpAction != null && jumpAction.isNotEmpty) {
      UniversalRouter.handleRoute(jumpAction);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) {
      return const SizedBox.shrink();
    }

    // 计算自适应高度：使用屏幕宽度和宽高比
    final screenWidth = MediaQuery.of(context).size.width;
    final horizontalPadding = 32.0; // 左右各16的margin
    final contentWidth = screenWidth - horizontalPadding;
    final adaptiveHeight = contentWidth / widget.aspectRatio;
    // 使用自适应高度，但不超过指定的最大高度
    final finalHeight = adaptiveHeight.clamp(150.0, widget.height);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        children: [
          // 轮播图主体
          GestureDetector(
            onTapDown: (_) => _stopAutoPlay(),
            onTapUp: (_) => _startAutoPlay(),
            onTapCancel: () => _startAutoPlay(),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                height: finalHeight,
                child: PageView.builder(
                  controller: _pageController,
                  onPageChanged: _onPageChanged,
                  itemCount: widget.items.length,
                  itemBuilder: (context, index) {
                    return _buildCarouselItem(widget.items[index]);
                  },
                ),
              ),
            ),
          ),

          // 指示器
          if (widget.items.length > 1)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: _buildIndicator(),
            ),
        ],
      ),
    );
  }

  /// 构建轮播项
  Widget _buildCarouselItem(Map<String, dynamic> item) {
    final imageUrl = item['image_url'] as String? ?? '';
    final title = item['title'] as String? ?? '';

    return GestureDetector(
      onTap: () => _onItemTap(item),
      child: Stack(
        fit: StackFit.expand,
        children: [
          // 背景图片
          _buildImage(imageUrl),

          // 渐变遮罩
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.transparent,
                  Colors.black.withOpacity(0.7),
                ],
                stops: const [0.5, 1.0],
              ),
            ),
          ),

          // 标题
          if (title.isNotEmpty)
            Positioned(
              left: 16,
              right: 16,
              bottom: 16,
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                  shadows: [
                    Shadow(
                      offset: Offset(0, 1),
                      blurRadius: 4,
                      color: Colors.black54,
                    ),
                  ],
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
        ],
      ),
    );
  }

  /// 构建图片
  Widget _buildImage(String imageUrl) {
    if (imageUrl.isEmpty) {
      return Container(
        color: const Color(0xFF2E2E2E),
        child: const Center(
          child: Icon(
            Icons.image_not_supported,
            size: 48,
            color: Colors.white24,
          ),
        ),
      );
    }

    return Image.network(
      imageUrl,
      fit: BoxFit.cover, // 填充并裁剪，保持比例
      width: double.infinity,
      height: double.infinity,
      alignment: Alignment.center, // 居中对齐
      // 启用图片缓存
      cacheWidth: 800, // 限制缓存宽度，减少内存占用
      loadingBuilder: (context, child, loadingProgress) {
        if (loadingProgress == null) return child;
        
        return Container(
          color: const Color(0xFF2E2E2E),
          child: Center(
            child: CircularProgressIndicator(
              value: loadingProgress.expectedTotalBytes != null
                  ? loadingProgress.cumulativeBytesLoaded /
                      loadingProgress.expectedTotalBytes!
                  : null,
              strokeWidth: 2,
              valueColor: const AlwaysStoppedAnimation<Color>(
                Color(0xFFFFC107),
              ),
            ),
          ),
        );
      },
      errorBuilder: (context, error, stackTrace) {
        print('❌ Carousel image load error: $error');
        return Container(
          color: const Color(0xFF2E2E2E),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.broken_image,
                size: 48,
                color: Colors.white24,
              ),
              const SizedBox(height: 8),
              Text(
                '图片加载失败',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.white.withOpacity(0.3),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  /// 构建指示器
  Widget _buildIndicator() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(
        widget.items.length,
        (index) => Container(
          width: _currentPage == index ? 24 : 8,
          height: 8,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          decoration: BoxDecoration(
            color: _currentPage == index
                ? const Color(0xFFFFC107)
                : Colors.white24,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
      ),
    );
  }
}
