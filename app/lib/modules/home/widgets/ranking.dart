import 'package:flutter/material.dart';
import '../../../core/router.dart';
import '../../../services/api_service.dart';

/// 排行榜组件 - 支持日榜/周榜/月榜切换
class Ranking extends StatefulWidget {
  final String title;
  final List<Map<String, dynamic>> items;
  final String rankType; // hot, rising, rating
  final String? moreRoute;
  final bool showPeriodTabs; // 是否显示时间段切换
  final int? typeId; // 分类ID，用于获取不同分类的排行

  const Ranking({
    super.key,
    required this.title,
    required this.items,
    this.rankType = 'hot',
    this.moreRoute,
    this.showPeriodTabs = true,
    this.typeId,
  });

  @override
  State<Ranking> createState() => _RankingState();
}

class _RankingState extends State<Ranking> {
  int _currentPeriod = 0; // 0=日榜, 1=周榜, 2=月榜
  List<Map<String, dynamic>> _currentItems = [];
  bool _loading = false;

  final List<Map<String, String>> _periods = [
    {'key': 'day', 'label': '日榜'},
    {'key': 'week', 'label': '周榜'},
    {'key': 'month', 'label': '月榜'},
  ];

  @override
  void initState() {
    super.initState();
    _currentItems = widget.items;
  }

  Future<void> _loadRankingData(int periodIndex) async {
    if (_loading) return;
    
    setState(() {
      _loading = true;
      _currentPeriod = periodIndex;
    });

    try {
      final period = _periods[periodIndex]['key']!;
      final result = await ApiService.getRanking(
        period: period,
        typeId: widget.typeId,
        limit: 10,
      );
      
      if (mounted) {
        setState(() {
          _currentItems = result;
          _loading = false;
        });
      }
    } catch (e) {
      print('❌ Failed to load ranking: $e');
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty && _currentItems.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 标题栏
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Icon(_getRankIcon(), color: _getRankColor(), size: 24),
                const SizedBox(width: 8),
                Text(
                  widget.title,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const Spacer(),
                // 时间段切换
                if (widget.showPeriodTabs) _buildPeriodTabs(),
                if (widget.moreRoute != null) ...[
                  const SizedBox(width: 12),
                  GestureDetector(
                    onTap: () => UniversalRouter.handleRoute(widget.moreRoute!),
                    child: const Row(
                      children: [
                        Text('完整榜单', style: TextStyle(fontSize: 13, color: Colors.white54)),
                        Icon(Icons.chevron_right, size: 18, color: Colors.white54),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          // 排行列表
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Color(0xFFFFC107),
                  ),
                ),
              ),
            )
          else
            ..._currentItems.take(10).toList().asMap().entries.map((entry) {
              final index = entry.key;
              final item = entry.value;
              return _buildRankItem(index + 1, item);
            }),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _buildPeriodTabs() {
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: const Color(0xFF2E2E2E),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: _periods.asMap().entries.map((entry) {
          final index = entry.key;
          final period = entry.value;
          final isSelected = index == _currentPeriod;
          
          return GestureDetector(
            onTap: () => _loadRankingData(index),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: isSelected ? _getRankColor() : Colors.transparent,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                period['label']!,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? Colors.black : Colors.white54,
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildRankItem(int rank, Map<String, dynamic> item) {
    final vodId = item['vod_id']?.toString() ?? '';
    final title = item['vod_name'] as String? ?? item['title'] as String? ?? '';
    final imageUrl = item['vod_pic'] as String? ?? '';
    final score = item['vod_score'] as String? ?? '';
    final remarks = item['vod_remarks'] as String? ?? '';
    final heat = item['heat'] as int? ?? item['vod_hits'] as int? ?? 0;

    return GestureDetector(
      onTap: () {
        if (vodId.isNotEmpty) {
          UniversalRouter.handleRoute('video://$vodId');
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            // 排名
            SizedBox(
              width: 28,
              child: Text(
                '$rank',
                style: TextStyle(
                  fontSize: rank <= 3 ? 20 : 16,
                  fontWeight: FontWeight.bold,
                  color: _getRankNumberColor(rank),
                ),
              ),
            ),
            const SizedBox(width: 12),
            // 封面
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: SizedBox(
                width: 50,
                height: 70,
                child: _buildImage(imageUrl),
              ),
            ),
            const SizedBox(width: 12),
            // 信息
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: Colors.white,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      if (score.isNotEmpty && score != '0' && score != '0.0')
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFC107).withOpacity(0.2),
                            borderRadius: BorderRadius.circular(3),
                          ),
                          child: Text(
                            '⭐ $score',
                            style: const TextStyle(fontSize: 11, color: Color(0xFFFFC107)),
                          ),
                        ),
                      if (remarks.isNotEmpty) ...[
                        const SizedBox(width: 6),
                        Text(remarks, style: const TextStyle(fontSize: 11, color: Colors.white54)),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            // 热度
            if (heat > 0)
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Icon(Icons.local_fire_department, size: 16, color: _getRankColor()),
                  Text(
                    _formatHeat(heat),
                    style: TextStyle(fontSize: 11, color: _getRankColor()),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  IconData _getRankIcon() {
    switch (widget.rankType) {
      case 'rising':
        return Icons.trending_up;
      case 'rating':
        return Icons.star;
      default:
        return Icons.local_fire_department;
    }
  }

  Color _getRankColor() {
    switch (widget.rankType) {
      case 'rising':
        return const Color(0xFF4CAF50);
      case 'rating':
        return const Color(0xFFFFC107);
      default:
        return const Color(0xFFFF5722);
    }
  }

  Color _getRankNumberColor(int rank) {
    switch (rank) {
      case 1:
        return const Color(0xFFFFD700);
      case 2:
        return const Color(0xFFC0C0C0);
      case 3:
        return const Color(0xFFCD7F32);
      default:
        return Colors.white54;
    }
  }

  String _formatHeat(int heat) {
    if (heat >= 10000) {
      return '${(heat / 10000).toStringAsFixed(1)}万';
    }
    return heat.toString();
  }

  Widget _buildImage(String imageUrl) {
    if (imageUrl.isEmpty) {
      return Container(
        color: const Color(0xFF2E2E2E),
        child: const Icon(Icons.movie, size: 24, color: Colors.white24),
      );
    }
    return Image.network(
      imageUrl,
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => Container(
        color: const Color(0xFF2E2E2E),
        child: const Icon(Icons.broken_image, size: 24, color: Colors.white24),
      ),
    );
  }
}
