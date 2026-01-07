import 'package:flutter/material.dart';

/// 骨架屏组件
/// 提供流光动画效果的加载占位符
class Skeleton extends StatefulWidget {
  final double? width;
  final double? height;
  final BorderRadius? borderRadius;
  final Color? baseColor;
  final Color? highlightColor;

  const Skeleton({
    super.key,
    this.width,
    this.height,
    this.borderRadius,
    this.baseColor,
    this.highlightColor,
  });

  /// 创建矩形骨架屏
  const Skeleton.rectangle({
    super.key,
    this.width,
    this.height,
    this.borderRadius,
    this.baseColor,
    this.highlightColor,
  });

  /// 创建圆形骨架屏
  const Skeleton.circle({
    super.key,
    required double size,
    this.baseColor,
    this.highlightColor,
  })  : width = size,
        height = size,
        borderRadius = null;

  /// 创建文本骨架屏
  const Skeleton.text({
    super.key,
    this.width,
    double? fontSize,
    this.baseColor,
    this.highlightColor,
  })  : height = fontSize ?? 14,
        borderRadius = null;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();

    _animation = Tween<double>(begin: -1.0, end: 2.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: Curves.easeInOut,
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final baseColor = widget.baseColor ?? const Color(0xFF2A2A2A);
    final highlightColor =
        widget.highlightColor ?? const Color(0xFF3A3A3A);

    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: widget.borderRadius ??
                (widget.width == widget.height
                    ? BorderRadius.circular(widget.width! / 2)
                    : BorderRadius.circular(4)),
            gradient: LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: [
                baseColor,
                highlightColor,
                baseColor,
              ],
              stops: [
                _animation.value - 0.3,
                _animation.value,
                _animation.value + 0.3,
              ].map((e) => e.clamp(0.0, 1.0)).toList(),
            ),
          ),
        );
      },
    );
  }
}

/// 视频卡片骨架屏
class VideoCardSkeleton extends StatelessWidget {
  final double? width;
  final double aspectRatio;

  const VideoCardSkeleton({
    super.key,
    this.width,
    this.aspectRatio = 0.75,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      padding: const EdgeInsets.all(8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 封面图
          AspectRatio(
            aspectRatio: aspectRatio,
            child: const Skeleton.rectangle(
              borderRadius: BorderRadius.all(Radius.circular(8)),
            ),
          ),
          const SizedBox(height: 8),
          // 标题
          const Skeleton.text(width: double.infinity),
          const SizedBox(height: 4),
          // 副标题
          const Skeleton.text(width: 120),
        ],
      ),
    );
  }
}

/// 列表项骨架屏
class ListItemSkeleton extends StatelessWidget {
  final bool showAvatar;
  final int lineCount;

  const ListItemSkeleton({
    super.key,
    this.showAvatar = true,
    this.lineCount = 2,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (showAvatar) ...[
            const Skeleton.circle(size: 48),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Skeleton.text(width: double.infinity),
                const SizedBox(height: 8),
                ...List.generate(
                  lineCount - 1,
                  (index) => Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Skeleton.text(
                      width: index == lineCount - 2 ? 150 : double.infinity,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 网格骨架屏
class GridSkeleton extends StatelessWidget {
  final int itemCount;
  final int crossAxisCount;
  final double aspectRatio;
  final double mainAxisSpacing;
  final double crossAxisSpacing;

  const GridSkeleton({
    super.key,
    this.itemCount = 6,
    this.crossAxisCount = 2,
    this.aspectRatio = 0.75,
    this.mainAxisSpacing = 16,
    this.crossAxisSpacing = 16,
  });

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        childAspectRatio: aspectRatio,
        mainAxisSpacing: mainAxisSpacing,
        crossAxisSpacing: crossAxisSpacing,
      ),
      itemCount: itemCount,
      itemBuilder: (context, index) {
        return const VideoCardSkeleton();
      },
    );
  }
}

/// 轮播图骨架屏
class CarouselSkeleton extends StatelessWidget {
  final double height;

  const CarouselSkeleton({
    super.key,
    this.height = 200,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: const Skeleton.rectangle(
        borderRadius: BorderRadius.all(Radius.circular(12)),
      ),
    );
  }
}

/// 详情页骨架屏
class DetailPageSkeleton extends StatelessWidget {
  const DetailPageSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 播放器占位
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Container(
              color: const Color(0xFF1E1E1E),
              child: const Center(
                child: Icon(
                  Icons.play_circle_outline,
                  size: 64,
                  color: Colors.white24,
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          // 标题和信息
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Skeleton.text(width: double.infinity, fontSize: 20),
                const SizedBox(height: 8),
                const Skeleton.text(width: 200),
                const SizedBox(height: 16),
                // 按钮组
                Row(
                  children: [
                    Expanded(
                      child: Skeleton.rectangle(
                        height: 40,
                        borderRadius: BorderRadius.circular(20),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Skeleton.rectangle(
                        height: 40,
                        borderRadius: BorderRadius.circular(20),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                // 简介
                ...List.generate(
                  3,
                  (index) => Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Skeleton.text(
                      width: index == 2 ? 180 : double.infinity,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          // 推荐列表
          const GridSkeleton(itemCount: 4),
        ],
      ),
    );
  }
}

/// 个人中心骨架屏
class ProfilePageSkeleton extends StatelessWidget {
  const ProfilePageSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        children: [
          // 用户信息区域
          Container(
            padding: const EdgeInsets.all(24),
            child: Row(
              children: [
                const Skeleton.circle(size: 80),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Skeleton.text(width: 120, fontSize: 20),
                      const SizedBox(height: 8),
                      const Skeleton.text(width: 80),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // 菜单列表
          ...List.generate(
            8,
            (index) => const ListItemSkeleton(
              showAvatar: false,
              lineCount: 1,
            ),
          ),
        ],
      ),
    );
  }
}
