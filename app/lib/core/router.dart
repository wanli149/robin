import 'package:get/get.dart';
import 'package:url_launcher/url_launcher.dart';
import 'logger.dart';

/// 通用路由器
/// 
/// 统一处理应用内的各种跳转逻辑，支持多种协议：
/// 
/// ## 支持的协议
/// 
/// ### video:// - 视频协议
/// 用于跳转到视频详情或播放页面
/// ```dart
/// // 格式1：直接使用ID
/// UniversalRouter.navigate('video://123');
/// 
/// // 格式2：带参数
/// UniversalRouter.navigate('video://detail?id=123');
/// ```
/// 
/// ### browser:// - 浏览器协议
/// 在系统浏览器中打开链接
/// ```dart
/// UniversalRouter.navigate('browser://https://example.com');
/// ```
/// 
/// ### webview:// - WebView 协议
/// 在应用内 WebView 中打开链接
/// ```dart
/// UniversalRouter.navigate('webview://https://example.com');
/// ```
/// 
/// ### deeplink:// - 深度链接协议
/// 跳转到应用内指定页面
/// ```dart
/// // 跳转到首页
/// UniversalRouter.navigate('deeplink://home');
/// 
/// // 跳转到搜索页（带关键词）
/// UniversalRouter.navigate('deeplink://search?keyword=动作');
/// 
/// // 跳转到短剧详情
/// UniversalRouter.navigate('deeplink://shorts?id=123');
/// ```
/// 
/// ### http:// / https:// - HTTP 协议
/// 默认使用 WebView 打开
/// ```dart
/// UniversalRouter.navigate('https://example.com');
/// ```
/// 
/// ## 快捷方法
/// ```dart
/// // 跳转到视频详情
/// UniversalRouter.toVideoDetail('123');
/// 
/// // 在浏览器中打开
/// UniversalRouter.openInBrowser('https://example.com');
/// 
/// // 跳转到搜索
/// UniversalRouter.toSearch(keyword: '动作');
/// ```
/// 
/// ## 错误处理
/// 当遇到不支持的协议或解析失败时，会显示 Snackbar 提示用户
class UniversalRouter {
  /// 处理通用跳转
  /// 
  /// 解析 URL 并根据协议类型执行相应的跳转逻辑。
  /// 
  /// [url] 要跳转的 URL，支持多种协议格式
  /// 
  /// ## 示例
  /// ```dart
  /// // 视频详情
  /// await UniversalRouter.navigate('video://123');
  /// 
  /// // 外部浏览器
  /// await UniversalRouter.navigate('browser://https://google.com');
  /// 
  /// // 应用内 WebView
  /// await UniversalRouter.navigate('https://example.com');
  /// ```
  /// 
  /// ## 错误处理
  /// - 空 URL：直接返回，不执行任何操作
  /// - 未知协议：显示 Snackbar 提示
  /// - 解析失败：显示错误 Snackbar
  static Future<void> navigate(String url) async {
    Logger.info('[Router] Navigate called with: $url');
    if (url.isEmpty) {
      Logger.info('[Router] URL is empty, returning');
      return;
    }
    
    try {
      final uri = Uri.parse(url);
      final scheme = uri.scheme.toLowerCase();
      Logger.info('[Router] Parsed scheme: $scheme, host: ${uri.host}');
      
      switch (scheme) {
        case 'video':
          await _handleVideoProtocol(uri);
          break;
        case 'browser':
          await _handleBrowserProtocol(uri);
          break;
        case 'webview':
          await _handleWebViewProtocol(uri);
          break;
        case 'deeplink':
          await _handleDeepLinkProtocol(uri);
          break;
        case 'article':
          await _handleArticleProtocol(uri);
          break;
        case 'actor':
          await _handleActorProtocol(uri);
          break;
        case 'search':
          await _handleSearchProtocol(uri);
          break;
        case 'http':
        case 'https':
          // 默认使用 WebView 打开
          await _handleWebViewProtocol(uri);
          break;
        default:
          Logger.warning('[Router] Unknown protocol: $scheme');
          Get.snackbar(
            '提示',
            '不支持的链接类型',
            snackPosition: SnackPosition.BOTTOM,
          );
      }
    } catch (e) {
      Logger.error('[Router] Router error: $e');
      Get.snackbar(
        '错误',
        '无法打开链接',
        snackPosition: SnackPosition.BOTTOM,
      );
    }
  }
  
  /// 处理 video:// 协议
  /// 
  /// 支持两种 URL 格式：
  /// - `video://123` - 直接使用 ID 作为 host
  /// - `video://detail?id=123` - 使用查询参数传递 ID
  /// 
  /// [uri] 解析后的 URI 对象
  /// 
  /// 跳转目标：`/video/detail` 路由，参数 `{'vodId': id}`
  static Future<void> _handleVideoProtocol(Uri uri) async {
    String? vodId;
    
    // 支持两种格式：
    // 1. video://123 (直接是ID)
    // 2. video://detail?id=123 (带参数)
    if (uri.host.isNotEmpty && uri.host != 'detail' && uri.host != 'play') {
      vodId = uri.host;
    } else {
      vodId = uri.queryParameters['id'];
    }
    
    if (vodId != null && vodId.isNotEmpty) {
      Logger.player('[Router] Opening video detail: $vodId');
      // 使用命名路由
      Get.toNamed('/video/detail', arguments: {'vodId': vodId});
    } else {
      Logger.warning('[Router] Invalid video URL: $uri');
    }
  }
  
  /// 处理 browser:// 协议
  /// 
  /// 在系统默认浏览器中打开链接。
  /// 
  /// 格式: `browser://https://example.com`
  /// 
  /// [uri] 解析后的 URI 对象
  /// 
  /// 使用 `url_launcher` 包的 `launchUrl` 方法，
  /// 模式为 `LaunchMode.externalApplication`
  static Future<void> _handleBrowserProtocol(Uri uri) async {
    // 提取实际 URL（去掉 browser:// 前缀）
    final actualUrl = uri.toString().replaceFirst('browser://', '');
    
    try {
      final url = Uri.parse(actualUrl);
      if (await canLaunchUrl(url)) {
        await launchUrl(
          url,
          mode: LaunchMode.externalApplication,
        );
      } else {
        throw 'Could not launch $actualUrl';
      }
    } catch (e) {
      Logger.error('[Router] Failed to launch browser: $e');
      Get.snackbar(
        '错误',
        '无法打开浏览器',
        snackPosition: SnackPosition.BOTTOM,
      );
    }
  }
  
  /// 处理 webview:// 协议
  /// 
  /// 在应用内 WebView 中打开链接。
  /// 
  /// 格式: `webview://https://example.com`
  /// 
  /// [uri] 解析后的 URI 对象
  /// 
  /// 跳转目标：`/webview` 路由，参数 `{'url': actualUrl}`
  /// 
  /// 注意：http/https 协议的 URL 也会默认使用此方法处理
  static Future<void> _handleWebViewProtocol(Uri uri) async {
    // 提取实际 URL
    String actualUrl;
    if (uri.scheme == 'webview') {
      actualUrl = uri.toString().replaceFirst('webview://', '');
    } else {
      actualUrl = uri.toString();
    }
    
    Get.toNamed('/webview', arguments: {'url': actualUrl});
  }
  
  /// 处理 deeplink:// 协议
  /// 
  /// 跳转到应用内指定页面。
  /// 
  /// 格式: `deeplink://page?param=value`
  /// 
  /// [uri] 解析后的 URI 对象
  /// 
  /// ## 支持的页面
  /// - `home`: 首页（清空导航栈）
  /// - `search`: 搜索页，可选参数 `keyword`
  /// - `profile`: 个人中心
  /// - `shorts`: 短剧页面，可选参数 `id`
  /// - `topic`: 专题页面，必需参数 `id`
  static Future<void> _handleDeepLinkProtocol(Uri uri) async {
    final host = uri.host;
    final params = uri.queryParameters;
    
    switch (host) {
      case 'home':
        Get.offAllNamed('/');
        break;
      case 'search':
        final keyword = params['keyword'];
        Get.toNamed('/search', arguments: {'keyword': keyword});
        break;
      case 'profile':
        Get.toNamed('/profile');
        break;
      case 'shorts':
        final id = params['id'];
        if (id != null) {
          Get.toNamed('/shorts/detail', arguments: {'id': id});
        } else {
          Get.toNamed('/shorts');
        }
        break;
      case 'topic':
        final id = params['id'];
        if (id != null) {
          Get.toNamed('/topic', arguments: {'id': id});
        }
        break;
      default:
        Logger.warning('[Router] Unknown deeplink: $host');
    }
  }
  
  /// 处理 article:// 协议
  /// 
  /// 跳转到文章详情页面
  /// 
  /// 格式: `article://123`
  static Future<void> _handleArticleProtocol(Uri uri) async {
    String? articleId;
    
    if (uri.host.isNotEmpty) {
      articleId = uri.host;
    } else {
      articleId = uri.queryParameters['id'];
    }
    
    if (articleId != null && articleId.isNotEmpty) {
      Logger.info('[Router] Opening article detail: $articleId');
      Get.toNamed('/article/detail', arguments: {'articleId': articleId});
    } else {
      Logger.warning('[Router] Invalid article URL: $uri');
    }
  }
  
  /// 处理 actor:// 协议
  /// 
  /// 跳转到演员详情页面
  /// 
  /// 格式: `actor://123`
  static Future<void> _handleActorProtocol(Uri uri) async {
    String? actorId;
    
    if (uri.host.isNotEmpty) {
      actorId = uri.host;
    } else {
      actorId = uri.queryParameters['id'];
    }
    
    if (actorId != null && actorId.isNotEmpty) {
      Logger.info('[Router] Opening actor detail: $actorId');
      Get.toNamed('/actor', arguments: {
        'actorId': int.tryParse(actorId) ?? 0,
        'actorName': '',
      });
    } else {
      Logger.warning('[Router] Invalid actor URL: $uri');
    }
  }
  
  /// 处理 search:// 协议
  /// 
  /// 跳转到搜索页面
  /// 
  /// 格式: `search://关键词`
  static Future<void> _handleSearchProtocol(Uri uri) async {
    String? keyword;
    
    if (uri.host.isNotEmpty) {
      keyword = Uri.decodeComponent(uri.host);
    } else {
      keyword = uri.queryParameters['keyword'];
    }
    
    Logger.debug('[Router] Opening search: $keyword');
    Get.toNamed('/search', arguments: {'keyword': keyword});
  }
  
  /// 快捷方法：跳转到视频详情
  static void toVideoDetail(String vodId) {
    navigate('video://detail?id=$vodId');
  }
  
  /// 快捷方法：跳转到视频播放
  static void toVideoPlay(String vodId, {String? episode}) {
    final url = episode != null
        ? 'video://play?id=$vodId&episode=$episode'
        : 'video://play?id=$vodId';
    navigate(url);
  }
  
  /// 快捷方法：在浏览器中打开
  static void openInBrowser(String url) {
    navigate('browser://$url');
  }
  
  /// 快捷方法：在 WebView 中打开
  static void openInWebView(String url) {
    navigate('webview://$url');
  }
  
  /// 快捷方法：跳转到搜索
  static void toSearch({String? keyword}) {
    final url = keyword != null
        ? 'deeplink://search?keyword=$keyword'
        : 'deeplink://search';
    navigate(url);
  }
  
  /// 快捷方法：跳转到短剧详情
  static void toShortsDetail(String id) {
    navigate('deeplink://shorts?id=$id');
  }
  
  /// 快捷方法：跳转到专题
  static void toTopic(String id) {
    navigate('deeplink://topic?id=$id');
  }
  
  /// 快捷方法：跳转到演员页面
  static void toActor(int actorId, String actorName) {
    Get.toNamed('/actor', arguments: {
      'actorId': actorId,
      'actorName': actorName,
    });
  }
  
  /// 处理路由（兼容方法）
  static Future<void> handleRoute(String url) async {
    await navigate(url);
  }
}
