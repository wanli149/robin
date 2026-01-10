import 'dart:async';
import 'dart:io';
import 'package:get/get.dart';
import 'package:dio/dio.dart';
import '../logger.dart';

/// 网络状态枚举
enum NetworkStatus {
  /// 网络可用
  connected,
  /// 网络不可用
  disconnected,
  /// 网络状态未知
  unknown,
}

/// 网络类型枚举
enum NetworkType {
  /// WiFi 网络
  wifi,
  /// 移动数据网络
  mobile,
  /// 以太网
  ethernet,
  /// 未知网络类型
  unknown,
  /// 无网络
  none,
}

/// 网络管理器
/// 
/// 提供网络状态监控、连接质量检测、智能服务器切换等功能。
/// 
/// ## 核心功能
/// - 网络状态实时监控
/// - 服务器健康检查
/// - 智能 URL 切换
/// - 请求队列管理
/// - 网络质量评估
class NetworkManager extends GetxService {
  static NetworkManager get to => Get.find<NetworkManager>();
  
  // ==================== 状态 ====================
  
  /// 当前网络状态
  final Rx<NetworkStatus> networkStatus = NetworkStatus.unknown.obs;
  
  /// 当前网络类型
  final Rx<NetworkType> networkType = NetworkType.unknown.obs;
  
  /// 当前使用的 API 基础 URL
  final RxString currentBaseUrl = ''.obs;
  
  /// 网络延迟（毫秒）
  final RxInt latency = 0.obs;
  
  /// 是否正在检测网络
  final RxBool isChecking = false.obs;
  
  // ==================== 配置 ====================
  
  /// 可用的 API 服务器列表（按优先级排序）
  final List<ServerConfig> _servers = [
    ServerConfig(
      url: 'http://localhost:8787',
      name: 'USB 连接',
      priority: 1,
      description: 'USB 调试 + ADB 端口转发',
    ),
    ServerConfig(
      url: 'http://10.0.2.2:8787',
      name: 'Android 模拟器',
      priority: 2,
      description: 'Android 模拟器专用地址',
    ),
    ServerConfig(
      url: 'http://127.0.0.1:8787',
      name: '本地回环',
      priority: 3,
      description: '本地开发服务器',
    ),
  ];
  
  /// 服务器健康状态缓存
  final Map<String, ServerHealth> _serverHealthCache = {};
  
  /// 健康检查间隔（秒）
  static const int _healthCheckInterval = 30;
  
  /// 连接超时（毫秒）
  static const int _connectTimeout = 3000;
  
  /// 最大并发请求数
  static const int _maxConcurrentRequests = 6;
  
  // ==================== 内部状态 ====================
  
  Timer? _healthCheckTimer;
  final Dio _testDio = Dio();
  int _activeRequests = 0;
  final List<_PendingRequest> _requestQueue = [];
  
  // ==================== 生命周期 ====================
  
  @override
  void onInit() {
    super.onInit();
    _initTestDio();
    _startHealthCheck();
    Logger.info('[NetworkManager] Initialized');
  }
  
  @override
  void onClose() {
    _healthCheckTimer?.cancel();
    _testDio.close();
    super.onClose();
  }
  
  void _initTestDio() {
    _testDio.options = BaseOptions(
      connectTimeout: const Duration(milliseconds: _connectTimeout),
      receiveTimeout: const Duration(milliseconds: _connectTimeout),
      sendTimeout: const Duration(milliseconds: _connectTimeout),
    );
  }
  
  // ==================== 公共方法 ====================
  
  /// 初始化网络管理器，找到最佳服务器
  Future<String> initialize() async {
    Logger.info('[NetworkManager] Finding best server...');
    isChecking.value = true;
    
    try {
      final bestServer = await _findBestServer();
      currentBaseUrl.value = bestServer;
      networkStatus.value = NetworkStatus.connected;
      Logger.success('[NetworkManager] Using server: $bestServer');
      return bestServer;
    } catch (e) {
      Logger.error('[NetworkManager] Failed to find server: $e');
      networkStatus.value = NetworkStatus.disconnected;
      // 返回默认服务器
      currentBaseUrl.value = _servers.first.url;
      return _servers.first.url;
    } finally {
      isChecking.value = false;
    }
  }
  
  /// 添加自定义服务器
  void addServer(ServerConfig server) {
    // 检查是否已存在
    final existingIndex = _servers.indexWhere((s) => s.url == server.url);
    if (existingIndex >= 0) {
      _servers[existingIndex] = server;
    } else {
      _servers.add(server);
      // 按优先级排序
      _servers.sort((a, b) => a.priority.compareTo(b.priority));
    }
    Logger.info('[NetworkManager] Server added: ${server.name}');
  }
  
  /// 手动切换服务器
  Future<bool> switchServer(String url) async {
    Logger.info('[NetworkManager] Switching to: $url');
    
    final health = await _checkServerHealth(url);
    if (health.isHealthy) {
      currentBaseUrl.value = url;
      latency.value = health.latency;
      Logger.success('[NetworkManager] Switched to: $url (${health.latency}ms)');
      return true;
    }
    
    Logger.error('[NetworkManager] Server unavailable: $url');
    return false;
  }
  
  /// 检查当前网络是否可用
  Future<bool> checkConnectivity() async {
    try {
      final result = await InternetAddress.lookup('google.com');
      final connected = result.isNotEmpty && result[0].rawAddress.isNotEmpty;
      networkStatus.value = connected ? NetworkStatus.connected : NetworkStatus.disconnected;
      return connected;
    } on SocketException catch (_) {
      networkStatus.value = NetworkStatus.disconnected;
      return false;
    }
  }
  
  /// 获取所有服务器的健康状态
  Future<List<ServerHealth>> getAllServerHealth() async {
    final results = <ServerHealth>[];
    
    for (final server in _servers) {
      final health = await _checkServerHealth(server.url);
      results.add(health);
    }
    
    return results;
  }
  
  /// 当网络错误时尝试切换服务器
  Future<String?> onNetworkError() async {
    Logger.warning('[NetworkManager] Network error, trying alternative servers...');
    
    // 标记当前服务器为不健康
    if (currentBaseUrl.value.isNotEmpty) {
      _serverHealthCache[currentBaseUrl.value] = ServerHealth(
        url: currentBaseUrl.value,
        isHealthy: false,
        latency: -1,
        lastCheck: DateTime.now(),
      );
    }
    
    // 尝试找到新的可用服务器
    try {
      final newServer = await _findBestServer(excludeCurrent: true);
      if (newServer != currentBaseUrl.value) {
        currentBaseUrl.value = newServer;
        Logger.success('[NetworkManager] Switched to: $newServer');
        return newServer;
      }
    } catch (e) {
      Logger.error('[NetworkManager] No alternative server available');
    }
    
    return null;
  }
  
  /// 请求队列管理 - 添加请求
  Future<T> enqueueRequest<T>(Future<T> Function() request) async {
    // 如果未达到并发限制，直接执行
    if (_activeRequests < _maxConcurrentRequests) {
      _activeRequests++;
      try {
        return await request();
      } finally {
        _activeRequests--;
        _processQueue();
      }
    }
    
    // 否则加入队列等待
    final completer = Completer<T>();
    _requestQueue.add(_PendingRequest(
      execute: () async {
        try {
          final result = await request();
          completer.complete(result);
        } catch (e) {
          completer.completeError(e);
        }
      },
    ));
    
    return completer.future;
  }
  
  // ==================== 私有方法 ====================
  
  /// 启动定期健康检查
  void _startHealthCheck() {
    _healthCheckTimer = Timer.periodic(
      const Duration(seconds: _healthCheckInterval),
      (_) => _performHealthCheck(),
    );
  }
  
  /// 执行健康检查
  Future<void> _performHealthCheck() async {
    if (currentBaseUrl.value.isEmpty) return;
    
    final health = await _checkServerHealth(currentBaseUrl.value);
    
    if (!health.isHealthy) {
      Logger.warning('[NetworkManager] Current server unhealthy, switching...');
      await onNetworkError();
    } else {
      latency.value = health.latency;
    }
  }
  
  /// 找到最佳服务器
  Future<String> _findBestServer({bool excludeCurrent = false}) async {
    ServerHealth? bestHealth;
    
    for (final server in _servers) {
      if (excludeCurrent && server.url == currentBaseUrl.value) {
        continue;
      }
      
      final health = await _checkServerHealth(server.url);
      
      if (health.isHealthy) {
        if (bestHealth == null || health.latency < bestHealth.latency) {
          bestHealth = health;
        }
      }
    }
    
    if (bestHealth != null) {
      latency.value = bestHealth.latency;
      return bestHealth.url;
    }
    
    throw Exception('No available server');
  }
  
  /// 检查服务器健康状态
  Future<ServerHealth> _checkServerHealth(String url) async {
    // 检查缓存
    final cached = _serverHealthCache[url];
    if (cached != null && 
        DateTime.now().difference(cached.lastCheck).inSeconds < _healthCheckInterval) {
      return cached;
    }
    
    final stopwatch = Stopwatch()..start();
    
    try {
      final response = await _testDio.get(
        '$url/api/version',
        options: Options(
          validateStatus: (status) => status != null && status < 500,
        ),
      );
      
      stopwatch.stop();
      
      final health = ServerHealth(
        url: url,
        isHealthy: response.statusCode == 200,
        latency: stopwatch.elapsedMilliseconds,
        lastCheck: DateTime.now(),
      );
      
      _serverHealthCache[url] = health;
      return health;
    } catch (e) {
      stopwatch.stop();
      
      final health = ServerHealth(
        url: url,
        isHealthy: false,
        latency: -1,
        lastCheck: DateTime.now(),
        error: e.toString(),
      );
      
      _serverHealthCache[url] = health;
      return health;
    }
  }
  
  /// 处理请求队列
  void _processQueue() {
    while (_activeRequests < _maxConcurrentRequests && _requestQueue.isNotEmpty) {
      final pending = _requestQueue.removeAt(0);
      _activeRequests++;
      pending.execute().whenComplete(() {
        _activeRequests--;
        _processQueue();
      });
    }
  }
}

/// 服务器配置
class ServerConfig {
  final String url;
  final String name;
  final int priority;
  final String description;
  
  const ServerConfig({
    required this.url,
    required this.name,
    required this.priority,
    this.description = '',
  });
}

/// 服务器健康状态
class ServerHealth {
  final String url;
  final bool isHealthy;
  final int latency;
  final DateTime lastCheck;
  final String? error;
  
  const ServerHealth({
    required this.url,
    required this.isHealthy,
    required this.latency,
    required this.lastCheck,
    this.error,
  });
}

/// 待处理请求
class _PendingRequest {
  final Future<void> Function() execute;
  
  _PendingRequest({required this.execute});
}
