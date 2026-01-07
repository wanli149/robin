import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../core/http_client.dart';

/// 推荐列表组件
/// 
/// 可复用的推荐视频列表，支持多种推荐策略：
/// - trending: 热门趋势
/// - similar: 相似推荐（需要 vodId）
/// - personalized: 个性化推荐（需要 userId）
/// - shorts_similar: 短剧相似推荐
/// 
/// ## 使用示例
/// ```dart
/// // 热门推荐
/// RecommendList(
///   title: '热门推荐',
///   strategy: 'trending',
/// )
/// 
/// // 相似推荐
/// RecommendList(
///   title: '猜你喜欢',
///   strategy: 'similar',
///   vodId: '12345',
/// )
/// ```
class RecommendList extends StatefulWidget {
  final String title;
  final String strategy;
  final String? vodId;
  final int? userId;
  final int? typeId;
  final int limit;
  final List<String>? excludeIds;
  final List<Map<String, dynamic>>? initialItems;
  final String? moreRoute;
  final bool autoLoad;
  final bool showTitle;
  final double itemWidth;
  final double itemHeight;

  const RecommendList({
    super.key,
    this.title = '推荐',
    this.strategy = 'trending',
    this.vodId,
    this.userId,
    this.typeId,
    this.limit = 10,
    this.excludeIds,
    this.initialItems,
    this.moreRoute,
    this.autoLoad = true,
    this.showTitle = true,
    this.itemWidth = 120,
    this.itemHeight = 180,
  });

  @override
  State<RecommendList> createState() => _RecommendListState();
}

class _RecommendListState extends State<RecommendList> {
  final HttpClient _httpClient = HttpClient();
  List<Map<String, dynamic>> _items = [];
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.initialItems != null && widget.initialItems!.isNotEmpty) {
      _items = widget.initialItems!;
    } else if (widget.autoLoad) {
      _loadRecommendations();
    }
  }

  @override
  void didUpdateWidget(RecommendList oldWidget) {
    super.didUpdateWidget(oldWidget);
    // 如果关键参数变化，重新加载
    if (oldWidget.vodId != widget.vodId ||
        oldWidget.strategy != widget.strategy ||
        oldWidget.typeId != widget.typeId) {
      _loadRecommendations();
    }
  }

  Future<void> _loadRecommendations() async {
    if (_isLoading) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // 构建请求参数
      final params = <String, String>{
        'strategy': widget.strategy,
        'limit': widget.limit.toString(),
      };

      if (widget.vodId != null) {
        params['vod_id'] = widget.vodId!;
      }
      if (widget.userId != null) {
        params['user_id'] = widget.userId.toString();
      }
      if (widget.typeId != null) {
        params['type_id'] = widget.typeId.toString();
      }
      if (widget.excludeIds != null && widget.excludeIds!.isNotEmpty) {
        params['exclude'] = widget.excludeIds!.join(',');
      }

      final response = await _httpClient.get(
        '/api/recommend',
        queryParameters: params,
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1 && data['data'] != null) {
          final list = (data['data']['list'] as List?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ?? [];
          
          setState(() {
            _items = list;
          });
          
          print('✅ Loaded ${list.length} recommendations (${widget.strategy})');
        }
      }
    } catch (e) {
      print('❌ Failed to load recommendations: $e');
      setState(() {
        _error = '加载失败';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _onItemTap(Map<String, dynamic> item) {
    final vodId = item['vod_id']?.toString();
    if (vodId == null) return;

    // 判断是否是短剧
    final typeId = item['type_id'];
    if (typeId == 5) {
      Get.toNamed('/shorts/detail', arguments: {'shortId': vodId});
    } else {
      Get.toNamed('/video/detail', arguments: {'vodId': vodId});
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading && _items.isEmpty) {
      return _buildLoading();
    }

    if (_error != null && _items.isEmpty) {
      return _buildError();
    }

    if (_items.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.showTitle) _buildHeader(),
        SizedBox(
          height: widget.itemHeight + 40,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _items.length,
            itemBuilder: (context, index) {
              return _buildItem(_items[index]);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            widget.title,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          if (widget.moreRoute != null)
            GestureDetector(
              onTap: () => Get.toNamed(widget.moreRoute!),
              child: const Row(
                children: [
                  Text(
                    '更多',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.white54,
                    ),
                  ),
                  Icon(
                    Icons.chevron_right,
                    size: 18,
                    color: Colors.white54,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildItem(Map<String, dynamic> item) {
    final name = item['vod_name'] ?? '';
    final pic = item['vod_pic'] ?? item['vod_pic_thumb'] ?? '';
    final remarks = item['vod_remarks'] ?? '';
    final score = item['vod_score'];

    return GestureDetector(
      onTap: () => _onItemTap(item),
      child: Container(
        width: widget.itemWidth,
        margin: const EdgeInsets.only(right: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 封面图
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Stack(
                children: [
                  Image.network(
                    pic,
                    width: widget.itemWidth,
                    height: widget.itemHeight,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: widget.itemWidth,
                      height: widget.itemHeight,
                      color: const Color(0xFF2E2E2E),
                      child: const Icon(
                        Icons.movie,
                        color: Colors.white24,
                        size: 40,
                      ),
                    ),
                  ),
                  // 评分角标
                  if (score != null && score > 0)
                    Positioned(
                      top: 4,
                      right: 4,
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
                          score.toStringAsFixed(1),
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Colors.black,
                          ),
                        ),
                      ),
                    ),
                  // 备注角标
                  if (remarks.isNotEmpty)
                    Positioned(
                      bottom: 0,
                      left: 0,
                      right: 0,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.transparent,
                              Colors.black.withOpacity(0.8),
                            ],
                          ),
                        ),
                        child: Text(
                          remarks,
                          style: const TextStyle(
                            fontSize: 10,
                            color: Colors.white,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            // 标题
            Text(
              name,
              style: const TextStyle(
                fontSize: 13,
                color: Colors.white,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoading() {
    return SizedBox(
      height: widget.itemHeight + 60,
      child: const Center(
        child: CircularProgressIndicator(
          color: Color(0xFFFFC107),
        ),
      ),
    );
  }

  Widget _buildError() {
    return SizedBox(
      height: widget.itemHeight + 60,
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline,
              color: Colors.white54,
              size: 32,
            ),
            const SizedBox(height: 8),
            Text(
              _error ?? '加载失败',
              style: const TextStyle(
                color: Colors.white54,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: _loadRecommendations,
              child: const Text(
                '重试',
                style: TextStyle(color: Color(0xFFFFC107)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
