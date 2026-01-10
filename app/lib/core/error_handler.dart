import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:get/get.dart';
import 'logger.dart';

// ==================== 错误类型定义 ====================

/// 应用错误类型
enum ErrorType {
  network, // 网络错误
  timeout, // 超时错误
  server, // 服务器错误
  auth, // 认证错误
  notFound, // 资源未找到
  unknown, // 未知错误
}

/// 全局错误处理器
/// 处理网络错误、UI 错误显示和重试逻辑
class ErrorHandler {
  // 私有构造函数，防止实例化
  ErrorHandler._();

  // ==================== 错误解析 ====================

  /// 解析 Dio 错误
  static AppError parseDioError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return AppError(
          type: ErrorType.timeout,
          message: '请求超时，请检查网络连接',
          originalError: error,
        );

      case DioExceptionType.badResponse:
        final statusCode = error.response?.statusCode;
        if (statusCode == 401 || statusCode == 403) {
          return AppError(
            type: ErrorType.auth,
            message: '认证失败，请重新登录',
            originalError: error,
          );
        } else if (statusCode == 404) {
          return AppError(
            type: ErrorType.notFound,
            message: '请求的资源不存在',
            originalError: error,
          );
        } else if (statusCode != null && statusCode >= 500) {
          return AppError(
            type: ErrorType.server,
            message: '服务器错误，请稍后重试',
            originalError: error,
          );
        }
        return AppError(
          type: ErrorType.server,
          message: '请求失败: ${error.response?.statusMessage ?? "未知错误"}',
          originalError: error,
        );

      case DioExceptionType.cancel:
        return AppError(
          type: ErrorType.unknown,
          message: '请求已取消',
          originalError: error,
        );

      case DioExceptionType.connectionError:
        return AppError(
          type: ErrorType.network,
          message: '网络连接失败，请检查网络设置',
          originalError: error,
        );

      default:
        return AppError(
          type: ErrorType.unknown,
          message: '发生未知错误: ${error.message}',
          originalError: error,
        );
    }
  }

  /// 解析通用错误
  static AppError parseError(dynamic error) {
    if (error is DioException) {
      return parseDioError(error);
    } else if (error is AppError) {
      return error;
    } else {
      return AppError(
        type: ErrorType.unknown,
        message: error.toString(),
        originalError: error,
      );
    }
  }

  // ==================== 错误显示 ====================

  /// 显示错误提示（Snackbar）
  static void showError(dynamic error, {String? title}) {
    final appError = parseError(error);
    Get.snackbar(
      title ?? '错误',
      appError.message,
      snackPosition: SnackPosition.BOTTOM,
      backgroundColor: Colors.red.withValues(alpha: 0.8),
      colorText: Colors.white,
      duration: const Duration(seconds: 3),
      margin: const EdgeInsets.all(16),
      borderRadius: 12,
      icon: const Icon(Icons.error_outline, color: Colors.white),
    );
  }

  /// 显示成功提示
  static void showSuccess(String message, {String? title}) {
    Get.snackbar(
      title ?? '成功',
      message,
      snackPosition: SnackPosition.BOTTOM,
      backgroundColor: const Color(0xFFFFC107).withValues(alpha: 0.8),
      colorText: Colors.black,
      duration: const Duration(seconds: 2),
      margin: const EdgeInsets.all(16),
      borderRadius: 12,
      icon: const Icon(Icons.check_circle_outline, color: Colors.black),
    );
  }

  /// 显示警告提示
  static void showWarning(String message, {String? title}) {
    Get.snackbar(
      title ?? '警告',
      message,
      snackPosition: SnackPosition.BOTTOM,
      backgroundColor: Colors.orange.withValues(alpha: 0.8),
      colorText: Colors.white,
      duration: const Duration(seconds: 3),
      margin: const EdgeInsets.all(16),
      borderRadius: 12,
      icon: const Icon(Icons.warning_outlined, color: Colors.white),
    );
  }

  /// 显示信息提示
  static void showInfo(String message, {String? title}) {
    Get.snackbar(
      title ?? '提示',
      message,
      snackPosition: SnackPosition.BOTTOM,
      backgroundColor: Colors.blue.withValues(alpha: 0.8),
      colorText: Colors.white,
      duration: const Duration(seconds: 2),
      margin: const EdgeInsets.all(16),
      borderRadius: 12,
      icon: const Icon(Icons.info_outline, color: Colors.white),
    );
  }

  // ==================== 错误对话框 ====================

  /// 显示错误对话框
  static Future<void> showErrorDialog({
    required String message,
    String? title,
    VoidCallback? onRetry,
    VoidCallback? onCancel,
  }) async {
    await Get.dialog(
      AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: Text(
          title ?? '错误',
          style: const TextStyle(color: Colors.white),
        ),
        content: Text(
          message,
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          if (onCancel != null)
            TextButton(
              onPressed: () {
                Get.back();
                onCancel();
              },
              child: const Text('取消'),
            ),
          if (onRetry != null)
            TextButton(
              onPressed: () {
                Get.back();
                onRetry();
              },
              child: const Text('重试'),
            )
          else
            TextButton(
              onPressed: () => Get.back(),
              child: const Text('确定'),
            ),
        ],
      ),
    );
  }

  // ==================== 重试逻辑 ====================

  /// 执行带重试的异步操作
  static Future<T> retry<T>({
    required Future<T> Function() operation,
    int maxAttempts = 3,
    Duration delay = const Duration(seconds: 1),
    bool Function(dynamic error)? shouldRetry,
  }) async {
    int attempts = 0;
    dynamic lastError;

    while (attempts < maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        attempts++;

        // 检查是否应该重试
        if (shouldRetry != null && !shouldRetry(error)) {
          rethrow;
        }

        // 如果还有重试机会，等待后重试
        if (attempts < maxAttempts) {
          await Future.delayed(delay * attempts);
          Logger.info('[ErrorHandler] Retry attempt $attempts/$maxAttempts');
        }
      }
    }

    // 所有重试都失败，抛出最后一个错误
    throw lastError;
  }

  /// 判断错误是否可以重试
  static bool isRetryableError(dynamic error) {
    if (error is DioException) {
      return error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.sendTimeout ||
          error.type == DioExceptionType.receiveTimeout ||
          error.type == DioExceptionType.connectionError;
    }
    return false;
  }
}

// ==================== 应用错误类 ====================

/// 应用错误类
class AppError implements Exception {
  final ErrorType type;
  final String message;
  final dynamic originalError;
  final StackTrace? stackTrace;

  AppError({
    required this.type,
    required this.message,
    this.originalError,
    this.stackTrace,
  });

  @override
  String toString() {
    return 'AppError(type: $type, message: $message)';
  }
}

// ==================== 错误显示组件 ====================

/// 错误显示组件
class ErrorWidget extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  final IconData icon;

  const ErrorWidget({
    super.key,
    required this.message,
    this.onRetry,
    this.icon = Icons.error_outline,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 64,
              color: Colors.white38,
            ),
            const SizedBox(height: 16),
            Text(
              message,
              style: const TextStyle(
                fontSize: 16,
                color: Colors.white54,
              ),
              textAlign: TextAlign.center,
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('重试'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFFC107),
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 32,
                    vertical: 12,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// 空状态组件
class EmptyWidget extends StatelessWidget {
  final String message;
  final IconData icon;
  final VoidCallback? onAction;
  final String? actionText;

  const EmptyWidget({
    super.key,
    required this.message,
    this.icon = Icons.inbox_outlined,
    this.onAction,
    this.actionText,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 64,
              color: Colors.white38,
            ),
            const SizedBox(height: 16),
            Text(
              message,
              style: const TextStyle(
                fontSize: 16,
                color: Colors.white54,
              ),
              textAlign: TextAlign.center,
            ),
            if (onAction != null && actionText != null) ...[
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: onAction,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFFC107),
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 32,
                    vertical: 12,
                  ),
                ),
                child: Text(actionText!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// 加载组件
class LoadingWidget extends StatelessWidget {
  final String? message;

  const LoadingWidget({
    super.key,
    this.message,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(
            color: Color(0xFFFFC107),
          ),
          if (message != null) ...[
            const SizedBox(height: 16),
            Text(
              message!,
              style: const TextStyle(
                fontSize: 14,
                color: Colors.white54,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
