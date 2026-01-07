import 'package:flutter/material.dart';
import '../../../core/router.dart';
import '../../../services/api_service.dart';

/// 文章列表组件
/// 支持从后端动态加载文章
class ArticleList extends StatefulWidget {
  final String title;
  final List<Map<String, dynamic>> articles;
  final String? moreRoute;
  final bool autoLoad;
  final String displayStyle; // 'card' 或 'list'

  const ArticleList({
    super.key,
    this.title = '最新资讯',
    required this.articles,
    this.moreRoute,
    this.autoLoad = true,
    this.displayStyle = 'card',
  });

  @override
  State<ArticleList> createState() => _ArticleListState();
}

class _ArticleListState extends State<ArticleList> {
  List<Map<String, dynamic>> _articles = [];
  bool _loading = false;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _articles = widget.articles;
    
    if (widget.autoLoad && _articles.isEmpty) {
      _loadArticles();
    }
  }

  Future<void> _loadArticles() async {
    if (_loading || _loaded) return;
    
    setState(() => _loading = true);

    try {
      final result = await ApiService.getArticles(limit: 10);
      
      if (mounted && result.isNotEmpty) {
        setState(() {
          _articles = result;
          _loading = false;
          _loaded = true;
        });
      } else if (mounted) {
        setState(() => _loading = false);
      }
    } catch (e) {
      print('❌ Failed to load articles: $e');
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_articles.isEmpty && !_loading) return const SizedBox.shrink();

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
          // 文章列表
          if (_loading)
            const SizedBox(
              height: 120,
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
          else if (widget.displayStyle == 'list')
            _buildListStyle()
          else
            _buildCardStyle(),
        ],
      ),
    );
  }

  /// 卡片样式（横向滚动）
  Widget _buildCardStyle() {
    return SizedBox(
      height: 140,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _articles.length,
        itemBuilder: (context, index) {
          return Padding(
            padding: EdgeInsets.only(right: index < _articles.length - 1 ? 12 : 0),
            child: _buildArticleCard(_articles[index]),
          );
        },
      ),
    );
  }

  /// 列表样式（纵向）
  Widget _buildListStyle() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: _articles.take(5).map((article) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _buildArticleListItem(article),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildArticleCard(Map<String, dynamic> article) {
    final title = article['title'] as String? ?? '';
    final cover = article['cover'] as String? ?? '';
    final articleId = article['id']?.toString() ?? '';
    final summary = article['summary'] as String? ?? '';

    return GestureDetector(
      onTap: () {
        if (articleId.isNotEmpty) {
          UniversalRouter.handleRoute('article://$articleId');
        }
      },
      child: Container(
        width: 200,
        decoration: BoxDecoration(
          color: const Color(0xFF1E1E1E),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: const Color(0xFF2E2E2E),
            width: 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 封面图
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
              child: SizedBox(
                height: 80,
                width: double.infinity,
                child: _buildCover(cover, title),
              ),
            ),
            // 标题
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Colors.white,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildArticleListItem(Map<String, dynamic> article) {
    final title = article['title'] as String? ?? '';
    final cover = article['cover'] as String? ?? '';
    final articleId = article['id']?.toString() ?? '';
    final summary = article['summary'] as String? ?? '';
    final author = article['author'] as String? ?? '';
    final hits = article['hits'] as int? ?? 0;

    return GestureDetector(
      onTap: () {
        if (articleId.isNotEmpty) {
          UniversalRouter.handleRoute('article://$articleId');
        }
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF1E1E1E),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: const Color(0xFF2E2E2E),
            width: 1,
          ),
        ),
        child: Row(
          children: [
            // 封面
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: 80,
                height: 60,
                child: _buildCover(cover, title),
              ),
            ),
            const SizedBox(width: 12),
            // 内容
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      color: Colors.white,
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      if (author.isNotEmpty) ...[
                        const Icon(Icons.person_outline, size: 12, color: Colors.white54),
                        const SizedBox(width: 4),
                        Text(
                          author,
                          style: const TextStyle(fontSize: 11, color: Colors.white54),
                        ),
                        const SizedBox(width: 12),
                      ],
                      const Icon(Icons.visibility_outlined, size: 12, color: Colors.white54),
                      const SizedBox(width: 4),
                      Text(
                        '$hits',
                        style: const TextStyle(fontSize: 11, color: Colors.white54),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCover(String cover, String title) {
    if (cover.isEmpty) {
      return Container(
        color: const Color(0xFF2E2E2E),
        child: const Center(
          child: Icon(
            Icons.article_outlined,
            color: Color(0xFFFFC107),
            size: 32,
          ),
        ),
      );
    }

    return Image.network(
      cover,
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => Container(
        color: const Color(0xFF2E2E2E),
        child: const Center(
          child: Icon(
            Icons.article_outlined,
            color: Color(0xFFFFC107),
            size: 32,
          ),
        ),
      ),
    );
  }
}
