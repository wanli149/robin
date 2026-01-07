import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:url_launcher/url_launcher.dart';
import 'http_client.dart';

/// 版本信息模型
class VersionInfo {
  final String version;
  final String url;
  final String changelog;
  final bool force;
  
  VersionInfo({
    required this.version,
    required this.url,
    required this.changelog,
    required this.force,
  });
  
  factory VersionInfo.fromJson(Map<String, dynamic> json) {
    // 兼容后端返回的 data 字段
    final data = json['data'] ?? json;
    
    return VersionInfo(
      version: data['version'] ?? data['current_version'] ?? '',
      url: data['url'] ?? '',
      changelog: data['changelog'] ?? '',
      force: data['force'] ?? false,
    );
  }
}

/// 强制更新检查器
/// 在 APP 启动时检查版本更新，支持强制更新
class Updater {
  static final HttpClient _httpClient = HttpClient();
  
  /// 当前 APP 版本
  static const String currentVersion = '1.0.0';
  
  /// 检查更新
  static Future<void> checkUpdate(BuildContext context) async {
    try {
      print('🔍 Checking for updates...');
      
      final response = await _httpClient.get('/api/version');
      
      if (response.statusCode == 200 && response.data != null) {
        final versionInfo = VersionInfo.fromJson(response.data);
        
        print('📦 Current version: $currentVersion');
        print('📦 Latest version: ${versionInfo.version}');
        print('⚠️ Force update: ${versionInfo.force}');
        
        // 比较版本号
        if (_shouldUpdate(currentVersion, versionInfo.version)) {
          if (versionInfo.force) {
            // 强制更新
            _showForceUpdateDialog(context, versionInfo);
          } else {
            // 可选更新
            _showOptionalUpdateDialog(context, versionInfo);
          }
        } else {
          print('✅ App is up to date');
        }
      }
    } catch (e) {
      print('❌ Failed to check update: $e');
      // 更新检查失败不影响 APP 启动
    }
  }
  
  /// 比较版本号
  /// 返回 true 表示需要更新
  static bool _shouldUpdate(String current, String latest) {
    try {
      // 检查版本号是否为空
      if (latest.isEmpty || current.isEmpty) {
        print('⚠️ Version string is empty, skipping update check');
        return false;
      }
      
      // 移除可能的空格
      final cleanCurrent = current.trim();
      final cleanLatest = latest.trim();
      
      // 检查版本号格式是否有效
      if (!_isValidVersion(cleanCurrent) || !_isValidVersion(cleanLatest)) {
        print('⚠️ Invalid version format: current=$cleanCurrent, latest=$cleanLatest');
        return false;
      }
      
      final currentParts = cleanCurrent.split('.').map(int.parse).toList();
      final latestParts = cleanLatest.split('.').map(int.parse).toList();
      
      for (int i = 0; i < 3; i++) {
        final currentPart = i < currentParts.length ? currentParts[i] : 0;
        final latestPart = i < latestParts.length ? latestParts[i] : 0;
        
        if (latestPart > currentPart) {
          return true;
        } else if (latestPart < currentPart) {
          return false;
        }
      }
      
      return false;
    } catch (e) {
      print('❌ Failed to compare versions: $e');
      return false;
    }
  }
  
  /// 检查版本号格式是否有效
  static bool _isValidVersion(String version) {
    // 版本号应该是 x.y.z 格式，其中 x, y, z 是数字
    final regex = RegExp(r'^\d+\.\d+\.\d+$');
    return regex.hasMatch(version);
  }
  
  /// 显示强制更新对话框
  static void _showForceUpdateDialog(
    BuildContext context,
    VersionInfo versionInfo,
  ) {
    showDialog(
      context: context,
      barrierDismissible: false, // 不可关闭
      builder: (context) => WillPopScope(
        onWillPop: () async => false, // 禁止返回键
        child: AlertDialog(
          title: const Text('发现新版本'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '版本 ${versionInfo.version}',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  '更新内容：',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(versionInfo.changelog),
                const SizedBox(height: 16),
                const Text(
                  '⚠️ 此版本为强制更新，请立即更新',
                  style: TextStyle(
                    color: Colors.red,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          actions: [
            ElevatedButton(
              onPressed: () => _downloadUpdate(versionInfo.url),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.amber,
                minimumSize: const Size(double.infinity, 45),
              ),
              child: const Text(
                '立即更新',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
  
  /// 显示可选更新对话框
  static void _showOptionalUpdateDialog(
    BuildContext context,
    VersionInfo versionInfo,
  ) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('发现新版本'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '版本 ${versionInfo.version}',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                '更新内容：',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(versionInfo.changelog),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('稍后更新'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              _downloadUpdate(versionInfo.url);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.amber,
            ),
            child: const Text('立即更新'),
          ),
        ],
      ),
    );
  }
  
  /// 下载更新
  static Future<void> _downloadUpdate(String url) async {
    try {
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(
          uri,
          mode: LaunchMode.externalApplication,
        );
      } else {
        Get.snackbar(
          '错误',
          '无法打开下载链接',
          snackPosition: SnackPosition.BOTTOM,
        );
      }
    } catch (e) {
      print('❌ Failed to download update: $e');
      Get.snackbar(
        '错误',
        '下载失败，请稍后重试',
        snackPosition: SnackPosition.BOTTOM,
      );
    }
  }
}
