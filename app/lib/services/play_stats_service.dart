/// 播放统计服务
/// 
/// 负责上报视频播放行为，用于统计观看次数。
/// 
/// ## 功能
/// - 上报视频播放开始
/// - 上报播放进度（用于计算有效播放）
/// - 批量上报（减少网络请求）
/// - 本地缓存（网络失败时暂存）
/// 
/// ## 使用示例
/// ```dart
/// // 上报播放开始
/// PlayStatsService.to.reportPlayStart(vodId: '123', vodType: 'movie');
/// 
/// // 上报播放进度（播放超过30秒算有效播放）
/// PlayStatsService.to.reportPlayProgress(vodId: '123', progress: 0.5, duration: 120);
/// ```
library;

import 'package:get/get.dart';
import '../core/http_client.dart';
import '../core/logger.dart';

class PlayStatsService extends GetxService {
  static PlayStatsService get to => Get.find<PlayStatsService>();
  
  final HttpClient _httpClient = HttpClient();
  
  // 待上报的事件队列
  final List<Map<String, dynamic>> _pendingEvents = [];
  
  // 已上报的播放记录（防止重复上报）
  final Set<String> _reportedPlays = {};
  
  // 上报间隔（毫秒）
  static const int _reportIntervalMs = 30000; // 30秒
  
  // 有效播放阈值（秒）
  static const int _validPlayThresholdSeconds = 30;
  
  // 上次上报时间
  DateTime? _lastReportTime;
  
  /// 初始化服务
  Future<PlayStatsService> init() async {
    Logger.info('[PlayStatsService] Initialized');
    return this;
  }
  
  /// 上报播放开始
  /// 
  /// [vodId] 视频ID
  /// [vodType] 视频类型 (movie, tv, shorts)
  /// [episodeIndex] 集数（剧集类型时使用）
  void reportPlayStart({
    required String vodId,
    required String vodType,
    int? episodeIndex,
  }) {
    final key = _getPlayKey(vodId, episodeIndex);
    
    // 防止重复上报
    if (_reportedPlays.contains(key)) {
      return;
    }
    
    _pendingEvents.add({
      'type': 'play_start',
      'vod_id': vodId,
      'vod_type': vodType,
      'episode_index': episodeIndex,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });
    
    Logger.debug('[PlayStatsService] Play start: $vodId (type: $vodType)');
    
    // 检查是否需要批量上报
    _checkAndReport();
  }
  
  /// 上报有效播放（播放超过阈值）
  /// 
  /// [vodId] 视频ID
  /// [vodType] 视频类型
  /// [episodeIndex] 集数
  /// [playedSeconds] 已播放秒数
  /// [totalSeconds] 总时长秒数
  void reportValidPlay({
    required String vodId,
    required String vodType,
    int? episodeIndex,
    required int playedSeconds,
    required int totalSeconds,
  }) {
    // 只有播放超过阈值才算有效播放
    if (playedSeconds < _validPlayThresholdSeconds) {
      return;
    }
    
    final key = _getPlayKey(vodId, episodeIndex);
    
    // 防止重复上报
    if (_reportedPlays.contains(key)) {
      return;
    }
    
    _reportedPlays.add(key);
    
    _pendingEvents.add({
      'type': 'valid_play',
      'vod_id': vodId,
      'vod_type': vodType,
      'episode_index': episodeIndex,
      'played_seconds': playedSeconds,
      'total_seconds': totalSeconds,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });
    
    Logger.debug('[PlayStatsService] Valid play: $vodId (played: ${playedSeconds}s)');
    
    // 有效播放立即上报
    _doReport();
  }
  
  /// 上报播放完成
  void reportPlayComplete({
    required String vodId,
    required String vodType,
    int? episodeIndex,
  }) {
    _pendingEvents.add({
      'type': 'play_complete',
      'vod_id': vodId,
      'vod_type': vodType,
      'episode_index': episodeIndex,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });
    
    Logger.debug('[PlayStatsService] Play complete: $vodId');
    
    // 播放完成立即上报
    _doReport();
  }
  
  /// 生成播放唯一键
  String _getPlayKey(String vodId, int? episodeIndex) {
    final today = DateTime.now().toIso8601String().split('T')[0];
    return '$vodId-${episodeIndex ?? 0}-$today';
  }
  
  /// 检查是否需要批量上报
  void _checkAndReport() {
    final now = DateTime.now();
    
    // 如果事件数量超过10个，或者距离上次上报超过30秒，则上报
    if (_pendingEvents.length >= 10 ||
        (_lastReportTime != null && 
         now.difference(_lastReportTime!).inMilliseconds >= _reportIntervalMs)) {
      _doReport();
    }
  }
  
  /// 执行上报
  Future<void> _doReport() async {
    if (_pendingEvents.isEmpty) return;
    
    // 取出待上报的事件
    final events = List<Map<String, dynamic>>.from(_pendingEvents);
    _pendingEvents.clear();
    _lastReportTime = DateTime.now();
    
    try {
      final response = await _httpClient.post(
        '/api/stats/play',
        data: {'events': events},
      );
      
      if (response.statusCode == 200 && response.data['code'] == 1) {
        Logger.debug('[PlayStatsService] Reported ${events.length} events');
      } else {
        // 上报失败，重新加入队列
        _pendingEvents.addAll(events);
        Logger.warning('[PlayStatsService] Report failed, re-queued ${events.length} events');
      }
    } catch (e) {
      // 网络错误，重新加入队列
      _pendingEvents.addAll(events);
      Logger.error('[PlayStatsService] Report error: $e');
    }
  }
  
  /// 强制上报所有待处理事件（应用退出时调用）
  Future<void> flush() async {
    await _doReport();
  }
  
  /// 清除已上报记录（新的一天时调用）
  void clearReportedPlays() {
    _reportedPlays.clear();
  }
  
  @override
  void onClose() {
    // 应用关闭时上报剩余事件
    flush();
    super.onClose();
  }
}
