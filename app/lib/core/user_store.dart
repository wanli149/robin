import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'logger.dart';

/// 用户信息模型
/// 
/// 存储用户的基本信息，包括：
/// - 用户ID和用户名
/// - 头像URL
/// - VIP状态和过期时间
/// 
/// ## JSON 序列化
/// 支持与后端 API 的 JSON 格式互转：
/// ```dart
/// // 从 JSON 创建
/// final user = UserInfo.fromJson(jsonData);
/// 
/// // 转换为 JSON
/// final json = user.toJson();
/// ```
class UserInfo {
  final String userId;
  final String username;
  final String? avatar;
  final bool isVip;
  final String? vipExpireDate;
  
  UserInfo({
    required this.userId,
    required this.username,
    this.avatar,
    this.isVip = false,
    this.vipExpireDate,
  });
  
  factory UserInfo.fromJson(Map<String, dynamic> json) {
    return UserInfo(
      userId: json['user_id']?.toString() ?? '',
      username: json['username'] ?? '',
      avatar: json['avatar'],
      isVip: json['is_vip'] ?? false,
      vipExpireDate: json['vip_expire_date'],
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'user_id': userId,
      'username': username,
      'avatar': avatar,
      'is_vip': isVip,
      'vip_expire_date': vipExpireDate,
    };
  }
}

/// 用户状态管理
/// 
/// 使用 GetX 管理用户登录状态、Token 存储和自动登录。
/// 
/// ## 核心功能
/// - 用户登录/登出
/// - Token 持久化存储
/// - 自动登录（永久登录）
/// - VIP 状态管理
/// - 登录状态检查
/// 
/// ## 永久登录机制
/// 用户登录后，Token 和用户信息会永久保存在本地，
/// 除非用户主动登出或更换设备，否则不会过期。
/// 
/// ## 使用示例
/// ```dart
/// // 获取单例
/// final userStore = UserStore.to;
/// 
/// // 检查登录状态
/// if (userStore.isLoggedIn) {
///   print('用户已登录: ${userStore.userInfo.value?.username}');
/// }
/// 
/// // 登录
/// await userStore.login(token, userInfo);
/// 
/// // 登出
/// await userStore.logout();
/// 
/// // 要求登录（显示提示并跳转）
/// if (!userStore.requireLoginForFeature('favorites')) {
///   return; // 未登录，已显示提示
/// }
/// ```
/// 
/// ## 响应式状态
/// 使用 Obx 监听登录状态变化：
/// ```dart
/// Obx(() => Text(
///   userStore.isLoggedIn ? '已登录' : '未登录'
/// ))
/// ```
class UserStore extends GetxController {
  // 单例模式
  static UserStore get to => Get.find();
  
  // 用户信息
  final Rx<UserInfo?> userInfo = Rx<UserInfo?>(null);
  
  // Token
  final RxString token = ''.obs;
  
  // 是否已登录（响应式）
  final RxBool _isLoggedIn = false.obs;
  bool get isLoggedIn => _isLoggedIn.value;
  RxBool get isLoggedInRx => _isLoggedIn;
  
  // 是否是 VIP
  bool get isVip => userInfo.value?.isVip ?? false;
  
  /// 更新登录状态
  void _updateLoginStatus() {
    _isLoggedIn.value = token.value.isNotEmpty && userInfo.value != null;
  }
  
  @override
  void onInit() {
    super.onInit();
    _loadUserData();
  }
  
  /// 从本地存储加载用户数据
  /// 永久登录：只要用户登录过一次，就永久保持登录状态（除非主动登出或换设备）
  Future<void> _loadUserData() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      
      // 加载 token（永久有效，不过期）
      final savedToken = prefs.getString('token');
      if (savedToken != null && savedToken.isNotEmpty) {
        token.value = savedToken;
      }
      
      // 加载用户信息
      final userId = prefs.getString('user_id');
      final username = prefs.getString('username');
      final avatar = prefs.getString('avatar');
      final isVip = prefs.getBool('is_vip') ?? false;
      final vipExpireDate = prefs.getString('vip_expire_date');
      
      if (userId != null && username != null) {
        userInfo.value = UserInfo(
          userId: userId,
          username: username,
          avatar: avatar,
          isVip: isVip,
          vipExpireDate: vipExpireDate,
        );
        
        _updateLoginStatus();
        Logger.success('[UserStore] 用户已自动登录: $username (永久登录)');
      } else {
        _updateLoginStatus();
        Logger.info('[UserStore] 用户未登录');
      }
    } catch (e) {
      Logger.error('[UserStore] Failed to load user data: $e');
    }
  }
  
  /// 登录（永久登录，不会过期）
  /// 用途：启用历史记录同步、统计用户数
  Future<void> login(String newToken, UserInfo user) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      
      // 保存 token（永久有效）
      token.value = newToken;
      await prefs.setString('token', newToken);
      
      // 保存用户信息（永久保存）
      userInfo.value = user;
      await prefs.setString('user_id', user.userId);
      await prefs.setString('username', user.username);
      if (user.avatar != null) {
        await prefs.setString('avatar', user.avatar!);
      }
      await prefs.setBool('is_vip', user.isVip);
      if (user.vipExpireDate != null) {
        await prefs.setString('vip_expire_date', user.vipExpireDate!);
      }
      
      // 标记为永久登录
      await prefs.setBool('permanent_login', true);
      
      // 更新登录状态
      _updateLoginStatus();
      
      Logger.success('[UserStore] 用户登录成功: ${user.username} (永久登录已启用)');
    } catch (e) {
      Logger.error('[UserStore] Failed to save user data: $e');
      Get.snackbar(
        '错误',
        '登录信息保存失败',
        snackPosition: SnackPosition.BOTTOM,
      );
    }
  }
  
  /// 登出
  Future<void> logout() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      
      // 清除所有用户数据
      await prefs.remove('token');
      await prefs.remove('user_id');
      await prefs.remove('username');
      await prefs.remove('avatar');
      await prefs.remove('is_vip');
      await prefs.remove('vip_expire_date');
      
      // 清空状态
      token.value = '';
      userInfo.value = null;
      _updateLoginStatus();
      
      Logger.success('[UserStore] User logged out');
      
      Get.snackbar(
        '提示',
        '已退出登录',
        snackPosition: SnackPosition.BOTTOM,
      );
      
      // 跳转到首页
      Get.offAllNamed('/');
    } catch (e) {
      Logger.error('[UserStore] Failed to logout: $e');
    }
  }
  
  /// 更新用户信息
  Future<void> updateUserInfo(UserInfo newUserInfo) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      
      userInfo.value = newUserInfo;
      
      // 更新本地存储
      await prefs.setString('user_id', newUserInfo.userId);
      await prefs.setString('username', newUserInfo.username);
      if (newUserInfo.avatar != null) {
        await prefs.setString('avatar', newUserInfo.avatar!);
      }
      await prefs.setBool('is_vip', newUserInfo.isVip);
      if (newUserInfo.vipExpireDate != null) {
        await prefs.setString('vip_expire_date', newUserInfo.vipExpireDate!);
      }
      
      _updateLoginStatus();
      Logger.success('[UserStore] User info updated');
    } catch (e) {
      Logger.error('[UserStore] Failed to update user info: $e');
    }
  }
  
  /// 更新 VIP 状态
  Future<void> updateVipStatus(bool isVip, {String? expireDate}) async {
    if (userInfo.value == null) return;
    
    final updatedUser = UserInfo(
      userId: userInfo.value!.userId,
      username: userInfo.value!.username,
      avatar: userInfo.value!.avatar,
      isVip: isVip,
      vipExpireDate: expireDate,
    );
    
    await updateUserInfo(updatedUser);
  }
  
  /// 检查登录状态
  bool checkLoginStatus() {
    return isLoggedIn;
  }

  /// 要求登录（显示提示并跳转到登录页面）
  void requireLogin({String message = '请先登录'}) {
    Get.snackbar(
      '提示',
      message,
      snackPosition: SnackPosition.BOTTOM,
      duration: const Duration(seconds: 3),
      mainButton: TextButton(
        onPressed: () {
          Get.closeCurrentSnackbar();
          Get.toNamed('/login');
        },
        child: Text(
          '去登录',
          style: TextStyle(color: Colors.white),
        ),
      ),
    );
  }

  /// 检查是否需要登录（用于特定功能）
  bool requireLoginForFeature(String feature, {String? customMessage}) {
    if (isLoggedIn) return true;
    
    String message;
    switch (feature) {
      case 'history':
        message = customMessage ?? '登录后可查看观看历史';
        break;
      case 'favorites':
        message = customMessage ?? '登录后可收藏喜欢的影片';
        break;
      case 'appointments':
        message = customMessage ?? '登录后可预约更新提醒';
        break;
      case 'sync':
        message = customMessage ?? '登录后可同步观看进度';
        break;
      default:
        message = customMessage ?? '该功能需要登录后使用';
    }
    
    requireLogin(message: message);
    return false;
  }
}
