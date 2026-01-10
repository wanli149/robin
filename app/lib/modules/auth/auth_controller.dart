import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../core/http_client.dart';
import '../../core/user_store.dart';
import '../../core/logger.dart';

/// 认证控制器
/// 处理登录和注册逻辑
class AuthController extends GetxController {
  // 用户名控制器
  final usernameController = TextEditingController();
  
  // 密码控制器
  final passwordController = TextEditingController();
  
  // 确认密码控制器（仅注册使用）
  final confirmPasswordController = TextEditingController();
  
  // 是否显示密码
  final showPassword = false.obs;
  
  // 是否显示确认密码
  final showConfirmPassword = false.obs;
  
  // 是否正在加载
  final isLoading = false.obs;
  
  // HTTP 客户端
  final _httpClient = HttpClient();
  
  // 用户状态管理
  final _userStore = UserStore.to;
  
  @override
  void onClose() {
    usernameController.dispose();
    passwordController.dispose();
    confirmPasswordController.dispose();
    super.onClose();
  }
  
  /// 切换密码可见性
  void togglePasswordVisibility() {
    showPassword.value = !showPassword.value;
  }
  
  /// 切换确认密码可见性
  void toggleConfirmPasswordVisibility() {
    showConfirmPassword.value = !showConfirmPassword.value;
  }
  
  /// 登录
  Future<void> login() async {
    // 表单验证
    final username = usernameController.text.trim();
    final password = passwordController.text.trim();
    
    if (username.isEmpty) {
      Get.snackbar(
        '提示',
        '请输入用户名',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.withValues(alpha: 0.8),
        colorText: Colors.white,
      );
      return;
    }
    
    if (password.isEmpty) {
      Get.snackbar(
        '提示',
        '请输入密码',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.withValues(alpha: 0.8),
        colorText: Colors.white,
      );
      return;
    }
    
    if (password.length < 6) {
      Get.snackbar(
        '提示',
        '密码长度不能少于6位',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.withValues(alpha: 0.8),
        colorText: Colors.white,
      );
      return;
    }
    
    // 开始登录
    isLoading.value = true;
    
    try {
      final response = await _httpClient.post(
        '/api/auth/login',
        data: {
          'username': username,
          'password': password,
        },
      );
      
      // 解析响应
      if (response.data['code'] == 1) {
        final data = response.data['data'] ?? response.data;
        final token = data['token'];
        final userInfo = UserInfo.fromJson(data['user'] ?? data);
        
        // 保存登录状态
        await _userStore.login(token, userInfo);
        
        Get.snackbar(
          '登录成功',
          '欢迎回来，${userInfo.username}',
          snackPosition: SnackPosition.BOTTOM,
          backgroundColor: const Color(0xFFFFC107).withValues(alpha: 0.8),
          colorText: Colors.black,
        );
        
        // 跳转到首页
        Get.offAllNamed('/');
      } else {
        Get.snackbar(
          '登录失败',
          response.data['msg'] ?? '用户名或密码错误',
          snackPosition: SnackPosition.BOTTOM,
          backgroundColor: Colors.red.withValues(alpha: 0.8),
          colorText: Colors.white,
        );
      }
    } catch (e) {
      Logger.error('[AuthController] Login error: $e');
      
      // 提取更详细的错误信息
      String errorMsg = '网络错误，请稍后重试';
      if (e.toString().contains('401')) {
        errorMsg = '用户名或密码错误';
      } else if (e.toString().contains('404')) {
        errorMsg = '服务器连接失败';
      }
      
      Get.snackbar(
        '登录失败',
        errorMsg,
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.withValues(alpha: 0.8),
        colorText: Colors.white,
      );
    } finally {
      isLoading.value = false;
    }
  }
  
  /// 注册
  Future<void> register() async {
    // 表单验证
    final username = usernameController.text.trim();
    final password = passwordController.text.trim();
    final confirmPassword = confirmPasswordController.text.trim();
    
    if (username.isEmpty) {
      Get.snackbar(
        '提示',
        '请输入用户名',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.withValues(alpha: 0.8),
        colorText: Colors.white,
      );
      return;
    }
    
    if (username.length < 3) {
      Get.snackbar(
        '提示',
        '用户名长度不能少于3位',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.withValues(alpha: 0.8),
        colorText: Colors.white,
      );
      return;
    }
    
    if (password.isEmpty) {
      Get.snackbar(
        '提示',
        '请输入密码',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.withValues(alpha: 0.8),
        colorText: Colors.white,
      );
      return;
    }
    
    if (password.length < 6) {
      Get.snackbar(
        '提示',
        '密码长度不能少于6位',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.withValues(alpha: 0.8),
        colorText: Colors.white,
      );
      return;
    }
    
    if (confirmPassword.isEmpty) {
      Get.snackbar(
        '提示',
        '请确认密码',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.withValues(alpha: 0.8),
        colorText: Colors.white,
      );
      return;
    }
    
    if (password != confirmPassword) {
      Get.snackbar(
        '提示',
        '两次输入的密码不一致',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.withValues(alpha: 0.8),
        colorText: Colors.white,
      );
      return;
    }
    
    // 开始注册
    isLoading.value = true;
    
    try {
      final response = await _httpClient.post(
        '/api/auth/register',
        data: {
          'username': username,
          'password': password,
        },
      );
      
      // 解析响应
      if (response.data['code'] == 1) {
        Get.snackbar(
          '注册成功',
          '请使用新账号登录',
          snackPosition: SnackPosition.BOTTOM,
          backgroundColor: const Color(0xFFFFC107).withValues(alpha: 0.8),
          colorText: Colors.black,
        );
        
        // 返回登录页
        Get.back();
      } else {
        Get.snackbar(
          '注册失败',
          response.data['msg'] ?? '用户名已存在',
          snackPosition: SnackPosition.BOTTOM,
          backgroundColor: Colors.red.withValues(alpha: 0.8),
          colorText: Colors.white,
        );
      }
    } catch (e) {
      Logger.error('[AuthController] Register error: $e');
      Get.snackbar(
        '注册失败',
        '网络错误，请稍后重试',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.withValues(alpha: 0.8),
        colorText: Colors.white,
      );
    } finally {
      isLoading.value = false;
    }
  }
}