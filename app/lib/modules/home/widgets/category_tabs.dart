import 'package:flutter/material.dart';
import '../../../core/router.dart';
import '../../../services/api_service.dart';

/// 分类标签页组件
/// 快速切换子分类，支持动态加载数据
class CategoryTabs extends StatefulWidget {
  final String title;
  final List<Map<String, dynamic>> tabs;
  final List<Map<String, dynamic>> items;
  final int initialIndex;
  final int? typeId; // 主分类ID，用于动态加载

  const CategoryTabs({
    super.key,
    this.title = '',
    required this.tabs,
    required this.items,
    this.initialIndex = 0,
    this.typeId,
  });

  @override
  State<CategoryTabs> createState() => _CategoryTabsState();
}

class _CategoryTabsState extends State<CategoryTabs> {
  late int _currentIndex;
  List<Map<String, dynamic>> _currentItems = [];
  bool _loading = false;
  final Map<int, List<Map<String, dynamic>>> _cachedItems = {};

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _currentItems = _filterItems(widget.items);
  }

  List<Map<String, dynamic>> _filterItems(List<Map<String, dynamic>> items) {
    if (widget.tabs.isEmpty || _currentIndex >= widget.tabs.length) {
      return items;
    }
    
    final currentTab = widget.tabs[_currentIndex];
    final tabId = currentTab['id']?.toString() ?? '';
    
    if (tabId.isEmpty || tabId == '0') {
      return items; // 全部
    }
    
    return items.where((item) {
      final itemTabId = item['tab_id']?.toString() ?? 
                        item['sub_type_id']?.toString() ?? 
                        item['class']?.toString() ?? '';
      return itemTabId == tabId;
    }).toList();
  }

  Future<void> _loadTabData(int index) async {
    if (_loading) return;
    
    // 检查缓存
    if (_cachedItems.containsKey(index)) {
      setState(() {
        _currentIndex = index;
        _currentItems = _cachedItems[index]!;
      });
      return;
    }

    final tab = widget.tabs[index];
    final subTypeId = tab['id'] as int?;
    
    // 如果没有 typeId 或 subTypeId，使用本地过滤
    if (widget.typeId == null || subTypeId == null || subTypeId == 0) {
      setState(() {
        _currentIndex = index;
        _currentItems = _filterItems(widget.items);
      });
      return;
    }

    setState(() {
      _loading = true;
      _currentIndex = index;
    });

    try {
      final result = await ApiService.getCategoryVideos(
        typeId: widget.typeId!,
        subTypeId: subTypeId,
        limit: 12,
      );
      
      if (mounted) {
        setState(() {
          _currentItems = result;
          _cachedItems[index] = result;
          _loading = false;
        });
      }
    } catch (e) {
      print('❌ Failed to load category data: $e');
      if (mounted) {
        setState(() {
          _currentItems = _filterItems(widget.items);
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.tabs.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 标题和标签
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                if (widget.title.isNotEmpty) ...[
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
                  const SizedBox(width: 16),
                ],
                Expanded(child: _buildTabs()),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // 内容
          _buildContent(),
        ],
      ),
    );
  }

  Widget _buildTabs() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: widget.tabs.asMap().entries.map((entry) {
          final index = entry.key;
          final tab = entry.value;
          final isSelected = index == _currentIndex;
          final name = tab['name'] as String? ?? '';

          return GestureDetector(
            onTap: () => _loadTabData(index),
            child: Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: isSelected 
                    ? const Color(0xFFFFC107) 
                    : const Color(0xFF2E2E2E),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                name,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? Colors.black : Colors.white70,
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildContent() {
    if (_loading) {
      return const SizedBox(
        height: 180,
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
      );
    }

    if (_currentItems.isEmpty) {
      return Container(
        height: 120,
        alignment: Alignment.center,
        child: const Text(
          '暂无内容',
          style: TextStyle(color: Colors.white54),
        ),
      );
    }

    return SizedBox(
      height: 180,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _currentItems.length,
        itemBuilder: (context, index) {
          return Padding(
            padding: EdgeInsets.only(right: index < _currentItems.length - 1 ? 12 : 0),
            child: _buildVideoCard(_currentItems[index]),
          );
        },
      ),
    );
  }

  Widget _buildVideoCard(Map<String, dynamic> item) {
    final imageUrl = item['vod_pic'] as String? ?? '';
    final title = item['vod_name'] as String? ?? item['title'] as String? ?? '';
    final vodId = item['vod_id']?.toString() ?? '';
    final remarks = item['vod_remarks'] as String? ?? '';

    return GestureDetector(
      onTap: () {
        if (vodId.isNotEmpty) {
          UniversalRouter.handleRoute('video://$vodId');
        }
      },
      child: SizedBox(
        width: 110,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 封面
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    _buildImage(imageUrl),
                    if (remarks.isNotEmpty)
                      Positioned(
                        top: 6,
                        right: 6,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFC107),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            remarks,
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
              style: const TextStyle(fontSize: 12, color: Colors.white),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildImage(String imageUrl) {
    if (imageUrl.isEmpty) {
      return Container(
        color: const Color(0xFF2E2E2E),
        child: const Icon(Icons.movie, size: 32, color: Colors.white24),
      );
    }
    return Image.network(
      imageUrl,
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => Container(
        color: const Color(0xFF2E2E2E),
        child: const Icon(Icons.broken_image, size: 32, color: Colors.white24),
      ),
    );
  }
}
