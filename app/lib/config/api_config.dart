/// API 配置
/// 定义后端 API 基础 URL 和相关配置
class ApiConfig {
  // 私有构造函数，防止实例化
  ApiConfig._();
  
  // 开发环境 API 地址（本地测试）
  static const String devBaseUrlEmulator = 'http://10.0.2.2:8787';
  static const String devBaseUrlDevice = 'http://localhost:8787';
  
  // 生产环境 API 地址（从环境变量读取，或使用默认值）
  static const String prodBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://robin-backend.your-name.workers.dev',
  );
  
  // 备用 API 地址列表（从环境变量读取，或使用默认值）
  static const String _fallbackUrlsEnv = String.fromEnvironment(
    'API_FALLBACK_URLS',
    defaultValue: '',
  );
  
  static List<String> get fallbackUrls {
    if (_fallbackUrlsEnv.isNotEmpty) {
      return _fallbackUrlsEnv.split(',').map((e) => e.trim()).toList();
    }
    return [];
  }
  
  // 域名列表 API 端点（用于动态获取域名）
  static const String domainsEndpoint = '/api/domains';
  
  // 本地测试开关（从环境变量读取，默认false）
  static const bool forceDevMode = bool.fromEnvironment(
    'FORCE_DEV_MODE',
    defaultValue: false,
  );
  
  // 当前环境（根据编译模式自动切换）
  static const bool isProduction = bool.fromEnvironment('dart.vm.product');
  
  // 自定义 Base URL（用于动态切换）
  static String? _customBaseUrl;
  
  /// 设置自定义 Base URL
  static void setCustomBaseUrl(String? url) {
    _customBaseUrl = url;
  }
  
  /// 获取当前使用的 Base URL
  static String get baseUrl {
    // 优先使用自定义 URL
    if (_customBaseUrl != null && _customBaseUrl!.isNotEmpty) {
      return _customBaseUrl!;
    }
    
    // 生产环境直接返回生产地址
    if (isProduction && !forceDevMode) {
      return prodBaseUrl;
    }
    
    // 开发环境：使用真机地址（通过ADB端口转发）
    return devBaseUrlDevice;
  }
  
  /// 获取真机测试地址（用于真机测试时手动切换）
  static String get deviceBaseUrl => devBaseUrlDevice;
  
  /// 重置为默认 URL
  static void resetToDefault() {
    _customBaseUrl = null;
  }
  
  // 超时时间配置
  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);
  static const Duration sendTimeout = Duration(seconds: 30);
  
  // 重试配置
  static const int maxRetries = 3;
  static const List<Duration> retryDelays = [
    Duration(seconds: 1),
    Duration(seconds: 2),
    Duration(seconds: 3),
  ];
  
  // APP 版本号
  static const String appVersion = '1.0.0';
  
  // API 端点
  static const String authLogin = '/api/auth/login';
  static const String authRegister = '/api/auth/register';
  static const String authMe = '/api/auth/me';
  static const String userSync = '/user/sync';
  static const String userHistory = '/api/user/history';
  static const String userFavorites = '/api/user/favorites';
  static const String userFavorite = '/api/user/favorite';
  static const String userAppointments = '/api/user/appointments';
  static const String appointment = '/api/appointment';
  static const String homeLayout = '/home_layout';
  static const String vodList = '/api/vod';
  static const String vodDetail = '/api/vod/detail';
  static const String search = '/api/search';
  static const String shortsRandom = '/api/shorts/random';
  static const String shortsSeries = '/api/shorts/series';
  static const String imageProxy = '/img';
  static const String version = '/api/version';
  static const String config = '/api/config';
  static const String feedback = '/api/feedback';
  static const String appWall = '/api/app_wall';
  static const String crashReport = '/api/system/crash_report';
}
