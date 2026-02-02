import 'dart:async';
import 'dart:io';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'config/api_config.dart';
import 'core/logger.dart';
import 'config/theme.dart';
import 'core/user_store.dart';
import 'core/http_client.dart';
import 'core/sync_service.dart';
import 'core/app_info.dart';
import 'core/global_config.dart';

import 'core/performance_config.dart';
import 'core/pip_manager.dart';
import 'core/player/global_player_manager.dart';
import 'core/player/media_kit_initializer.dart';
import 'core/progress_sync_service.dart';
import 'core/settings_store.dart';
import 'core/cache_service.dart';
import 'services/announcement_service.dart';
import 'services/favorites_service.dart';
import 'services/play_stats_service.dart';

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
    () async {
      // 确保 Flutter 绑定初始化
      WidgetsFlutterBinding.ensureInitialized();
      
      // 初始化 media_kit（必须在 runApp 之前）
      MediaKitInitializer.initialize();

      // 设置 Flutter 错误处理
      FlutterError.onError = (FlutterErrorDetails details) {
        FlutterError.presentError(details);
        _handleFlutterError(details);
      };

      // 🚀 在 runApp 之前初始化所有核心服务
      await _initServices();

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
    final appInfo = Get.find<AppInfo>();
    final deviceInfo = {
      'platform': defaultTargetPlatform.toString(),
      'version': appInfo.version.value,
      'build_number': appInfo.buildNumber.value,
    };

    // 构建崩溃报告
    final crashReport = {
      'error': error.toString(),
      'stack_trace': stackTrace?.toString().substring(0, 500) ?? '', // 限制长度
      'context': context ?? 'Unknown',
      'device_info': deviceInfo,
      'timestamp': DateTime.now().toIso8601String(),
    };

    // 先保存到本地（备份）
    await _saveCrashReportLocally(crashReport);

    // 尝试发送到后端
    try {
      await httpClient.post(
        ApiConfig.crashReport,
        data: crashReport,
      ).timeout(const Duration(seconds: 5));
      
      // 上报成功，删除本地备份
      await _deleteCrashReportLocally(crashReport['timestamp'] as String);
    } catch (uploadError) {
      Logger.warning('[CrashReport] Failed to upload, saved locally: $uploadError');
      // 上报失败，保留本地备份，下次启动时重试
    }
  } catch (e) {
    // 崩溃报告本身失败也不影响应用运行
    Logger.error('[CrashReport] Failed to process crash report: $e');
  }
}

/// 保存崩溃报告到本地
Future<void> _saveCrashReportLocally(Map<String, dynamic> report) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final reports = prefs.getStringList('crash_reports') ?? [];
    
    // 限制最多保存10个崩溃报告
    if (reports.length >= 10) {
      reports.removeAt(0);
    }
    
    reports.add(jsonEncode(report));
    await prefs.setStringList('crash_reports', reports);
  } catch (e) {
    Logger.error('[CrashReport] Failed to save locally: $e');
  }
}

/// 删除本地崩溃报告
Future<void> _deleteCrashReportLocally(String timestamp) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final reports = prefs.getStringList('crash_reports') ?? [];
    
    reports.removeWhere((report) {
      try {
        final decoded = jsonDecode(report) as Map<String, dynamic>;
        return decoded['timestamp'] == timestamp;
      } catch (_) {
        return false;
      }
    });
    
    await prefs.setStringList('crash_reports', reports);
  } catch (e) {
    Logger.error('[CrashReport] Failed to delete local report: $e');
  }
}

/// 上传本地保存的崩溃报告
Future<void> _uploadPendingCrashReports() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final reports = prefs.getStringList('crash_reports') ?? [];
    
    if (reports.isEmpty) return;
    
    final httpClient = HttpClient();
    final uploadedTimestamps = <String>[];
    
    for (final reportJson in reports) {
      try {
        final report = jsonDecode(reportJson) as Map<String, dynamic>;
        
        await httpClient.post(
          ApiConfig.crashReport,
          data: report,
        ).timeout(const Duration(seconds: 5));
        
        uploadedTimestamps.add(report['timestamp'] as String);
      } catch (e) {
        Logger.warning('[CrashReport] Failed to upload pending report: $e');
        // 继续尝试下一个
      }
    }
    
    // 删除已上传的报告
    for (final timestamp in uploadedTimestamps) {
      await _deleteCrashReportLocally(timestamp);
    }
  } catch (e) {
    Logger.error('[CrashReport] Failed to upload pending reports: $e');
  }
}

/// 初始化核心服务（在 main 函数中调用）
Future<void> _initServices() async {
  Logger.info('Starting _initServices...', 'Init');
  
  // 初始化性能配置
  PerformanceConfig.initialize();
  Logger.info('PerformanceConfig initialized', 'Init');
  
  // 🚀 初始化缓存服务（同步初始化，因为其他服务依赖它）
  final cacheService = CacheService();
  Logger.info('CacheService instance created', 'Init');
  
  await cacheService.init(); // 等待初始化完成
  Logger.info('CacheService.init() completed', 'Init');
  
  Get.put(cacheService, permanent: true);
  Logger.info('CacheService registered with GetX', 'Init');
  
  // 初始化应用信息（版本号等）
  Get.putAsync(() => AppInfo().init(), permanent: true);
  
  // 初始化用户状态管理
  Get.put(UserStore());

  // 初始化 HTTP 客户端并设置 Base URL
  final httpClient = HttpClient();
  final baseUrl = ApiConfig.baseUrl;
  Logger.network('GET', 'Using base URL: $baseUrl');
  Logger.info('forceDevMode: ${ApiConfig.forceDevMode}', 'Init');
  Logger.info('isProduction: ${ApiConfig.isProduction}', 'Init');
  Logger.info('Platform: ${Platform.operatingSystem}', 'Init');
  Logger.info('Is Physical Device: ${!kIsWeb && (Platform.isAndroid || Platform.isIOS)}', 'Init');
  httpClient.setBaseUrl(baseUrl);
  
  // 初始化同步服务
  Get.put(SyncService());
  
  // 初始化画中画管理器
  Get.put(PipManager());
  
  // 初始化进度同步服务
  Get.put(ProgressSyncService(), permanent: true);
  
  // 初始化全局播放器管理器 (基于 media_kit)
  Get.put(GlobalPlayerManager(), permanent: true);
  
  // 初始化公告服务
  Get.put(AnnouncementService(), permanent: true);
  
  // 初始化收藏服务
  Get.put(FavoritesService(), permanent: true);
  
  // 🚀 初始化播放统计服务
  Get.putAsync(() => PlayStatsService().init(), permanent: true);
  
  // 初始化设置存储（异步初始化）
  Get.putAsync(() => SettingsStore().init(), permanent: true);
  
  // 初始化全局配置服务
  Get.put(GlobalConfig(), permanent: true);
  
  Logger.success('All services initialized successfully', 'Init');
  
  // 上传本地保存的崩溃报告
  _uploadPendingCrashReports();
  
  // 检测网络连接（强制启用用于调试）
  _checkNetworkConnection();
}

/// 检测网络连接
void _checkNetworkConnection() {
  // 🚀 延迟检测，不阻塞启动
  Future.delayed(const Duration(milliseconds: 500), () async {
    try {
      final httpClient = HttpClient();
      
      // 🚀 静默测试，不显示错误提示
      final isConnected = await httpClient.testConnection();
      
      if (!isConnected) {
        Logger.warning('Default connection failed, trying to find working URL...');
        
        // 🚀 静默查找可用服务器
        final workingUrl = await httpClient.findWorkingBaseUrl(silent: true);
        httpClient.setBaseUrl(workingUrl);
        
        // 更新API配置
        ApiConfig.setCustomBaseUrl(workingUrl);
        
        Logger.success('Switched to working URL: $workingUrl');
        
        // 通知首页重新加载
        try {
          final homeController = Get.find<HomeController>();
          homeController.refreshCurrentChannel();
        } catch (e) {
          Logger.warning('Home controller not found: $e');
        }
      } else {
        Logger.success('Network connection OK');
      }
    } catch (e) {
      Logger.error('Network check failed: $e');
      // 🚀 启动时网络检测失败不显示错误，让用户正常进入 App
    }
  });
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
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
}
