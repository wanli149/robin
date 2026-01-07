/// Source Settings Page
/// 换源设置页面 - 选择视频资源站

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SourceSettingsPage extends StatefulWidget {
  const SourceSettingsPage({super.key});

  @override
  State<SourceSettingsPage> createState() => _SourceSettingsPageState();
}

class _SourceSettingsPageState extends State<SourceSettingsPage> {
  final List<Map<String, dynamic>> _sources = [
    {
      'id': 'auto',
      'name': '智能聚合',
      'description': '自动从多个资源站聚合，推荐使用',
      'icon': Icons.auto_awesome,
      'color': Colors.amber,
    },
    {
      'id': 'feifan',
      'name': '非凡资源',
      'description': '更新快，资源全',
      'icon': Icons.star,
      'color': Colors.blue,
    },
    {
      'id': 'liangzi',
      'name': '量子资源',
      'description': '高清画质，稳定播放',
      'icon': Icons.hd,
      'color': Colors.green,
    },
    {
      'id': 'xinlang',
      'name': '新浪资源',
      'description': '速度快，少广告',
      'icon': Icons.speed,
      'color': Colors.orange,
    },
    {
      'id': 'fantaiying',
      'name': '饭太硬资源',
      'description': '资源丰富',
      'icon': Icons.video_library,
      'color': Colors.purple,
    },
  ];

  String _selectedSource = 'auto';
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSelectedSource();
  }

  Future<void> _loadSelectedSource() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      setState(() {
        _selectedSource = prefs.getString('preferred_source') ?? 'auto';
        _isLoading = false;
      });
    } catch (e) {
      print('❌ Failed to load source: $e');
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _selectSource(String sourceId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('preferred_source', sourceId);
      
      setState(() {
        _selectedSource = sourceId;
      });

      Get.snackbar(
        '成功',
        '已切换到${_sources.firstWhere((s) => s['id'] == sourceId)['name']}',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.green,
        colorText: Colors.white,
      );
    } catch (e) {
      print('❌ Failed to save source: $e');
      Get.snackbar(
        '错误',
        '保存失败，请重试',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red,
        colorText: Colors.white,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E1E1E),
        elevation: 0,
        title: const Text('换源设置'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Get.back(),
        ),
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // 说明卡片
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E1E1E),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.info_outline,
                        color: Color(0xFFFFC107),
                        size: 24,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              '什么是换源？',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '不同资源站提供的视频源质量和速度不同，您可以根据需要切换资源站。推荐使用"智能聚合"模式。',
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.7),
                                fontSize: 13,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // 资源站列表
                ...(_sources.map((source) => _buildSourceCard(source))),
              ],
            ),
    );
  }

  Widget _buildSourceCard(Map<String, dynamic> source) {
    final isSelected = _selectedSource == source['id'];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _selectSource(source['id']),
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E1E1E),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isSelected
                    ? const Color(0xFFFFC107)
                    : Colors.transparent,
                width: 2,
              ),
            ),
            child: Row(
              children: [
                // 图标
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: (source['color'] as Color).withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    source['icon'] as IconData,
                    color: source['color'] as Color,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 16),

                // 信息
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            source['name'],
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          if (source['id'] == 'auto') ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFC107),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                '推荐',
                                style: TextStyle(
                                  color: Colors.black,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        source['description'],
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.6),
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),

                // 选中标记
                if (isSelected)
                  const Icon(
                    Icons.check_circle,
                    color: Color(0xFFFFC107),
                    size: 28,
                  )
                else
                  Icon(
                    Icons.circle_outlined,
                    color: Colors.white.withOpacity(0.3),
                    size: 28,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
