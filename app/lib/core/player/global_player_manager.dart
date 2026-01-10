import 'dart:async';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
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
import '../logger.dart';
import '../../services/play_stats_service.dart';

/// 全局播放器管理器 (基于 media_kit)
/// 
/// 单例模式管理整个应用的视频播放，确保同一时间只有一个播放器实例。
/// 使用 media_kit 提供更好的缓冲控制和预加载能力。
class GlobalPlayerManager extends GetxController
    with
        WidgetsBindingObserver,
        PlayerWakelockMixin,
        PlayerFullscreenMixin,
        PlayerProgressMixin,
        PlayerPreloadMixin,
        PlayerPipMixin,
        PlayerListenersMixin {
  
  static GlobalPlayerManager get to => Get.find<GlobalPlayerManager>();

  // ==================== 核心属性 ====================

  final HttpClient _httpClient = HttpClient();

  /// media_kit 播放器实例
  Player? _player;
  
  /// media_kit 视频控制器（用于渲染）
  VideoController? _videoController;

  /// 获取播放器实例
  Player? get player => _player;
  
  /// 获取视频控制器（用于 Video Widget）
  VideoController? get videoController => _videoController;

  final Rx<PlayerConfig> currentConfig = PlayerConfig.shortsWindow().obs;
  final Rx<PlayerState> currentState = PlayerState.initial().obs;
  final Rx<PlayerMode> playerMode = PlayerMode.window.obs;
  final RxBool isLoading = false.obs;
  final RxString error = ''.obs;
  final RxInt retryCount = 0.obs;
  static const int maxRetryCount = 3;
  bool _shouldAutoPlay = true;
  DateTime? _switchStartTime;
  final RxInt switchLatency = 0.obs;
  
  // ==================== 操作取消机制 ====================
  
  int _currentOperationId = 0;
  final Set<int> _cancelledOperations = {};

  // ==================== 暂停广告相关 ====================

  final Rx<Map<String, dynamic>?> pauseAdData = Rx<Map<String, dynamic>?>(null);
  final RxBool showPauseAd = false.obs;

  // ==================== 播放/暂停防抖 ====================

  DateTime? _lastToggleTime;
  static const int _toggleDebounceMs = 300;
  
  // ==================== 流订阅 ====================
  
  StreamSubscription? _playingSubscription;
  StreamSubscription? _positionSubscription;
  StreamSubscription? _durationSubscription;
  StreamSubscription? _bufferSubscription;
  StreamSubscription? _completedSubscription;
  StreamSubscription? _errorSubscription;

  // ==================== Mixin 接口实现 ====================

  @override
  bool get isInPipModeValue => PipManager.to.isInPipMode.value;

  @override
  bool get isPlayingValue => currentState.value.isPlaying;

  @override
  PlayerState get currentPlayerState => currentState.value;

  @override
  Rx<PlayerMode> get playerModeRx => playerMode;

  @override
  Rx<PlayerConfig> get currentConfigRx => currentConfig;

  @override
  bool get isPlayerInstancePlaying => _player?.state.playing ?? false;

  @override
  Future<void> resumePlay() async => await play();

  @override
  void notifyStateListeners() => notifyStateListenersInternal(currentState.value);

  @override
  bool get isPreloadingValue => isPreloading.value;

  @override
  void triggerPreloadNextEpisode() => preloadNextEpisode();

  @override
  Future<String> getVideoUrl(ContentType contentType, String contentId, int episodeIndex) {
    return _getVideoUrl(contentType, contentId, episodeIndex);
  }

  // ==================== 生命周期 ====================

  @override
  void onInit() {
    super.onInit();
    WidgetsBinding.instance.addObserver(this);
    PipManager.to.registerPlayerCallback(_onAppLifecycleChanged);
    _loadPauseAdConfig();
    Logger.player('Manager initialized (media_kit)');
  }

  @override
  void onClose() {
    WidgetsBinding.instance.removeObserver(this);
    PipManager.to.unregisterPlayerCallback(_onAppLifecycleChanged);
    
    saveProgress();
    
    disposeWakelockMixin();
    disposeProgressMixin();
    disposePreloadMixin();
    disposeListenersMixin();
    
    _disposePlayer();
    
    Logger.player('Manager closed');
    super.onClose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    Logger.player('Flutter lifecycle state: $state');
  }

  void _onAppLifecycleChanged(String state) {
    Logger.player('Lifecycle change: $state');

    switch (state) {
      case 'paused':
        if (!PipManager.to.isInPipMode.value) {
          saveProgress();
          pause();
        }
        break;
      case 'resumed':
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

  Future<void> switchContent({
    required ContentType contentType,
    required String contentId,
    required int episodeIndex,
    required PlayerConfig config,
    String? contentName,
    String? videoUrl,
    bool autoPlay = true,
  }) async {
    final operationId = ++_currentOperationId;
    
    try {
      Logger.player('Switching: $contentType, $contentId, ep: $episodeIndex (opId: $operationId)');

      _switchStartTime = DateTime.now();
      isLoading.value = true;
      error.value = '';

      final isSameContent = currentState.value.contentType == contentType &&
          currentState.value.contentId == contentId;

      await _stopCurrentPlayback();
      
      if (_isOperationCancelled(operationId)) {
        Logger.player('Operation $operationId cancelled after stop');
        return;
      }

      if (!isSameContent) {
        clearPreloadCache();
      }

      currentConfig.value = config;
      currentState.value = currentState.value.copyWith(
        contentType: contentType,
        contentId: contentId,
        contentName: contentName ?? '',
        episodeIndex: episodeIndex,
        position: Duration.zero,
        isPlaying: false,
      );

      String playUrl = videoUrl ?? '';
      if (playUrl.isEmpty) {
        playUrl = await _getVideoUrl(contentType, contentId, episodeIndex);
      }
      
      if (_isOperationCancelled(operationId)) {
        Logger.player('Operation $operationId cancelled after getVideoUrl');
        return;
      }

      if (playUrl.isEmpty) {
        throw Exception('无法获取视频播放地址');
      }

      await _createPlayerInstance(playUrl);
      
      if (_isOperationCancelled(operationId)) {
        Logger.player('Operation $operationId cancelled after createPlayer');
        await _stopCurrentPlayback();
        return;
      }

      retryCount.value = 0;

      // 恢复播放进度（非短剧流模式）
      if (contentType != ContentType.shortsFlow) {
        final savedProgress = await loadSavedProgress(contentType, contentId, episodeIndex);
        if (savedProgress.inSeconds > 0 && _player != null) {
          await _player!.seek(savedProgress);
          Logger.player('Restored progress: ${savedProgress.inSeconds}s');
        }
      }
      
      if (_isOperationCancelled(operationId)) {
        Logger.player('Operation $operationId cancelled before autoPlay');
        await _stopCurrentPlayback();
        return;
      }

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

      if (contentType == ContentType.shorts || contentType == ContentType.tv) {
        preloadNextEpisode();
      }

      if (_switchStartTime != null) {
        switchLatency.value = DateTime.now().difference(_switchStartTime!).inMilliseconds;
        Logger.info('Switch latency: ${switchLatency.value}ms');
      }

      Logger.success('Content switched successfully (opId: $operationId)');
    } catch (e) {
      if (_isOperationCancelled(operationId)) {
        Logger.player('Operation $operationId cancelled, ignoring error');
        return;
      }
      
      error.value = '播放器初始化失败: $e';
      Logger.error('Failed to switch: $e');

      if (retryCount.value < maxRetryCount && _shouldRetry(e)) {
        retryCount.value++;
        Logger.info('Retry ${retryCount.value}/$maxRetryCount');

        Future.delayed(Duration(seconds: retryCount.value * 2), () {
          if (!_isOperationCancelled(operationId)) {
            switchContent(
              contentType: contentType,
              contentId: contentId,
              episodeIndex: episodeIndex,
              config: config,
              videoUrl: videoUrl,
              autoPlay: autoPlay,
            );
          }
        });
      } else {
        error.value = _getErrorMessage(e);
      }
    } finally {
      if (!_isOperationCancelled(operationId)) {
        isLoading.value = false;
      }
      _cancelledOperations.remove(operationId);
    }
  }
  
  void cancelCurrentOperation() {
    if (_currentOperationId > 0) {
      _cancelledOperations.add(_currentOperationId);
      Logger.player('Cancelled operation: $_currentOperationId');
    }
  }
  
  bool _isOperationCancelled(int operationId) {
    return _cancelledOperations.contains(operationId) || operationId != _currentOperationId;
  }

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

  Future<void> play() async {
    if (_player == null) return;

    await _player!.play();
    enableWakelock();
    registerToPipManager();
    startProgressTracking();

    showPauseAd.value = false;

    currentState.value = currentState.value.copyWith(isPlaying: true);
    notifyStateListeners();
    
    _reportPlayStart();
  }

  Future<void> pause() async {
    if (_player == null) return;

    await _player!.pause();
    scheduleDisableWakelock();

    if (!PipManager.to.isInPipMode.value) {
      unregisterFromPipManager();
    }

    stopProgressTracking();

    if (!PipManager.to.isInPipMode.value && pauseAdData.value != null) {
      showPauseAd.value = true;
    }

    currentState.value = currentState.value.copyWith(isPlaying: false);
    notifyStateListeners();
  }

  Future<void> togglePlayPause() async {
    final now = DateTime.now();
    if (_lastToggleTime != null &&
        now.difference(_lastToggleTime!).inMilliseconds < _toggleDebounceMs) {
      Logger.player('Toggle debounced');
      return;
    }
    _lastToggleTime = now;

    if (currentState.value.isPlaying) {
      await pause();
    } else {
      await play();
    }
  }

  Future<void> seekTo(Duration position) async {
    if (_player == null) return;
    await _player!.seek(position);
  }

  Future<void> setPlaybackSpeed(double speed) async {
    if (_player == null) return;
    await _player!.setRate(speed);
    currentState.value = currentState.value.copyWith(playbackSpeed: speed);
    notifyStateListeners();
  }

  Future<void> toggleMute() async {
    if (_player == null) return;
    
    final newMuted = !currentState.value.isMuted;
    await _player!.setVolume(newMuted ? 0.0 : currentState.value.volume * 100);
    currentState.value = currentState.value.copyWith(isMuted: newMuted);
    notifyStateListeners();
    
    Logger.player('Mute toggled: $newMuted');
  }

  Future<void> setMuted(bool muted) async {
    if (_player == null) return;
    
    await _player!.setVolume(muted ? 0.0 : currentState.value.volume * 100);
    currentState.value = currentState.value.copyWith(isMuted: muted);
    notifyStateListeners();
  }

  Future<void> setVolume(double volume) async {
    if (_player == null) return;
    
    final clampedVolume = volume.clamp(0.0, 1.0);
    if (!currentState.value.isMuted) {
      await _player!.setVolume(clampedVolume * 100); // media_kit 使用 0-100
    }
    currentState.value = currentState.value.copyWith(volume: clampedVolume);
    notifyStateListeners();
  }

  void setPlayPermission(bool allowed) {
    _shouldAutoPlay = allowed;
    Logger.player('Play permission: $allowed');

    if (!allowed && currentState.value.isPlaying) {
      pause();
    }
  }

  bool get isPlayAllowed => _shouldAutoPlay;

  // ==================== 暂停广告 ====================

  Future<void> _loadPauseAdConfig() async {
    try {
      final response = await _httpClient.get('/api/ad/pause');

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1 && data['data'] != null) {
          pauseAdData.value = data['data'];
          Logger.success('Pause ad loaded');
          return;
        }
      }

      pauseAdData.value = null;
    } catch (e) {
      Logger.error('Failed to load pause ad: $e');
      pauseAdData.value = null;
    }
  }

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

  void closePauseAd() {
    showPauseAd.value = false;
  }

  // ==================== 私有方法 ====================

  Future<void> _stopCurrentPlayback() async {
    if (_player != null) {
      await _player!.pause();
      stopProgressTracking();
      await saveProgress();
    }
  }

  void _disposePlayer() {
    _cancelStreamSubscriptions();
    
    _videoController?.dispose();
    _videoController = null;
    
    _player?.dispose();
    _player = null;
    
    stopProgressTracking();
    Logger.player('Player disposed');
  }
  
  void _cancelStreamSubscriptions() {
    _playingSubscription?.cancel();
    _positionSubscription?.cancel();
    _durationSubscription?.cancel();
    _bufferSubscription?.cancel();
    _completedSubscription?.cancel();
    _errorSubscription?.cancel();
    
    _playingSubscription = null;
    _positionSubscription = null;
    _durationSubscription = null;
    _bufferSubscription = null;
    _completedSubscription = null;
    _errorSubscription = null;
  }

  Future<void> _createPlayerInstance(String videoUrl) async {
    _disposePlayer();

    String playUrl = videoUrl;
    if (videoUrl.contains('/share/')) {
      playUrl = await _parseShareUrl(videoUrl);
    }

    // 创建 media_kit Player，配置缓冲
    _player = Player(
      configuration: const PlayerConfiguration(
        bufferSize: 32 * 1024 * 1024, // 32MB 缓冲
      ),
    );
    
    // 创建视频控制器
    _videoController = VideoController(_player!);
    
    // 设置流监听
    _setupStreamListeners();
    
    // 打开媒体
    await _player!.open(Media(playUrl));

    Logger.player('Player created: $playUrl');
  }

  void _setupStreamListeners() {
    if (_player == null) return;
    
    _playingSubscription = _player!.stream.playing.listen((playing) {
      final wasPlaying = currentState.value.isPlaying;
      currentState.value = currentState.value.copyWith(isPlaying: playing);
      
      if (playing && !wasPlaying) {
        registerToPipManager();
      } else if (!playing && wasPlaying && !PipManager.to.isInPipMode.value) {
        unregisterFromPipManager();
      }
      
      notifyStateListeners();
    });
    
    _positionSubscription = _player!.stream.position.listen((position) {
      currentState.value = currentState.value.copyWith(position: position);
      notifyStateListeners();
    });
    
    _durationSubscription = _player!.stream.duration.listen((duration) {
      currentState.value = currentState.value.copyWith(duration: duration);
      notifyStateListeners();
    });
    
    _bufferSubscription = _player!.stream.buffer.listen((buffer) {
      // 可以用于显示缓冲进度
    });
    
    _completedSubscription = _player!.stream.completed.listen((completed) {
      if (completed) {
        _onPlaybackCompleted();
      }
    });
    
    _errorSubscription = _player!.stream.error.listen((errorMsg) {
      if (errorMsg.isNotEmpty) {
        error.value = '播放错误: $errorMsg';
        unregisterFromPipManager();
        Logger.error('Player error: $errorMsg');
      }
    });
  }

  void _onPlaybackCompleted() {
    Logger.player('Playback completed');
    _reportPlayComplete();

    final contentType = currentState.value.contentType;
    if (contentType == ContentType.shorts || contentType == ContentType.tv) {
      _autoPlayNextEpisode();
    }
  }

  Future<void> _autoPlayNextEpisode() async {
    try {
      final state = currentState.value;
      
      if (state.contentType == ContentType.shortsFlow) {
        Logger.player('ShortsFlow mode, skip auto play next');
        return;
      }
      
      final nextEpisodeIndex = state.episodeIndex + 1;

      List? episodes;
      try {
        if (state.contentId.isNotEmpty && Get.isRegistered<dynamic>(tag: state.contentId)) {
          final controller = Get.find<dynamic>(tag: state.contentId);
          if (controller != null && controller.episodes != null) {
            episodes = controller.episodes as List;
          }
        }
      } catch (e) {
        Logger.player('No controller for auto play: $e');
      }

      if (episodes != null && nextEpisodeIndex <= episodes.length) {
        Logger.player('Auto playing episode: $nextEpisodeIndex');
        await switchEpisode(nextEpisodeIndex);
      } else if (episodes != null) {
        Logger.player('Series completed');
        Get.snackbar('播放完成', '已播放完所有集数', snackPosition: SnackPosition.BOTTOM);
      }
    } catch (e) {
      Logger.error('Auto play failed: $e');
    }
  }

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
              final playSources = vod['play_sources'] as List?;
              if (playSources != null && playSources.isNotEmpty) {
                return _parsePlayUrlFromNewFormat(playSources, episodeIndex);
              }
            }
          }
          break;
      }
    } catch (e) {
      Logger.error('Failed to get URL: $e');
    }

    return '';
  }

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

  String _parsePlayUrlFromNewFormat(List playSources, int episodeIndex) {
    try {
      Map<String, dynamic>? selectedSource;
      for (final source in playSources) {
        final s = source as Map<String, dynamic>;
        final name = (s['name'] as String? ?? '').toLowerCase();
        if (name.contains('m3u8') || name.contains('ffm3u8')) {
          selectedSource = s;
          break;
        }
      }
      
      selectedSource ??= playSources[0] as Map<String, dynamic>;
      
      final episodes = selectedSource['episodes'] as List? ?? [];
      if (episodeIndex > 0 && episodeIndex <= episodes.length) {
        final episode = episodes[episodeIndex - 1] as Map<String, dynamic>;
        return episode['url'] as String? ?? '';
      }
    } catch (e) {
      Logger.error('Failed to parse new format URL: $e');
    }
    
    return '';
  }

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
      Logger.error('Failed to parse share URL: $e');
      rethrow;
    }
  }

  bool _isPlayerVisible() {
    if (!_shouldAutoPlay) return false;
    if (_player == null) return false;
    if (PipManager.to.isInPipMode.value) return true;
    if (playerMode.value != PlayerMode.flow && playerMode.value != PlayerMode.window) return false;
    return true;
  }

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
  
  // ==================== 播放统计 ====================
  
  void _reportPlayStart() {
    if (!Get.isRegistered<PlayStatsService>()) return;
    
    final state = currentState.value;
    if (state.contentId.isEmpty) return;
    if (state.contentType == ContentType.shortsFlow) return;
    
    PlayStatsService.to.reportPlayStart(
      vodId: state.contentId,
      vodType: _getVodType(state.contentType),
      episodeIndex: state.episodeIndex,
    );
  }
  
  void reportValidPlay() {
    if (!Get.isRegistered<PlayStatsService>()) return;
    
    final state = currentState.value;
    if (state.contentId.isEmpty) return;
    if (state.contentType == ContentType.shortsFlow) return;
    
    final playedSeconds = state.position.inSeconds;
    final totalSeconds = state.duration.inSeconds;
    
    if (playedSeconds >= 30 && totalSeconds > 0) {
      PlayStatsService.to.reportValidPlay(
        vodId: state.contentId,
        vodType: _getVodType(state.contentType),
        episodeIndex: state.episodeIndex,
        playedSeconds: playedSeconds,
        totalSeconds: totalSeconds,
      );
    }
  }
  
  void _reportPlayComplete() {
    if (!Get.isRegistered<PlayStatsService>()) return;
    
    final state = currentState.value;
    if (state.contentId.isEmpty) return;
    if (state.contentType == ContentType.shortsFlow) return;
    
    PlayStatsService.to.reportPlayComplete(
      vodId: state.contentId,
      vodType: _getVodType(state.contentType),
      episodeIndex: state.episodeIndex,
    );
  }
  
  String _getVodType(ContentType contentType) {
    switch (contentType) {
      case ContentType.movie:
        return 'movie';
      case ContentType.tv:
        return 'tv';
      case ContentType.shorts:
        return 'shorts';
      case ContentType.shortsFlow:
        return 'shorts_flow';
    }
  }
}
