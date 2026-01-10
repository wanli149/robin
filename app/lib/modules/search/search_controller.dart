import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/http_client.dart';
import '../../core/logger.dart';

/// 搜索控制器
class SearchController extends GetxController {
  final HttpClient _httpClient = HttpClient();
  final TextEditingController searchTextController = TextEditingController();

  // 热搜词列表
  final RxList<String> hotSearchKeywords = <String>[].obs;

  // 搜索历史
  final RxList<String> searchHistory = <String>[].obs;

  // 搜索结果
  final RxList<Map<String, dynamic>> searchResults = <Map<String, dynamic>>[].obs;

  // 是否正在搜索
  final RxBool isSearching = false.obs;

  // 加载状态
  final RxBool isLoading = false.obs;

  // 错误信息
  final RxString error = ''.obs;

  @override
  void onInit() {
    super.onInit();
    loadHotSearchKeywords();
    loadSearchHistory();
  }

  @override
  void onClose() {
    searchTextController.dispose();
    super.onClose();
  }

  /// 加载热搜词（从后端 hot_search_stats 表获取）
  Future<void> loadHotSearchKeywords() async {
    try {
      final response = await _httpClient.get('/api/hot_search');
      
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1) {
          // 后端返回格式: { code: 1, data: ['keyword1', 'keyword2', ...] }
          final keywords = data['data'] as List<dynamic>?;
          if (keywords != null && keywords.isNotEmpty) {
            hotSearchKeywords.value = keywords.map((k) => k.toString()).toList();
            Logger.success('Loaded ${keywords.length} hot search keywords');
            return;
          }
        }
      }
      
      // 热搜为空或加载失败，保持空列表
      hotSearchKeywords.value = [];
    } catch (e) {
      Logger.error('Failed to load hot search keywords: $e');
      // 热搜加载失败时保持空列表
      hotSearchKeywords.value = [];
    }
  }

  /// 加载搜索历史
  Future<void> loadSearchHistory() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final history = prefs.getStringList('search_history') ?? [];
      searchHistory.value = history;
    } catch (e) {
      Logger.error('Failed to load search history: $e');
    }
  }

  /// 保存搜索历史
  Future<void> saveSearchHistory(String keyword) async {
    try {
      // 移除重复项
      searchHistory.remove(keyword);

      // 添加到开头
      searchHistory.insert(0, keyword);

      // 最多保存 10 条
      if (searchHistory.length > 10) {
        searchHistory.removeRange(10, searchHistory.length);
      }

      // 保存到本地
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList('search_history', searchHistory);
    } catch (e) {
      Logger.error('Failed to save search history: $e');
    }
  }

  /// 清除搜索历史
  Future<void> clearHistory() async {
    try {
      searchHistory.clear();
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('search_history');

      Get.snackbar(
        '提示',
        '已清除搜索历史',
        snackPosition: SnackPosition.BOTTOM,
      );
    } catch (e) {
      Logger.error('Failed to clear search history: $e');
    }
  }

  /// 搜索
  Future<void> search(String keyword) async {
    if (keyword.trim().isEmpty) return;

    try {
      isSearching.value = true;
      isLoading.value = true;
      error.value = '';
      searchResults.clear();

      // 更新搜索框文本
      searchTextController.text = keyword;

      // 保存到搜索历史
      await saveSearchHistory(keyword);

      // 🚀 优化：优先使用缓存搜索（FTS5全文索引，50ms响应）
      var response = await _httpClient.get(
        '/api/search_cache',
        queryParameters: {'wd': keyword, 'limit': '20'},
      );

      // 如果缓存搜索失败或无结果，降级到实时搜索
      if (response.statusCode != 200 || 
          response.data == null || 
          (response.data['data'] as List?)?.isEmpty == true) {
        Logger.warning('Cache search failed, fallback to real-time search');
        response = await _httpClient.get(
          '/api/search',
          queryParameters: {'wd': keyword},
        );
      } else {
        Logger.success('Using cache search (fast)');
      }

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        final list = (data['data'] as List?)
                ?.map((e) => e as Map<String, dynamic>)
                .toList() ??
            [];

        searchResults.value = list;

        Logger.success('Search results: ${list.length} items for "$keyword"');
      }
    } catch (e) {
      Logger.error('Failed to search: $e');
      error.value = '搜索失败，请重试';
    } finally {
      isLoading.value = false;
    }
  }

  /// 取消搜索
  void cancelSearch() {
    isSearching.value = false;
    searchTextController.clear();
    searchResults.clear();
    error.value = '';
  }
}
