import 'player_enums.dart';

/// 播放状态类
/// 
/// 存储当前播放器的完整状态信息，包括：
/// - 内容信息（类型、ID、名称、集数）
/// - 播放进度（当前位置、总时长）
/// - 播放状态（是否播放中、播放速度、是否静音）
/// 
/// 该类是不可变的，使用 [copyWith] 方法创建新状态。
/// 
/// ## 使用示例
/// ```dart
/// final state = PlayerState(
///   contentType: ContentType.tv,
///   contentId: '12345',
///   contentName: '手遮天',
///   episodeIndex: 1,
///   position: Duration.zero,
///   duration: Duration.zero,
///   isPlaying: false,
/// );
/// 
/// // 更新播放状态
/// final newState = state.copyWith(isPlaying: true);
/// ```
class PlayerState {
  /// 内容类型
  final ContentType contentType;

  /// 内容唯一标识
  /// 
  /// 对应后端的 vod_id 或 short_id
  final String contentId;

  /// 内容名称
  /// 
  /// 视频/剧集的标题，用于播放器顶部显示
  final String contentName;

  /// 当前集数索引
  /// 
  /// 从 1 开始计数，电影固定为 1
  final int episodeIndex;

  /// 当前播放位置
  final Duration position;

  /// 视频总时长
  final Duration duration;

  /// 是否正在播放
  final bool isPlaying;

  /// 播放速度
  /// 
  /// 默认 1.0，支持 0.5x ~ 2.0x
  final double playbackSpeed;

  /// 是否静音
  final bool isMuted;

  /// 音量 (0.0 ~ 1.0)
  final double volume;

  const PlayerState({
    required this.contentType,
    required this.contentId,
    this.contentName = '',
    required this.episodeIndex,
    required this.position,
    required this.duration,
    required this.isPlaying,
    this.playbackSpeed = 1.0,
    this.isMuted = false,
    this.volume = 1.0,
  });

  /// 创建初始状态
  /// 
  /// 用于播放器初始化时的默认状态
  factory PlayerState.initial() {
    return const PlayerState(
      contentType: ContentType.shorts,
      contentId: '',
      contentName: '',
      episodeIndex: 0,
      position: Duration.zero,
      duration: Duration.zero,
      isPlaying: false,
    );
  }

  /// 创建状态副本并修改部分参数
  /// 
  /// 由于 PlayerState 是不可变的，所有状态更新都通过此方法进行
  PlayerState copyWith({
    ContentType? contentType,
    String? contentId,
    String? contentName,
    int? episodeIndex,
    Duration? position,
    Duration? duration,
    bool? isPlaying,
    double? playbackSpeed,
    bool? isMuted,
    double? volume,
  }) {
    return PlayerState(
      contentType: contentType ?? this.contentType,
      contentId: contentId ?? this.contentId,
      contentName: contentName ?? this.contentName,
      episodeIndex: episodeIndex ?? this.episodeIndex,
      position: position ?? this.position,
      duration: duration ?? this.duration,
      isPlaying: isPlaying ?? this.isPlaying,
      playbackSpeed: playbackSpeed ?? this.playbackSpeed,
      isMuted: isMuted ?? this.isMuted,
      volume: volume ?? this.volume,
    );
  }

  /// 计算播放进度百分比
  /// 
  /// 返回 0.0 ~ 1.0 之间的值
  double get progressPercent {
    if (duration.inMilliseconds == 0) return 0.0;
    return position.inMilliseconds / duration.inMilliseconds;
  }

  /// 是否已播放完成
  /// 
  /// 当播放位置达到总时长的 98% 时视为完成
  bool get isCompleted {
    if (duration.inSeconds == 0) return false;
    return position.inSeconds >= duration.inSeconds * 0.98;
  }

  /// 格式化当前位置为字符串
  /// 
  /// 格式：MM:SS 或 HH:MM:SS
  String get positionString => _formatDuration(position);

  /// 格式化总时长为字符串
  String get durationString => _formatDuration(duration);

  /// 格式化时长
  String _formatDuration(Duration duration) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);

    if (hours > 0) {
      return '$hours:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    } else {
      return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    }
  }

  @override
  String toString() {
    return 'PlayerState(contentType: $contentType, contentId: $contentId, '
        'contentName: $contentName, episode: $episodeIndex, '
        'position: $positionString/$durationString, '
        'isPlaying: $isPlaying, speed: ${playbackSpeed}x, muted: $isMuted)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is PlayerState &&
        other.contentType == contentType &&
        other.contentId == contentId &&
        other.contentName == contentName &&
        other.episodeIndex == episodeIndex &&
        other.position == position &&
        other.duration == duration &&
        other.isPlaying == isPlaying &&
        other.playbackSpeed == playbackSpeed &&
        other.isMuted == isMuted &&
        other.volume == volume;
  }

  @override
  int get hashCode {
    return Object.hash(
      contentType,
      contentId,
      contentName,
      episodeIndex,
      position,
      duration,
      isPlaying,
      playbackSpeed,
      isMuted,
      volume,
    );
  }
}
