import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../core/http_client.dart';
import '../../core/logger.dart';

/// 片库控制器
class LibraryController extends GetxController {
  final HttpClient _httpClient = HttpClient();
  final ScrollController scrollController = ScrollController();

  // 筛选选项
  final List<Map<String, String>> typeOptions = [
    {'value': '', 'name': '全部'},
    {'value': '1', 'name': '电影'},
    {'value': '2', 'name': '电视剧'},
    {'value': '3', 'name': '综艺'},
    {'value': '4', 'name': '动漫'},
    {'value': '5', 'name': '纪录片'},
  ];

  final List<Map<String, String>> areaOptions = [
    {'value': '', 'name': '全部'},
    {'value': '大陆', 'name': '大陆'},
    {'value': '香港', 'name': '香港'},
    {'value': '台湾', 'name': '台湾'},
    {'value': '美国', 'name': '美国'},
    {'value': '韩国', 'name': '韩国'},
    {'value': '日本', 'name': '日本'},
    {'value': '泰国', 'name': '泰国'},
    {'value': '英国', 'name': '英国'},
    {'value': '法国', 'name': '法国'},
  ];

  final List<Map<String, String>> yearOptions = [
    {'value': '', 'name': '全部'},
    {'value': '2025', 'name': '2025'},
    {'value': '2024', 'name': '2024'},
    {'value': '2023', 'name': '2023'},
    {'value': '2022', 'name': '2022'},
    {'value': '2021', 'name': '2021'},
    {'value': '2020', 'name': '2020'},
    {'value': '2019', 'name': '2019'},
    {'value': '2018', 'name': '2018'},
    {'value': '2017', 'name': '2017'},
    {'value': '2016', 'name': '2016'},
    {'value': '2015', 'name': '2015'},
  ];

  final List<Map<String, String>> sortOptions = [
    {'value': 'time', 'name': '最新'},
    {'value': 'hits', 'name': '最热'},
    {'value': 'score', 'name': '评分'},
  ];

  // 当前选中的筛选条件
  final RxString selectedType = ''.obs;
  final RxString selectedArea = ''.obs;
  final RxString selectedYear = ''.obs;
  final RxString selectedSort = 'time'.obs;

  // 筛选器展开状态
  final RxBool isFilterExpanded = false.obs;

  // 视频列表
  final RxList<Map<String, dynamic>> videoList = <Map<String, dynamic>>[].obs;

  // 分页
  final RxInt currentPage = 1.obs;
  final RxBool hasMore = true.obs;

  // 加载状态
  final RxBool isLoading = false.obs;
  final RxBool isLoadingMore = false.obs;

  // 错误信息
  final RxString error = ''.obs;

  @override
  void onInit() {
    super.onInit();
    loadVideos();
    _setupScrollListener();
  }

  @override
  void onClose() {
    scrollController.dispose();
    super.onClose();
  }

  /// 设置滚动监听
  void _setupScrollListener() {
    scrollController.addListener(() {
      if (scrollController.position.pixels >=
          scrollController.position.maxScrollExtent - 200) {
        // 接近底部时加载更多
        if (!isLoadingMore.value && hasMore.value) {
          loadMore();
        }
      }
    });
  }

  /// 选择类型
  void selectType(String value) {
    if (selectedType.value == value) return;
    selectedType.value = value;
    refresh();
  }

  /// 选择地区
  void selectArea(String value) {
    if (selectedArea.value == value) return;
    selectedArea.value = value;
    refresh();
  }

  /// 选择年份
  void selectYear(String value) {
    if (selectedYear.value == value) return;
    selectedYear.value = value;
    refresh();
  }

  /// 选择排序
  void selectSort(String value) {
    if (selectedSort.value == value) return;
    selectedSort.value = value;
    refresh();
  }

  /// 切换筛选器展开状态
  void toggleFilterExpanded() {
    isFilterExpanded.value = !isFilterExpanded.value;
  }

  /// 获取选中的类型名称
  String getSelectedTypeName() {
    final option = typeOptions.firstWhere(
      (o) => o['value'] == selectedType.value,
      orElse: () => {'name': '全部'},
    );
    return option['name']!;
  }

  /// 获取选中的地区名称
  String getSelectedAreaName() {
    final option = areaOptions.firstWhere(
      (o) => o['value'] == selectedArea.value,
      orElse: () => {'name': '全部'},
    );
    return option['name']!;
  }

  /// 获取选中的年份名称
  String getSelectedYearName() {
    final option = yearOptions.firstWhere(
      (o) => o['value'] == selectedYear.value,
      orElse: () => {'name': '全部'},
    );
    return option['name']!;
  }

  /// 获取选中的排序名称
  String getSelectedSortName() {
    final option = sortOptions.firstWhere(
      (o) => o['value'] == selectedSort.value,
      orElse: () => {'name': '最新'},
    );
    return option['name']!;
  }

  /// 刷新
  @override
  Future<void> refresh() async {
    currentPage.value = 1;
    hasMore.value = true;
    videoList.clear();
    await loadVideos();
  }

  /// 加载视频列表（使用去重后的片库API）
  Future<void> loadVideos() async {
    try {
      isLoading.value = true;
      error.value = '';

      // 使用新的去重片库API
      final response = await _httpClient.get(
        '/api/library',
        queryParameters: {
          't': selectedType.value,
          'area': selectedArea.value,
          'year': selectedYear.value,
          'sort': selectedSort.value,
          'pg': currentPage.value.toString(),
          'limit': '20',
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        final list = (data['data'] as List?)
                ?.map((e) => e as Map<String, dynamic>)
                .toList() ??
            [];

        if (list.isEmpty) {
          hasMore.value = false;
        } else {
          videoList.addAll(list);
        }

        Logger.success('Loaded ${list.length} videos (deduplicated), page: ${currentPage.value}');
      }
    } catch (e) {
      Logger.error('Failed to load videos: $e');
      error.value = '加载失败，请重试';
    } finally {
      isLoading.value = false;
    }
  }

  /// 加载更多
  Future<void> loadMore() async {
    if (!hasMore.value || isLoadingMore.value) return;

    try {
      isLoadingMore.value = true;
      currentPage.value++;

      // 使用新的去重片库API
      final response = await _httpClient.get(
        '/api/library',
        queryParameters: {
          't': selectedType.value,
          'area': selectedArea.value,
          'year': selectedYear.value,
          'sort': selectedSort.value,
          'pg': currentPage.value.toString(),
          'limit': '20',
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        final list = (data['data'] as List?)
                ?.map((e) => e as Map<String, dynamic>)
                .toList() ??
            [];

        if (list.isEmpty) {
          hasMore.value = false;
        } else {
          videoList.addAll(list);
        }

        Logger.success('Loaded more ${list.length} videos (deduplicated), page: ${currentPage.value}');
      }
    } catch (e) {
      Logger.error('Failed to load more videos: $e');
      currentPage.value--; // 回退页码
    } finally {
      isLoadingMore.value = false;
    }
  }
}
