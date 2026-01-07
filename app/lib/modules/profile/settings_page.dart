import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../core/user_store.dart';
import '../../core/settings_store.dart';

/// 设置页面
class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});
  
  SettingsStore get _settings => SettingsStore.to;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        backgroundColor: const Color(0xFF121212),
        elevation: 0,
        leading: IconButton(
          onPressed: () => Get.back(),
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
        ),
        title: const Text(
          '设置',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      body: ListView(
        children: [
          // 播放设置
          Obx(() => _buildSection(
            title: '播放设置',
            items: [
              _SettingItem(
                icon: Icons.wifi,
                title: '仅 WiFi 下播放',
                trailing: _buildSwitch(
                  _settings.wifiOnlyPlay.value,
                  (value) => _settings.setWifiOnlyPlay(value),
                ),
              ),
              _SettingItem(
                icon: Icons.hd,
                title: '默认画质',
                subtitle: _getQualityText(_settings.defaultQuality.value),
                onTap: () => _showQualityPicker(context),
              ),
              _SettingItem(
                icon: Icons.speed,
                title: '默认倍速',
                subtitle: '${_settings.defaultSpeed.value}x',
                onTap: () => _showSpeedPicker(context),
              ),
            ],
          )),

          // 通知设置
          Obx(() => _buildSection(
            title: '通知设置',
            items: [
              _SettingItem(
                icon: Icons.notifications,
                title: '推送通知',
                trailing: _buildSwitch(
                  _settings.pushNotification.value,
                  (value) => _settings.setPushNotification(value),
                ),
              ),
              _SettingItem(
                icon: Icons.update,
                title: '更新提醒',
                trailing: _buildSwitch(
                  _settings.updateReminder.value,
                  (value) => _settings.setUpdateReminder(value),
                ),
              ),
            ],
          )),

          // 隐私设置
          Obx(() => _buildSection(
            title: '隐私设置',
            items: [
              _SettingItem(
                icon: Icons.history,
                title: '记录观看历史',
                trailing: _buildSwitch(
                  _settings.recordHistory.value,
                  (value) => _settings.setRecordHistory(value),
                ),
              ),
              _SettingItem(
                icon: Icons.search,
                title: '记录搜索历史',
                trailing: _buildSwitch(
                  _settings.recordSearchHistory.value,
                  (value) => _settings.setRecordSearchHistory(value),
                ),
              ),
            ],
          )),

          // 关于
          _buildSection(
            title: '关于',
            items: [
              _SettingItem(
                icon: Icons.info_outline,
                title: '版本号',
                subtitle: '1.0.0',
              ),
              _SettingItem(
                icon: Icons.description,
                title: '用户协议',
                onTap: () => Get.toNamed('/webview', arguments: {
                  'url': 'https://robin.com/terms',
                  'title': '用户协议',
                }),
              ),
              _SettingItem(
                icon: Icons.privacy_tip,
                title: '隐私政策',
                onTap: () => Get.toNamed('/webview', arguments: {
                  'url': 'https://robin.com/privacy',
                  'title': '隐私政策',
                }),
              ),
            ],
          ),

          // 退出登录
          Obx(() {
            if (UserStore.to.isLoggedIn) {
              return Padding(
                padding: const EdgeInsets.all(16),
                child: ElevatedButton(
                  onPressed: _showLogoutDialog,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red.withOpacity(0.2),
                    foregroundColor: Colors.red,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    '退出登录',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
              );
            }
            return const SizedBox.shrink();
          }),

          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildSection({
    required String title,
    required List<_SettingItem> items,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              color: Colors.white54,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: const Color(0xFF1E1E1E),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: items.asMap().entries.map((entry) {
              final index = entry.key;
              final item = entry.value;
              return Column(
                children: [
                  if (index > 0)
                    const Divider(
                      height: 1,
                      color: Color(0xFF2A2A2A),
                      indent: 56,
                    ),
                  ListTile(
                    leading: Icon(item.icon, color: const Color(0xFFFFC107)),
                    title: Text(
                      item.title,
                      style: const TextStyle(fontSize: 16, color: Colors.white),
                    ),
                    subtitle: item.subtitle != null
                        ? Text(
                            item.subtitle!,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.white54,
                            ),
                          )
                        : null,
                    trailing: item.trailing ??
                        (item.onTap != null
                            ? const Icon(Icons.chevron_right, color: Colors.white38)
                            : null),
                    onTap: item.onTap,
                  ),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildSwitch(bool value, ValueChanged<bool> onChanged) {
    return Switch(
      value: value,
      onChanged: onChanged,
      activeColor: const Color(0xFFFFC107),
    );
  }

  void _showQualityPicker(BuildContext context) {
    final options = [
      {'value': 'auto', 'label': '自动'},
      {'value': '1080p', 'label': '1080P'},
      {'value': '720p', 'label': '720P'},
      {'value': '480p', 'label': '480P'},
      {'value': '360p', 'label': '360P'},
    ];
    
    Get.bottomSheet(
      Container(
        decoration: const BoxDecoration(
          color: Color(0xFF1E1E1E),
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                '选择默认画质',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
            ...options.map((option) {
              final isSelected = _settings.defaultQuality.value == option['value'];
              return ListTile(
                title: Text(
                  option['label']!,
                  style: const TextStyle(color: Colors.white),
                ),
                trailing: isSelected
                    ? const Icon(Icons.check, color: Color(0xFFFFC107))
                    : null,
                onTap: () {
                  _settings.setDefaultQuality(option['value']!);
                  Get.back();
                },
              );
            }),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  void _showSpeedPicker(BuildContext context) {
    final speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    
    Get.bottomSheet(
      Container(
        decoration: const BoxDecoration(
          color: Color(0xFF1E1E1E),
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                '选择默认倍速',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
            ...speeds.map((speed) {
              final isSelected = _settings.defaultSpeed.value == speed;
              return ListTile(
                title: Text(
                  '${speed}x',
                  style: const TextStyle(color: Colors.white),
                ),
                trailing: isSelected
                    ? const Icon(Icons.check, color: Color(0xFFFFC107))
                    : null,
                onTap: () {
                  _settings.setDefaultSpeed(speed);
                  Get.back();
                },
              );
            }),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  void _showLogoutDialog() {
    Get.dialog(
      AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text('确认退出', style: TextStyle(color: Colors.white)),
        content: const Text('确定要退出登录吗？', style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () => Get.back(),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () {
              Get.back();
              UserStore.to.logout();
              Get.back();
            },
            child: const Text('退出', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
  
  String _getQualityText(String quality) {
    switch (quality) {
      case 'auto': return '自动';
      case '1080p': return '1080P';
      case '720p': return '720P';
      case '480p': return '480P';
      case '360p': return '360P';
      default: return '自动';
    }
  }
}

class _SettingItem {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;

  _SettingItem({
    required this.icon,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
  });
}
