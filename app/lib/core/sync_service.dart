import 'dart:async';
import 'package:get/get.dart';
import 'http_client.dart';
import 'user_store.dart';

/// 同步服务
/// 负责同步观看历史、播放进度等数据到服务器
class SyncService extends GetxController {
  static SyncService get to => Get.find();
  
  final _httpClient = HttpClient();
  final _userStore = UserStore.to;
  
  // 同步定时器
  Timer? _syncTimer;
  
  // 待同步的播放进度数据
  final Map<String, PlayProgress> _pendingSync = {};
  
  // 同步间隔（秒）
  static const int syncInterval = 30;
  
  @override
  void onInit() {
    super.onInit();
    _startSyncTimer();
  }
  
  @override
  void onClose() {
    _stopSyncTimer();
    super.onClose();
  }
  
  /// 启动同步定时器
  void _startSyncTimer() {
    _syncTimer = Timer.periodic(
      const Duration(seconds: syncInterval),
      (_) => _syncPendingData(),
    );
  }
  
  /// 停止同步定时器
  void _stopSyncTimer() {
    _syncTimer?.cancel();
    _syncTimer = null;
  }
  
  /// 记录播放进度（本地缓存，定时同步）
  void recordProgress({
    required String vodId,
    required String vodName,
    required String vodPic,
    required int progress,
    required int duration,
  }) {
    _pendingSync[vodId] = PlayProgress(
      vodId: vodId,
      vodName: vodName,
      vodPic: vodPic,
      progress: progress,
      duration: duration,
      updatedAt: DateTime.now().millisecondsSinceEpoch,
    );
    
    print('📝 Recorded progress for $vodName: $progress/$duration seconds');
  }
  
  /// 立即同步播放进度
  Future<void> syncProgress({
    required String vodId,
    required String vodName,
    required String vodPic,
    required int progress,
    required int duration,
  }) async {
    // 检查登录状态
    if (!_userStore.isLoggedIn) {
      print('⚠️ User not logged in, skip sync');
      return;
    }
    
    try {
      await _httpClient.post(
        '/user/sync',
        data: {
          'vod_id': vodId,
          'vod_name': vodName,
          'vod_pic': vodPic,
          'progress': progress,
          'duration': duration,
        },
      );
      
      print('✅ Synced progress for $vodName');
    } catch (e) {
      print('❌ Failed to sync progress: $e');
      // 同步失败，加入待同步队列
      recordProgress(
        vodId: vodId,
        vodName: vodName,
        vodPic: vodPic,
        progress: progress,
        duration: duration,
      );
    }
  }
  
  /// 同步待处理的数据
  Future<void> _syncPendingData() async {
    if (_pendingSync.isEmpty || !_userStore.isLoggedIn) {
      return;
    }
    
    print('🔄 Syncing ${_pendingSync.length} pending progress records...');
    
    final List<String> successIds = [];
    
    for (final entry in _pendingSync.entries) {
      try {
        await _httpClient.post(
          '/user/sync',
          data: {
            'vod_id': entry.value.vodId,
            'vod_name': entry.value.vodName,
            'vod_pic': entry.value.vodPic,
            'progress': entry.value.progress,
            'duration': entry.value.duration,
          },
        );
        
        successIds.add(entry.key);
        print('✅ Synced progress for ${entry.value.vodName}');
      } catch (e) {
        print('❌ Failed to sync ${entry.value.vodName}: $e');
      }
    }
    
    // 移除已成功同步的记录
    for (final id in successIds) {
      _pendingSync.remove(id);
    }
    
    if (successIds.isNotEmpty) {
      print('✅ Successfully synced ${successIds.length} records');
    }
  }
  
  /// 获取观看历史
  Future<List<HistoryItem>> getHistory({int page = 1, int pageSize = 20}) async {
    if (!_userStore.isLoggedIn) {
      return [];
    }
    
    try {
      final response = await _httpClient.get(
        '/api/user/history',
        queryParameters: {
          'page': page,
          'page_size': pageSize,
        },
      );
      
      if (response.data['code'] == 200 || response.statusCode == 200) {
        final data = response.data['data'] ?? response.data;
        final list = data['list'] ?? data;
        
        if (list is List) {
          return list.map((item) => HistoryItem.fromJson(item)).toList();
        }
      }
      
      return [];
    } catch (e) {
      print('❌ Failed to get history: $e');
      return [];
    }
  }
  
  /// 获取收藏列表
  Future<List<FavoriteItem>> getFavorites({int page = 1, int pageSize = 20}) async {
    if (!_userStore.isLoggedIn) {
      return [];
    }
    
    try {
      final response = await _httpClient.get(
        '/api/user/favorites',
        queryParameters: {
          'page': page,
          'page_size': pageSize,
        },
      );
      
      if (response.data['code'] == 200 || response.statusCode == 200) {
        final data = response.data['data'] ?? response.data;
        final list = data['list'] ?? data;
        
        if (list is List) {
          return list.map((item) => FavoriteItem.fromJson(item)).toList();
        }
      }
      
      return [];
    } catch (e) {
      print('❌ Failed to get favorites: $e');
      return [];
    }
  }
  
  /// 添加收藏
  Future<bool> addFavorite({
    required String vodId,
    required String vodName,
    required String vodPic,
  }) async {
    if (!_userStore.isLoggedIn) {
      Get.snackbar('提示', '请先登录');
      return false;
    }
    
    try {
      final response = await _httpClient.post(
        '/api/user/favorite',
        data: {
          'vod_id': vodId,
          'vod_name': vodName,
          'vod_pic': vodPic,
        },
      );
      
      if (response.data['code'] == 200 || response.statusCode == 200) {
        Get.snackbar('成功', '已添加到收藏');
        return true;
      }
      
      return false;
    } catch (e) {
      print('❌ Failed to add favorite: $e');
      Get.snackbar('失败', '添加收藏失败');
      return false;
    }
  }
  
  /// 取消收藏
  Future<bool> removeFavorite(String vodId) async {
    if (!_userStore.isLoggedIn) {
      return false;
    }
    
    try {
      final response = await _httpClient.delete('/api/user/favorite/$vodId');
      
      if (response.data['code'] == 200 || response.statusCode == 200) {
        Get.snackbar('成功', '已取消收藏');
        return true;
      }
      
      return false;
    } catch (e) {
      print('❌ Failed to remove favorite: $e');
      Get.snackbar('失败', '取消收藏失败');
      return false;
    }
  }
  
  /// 强制同步所有待处理数据
  Future<void> forceSyncAll() async {
    await _syncPendingData();
  }

  /// 删除单条观看历史
  Future<bool> deleteHistory(String vodId) async {
    if (!_userStore.isLoggedIn) {
      return false;
    }
    
    try {
      final response = await _httpClient.delete('/api/user/history/$vodId');
      
      if (response.data['code'] == 1 || response.statusCode == 200) {
        // 同时从待同步队列中移除
        _pendingSync.remove(vodId);
        return true;
      }
      
      return false;
    } catch (e) {
      print('❌ Failed to delete history: $e');
      return false;
    }
  }

  /// 清空所有观看历史
  Future<bool> clearHistory() async {
    if (!_userStore.isLoggedIn) {
      return false;
    }
    
    try {
      final response = await _httpClient.delete('/api/user/history');
      
      if (response.data['code'] == 1 || response.statusCode == 200) {
        // 清空待同步队列
        _pendingSync.clear();
        return true;
      }
      
      return false;
    } catch (e) {
      print('❌ Failed to clear history: $e');
      return false;
    }
  }
}

/// 播放进度模型
class PlayProgress {
  final String vodId;
  final String vodName;
  final String vodPic;
  final int progress;
  final int duration;
  final int updatedAt;
  
  PlayProgress({
    required this.vodId,
    required this.vodName,
    required this.vodPic,
    required this.progress,
    required this.duration,
    required this.updatedAt,
  });
}

/// 观看历史项
class HistoryItem {
  final String vodId;
  final String vodName;
  final String vodPic;
  final int progress;
  final int duration;
  final int updatedAt;
  
  HistoryItem({
    required this.vodId,
    required this.vodName,
    required this.vodPic,
    required this.progress,
    required this.duration,
    required this.updatedAt,
  });
  
  factory HistoryItem.fromJson(Map<String, dynamic> json) {
    return HistoryItem(
      vodId: json['vod_id']?.toString() ?? '',
      vodName: json['vod_name'] ?? '',
      vodPic: json['vod_pic'] ?? '',
      progress: json['progress'] ?? 0,
      duration: json['duration'] ?? 0,
      updatedAt: json['updated_at'] ?? 0,
    );
  }
  
  /// 计算观看进度百分比
  double get progressPercent {
    if (duration == 0) return 0;
    return (progress / duration * 100).clamp(0, 100);
  }
}

/// 收藏项
class FavoriteItem {
  final String vodId;
  final String vodName;
  final String vodPic;
  final int createdAt;
  
  FavoriteItem({
    required this.vodId,
    required this.vodName,
    required this.vodPic,
    required this.createdAt,
  });
  
  factory FavoriteItem.fromJson(Map<String, dynamic> json) {
    return FavoriteItem(
      vodId: json['vod_id']?.toString() ?? '',
      vodName: json['vod_name'] ?? '',
      vodPic: json['vod_pic'] ?? '',
      createdAt: json['created_at'] ?? 0,
    );
  }
}
