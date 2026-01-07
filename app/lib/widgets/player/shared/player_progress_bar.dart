import 'package:flutter/material.dart';
import '../../../core/global_player_manager.dart';

/// 播放器进度条组件
class PlayerProgressBar extends StatelessWidget {
  final PlayerState state;
  final GlobalPlayerManager manager;
  final bool showTime;
  final double height;
  final Color? activeColor;
  final Color? inactiveColor;

  const PlayerProgressBar({
    super.key,
    required this.state,
    required this.manager,
    this.showTime = true,
    this.height = 4,
    this.activeColor,
    this.inactiveColor,
  });

  @override
  Widget build(BuildContext context) {
    if (showTime) {
      return _buildProgressWithTime();
    } else {
      return _buildSimpleProgress();
    }
  }

  /// 构建带时间显示的进度条
  Widget _buildProgressWithTime() {
    return Row(
      children: [
        Text(
          _formatDuration(state.position),
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(child: _buildSlider()),
        const SizedBox(width: 8),
        Text(
          _formatDuration(state.duration),
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12,
          ),
        ),
      ],
    );
  }

  /// 构建简单进度条
  Widget _buildSimpleProgress() {
    return SizedBox(
      height: height,
      child: LinearProgressIndicator(
        value: state.duration.inSeconds > 0
            ? state.position.inSeconds / state.duration.inSeconds
            : 0.0,
        backgroundColor: inactiveColor ?? Colors.white24,
        valueColor: AlwaysStoppedAnimation<Color>(
          activeColor ?? const Color(0xFFFFC107),
        ),
      ),
    );
  }

  /// 构建可拖拽的滑块
  Widget _buildSlider() {
    return SliderTheme(
      data: SliderThemeData(
        trackHeight: 3,
        thumbShape: const RoundSliderThumbShape(
          enabledThumbRadius: 6,
        ),
        overlayShape: const RoundSliderOverlayShape(
          overlayRadius: 12,
        ),
      ),
      child: Slider(
        value: state.position.inMilliseconds.toDouble(),
        min: 0,
        max: state.duration.inMilliseconds.toDouble().clamp(1, double.infinity),
        activeColor: activeColor ?? const Color(0xFFFFC107),
        inactiveColor: inactiveColor ?? Colors.white24,
        onChanged: (value) {
          manager.seekTo(Duration(milliseconds: value.toInt()));
        },
      ),
    );
  }

  /// 格式化时长
  String _formatDuration(Duration duration) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);

    if (hours > 0) {
      return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    } else {
      return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    }
  }
}

/// 紧凑版进度条（用于全屏模式）
class CompactProgressBar extends StatelessWidget {
  final PlayerState state;
  final GlobalPlayerManager manager;
  final bool isCompactMode;

  const CompactProgressBar({
    super.key,
    required this.state,
    required this.manager,
    this.isCompactMode = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        16, 
        isCompactMode ? 4 : 8, 
        16, 
        isCompactMode ? 4 : 8
      ),
      child: Row(
        children: [
          Text(
            _formatDuration(state.position),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: SliderTheme(
              data: SliderThemeData(
                trackHeight: 2,
                thumbShape: const RoundSliderThumbShape(
                  enabledThumbRadius: 5,
                ),
                overlayShape: const RoundSliderOverlayShape(
                  overlayRadius: 10,
                ),
              ),
              child: Slider(
                value: state.position.inMilliseconds.toDouble(),
                min: 0,
                max: state.duration.inMilliseconds.toDouble().clamp(1, double.infinity),
                activeColor: const Color(0xFFFFC107),
                inactiveColor: Colors.white24,
                onChanged: (value) {
                  manager.seekTo(Duration(milliseconds: value.toInt()));
                },
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            _formatDuration(state.duration),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }

  /// 格式化时长
  String _formatDuration(Duration duration) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);

    if (hours > 0) {
      return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    } else {
      return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    }
  }
}