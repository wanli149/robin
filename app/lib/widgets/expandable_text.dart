import 'package:flutter/material.dart';

/// 可折叠文本组件
/// 
/// 当文本超过指定行数时显示"展开"按钮
class ExpandableText extends StatefulWidget {
  final String text;
  final int maxLines;
  final TextStyle? style;
  final String expandText;
  final String collapseText;

  const ExpandableText({
    super.key,
    required this.text,
    this.maxLines = 3,
    this.style,
    this.expandText = '展开',
    this.collapseText = '收起',
  });

  @override
  State<ExpandableText> createState() => _ExpandableTextState();
}

class _ExpandableTextState extends State<ExpandableText> {
  bool _isExpanded = false;
  bool _needsExpand = false;

  @override
  void initState() {
    super.initState();
    // 延迟检测是否需要展开按钮
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkNeedsExpand();
    });
  }

  void _checkNeedsExpand() {
    final textPainter = TextPainter(
      text: TextSpan(
        text: widget.text,
        style: widget.style ?? const TextStyle(fontSize: 14, height: 1.5),
      ),
      maxLines: widget.maxLines,
      textDirection: TextDirection.ltr,
    );
    
    // 使用屏幕宽度减去padding
    final maxWidth = MediaQuery.of(context).size.width - 32;
    textPainter.layout(maxWidth: maxWidth);
    
    if (mounted) {
      setState(() {
        _needsExpand = textPainter.didExceedMaxLines;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final defaultStyle = const TextStyle(
      fontSize: 14,
      color: Colors.white70,
      height: 1.5,
    );
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AnimatedCrossFade(
          firstChild: Text(
            widget.text,
            style: widget.style ?? defaultStyle,
            maxLines: widget.maxLines,
            overflow: TextOverflow.ellipsis,
          ),
          secondChild: Text(
            widget.text,
            style: widget.style ?? defaultStyle,
          ),
          crossFadeState: _isExpanded 
              ? CrossFadeState.showSecond 
              : CrossFadeState.showFirst,
          duration: const Duration(milliseconds: 200),
        ),
        if (_needsExpand)
          GestureDetector(
            onTap: () {
              setState(() {
                _isExpanded = !_isExpanded;
              });
            },
            child: Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _isExpanded ? widget.collapseText : widget.expandText,
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFFFFC107),
                    ),
                  ),
                  Icon(
                    _isExpanded 
                        ? Icons.keyboard_arrow_up 
                        : Icons.keyboard_arrow_down,
                    size: 18,
                    color: const Color(0xFFFFC107),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
