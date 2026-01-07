import 'package:flutter/material.dart';

import '../../../core/router.dart';

/// 周时间轴组件
/// 周一至周日标签切换，显示每周更新的番剧列表
class WeekTimeline extends StatefulWidget {
  final String title;
  final Map<String, dynamic> schedule;

  const WeekTimeline({
    super.key,
    this.title = '',
    required this.schedule,
  });

  @override
  State<WeekTimeline> createState() => _WeekTimelineState();
}

class _WeekTimelineState extends State<WeekTimeline> {
  int _selectedDay = DateTime.now().weekday; // 1-7 (周一到周日)

  // 星期标签
  final List<String> _weekDays = ['一', '二', '三', '四', '五', '六', '日'];

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 标题
          if (widget.title.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Container(
                    width: 4,
                    height: 18,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFC107),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    widget.title,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),

          // 星期标签栏
          _buildWeekTabs(),

          const SizedBox(height: 16),

          // 内容列表
          _buildContentList(),
        ],
      ),
    );
  }

  /// 构建星期标签栏
  Widget _buildWeekTabs() {
    return Container(
      height: 40,
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: List.generate(7, (index) {
          final day = index + 1;
          final isSelected = _selectedDay == day;
          final isToday = DateTime.now().weekday == day;

          return Expanded(
            child: GestureDetector(
              onTap: () {
                setState(() {
                  _selectedDay = day;
                });
              },
              child: Container(
                margin: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: isSelected
                      ? const Color(0xFFFFC107)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Text(
                      _weekDays[index],
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        color: isSelected
                            ? const Color(0xFF121212)
                            : Colors.white70,
                      ),
                    ),
                    // 今天标记
                    if (isToday && !isSelected)
                      Positioned(
                        top: 4,
                        right: 4,
                        child: Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            color: Color(0xFFFFC107),
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  /// 构建内容列表
  Widget _buildContentList() {
    final dayKey = _selectedDay.toString();
    final items = _getItemsForDay(dayKey);

    if (items.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(32),
        alignment: Alignment.center,
        child: Column(
          children: [
            Icon(
              Icons.calendar_today,
              size: 48,
              color: Colors.white24,
            ),
            const SizedBox(height: 12),
            Text(
              '今天没有更新',
              style: TextStyle(
                fontSize: 14,
                color: Colors.white38,
              ),
            ),
          ],
        ),
      );
    }

    return SizedBox(
      height: 200,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.zero,
        itemCount: items.length,
        itemBuilder: (context, index) {
          return _buildTimelineItem(items[index], index == 0);
        },
      ),
    );
  }

  /// 获取指定星期的内容
  List<Map<String, dynamic>> _getItemsForDay(String dayKey) {
    // 将数字 key 转换为英文星期名
    final weekdayNames = [
      'monday',    // 1
      'tuesday',   // 2
      'wednesday', // 3
      'thursday',  // 4
      'friday',    // 5
      'saturday',  // 6
      'sunday',    // 7
    ];
    
    final dayIndex = int.tryParse(dayKey);
    final actualKey = (dayIndex != null && dayIndex >= 1 && dayIndex <= 7)
        ? weekdayNames[dayIndex - 1]
        : dayKey;
    
    final data = widget.schedule[actualKey];
    
    if (data == null) return [];
    
    if (data is List) {
      return data.map((e) => e as Map<String, dynamic>).toList();
    } else if (data is Map) {
      final items = data['items'];
      if (items is List) {
        return items.map((e) => e as Map<String, dynamic>).toList();
      }
    }
    
    return [];
  }

  /// 构建时间轴项
  Widget _buildTimelineItem(Map<String, dynamic> item, bool isFirst) {
    final imageUrl = item['vod_pic'] as String? ?? item['image_url'] as String? ?? '';
    final title = item['vod_name'] as String? ?? item['title'] as String? ?? '';
    final vodIdRaw = item['vod_id'];
    final vodId = vodIdRaw != null ? vodIdRaw.toString() : '';
    final updateInfo = item['update_info'] as String? ?? item['remarks'] as String? ?? '';

    return GestureDetector(
      onTap: () {
        if (vodId.isNotEmpty) {
          UniversalRouter.handleRoute('video://$vodId');
        }
      },
      child: Container(
        width: 120,
        margin: EdgeInsets.only(
          left: isFirst ? 0 : 12,
          right: 12,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 封面图
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    _buildImage(imageUrl),

                    // 更新信息标签
                    if (updateInfo.isNotEmpty)
                      Positioned(
                        top: 6,
                        right: 6,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFC107),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            updateInfo,
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF121212),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 6),

            // 标题
            Text(
              title,
              style: const TextStyle(
                fontSize: 12,
                color: Colors.white,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
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
            size: 32,
            color: Colors.white24,
          ),
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
          child: Center(
            child: SizedBox(
              width: 24,
              height: 24,
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
          ),
        );
      },
      errorBuilder: (context, error, stackTrace) {
        return Container(
          color: const Color(0xFF2E2E2E),
          child: const Center(
            child: Icon(
              Icons.broken_image,
              size: 32,
              color: Colors.white24,
            ),
          ),
        );
      },
    );
  }
}
