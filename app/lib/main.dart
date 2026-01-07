import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import 'config/api_config.dart';
import 'config/theme.dart';
import 'core/user_store.dart';
import 'core/http_client.dart';
import 'core/sync_service.dart';

import 'core/performance_config.dart';
import 'core/pip_manager.dart';
import 'core/global_player_manager.dart';
import 'core/progress_sync_service.dart';
import 'core/settings_store.dart';
import 'services/announcement_service.dart';

// 国际化支持
import 'i18n/i18n.dart';
import 'modules/splash/splash_page.dart';
import 'modules/root/root_page.dart';
import 'modules/auth/login_page.dart';
import 'modules/auth/register_page.dart';
import 'modules/profile/history_page.dart';
import 'modules/profile/favorites_page.dart';
import 'modules/profile/feedback_page.dart';
import 'modules/profile/appointments_page.dart';
import 'modules/profile/app_wall_page.dart';
import 'modules/profile/settings_page.dart';
import 'modules/webview/webview_page.dart';
import 'modules/detail/detail_page.dart';
import 'modules/article/article_detail_page.dart';
import 'modules/search/search_page.dart';
import 'modules/actor/actor_page.dart';
import 'modules/shorts/shorts_detail_page.dart';
import 'modules/home/home_controller.dart';

void main() {
  // 使用 runZonedGuarded 捕获未处理的异常
  runZonedGuarded(
    () {
      // 确保 Flutter 绑定初始化
      WidgetsFlutterBinding.ensureInitialized();

      // 设置 Flutter 错误处理
      FlutterError.onError = (FlutterErrorDetails details) {
        FlutterError.presentError(details);
        _handleFlutterError(details);
      };

      // 运行应用
      runApp(const MyApp());
    },
    (error, stack) {
      // 捕获未处理的异步错误
      _handleUncaughtError(error, stack);
    },
  );
}

/// 处理 Flutter 框架错误
void _handleFlutterError(FlutterErrorDetails details) {
  if (kReleaseMode) {
    // Release 模式：上报崩溃
    _reportCrash(
      error: details.exception,
      stackTrace: details.stack,
      context: 'Flutter Framework Error',
    );
  } else {
    // Debug 模式：仅打印日志
    // Debug 模式下的错误处理
  }
}

/// 处理未捕获的错误
void _handleUncaughtError(Object error, StackTrace stack) {
  if (kReleaseMode) {
    // Release 模式：上报崩溃
    _reportCrash(
      error: error,
      stackTrace: stack,
      context: 'Uncaught Error',
    );
  } else {
    // Debug 模式：仅打印日志
    // Debug 模式下的错误处理
  }
}

/// 上报崩溃到后端
Future<void> _reportCrash({
  required Object error,
  StackTrace? stackTrace,
  String? context,
}) async {
  try {
    final httpClient = HttpClient();
    
    // 获取设备信息
    final deviceInfo = {
      'platform': defaultTargetPlatform.toString(),
      'version': '1.0.0', // TODO: 从配置获取版本号
    };

    // 构建崩溃报告
    final crashReport = {
      'error': error.toString(),
      'stack_trace': stackTrace?.toString().substring(0, 500) ?? '', // 限制长度
      'context': context ?? 'Unknown',
      'device_info': deviceInfo,
      'timestamp': DateTime.now().toIso8601String(),
    };

    // 发送到后端
    await httpClient.post(
      ApiConfig.crashReport,
      data: crashReport,
    );

    // 崩溃报告发送成功
  } catch (e) {
    // 上报失败也不影响应用运行
    // 崩溃报告发送失败
  }
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    // 初始化核心服务
    _initServices();

    return GetMaterialApp(
      title: 'app_name'.tr,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      // 国际化配置
      translations: AppTranslations(),
      locale: const Locale('zh', 'CN'),
      fallbackLocale: const Locale('en', 'US'),
      // 初始路由
      initialRoute: '/splash',
      // 全局构建器，处理画中画模式
      builder: (context, child) {
        // 在PIP模式下，直接返回正常的child，让video_player的原生Surface处理渲染
        // 不要在PIP模式下显示自定义Flutter UI
        return child ?? const SizedBox.shrink();
      },
      // 路由配置
      getPages: [
            GetPage(
              name: '/splash',
              page: () => const SplashPage(),
            ),
            GetPage(
              name: '/',
              page: () => const RootPage(),
            ),
            GetPage(
              name: '/login',
              page: () => const LoginPage(),
            ),
            GetPage(
              name: '/register',
              page: () => const RegisterPage(),
            ),
            GetPage(
              name: '/history',
              page: () => const HistoryPage(),
            ),
            GetPage(
              name: '/favorites',
              page: () => const FavoritesPage(),
            ),
            GetPage(
              name: '/feedback',
              page: () => const FeedbackPage(),
            ),
            GetPage(
              name: '/appointments',
              page: () => const AppointmentsPage(),
            ),
            GetPage(
              name: '/app_wall',
              page: () => const AppWallPage(),
            ),
            GetPage(
              name: '/settings',
              page: () => const SettingsPage(),
            ),
            GetPage(
              name: '/webview',
              page: () {
                final args = Get.arguments as Map<String, dynamic>?;
                final url = args?['url'] ?? '';
                final title = args?['title'];
                return WebViewPage(url: url, title: title);
              },
            ),
            GetPage(
              name: '/video/detail',
              page: () {
                final args = Get.arguments as Map<String, dynamic>?;
                final vodId = args?['vodId'] ?? '';
                return DetailPage(videoId: vodId);
              },
            ),
            GetPage(
              name: '/shorts/detail',
              page: () {
                final args = Get.arguments as Map<String, dynamic>?;
                final shortId = args?['shortId'] ?? '';
                return ShortsDetailPage(shortId: shortId);
              },
            ),
            GetPage(
              name: '/search',
              page: () => const SearchPage(),
            ),
            GetPage(
              name: '/actor',
              page: () {
                final args = Get.arguments as Map<String, dynamic>?;
                final actorId = args?['actorId'] ?? 0;
                final actorName = args?['actorName'] ?? '';
                return ActorPage(actorId: actorId, actorName: actorName);
              },
            ),
            GetPage(
              name: '/article/detail',
              page: () => const ArticleDetailPage(),
            ),
        // 其他路由将在后续任务中添加
      ],
    );
  }

  /// 初始化核心服务
  void _initServices() {
    // 初始化性能配置
    PerformanceConfig.initialize();
    
    // 初始化用户状态管理
    Get.put(UserStore());

    // 初始化 HTTP 客户端并设置 Base URL
    final httpClient = HttpClient();
    final baseUrl = ApiConfig.baseUrl;
    print('🌐 [Init] Using base URL: $baseUrl');
    print('🌐 [Init] forceDevMode: ${ApiConfig.forceDevMode}');
    print('🌐 [Init] isProduction: ${ApiConfig.isProduction}');
    print('🌐 [Init] Platform: ${Platform.operatingSystem}');
    print('🌐 [Init] Is Physical Device: ${!kIsWeb && (Platform.isAndroid || Platform.isIOS)}');
    httpClient.setBaseUrl(baseUrl);
    
    // 初始化同步服务
    Get.put(SyncService());
    
    // 初始化画中画管理器
    Get.put(PipManager());
    
    // 初始化进度同步服务
    Get.put(ProgressSyncService(), permanent: true);
    
    // 初始化全局播放器管理器
    Get.put(GlobalPlayerManager(), permanent: true);
    
    // 初始化公告服务
    Get.put(AnnouncementService(), permanent: true);
    
    // 初始化设置存储（异步初始化）
    Get.putAsync(() => SettingsStore().init(), permanent: true);
    
    // 应用初始化完成
    
    // 检测网络连接（强制启用用于调试）
    _checkNetworkConnection();
  }

  /// 检测网络连接
  void _checkNetworkConnection() {
    Future.delayed(const Duration(milliseconds: 100), () async {
      try {
        final httpClient = HttpClient();
        
        // 测试当前配置的连接
        final isConnected = await httpClient.testConnection();
        
        if (!isConnected) {
          print('⚠️ Default connection failed, trying to find working URL...');
          
          // 尝试找到可用的API地址
          final workingUrl = await httpClient.findWorkingBaseUrl();
          httpClient.setBaseUrl(workingUrl);
          
          // 更新API配置
          ApiConfig.setCustomBaseUrl(workingUrl);
          
          print('✅ Switched to working URL: $workingUrl');
          
          // 通知首页重新加载
          try {
            final homeController = Get.find<HomeController>();
            homeController.refreshCurrentChannel();
          } catch (e) {
            print('⚠️ Home controller not found: $e');
          }
        } else {
          print('✅ Network connection OK');
        }
      } catch (e) {
        print('❌ Network check failed: $e');
      }
    });
  }
}
