import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'library_controller.dart';
import '../../widgets/net_image.dart';
import '../../core/global_config.dart';


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
            // 顶部筛选器（可折叠）
            _buildCollapsibleFilters(controller),

            // 视频列表
            Expanded(
              child: Obx(() => _buildContent(controller)),
            ),
          ],
        ),
      ),
    );
  }

  /// 构建可折叠筛选器
  Widget _buildCollapsibleFilters(LibraryController controller) {
    return Obx(() {
      final isExpanded = controller.isFilterExpanded.value;
      
      return AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: const BoxDecoration(
          color: Color(0xFF121212),
          border: Border(
            bottom: BorderSide(
              color: Color(0xFF2E2E2E),
              width: 0.5,
            ),
          ),
        ),
        child: Column(
          children: [
            // 当前筛选条件摘要 + 展开/收起按钮
            _buildFilterHeader(controller, isExpanded),
            
            // 展开时显示完整筛选器
            if (isExpanded) _buildExpandedFilters(controller),
          ],
        ),
      );
    });
  }

  /// 构建筛选器头部（摘要）
  Widget _buildFilterHeader(LibraryController controller, bool isExpanded) {
    return GestureDetector(
      onTap: controller.toggleFilterExpanded,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            // 当前筛选摘要
            Expanded(
              child: Obx(() => SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildFilterChip(
                      controller.getSelectedTypeName(),
                      isActive: controller.selectedType.value.isNotEmpty,
                    ),
                    const SizedBox(width: 8),
                    _buildFilterChip(
                      controller.getSelectedAreaName(),
                      isActive: controller.selectedArea.value.isNotEmpty,
                    ),
                    const SizedBox(width: 8),
                    _buildFilterChip(
                      controller.getSelectedYearName(),
                      isActive: controller.selectedYear.value.isNotEmpty,
                    ),
                    const SizedBox(width: 8),
                    _buildFilterChip(
                      controller.getSelectedSortName(),
                      isActive: true,
                    ),
                  ],
                ),
              )),
            ),
            
            // 展开/收起图标
            Icon(
              isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
              color: const Color(0xFFFFC107),
              size: 24,
            ),
          ],
        ),
      ),
    );
  }

  /// 构建筛选标签
  Widget _buildFilterChip(String label, {bool isActive = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: isActive ? const Color(0xFFFFC107) : const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          color: isActive ? Colors.black : Colors.white70,
          fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
        ),
      ),
    );
  }

  /// 构建展开的筛选器
  Widget _buildExpandedFilters(LibraryController controller) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Column(
        children: [
          // 类型筛选
          _buildFilterRow(
            label: '类型',
            options: controller.typeOptions,
            selectedValue: controller.selectedType,
            onSelect: controller.selectType,
          ),
          const SizedBox(height: 10),

          // 地区筛选
          _buildFilterRow(
            label: '地区',
            options: controller.areaOptions,
            selectedValue: controller.selectedArea,
            onSelect: controller.selectArea,
          ),
          const SizedBox(height: 10),

          // 年份筛选
          _buildFilterRow(
            label: '年份',
            options: controller.yearOptions,
            selectedValue: controller.selectedYear,
            onSelect: controller.selectYear,
          ),
          const SizedBox(height: 10),

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
          // 3列网格布局
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            sliver: Obx(() {
              // 响应式监听广告开关
              final adsEnabled = GlobalConfig.instance.adsEnabled.value;
              
              return SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 0.58, // 与首页模块保持一致
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    // 每隔一定数量插入广告（仅当广告启用时）
                    if (adsEnabled && (index + 1) % 12 == 0 && index < controller.videoList.length) {
                      return _buildAdCard();
                    }

                    // 计算实际索引（考虑广告位）
                    final actualIndex = adsEnabled 
                        ? index - (index ~/ 12)
                        : index;
                    if (actualIndex >= controller.videoList.length) {
                      return const SizedBox.shrink();
                    }

                    final video = controller.videoList[actualIndex];
                    return _buildVideoCard(video);
                  },
                  childCount: adsEnabled
                      ? controller.videoList.length + (controller.videoList.length ~/ 12)
                      : controller.videoList.length,
                ),
              );
            }),
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
              fit: StackFit.expand,
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
                    top: 6,
                    right: 6,
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

          // 名称 - 固定高度
          SizedBox(
            height: 36,
            child: Text(
              vodName,
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

  /// 构建广告卡片
  Widget _buildAdCard() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: const Color(0xFFFFC107).withValues(alpha: 0.3),
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
              color: const Color(0xFFFFC107).withValues(alpha: 0.2),
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
