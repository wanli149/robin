import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../core/sync_service.dart';
import '../../core/logger.dart';
import '../../widgets/net_image.dart';
import '../../services/share_service.dart';

/// 收藏页面
class FavoritesPage extends StatefulWidget {
  const FavoritesPage({super.key});

  @override
  State<FavoritesPage> createState() => _FavoritesPageState();
}

class _FavoritesPageState extends State<FavoritesPage> {
  final _syncService = SyncService.to;
  final _favoritesList = <FavoriteItem>[].obs;
  final _isLoading = false.obs;
  final _hasMore = true.obs;
  int _currentPage = 1;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _loadFavorites();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  /// 加载收藏列表
  Future<void> _loadFavorites({bool refresh = false}) async {
    if (_isLoading.value) return;

    if (refresh) {
      _currentPage = 1;
      _hasMore.value = true;
    }

    _isLoading.value = true;

    try {
      final list = await _syncService.getFavorites(
        page: _currentPage,
        pageSize: 20,
      );

      if (refresh) {
        _favoritesList.value = list;
      } else {
        _favoritesList.addAll(list);
      }

      if (list.length < 20) {
        _hasMore.value = false;
      } else {
        _currentPage++;
      }
    } catch (e) {
      Logger.error('Failed to load favorites: $e');
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
        _loadFavorites();
      }
    }
  }

  /// 取消收藏
  Future<void> _removeFavorite(FavoriteItem item) async {
    final success = await _syncService.removeFavorite(item.vodId);
    if (success) {
      _favoritesList.remove(item);
    }
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
          '我的收藏',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      body: Obx(() {
        if (_isLoading.value && _favoritesList.isEmpty) {
          return const Center(
            child: CircularProgressIndicator(
              color: Color(0xFFFFC107),
            ),
          );
        }

        if (_favoritesList.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.favorite_border,
                  size: 80,
                  color: Colors.white.withValues(alpha: 0.3),
                ),
                const SizedBox(height: 24),
                const Text(
                  '暂无收藏内容',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.white54,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  '快去收藏喜欢的影视作品吧',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.white38,
                  ),
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () => _loadFavorites(refresh: true),
          color: const Color(0xFFFFC107),
          child: GridView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 0.58, // 与首页模块保持一致
            ),
            itemCount: _favoritesList.length + (_hasMore.value ? 1 : 0),
            itemBuilder: (context, index) {
              if (index == _favoritesList.length) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: CircularProgressIndicator(
                      color: Color(0xFFFFC107),
                    ),
                  ),
                );
              }

              final item = _favoritesList[index];
              return _buildFavoriteItem(item);
            },
          ),
        );
      }),
    );
  }

  /// 构建收藏项
  Widget _buildFavoriteItem(FavoriteItem item) {
    return GestureDetector(
      onTap: () {
        // 跳转到视频详情页
        Get.toNamed('/video/detail', arguments: {'vodId': item.vodId});
      },
      onLongPress: () {
        _showOptionsDialog(item);
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 封面
          Expanded(
            child: Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: NetImage(
                    url: item.vodPic,
                    width: double.infinity,
                    height: double.infinity,
                    fit: BoxFit.cover,
                  ),
                ),
                // 收藏标识
                Positioned(
                  top: 4,
                  right: 4,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.favorite,
                      color: Color(0xFFFFC107),
                      size: 16,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // 标题 - 固定高度，与首页模块保持一致
          SizedBox(
            height: 36,
            child: Text(
              item.vodName,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13,
                color: Colors.white,
                height: 1.3,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 显示操作对话框
  void _showOptionsDialog(FavoriteItem item) {
    Get.bottomSheet(
      Container(
        decoration: const BoxDecoration(
          color: Color(0xFF1E1E1E),
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(20),
            topRight: Radius.circular(20),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),

            // 标题
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text(
                item.vodName,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(height: 24),

            // 操作按钮
            ListTile(
              leading: const Icon(
                Icons.play_circle_outline,
                color: Color(0xFFFFC107),
              ),
              title: const Text(
                '立即播放',
                style: TextStyle(color: Colors.white),
              ),
              onTap: () {
                Get.back();
                // 跳转到视频详情页
                Get.toNamed('/video/detail', arguments: {'vodId': item.vodId});
              },
            ),
            ListTile(
              leading: const Icon(
                Icons.favorite_border,
                color: Colors.red,
              ),
              title: const Text(
                '取消收藏',
                style: TextStyle(color: Colors.red),
              ),
              onTap: () {
                Get.back();
                _removeFavorite(item);
              },
            ),
            ListTile(
              leading: const Icon(
                Icons.share,
                color: Colors.white54,
              ),
              title: const Text(
                '分享',
                style: TextStyle(color: Colors.white54),
              ),
              onTap: () {
                Get.back();
                ShareService.showShareDialog(
                  context: context,
                  type: 'video',
                  id: item.vodId,
                  title: item.vodName,
                );
              },
            ),

            const SizedBox(height: 8),

            // 取消按钮
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () => Get.back(),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: const Color(0xFF2A2A2A),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    '取消',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
