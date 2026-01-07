import 'dart:async';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:video_player/video_player.dart';
import 'package:flutter/services.dart';

import 'player_enums.dart';
import 'player_config.dart';
import 'player_state.dart';
import 'mixins/player_wakelock_mixin.dart';
import 'mixins/player_fullscreen_mixin.dart';
import 'mixins/player_progress_mixin.dart';
import 'mixins/player_preload_mixin.dart';
import 'mixins/player_pip_mixin.dart';
import 'mixins/player_listeners_mixin.dart';
import '../http_client.dart';
import '../pip_manager.dart';
import '../progress_sync_service.dart';

/// 全局播放器管理器
/// 
/// 单例模式管理整个应用的视频播放，确保同一时间只有一个播放器实例。
/// 
/// ## 核心功能
/// - 统一管理视频播放器实例
/// - 支持多种播放模式（小窗、全屏、画中画、流模式）
/// - 自动保存和恢复播放进度
/// - 智能预加载下一集
/// - 自动重试机制
/// 
/// ## 架构设计
/// 使用 Mixin 模式拆分功能：
/// - [PlayerWakelockMixin] - 防熄屏管理
/// - [PlayerFullscreenMixin] - 全屏管理
/// - [PlayerProgressMixin] - 进度管理
/// - [PlayerPreloadMixin] - 预加载管理
/// - [PlayerPipMixin] - 画中画管理
/// - [PlayerListenersMixin] - 监听器管理
/// 
/// ## 使用示例
/// ```dart
/// // 切换播放内容
/// await GlobalPlayerManager.to.switchContent(
///   contentType: ContentType.tv,
///   contentId: '12345',
///   episodeIndex: 1,
///   config: PlayerConfig.tvWindow(),
///   videoUrl: 'https://example.com/video.m3u8',
/// );
/// 
/// // 播放控制
/// GlobalPlayerManager.to.play();
/// GlobalPlayerManager.to.pause();
/// GlobalPlayerManager.to.togglePlayPause();
/// 
/// // 进入全屏
/// GlobalPlayerManager.to.enterFullscreen();
/// ```
class GlobalPlayerManager extends GetxController
    with
        WidgetsBindingObserver,
        PlayerWakelockMixin,
        PlayerFullscreenMixin,
        PlayerProgressMixin,
        PlayerPreloadMixin,
        PlayerPipMixin,
        PlayerListenersMixin {
  
  /// 获取单例实例
  static GlobalPlayerManager get to => Get.find<GlobalPlayerManager>();

  // ==================== 核心属性 ====================

  /// HTTP 客户端
  final HttpClient _httpClient = HttpClient();

  /// 唯一播放器实例
  VideoPlayerController? _playerInstance;

  /// 获取播放器实例（只读）
  VideoPlayerController? get playerInstance => _playerInstance;

  /// 当前播放器配置
  final Rx<PlayerConfig> currentConfig = PlayerConfig.shortsWindow().obs;

  /// 当前播放状态
  final Rx<PlayerState> currentState = PlayerState.initial().obs;

  /// 播放器模式
  final Rx<PlayerMode> playerMode = PlayerMode.window.obs;

  /// 加载状态
  final RxBool isLoading = false.obs;

  /// 错误信息
  final RxString error = ''.obs;

  /// 重试计数
  final RxInt retryCount = 0.obs;

  /// 最大重试次数
  static const int maxRetryCount = 3;

  /// 播放许可标志（页面可见性控制）
  bool _shouldAutoPlay = true;

  /// 切换开始时间（性能监控）
  DateTime? _switchStartTime;

  /// 切换延迟（毫秒）
  final RxInt switchLatency = 0.obs;

  // ==================== 暂停广告相关 ====================

  /// 暂停广告数据
  final Rx<Map<String, dynamic>?> pauseAdData = Rx<Map<String, dynamic>?>(null);

  /// 是否显示暂停广告
  final RxBool showPauseAd = false.obs;

  // ==================== 播放/暂停防抖 ====================

  /// 上次切换时间
  DateTime? _lastToggleTime;

  /// 防抖间隔（毫秒）
  static const int _toggleDebounceMs = 300;

  // ==================== Mixin 接口实现 ====================

  // PlayerWakelockMixin
  @override
  bool get isInPipModeValue => PipManager.to.isInPipMode.value;

  @override
  bool get isPlayingValue => currentState.value.isPlaying;

  // PlayerFullscreenMixin
  @override
  PlayerState get currentPlayerState => currentState.value;

  @override
  Rx<PlayerMode> get playerModeRx => playerMode;

  @override
  Rx<PlayerConfig> get currentConfigRx => currentConfig;

  @override
  bool get isPlayerInstancePlaying => _playerInstance?.value.isPlaying ?? false;

  @override
  Future<void> resumePlay() async => await play();

  @override
  void notifyStateListeners() => notifyStateListenersInternal(currentState.value);

  // PlayerProgressMixin
  @override
  bool get isPreloadingValue => isPreloading.value;

  @override
  void triggerPreloadNextEpisode() => preloadNextEpisode();

  // PlayerPreloadMixin
  @override
  Future<String> getVideoUrl(ContentType contentType, String contentId, int episodeIndex) {
    return _getVideoUrl(contentType, contentId, episodeIndex);
  }

  // PlayerPipMixin
  @override
  VideoPlayerController? get playerInstanceValue => _playerInstance;

  // ==================== 生命周期 ====================

  @override
  void onInit() {
    super.onInit();
    WidgetsBinding.instance.addObserver(this);
    PipManager.to.registerPlayerCallback(_onAppLifecycleChanged);
    _loadPauseAdConfig();
    print('🎬 [GlobalPlayer] Manager initialized');
  }

  @override
  void onClose() {
    WidgetsBinding.instance.removeObserver(this);
    PipManager.to.unregisterPlayerCallback(_onAppLifecycleChanged);
    
    // 保存进度
    saveProgress();
    
    // 释放资源
    disposeWakelockMixin();
    disposeProgressMixin();
    disposePreloadMixin();
    disposeListenersMixin();
    _disposePlayer();
    
    super.onClose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    print('🎬 [GlobalPlayer] Flutter lifecycle state: $state');
  }

  /// 处理应用生命周期变化
  void _onAppLifecycleChanged(String state) {
    print('🎬 [GlobalPlayer] Lifecycle change: $state');

    switch (state) {
      case 'paused':
        if (!PipManager.to.isInPipMode.value) {
          saveProgress();
          pause();
        }
        break;
      case 'resumed':
        // 不自动播放，让用户手动控制
        break;
      case 'pip_entered_keep_playing':
        saveProgress();
        switchToPipMode();
        break;
      case 'pip_exited':
        exitPipMode();
        break;
    }
  }

  // ==================== 核心播放控制 ====================

  /// 切换播放内容
  /// 
  /// 切换到新的视频内容，自动处理：
  /// - 停止当前播放
  /// - 创建新播放器实例
  /// - 恢复播放进度
  /// - 自动播放（如果启用）
  /// 
  /// [contentType] 内容类型
  /// [contentId] 内容ID
  /// [episodeIndex] 集数索引（从1开始）
  /// [config] 播放器配置
  /// [videoUrl] 视频URL（可选，不提供则自动获取）
  /// [autoPlay] 是否自动播放
  Future<void> switchContent({
    required ContentType contentType,
    required String contentId,
    required int episodeIndex,
    required PlayerConfig config,
    String? videoUrl,
    bool autoPlay = true,
  }) async {
    try {
      print('🎬 [GlobalPlayer] Switching: $contentType, $contentId, ep: $episodeIndex');

      _switchStartTime = DateTime.now();
      isLoading.value = true;
      error.value = '';

      // 检查是否是相同内容
      final isSameContent = currentState.value.contentType == contentType &&
          currentState.value.contentId == contentId;

      // 停止当前播放
      await _stopCurrentPlayback();

      // 不同内容时清理预加载缓存
      if (!isSameContent) {
        clearPreloadCache();
      }

      // 更新配置和状态
      currentConfig.value = config;
      currentState.value = currentState.value.copyWith(
        contentType: contentType,
        contentId: contentId,
        episodeIndex: episodeIndex,
        position: Duration.zero,
        isPlaying: false,
      );

      // 获取视频URL
      String playUrl = videoUrl ?? '';
      if (playUrl.isEmpty) {
        playUrl = await _getVideoUrl(contentType, contentId, episodeIndex);
      }

      if (playUrl.isEmpty) {
        throw Exception('无法获取视频播放地址');
      }

      // 创建播放器实例
      await _createPlayerInstance(playUrl);
      await _applyPlayerConfig(config);

      retryCount.value = 0;

      // 恢复播放进度（非短剧流模式）
      if (contentType != ContentType.shortsFlow) {
        final savedProgress = await loadSavedProgress(contentType, contentId, episodeIndex);
        if (savedProgress.inSeconds > 0 && _playerInstance != null) {
          final duration = _playerInstance!.value.duration;
          if (duration.inSeconds > 0 && savedProgress.inSeconds < duration.inSeconds * 0.95) {
            await _playerInstance!.seekTo(savedProgress);
            print('🎬 [GlobalPlayer] Restored progress: ${savedProgress.inSeconds}s');
          }
        }
      }

      // 自动播放
      if (autoPlay && _shouldAutoPlay) {
        if (contentType == ContentType.shortsFlow) {
          if (_isPlayerVisible()) {
            await play();
          }
        } else {
          await play();
        }
      }

      notifyStateListeners();

      // 预加载下一集
      if (contentType == ContentType.shorts || contentType == ContentType.tv) {
        preloadNextEpisode();
      }

      // 记录切换延迟
      if (_switchStartTime != null) {
        switchLatency.value = DateTime.now().difference(_switchStartTime!).inMilliseconds;
        print('📊 [GlobalPlayer] Switch latency: ${switchLatency.value}ms');
      }

      print('🎬 [GlobalPlayer] Content switched successfully');
    } catch (e) {
      error.value = '播放器初始化失败: $e';
      print('❌ [GlobalPlayer] Failed to switch: $e');

      // 自动重试
      if (retryCount.value < maxRetryCount && _shouldRetry(e)) {
        retryCount.value++;
        print('🔄 [GlobalPlayer] Retry ${retryCount.value}/$maxRetryCount');

        Future.delayed(Duration(seconds: retryCount.value * 2), () {
          switchContent(
            contentType: contentType,
            contentId: contentId,
            episodeIndex: episodeIndex,
            config: config,
            videoUrl: videoUrl,
            autoPlay: autoPlay,
          );
        });
      } else {
        error.value = _getErrorMessage(e);
      }
    } finally {
      isLoading.value = false;
    }
  }

  /// 切换集数
  Future<void> switchEpisode(int episodeIndex) async {
    if (currentState.value.episodeIndex == episodeIndex) return;

    final preloadedUrl = getPreloadedUrl(currentState.value.contentId, episodeIndex);

    await switchContent(
      contentType: currentState.value.contentType,
      contentId: currentState.value.contentId,
      episodeIndex: episodeIndex,
      config: currentConfig.value,
      videoUrl: preloadedUrl,
      autoPlay: true,
    );

    preloadNextEpisode();
  }

  /// 播放
  Future<void> play() async {
    if (_playerInstance == null) return;

    await _playerInstance!.play();
    enableWakelock();
    registerToPipManager();
    startProgressTracking();

    showPauseAd.value = false;

    currentState.value = currentState.value.copyWith(isPlaying: true);
    notifyStateListeners();
  }

  /// 暂停
  Future<void> pause() async {
    if (_playerInstance == null) return;

    await _playerInstance!.pause();
    scheduleDisableWakelock();

    if (!PipManager.to.isInPipMode.value) {
      unregisterFromPipManager();
    }

    stopProgressTracking();

    // 显示暂停广告
    if (!PipManager.to.isInPipMode.value && pauseAdData.value != null) {
      showPauseAd.value = true;
    }

    currentState.value = currentState.value.copyWith(isPlaying: false);
    notifyStateListeners();
  }

  /// 切换播放/暂停（带防抖）
  Future<void> togglePlayPause() async {
    final now = DateTime.now();
    if (_lastToggleTime != null &&
        now.difference(_lastToggleTime!).inMilliseconds < _toggleDebounceMs) {
      print('🎬 [GlobalPlayer] Toggle debounced');
      return;
    }
    _lastToggleTime = now;

    if (currentState.value.isPlaying) {
      await pause();
    } else {
      await play();
    }
  }

  /// 跳转到指定位置
  Future<void> seekTo(Duration position) async {
    if (_playerInstance == null) return;
    await _playerInstance!.seekTo(position);
  }

  /// 设置播放速度
  Future<void> setPlaybackSpeed(double speed) async {
    if (_playerInstance == null) return;
    await _playerInstance!.setPlaybackSpeed(speed);
    currentState.value = currentState.value.copyWith(playbackSpeed: speed);
    notifyStateListeners();
  }

  /// 设置播放许可
  void setPlayPermission(bool allowed) {
    _shouldAutoPlay = allowed;
    print('🎬 [GlobalPlayer] Play permission: $allowed');

    if (!allowed && currentState.value.isPlaying) {
      pause();
    }
  }

  /// 获取播放许可状态
  bool get isPlayAllowed => _shouldAutoPlay;

  // ==================== 暂停广告 ====================

  /// 加载暂停广告配置
  Future<void> _loadPauseAdConfig() async {
    try {
      final response = await _httpClient.get('/api/ad/pause');

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1 && data['data'] != null) {
          pauseAdData.value = data['data'];
          print('✅ [GlobalPlayer] Pause ad loaded');
          return;
        }
      }

      pauseAdData.value = null;
    } catch (e) {
      print('❌ [GlobalPlayer] Failed to load pause ad: $e');
      pauseAdData.value = null;
    }
  }

  /// 处理暂停广告点击
  void onPauseAdTap() {
    final adData = pauseAdData.value;
    if (adData == null) return;

    final actionType = adData['action_type'] as String? ?? '';
    final actionUrl = adData['action_url'] as String? ?? '';

    switch (actionType) {
      case 'webview':
        if (actionUrl.startsWith('webview://')) {
          final url = actionUrl.substring(10);
          Get.toNamed('/webview', arguments: {
            'url': url,
            'title': adData['title'] ?? '广告详情',
          });
        }
        break;
    }

    showPauseAd.value = false;
    play();
  }

  /// 关闭暂停广告
  void closePauseAd() {
    showPauseAd.value = false;
  }

  // ==================== 私有方法 ====================

  /// 停止当前播放
  Future<void> _stopCurrentPlayback() async {
    if (_playerInstance != null) {
      await _playerInstance!.pause();
      stopProgressTracking();
      await saveProgress();
    }
  }

  /// 释放播放器
  void _disposePlayer() {
    if (_playerInstance != null) {
      _playerInstance!.removeListener(_onPlayerStateChanged);
      _playerInstance!.dispose();
      _playerInstance = null;
    }
    stopProgressTracking();
  }

  /// 创建播放器实例
  Future<void> _createPlayerInstance(String videoUrl) async {
    _disposePlayer();

    String playUrl = videoUrl;
    if (videoUrl.contains('/share/')) {
      playUrl = await _parseShareUrl(videoUrl);
    }

    _playerInstance = VideoPlayerController.networkUrl(Uri.parse(playUrl));
    await _playerInstance!.initialize();
    _playerInstance!.addListener(_onPlayerStateChanged);

    print('🎬 [GlobalPlayer] Player created: $playUrl');
  }

  /// 应用播放器配置
  Future<void> _applyPlayerConfig(PlayerConfig config) async {
    if (_playerInstance == null) return;

    await _playerInstance!.setPlaybackSpeed(currentState.value.playbackSpeed);

    if (playerMode.value == PlayerMode.fullscreen) {
      if (currentState.value.contentType == ContentType.shorts ||
          currentState.value.contentType == ContentType.shortsFlow) {
        await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
      } else {
        await SystemChrome.setPreferredOrientations([config.orientation]);
      }
    } else {
      await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    }
  }

  /// 播放器状态变化监听
  void _onPlayerStateChanged() {
    if (_playerInstance == null) return;

    final wasPlaying = currentState.value.isPlaying;
    final nowPlaying = _playerInstance!.value.isPlaying;
    final position = _playerInstance!.value.position;
    final duration = _playerInstance!.value.duration;

    currentState.value = currentState.value.copyWith(
      position: position,
      duration: duration,
      isPlaying: nowPlaying,
    );

    if (_playerInstance!.value.hasError) {
      error.value = '播放错误';
      unregisterFromPipManager();
      print('❌ [GlobalPlayer] Error: ${_playerInstance!.value.errorDescription}');
    }

    if (nowPlaying && !wasPlaying) {
      registerToPipManager();
    } else if (!nowPlaying && wasPlaying && !PipManager.to.isInPipMode.value) {
      unregisterFromPipManager();
    }

    notifyStateListeners();

    if (position >= duration && duration.inSeconds > 0) {
      _onPlaybackCompleted();
    }
  }

  /// 播放完成回调
  void _onPlaybackCompleted() {
    print('🎬 [GlobalPlayer] Playback completed');

    final contentType = currentState.value.contentType;
    if (contentType == ContentType.shorts || contentType == ContentType.tv) {
      _autoPlayNextEpisode();
    }
  }

  /// 自动播放下一集
  Future<void> _autoPlayNextEpisode() async {
    try {
      final state = currentState.value;
      final nextEpisodeIndex = state.episodeIndex + 1;

      List? episodes;
      try {
        final controller = Get.find<dynamic>(tag: state.contentId);
        if (controller != null && controller.episodes != null) {
          episodes = controller.episodes as List;
        }
      } catch (e) {
        print('🎬 [GlobalPlayer] No controller for auto play: $e');
      }

      if (episodes != null && nextEpisodeIndex <= episodes.length) {
        print('🎬 [GlobalPlayer] Auto playing episode: $nextEpisodeIndex');
        await switchEpisode(nextEpisodeIndex);
      } else if (episodes != null) {
        print('🎬 [GlobalPlayer] Series completed');
        Get.snackbar('播放完成', '已播放完所有集数', snackPosition: SnackPosition.BOTTOM);
      }
    } catch (e) {
      print('❌ [GlobalPlayer] Auto play failed: $e');
    }
  }

  /// 获取视频URL
  Future<String> _getVideoUrl(ContentType contentType, String contentId, int episodeIndex) async {
    try {
      switch (contentType) {
        case ContentType.shorts:
          final response = await _httpClient.get('/api/shorts/series/$contentId');
          if (response.statusCode == 200 && response.data != null) {
            final data = response.data;
            if (data['code'] == 1 && data['data'] != null) {
              final episodes = data['data']['episodes'] as List?;
              if (episodes != null && episodeIndex <= episodes.length) {
                final playUrl = episodes[episodeIndex - 1]['play_url'] ?? '';
                return _parseVideoUrl(playUrl);
              }
            }
          }
          break;

        case ContentType.shortsFlow:
          return '';

        case ContentType.tv:
        case ContentType.movie:
          final response = await _httpClient.get(
            '/api/vod/detail',
            queryParameters: {'ids': contentId},
          );
          if (response.statusCode == 200 && response.data != null) {
            final data = response.data;
            if (data['code'] == 1 && data['data'] != null) {
              final vod = data['data'] as Map<String, dynamic>;
              
              // 使用新格式 play_sources
              final playSources = vod['play_sources'] as List?;
              if (playSources != null && playSources.isNotEmpty) {
                return _parsePlayUrlFromNewFormat(playSources, episodeIndex);
              }
            }
          }
          break;
      }
    } catch (e) {
      print('❌ [GlobalPlayer] Failed to get URL: $e');
    }

    return '';
  }

  /// 解析视频URL
  String _parseVideoUrl(String playUrl) {
    if (playUrl.isEmpty) return '';

    if (!playUrl.contains('#') && !playUrl.contains('\$')) {
      return playUrl.trim();
    }

    String firstEpisode = playUrl.contains('#') ? playUrl.split('#')[0] : playUrl;

    if (firstEpisode.contains('\$')) {
      final parts = firstEpisode.split('\$');
      if (parts.length > 1) {
        return parts[1].trim();
      }
    }

    return playUrl.trim();
  }

  /// 🆕 从新格式 play_sources 解析播放URL
  String _parsePlayUrlFromNewFormat(List playSources, int episodeIndex) {
    try {
      // 优先选择包含 m3u8 的播放源
      Map<String, dynamic>? selectedSource;
      for (final source in playSources) {
        final s = source as Map<String, dynamic>;
        final name = (s['name'] as String? ?? '').toLowerCase();
        if (name.contains('m3u8') || name.contains('ffm3u8')) {
          selectedSource = s;
          break;
        }
      }
      
      // 如果没有 m3u8 源，使用第一个
      selectedSource ??= playSources[0] as Map<String, dynamic>;
      
      final episodes = selectedSource['episodes'] as List? ?? [];
      if (episodeIndex > 0 && episodeIndex <= episodes.length) {
        final episode = episodes[episodeIndex - 1] as Map<String, dynamic>;
        return episode['url'] as String? ?? '';
      }
    } catch (e) {
      print('❌ [GlobalPlayer] Failed to parse new format URL: $e');
    }
    
    return '';
  }

  /// 解析分享链接
  Future<String> _parseShareUrl(String shareUrl) async {
    try {
      final response = await _httpClient.get(
        '/api/vod/parse_share',
        queryParameters: {'url': shareUrl},
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1 && data['data'] != null) {
          return data['data']['video_url'] as String;
        }
      }
      throw Exception('Failed to parse share URL');
    } catch (e) {
      print('❌ [GlobalPlayer] Failed to parse share URL: $e');
      rethrow;
    }
  }

  /// 检查播放器是否可见
  bool _isPlayerVisible() {
    if (!_shouldAutoPlay) return false;
    if (_playerInstance == null || !_playerInstance!.value.isInitialized) return false;
    if (PipManager.to.isInPipMode.value) return true;
    if (playerMode.value != PlayerMode.flow && playerMode.value != PlayerMode.window) return false;
    return true;
  }

  /// 判断是否应该重试
  bool _shouldRetry(dynamic error) {
    final errorStr = error.toString().toLowerCase();

    if (errorStr.contains('network') ||
        errorStr.contains('timeout') ||
        errorStr.contains('connection') ||
        errorStr.contains('socket')) {
      return true;
    }

    if (errorStr.contains('format') ||
        errorStr.contains('codec') ||
        errorStr.contains('invalid')) {
      return false;
    }

    return retryCount.value == 0;
  }

  /// 获取用户友好的错误信息
  String _getErrorMessage(dynamic error) {
    final errorStr = error.toString().toLowerCase();

    if (errorStr.contains('network') || errorStr.contains('connection')) {
      return '网络连接失败，请检查网络后重试';
    }
    if (errorStr.contains('timeout')) {
      return '连接超时，请稍后重试';
    }
    if (errorStr.contains('format') || errorStr.contains('codec')) {
      return '视频格式不支持，请尝试其他视频';
    }
    if (errorStr.contains('not found') || errorStr.contains('404')) {
      return '视频资源不存在';
    }

    return '播放失败，请重试';
  }
}
