import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'library_controller.dart';
import '../../widgets/net_image.dart';


/// 片库页面
/// 支持筛选、瀑布流布局、下拉刷新、上拉加载更多
class LibraryPage extends StatelessWidget {
  const LibraryPage({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = Get.put(LibraryController());

    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      body: SafeArea(
        child: Column(
          children: [
            // 顶部筛选器
            _buildFilters(controller),

            // 视频列表
            Expanded(
              child: Obx(() => _buildContent(controller)),
            ),
          ],
        ),
      ),
    );
  }

  /// 构建筛选器
  Widget _buildFilters(LibraryController controller) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: Color(0xFF2E2E2E),
            width: 0.5,
          ),
        ),
      ),
      child: Column(
        children: [
          // 类型筛选
          _buildFilterRow(
            label: '类型',
            options: controller.typeOptions,
            selectedValue: controller.selectedType,
            onSelect: controller.selectType,
          ),
          const SizedBox(height: 12),

          // 地区筛选
          _buildFilterRow(
            label: '地区',
            options: controller.areaOptions,
            selectedValue: controller.selectedArea,
            onSelect: controller.selectArea,
          ),
          const SizedBox(height: 12),

          // 年份筛选
          _buildFilterRow(
            label: '年份',
            options: controller.yearOptions,
            selectedValue: controller.selectedYear,
            onSelect: controller.selectYear,
          ),
          const SizedBox(height: 12),

          // 排序筛选
          _buildFilterRow(
            label: '排序',
            options: controller.sortOptions,
            selectedValue: controller.selectedSort,
            onSelect: controller.selectSort,
          ),
        ],
      ),
    );
  }

  /// 构建筛选行
  Widget _buildFilterRow({
    required String label,
    required List<Map<String, String>> options,
    required RxString selectedValue,
    required Function(String) onSelect,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 标签
        SizedBox(
          width: 50,
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 14,
              color: Colors.white70,
            ),
          ),
        ),

        // 选项列表
        Expanded(
          child: Obx(() => Wrap(
                spacing: 8,
                runSpacing: 8,
                children: options.map((option) {
                  final value = option['value']!;
                  final name = option['name']!;
                  final isSelected = selectedValue.value == value;

                  return GestureDetector(
                    onTap: () => onSelect(value),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? const Color(0xFFFFC107)
                            : const Color(0xFF1E1E1E),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Text(
                        name,
                        style: TextStyle(
                          fontSize: 12,
                          color: isSelected ? Colors.black : Colors.white70,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              )),
        ),
      ],
    );
  }

  /// 构建内容
  Widget _buildContent(LibraryController controller) {
    if (controller.isLoading.value && controller.videoList.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
        ),
      );
    }

    if (controller.error.value.isNotEmpty && controller.videoList.isEmpty) {
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
              onPressed: controller.refresh,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFFC107),
              ),
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    if (controller.videoList.isEmpty) {
      return const Center(
        child: Text(
          '暂无视频',
          style: TextStyle(
            color: Colors.white54,
            fontSize: 16,
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: controller.refresh,
      color: const Color(0xFFFFC107),
      child: CustomScrollView(
        controller: controller.scrollController,
        slivers: [
          // 瀑布流网格
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 0.65,
              ),
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  // 每隔一定数量插入广告
                  if ((index + 1) % 10 == 0 && index < controller.videoList.length) {
                    return _buildAdCard();
                  }

                  final actualIndex = index - (index ~/ 10);
                  if (actualIndex >= controller.videoList.length) {
                    return const SizedBox.shrink();
                  }

                  final video = controller.videoList[actualIndex];
                  return _buildVideoCard(video);
                },
                childCount: controller.videoList.length + (controller.videoList.length ~/ 10),
              ),
            ),
          ),

          // 加载更多指示器
          if (controller.isLoadingMore.value)
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Center(
                  child: CircularProgressIndicator(
                    valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
                  ),
                ),
              ),
            ),

          // 没有更多数据提示
          if (!controller.hasMore.value && controller.videoList.isNotEmpty)
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Center(
                  child: Text(
                    '没有更多了',
                    style: TextStyle(
                      color: Colors.white54,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// 构建视频卡片
  Widget _buildVideoCard(Map<String, dynamic> video) {
    final vodId = video['vod_id']?.toString() ?? '';
    final vodName = video['vod_name'] as String? ?? '未知视频';
    final vodPic = video['vod_pic'] as String? ?? '';
    final vodRemarks = video['vod_remarks'] as String? ?? '';

    return GestureDetector(
      onTap: () {
        Get.toNamed('/video/detail', arguments: {'vodId': vodId});
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
                    url: vodPic,
                    fit: BoxFit.cover,
                  ),
                ),
                if (vodRemarks.isNotEmpty)
                  Positioned(
                    top: 4,
                    right: 4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
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
          ),
          const SizedBox(height: 8),

          // 名称
          Text(
            vodName,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 13,
              color: Colors.white,
              height: 1.3,
            ),
          ),
        ],
      ),
    );
  }

  /// 构建广告卡片
  Widget _buildAdCard() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: const Color(0xFFFFC107).withOpacity(0.3),
          width: 1,
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.campaign,
            color: Color(0xFFFFC107),
            size: 48,
          ),
          const SizedBox(height: 12),
          const Text(
            '广告位',
            style: TextStyle(
              color: Colors.white70,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFFFC107).withOpacity(0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text(
              '点击了解',
              style: TextStyle(
                color: Color(0xFFFFC107),
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
