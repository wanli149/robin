import 'dart:async';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'http_client.dart';

/// 播放进度同步策略枚举
/// 
/// 定义进度数据的存储和同步方式，支持三种策略：
/// - [localOnly]: 仅本地存储，不进行云端同步
/// - [localCloud]: 本地存储 + 云端同步（推荐）
/// - [cloudOnly]: 仅云端存储，不保留本地缓存
enum SyncStrategy {
  /// 仅本地存储
  /// 
  /// 进度数据只保存在设备本地，不会上传到云端。
  /// 适用于：离线使用、隐私敏感用户
  localOnly,
  
  /// 本地 + 云端同步
  /// 
  /// 进度数据同时保存在本地和云端，支持多设备同步。
  /// 适用于：多设备用户、需要数据备份
  localCloud,
  
  /// 仅云端存储
  /// 
  /// 进度数据只保存在云端，本地不缓存。
  /// 适用于：存储空间有限的设备
  cloudOnly,
}

/// 存储配置类
/// 
/// 定义进度同步服务的配置参数，包括存储类型、同步策略和同步间隔。
/// 
/// ## 配置来源
/// 配置从服务端 `/api/storage/config` 接口获取，支持热更新。
/// 
/// ## 示例 JSON
/// ```json
/// {
///   "storage_type": "local",
///   "is_enabled": true,
///   "sync_strategy": "local_cloud",
///   "sync_interval": 30
/// }
/// ```
class StorageConfig {
  /// 存储类型标识
  /// 
  /// 可选值：'local', 'cloud', 'hybrid'
  final String storageType;
  
  /// 是否启用云端同步
  /// 
  /// 为 false 时，所有进度只保存在本地
  final bool isEnabled;
  
  /// 同步策略
  /// 
  /// 决定数据如何在本地和云端之间同步
  final SyncStrategy syncStrategy;
  
  /// 同步间隔（秒）
  /// 
  /// 定时同步的时间间隔，默认 30 秒
  final int syncInterval;

  StorageConfig({
    required this.storageType,
    required this.isEnabled,
    required this.syncStrategy,
    required this.syncInterval,
  });

  /// 从 JSON 创建配置实例
  /// 
  /// [json] 服务端返回的配置数据
  factory StorageConfig.fromJson(Map<String, dynamic> json) {
    return StorageConfig(
      storageType: json['storage_type'] ?? 'local',
      isEnabled: json['is_enabled'] ?? false,
      syncStrategy: _parseSyncStrategy(json['sync_strategy']),
      syncInterval: json['sync_interval'] ?? 30,
    );
  }

  /// 解析同步策略字符串
  static SyncStrategy _parseSyncStrategy(String? strategy) {
    switch (strategy) {
      case 'local_cloud':
        return SyncStrategy.localCloud;
      case 'cloud_only':
        return SyncStrategy.cloudOnly;
      default:
        return SyncStrategy.localOnly;
    }
  }

  /// 创建默认配置（仅本地存储）
  /// 
  /// 当无法从服务端获取配置时使用此默认配置
  factory StorageConfig.defaultConfig() {
    return StorageConfig(
      storageType: 'local',
      isEnabled: false,
      syncStrategy: SyncStrategy.localOnly,
      syncInterval: 30,
    );
  }
}

/// 播放进度数据模型
/// 
/// 封装单条播放进度记录，用于本地存储和云端同步。
/// 
/// ## 数据结构
/// ```json
/// {
///   "content_type": "tv",
///   "content_id": "12345",
///   "episode_index": 3,
///   "position_seconds": 1234,
///   "duration_seconds": 2700,
///   "updated_at": 1702800000
/// }
/// ```
class ProgressData {
  /// 内容类型
  /// 
  /// 可选值：'tv'（电视剧）, 'movie'（电影）, 'shorts'（短剧）
  final String contentType;
  
  /// 内容唯一标识
  /// 
  /// 对应视频的 vod_id
  final String contentId;
  
  /// 集数索引
  /// 
  /// 从 1 开始，电影类型固定为 1
  final int episodeIndex;
  
  /// 播放位置（秒）
  /// 
  /// 当前播放到的时间点
  final int positionSeconds;
  
  /// 视频总时长（秒）
  /// 
  /// 用于计算播放进度百分比
  final int durationSeconds;
  
  /// 更新时间戳（Unix 秒）
  /// 
  /// 用于多设备同步时的冲突解决
  final int updatedAt;

  ProgressData({
    required this.contentType,
    required this.contentId,
    required this.episodeIndex,
    required this.positionSeconds,
    required this.durationSeconds,
    required this.updatedAt,
  });

  /// 转换为 JSON 格式（用于 API 请求）
  Map<String, dynamic> toJson() => {
    'content_type': contentType,
    'content_id': contentId,
    'episode_index': episodeIndex,
    'position_seconds': positionSeconds,
    'duration_seconds': durationSeconds,
  };

  /// 从 JSON 创建实例
  factory ProgressData.fromJson(Map<String, dynamic> json) {
    return ProgressData(
      contentType: json['content_type'] ?? 'tv',
      contentId: json['content_id'] ?? '',
      episodeIndex: json['episode_index'] ?? 1,
      positionSeconds: json['position_seconds'] ?? 0,
      durationSeconds: json['duration_seconds'] ?? 0,
      updatedAt: json['updated_at'] ?? 0,
    );
  }
}

/// 播放进度同步服务
/// 
/// 负责管理视频播放进度的本地存储和云端同步，支持多设备进度同步。
/// 
/// ## 功能特性
/// - 本地存储：使用 SharedPreferences 持久化进度
/// - 云端同步：定时批量上传进度到服务端
/// - 多设备同步：通过设备 ID 关联用户数据
/// - 冲突解决：以最新的进度为准
/// 
/// ## 使用方式
/// ```dart
/// // 获取单例
/// final syncService = ProgressSyncService.to;
/// 
/// // 保存播放进度
/// await syncService.saveProgress(
///   contentType: 'tv',
///   contentId: '12345',
///   episodeIndex: 3,
///   positionSeconds: 1234,
///   durationSeconds: 2700,
/// );
/// 
/// // 读取播放进度
/// final progress = await syncService.loadProgress(
///   contentType: 'tv',
///   contentId: '12345',
///   episodeIndex: 3,
/// );
/// ```
/// 
/// ## 同步机制
/// 1. 进度保存时立即写入本地
/// 2. 同时加入待同步队列
/// 3. 定时器定期批量上传（默认 30 秒）
/// 4. 队列超过 10 条时立即同步
/// 
/// ## API 接口
/// - `GET /api/storage/config`: 获取存储配置
/// - `GET /api/progress/{id}`: 获取单条进度
/// - `GET /api/progress/pull`: 拉取所有进度
/// - `POST /api/progress/sync`: 批量同步进度
/// 
/// ## 本地存储 Key 格式
/// `progress_{contentType}_{contentId}_{episodeIndex}`
class ProgressSyncService extends GetxController {
  /// 获取单例实例
  static ProgressSyncService get to => Get.find<ProgressSyncService>();

  /// HTTP 客户端
  final HttpClient _httpClient = HttpClient();
  
  /// 存储配置（响应式）
  final Rx<StorageConfig> config = StorageConfig.defaultConfig().obs;
  
  /// 待同步的进度队列
  /// 
  /// 进度数据先加入队列，定时批量上传
  final List<ProgressData> _pendingSyncQueue = [];
  
  /// 同步定时器
  Timer? _syncTimer;
  
  /// 上次同步时间戳（Unix 秒）
  /// 
  /// 用于增量拉取云端进度
  int _lastSyncTime = 0;
  
  /// 设备唯一标识
  /// 
  /// 用于关联用户的多设备数据
  String? _deviceId;

  @override
  void onInit() {
    super.onInit();
    _initService();
  }

  @override
  void onClose() {
    _syncTimer?.cancel();
    // 关闭前同步一次
    _flushPendingSync();
    super.onClose();
  }

  /// 初始化服务
  Future<void> _initService() async {
    await _loadDeviceId();
    await _loadStorageConfig();
    _startSyncTimer();
    print('📦 [ProgressSync] Service initialized');
  }

  /// 加载设备ID
  Future<void> _loadDeviceId() async {
    final prefs = await SharedPreferences.getInstance();
    _deviceId = prefs.getString('device_id');
    
    if (_deviceId == null) {
      // 生成新的设备ID
      _deviceId = 'device_${DateTime.now().millisecondsSinceEpoch}';
      await prefs.setString('device_id', _deviceId!);
    }
    
    print('📦 [ProgressSync] Device ID: $_deviceId');
  }

  /// 从服务端加载存储配置
  Future<void> _loadStorageConfig() async {
    try {
      final response = await _httpClient.get('/api/storage/config');
      
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1 && data['data'] != null) {
          config.value = StorageConfig.fromJson(data['data']);
          print('📦 [ProgressSync] Config loaded: ${config.value.syncStrategy}');
          
          // 如果启用了云端同步，拉取云端进度
          if (config.value.isEnabled && 
              config.value.syncStrategy != SyncStrategy.localOnly) {
            await _pullCloudProgress();
          }
          return;
        }
      }
    } catch (e) {
      print('❌ [ProgressSync] Failed to load config: $e');
    }
    
    // 使用默认配置
    config.value = StorageConfig.defaultConfig();
  }

  /// 刷新配置（热更新）
  Future<void> refreshConfig() async {
    await _loadStorageConfig();
    _restartSyncTimer();
  }

  /// 启动同步定时器
  void _startSyncTimer() {
    _syncTimer?.cancel();
    
    if (config.value.isEnabled && 
        config.value.syncStrategy != SyncStrategy.localOnly) {
      _syncTimer = Timer.periodic(
        Duration(seconds: config.value.syncInterval),
        (_) => _flushPendingSync(),
      );
      print('📦 [ProgressSync] Sync timer started: ${config.value.syncInterval}s');
    }
  }

  /// 重启同步定时器
  void _restartSyncTimer() {
    _syncTimer?.cancel();
    _startSyncTimer();
  }

  /// 保存播放进度
  Future<void> saveProgress({
    required String contentType,
    required String contentId,
    required int episodeIndex,
    required int positionSeconds,
    int durationSeconds = 0,
  }) async {
    final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    
    // 1. 始终保存到本地
    await _saveToLocal(contentType, contentId, episodeIndex, positionSeconds);
    
    // 2. 如果启用了云端同步，加入同步队列
    if (config.value.isEnabled && 
        config.value.syncStrategy != SyncStrategy.localOnly) {
      _pendingSyncQueue.add(ProgressData(
        contentType: contentType,
        contentId: contentId,
        episodeIndex: episodeIndex,
        positionSeconds: positionSeconds,
        durationSeconds: durationSeconds,
        updatedAt: now,
      ));
      
      // 如果队列过大，立即同步
      if (_pendingSyncQueue.length >= 10) {
        _flushPendingSync();
      }
    }
  }

  /// 读取播放进度
  Future<Duration> loadProgress({
    required String contentType,
    required String contentId,
    required int episodeIndex,
  }) async {
    // 优先从本地读取（快速）
    final localProgress = await _loadFromLocal(contentType, contentId, episodeIndex);
    
    // 如果启用了云端同步，检查云端是否有更新的进度
    if (config.value.isEnabled && 
        config.value.syncStrategy != SyncStrategy.localOnly) {
      final cloudProgress = await _loadFromCloud(contentType, contentId, episodeIndex);
      
      if (cloudProgress != null && cloudProgress.inSeconds > localProgress.inSeconds) {
        // 云端进度更新，使用云端进度并更新本地
        await _saveToLocal(contentType, contentId, episodeIndex, cloudProgress.inSeconds);
        return cloudProgress;
      }
    }
    
    return localProgress;
  }

  /// 保存到本地
  Future<void> _saveToLocal(String contentType, String contentId, int episodeIndex, int positionSeconds) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = 'progress_${contentType}_${contentId}_$episodeIndex';
      await prefs.setInt(key, positionSeconds);
      print('💾 [ProgressSync] Local saved: $key = ${positionSeconds}s');
    } catch (e) {
      print('❌ [ProgressSync] Failed to save local: $e');
    }
  }

  /// 从本地读取
  Future<Duration> _loadFromLocal(String contentType, String contentId, int episodeIndex) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = 'progress_${contentType}_${contentId}_$episodeIndex';
      final savedSeconds = prefs.getInt(key) ?? 0;
      
      if (savedSeconds > 0) {
        print('📖 [ProgressSync] Local loaded: $key = ${savedSeconds}s');
        return Duration(seconds: savedSeconds);
      }
    } catch (e) {
      print('❌ [ProgressSync] Failed to load local: $e');
    }
    
    return Duration.zero;
  }

  /// 从云端读取单个进度
  Future<Duration?> _loadFromCloud(String contentType, String contentId, int episodeIndex) async {
    if (_deviceId == null) return null;
    
    try {
      final response = await _httpClient.get(
        '/api/progress/$contentId',
        queryParameters: {
          'user_id': _deviceId,
          'content_type': contentType,
          'episode_index': episodeIndex.toString(),
        },
      );
      
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1 && data['data'] != null) {
          final positionSeconds = data['data']['position_seconds'] as int? ?? 0;
          if (positionSeconds > 0) {
            print('☁️ [ProgressSync] Cloud loaded: $contentId = ${positionSeconds}s');
            return Duration(seconds: positionSeconds);
          }
        }
      }
    } catch (e) {
      print('❌ [ProgressSync] Failed to load from cloud: $e');
    }
    
    return null;
  }

  /// 拉取云端所有进度
  Future<void> _pullCloudProgress() async {
    if (_deviceId == null) return;
    
    try {
      final response = await _httpClient.get(
        '/api/progress/pull',
        queryParameters: {
          'user_id': _deviceId,
          'since': _lastSyncTime.toString(),
        },
      );
      
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1 && data['data'] != null) {
          final progressList = data['data']['progress_list'] as List? ?? [];
          final serverTime = data['data']['server_time'] as int? ?? 0;
          
          // 更新本地进度
          for (final item in progressList) {
            final progress = ProgressData.fromJson(item);
            await _saveToLocal(
              progress.contentType,
              progress.contentId,
              progress.episodeIndex,
              progress.positionSeconds,
            );
          }
          
          _lastSyncTime = serverTime;
          print('☁️ [ProgressSync] Pulled ${progressList.length} records from cloud');
        }
      }
    } catch (e) {
      print('❌ [ProgressSync] Failed to pull cloud progress: $e');
    }
  }

  /// 刷新待同步队列
  Future<void> _flushPendingSync() async {
    if (_pendingSyncQueue.isEmpty || _deviceId == null) return;
    
    // 复制队列并清空
    final toSync = List<ProgressData>.from(_pendingSyncQueue);
    _pendingSyncQueue.clear();
    
    try {
      final response = await _httpClient.post(
        '/api/progress/sync',
        data: {
          'user_id': _deviceId,
          'progress_list': toSync.map((p) => p.toJson()).toList(),
        },
      );
      
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1) {
          final syncedCount = data['data']?['synced_count'] ?? 0;
          print('☁️ [ProgressSync] Synced $syncedCount records to cloud');
          return;
        }
      }
      
      // 同步失败，放回队列
      _pendingSyncQueue.addAll(toSync);
      print('❌ [ProgressSync] Sync failed, re-queued ${toSync.length} records');
    } catch (e) {
      // 同步失败，放回队列
      _pendingSyncQueue.addAll(toSync);
      print('❌ [ProgressSync] Sync error: $e');
    }
  }

  /// 清除本地进度
  Future<void> clearLocalProgress(String contentType, String contentId, int episodeIndex) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = 'progress_${contentType}_${contentId}_$episodeIndex';
      await prefs.remove(key);
      print('🗑️ [ProgressSync] Cleared local: $key');
    } catch (e) {
      print('❌ [ProgressSync] Failed to clear local: $e');
    }
  }
}
