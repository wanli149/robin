import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:get/get.dart' as getx;
import 'package:shared_preferences/shared_preferences.dart';
import 'user_store.dart';

/// HTTP 客户端服务
/// 
/// 基于 Dio 封装的 HTTP 客户端，提供统一的网络请求能力。
/// 
/// ## 核心功能
/// - 请求/响应拦截器
/// - 自动 Token 注入
/// - 统一错误处理
/// - 自动重试机制
/// - 智能 API 地址切换
/// 
/// ## 使用示例
/// ```dart
/// final httpClient = HttpClient();
/// 
/// // GET 请求
/// final response = await httpClient.get('/api/videos');
/// 
/// // POST 请求
/// final response = await httpClient.post('/api/login', data: {
///   'username': 'user',
///   'password': 'pass',
/// });
/// ```
/// 
/// ## 错误处理
/// 客户端会自动处理以下错误：
/// - 401: 清除本地 Token
/// - 403: 显示权限错误提示
/// - 404: 显示资源不存在提示
/// - 500/502/503: 显示服务器错误提示
/// - 网络超时: 自动重试（最多3次）
/// 
/// ## 单例模式
/// 使用工厂构造函数确保全局只有一个实例：
/// ```dart
/// final client1 = HttpClient();
/// final client2 = HttpClient();
/// assert(identical(client1, client2)); // true
/// ```
class HttpClient {
  static final HttpClient _instance = HttpClient._internal();
  factory HttpClient() => _instance;
  
  late Dio dio;
  
  HttpClient._internal() {
    dio = Dio(BaseOptions(
      baseUrl: '', // 将在 API 配置中设置
      connectTimeout: const Duration(seconds: 8), // 🚀 从10秒减少到8秒
      receiveTimeout: const Duration(seconds: 12), // 🚀 从15秒减少到12秒
      sendTimeout: const Duration(seconds: 8), // 🚀 从10秒减少到8秒
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));
    
    _initInterceptors();
  }
  
  // API 签名密钥（需要与后端配置一致）
  // 生产环境建议使用环境变量或安全存储
  static const String _apiSecretKey = 'robin-video-api-secret-2024';
  
  // APP 包名（必须与 AndroidManifest.xml 一致）
  static const String _appPackage = 'com.fetch.video';
  
  // APP 版本
  static const String _appVersion = '1.0.0';
  
  // 是否启用 API 签名（生产环境应启用）
  bool _enableApiSign = true;
  
  /// 启用/禁用 API 签名
  void setApiSignEnabled(bool enabled) {
    _enableApiSign = enabled;
    print('🔐 API Sign ${enabled ? "enabled" : "disabled"}');
  }

  /// 初始化拦截器
  void _initInterceptors() {
    // 请求拦截器
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        // 自动添加 token
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('token');
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        
        // 添加 API 签名（如果启用）
        if (_enableApiSign) {
          _addApiSignature(options);
        }
        
        print('🌐 Request: ${options.method} ${options.uri}');
        print('📤 Headers: ${options.headers}');
        if (options.data != null) {
          print('📦 Data: ${options.data}');
        }
        
        handler.next(options);
      },
      
      onResponse: (response, handler) {
        print('✅ Response: ${response.statusCode} ${response.requestOptions.uri}');
        print('📥 Data: ${response.data}');
        
        // 统一处理后端返回的 code 字段
        // 后端标准：code=1 表示成功，code=0 表示失败
        if (response.data is Map && response.data['code'] != null) {
          final code = response.data['code'];
          if (code == 0) {
            // 后端返回业务错误
            final msg = response.data['msg'] ?? '请求失败';
            print('⚠️ Business Error: $msg');
            // 不抛出异常，让业务层自己处理
          }
        }
        
        handler.next(response);
      },
      
      onError: (error, handler) async {
        print('❌ Error: ${error.message}');
        print('🔗 URL: ${error.requestOptions.uri}');
        
        // 统一错误处理
        if (error.response != null) {
          final statusCode = error.response!.statusCode;
          
          switch (statusCode) {
            case 401:
              // Token 过期或无效，只清除 token，不自动登出用户
              // 让业务层自己决定是否需要登出
              final prefs = await SharedPreferences.getInstance();
              await prefs.remove('token');
              print('⚠️ Token expired or invalid, cleared from storage');
              break;
            case 403:
              _showError('没有权限访问');
              break;
            case 404:
              _showError('请求的资源不存在');
              break;
            case 500:
              _showError('服务器错误，请稍后重试');
              break;
            case 502:
            case 503:
              _showError('服务暂时不可用，请稍后重试');
              break;
            default:
              _showError('请求失败: ${error.response!.statusMessage}');
          }
        } else {
          // 网络错误 - 减少错误提示的频率
          if (error.type == DioExceptionType.connectionTimeout ||
              error.type == DioExceptionType.receiveTimeout ||
              error.type == DioExceptionType.sendTimeout) {
            // 只在重试失败后才显示错误
            final retryCount = error.requestOptions.extra['retryCount'] ?? 0;
            if (retryCount >= 2) {
              _showError('连接超时，正在尝试其他服务器...');
            }
          } else if (error.type == DioExceptionType.connectionError) {
            // 连接错误时不立即显示，让智能切换处理
            print('🔄 Connection error, will try alternative URLs');
          } else {
            _showError('网络请求失败，请稍后重试');
          }
        }
        
        handler.next(error);
      },
    ));
    
    // 重试拦截器
    dio.interceptors.add(RetryInterceptor(
      dio: dio,
      retries: 3,
      retryDelays: const [
        Duration(seconds: 1),
        Duration(seconds: 2),
        Duration(seconds: 3),
      ],
    ));
  }
  
  /// 显示错误提示
  void _showError(String message) {
    getx.Get.snackbar(
      '错误',
      message,
      snackPosition: getx.SnackPosition.BOTTOM,
      duration: const Duration(seconds: 3),
    );
  }
  
  /// GET 请求
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return dio.get<T>(
      path,
      queryParameters: queryParameters,
      options: options,
    );
  }
  
  /// POST 请求
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return dio.post<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }
  
  /// PUT 请求
  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return dio.put<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }
  
  /// DELETE 请求
  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return dio.delete<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }
  
  /// 设置 Base URL
  void setBaseUrl(String baseUrl) {
    dio.options.baseUrl = baseUrl;
    print('🌐 HTTP Client base URL set to: $baseUrl');
  }
  
  /// 获取当前 Base URL
  String get baseUrl => dio.options.baseUrl;
  
  /// 添加 API 签名到请求头
  void _addApiSignature(RequestOptions options) {
    final timestamp = (DateTime.now().millisecondsSinceEpoch ~/ 1000).toString();
    final nonce = _generateNonce();
    final path = options.uri.path;
    
    // 构建签名数据: METHOD&PATH&TIMESTAMP&NONCE&PACKAGE&VERSION
    final signData = [
      options.method.toUpperCase(),
      path,
      timestamp,
      nonce,
      _appPackage,
      _appVersion,
    ].join('&');
    
    // 生成 HMAC-SHA256 签名
    final sign = _generateHmacSha256(signData, _apiSecretKey);
    
    // 添加请求头
    options.headers['X-Timestamp'] = timestamp;
    options.headers['X-Nonce'] = nonce;
    options.headers['X-Sign'] = sign;
    options.headers['X-App-Package'] = _appPackage;
    options.headers['X-App-Version'] = _appVersion;
  }
  
  /// 生成随机 Nonce
  String _generateNonce() {
    final random = Random.secure();
    final values = List<int>.generate(16, (i) => random.nextInt(256));
    return values.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }
  
  /// 生成 HMAC-SHA256 签名
  String _generateHmacSha256(String data, String key) {
    final keyBytes = utf8.encode(key);
    final dataBytes = utf8.encode(data);
    final hmac = Hmac(sha256, keyBytes);
    final digest = hmac.convert(dataBytes);
    return digest.toString();
  }

  /// 测试网络连接
  Future<bool> testConnection([String? testUrl]) async {
    try {
      final url = testUrl ?? dio.options.baseUrl;
      print('🔍 Testing connection to: $url');
      
      final response = await dio.get(
        '/api/version',
        options: Options(
          sendTimeout: const Duration(seconds: 5),
          receiveTimeout: const Duration(seconds: 5),
        ),
      );
      
      print('✅ Connection test successful: ${response.statusCode}');
      return response.statusCode == 200;
    } catch (e) {
      print('❌ Connection test failed: $e');
      return false;
    }
  }

  /// 智能切换API地址
  Future<String> findWorkingBaseUrl() async {
    final urls = [
      'http://localhost:8787',      // USB连接 + ADB端口转发（优先尝试）
      'http://10.0.2.2:8787',       // Android模拟器
      'http://192.168.1.4:8787',    // 局域网IP（WiFi连接）
      'http://127.0.0.1:8787',      // 本地回环地址
      'https://robin-backend.your-name.workers.dev', // 生产环境
    ];

    for (final url in urls) {
      print('🔍 Trying URL: $url');
      try {
        final testDio = Dio(BaseOptions(
          baseUrl: url,
          connectTimeout: const Duration(seconds: 2),
          receiveTimeout: const Duration(seconds: 2),
        ));

        final response = await testDio.get('/api/version');
        if (response.statusCode == 200) {
          print('✅ Found working URL: $url');
          return url;
        }
      } catch (e) {
        print('❌ URL $url failed: $e');
        continue;
      }
    }

    print('⚠️ No working URL found, using default');
    return urls.first;
  }
}

/// 重试拦截器
/// 
/// 自动重试失败的网络请求，提高请求成功率。
/// 
/// ## 重试条件
/// 仅在以下情况下重试：
/// - 连接超时 (connectionTimeout)
/// - 接收超时 (receiveTimeout)
/// - 发送超时 (sendTimeout)
/// - 连接错误 (connectionError)
/// 
/// ## 重试策略
/// - 最大重试次数：3次
/// - 重试间隔：递增延迟（1秒、2秒、3秒）
/// - 每次重试前会等待指定时间
/// 
/// ## 使用方式
/// 该拦截器已在 HttpClient 中自动配置，无需手动添加。
class RetryInterceptor extends Interceptor {
  final Dio dio;
  final int retries;
  final List<Duration> retryDelays;
  
  RetryInterceptor({
    required this.dio,
    this.retries = 3,
    this.retryDelays = const [
      Duration(seconds: 1),
      Duration(seconds: 2),
      Duration(seconds: 3),
    ],
  });
  
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final extra = err.requestOptions.extra;
    final retryCount = extra['retryCount'] ?? 0;
    
    // 只重试网络错误和超时错误
    if (retryCount < retries &&
        (err.type == DioExceptionType.connectionTimeout ||
         err.type == DioExceptionType.receiveTimeout ||
         err.type == DioExceptionType.sendTimeout ||
         err.type == DioExceptionType.connectionError)) {
      
      print('🔄 Retry attempt ${retryCount + 1}/$retries');
      
      // 等待后重试
      await Future.delayed(
        retryCount < retryDelays.length
            ? retryDelays[retryCount]
            : retryDelays.last,
      );
      
      // 更新重试次数
      err.requestOptions.extra['retryCount'] = retryCount + 1;
      
      try {
        // 重新发起请求
        final response = await dio.fetch(err.requestOptions);
        handler.resolve(response);
        return;
      } catch (e) {
        // 重试失败，继续传递错误
      }
    }
    
    handler.next(err);
  }
}
