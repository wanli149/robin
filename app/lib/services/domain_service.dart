import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import '../config/api_config.dart';
import '../core/logger.dart';

/// 域名服务
/// 管理 API 域名的获取、缓存、切换
class DomainService {
  static DomainService? _instance;
  static DomainService get instance => _instance ??= DomainService._();
  
  DomainService._();
  
  // 缓存 key
  static const String _cacheKey = 'api_domains_cache';
  static const String _lastUpdateKey = 'api_domains_last_update';
  static const String _currentDomainKey = 'api_current_domain';
  
  // 缓存有效期（小时）
  static const int _cacheHours = 6;
  
  // 域名列表
  List<DomainInfo> _domains = [];
  
  // 当前使用的域名
  String? _currentDomain;
  
  /// 获取当前域名
  String get currentDomain => _currentDomain ?? ApiConfig.baseUrl;
  
  /// 初始化域名服务
  Future<void> init() async {
    // 1. 先从本地缓存加载
    await _loadFromCache();
    
    // 2. 如果有缓存的当前域名，使用它
    final prefs = await SharedPreferences.getInstance();
    _currentDomain = prefs.getString(_currentDomainKey);
    
    // 3. 后台更新域名列表
    _refreshDomainsInBackground();
  }
  
  /// 从缓存加载域名列表
  Future<void> _loadFromCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cached = prefs.getString(_cacheKey);
      
      if (cached != null) {
        final List<dynamic> list = jsonDecode(cached);
        _domains = list.map((e) => DomainInfo.fromJson(e)).toList();
        Logger.info('[Domain] Loaded ${_domains.length} domains from cache');
      }
    } catch (e) {
      Logger.error('[Domain] Failed to load cache: $e');
    }
  }
  
  /// 后台刷新域名列表
  Future<void> _refreshDomainsInBackground() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final lastUpdate = prefs.getInt(_lastUpdateKey) ?? 0;
      final now = DateTime.now().millisecondsSinceEpoch;
      
      // 检查是否需要更新（超过缓存有效期）
      if (now - lastUpdate < _cacheHours * 3600 * 1000 && _domains.isNotEmpty) {
        Logger.info('[Domain] Cache still valid, skip refresh');
        return;
      }
      
      await refreshDomains();
    } catch (e) {
      Logger.error('[Domain] Background refresh failed: $e');
    }
  }
  
  /// 刷新域名列表（从服务器获取）
  Future<void> refreshDomains() async {
    // 尝试从多个来源获取域名列表
    final sources = [
      _currentDomain,
      ApiConfig.baseUrl,
      ...ApiConfig.fallbackUrls,
    ].where((s) => s != null && s.isNotEmpty).toSet();
    
    for (final source in sources) {
      try {
        final dio = Dio(BaseOptions(
          connectTimeout: const Duration(seconds: 5),
          receiveTimeout: const Duration(seconds: 5),
        ));
        
        final response = await dio.get('$source/api/domains');
        
        if (response.statusCode == 200 && response.data['code'] == 1) {
          final List<dynamic> list = response.data['data']['domains'];
          _domains = list.map((e) => DomainInfo.fromJson(e)).toList();
          
          // 保存到缓存
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString(_cacheKey, jsonEncode(list));
          await prefs.setInt(_lastUpdateKey, DateTime.now().millisecondsSinceEpoch);
          
          Logger.success('[Domain] Refreshed ${_domains.length} domains from $source');
          return;
        }
      } catch (e) {
        Logger.warning('[Domain] Failed to fetch from $source: $e');
      }
    }
    
    Logger.error('[Domain] Failed to refresh domains from all sources');
  }
  
  /// 获取可用域名列表
  List<DomainInfo> get domains => List.unmodifiable(_domains);
  
  /// 获取健康的域名列表
  List<DomainInfo> get healthyDomains => 
      _domains.where((d) => d.healthy).toList();
  
  /// 获取主域名
  DomainInfo? get primaryDomain => 
      _domains.firstWhere((d) => d.primary, orElse: () => _domains.isNotEmpty ? _domains.first : DomainInfo.empty());
  
  /// 切换到指定域名
  Future<void> switchTo(String domain) async {
    _currentDomain = domain;
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_currentDomainKey, domain);
    
    Logger.info('[Domain] Switched to: $domain');
  }
  
  /// 自动切换到可用域名
  Future<String?> autoSwitch() async {
    // 按优先级排序：主域名 > 健康域名 > 其他域名
    final candidates = [
      ...healthyDomains.where((d) => d.primary),
      ...healthyDomains.where((d) => !d.primary),
      ..._domains.where((d) => !d.healthy),
    ];
    
    for (final domain in candidates) {
      if (await _testDomain(domain.url)) {
        await switchTo(domain.url);
        return domain.url;
      }
    }
    
    // 如果所有配置的域名都不可用，尝试硬编码的备用域名
    for (final url in ApiConfig.fallbackUrls) {
      if (await _testDomain(url)) {
        await switchTo(url);
        return url;
      }
    }
    
    return null;
  }
  
  /// 测试域名是否可用
  Future<bool> _testDomain(String url) async {
    try {
      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 3),
        receiveTimeout: const Duration(seconds: 3),
      ));
      
      final response = await dio.get('$url/');
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }
  
  /// 测试当前域名是否可用
  Future<bool> testCurrentDomain() async {
    return _testDomain(currentDomain);
  }
}

/// 域名信息
class DomainInfo {
  final String url;
  final String name;
  final bool primary;
  final bool healthy;
  final int responseTime;
  
  DomainInfo({
    required this.url,
    required this.name,
    required this.primary,
    required this.healthy,
    required this.responseTime,
  });
  
  factory DomainInfo.fromJson(Map<String, dynamic> json) {
    return DomainInfo(
      url: json['url'] ?? '',
      name: json['name'] ?? '',
      primary: json['primary'] ?? false,
      healthy: json['healthy'] ?? false,
      responseTime: json['responseTime'] ?? 0,
    );
  }
  
  Map<String, dynamic> toJson() => {
    'url': url,
    'name': name,
    'primary': primary,
    'healthy': healthy,
    'responseTime': responseTime,
  };
  
  factory DomainInfo.empty() => DomainInfo(
    url: '',
    name: '',
    primary: false,
    healthy: false,
    responseTime: 0,
  );
  
  bool get isEmpty => url.isEmpty;
}
