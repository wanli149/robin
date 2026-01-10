import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/http_client.dart';
import '../../core/logger.dart';
import '../../widgets/net_image.dart';

/// 应用中心页面
class AppWallPage extends StatefulWidget {
  const AppWallPage({super.key});

  @override
  State<AppWallPage> createState() => _AppWallPageState();
}

class _AppWallPageState extends State<AppWallPage> {
  final _httpClient = HttpClient();
  final RxList<AppWallItem> _apps = <AppWallItem>[].obs;
  final RxBool _isLoading = true.obs;
  final RxString _errorMessage = ''.obs;

  @override
  void initState() {
    super.initState();
    _loadApps();
  }

  /// 加载应用列表
  Future<void> _loadApps() async {
    try {
      _isLoading.value = true;
      _errorMessage.value = '';

      final response = await _httpClient.get('/api/app_wall');

      if (response.data['code'] == 1) {
        final data = response.data['data'] ?? response.data;
        final List<dynamic> appList = data is List ? data : [];

        _apps.value = appList
            .map((json) => AppWallItem.fromJson(json))
            .where((app) => app.isActive)
            .toList();
      } else {
        _errorMessage.value = '加载失败';
      }
    } catch (e) {
      Logger.error('Failed to load app wall: $e');
      _errorMessage.value = '加载失败，请稍后重试';
    } finally {
      _isLoading.value = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        title: const Text('应用中心'),
        backgroundColor: const Color(0xFF121212),
        elevation: 0,
      ),
      body: Obx(() {
        if (_isLoading.value) {
          return const Center(
            child: CircularProgressIndicator(
              color: Color(0xFFFFC107),
            ),
          );
        }

        if (_errorMessage.value.isNotEmpty) {
          return _buildErrorWidget();
        }

        if (_apps.isEmpty) {
          return _buildEmptyWidget();
        }

        return RefreshIndicator(
          onRefresh: _loadApps,
          color: const Color(0xFFFFC107),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: _apps.length,
            itemBuilder: (context, index) {
              return _buildAppCard(_apps[index]);
            },
          ),
        );
      }),
    );
  }

  /// 构建应用卡片
  Widget _buildAppCard(AppWallItem app) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _downloadApp(app),
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // 应用图标
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: NetImage(
                    url: app.iconUrl,
                    width: 64,
                    height: 64,
                  ),
                ),
                const SizedBox(width: 16),

                // 应用信息
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 应用名称
                      Text(
                        app.appName,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),

                      // 佣金信息（如果有）
                      if (app.commission != null && app.commission! > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFC107).withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            '推广奖励 ¥${app.commission!.toStringAsFixed(2)}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFFFFC107),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),

                // 下载按钮
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [
                        Color(0xFFFFD700),
                        Color(0xFFFFC107),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text(
                    '下载',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Colors.black,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// 构建错误提示
  Widget _buildErrorWidget() {
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
            _errorMessage.value,
            style: const TextStyle(
              fontSize: 16,
              color: Colors.white54,
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _loadApps,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFFFC107),
              foregroundColor: Colors.black,
              padding: const EdgeInsets.symmetric(
                horizontal: 32,
                vertical: 12,
              ),
            ),
            child: const Text('重试'),
          ),
        ],
      ),
    );
  }

  /// 构建空状态提示
  Widget _buildEmptyWidget() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.apps,
            size: 64,
            color: Colors.white38,
          ),
          const SizedBox(height: 16),
          const Text(
            '暂无推广应用',
            style: TextStyle(
              fontSize: 16,
              color: Colors.white54,
            ),
          ),
        ],
      ),
    );
  }

  /// 下载应用
  Future<void> _downloadApp(AppWallItem app) async {
    try {
      final url = Uri.parse(app.downloadUrl);
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      } else {
        Get.snackbar(
          '错误',
          '无法打开下载链接',
          snackPosition: SnackPosition.BOTTOM,
          backgroundColor: Colors.red.withValues(alpha: 0.8),
          colorText: Colors.white,
        );
      }
    } catch (e) {
      Logger.error('Failed to launch download URL: $e');
      Get.snackbar(
        '错误',
        '打开下载链接失败',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.withValues(alpha: 0.8),
        colorText: Colors.white,
      );
    }
  }
}

/// 应用墙项目模型
class AppWallItem {
  final int id;
  final String appName;
  final String iconUrl;
  final String downloadUrl;
  final double? commission;
  final int sortOrder;
  final bool isActive;

  AppWallItem({
    required this.id,
    required this.appName,
    required this.iconUrl,
    required this.downloadUrl,
    this.commission,
    required this.sortOrder,
    required this.isActive,
  });

  factory AppWallItem.fromJson(Map<String, dynamic> json) {
    return AppWallItem(
      id: json['id'] ?? 0,
      appName: json['app_name'] ?? '',
      iconUrl: json['icon_url'] ?? '',
      downloadUrl: json['download_url'] ?? '',
      commission: json['commission'] != null
          ? (json['commission'] as num).toDouble()
          : null,
      sortOrder: json['sort_order'] ?? 0,
      isActive: json['is_active'] == 1 || json['is_active'] == true,
    );
  }
}
