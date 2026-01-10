import 'package:flutter/material.dart';

/// 播放源和选集选择器组件
/// 
/// 按照截图设计：
/// - 播放线路：横向卡片展示，点击"全部"弹出底部弹窗
/// - 选集：横向按钮展示，点击"全部"弹出底部弹窗
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
  
  /// 继续播放信息
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
    final rawEpisodes = currentSource['episodes'] as List? ?? [];
    final episodes = rawEpisodes
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 继续播放提示
          if (continueInfo != null) ...[
            _buildContinuePlayBanner(),
            const SizedBox(height: 16),
          ],
          
          // 播放线路
          if (playSources.length > 1) ...[
            _buildSourceSection(context),
            const SizedBox(height: 20),
          ],
          
          // 选集
          _buildEpisodeSection(context, episodes),
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
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              const Color(0xFFFFC107).withValues(alpha: 0.2),
              const Color(0xFFFFC107).withValues(alpha: 0.1),
            ],
          ),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: const Color(0xFFFFC107).withValues(alpha: 0.3),
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
            const Icon(Icons.chevron_right, color: Colors.white54),
          ],
        ),
      ),
    );
  }
  
  /// 构建播放线路区域
  Widget _buildSourceSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 标题行
        Row(
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
            GestureDetector(
              onTap: () => _showSourceBottomSheet(context),
              child: const Row(
                children: [
                  Text(
                    '全部',
                    style: TextStyle(fontSize: 13, color: Colors.white54),
                  ),
                  Icon(Icons.chevron_right, size: 18, color: Colors.white54),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        
        // 横向滚动的线路卡片
        SizedBox(
          height: 70,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            itemCount: playSources.length,
            itemBuilder: (context, index) => _buildSourceCard(index),
          ),
        ),
      ],
    );
  }
  
  /// 构建播放线路卡片
  Widget _buildSourceCard(int index) {
    final source = playSources[index];
    final isSelected = index == currentSourceIndex;
    final name = source['name'] as String? ?? '线路${index + 1}';
    final language = source['language'] as String? ?? '';
    final quality = source['quality'] as String?;
    final count = source['count'] as int? ?? 
                  (source['episodes'] as List?)?.length ?? 0;
    
    // 优先使用后端返回的清晰度，否则从名称推断
    String? qualityTag = quality;
    if (qualityTag == null || qualityTag.isEmpty) {
      if (name.contains('1080') || name.contains('超清')) {
        qualityTag = '1080P';
      } else if (name.contains('4K') || name.contains('4k')) {
        qualityTag = '4K';
      } else if (name.contains('蓝光')) {
        qualityTag = '蓝光';
      } else if (name.contains('高清') || name.contains('HD')) {
        qualityTag = '高清';
      }
    }
    
    return GestureDetector(
      onTap: () => onSourceChanged(index),
      child: Container(
        width: 130,
        margin: const EdgeInsets.only(right: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected 
              ? const Color(0xFFFFC107) 
              : const Color(0xFF1E1E1E),
          borderRadius: BorderRadius.circular(8),
          border: isSelected 
              ? null 
              : Border.all(color: const Color(0xFF2E2E2E)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // 线路名称 + 清晰度标签
            Row(
              children: [
                Expanded(
                  child: Text(
                    name,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: isSelected ? Colors.black : Colors.white,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (qualityTag != null && qualityTag.isNotEmpty) ...[
                  const SizedBox(width: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                    decoration: BoxDecoration(
                      color: isSelected 
                          ? Colors.black.withValues(alpha: 0.2)
                          : const Color(0xFFFFC107),
                      borderRadius: BorderRadius.circular(2),
                    ),
                    child: Text(
                      qualityTag,
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                        color: isSelected ? Colors.black54 : Colors.black,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            // 语言版本 + 视频数量
            Row(
              children: [
                if (language.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                    decoration: BoxDecoration(
                      color: isSelected 
                          ? Colors.black.withValues(alpha: 0.15)
                          : Colors.white.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(2),
                    ),
                    child: Text(
                      language,
                      style: TextStyle(
                        fontSize: 10,
                        color: isSelected ? Colors.black54 : Colors.white70,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                ],
                Text(
                  '$count集',
                  style: TextStyle(
                    fontSize: 11,
                    color: isSelected ? Colors.black54 : Colors.white54,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
  
  /// 构建选集区域
  Widget _buildEpisodeSection(BuildContext context, List<Map<String, dynamic>> episodes) {
    final currentSource = playSources[currentSourceIndex];
    final sourceName = currentSource['name'] as String? ?? '线路1';
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 标题行
        Row(
          children: [
            const Icon(Icons.playlist_play, color: Color(0xFFFFC107), size: 20),
            const SizedBox(width: 6),
            const Text(
              '选集',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const Spacer(),
            GestureDetector(
              onTap: () => _showEpisodeBottomSheet(context, episodes, sourceName),
              child: const Row(
                children: [
                  Text(
                    '全部',
                    style: TextStyle(fontSize: 13, color: Colors.white54),
                  ),
                  Icon(Icons.chevron_right, size: 18, color: Colors.white54),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        
        // 横向滚动的选集按钮
        SizedBox(
          height: 36,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            itemCount: episodes.length,
            itemBuilder: (context, index) => _buildEpisodeButton(episodes, index),
          ),
        ),
      ],
    );
  }
  
  /// 构建选集按钮
  Widget _buildEpisodeButton(List<Map<String, dynamic>> episodes, int index) {
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
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(
          name,
          style: TextStyle(
            fontSize: 13,
            color: isSelected ? Colors.black : Colors.white70,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }
  
  /// 显示播放线路底部弹窗
  void _showSourceBottomSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => _SourceBottomSheet(
        playSources: playSources,
        currentSourceIndex: currentSourceIndex,
        onSourceChanged: (index) {
          Navigator.pop(context);
          onSourceChanged(index);
        },
      ),
    );
  }
  
  /// 显示选集底部弹窗
  void _showEpisodeBottomSheet(
    BuildContext context, 
    List<Map<String, dynamic>> episodes,
    String sourceName,
  ) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => _EpisodeBottomSheet(
        episodes: episodes,
        currentEpisodeIndex: currentEpisodeIndex,
        sourceName: sourceName,
        onEpisodeSelected: (index) {
          Navigator.pop(context);
          onEpisodeSelected(index);
        },
        onSwitchSource: () {
          Navigator.pop(context);
          _showSourceBottomSheet(context);
        },
      ),
    );
  }
  
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


/// 播放线路底部弹窗
class _SourceBottomSheet extends StatelessWidget {
  final List<Map<String, dynamic>> playSources;
  final int currentSourceIndex;
  final Function(int) onSourceChanged;

  const _SourceBottomSheet({
    required this.playSources,
    required this.currentSourceIndex,
    required this.onSourceChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.7,
      ),
      decoration: const BoxDecoration(
        color: Color(0xFF1A1A2E),
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(16),
          topRight: Radius.circular(16),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 标题栏
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const Spacer(),
                const Text(
                  '切换线路',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: const Icon(
                    Icons.close,
                    color: Colors.white54,
                    size: 24,
                  ),
                ),
              ],
            ),
          ),
          
          // 线路列表
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              itemCount: playSources.length,
              itemBuilder: (context, index) => _buildSourceItem(index),
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildSourceItem(int index) {
    final source = playSources[index];
    final isSelected = index == currentSourceIndex;
    final name = source['name'] as String? ?? '线路${index + 1}';
    final language = source['language'] as String? ?? '';
    final quality = source['quality'] as String?;
    final count = source['count'] as int? ?? 
                  (source['episodes'] as List?)?.length ?? 0;
    
    // 收集标签（优先使用后端返回的清晰度）
    List<String> tags = [];
    if (quality != null && quality.isNotEmpty) {
      tags.add(quality);
    } else {
      if (name.contains('1080') || name.contains('超清')) tags.add('1080P');
      if (name.contains('4K') || name.contains('4k')) tags.add('4K');
      if (name.contains('蓝光')) tags.add('蓝光');
      if (name.contains('高清') || name.contains('HD')) tags.add('高清');
    }
    if (name.contains('秒播') || name.contains('极速')) tags.add('秒播');
    
    return GestureDetector(
      onTap: () => onSourceChanged(index),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected 
              ? const Color(0xFFFFC107) 
              : const Color(0xFF252540),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            // 线路信息
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 名称 + 清晰度标签
                  Row(
                    children: [
                      Text(
                        name,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: isSelected ? Colors.black : Colors.white,
                        ),
                      ),
                      if (tags.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: isSelected 
                                ? Colors.black.withValues(alpha: 0.2)
                                : const Color(0xFFFFC107),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            tags.first,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: isSelected ? Colors.black54 : Colors.black,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 6),
                  // 语言版本 + 视频数量 + 特性标签
                  Row(
                    children: [
                      if (language.isNotEmpty) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: isSelected 
                                ? Colors.black.withValues(alpha: 0.15)
                                : Colors.blue.withValues(alpha: 0.3),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            language,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                              color: isSelected ? Colors.black54 : Colors.blue[200],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                      ],
                      Text(
                        '$count集',
                        style: TextStyle(
                          fontSize: 12,
                          color: isSelected ? Colors.black54 : Colors.white54,
                        ),
                      ),
                      if (tags.length > 1) ...[
                        const SizedBox(width: 8),
                        ...tags.skip(1).map((tag) => Container(
                          margin: const EdgeInsets.only(right: 6),
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: isSelected 
                                ? Colors.black.withValues(alpha: 0.1)
                                : Colors.white.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            tag,
                            style: TextStyle(
                              fontSize: 10,
                              color: isSelected ? Colors.black54 : Colors.white54,
                            ),
                          ),
                        )),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            
            // 选中标记
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected 
                      ? Colors.black54 
                      : Colors.white38,
                  width: 2,
                ),
                color: isSelected ? Colors.black54 : Colors.transparent,
              ),
              child: isSelected 
                  ? const Icon(Icons.check, size: 16, color: Color(0xFFFFC107))
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}

/// 选集底部弹窗
class _EpisodeBottomSheet extends StatelessWidget {
  final List<Map<String, dynamic>> episodes;
  final int currentEpisodeIndex;
  final String sourceName;
  final Function(int) onEpisodeSelected;
  final VoidCallback onSwitchSource;

  const _EpisodeBottomSheet({
    required this.episodes,
    required this.currentEpisodeIndex,
    required this.sourceName,
    required this.onEpisodeSelected,
    required this.onSwitchSource,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.6,
      ),
      decoration: const BoxDecoration(
        color: Color(0xFF1A1A2E),
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(16),
          topRight: Radius.circular(16),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 标题栏
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const Icon(Icons.playlist_play, color: Color(0xFFFFC107), size: 20),
                const SizedBox(width: 6),
                const Text(
                  '选集',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: const Icon(
                    Icons.close,
                    color: Colors.white54,
                    size: 24,
                  ),
                ),
              ],
            ),
          ),
          
          // 当前线路 + 切换按钮
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: GestureDetector(
              onTap: onSwitchSource,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFC107),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      sourceName,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: Colors.black,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      '点击切换',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.black54,
                      ),
                    ),
                    const Icon(Icons.chevron_right, size: 16, color: Colors.black54),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          
          // 选集网格
          Flexible(
            child: GridView.builder(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 4,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 2.2,
              ),
              itemCount: episodes.length,
              itemBuilder: (context, index) => _buildEpisodeItem(index),
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildEpisodeItem(int index) {
    final episode = episodes[index];
    final isSelected = index == currentEpisodeIndex;
    final name = episode['name'] as String? ?? '第${index + 1}集';
    
    return GestureDetector(
      onTap: () => onEpisodeSelected(index),
      child: Container(
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: isSelected 
              ? const Color(0xFFFFC107) 
              : const Color(0xFF252540),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(
          name,
          style: TextStyle(
            fontSize: 13,
            color: isSelected ? Colors.black : Colors.white70,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }
}
