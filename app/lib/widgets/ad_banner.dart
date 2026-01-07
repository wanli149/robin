import 'package:flutter/material.dart';

import '../core/router.dart';
import 'net_image.dart';

/// 横幅广告组件
/// 支持图片和视频广告，实现点击跳转逻辑
class AdBanner extends StatelessWidget {
  final AdBannerData data;
  final double? height;
  final EdgeInsetsGeometry? margin;

  const AdBanner({
    super.key,
    required this.data,
    this.height,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height ?? 120,
      margin: margin ?? const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _handleAdClick(context),
          borderRadius: BorderRadius.circular(12),
          child: Stack(
            children: [
              // 广告内容
              _buildAdContent(),

              // 广告标识
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.5),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    '广告',
                    style: TextStyle(
                      fontSize: 10,
                      color: Colors.white70,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 构建广告内容
  Widget _buildAdContent() {
    if (data.contentType == 'image') {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: NetImage(
          url: data.mediaUrl,
          width: double.infinity,
          height: double.infinity,
          fit: BoxFit.cover,
        ),
      );
    } else if (data.contentType == 'video') {
      // TODO: 实现视频广告播放
      // 目前先显示视频封面
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          children: [
            NetImage(
              url: data.mediaUrl,
              width: double.infinity,
              height: double.infinity,
              fit: BoxFit.cover,
            ),
            const Center(
              child: Icon(
                Icons.play_circle_outline,
                size: 48,
                color: Colors.white,
              ),
            ),
          ],
        ),
      );
    } else {
      return Container(
        decoration: BoxDecoration(
          color: const Color(0xFF1E1E1E),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Center(
          child: Text(
            '广告加载中...',
            style: TextStyle(color: Colors.white54),
          ),
        ),
      );
    }
  }

  /// 处理广告点击
  Future<void> _handleAdClick(BuildContext context) async {
    if (data.actionUrl.isEmpty) return;

    try {
      // 使用通用路由处理跳转
      await UniversalRouter.handleRoute(data.actionUrl);
    } catch (e) {
      print('❌ Failed to handle ad click: $e');
    }
  }
}

/// 广告横幅数据模型
class AdBannerData {
  final int id;
  final String location;
  final String contentType; // 'image' 或 'video'
  final String mediaUrl;
  final String actionType; // 'browser', 'webview', 'deeplink', 'video'
  final String actionUrl;
  final int weight;
  final bool isActive;

  AdBannerData({
    required this.id,
    required this.location,
    required this.contentType,
    required this.mediaUrl,
    required this.actionType,
    required this.actionUrl,
    this.weight = 1,
    this.isActive = true,
  });

  factory AdBannerData.fromJson(Map<String, dynamic> json) {
    return AdBannerData(
      id: json['id'] ?? 0,
      location: json['location'] ?? '',
      contentType: json['content_type'] ?? 'image',
      mediaUrl: json['media_url'] ?? '',
      actionType: json['action_type'] ?? 'browser',
      actionUrl: json['action_url'] ?? '',
      weight: json['weight'] ?? 1,
      isActive: json['is_active'] == 1 || json['is_active'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'location': location,
      'content_type': contentType,
      'media_url': mediaUrl,
      'action_type': actionType,
      'action_url': actionUrl,
      'weight': weight,
      'is_active': isActive,
    };
  }
}
