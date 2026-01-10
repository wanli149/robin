import 'dart:async';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../player_enums.dart';
import '../player_state.dart';
import '../../progress_sync_service.dart';
import '../../logger.dart';

/// 播放进度管理 Mixin
/// 
/// 负责播放进度的跟踪、保存和恢复功能：
/// - 定时跟踪播放进度
/// - 本地存储进度
/// - 云端同步进度
/// - 恢复上次播放位置
/// 
/// ## 使用方式
/// ```dart
/// class GlobalPlayerManager extends GetxController 
///     with PlayerProgressMixin {
///   // ...
/// }
/// ```
mixin PlayerProgressMixin on GetxController {
  /// 进度跟踪定时器
  Timer? _progressTimer;

  /// 进度监听器列表
  final List<Function(Duration position, Duration duration)> _progressListeners = [];

  /// 引导提示监听器列表
  final List<Function(String contentId, double progress)> _guidanceListeners = [];

  /// 已显示引导的内容ID集合
  final Set<String> _shownGuidanceIds = <String>{};

  /// 上次保存进度的时间
  DateTime? _lastSaveTime;

  /// 进度保存间隔（秒）
  static const int _saveIntervalSeconds = 10;

  // ==================== 抽象属性（由主类实现） ====================

  /// 获取当前播放状态
  PlayerState get currentPlayerState;

  /// 获取预加载状态
  bool get isPreloadingValue;

  /// 触发预加载下一集
  void triggerPreloadNextEpisode();

  // ==================== 监听器管理 ====================

  /// 添加进度监听器
  /// 
  /// 监听器会在每次进度更新时被调用
  /// 
  /// [listener] 回调函数，参数为当前位置和总时长
  void addProgressListener(Function(Duration position, Duration duration) listener) {
    _progressListeners.add(listener);
  }

  /// 移除进度监听器
  void removeProgressListener(Function(Duration position, Duration duration) listener) {
    _progressListeners.remove(listener);
  }

  /// 添加引导提示监听器
  /// 
  /// 当播放进度达到特定百分比时触发，用于显示引导提示
  void addGuidanceListener(Function(String contentId, double progress) listener) {
    _guidanceListeners.add(listener);
  }

  /// 移除引导提示监听器
  void removeGuidanceListener(Function(String contentId, double progress) listener) {
    _guidanceListeners.remove(listener);
  }

  /// 重置引导提示状态
  /// 
  /// 清除指定内容的引导显示记录，允许再次显示
  void resetGuidanceForContent(String contentId) {
    _shownGuidanceIds.remove(contentId);
  }

  // ==================== 进度跟踪 ====================

  /// 开始进度跟踪
  /// 
  /// 启动定时器，每秒更新一次进度
  void startProgressTracking() {
    stopProgressTracking();
    _progressTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      _onProgressTick();
    });
  }

  /// 停止进度跟踪
  void stopProgressTracking() {
    _progressTimer?.cancel();
    _progressTimer = null;
  }

  /// 进度跟踪回调
  void _onProgressTick() {
    final state = currentPlayerState;
    if (!state.isPlaying) return;

    final position = state.position;
    final duration = state.duration;

    // 通知进度监听器
    _notifyProgressListeners(position, duration);

    // 定时保存进度
    final now = DateTime.now();
    if (_lastSaveTime == null || 
        now.difference(_lastSaveTime!).inSeconds >= _saveIntervalSeconds) {
      saveProgress();
      _lastSaveTime = now;
    }
  }

  /// 通知进度监听器
  void _notifyProgressListeners(Duration position, Duration duration) {
    for (final listener in _progressListeners) {
      try {
        listener(position, duration);
      } catch (e) {
        Logger.error('Listener error: $e');
      }
    }

    // 检查是否需要预加载下一集
    if (duration.inSeconds > 0) {
      final progress = position.inSeconds / duration.inSeconds;
      final contentType = currentPlayerState.contentType;

      // 播放到 50% 时预加载下一集
      if (progress >= 0.5 && progress < 0.55 && !isPreloadingValue) {
        if (contentType == ContentType.shorts || contentType == ContentType.tv) {
          triggerPreloadNextEpisode();
        }
      }

      // 检查是否需要显示引导提示（仅短剧流）
      if (contentType == ContentType.shortsFlow) {
        _checkGuidanceTrigger(progress);
      }
    }
  }

  /// 检查引导提示触发条件
  void _checkGuidanceTrigger(double progress) {
    final contentId = currentPlayerState.contentId;

    // 播放到 30% 且未显示过引导时触发
    if (progress >= 0.3 && progress < 0.35 && !_shownGuidanceIds.contains(contentId)) {
      _shownGuidanceIds.add(contentId);
      _notifyGuidanceListeners(contentId, progress);
    }
  }

  /// 通知引导提示监听器
  void _notifyGuidanceListeners(String contentId, double progress) {
    for (final listener in _guidanceListeners) {
      try {
        listener(contentId, progress);
      } catch (e) {
        Logger.error('Guidance listener error: $e');
      }
    }
  }

  // ==================== 进度存储 ====================

  /// 保存播放进度
  /// 
  /// 同时保存到本地和云端（如果启用）
  Future<void> saveProgress() async {
    final state = currentPlayerState;
    if (state.contentId.isEmpty) return;

    try {
      await ProgressSyncService.to.saveProgress(
        contentType: state.contentType.name,
        contentId: state.contentId,
        episodeIndex: state.episodeIndex,
        positionSeconds: state.position.inSeconds,
        durationSeconds: state.duration.inSeconds,
      );
      Logger.debug('Saved: ${state.contentId} @ ${state.position.inSeconds}s');
    } catch (e) {
      // 降级到本地存储
      await _saveProgressLocally(state);
    }
  }

  /// 本地保存进度（降级方案）
  Future<void> _saveProgressLocally(PlayerState state) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = _getProgressKey(state.contentType, state.contentId, state.episodeIndex);
      await prefs.setInt(key, state.position.inSeconds);
      Logger.debug('Saved locally (fallback): $key');
    } catch (e) {
      Logger.error('Failed to save locally: $e');
    }
  }

  /// 加载保存的播放进度
  /// 
  /// 优先从云端加载，失败则从本地加载
  Future<Duration> loadSavedProgress(
    ContentType contentType,
    String contentId,
    int episodeIndex,
  ) async {
    try {
      return await ProgressSyncService.to.loadProgress(
        contentType: contentType.name,
        contentId: contentId,
        episodeIndex: episodeIndex,
      );
    } catch (e) {
      // 降级到本地存储
      return await _loadProgressLocally(contentType, contentId, episodeIndex);
    }
  }

  /// 本地加载进度（降级方案）
  Future<Duration> _loadProgressLocally(
    ContentType contentType,
    String contentId,
    int episodeIndex,
  ) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = _getProgressKey(contentType, contentId, episodeIndex);
      final savedSeconds = prefs.getInt(key) ?? 0;

      if (savedSeconds > 0) {
        Logger.debug('Loaded locally: $key = ${savedSeconds}s');
        return Duration(seconds: savedSeconds);
      }
    } catch (e) {
      Logger.error('Failed to load locally: $e');
    }

    return Duration.zero;
  }

  /// 清除指定内容的播放进度
  Future<void> clearProgress(
    ContentType contentType,
    String contentId,
    int episodeIndex,
  ) async {
    try {
      await ProgressSyncService.to.clearLocalProgress(
        contentType.name,
        contentId,
        episodeIndex,
      );
      Logger.debug('Cleared: $contentId');
    } catch (e) {
      Logger.error('Failed to clear: $e');
    }
  }

  /// 生成进度存储键
  String _getProgressKey(ContentType contentType, String contentId, int episodeIndex) {
    return 'progress_${contentType.name}_${contentId}_$episodeIndex';
  }

  /// 释放进度管理资源
  void disposeProgressMixin() {
    stopProgressTracking();
    _progressListeners.clear();
    _guidanceListeners.clear();
    _shownGuidanceIds.clear();
  }
}
