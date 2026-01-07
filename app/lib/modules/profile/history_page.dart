import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../core/sync_service.dart';
import '../../widgets/net_image.dart';

/// 观看历史页面
class HistoryPage extends StatefulWidget {
  const HistoryPage({super.key});

  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  final _syncService = SyncService.to;
  final _historyList = <HistoryItem>[].obs;
  final _isLoading = false.obs;
  final _hasMore = true.obs;
  int _currentPage = 1;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _loadHistory();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  /// 加载观看历史
  Future<void> _loadHistory({bool refresh = false}) async {
    if (_isLoading.value) return;

    if (refresh) {
      _currentPage = 1;
      _hasMore.value = true;
    }

    _isLoading.value = true;

    try {
      final list = await _syncService.getHistory(
        page: _currentPage,
        pageSize: 20,
      );

      if (refresh) {
        _historyList.value = list;
      } else {
        _historyList.addAll(list);
      }

      if (list.length < 20) {
        _hasMore.value = false;
      } else {
        _currentPage++;
      }
    } catch (e) {
      print('❌ Failed to load history: $e');
      Get.snackbar('错误', '加载失败，请重试');
    } finally {
      _isLoading.value = false;
    }
  }

  /// 滚动监听
  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      if (_hasMore.value && !_isLoading.value) {
        _loadHistory();
      }
    }
  }

  /// 删除历史记录
  Future<void> _deleteHistory(HistoryItem item) async {
    Get.dialog(
      AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text(
          '确认删除',
          style: TextStyle(color: Colors.white),
        ),
        content: Text(
          '确定要删除《${item.vodName}》的观看记录吗？',
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Get.back(),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () async {
              Get.back();
              try {
                await _syncService.deleteHistory(item.vodId);
                _historyList.remove(item);
                Get.snackbar('成功', '已删除观看记录');
              } catch (e) {
                Get.snackbar('错误', '删除失败，请重试');
              }
            },
            child: const Text(
              '删除',
              style: TextStyle(color: Colors.red),
            ),
          ),
        ],
      ),
    );
  }

  /// 清空所有历史
  Future<void> _clearAllHistory() async {
    if (_historyList.isEmpty) {
      Get.snackbar('提示', '暂无观看记录');
      return;
    }

    Get.dialog(
      AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text(
          '确认清空',
          style: TextStyle(color: Colors.white),
        ),
        content: const Text(
          '确定要清空所有观看记录吗？此操作不可恢复。',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Get.back(),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () async {
              Get.back();
              try {
                await _syncService.clearHistory();
                _historyList.clear();
                Get.snackbar('成功', '已清空观看记录');
              } catch (e) {
                Get.snackbar('错误', '清空失败，请重试');
              }
            },
            child: const Text(
              '清空',
              style: TextStyle(color: Colors.red),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        backgroundColor: const Color(0xFF121212),
        elevation: 0,
        leading: IconButton(
          onPressed: () => Get.back(),
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
        ),
        title: const Text(
          '观看历史',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        actions: [
          IconButton(
            onPressed: _clearAllHistory,
            icon: const Icon(Icons.delete_outline, color: Colors.white54),
            tooltip: '清空历史',
          ),
        ],
      ),
      body: Obx(() {
        if (_isLoading.value && _historyList.isEmpty) {
          return const Center(
            child: CircularProgressIndicator(
              color: Color(0xFFFFC107),
            ),
          );
        }

        if (_historyList.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.history,
                  size: 80,
                  color: Colors.white.withOpacity(0.3),
                ),
                const SizedBox(height: 24),
                const Text(
                  '暂无观看记录',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.white54,
                  ),
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () => _loadHistory(refresh: true),
          color: const Color(0xFFFFC107),
          child: ListView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.all(16),
            itemCount: _historyList.length + (_hasMore.value ? 1 : 0),
            itemBuilder: (context, index) {
              if (index == _historyList.length) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: CircularProgressIndicator(
                      color: Color(0xFFFFC107),
                    ),
                  ),
                );
              }

              final item = _historyList[index];
              return _buildHistoryItem(item);
            },
          ),
        );
      }),
    );
  }

  /// 构建历史记录项
  Widget _buildHistoryItem(HistoryItem item) {
    return Dismissible(
      key: Key(item.vodId),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(
          color: Colors.red,
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Icon(
          Icons.delete,
          color: Colors.white,
        ),
      ),
      onDismissed: (_) => _deleteHistory(item),
      child: GestureDetector(
        onTap: () {
          // 跳转到视频详情页并继续播放
          Get.toNamed('/video/detail', arguments: {'vodId': item.vodId});
        },
        child: Container(
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: const Color(0xFF1E1E1E),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              // 封面
              ClipRRect(
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(12),
                  bottomLeft: Radius.circular(12),
                ),
                child: Stack(
                  children: [
                    NetImage(
                      url: item.vodPic,
                      width: 120,
                      height: 90,
                      fit: BoxFit.cover,
                    ),
                    // 播放进度条
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      child: Container(
                        height: 3,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.3),
                        ),
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: item.progressPercent / 100,
                          child: Container(
                            decoration: const BoxDecoration(
                              color: Color(0xFFFFC107),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // 信息
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 标题
                      Text(
                        item.vodName,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 8),

                      // 进度信息
                      Text(
                        '观看至 ${_formatDuration(item.progress)} / ${_formatDuration(item.duration)}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.white54,
                        ),
                      ),
                      const SizedBox(height: 4),

                      // 观看时间
                      Text(
                        _formatTime(item.updatedAt),
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.white38,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // 继续播放按钮
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: Icon(
                  Icons.play_circle_outline,
                  color: const Color(0xFFFFC107),
                  size: 32,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 格式化时长
  String _formatDuration(int seconds) {
    final hours = seconds ~/ 3600;
    final minutes = (seconds % 3600) ~/ 60;
    final secs = seconds % 60;

    if (hours > 0) {
      return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
    } else {
      return '${minutes.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
    }
  }

  /// 格式化时间
  String _formatTime(int timestamp) {
    final date = DateTime.fromMillisecondsSinceEpoch(timestamp * 1000);
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inDays == 0) {
      return '今天 ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    } else if (diff.inDays == 1) {
      return '昨天 ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    } else if (diff.inDays < 7) {
      return '${diff.inDays}天前';
    } else {
      return '${date.month}-${date.day}';
    }
  }
}
