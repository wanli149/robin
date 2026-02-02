import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'logger.dart';

/// 画中画（Picture-in-Picture）管理器
/// 
/// 统一管理所有播放器的画中画功能，支持系统级 PIP 和应用内 PIP 两种模式。
/// 
/// ## 功能特性
/// - 系统级画中画：调用 Android 原生 PIP API
/// - 应用内画中画：Flutter 层面的浮窗实现
/// - 播放器优先级管理：多播放器场景下的优先级控制
/// - 生命周期感知：自动处理应用前后台切换
/// 
/// ## 使用方式
/// ```dart
/// // 获取单例
/// final pipManager = PipManager.to;
/// 
/// // 注册播放器（开始播放时）
/// pipManager.registerPlayer('player_1', playerWidget);
/// 
/// // 注销播放器（停止播放时）
/// pipManager.unregisterPlayer('player_1');
/// 
/// // 手动进入画中画
/// pipManager.enterPipMode();
/// 
/// // 检查是否支持画中画
/// final supported = await pipManager.isPipSupported();
/// ```
/// 
/// ## 播放器优先级
/// - `lite_` 前缀：优先级 80（长剧播放器）
/// - 默认优先级：50
/// 
/// ## 与 Android 端通信
/// 通过 MethodChannel 'com.fetch.video/pip' 与原生端通信：
/// - `enterPipMode`: 进入画中画模式
/// - `isPipSupported`: 检查设备是否支持
/// - `setVideoPlaying`: 通知视频播放状态
/// - `getDebugInfo`: 获取调试信息
/// 
/// ## 注意事项
/// - 画中画功能需要 Android 8.0 (API 26) 及以上版本
/// - 需要在 AndroidManifest.xml 中声明 `android:supportsPictureInPicture="true"`
/// - 应用进入后台时会自动触发画中画（如果有视频在播放）
class PipManager extends GetxController with WidgetsBindingObserver {
  /// 获取单例实例
  static PipManager get to => Get.find<PipManager>();

  /// 当前是否处于画中画模式（响应式）
  /// 
  /// 状态由 Android 端通过 MethodChannel 回调更新
  final RxBool isInPipMode = false.obs;

  /// 当前注册的播放器 Widget
  /// 
  /// 用于应用内画中画模式时显示
  Widget? _currentPlayerWidget;
  
  /// 获取当前播放器 Widget
  Widget? get currentPlayerWidget => _currentPlayerWidget;

  /// 当前活跃的播放器 ID
  /// 
  /// 用于标识哪个播放器正在使用画中画功能
  String? _currentPlayerId;

  /// 播放器优先级映射表
  /// 
  /// Key: 播放器 ID 前缀
  /// Value: 优先级数值（越大优先级越高）
  /// 
  /// 当多个播放器同时存在时，优先级高的播放器会获得画中画控制权
  final Map<String, int> _playerPriorities = {
    'lite_': 80,     // 长剧播放器优先级
  };

  /// 是否使用应用内画中画模式
  /// 
  /// - true: 使用 Flutter 层面的浮窗实现
  /// - false: 使用 Android 系统级画中画 API（默认）
  final RxBool useInAppPip = false.obs;

  /// 与 Android 原生端通信的 MethodChannel
  /// 
  /// 通道名称: 'com.fetch.video/pip'
  static const MethodChannel _channel = MethodChannel('com.fetch.video/pip');

  /// 防抖动计时器
  /// 
  /// 避免频繁的状态切换
  Timer? _debounceTimer;

  @override
  void onInit() {
    super.onInit();
    Logger.info('PipManager initializing...', 'PIP');
    WidgetsBinding.instance.addObserver(this);
    _setupMethodChannel();
    Logger.success('PipManager initialized successfully', 'PIP');
  }

  /// 设置 MethodChannel 监听
  /// 
  /// 监听来自 Android 原生端的回调消息。
  /// 
  /// ## 支持的回调方法
  /// - `onPipModeChanged`: 画中画模式状态变化
  ///   - 参数: `{isInPipMode: bool, keepPlaying: bool}`
  /// - `onAppPaused`: 应用进入后台
  /// - `onAppResumed`: 应用回到前台
  /// - `onAppStopped`: 应用被停止
  void _setupMethodChannel() {
    _channel.setMethodCallHandler((call) async {
      switch (call.method) {
        case 'onPipModeChanged':
          // 接收来自Android的PIP状态变化，包含keepPlaying标志
          final data = call.arguments;
          if (data is Map) {
            final bool isInPip = data['isInPipMode'] as bool;
            final bool keepPlaying = data['keepPlaying'] as bool? ?? false;
            
            Logger.info('PIP mode changed: $isInPip, keepPlaying: $keepPlaying', 'PIP');
            isInPipMode.value = isInPip;
            
            // 通知播放器PIP状态变化，但不暂停播放
            _notifyPlayersPipModeChanged(isInPip, keepPlaying);
          }
          break;
        case 'onAppPaused':
          Logger.info('App paused - notifying players to pause', 'Lifecycle');
          _notifyPlayersAppPaused();
          break;
        case 'onAppResumed':
          Logger.info('App resumed - notifying players to resume', 'Lifecycle');
          _notifyPlayersAppResumed();
          break;
        case 'onAppStopped':
          Logger.info('App stopped - releasing resources', 'Lifecycle');
          _notifyPlayersAppStopped();
          break;
      }
    });
  }

  // 播放器回调列表
  final List<Function(String)> _playerCallbacks = [];

  /// 注册播放器回调
  void registerPlayerCallback(Function(String) callback) {
    _playerCallbacks.add(callback);
  }

  /// 移除播放器回调
  void unregisterPlayerCallback(Function(String) callback) {
    _playerCallbacks.remove(callback);
  }

  /// 通知播放器应用暂停
  void _notifyPlayersAppPaused() {
    for (final callback in _playerCallbacks) {
      try {
        callback('paused');
      } catch (e) {
        Logger.error('Failed to notify player paused', 'Lifecycle', e);
      }
    }
  }

  /// 通知播放器应用恢复
  void _notifyPlayersAppResumed() {
    for (final callback in _playerCallbacks) {
      try {
        callback('resumed');
      } catch (e) {
        Logger.error('Failed to notify player resumed', 'Lifecycle', e);
      }
    }
  }

  /// 通知播放器应用停止
  void _notifyPlayersAppStopped() {
    for (final callback in _playerCallbacks) {
      try {
        callback('stopped');
      } catch (e) {
        Logger.error('Failed to notify player stopped', 'Lifecycle', e);
      }
    }
  }

  /// 通知播放器PIP模式变化
  void _notifyPlayersPipModeChanged(bool isInPip, bool keepPlaying) {
    for (final callback in _playerCallbacks) {
      try {
        if (isInPip && keepPlaying) {
          callback('pip_entered_keep_playing');
        } else if (!isInPip) {
          callback('pip_exited');
        }
      } catch (e) {
        Logger.error('Failed to notify player PIP mode changed', 'PIP', e);
      }
    }
  }

  @override
  void onClose() {
    _debounceTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.onClose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    
    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
        // 应用进入后台时，Android端会自动处理画中画
        // 这里不需要手动调用，因为onUserLeaveHint会处理
        Logger.info('App paused, PIP will be handled by Android', 'PIP');
        printDebugInfo();
        break;
      case AppLifecycleState.resumed:
        // 应用回到前台时，画中画会自动退出
        Logger.info('App resumed, PIP will exit automatically', 'PIP');
        // 不要在这里注销播放器，保持播放状态
        printDebugInfo();
        break;
      default:
        break;
    }
  }

  /// 注册播放器
  /// 
  /// 当播放器开始播放视频时调用，将播放器注册到画中画管理器。
  /// 
  /// [playerId] 播放器唯一标识（如 'lite_123', 'shorts_456'）
  /// [playerWidget] 播放器 Widget（用于应用内画中画显示）
  /// 
  /// ## 优先级机制
  /// 如果已有播放器注册，会比较优先级：
  /// - 新播放器优先级更高：替换当前播放器
  /// - 新播放器优先级更低：忽略注册请求
  /// 
  /// ## 副作用
  /// - 通知 Android 端有视频正在播放
  /// - 打印调试信息
  void registerPlayer(String playerId, Widget? playerWidget) {
    Logger.info('Registering player: $playerId', 'PIP');
    
    // 检查播放器优先级
    final currentPriority = _getPlayerPriority(_currentPlayerId);
    final newPriority = _getPlayerPriority(playerId);
    
    // 如果新播放器优先级更高，或者没有当前播放器，则替换
    if (_currentPlayerId == null || newPriority > currentPriority) {
      if (_currentPlayerId != null && _currentPlayerId != playerId) {
        Logger.info('Replacing lower priority player: $_currentPlayerId (priority: $currentPriority) with $playerId (priority: $newPriority)', 'PIP');
      }
      
      _currentPlayerId = playerId;
      _currentPlayerWidget = playerWidget;
      // 通知Android端有视频在播放
      _notifyVideoPlayingState(true);
      Logger.success('Player registered: $playerId (priority: $newPriority)', 'PIP');
      
      // 打印调试信息
      printDebugInfo();
    } else {
      Logger.warning('Ignoring lower priority player: $playerId (priority: $newPriority), current: $_currentPlayerId (priority: $currentPriority)', 'PIP');
    }
  }

  /// 获取播放器优先级
  int _getPlayerPriority(String? playerId) {
    if (playerId == null) return 0;
    
    for (final entry in _playerPriorities.entries) {
      if (playerId.startsWith(entry.key)) {
        return entry.value;
      }
    }
    return 50; // 默认优先级
  }

  /// 注销播放器
  /// 
  /// 当播放器停止播放或被销毁时调用，从画中画管理器中移除。
  /// 
  /// [playerId] 要注销的播放器 ID
  /// 
  /// ## 注意事项
  /// - 只有当前活跃的播放器才会被注销
  /// - 注销非当前播放器会被忽略（仅记录 debug 日志）
  /// - 注销后会通知 Android 端没有视频在播放
  void unregisterPlayer(String playerId) {
    Logger.info('Unregistering player: $playerId', 'PIP');
    
    // 🚀 修复：校验当前活跃播放器ID，避免无效警告
    if (_currentPlayerId == null) {
      Logger.warning('No active player to unregister', 'PIP');
      return;
    }
    
    if (_currentPlayerId == playerId) {
      _currentPlayerId = null;
      _currentPlayerWidget = null;
      // 立即通知Android端没有视频在播放
      _notifyVideoPlayingState(false);
      
      Logger.success('Player unregistered: $playerId', 'PIP');
      
      // 打印调试信息
      printDebugInfo();
    } else {
      // 🚀 修复：只在确实是不同播放器时才记录警告
      Logger.debug('Ignoring unregister for non-current player: $playerId (current: $_currentPlayerId)', 'PIP');
    }
  }

  /// 检查是否需要进入画中画模式
  void _enterPipModeIfNeeded() {
    if (_currentPlayerWidget != null && !isInPipMode.value) {
      _enterPipMode();
    }
  }

  /// 进入画中画模式
  void _enterPipMode() {
    if (_currentPlayerWidget == null) return;
    if (isInPipMode.value) return; // 避免重复进入

    try {
      if (useInAppPip.value) {
        // 使用应用内画中画
        WidgetsBinding.instance.addPostFrameCallback((_) {
          try {
            isInPipMode.value = true;
            Logger.success('Entered in-app PIP mode', 'PIP');
          } catch (e) {
            Logger.error('Failed to update in-app PIP state', 'PIP', e);
          }
        });
      } else {
        // 使用原生Android画中画API
        _enterNativePipMode().then((_) {
          // 原生PIP模式的状态更新由Android端回调处理
          Logger.success('Requested native PIP mode', 'PIP');
        }).catchError((e) {
          Logger.error('Failed to enter native PIP mode', 'PIP', e);
        });
      }
    } catch (e) {
      // 画中画启动失败，可能设备不支持
      Logger.error('Failed to enter PIP mode', 'PIP', e);
    }
  }

  /// 退出画中画模式
  void _exitPipMode() {
    // PIP模式的退出由Android系统自动处理
    // 这里只是记录日志，实际状态更新由onPipModeChanged回调处理
    Logger.info('PIP mode will be handled by system', 'PIP');
  }

  /// 手动进入画中画模式
  void enterPipMode() {
    _enterPipMode();
  }

  /// 手动退出画中画模式
  void exitPipMode() {
    _exitPipMode();
  }



  /// 使用原生Android画中画API
  Future<void> _enterNativePipMode() async {
    try {
      final bool success = await _channel.invokeMethod('enterPipMode');
      if (!success) {
        throw Exception('Failed to enter PIP mode');
      }
    } catch (e) {
      Logger.error('Native PIP mode failed', 'PIP', e);
      // 如果原生API失败，可以考虑其他实现方式
      rethrow;
    }
  }

  /// 手动切换画中画模式
  void togglePipMode() {
    if (isInPipMode.value) {
      _exitPipMode();
    } else {
      _enterPipModeIfNeeded();
    }
  }

  /// 检查设备是否支持画中画
  /// 
  /// 调用 Android 原生 API 检查设备是否支持画中画功能。
  /// 
  /// 返回：
  /// - true: 设备支持画中画（Android 8.0+）
  /// - false: 设备不支持或检查失败
  /// 
  /// ## 使用示例
  /// ```dart
  /// if (await PipManager.to.isPipSupported()) {
  ///   // 显示画中画按钮
  /// }
  /// ```
  Future<bool> isPipSupported() async {
    try {
      final bool supported = await _channel.invokeMethod('isPipSupported');
      return supported;
    } catch (e) {
      Logger.error('Failed to check PIP support', 'PIP', e);
      return false;
    }
  }

  /// 通知Android端视频播放状态
  Future<void> _notifyVideoPlayingState(bool isPlaying) async {
    try {
      await _channel.invokeMethod('setVideoPlaying', isPlaying);
      Logger.info('Notified Android: video playing = $isPlaying', 'PIP');
    } catch (e) {
      Logger.error('Failed to notify video playing state', 'PIP', e);
    }
  }

  /// 获取调试信息
  /// 
  /// 从 Android 端获取画中画相关的调试信息。
  /// 
  /// 返回包含以下字段的 Map：
  /// - `isVideoPlaying`: 是否有视频在播放
  /// - `isInPictureInPictureMode`: 是否处于画中画模式
  /// - `isPipSupported`: 设备是否支持画中画
  /// - `apiLevel`: Android API 级别
  /// 
  /// 获取失败时返回空 Map
  Future<Map<String, dynamic>> getDebugInfo() async {
    try {
      final Map<dynamic, dynamic> debugInfo = await _channel.invokeMethod('getDebugInfo');
      return Map<String, dynamic>.from(debugInfo);
    } catch (e) {
      Logger.error('Failed to get debug info', 'PIP', e);
      return {};
    }
  }

  /// 打印调试信息
  Future<void> printDebugInfo() async {
    final debugInfo = await getDebugInfo();
    Logger.info('=== PIP Debug Info ===', 'PIP');
    Logger.info('Current Player ID: $_currentPlayerId', 'PIP');
    Logger.info('Flutter PIP Mode: ${isInPipMode.value}', 'PIP');
    Logger.info('Android Video Playing: ${debugInfo['isVideoPlaying']}', 'PIP');
    Logger.info('Android PIP Mode: ${debugInfo['isInPictureInPictureMode']}', 'PIP');
    Logger.info('PIP Supported: ${debugInfo['isPipSupported']}', 'PIP');
    Logger.info('API Level: ${debugInfo['apiLevel']}', 'PIP');
    Logger.info('=====================', 'PIP');
  }
}