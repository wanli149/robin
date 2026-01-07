import 'package:flutter/material.dart';
import 'package:get/get.dart';

/// 播放源和选集选择器组件
/// 
/// 支持多播放源切换和选集网格显示
class EpisodeSelector extends StatelessWidget {
  /// 所有播放源 [{name: '超清1', episodes: [...], count: 10}]
  final List<Map<String, dynamic>> playSources;
  
  /// 当前选中的播放源索引
  final int currentSourceIndex;
  
  /// 当前选中的集数索引
  final int currentEpisodeIndex;
  
  /// 切换播放源回调
  final Function(int) onSourceChanged;
  
  /// 选择集数回调
  final Function(int) onEpisodeSelected;
  
  /// 继续播放信息 {episodeIndex: 5, position: Duration, episodeName: '第6集'}
  final Map<String, dynamic>? continueInfo;
  
  /// 继续播放回调
  final VoidCallback? onContinuePlay;

  const EpisodeSelector({
    super.key,
    required this.playSources,
    required this.currentSourceIndex,
    required this.currentEpisodeIndex,
    required this.onSourceChanged,
    required this.onEpisodeSelected,
    this.continueInfo,
    this.onContinuePlay,
  });

  @override
  Widget build(BuildContext context) {
    if (playSources.isEmpty) return const SizedBox.shrink();
    
    final currentSource = playSources[currentSourceIndex];
    final episodes = currentSource['episodes'] as List<Map<String, dynamic>>? ?? [];
    
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 继续播放提示
          if (continueInfo != null) _buildContinuePlayBanner(),
          
          // 播放线路标题和Tab
          if (playSources.length > 1) ...[
            _buildSourceHeader(),
            const SizedBox(height: 12),
            _buildSourceTabs(),
            const SizedBox(height: 16),
          ],
          
          // 选集标题
          _buildEpisodeHeader(episodes.length),
          const SizedBox(height: 12),
          
          // 选集网格
          _buildEpisodeGrid(episodes),
        ],
      ),
    );
  }
  
  /// 构建继续播放横幅
  Widget _buildContinuePlayBanner() {
    final episodeName = continueInfo!['episodeName'] as String? ?? '';
    final position = continueInfo!['position'] as Duration? ?? Duration.zero;
    final positionStr = _formatDuration(position);
    
    return GestureDetector(
      onTap: onContinuePlay,
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              const Color(0xFFFFC107).withOpacity(0.2),
              const Color(0xFFFFC107).withOpacity(0.1),
            ],
          ),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: const Color(0xFFFFC107).withOpacity(0.3),
          ),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.play_circle_filled,
              color: Color(0xFFFFC107),
              size: 24,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '继续播放',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  Text(
                    '$episodeName · $positionStr',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Colors.white70,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right,
              color: Colors.white54,
            ),
          ],
        ),
      ),
    );
  }
  
  /// 构建播放线路标题
  Widget _buildSourceHeader() {
    return Row(
      children: [
        const Text(
          '播放线路',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        const Spacer(),
        Text(
          '共${playSources.length}条线路',
          style: const TextStyle(
            fontSize: 12,
            color: Colors.white54,
          ),
        ),
      ],
    );
  }
  
  /// 构建播放源Tab
  Widget _buildSourceTabs() {
    return SizedBox(
      height: 36,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: playSources.length,
        itemBuilder: (context, index) {
          final source = playSources[index];
          final isSelected = index == currentSourceIndex;
          final name = source['name'] as String? ?? '线路${index + 1}';
          final count = source['count'] as int? ?? 0;
          
          return GestureDetector(
            onTap: () => onSourceChanged(index),
            child: Container(
              margin: const EdgeInsets.only(right: 12),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: isSelected 
                    ? const Color(0xFFFFC107) 
                    : const Color(0xFF1E1E1E),
                borderRadius: BorderRadius.circular(18),
                border: isSelected 
                    ? null 
                    : Border.all(color: Colors.white24),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    name,
                    style: TextStyle(
                      fontSize: 13,
                      color: isSelected ? Colors.black : Colors.white70,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${count}集',
                    style: TextStyle(
                      fontSize: 11,
                      color: isSelected 
                          ? Colors.black54 
                          : Colors.white38,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
  
  /// 构建选集标题
  Widget _buildEpisodeHeader(int count) {
    return Row(
      children: [
        const Text(
          '选集',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        const Spacer(),
        Text(
          '共$count集',
          style: const TextStyle(
            fontSize: 12,
            color: Colors.white54,
          ),
        ),
      ],
    );
  }
  
  /// 构建选集网格
  Widget _buildEpisodeGrid(List<Map<String, dynamic>> episodes) {
    // 如果集数少于等于20，使用横向滚动
    if (episodes.length <= 20) {
      return SizedBox(
        height: 40,
        child: ListView.builder(
          scrollDirection: Axis.horizontal,
          itemCount: episodes.length,
          itemBuilder: (context, index) => _buildEpisodeItem(episodes, index),
        ),
      );
    }
    
    // 集数多时使用网格布局（显示前两行，可展开）
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: List.generate(
        episodes.length > 20 ? 20 : episodes.length,
        (index) => _buildEpisodeGridItem(episodes, index),
      ),
    );
  }
  
  /// 构建横向滚动的选集项
  Widget _buildEpisodeItem(List<Map<String, dynamic>> episodes, int index) {
    final episode = episodes[index];
    final isSelected = index == currentEpisodeIndex;
    final name = episode['name'] as String? ?? '第${index + 1}集';
    
    return GestureDetector(
      onTap: () => onEpisodeSelected(index),
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: isSelected 
              ? const Color(0xFFFFC107) 
              : const Color(0xFF1E1E1E),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          name,
          style: TextStyle(
            fontSize: 14,
            color: isSelected ? Colors.black : Colors.white70,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }
  
  /// 构建网格布局的选集项
  Widget _buildEpisodeGridItem(List<Map<String, dynamic>> episodes, int index) {
    final episode = episodes[index];
    final isSelected = index == currentEpisodeIndex;
    final name = episode['name'] as String? ?? '第${index + 1}集';
    
    // 简化名称显示
    String displayName = name;
    if (name.startsWith('第') && name.endsWith('集')) {
      // 提取数字
      final numStr = name.replaceAll(RegExp(r'[^0-9]'), '');
      if (numStr.isNotEmpty) {
        displayName = numStr;
      }
    }
    
    return GestureDetector(
      onTap: () => onEpisodeSelected(index),
      child: Container(
        width: 48,
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: isSelected 
              ? const Color(0xFFFFC107) 
              : const Color(0xFF1E1E1E),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          displayName,
          style: TextStyle(
            fontSize: 14,
            color: isSelected ? Colors.black : Colors.white70,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          ),
        ),
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
    }
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }
}
