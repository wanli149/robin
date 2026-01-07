import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'auth_controller.dart';

/// 注册页面
class RegisterPage extends StatelessWidget {
  const RegisterPage({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = Get.put(AuthController());

    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Get.back(),
          icon: const Icon(
            Icons.arrow_back_ios,
            color: Colors.white,
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Logo
              Center(
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFC107),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(
                    Icons.play_circle_outline,
                    color: Color(0xFF121212),
                    size: 48,
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // 标题
              const Center(
                child: Text(
                  '创建账号',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFFFC107),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              const Center(
                child: Text(
                  '注册后可同步观看历史和收藏',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.white54,
                  ),
                ),
              ),
              const SizedBox(height: 48),

              // 用户名输入框
              _buildTextField(
                controller: controller.usernameController,
                label: '用户名',
                hint: '用户名或邮箱（至少3位，随便填）',
                icon: Icons.person_outline,
              ),
              const SizedBox(height: 16),

              // 密码输入框
              Obx(() => _buildTextField(
                    controller: controller.passwordController,
                    label: '密码',
                    hint: '请输入密码（至少6位）',
                    icon: Icons.lock_outline,
                    obscureText: !controller.showPassword.value,
                    suffixIcon: IconButton(
                      onPressed: controller.togglePasswordVisibility,
                      icon: Icon(
                        controller.showPassword.value
                            ? Icons.visibility_off
                            : Icons.visibility,
                        color: Colors.white54,
                        size: 20,
                      ),
                    ),
                  )),
              const SizedBox(height: 16),

              // 确认密码输入框
              Obx(() => _buildTextField(
                    controller: controller.confirmPasswordController,
                    label: '确认密码',
                    hint: '请再次输入密码',
                    icon: Icons.lock_outline,
                    obscureText: !controller.showConfirmPassword.value,
                    suffixIcon: IconButton(
                      onPressed: controller.toggleConfirmPasswordVisibility,
                      icon: Icon(
                        controller.showConfirmPassword.value
                            ? Icons.visibility_off
                            : Icons.visibility,
                        color: Colors.white54,
                        size: 20,
                      ),
                    ),
                  )),
              const SizedBox(height: 32),

              // 注册按钮
              Obx(() => ElevatedButton(
                    onPressed: controller.isLoading.value
                        ? null
                        : controller.register,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFFFC107),
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 0,
                    ),
                    child: controller.isLoading.value
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                Colors.black,
                              ),
                            ),
                          )
                        : const Text(
                            '注册',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  )),
              const SizedBox(height: 16),

              // 返回登录
              TextButton(
                onPressed: () {
                  Get.back();
                },
                child: const Text(
                  '已有账号？返回登录',
                  style: TextStyle(
                    color: Color(0xFFFFC107),
                    fontSize: 14,
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // 用户协议提示
              const Center(
                child: Text(
                  '注册即表示同意用户协议和隐私政策',
                  style: TextStyle(
                    color: Colors.white38,
                    fontSize: 12,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 构建输入框
  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    bool obscureText = false,
    Widget? suffixIcon,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 14,
            color: Colors.white70,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          obscureText: obscureText,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 16,
          ),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(
              color: Colors.white38,
              fontSize: 14,
            ),
            prefixIcon: Icon(
              icon,
              color: Colors.white54,
              size: 20,
            ),
            suffixIcon: suffixIcon,
            filled: true,
            fillColor: const Color(0xFF1E1E1E),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(
                color: Color(0xFFFFC107),
                width: 2,
              ),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 16,
            ),
          ),
        ),
      ],
    );
  }
}
