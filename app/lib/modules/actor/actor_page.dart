import 'package:flutter/material.dart';
import '../../core/http_client.dart';
import '../../widgets/net_image.dart';
import '../../core/router.dart';

/// 演员详情页
class ActorPage extends StatefulWidget {
  final int actorId;
  final String actorName;

  const ActorPage({
    super.key,
    required this.actorId,
    required this.actorName,
  });

  @override
  State<ActorPage> createState() => _ActorPageState();
}

class _ActorPageState extends State<ActorPage> {
  final HttpClient _httpClient = HttpClient();
  bool _isLoading = true;
  String _error = '';
  Map<String, dynamic>? _actorData;
  List<Map<String, dynamic>> _works = [];

  @override
  void initState() {
    super.initState();
    _loadActorDetail();
  }

  Future<void> _loadActorDetail() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });

    try {
      final response = await _httpClient.get('/api/actor/${widget.actorId}');

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1 && data['data'] != null) {
          setState(() {
            _actorData = data['data'];
            _works = (data['data']['works'] as List?)
                    ?.map((e) => Map<String, dynamic>.from(e as Map))
                    .toList() ??
                [];
            _isLoading = false;
          });
          return;
        }
      }

      setState(() {
        _error = '加载失败';
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = '网络错误';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        title: Text(widget.actorName),
        backgroundColor: const Color(0xFF1E1E1E),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
        ),
      );
    }

    if (_error.isNotEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline,
              size: 64,
              color: Colors.white38,
            ),
            const SizedBox(height: 16),
            Text(
              _error,
              style: const TextStyle(
                color: Colors.white54,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _loadActorDetail,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFFC107),
              ),
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    if (_actorData == null) {
      return const Center(
        child: Text(
          '演员不存在',
          style: TextStyle(
            color: Colors.white54,
            fontSize: 16,
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // 演员信息卡片
        _buildActorInfo(),
        const SizedBox(height: 24),

        // 作品列表标题
        const Text(
          '作品列表',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 12),

        // 作品网格
        _buildWorksGrid(),
      ],
    );
  }

  Widget _buildActorInfo() {
    final name = _actorData!['name'] as String? ?? '';
    final nameEn = _actorData!['name_en'] as String? ?? '';
    final bio = _actorData!['bio'] as String? ?? '';
    final worksCount = _actorData!['works_count'] as int? ?? 0;
    final popularity = _actorData!['popularity'] as num? ?? 0;

    return Card(
      color: const Color(0xFF1E1E1E),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // 头像和名字
            Row(
              children: [
                // 头像
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: const Color(0xFF2E2E2E),
                    borderRadius: BorderRadius.circular(40),
                  ),
                  child: const Icon(
                    Icons.person,
                    size: 40,
                    color: Colors.white54,
                  ),
                ),
                const SizedBox(width: 16),

                // 名字和统计
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      if (nameEn.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          nameEn,
                          style: const TextStyle(
                            fontSize: 14,
                            color: Colors.white54,
                          ),
                        ),
                      ],
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          _buildStatChip('$worksCount 部作品', Icons.movie),
                          const SizedBox(width: 8),
                          _buildStatChip('人气 ${popularity.toInt()}', Icons.favorite),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),

            // 简介
            if (bio.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text(
                bio,
                style: const TextStyle(
                  fontSize: 14,
                  color: Colors.white70,
                  height: 1.5,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatChip(String text, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFF2E2E2E),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: const Color(0xFFFFC107)),
          const SizedBox(width: 4),
          Text(
            text,
            style: const TextStyle(
              fontSize: 12,
              color: Colors.white70,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWorksGrid() {
    if (_works.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text(
            '暂无作品',
            style: TextStyle(
              color: Colors.white54,
              fontSize: 14,
            ),
          ),
        ),
      );
    }

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 0.58, // 与首页模块保持一致
      ),
      itemCount: _works.length,
      itemBuilder: (context, index) {
        final work = _works[index];
        return _buildWorkItem(work);
      },
    );
  }

  Widget _buildWorkItem(Map<String, dynamic> work) {
    final vodId = work['vod_id'] as String? ?? '';
    final vodName = work['vod_name'] as String? ?? '';
    final vodPic = work['vod_pic'] as String? ?? '';
    final vodYear = work['vod_year']?.toString() ?? '';
    final vodScore = (work['vod_score'] as num?)?.toDouble() ?? 0.0;
    final roleType = work['role_type'] as String? ?? '';

    return GestureDetector(
      onTap: () {
        UniversalRouter.toVideoDetail(vodId);
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 封面
          Expanded(
            child: Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: NetImage(
                    url: vodPic,
                    width: double.infinity,
                    height: double.infinity,
                    fit: BoxFit.cover,
                  ),
                ),
                // 角色标签
                if (roleType.isNotEmpty)
                  Positioned(
                    top: 4,
                    right: 4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: _getRoleColor(roleType),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        _getRoleText(roleType),
                        style: const TextStyle(
                          fontSize: 10,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // 标题 - 固定高度，与首页模块保持一致
          SizedBox(
            height: 36,
            child: Text(
              vodName,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13,
                color: Colors.white,
                height: 1.3,
              ),
            ),
          ),
          // 年份和评分
          Row(
            children: [
              if (vodYear.isNotEmpty)
                Text(
                  vodYear,
                  style: const TextStyle(
                    fontSize: 10,
                    color: Colors.white54,
                  ),
                ),
              if (vodYear.isNotEmpty && vodScore > 0) const SizedBox(width: 4),
              if (vodScore > 0)
                Text(
                  '⭐${vodScore.toStringAsFixed(1)}',
                  style: const TextStyle(
                    fontSize: 10,
                    color: Color(0xFFFFC107),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Color _getRoleColor(String roleType) {
    switch (roleType) {
      case 'director':
        return Colors.amber;
      case 'writer':
        return Colors.green;
      default:
        return Colors.blue;
    }
  }

  String _getRoleText(String roleType) {
    switch (roleType) {
      case 'director':
        return '导演';
      case 'writer':
        return '编剧';
      default:
        return '演员';
    }
  }
}
