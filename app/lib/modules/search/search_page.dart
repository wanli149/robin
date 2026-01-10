import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'search_controller.dart' as search;
import '../../widgets/net_image.dart';
import '../../core/global_config.dart';


/// 搜索页面
/// 显示搜索框、热搜词、搜索历史、搜索结果
class SearchPage extends StatelessWidget {
  const SearchPage({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = Get.put(search.SearchController());

    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      body: SafeArea(
        child: Column(
          children: [
            // 搜索框
            _buildSearchBar(controller),

            // 内容区域
            Expanded(
              child: Obx(() => _buildContent(controller)),
            ),
          ],
        ),
      ),
    );
  }

  /// 构建搜索框
  Widget _buildSearchBar(search.SearchController controller) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          // 返回按钮
          GestureDetector(
            onTap: () => Get.back(),
            child: const Icon(
              Icons.arrow_back,
              color: Colors.white,
              size: 24,
            ),
          ),
          const SizedBox(width: 12),

          // 搜索输入框
          Expanded(
            child: Container(
              height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFF1E1E1E),
                borderRadius: BorderRadius.circular(20),
              ),
              child: TextField(
                controller: controller.searchTextController,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                ),
                decoration: const InputDecoration(
                  hintText: '搜索影片',
                  hintStyle: TextStyle(
                    color: Colors.white54,
                    fontSize: 14,
                  ),
                  prefixIcon: Icon(
                    Icons.search,
                    color: Colors.white54,
                    size: 20,
                  ),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(vertical: 10),
                ),
                onSubmitted: (value) {
                  if (value.trim().isNotEmpty) {
                    controller.search(value.trim());
                  }
                },
              ),
            ),
          ),
          const SizedBox(width: 12),

          // 搜索按钮
          GestureDetector(
            onTap: () {
              final keyword = controller.searchTextController.text.trim();
              if (keyword.isNotEmpty) {
                controller.search(keyword);
              }
            },
            child: const Text(
              '搜索',
              style: TextStyle(
                color: Color(0xFFFFC107),
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 构建内容
  Widget _buildContent(search.SearchController controller) {
    if (controller.isSearching.value) {
      // 显示搜索结果
      return _buildSearchResults(controller);
    } else {
      // 显示热搜和历史
      return _buildDefaultContent(controller);
    }
  }

  /// 构建默认内容（热搜 + 历史）
  Widget _buildDefaultContent(search.SearchController controller) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 搜索历史
          if (controller.searchHistory.isNotEmpty) ...[
            Row(
              children: [
                const Text(
                  '搜索历史',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: controller.clearHistory,
                  child: const Icon(
                    Icons.delete_outline,
                    color: Colors.white54,
                    size: 20,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: controller.searchHistory.map((keyword) {
                return GestureDetector(
                  onTap: () => controller.search(keyword),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E1E1E),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      keyword,
                      style: const TextStyle(
                        fontSize: 14,
                        color: Colors.white70,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),
          ],

          // 热搜词
          const Text(
            '热门搜索',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 12),
          Obx(() => Wrap(
                spacing: 8,
                runSpacing: 8,
                children: controller.hotSearchKeywords.asMap().entries.map((entry) {
                  final index = entry.key;
                  final keyword = entry.value;
                  final isTop3 = index < 3;

                  return GestureDetector(
                    onTap: () => controller.search(keyword),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: isTop3
                            ? const Color(0xFFFFC107).withValues(alpha: 0.2)
                            : const Color(0xFF1E1E1E),
                        borderRadius: BorderRadius.circular(16),
                        border: isTop3
                            ? Border.all(
                                color: const Color(0xFFFFC107),
                                width: 1,
                              )
                            : null,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (isTop3)
                            Container(
                              width: 18,
                              height: 18,
                              alignment: Alignment.center,
                              decoration: const BoxDecoration(
                                color: Color(0xFFFFC107),
                                shape: BoxShape.circle,
                              ),
                              child: Text(
                                '${index + 1}',
                                style: const TextStyle(
                                  fontSize: 10,
                                  color: Colors.black,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          if (isTop3) const SizedBox(width: 6),
                          Text(
                            keyword,
                            style: TextStyle(
                              fontSize: 14,
                              color: isTop3 ? const Color(0xFFFFC107) : Colors.white70,
                              fontWeight: isTop3 ? FontWeight.bold : FontWeight.normal,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              )),
        ],
      ),
    );
  }

  /// 构建搜索结果
  Widget _buildSearchResults(search.SearchController controller) {
    if (controller.isLoading.value) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
        ),
      );
    }

    if (controller.error.value.isNotEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline,
              size: 64,
              color: Colors.white38,
            ),
            const SizedBox(height: 16),
            Text(
              controller.error.value,
              style: const TextStyle(
                color: Colors.white54,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () {
                final keyword = controller.searchTextController.text.trim();
                if (keyword.isNotEmpty) {
                  controller.search(keyword);
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFFC107),
              ),
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    if (controller.searchResults.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.search_off,
              size: 64,
              color: Colors.white38,
            ),
            const SizedBox(height: 16),
            const Text(
              '没有找到相关内容',
              style: TextStyle(
                color: Colors.white54,
                fontSize: 16,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '试试其他关键词吧',
              style: TextStyle(
                color: Colors.white54.withValues(alpha: 0.7),
                fontSize: 14,
              ),
            ),
          ],
        ),
      );
    }

    return Obx(() {
      // 响应式监听广告开关
      final adsEnabled = GlobalConfig.instance.adsEnabled.value;
      
      return ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: adsEnabled 
            ? controller.searchResults.length + 1 // +1 for ad
            : controller.searchResults.length,
        itemBuilder: (context, index) {
          // 在首位插入伪装广告（仅当广告启用时）
          if (adsEnabled && index == 0) {
            return _buildFakeAdItem();
          }

          final actualIndex = adsEnabled ? index - 1 : index;
          final video = controller.searchResults[actualIndex];
          return _buildSearchResultItem(video);
        },
      );
    });
  }

  /// 构建伪装广告项
  Widget _buildFakeAdItem() {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
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
          // 广告图标
          Container(
            width: 80,
            height: 100,
            decoration: BoxDecoration(
              color: const Color(0xFF2E2E2E),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Icon(
              Icons.campaign,
              color: Color(0xFFFFC107),
              size: 32,
            ),
          ),
          const SizedBox(width: 12),

          // 广告信息
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFC107),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    '广告',
                    style: TextStyle(
                      fontSize: 10,
                      color: Colors.black,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  '精选推荐内容',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  '点击了解更多详情',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white54,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 构建搜索结果项
  Widget _buildSearchResultItem(Map<String, dynamic> video) {
    final vodId = video['vod_id']?.toString() ?? '';
    final vodName = video['vod_name'] as String? ?? '未知视频';
    final vodPic = video['vod_pic'] as String? ?? '';
    final vodRemarks = video['vod_remarks'] as String? ?? '';
    final vodYear = video['vod_year']?.toString() ?? '';
    final vodArea = video['vod_area'] as String? ?? '';

    return GestureDetector(
      onTap: () {
        Get.toNamed('/video/detail', arguments: {'vodId': vodId});
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 封面
            Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: NetImage(
                    url: vodPic,
                    width: 80,
                    height: 100,
                    fit: BoxFit.cover,
                  ),
                ),
                if (vodRemarks.isNotEmpty)
                  Positioned(
                    top: 4,
                    right: 4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFC107),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        vodRemarks,
                        style: const TextStyle(
                          fontSize: 10,
                          color: Colors.black,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 12),

            // 信息
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 标题
                  Text(
                    vodName,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),

                  // 标签
                  Wrap(
                    spacing: 8,
                    children: [
                      if (vodYear.isNotEmpty)
                        Text(
                          vodYear,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.white54,
                          ),
                        ),
                      if (vodArea.isNotEmpty)
                        Text(
                          vodArea,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.white54,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
