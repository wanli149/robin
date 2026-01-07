import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../core/user_store.dart';
import '../auth/login_page.dart';
import 'profile_controller.dart';

/// 个人中心页面
class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final userStore = UserStore.to;
    final controller = Get.put(ProfileController());

    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            children: [
              // 用户信息区域
              _buildUserInfoSection(userStore),
              
              const SizedBox(height: 16),
              
              // 功能菜单区域
              _buildMenuSection(userStore, controller),
            ],
          ),
        ),
      ),
    );
  }

  /// 构建用户信息区域
  Widget _buildUserInfoSection(UserStore userStore) {
    return Obx(() {
      final isLoggedIn = userStore.isLoggedIn;
      final user = userStore.userInfo.value;

      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              const Color(0xFFFFC107).withOpacity(0.2),
              const Color(0xFF121212),
            ],
          ),
        ),
        child: Row(
          children: [
            // 头像
            GestureDetector(
              onTap: () {
                if (!isLoggedIn) {
                  Get.to(() => const LoginPage());
                }
              },
              child: Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: const Color(0xFFFFC107),
                    width: 2,
                  ),
                  image: user?.avatar != null
                      ? DecorationImage(
                          image: NetworkImage(user!.avatar!),
                          fit: BoxFit.cover,
                        )
                      : null,
                ),
                child: user?.avatar == null
                    ? const Icon(
                        Icons.person,
                        size: 40,
                        color: Color(0xFFFFC107),
                      )
                    : null,
              ),
            ),
            const SizedBox(width: 16),

            // 用户信息
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (isLoggedIn) ...[
                    // 用户名
                    Row(
                      children: [
                        Text(
                          user?.username ?? '',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(width: 8),
                        // VIP 标识
                        if (userStore.isVip)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [
                                  Color(0xFFFFD700),
                                  Color(0xFFFFC107),
                                ],
                              ),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Text(
                              'VIP',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Colors.black,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    // 用户 ID
                    Text(
                      'ID: ${user?.userId ?? ''}',
                      style: const TextStyle(
                        fontSize: 14,
                        color: Colors.white54,
                      ),
                    ),
                  ] else ...[
                    // 未登录提示
                    GestureDetector(
                      onTap: () {
                        Get.to(() => const LoginPage());
                      },
                      child: const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '点击登录',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFFFC107),
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            '登录后可同步观看历史和收藏',
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.white54,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // 设置按钮
            IconButton(
              onPressed: () {
                Get.toNamed('/settings');
              },
              icon: const Icon(
                Icons.settings_outlined,
                color: Colors.white54,
              ),
            ),
          ],
        ),
      );
    });
  }

  /// 构建功能菜单区域
  Widget _buildMenuSection(UserStore userStore, ProfileController controller) {
    return Column(
      children: [
        // 我的内容
        _buildMenuGroup(
          title: '我的内容',
          items: [
            _MenuItem(
              icon: Icons.history,
              title: '观看历史',
              onTap: controller.goToHistory,
            ),
            _MenuItem(
              icon: Icons.favorite_border,
              title: '我的收藏',
              onTap: controller.goToFavorites,
            ),
            _MenuItem(
              icon: Icons.notifications_none,
              title: '我的预约',
              onTap: controller.goToAppointments,
            ),
          ],
        ),

        const SizedBox(height: 16),

        // 应用功能
        _buildMenuGroup(
          title: '应用功能',
          items: [
            _MenuItem(
              icon: Icons.apps,
              title: '应用中心',
              onTap: controller.goToAppWall,
            ),
            _MenuItem(
              icon: Icons.share,
              title: '分享 APP',
              onTap: controller.shareApp,
            ),
            _MenuItem(
              icon: Icons.swap_horiz,
              title: '换源设置',
              onTap: controller.goToSourceSettings,
            ),
            _MenuItem(
              icon: Icons.feedback_outlined,
              title: '求片/反馈',
              onTap: controller.goToFeedback,
            ),
          ],
        ),
        
        // 清除缓存（动态显示大小）
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0xFF1E1E1E),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Obx(() => ListTile(
            leading: const Icon(Icons.cleaning_services_outlined, color: Colors.white70),
            title: const Text('清除缓存', style: TextStyle(color: Colors.white)),
            subtitle: Text(controller.cacheSize.value, style: const TextStyle(color: Colors.white54, fontSize: 12)),
            trailing: const Icon(Icons.chevron_right, color: Colors.white30),
            onTap: controller.clearCache,
          )),
        ),

        const SizedBox(height: 16),

        // 帮助与支持
        _buildMenuGroup(
          title: '帮助与支持',
          items: [
            _MenuItem(
              icon: Icons.support_agent,
              title: '联系客服',
              onTap: controller.contactSupport,
            ),
            _MenuItem(
              icon: Icons.group,
              title: '官方群组',
              onTap: controller.openOfficialGroup,
            ),
            _MenuItem(
              icon: Icons.link,
              title: '永久网址',
              onTap: controller.showPermanentUrls,
            ),
            _MenuItem(
              icon: Icons.system_update,
              title: 'APP更新',
              onTap: controller.checkUpdate,
            ),
          ],
        ),

        const SizedBox(height: 16),

        // 退出登录按钮
        Obx(() {
          if (userStore.isLoggedIn) {
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: ElevatedButton(
                onPressed: () {
                  Get.dialog(
                    AlertDialog(
                      backgroundColor: const Color(0xFF1E1E1E),
                      title: const Text(
                        '确认退出',
                        style: TextStyle(color: Colors.white),
                      ),
                      content: const Text(
                        '确定要退出登录吗？',
                        style: TextStyle(color: Colors.white70),
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Get.back(),
                          child: const Text('取消'),
                        ),
                        TextButton(
                          onPressed: () {
                            Get.back();
                            userStore.logout();
                          },
                          child: const Text(
                            '退出',
                            style: TextStyle(color: Colors.red),
                          ),
                        ),
                      ],
                    ),
                  );
                },
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
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            );
          }
          return const SizedBox.shrink();
        }),

        const SizedBox(height: 32),
      ],
    );
  }

  /// 构建菜单组
  Widget _buildMenuGroup({
    required String title,
    required List<_MenuItem> items,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 14,
                color: Colors.white54,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          ...items.asMap().entries.map((entry) {
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
                  leading: Icon(
                    item.icon,
                    color: const Color(0xFFFFC107),
                  ),
                  title: Text(
                    item.title,
                    style: const TextStyle(
                      fontSize: 16,
                      color: Colors.white,
                    ),
                  ),
                  subtitle: item.subtitle != null
                      ? (item.subtitle is Widget
                          ? item.subtitle as Widget
                          : Text(
                              item.subtitle!,
                              style: const TextStyle(
                                fontSize: 12,
                                color: Colors.white54,
                              ),
                            ))
                      : null,
                  trailing: const Icon(
                    Icons.chevron_right,
                    color: Colors.white38,
                  ),
                  onTap: item.onTap,
                ),
              ],
            );
          }),
        ],
      ),
    );
  }
}

/// 菜单项模型
class _MenuItem {
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  _MenuItem({
    required this.icon,
    required this.title,
    this.subtitle,
    required this.onTap,
  });
}
