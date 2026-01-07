import 'package:flutter/material.dart';
import '../../../core/router.dart';

/// 公告/通知组件
class Notice extends StatelessWidget {
  final String title;
  final String content;
  final String? actionUrl;
  final String type; // info, warning, success, error
  final bool dismissible;

  const Notice({
    super.key,
    required this.title,
    required this.content,
    this.actionUrl,
    this.type = 'info',
    this.dismissible = true,
  });

  @override
  Widget build(BuildContext context) {
    final colors = _getColors();
    
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: colors['bg'],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors['border']!, width: 1),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: actionUrl != null ? () => UniversalRouter.handleRoute(actionUrl!) : null,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // 图标
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: colors['icon_bg'],
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Icon(
                    _getIcon(),
                    color: colors['icon'],
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                // 内容
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: colors['title'],
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        content,
                        style: TextStyle(
                          fontSize: 13,
                          color: colors['content'],
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                // 箭头
                if (actionUrl != null)
                  Icon(
                    Icons.chevron_right,
                    color: colors['icon'],
                    size: 20,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  IconData _getIcon() {
    switch (type) {
      case 'warning':
        return Icons.warning_amber_rounded;
      case 'success':
        return Icons.check_circle_outline;
      case 'error':
        return Icons.error_outline;
      default:
        return Icons.info_outline;
    }
  }

  Map<String, Color> _getColors() {
    switch (type) {
      case 'warning':
        return {
          'bg': const Color(0xFFFFC107).withOpacity(0.1),
          'border': const Color(0xFFFFC107).withOpacity(0.3),
          'icon_bg': const Color(0xFFFFC107).withOpacity(0.2),
          'icon': const Color(0xFFFFC107),
          'title': Colors.white,
          'content': Colors.white70,
        };
      case 'success':
        return {
          'bg': const Color(0xFF4CAF50).withOpacity(0.1),
          'border': const Color(0xFF4CAF50).withOpacity(0.3),
          'icon_bg': const Color(0xFF4CAF50).withOpacity(0.2),
          'icon': const Color(0xFF4CAF50),
          'title': Colors.white,
          'content': Colors.white70,
        };
      case 'error':
        return {
          'bg': const Color(0xFFF44336).withOpacity(0.1),
          'border': const Color(0xFFF44336).withOpacity(0.3),
          'icon_bg': const Color(0xFFF44336).withOpacity(0.2),
          'icon': const Color(0xFFF44336),
          'title': Colors.white,
          'content': Colors.white70,
        };
      default:
        return {
          'bg': const Color(0xFF2196F3).withOpacity(0.1),
          'border': const Color(0xFF2196F3).withOpacity(0.3),
          'icon_bg': const Color(0xFF2196F3).withOpacity(0.2),
          'icon': const Color(0xFF2196F3),
          'title': Colors.white,
          'content': Colors.white70,
        };
    }
  }
}
