import 'package:flutter/material.dart';
import '../../../core/router.dart';
import '../../../services/api_service.dart';

/// 演员列表组件
/// 支持从后端动态加载热门演员
class ActorList extends StatefulWidget {
  final String title;
  final List<Map<String, dynamic>> actors;
  final String? moreRoute;
  final bool autoLoad; // 是否自动从后端加载

  const ActorList({
    super.key,
    this.title = '热门演员',
    required this.actors,
    this.moreRoute,
    this.autoLoad = true,
  });

  @override
  State<ActorList> createState() => _ActorListState();
}

class _ActorListState extends State<ActorList> {
  List<Map<String, dynamic>> _actors = [];
  bool _loading = false;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _actors = widget.actors;
    
    // 如果传入的演员列表为空或没有头像，自动从后端加载
    if (widget.autoLoad && _shouldLoadFromBackend()) {
      _loadActors();
    }
  }

  bool _shouldLoadFromBackend() {
    if (_actors.isEmpty) return true;
    // 检查是否有演员有头像
    final hasAvatar = _actors.any((a) => 
      (a['avatar'] as String?)?.isNotEmpty == true ||
      (a['actor_pic'] as String?)?.isNotEmpty == true
    );
    return !hasAvatar;
  }

  Future<void> _loadActors() async {
    if (_loading || _loaded) return;
    
    setState(() => _loading = true);

    try {
      final result = await ApiService.getPopularActors(limit: 20);
      
      if (mounted && result.isNotEmpty) {
        setState(() {
          _actors = result;
          _loading = false;
          _loaded = true;
        });
      } else if (mounted) {
        setState(() => _loading = false);
      }
    } catch (e) {
      print('❌ Failed to load actors: $e');
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_actors.isEmpty && !_loading) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 标题栏
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Container(
                  width: 4,
                  height: 18,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFC107),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    widget.title,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
                if (widget.moreRoute != null)
                  GestureDetector(
                    onTap: () => UniversalRouter.handleRoute(widget.moreRoute!),
                    child: const Row(
                      children: [
                        Text('更多', style: TextStyle(fontSize: 14, color: Colors.white54)),
                        Icon(Icons.chevron_right, size: 18, color: Colors.white54),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // 演员列表
          if (_loading)
            const SizedBox(
              height: 130,
              child: Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Color(0xFFFFC107),
                  ),
                ),
              ),
            )
          else
            SizedBox(
              height: 130,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _actors.length,
                itemBuilder: (context, index) {
                  return Padding(
                    padding: EdgeInsets.only(right: index < _actors.length - 1 ? 16 : 0),
                    child: _buildActorCard(_actors[index]),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildActorCard(Map<String, dynamic> actor) {
    final name = actor['name'] as String? ?? actor['actor_name'] as String? ?? '';
    final avatar = actor['avatar'] as String? ?? actor['actor_pic'] as String? ?? '';
    final actorId = actor['id']?.toString() ?? actor['actor_id']?.toString() ?? '';
    final worksCount = actor['works_count'] as int? ?? 0;

    return GestureDetector(
      onTap: () {
        if (actorId.isNotEmpty) {
          UniversalRouter.handleRoute('actor://$actorId');
        } else if (name.isNotEmpty) {
          // 如果没有ID，用名字搜索
          UniversalRouter.handleRoute('search://$name');
        }
      },
      child: SizedBox(
        width: 80,
        child: Column(
          children: [
            // 头像
            Container(
              width: 70,
              height: 70,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: const Color(0xFFFFC107).withOpacity(0.3),
                  width: 2,
                ),
              ),
              child: ClipOval(
                child: _buildAvatar(avatar, name),
              ),
            ),
            const SizedBox(height: 8),
            // 名字
            Text(
              name,
              style: const TextStyle(
                fontSize: 13,
                color: Colors.white,
                fontWeight: FontWeight.w500,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
            // 作品数
            if (worksCount > 0)
              Text(
                '$worksCount部作品',
                style: const TextStyle(fontSize: 11, color: Colors.white54),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildAvatar(String avatar, String name) {
    if (avatar.isEmpty) {
      // 显示名字首字母
      return Container(
        color: const Color(0xFF2E2E2E),
        child: Center(
          child: Text(
            name.isNotEmpty ? name[0].toUpperCase() : '?',
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: Color(0xFFFFC107),
            ),
          ),
        ),
      );
    }

    return Image.network(
      avatar,
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => Container(
        color: const Color(0xFF2E2E2E),
        child: Center(
          child: Text(
            name.isNotEmpty ? name[0].toUpperCase() : '?',
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: Color(0xFFFFC107),
            ),
          ),
        ),
      ),
    );
  }
}
