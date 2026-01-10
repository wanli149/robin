import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../services/api_service.dart';

/// 文章详情页面
class ArticleDetailPage extends StatefulWidget {
  const ArticleDetailPage({super.key});

  @override
  State<ArticleDetailPage> createState() => _ArticleDetailPageState();
}

class _ArticleDetailPageState extends State<ArticleDetailPage> {
  Map<String, dynamic>? _article;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadArticle();
  }

  Future<void> _loadArticle() async {
    final args = Get.arguments as Map<String, dynamic>?;
    final articleId = args?['articleId']?.toString();

    if (articleId == null || articleId.isEmpty) {
      setState(() {
        _loading = false;
        _error = '文章ID无效';
      });
      return;
    }

    try {
      final article = await ApiService.getArticleDetail(int.parse(articleId));
      if (mounted) {
        setState(() {
          _article = article;
          _loading = false;
          _error = article == null ? '文章不存在' : null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = '加载失败: $e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E1E1E),
        title: Text(
          _article?['title'] ?? '文章详情',
          style: const TextStyle(fontSize: 18),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios),
          onPressed: () => Get.back(),
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFFFFC107)),
      );
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.white54),
            const SizedBox(height: 16),
            Text(_error!, style: const TextStyle(color: Colors.white54)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                setState(() {
                  _loading = true;
                  _error = null;
                });
                _loadArticle();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFFC107),
                foregroundColor: Colors.black,
              ),
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    if (_article == null) {
      return const Center(
        child: Text('文章不存在', style: TextStyle(color: Colors.white54)),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 标题
          Text(
            _article!['title'] ?? '',
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: Colors.white,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 16),
          // 元信息
          _buildMeta(),
          const SizedBox(height: 16),
          // 封面图
          if (_article!['cover'] != null && (_article!['cover'] as String).isNotEmpty)
            _buildCover(),
          // 摘要
          if (_article!['summary'] != null && (_article!['summary'] as String).isNotEmpty)
            _buildSummary(),
          // 正文
          _buildContent(),
          const SizedBox(height: 32),
          // 标签
          if (_article!['tags'] != null && (_article!['tags'] as String).isNotEmpty)
            _buildTags(),
        ],
      ),
    );
  }

  Widget _buildMeta() {
    final author = _article!['author'] as String? ?? '';
    final source = _article!['source'] as String? ?? '';
    final hits = _article!['hits'] as int? ?? 0;
    final publishedAt = _article!['published_at'] as int?;

    String timeStr = '';
    if (publishedAt != null) {
      final date = DateTime.fromMillisecondsSinceEpoch(publishedAt * 1000);
      timeStr = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    }

    return Wrap(
      spacing: 16,
      runSpacing: 8,
      children: [
        if (author.isNotEmpty)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.person_outline, size: 14, color: Colors.white54),
              const SizedBox(width: 4),
              Text(author, style: const TextStyle(fontSize: 13, color: Colors.white54)),
            ],
          ),
        if (source.isNotEmpty)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.source_outlined, size: 14, color: Colors.white54),
              const SizedBox(width: 4),
              Text(source, style: const TextStyle(fontSize: 13, color: Colors.white54)),
            ],
          ),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.visibility_outlined, size: 14, color: Colors.white54),
            const SizedBox(width: 4),
            Text('$hits', style: const TextStyle(fontSize: 13, color: Colors.white54)),
          ],
        ),
        if (timeStr.isNotEmpty)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.access_time, size: 14, color: Colors.white54),
              const SizedBox(width: 4),
              Text(timeStr, style: const TextStyle(fontSize: 13, color: Colors.white54)),
            ],
          ),
      ],
    );
  }

  Widget _buildCover() {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Image.network(
          _article!['cover'],
          width: double.infinity,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => const SizedBox.shrink(),
        ),
      ),
    );
  }

  Widget _buildSummary() {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF2E2E2E)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 4,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFFFC107),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              _article!['summary'],
              style: const TextStyle(
                fontSize: 14,
                color: Colors.white70,
                height: 1.6,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    final content = _article!['content'] as String? ?? '';
    if (content.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text(
            '暂无内容',
            style: TextStyle(color: Colors.white54),
          ),
        ),
      );
    }

    // 简单处理HTML内容，移除标签
    final cleanContent = content
        .replaceAll(RegExp(r'<br\s*/?>'), '\n')
        .replaceAll(RegExp(r'<p[^>]*>'), '\n')
        .replaceAll(RegExp(r'</p>'), '\n')
        .replaceAll(RegExp(r'<[^>]+>'), '')
        .replaceAll(RegExp(r'&nbsp;'), ' ')
        .replaceAll(RegExp(r'&lt;'), '<')
        .replaceAll(RegExp(r'&gt;'), '>')
        .replaceAll(RegExp(r'&amp;'), '&')
        .replaceAll(RegExp(r'\n{3,}'), '\n\n')
        .trim();

    return Text(
      cleanContent,
      style: const TextStyle(
        fontSize: 16,
        color: Colors.white,
        height: 1.8,
      ),
    );
  }

  Widget _buildTags() {
    final tags = (_article!['tags'] as String).split(',').where((t) => t.trim().isNotEmpty).toList();
    if (tags.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '标签',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: tags.map((tag) {
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFF2E2E2E),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                tag.trim(),
                style: const TextStyle(fontSize: 13, color: Colors.white70),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}
