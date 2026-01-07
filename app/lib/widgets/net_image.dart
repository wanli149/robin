import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../config/api_config.dart';

/// 网络图片组件
/// 自动使用图片代理，支持缓存和占位符
class NetImage extends StatelessWidget {
  final String url;
  final double? width;
  final double? height;
  final BoxFit fit;
  final BorderRadius? borderRadius;

  const NetImage({
    super.key,
    required this.url,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    // 如果 URL 为空，显示占位图
    if (url.isEmpty) {
      return _buildPlaceholder();
    }

    // 构建代理 URL
    final proxyUrl = _buildProxyUrl(url);

    Widget imageWidget = CachedNetworkImage(
      imageUrl: proxyUrl,
      width: width,
      height: height,
      fit: fit,
      placeholder: (context, url) => _buildPlaceholder(),
      errorWidget: (context, url, error) => _buildErrorWidget(),
    );

    // 如果指定了圆角，应用 ClipRRect
    if (borderRadius != null) {
      imageWidget = ClipRRect(
        borderRadius: borderRadius!,
        child: imageWidget,
      );
    }

    return imageWidget;
  }

  /// 构建代理 URL
  String _buildProxyUrl(String originalUrl) {
    // 如果 URL 为空，直接返回
    if (originalUrl.isEmpty) {
      return originalUrl;
    }

    // 如果已经是代理 URL（包含 /img?url=），直接返回
    if (originalUrl.contains('/img?url=')) {
      return originalUrl;
    }

    // 如果是相对路径、本地资源或 data URL，直接返回
    if (!originalUrl.startsWith('http://') && 
        !originalUrl.startsWith('https://')) {
      return originalUrl;
    }

    // 构建代理 URL: /img?url=xxx
    final encodedUrl = Uri.encodeComponent(originalUrl);
    return '${ApiConfig.baseUrl}/img?url=$encodedUrl';
  }

  /// 构建占位符
  Widget _buildPlaceholder() {
    return Container(
      width: width,
      height: height,
      color: const Color(0xFF1E1E1E),
      child: const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFC107)),
          strokeWidth: 2,
        ),
      ),
    );
  }

  /// 构建错误图标
  Widget _buildErrorWidget() {
    return Container(
      width: width,
      height: height,
      color: const Color(0xFF1E1E1E),
      child: const Icon(
        Icons.broken_image_outlined,
        color: Colors.white24,
        size: 40,
      ),
    );
  }
}
