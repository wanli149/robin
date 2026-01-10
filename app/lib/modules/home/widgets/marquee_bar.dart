import 'package:flutter/material.dart';
import '../../../core/router.dart';

/// 跑马灯通告栏
class MarqueeBar extends StatefulWidget {
  final String text;
  final String link;

  const MarqueeBar({
    super.key,
    required this.text,
    this.link = '',
  });

  @override
  State<MarqueeBar> createState() => _MarqueeBarState();
}

class _MarqueeBarState extends State<MarqueeBar>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<Offset> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(seconds: 15),
      vsync: this,
    )..repeat();

    _animation = Tween<Offset>(
      begin: const Offset(1.0, 0.0),
      end: const Offset(-1.0, 0.0),
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.linear,
    ));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.link.isNotEmpty
          ? () => UniversalRouter.handleRoute(widget.link)
          : null,
      child: Container(
        height: 40,
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF1E1E1E),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: const Color(0xFFFFC107).withValues(alpha: 0.3),
            width: 1,
          ),
        ),
        child: Row(
          children: [
            // 喇叭图标
            const Icon(
              Icons.campaign,
              color: Color(0xFFFFC107),
              size: 18,
            ),
            const SizedBox(width: 8),
            // 滚动文本
            Expanded(
              child: ClipRect(
                child: SlideTransition(
                  position: _animation,
                  child: Text(
                    widget.text,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.visible,
                  ),
                ),
              ),
            ),
            // 箭头图标（如果有链接）
            if (widget.link.isNotEmpty) ...[
              const SizedBox(width: 8),
              const Icon(
                Icons.chevron_right,
                color: Colors.white54,
                size: 18,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
