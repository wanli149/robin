import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/user_store.dart';
import '../../core/http_client.dart';
import '../../core/app_info.dart';
import '../../core/logger.dart';
import '../../core/cache_service.dart';

import '../../widgets/share_poster.dart';

/// 个人中心控制器
class ProfileController extends GetxController {
  final _httpClient = HttpClient();
  final _userStore = UserStore.to;

  
  // 系统配置
  final Rx<SystemConfig?> systemConfig = Rx<SystemConfig?>(null);
  
  // 缓存大小
  final RxString cacheSize = '0 MB'.obs;
  
  @override
  void onInit() {
    super.onInit();
    _loadSystemConfig();
    _calculateCacheSize();
  }
  
  /// 加载系统配置
  Future<void> _loadSystemConfig() async {
    try {
      final response = await _httpClient.get('/api/config');
      
      if (response.data['code'] == 1) {
        final data = response.data['data'] ?? response.data;
        systemConfig.value = SystemConfig.fromJson(data);
      }
    } catch (e) {
      Logger.error('Failed to load system config: $e');
    }
  }
  
  /// 计算缓存大小
  Future<void> _calculateCacheSize() async {
    try {
      // 获取图片缓存大小
      final imageCache = PaintingBinding.instance.imageCache;
      final imageCacheSize = imageCache.currentSize;
      
      // 简单估算（实际应该遍历缓存目录）
      final sizeInMB = (imageCacheSize * 0.5).toStringAsFixed(2);
      cacheSize.value = '$sizeInMB MB';
    } catch (e) {
      // 计算缓存大小失败
      cacheSize.value = '未知';
    }
  }
  
  /// 跳转到观看历史
  void goToHistory() {
    if (!_userStore.requireLoginForFeature('history')) {
      return;
    }
    Get.toNamed('/history');
  }
  
  /// 跳转到收藏列表
  void goToFavorites() {
    if (!_userStore.requireLoginForFeature('favorites')) {
      return;
    }
    Get.toNamed('/favorites');
  }
  
  /// 跳转到预约列表
  void goToAppointments() {
    if (!_userStore.requireLoginForFeature('appointments')) {
      return;
    }
    Get.toNamed('/appointments');
  }
  
  /// 跳转到应用中心
  void goToAppWall() {
    Get.toNamed('/app_wall');
  }
  
  /// 分享 APP
  void shareApp() {
    final config = systemConfig.value;
    final downloadUrl = config?.appDownloadUrl ?? 'https://robin.com/download';
    final slogan = config?.shareDescription ?? '精彩影视，尽在掌握';
    
    // 生成并分享海报
    SharePosterGenerator.generateAndShare(
      appName: '拾光影视',
      downloadUrl: downloadUrl,
      slogan: slogan,
    );
  }
  
  /// 求片/反馈
  void goToFeedback() {
    Get.toNamed('/feedback');
  }
  
  /// 清除缓存
  Future<void> clearCache() async {
    Get.dialog(
      AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text(
          '清除缓存',
          style: TextStyle(color: Colors.white),
        ),
        content: Text(
          '确定要清除缓存吗？\n\n当前缓存大小：${cacheSize.value}',
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Get.back(),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () async {
              Get.back();
              
              // 显示加载提示
              Get.dialog(
                const Center(
                  child: CircularProgressIndicator(
                    color: Color(0xFFFFC107),
                  ),
                ),
                barrierDismissible: false,
              );
              
              try {
                // 🚀 1. 清除图片缓存
                PaintingBinding.instance.imageCache.clear();
                PaintingBinding.instance.imageCache.clearLiveImages();
                
                // 🚀 2. 清除 CachedNetworkImage 缓存
                await CachedNetworkImage.evictFromCache('');
                
                // 🚀 3. 清除 CacheService 数据缓存（首页、短剧流等）
                if (Get.isRegistered<CacheService>()) {
                  await CacheService.to.clearAll();
                  Logger.info('CacheService cache cleared');
                }
                
                // 重新计算缓存大小
                await _calculateCacheSize();
                
                Get.back(); // 关闭加载提示
                
                Get.snackbar(
                  '成功',
                  '缓存已清除',
                  snackPosition: SnackPosition.BOTTOM,
                  backgroundColor: const Color(0xFFFFC107).withValues(alpha: 0.8),
                  colorText: Colors.black,
                );
              } catch (e) {
                Logger.error('Clear cache failed: $e');
                Get.back(); // 关闭加载提示
                Get.snackbar(
                  '失败',
                  '清除缓存失败',
                  snackPosition: SnackPosition.BOTTOM,
                  backgroundColor: Colors.red.withValues(alpha: 0.8),
                  colorText: Colors.white,
                );
              }
            },
            child: const Text(
              '清除',
              style: TextStyle(color: Colors.red),
            ),
          ),
        ],
      ),
    );
  }
  
  /// 联系客服
  void contactSupport() {
    final config = systemConfig.value;
    if (config?.customerService == null || config!.customerService!.isEmpty) {
      Get.snackbar('提示', '客服信息暂未配置');
      return;
    }
    
    Get.dialog(
      AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text(
          '联系客服',
          style: TextStyle(color: Colors.white),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '客服联系方式：',
              style: TextStyle(color: Colors.white70),
            ),
            const SizedBox(height: 8),
            SelectableText(
              config.customerService!,
              style: const TextStyle(
                color: Color(0xFFFFC107),
                fontSize: 16,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: config.customerService!));
              Get.snackbar('成功', '已复制到剪贴板');
            },
            child: const Text('复制'),
          ),
          TextButton(
            onPressed: () => Get.back(),
            child: const Text('关闭'),
          ),
        ],
      ),
    );
  }
  
  /// 官方群组
  void openOfficialGroup() {
    final config = systemConfig.value;
    if (config?.officialGroup == null || config!.officialGroup!.isEmpty) {
      Get.snackbar('提示', '官方群组链接暂未配置');
      return;
    }
    
    _launchUrl(config.officialGroup!);
  }
  
  /// 永久网址
  void showPermanentUrls() {
    final config = systemConfig.value;
    if (config?.permanentUrls == null || config!.permanentUrls!.isEmpty) {
      Get.snackbar('提示', '永久网址暂未配置');
      return;
    }
    
    Get.dialog(
      AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text(
          '永久网址',
          style: TextStyle(color: Colors.white),
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '请收藏以下网址，以便随时访问：',
                style: TextStyle(color: Colors.white70, fontSize: 14),
              ),
              const SizedBox(height: 16),
              ...config.permanentUrls!.asMap().entries.map((entry) {
                final index = entry.key;
                final url = entry.value;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: SelectableText(
                          '${index + 1}. $url',
                          style: const TextStyle(
                            color: Color(0xFFFFC107),
                            fontSize: 14,
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: url));
                          Get.snackbar('成功', '已复制到剪贴板');
                        },
                        icon: const Icon(
                          Icons.copy,
                          size: 18,
                          color: Colors.white54,
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Get.back(),
            child: const Text('关闭'),
          ),
        ],
      ),
    );
  }
  
  /// 检查更新
  Future<void> checkUpdate() async {
    try {
      final response = await _httpClient.get('/api/version');
      
      if (response.data['code'] == 1) {
        final data = response.data['data'] ?? response.data;
        final version = data['version'] ?? '1.0.0';
        final force = data['force'] ?? false;
        final url = data['url'] ?? '';
        final changelog = data['changelog'] ?? '';
        
        // 获取当前版本号
        final appInfo = Get.find<AppInfo>();
        final currentVersion = appInfo.version.value;
        final needUpdate = appInfo.isNewerVersion(version);
        
        Get.dialog(
          AlertDialog(
            backgroundColor: const Color(0xFF1E1E1E),
            title: Text(
              needUpdate ? '发现新版本' : '版本信息',
              style: const TextStyle(color: Colors.white),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '当前版本：$currentVersion',
                  style: const TextStyle(color: Colors.white70),
                ),
                const SizedBox(height: 8),
                Text(
                  '最新版本：$version',
                  style: TextStyle(
                    color: needUpdate ? const Color(0xFFFFC107) : Colors.white70,
                  ),
                ),
                if (!needUpdate) ...[
                  const SizedBox(height: 16),
                  const Text(
                    '✓ 已是最新版本',
                    style: TextStyle(color: Colors.green),
                  ),
                ],
                if (changelog.isNotEmpty && needUpdate) ...[
                  const SizedBox(height: 16),
                  const Text(
                    '更新内容：',
                    style: TextStyle(color: Colors.white70),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    changelog,
                    style: const TextStyle(color: Colors.white54, fontSize: 14),
                  ),
                ],
              ],
            ),
            actions: [
              if (!force)
                TextButton(
                  onPressed: () => Get.back(),
                  child: const Text('关闭'),
                ),
              if (needUpdate)
                TextButton(
                  onPressed: () {
                    Get.back();
                    if (url.isNotEmpty) {
                      _launchUrl(url);
                    }
                  },
                  child: const Text('立即更新'),
                ),
            ],
          ),
        );
      }
    } catch (e) {
      Logger.error('Failed to check update: $e');
      Get.snackbar('失败', '检查更新失败');
    }
  }
  
  /// 打开 URL
  Future<void> _launchUrl(String urlString) async {
    try {
      final url = Uri.parse(urlString);
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      } else {
        Get.snackbar('错误', '无法打开链接');
      }
    } catch (e) {
      Logger.error('Failed to launch URL: $e');
      Get.snackbar('错误', '打开链接失败');
    }
  }
}

/// 系统配置模型
class SystemConfig {
  final String? customerService;
  final String? officialGroup;
  final List<String>? permanentUrls;
  final String? appDownloadUrl;
  final String? shareTitle;
  final String? shareDescription;
  final String? termsUrl;
  final String? privacyUrl;
  final bool adsEnabled; // 全局广告开关
  
  SystemConfig({
    this.customerService,
    this.officialGroup,
    this.permanentUrls,
    this.appDownloadUrl,
    this.shareTitle,
    this.shareDescription,
    this.termsUrl,
    this.privacyUrl,
    this.adsEnabled = true, // 默认启用
  });
  
  factory SystemConfig.fromJson(Map<String, dynamic> json) {
    return SystemConfig(
      customerService: json['customer_service'],
      officialGroup: json['official_group'],
      permanentUrls: json['permanent_urls'] != null
          ? List<String>.from(json['permanent_urls'])
          : null,
      appDownloadUrl: json['app_download_url'] ?? json['download_url'],
      shareTitle: json['share_title'],
      shareDescription: json['share_description'],
      termsUrl: json['terms_url'],
      privacyUrl: json['privacy_url'],
      adsEnabled: json['ads_enabled'] == true,
    );
  }
}
