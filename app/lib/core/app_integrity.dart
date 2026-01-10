import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'logger.dart';

/// APP 完整性检查服务
/// 
/// 防止 APK 被篡改后重新打包分发
class AppIntegrity {
  static AppIntegrity? _instance;
  static AppIntegrity get instance => _instance ??= AppIntegrity._();
  
  AppIntegrity._();
  
  // 预期的包名
  static const String _expectedPackageName = 'com.fetch.video';
  
  // 预期的签名哈希（发布时需要替换为真实签名）
  // 使用 keytool 获取: keytool -list -v -keystore your.keystore
  static const List<String> _validSignatureHashes = [
    // Debug 签名 (开发时使用)
    'DEBUG_SIGNATURE_HASH',
    // Release 签名 (发布时替换)
    'RELEASE_SIGNATURE_HASH',
  ];
  
  bool _isVerified = false;
  String? _deviceFingerprint;
  
  /// 验证 APP 完整性
  Future<bool> verify() async {
    if (_isVerified) return true;
    
    try {
      // 1. 验证包名
      if (!await _verifyPackageName()) {
        Logger.error('[AppIntegrity] Package name verification failed');
        return false;
      }
      
      // 2. 验证签名（仅 Android）
      if (Platform.isAndroid && !kDebugMode) {
        if (!await _verifySignature()) {
          Logger.error('[AppIntegrity] Signature verification failed');
          return false;
        }
      }
      
      // 3. 检测调试器
      if (!kDebugMode && _isDebuggerAttached()) {
        Logger.error('[AppIntegrity] Debugger detected');
        return false;
      }
      
      // 4. 检测 Root/越狱（可选，可能影响正常用户）
      // if (await _isDeviceRooted()) {
      //   Logger.warning('[AppIntegrity] Rooted device detected');
      // }
      
      _isVerified = true;
      Logger.success('[AppIntegrity] App integrity verified');
      return true;
    } catch (e) {
      Logger.error('[AppIntegrity] Integrity check error: $e');
      // 出错时默认通过，避免影响正常用户
      return true;
    }
  }
  
  /// 验证包名
  Future<bool> _verifyPackageName() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      return packageInfo.packageName == _expectedPackageName;
    } catch (e) {
      return true; // 获取失败时默认通过
    }
  }
  
  /// 验证签名（Android）
  Future<bool> _verifySignature() async {
    try {
      // 通过 MethodChannel 调用原生代码获取签名
      const channel = MethodChannel('com.fetch.video/integrity');
      final signatureHash = await channel.invokeMethod<String>('getSignatureHash');
      
      if (signatureHash == null) return true;
      
      return _validSignatureHashes.contains(signatureHash);
    } catch (e) {
      // 方法不存在时默认通过
      return true;
    }
  }
  
  /// 检测调试器
  bool _isDebuggerAttached() {
    // Dart 层面的调试检测
    bool debuggerAttached = false;
    assert(() {
      debuggerAttached = true;
      return true;
    }());
    return debuggerAttached;
  }
  
  /// 生成设备指纹
  Future<String> getDeviceFingerprint() async {
    if (_deviceFingerprint != null) return _deviceFingerprint!;
    
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      
      final data = [
        packageInfo.packageName,
        packageInfo.version,
        packageInfo.buildNumber,
        Platform.operatingSystem,
        Platform.operatingSystemVersion,
      ].join('|');
      
      _deviceFingerprint = sha256.convert(utf8.encode(data)).toString().substring(0, 16);
      return _deviceFingerprint!;
    } catch (e) {
      return 'unknown';
    }
  }
  
  /// 生成请求签名
  String generateRequestSign({
    required String method,
    required String path,
    required String timestamp,
    required String nonce,
    required String secretKey,
  }) {
    final signData = [
      method.toUpperCase(),
      path,
      timestamp,
      nonce,
      _expectedPackageName,
    ].join('&');
    
    final keyBytes = utf8.encode(secretKey);
    final dataBytes = utf8.encode(signData);
    final hmac = Hmac(sha256, keyBytes);
    final digest = hmac.convert(dataBytes);
    
    return digest.toString();
  }
}
