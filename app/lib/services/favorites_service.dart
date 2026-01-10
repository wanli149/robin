import 'package:get/get.dart';
import '../core/http_client.dart';
import '../core/user_store.dart';
import '../core/logger.dart';

/// 收藏项数据模型
class FavoriteItem {
  final String vodId;
  final String vodName;
  final String vodPic;
  final String? vodType;
  final DateTime createdAt;

  FavoriteItem({
    required this.vodId,
    required this.vodName,
    required this.vodPic,
    this.vodType,
    required this.createdAt,
  });

  factory FavoriteItem.fromJson(Map<String, dynamic> json) {
    int timestamp = 0;
    if (json['created_at'] != null) {
      if (json['created_at'] is int) {
        timestamp = json['created_at'];
      } else {
        timestamp = int.tryParse(json['created_at'].toString()) ?? 0;
      }
    }
    
    return FavoriteItem(
      vodId: json['vod_id']?.toString() ?? '',
      vodName: json['vod_name'] ?? '',
      vodPic: json['vod_pic'] ?? '',
      vodType: json['vod_type'],
      createdAt: timestamp > 0
          ? DateTime.fromMillisecondsSinceEpoch(timestamp * 1000)
          : DateTime.now(),
    );
  }
}

/// 收藏服务
/// 
/// 提供收藏功能的统一接口，支持：
/// - 添加/取消收藏
/// - 获取收藏列表
/// - 检查是否已收藏（本地缓存，快速查询）
/// 
/// ## 使用示例
/// ```dart
/// // 添加收藏
/// await FavoritesService.to.addFavorite(
///   vodId: '12345',
///   vodName: '视频名称',
///   vodPic: 'https://example.com/cover.jpg',
/// );
/// 
/// // 检查是否已收藏（快速查询，不需要网络请求）
/// final isFavorited = FavoritesService.to.isFavorited('12345');
/// 
/// // 切换收藏状态
/// await FavoritesService.to.toggleFavorite(
///   vodId: '12345',
///   vodName: '视频名称',
///   vodPic: 'https://example.com/cover.jpg',
/// );
/// ```
class FavoritesService extends GetxController {
  static FavoritesService get to => Get.find<FavoritesService>();

  final HttpClient _httpClient = HttpClient();

  /// 收藏列表
  final RxList<FavoriteItem> favorites = <FavoriteItem>[].obs;

  /// 收藏ID集合（用于快速查询）
  final RxSet<String> _favoriteIds = <String>{}.obs;

  /// 是否正在加载
  final RxBool isLoading = false.obs;

  /// 是否已初始化
  final RxBool _isInitialized = false.obs;

  @override
  void onInit() {
    super.onInit();
    // 监听登录状态变化
    ever(UserStore.to.isLoggedInRx, (isLoggedIn) {
      if (isLoggedIn) {
        loadFavorites();
      } else {
        _clearLocalData();
      }
    });

    // 如果已登录，立即加载收藏
    if (UserStore.to.isLoggedIn) {
      loadFavorites();
    }
  }

  /// 加载收藏列表
  Future<void> loadFavorites() async {
    if (!UserStore.to.isLoggedIn) return;

    try {
      isLoading.value = true;

      final response = await _httpClient.get('/api/user/favorites');

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1 && data['data'] != null) {
          final list = (data['data'] as List)
              .map((e) => FavoriteItem.fromJson(e))
              .toList();

          favorites.value = list;
          _favoriteIds.clear();
          _favoriteIds.addAll(list.map((e) => e.vodId));
          _isInitialized.value = true;

          Logger.success('[Favorites] Loaded ${list.length} items');
        }
      }
    } catch (e) {
      Logger.error('[Favorites] Failed to load: $e');
    } finally {
      isLoading.value = false;
    }
  }

  /// 检查是否已收藏（快速查询，不需要网络请求）
  bool isFavorited(String vodId) {
    return _favoriteIds.contains(vodId);
  }

  /// 添加收藏
  Future<bool> addFavorite({
    required String vodId,
    required String vodName,
    required String vodPic,
    String? vodType,
  }) async {
    if (!UserStore.to.isLoggedIn) {
      UserStore.to.requireLoginForFeature('favorites');
      return false;
    }

    try {
      final response = await _httpClient.post(
        '/api/user/favorite',
        data: {
          'vod_id': vodId,
          'vod_name': vodName,
          'vod_pic': vodPic,
          'vod_type': vodType,
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1) {
          // 更新本地状态
          _favoriteIds.add(vodId);
          favorites.insert(
            0,
            FavoriteItem(
              vodId: vodId,
              vodName: vodName,
              vodPic: vodPic,
              vodType: vodType,
              createdAt: DateTime.now(),
            ),
          );

          Logger.success('[Favorites] Added: $vodId');
          return true;
        }
      }
    } catch (e) {
      Logger.error('[Favorites] Failed to add: $e');
    }

    return false;
  }

  /// 取消收藏
  Future<bool> removeFavorite(String vodId) async {
    if (!UserStore.to.isLoggedIn) return false;

    try {
      final response = await _httpClient.delete('/api/user/favorite/$vodId');

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1) {
          // 更新本地状态
          _favoriteIds.remove(vodId);
          favorites.removeWhere((item) => item.vodId == vodId);

          Logger.success('[Favorites] Removed: $vodId');
          return true;
        }
      }
    } catch (e) {
      Logger.error('[Favorites] Failed to remove: $e');
    }

    return false;
  }

  /// 切换收藏状态
  /// 
  /// 返回操作后的收藏状态：true = 已收藏，false = 未收藏，null = 操作失败
  Future<bool?> toggleFavorite({
    required String vodId,
    required String vodName,
    required String vodPic,
    String? vodType,
  }) async {
    if (!UserStore.to.isLoggedIn) {
      UserStore.to.requireLoginForFeature('favorites');
      return null;
    }

    if (isFavorited(vodId)) {
      final success = await removeFavorite(vodId);
      return success ? false : null;
    } else {
      final success = await addFavorite(
        vodId: vodId,
        vodName: vodName,
        vodPic: vodPic,
        vodType: vodType,
      );
      return success ? true : null;
    }
  }

  /// 清除本地数据
  void _clearLocalData() {
    favorites.clear();
    _favoriteIds.clear();
    _isInitialized.value = false;
  }
}
