import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart' as getx;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';
import '../core/logger.dart';

/// 公告数据模型
class Announcement {
  final int id;
  final String title;
  final String content;
  final String type; // info, warning, update, urgent
  final String actionType; // none, url, update, close
  final String? actionUrl;
  final String? actionText;
  final String? imageUrl;
  final bool forceShow;
  final bool showOnce;

  Announcement({
    required this.id,
    required this.title,
    required this.content,
    required this.type,
    required this.actionType,
    this.actionUrl,
    this.actionText,
    this.imageUrl,
    this.forceShow = false,
    this.showOnce = false,
  });

  factory Announcement.fromJson(Map<String, dynamic> json) {
    return Announcement(
      id: json['id'] ?? 0,
      title: json['title'] ?? '',
      content: json['content'] ?? '',
      type: json['type'] ?? 'info',
      actionType: json['action_type'] ?? 'none',
      actionUrl: json['action_url'],
      actionText: json['action_text'],
      imageUrl: json['image_url'],
      forceShow: json['force_show'] == true,
      showOnce: json['show_once'] == true,
    );
  }

  /// 获取类型对应的颜色
  Color get typeColor {
    switch (type) {
      case 'warning':
        return Colors.orange;
      case 'update':
        return Colors.green;
      case 'urgent':
        return Colors.red;
      default:
        return Colors.blue;
    }
  }

  /// 获取类型对应的图标
  IconData get typeIcon {
    switch (type) {
      case 'warning':
        return Icons.warning_amber_rounded;
      case 'update':
        return Icons.system_update;
      case 'urgent':
        return Icons.error_outline;
      default:
        return Icons.info_outline;
    }
  }
}

/// 公告服务
/// 
/// 负责获取和显示 APP 公告弹窗
class AnnouncementService extends getx.GetxService {
  static AnnouncementService get to => getx.Get.find<AnnouncementService>();
  
  final Dio _dio = Dio();
  String? _deviceId;

  @override
  void onInit() {
    super.onInit();
    _initDeviceId();
  }

  /// 初始化设备 ID
  Future<void> _initDeviceId() async {
    final prefs = await SharedPreferences.getInstance();
    _deviceId = prefs.getString('device_id');
    if (_deviceId == null) {
      _deviceId = DateTime.now().millisecondsSinceEpoch.toString();
      await prefs.setString('device_id', _deviceId!);
    }
  }

  /// 检查并显示公告
  /// 
  /// 在 APP 启动时调用，自动获取并显示有效公告
  Future<void> checkAndShowAnnouncement(BuildContext context) async {
    try {
      final announcement = await fetchAnnouncement();
      if (announcement != null && context.mounted) {
        await _showAnnouncementDialog(context, announcement);
      }
    } catch (e) {
      Logger.error('Check announcement error: $e');
    }
  }

  /// 获取当前有效的公告
  Future<Announcement?> fetchAnnouncement() async {
    try {
      final baseUrl = ApiConfig.baseUrl;
      final version = ApiConfig.appVersion;
      final platform = getx.GetPlatform.isAndroid ? 'android' : 'ios';

      final response = await _dio.get(
        '$baseUrl/api/announcement',
        queryParameters: {
          'device_id': _deviceId ?? '',
          'version': version,
          'platform': platform,
        },
        options: Options(
          sendTimeout: const Duration(seconds: 5),
          receiveTimeout: const Duration(seconds: 5),
        ),
      );

      if (response.data['code'] == 1 && response.data['data'] != null) {
        return Announcement.fromJson(response.data['data']);
      }
      return null;
    } catch (e) {
      Logger.error('Fetch announcement error: $e');
      return null;
    }
  }

  /// 显示公告弹窗
  Future<void> _showAnnouncementDialog(
    BuildContext context,
    Announcement announcement,
  ) async {
    await showDialog(
      context: context,
      barrierDismissible: !announcement.forceShow,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(announcement.typeIcon, color: announcement.typeColor),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                announcement.title,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (announcement.imageUrl != null) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(
                    announcement.imageUrl!,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => const SizedBox.shrink(),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              Text(
                announcement.content,
                style: const TextStyle(fontSize: 14, height: 1.5),
              ),
            ],
          ),
        ),
        actions: [
          if (!announcement.forceShow)
            TextButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                _markAsRead(announcement);
              },
              child: const Text('关闭'),
            ),
          if (announcement.actionType != 'none' && announcement.actionType != 'close')
            ElevatedButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                _handleAction(announcement);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: announcement.typeColor,
              ),
              child: Text(announcement.actionText ?? '查看'),
            ),
        ],
      ),
    );
  }

  /// 处理公告操作
  void _handleAction(Announcement announcement) {
    _recordClick(announcement);
    
    switch (announcement.actionType) {
      case 'url':
        if (announcement.actionUrl != null) {
          // 打开链接（可以使用 url_launcher）
          Logger.info('Open URL: ${announcement.actionUrl}');
        }
        break;
      case 'update':
        // 跳转到更新页面
        Logger.info('Navigate to update page');
        break;
    }
    
    _markAsRead(announcement);
  }

  /// 标记公告已读
  Future<void> _markAsRead(Announcement announcement) async {
    if (!announcement.showOnce) return;
    
    try {
      final baseUrl = ApiConfig.baseUrl;
      await _dio.post(
        '$baseUrl/api/announcement/read',
        data: {
          'announcement_id': announcement.id,
          'device_id': _deviceId,
        },
      );
    } catch (e) {
      Logger.error('Mark announcement read error: $e');
    }
  }

  /// 记录公告点击
  Future<void> _recordClick(Announcement announcement) async {
    try {
      final baseUrl = ApiConfig.baseUrl;
      await _dio.post(
        '$baseUrl/api/announcement/click',
        data: {'announcement_id': announcement.id},
      );
    } catch (e) {
      Logger.error('Record announcement click error: $e');
    }
  }
}
