import 'dart:convert';
import 'dart:math';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:get/get.dart' as getx;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'logger.dart';
import 'network/request_cache.dart';
import 'network/cancel_token_manager.dart';

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
/// - 请求缓存支持
/// - 请求取消管理
/// 
/// ## 使用示例
/// ```dart
/// final httpClient = HttpClient();
/// 
/// // GET 请求
/// final response = await httpClient.get('/api/videos');
/// 
/// // 带缓存的 GET 请求
/// final response = await httpClient.getCached(
///   '/api/videos',
///   cacheConfig: CacheConfig.homeData,
/// );
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
  
  // 🚀 启动阶段标记，启动时不显示网络错误
  bool _isStartupPhase = true;
  
  /// 标记启动阶段结束
  void markStartupComplete() {
    _isStartupPhase = false;
    Logger.info('[HttpClient] Startup phase complete');
  }
  
  HttpClient._internal() {
    dio = Dio(BaseOptions(
      baseUrl: '', // 将在 API 配置中设置
      connectTimeout: const Duration(seconds: 8),
      receiveTimeout: const Duration(seconds: 12),
      sendTimeout: const Duration(seconds: 8),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));
    
    _initInterceptors();
    
    // 🚀 3秒后自动结束启动阶段
    Future.delayed(const Duration(seconds: 3), () {
      markStartupComplete();
    });
  }
  
  // ⚠️ API 签名密钥
  // 注意：此密钥会被编译到 APP 中，可以被反编译获取
  // 但仍能防止普通用户的滥用和简单的爬虫
  // 必须与后端 DEFAULT_CONFIG.secretKey 保持一致
  static const String _apiSecretKey = 'robin-video-api-secret-2024';
  
  // API 签名开关（默认启用）
  bool _enableApiSign = true;
  
  /// 启用/禁用 API 签名
  /// ⚠️ 客户端签名不安全，建议禁用
  void setApiSignEnabled(bool enabled) {
    _enableApiSign = enabled;
    Logger.info('[HttpClient] API Sign ${enabled ? "enabled" : "disabled"}');
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
        
        // 🚀 添加用户 ID 和设备 ID（用于搜索历史和热搜统计）
        final userId = prefs.getString('user_id');
        if (userId != null && userId.isNotEmpty) {
          options.headers['x-user-id'] = userId;
        }
        
        // 获取或生成设备 ID
        String? deviceId = prefs.getString('device_id');
        if (deviceId == null || deviceId.isEmpty) {
          deviceId = await _generateDeviceId();
          await prefs.setString('device_id', deviceId);
        }
        options.headers['x-device-id'] = deviceId;
        
        // 添加 API 签名
        // ⚠️ 注意：客户端签名可以被反编译获取密钥，但仍能防止普通用户滥用
        if (_enableApiSign) {
          await _addApiSignature(options);
        }
        
        Logger.network('REQUEST', '${options.method} ${options.uri}');
        Logger.debug('[HttpClient] Headers: ${options.headers}');
        if (options.data != null) {
          Logger.debug('[HttpClient] Data: ${options.data}');
        }
        
        handler.next(options);
      },
      
      onResponse: (response, handler) {
        Logger.network('RESPONSE', '${response.statusCode} ${response.requestOptions.uri}');
        Logger.debug('[HttpClient] Data: ${response.data}');
        
        // 统一处理后端返回的 code 字段
        // 后端标准：code=1 表示成功，code=0 表示失败
        if (response.data is Map && response.data['code'] != null) {
          final code = response.data['code'];
          if (code == 0) {
            // 后端返回业务错误
            final msg = response.data['msg'] ?? '请求失败';
            Logger.warning('[HttpClient] Business Error: $msg');
            // 不抛出异常，让业务层自己处理
          }
        }
        
        handler.next(response);
      },
      
      onError: (error, handler) async {
        Logger.error('[HttpClient] Error: ${error.message}');
        Logger.error('[HttpClient] URL: ${error.requestOptions.uri}');
        
        // 统一错误处理
        if (error.response != null) {
          final statusCode = error.response!.statusCode;
          
          switch (statusCode) {
            case 401:
              // Token 过期或无效，只清除 token，不自动登出用户
              // 让业务层自己决定是否需要登出
              final prefs = await SharedPreferences.getInstance();
              await prefs.remove('token');
              Logger.warning('[HttpClient] Token expired or invalid, cleared from storage');
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
            // 🚀 启动阶段不显示超时错误
            if (!_isStartupPhase) {
              // 只在重试失败后才显示错误
              final retryCount = error.requestOptions.extra['retryCount'] ?? 0;
              if (retryCount >= 2) {
                _showError('连接超时，正在尝试其他服务器...');
              }
            }
          } else if (error.type == DioExceptionType.connectionError) {
            // 连接错误时不立即显示，让智能切换处理
            Logger.info('[HttpClient] Connection error, will try alternative URLs');
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
  
  // ==================== 缓存相关 ====================
  
  final RequestCache _cache = RequestCache();
  
  /// 带缓存的 GET 请求
  /// 
  /// [path] 请求路径
  /// [queryParameters] 查询参数
  /// [cacheConfig] 缓存配置
  /// [options] Dio 选项
  Future<Response<T>> getCached<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    CacheConfig cacheConfig = const CacheConfig(),
    Options? options,
  }) async {
    final cacheKey = RequestCache.generateKey(
      '${dio.options.baseUrl}$path',
      queryParameters,
    );
    
    switch (cacheConfig.strategy) {
      case CacheStrategy.cacheFirst:
        // 优先使用缓存
        final cached = await _cache.get(cacheKey);
        if (cached != null) {
          Logger.debug('[HttpClient] Cache hit: $path');
          return Response<T>(
            data: cached as T,
            statusCode: 200,
            requestOptions: RequestOptions(path: path),
          );
        }
        // 缓存不存在，请求网络
        final response = await get<T>(path, queryParameters: queryParameters, options: options);
        if (response.statusCode == 200) {
          await _cache.set(cacheKey, response.data, ttl: cacheConfig.ttl, persist: cacheConfig.persist);
        }
        return response;
        
      case CacheStrategy.networkFirst:
        // 优先请求网络
        try {
          final response = await get<T>(path, queryParameters: queryParameters, options: options);
          if (response.statusCode == 200) {
            await _cache.set(cacheKey, response.data, ttl: cacheConfig.ttl, persist: cacheConfig.persist);
          }
          return response;
        } catch (e) {
          // 网络失败，尝试使用缓存
          final cached = await _cache.get(cacheKey, allowStale: true);
          if (cached != null) {
            Logger.debug('[HttpClient] Fallback to cache: $path');
            return Response<T>(
              data: cached as T,
              statusCode: 200,
              requestOptions: RequestOptions(path: path),
            );
          }
          rethrow;
        }
        
      case CacheStrategy.cacheOnly:
        // 只使用缓存
        final cached = await _cache.get(cacheKey, allowStale: true);
        if (cached != null) {
          return Response<T>(
            data: cached as T,
            statusCode: 200,
            requestOptions: RequestOptions(path: path),
          );
        }
        throw DioException(
          requestOptions: RequestOptions(path: path),
          message: 'No cache available',
        );
        
      case CacheStrategy.networkOnly:
        // 只使用网络
        return get<T>(path, queryParameters: queryParameters, options: options);
        
      case CacheStrategy.staleWhileRevalidate:
        // 先返回缓存，同时更新
        final cached = await _cache.get(cacheKey, allowStale: true);
        
        // 异步更新缓存
        get<T>(path, queryParameters: queryParameters, options: options).then((response) {
          if (response.statusCode == 200) {
            _cache.set(cacheKey, response.data, ttl: cacheConfig.ttl, persist: cacheConfig.persist);
          }
        }).catchError((e) {
          Logger.debug('[HttpClient] Background refresh failed: $e');
        });
        
        if (cached != null) {
          return Response<T>(
            data: cached as T,
            statusCode: 200,
            requestOptions: RequestOptions(path: path),
          );
        }
        // 没有缓存，等待网络
        return get<T>(path, queryParameters: queryParameters, options: options);
    }
  }
  
  /// 清除缓存
  Future<void> clearCache() async {
    await _cache.clear();
  }
  
  /// 清除过期缓存
  Future<void> clearExpiredCache() async {
    await _cache.clearExpired();
  }
  
  // ==================== 请求取消 ====================
  
  final GlobalCancelTokenManager _cancelManager = GlobalCancelTokenManager();
  
  /// 获取页面级别的取消令牌管理器
  CancelTokenManager getPageCancelManager(String pageId) {
    return _cancelManager.getPageManager(pageId);
  }
  
  /// 取消指定页面的所有请求
  void cancelPageRequests(String pageId) {
    _cancelManager.cancelPage(pageId);
  }
  
  /// 取消所有请求
  void cancelAllRequests() {
    _cancelManager.cancelAll();
  }
  
  // ==================== 基础请求方法 ====================
  
  /// GET 请求
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return dio.get<T>(
      path,
      queryParameters: queryParameters,
      options: options,
      cancelToken: cancelToken,
    );
  }
  
  /// POST 请求
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return dio.post<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
      cancelToken: cancelToken,
    );
  }
  
  /// PUT 请求
  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return dio.put<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
      cancelToken: cancelToken,
    );
  }
  
  /// DELETE 请求
  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return dio.delete<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
      cancelToken: cancelToken,
    );
  }
  
  /// 设置 Base URL
  void setBaseUrl(String baseUrl) {
    dio.options.baseUrl = baseUrl;
    Logger.network('CONFIG', 'HTTP Client base URL set to: $baseUrl');
  }
  
  /// 获取当前 Base URL
  String get baseUrl => dio.options.baseUrl;
  
  /// 生成持久化设备ID（基于设备硬件信息）
  Future<String> _generateDeviceId() async {
    try {
      final deviceInfo = DeviceInfoPlugin();
      String identifier = '';
      
      if (Platform.isAndroid) {
        final androidInfo = await deviceInfo.androidInfo;
        // 使用 Android ID（设备唯一标识符）
        identifier = androidInfo.id;
      } else if (Platform.isIOS) {
        final iosInfo = await deviceInfo.iosInfo;
        // 使用 identifierForVendor（应用供应商唯一标识符）
        identifier = iosInfo.identifierForVendor ?? '';
      } else if (Platform.isWindows) {
        final windowsInfo = await deviceInfo.windowsInfo;
        // 使用计算机名和用户名组合
        identifier = '${windowsInfo.computerName}_${windowsInfo.userName}';
      } else if (Platform.isLinux) {
        final linuxInfo = await deviceInfo.linuxInfo;
        // 使用机器ID
        identifier = linuxInfo.machineId ?? '';
      } else if (Platform.isMacOS) {
        final macInfo = await deviceInfo.macOsInfo;
        // 使用系统GUID
        identifier = macInfo.systemGUID ?? '';
      }
      
      // 如果无法获取设备标识，生成随机UUID并持久化
      if (identifier.isEmpty) {
        Logger.warning('[HttpClient] Could not get device identifier, generating random UUID');
        identifier = _generateRandomUUID();
      }
      
      // 对标识符进行哈希处理，确保格式统一
      final bytes = utf8.encode(identifier);
      final digest = sha256.convert(bytes);
      final hash = digest.toString();
      
      // 格式化为UUID格式
      return '${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}';
    } catch (e) {
      Logger.error('[HttpClient] Failed to generate device ID: $e');
      // 降级方案：生成随机UUID
      return _generateRandomUUID();
    }
  }
  
  /// 生成随机UUID（降级方案）
  String _generateRandomUUID() {
    final random = Random.secure();
    final values = List<int>.generate(16, (i) => random.nextInt(256));
    
    // 设置 UUID 版本 (v4) 和变体
    values[6] = (values[6] & 0x0f) | 0x40; // version 4
    values[8] = (values[8] & 0x3f) | 0x80; // variant
    
    // 格式化为 UUID 字符串
    final hex = values.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }

  /// 添加 API 签名到请求头
  /// 
  /// 签名算法：HMAC-SHA256
  /// 签名数据：METHOD&PATH&TIMESTAMP&NONCE
  /// 
  /// 示例：
  /// - Method: GET
  /// - Path: /api/vod/detail
  /// - Timestamp: 1234567890
  /// - Nonce: abc123
  /// - SignData: GET&/api/vod/detail&1234567890&abc123
  /// - Signature: HMAC-SHA256(SignData, SecretKey)
  Future<void> _addApiSignature(RequestOptions options) async {
    try {
      // 生成时间戳（秒）
      final timestamp = (DateTime.now().millisecondsSinceEpoch / 1000).floor().toString();
      
      // 生成随机 nonce（16位随机字符串）
      final random = Random.secure();
      final nonce = List.generate(16, (_) => random.nextInt(36).toRadixString(36)).join();
      
      // 构建签名数据：METHOD&PATH&TIMESTAMP&NONCE
      final method = options.method.toUpperCase();
      final path = options.path;
      final signData = '$method&$path&$timestamp&$nonce';
      
      // 生成 HMAC-SHA256 签名
      final key = utf8.encode(_apiSecretKey);
      final bytes = utf8.encode(signData);
      final hmac = Hmac(sha256, key);
      final digest = hmac.convert(bytes);
      final signature = digest.toString();
      
      // 添加签名相关头部
      options.headers['x-timestamp'] = timestamp;
      options.headers['x-nonce'] = nonce;
      options.headers['x-signature'] = signature;
      options.headers['x-package-name'] = 'com.fetch.video';
      
      Logger.debug('[HttpClient] API Signature added: $signature');
    } catch (e) {
      Logger.error('[HttpClient] Failed to add API signature: $e');
      // 签名失败不影响请求继续
    }
  }

  /// 测试网络连接
  Future<bool> testConnection([String? testUrl]) async {
    try {
      final url = testUrl ?? dio.options.baseUrl;
      Logger.debug('[HttpClient] Testing connection to: $url');
      
      final response = await dio.get(
        '/api/version',
        options: Options(
          sendTimeout: const Duration(seconds: 5),
          receiveTimeout: const Duration(seconds: 5),
        ),
      );
      
      Logger.success('[HttpClient] Connection test successful: ${response.statusCode}');
      return response.statusCode == 200;
    } catch (e) {
      Logger.error('[HttpClient] Connection test failed: $e');
      return false;
    }
  }

  /// 智能切换API地址
  /// 
  /// [silent] 静默模式，不触发错误提示
  Future<String> findWorkingBaseUrl({bool silent = false}) async {
    final urls = [
      'http://localhost:8787',      // USB连接 + ADB端口转发（优先尝试）
      'http://10.0.2.2:8787',       // Android模拟器
      'http://127.0.0.1:8787',      // 本地回环地址
    ];

    for (final url in urls) {
      Logger.debug('[HttpClient] Trying URL: $url');
      try {
        final testDio = Dio(BaseOptions(
          baseUrl: url,
          connectTimeout: const Duration(milliseconds: 1500), // 🚀 减少超时时间
          receiveTimeout: const Duration(milliseconds: 1500),
        ));

        final response = await testDio.get('/api/version');
        if (response.statusCode == 200) {
          Logger.success('[HttpClient] Found working URL: $url');
          return url;
        }
      } catch (e) {
        if (!silent) {
          Logger.error('[HttpClient] URL $url failed: $e');
        }
        continue;
      }
    }

    Logger.warning('[HttpClient] No working URL found, using default');
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
      
      Logger.info('[HttpClient] Retry attempt ${retryCount + 1}/$retries');
      
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
