/// 分享服务
/// 生成分享链接和二维码
library;

import 'package:qr_flutter/qr_flutter.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../core/http_client.dart';
import '../core/logger.dart';

class ShareService {
  static final HttpClient _httpClient = HttpClient();
  
  /// 分享配置
  static String _baseUrl = ''; // 从 API 配置读取
  static String _downloadUrl = '';
  static String _shareTitle = '拾光影视';
  // static String _shareDescription = '精彩影视，尽在掌握'; // 暂未使用
  static bool _initialized = false;
  
  /// 初始化分享配置（懒加载）
  static Future<void> _ensureInitialized() async {
    if (_initialized) return;
    
    try {
      final response = await _httpClient.get('/api/share/config');
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1 && data['data'] != null) {
          _downloadUrl = data['data']['download_url'] ?? '';
          _shareTitle = data['data']['share_title'] ?? '拾光影视';
          // _shareDescription = data['data']['share_description'] ?? '精彩影视，尽在掌握'; // 暂未使用
        }
      }
      
      // 从 API 配置获取 baseUrl
      final configResponse = await _httpClient.get('/api/config');
      if (configResponse.statusCode == 200 && configResponse.data != null) {
        final configData = configResponse.data;
        if (configData['code'] == 1 && configData['data'] != null) {
          _baseUrl = configData['data']['api_base_url'] ?? _httpClient.baseUrl;
        }
      }
      
      // 如果还是空的，使用 HttpClient 的 baseUrl
      if (_baseUrl.isEmpty) {
        _baseUrl = _httpClient.baseUrl;
      }
      
      _initialized = true;
      Logger.info('Share config loaded: baseUrl=$_baseUrl', 'ShareService');
    } catch (e) {
      Logger.error('Failed to load share config', 'ShareService', e);
      // 使用 HttpClient 的 baseUrl 作为默认值
      _baseUrl = _httpClient.baseUrl;
      _initialized = true;
    }
  }
  
  /// 生成分享链接
  static String generateShareUrl(String type, String id) {
    return '$_baseUrl/share/$type/$id';
  }
  
  /// 获取下载链接
  static String get downloadUrl => _downloadUrl;
  
  /// 获取分享标题
  static String get shareTitle => _shareTitle;
  
  /// 显示分享对话框
  static Future<void> showShareDialog({
    required BuildContext context,
    required String type, // 'video', 'shorts', 'topic'
    required String id,
    required String title,
  }) async {
    // 确保已初始化
    await _ensureInitialized();
    
    final shareUrl = generateShareUrl(type, id);
    
    Get.dialog(
      Directionality(
        textDirection: TextDirection.ltr,
        child: Dialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          backgroundColor: const Color(0xFF1a1a2e),
          child: Container(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // 标题
                Text(
                  '分享给好友',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.white70,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                
                // 二维码
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: QrImageView(
                    data: shareUrl,
                    version: QrVersions.auto,
                    size: 200.0,
                    backgroundColor: Colors.white,
                  ),
                ),
                const SizedBox(height: 16),
                
                // 提示文字
                Text(
                  '扫描二维码分享',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.white70,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '好友扫码后可直接观看或下载 APP',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white54,
                  ),
                ),
                const SizedBox(height: 24),
                
                // 关闭按钮
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Get.back(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFFFC107),
                      foregroundColor: Colors.black87,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      '关闭',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      barrierDismissible: true,
    );
  }
}
