import 'package:get/get.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'logger.dart';

/// 应用信息管理器
/// 
/// 提供应用版本号、构建号等信息的统一访问接口。
/// 使用 GetX 单例模式，确保全局只有一个实例。
/// 
/// ## 使用示例
/// ```dart
/// // 获取版本号
/// final version = AppInfo.to.version;
/// 
/// // 获取完整版本字符串
/// final fullVersion = AppInfo.to.fullVersion; // "1.0.0+1"
/// 
/// // 比较版本号
/// final needUpdate = AppInfo.to.isNewerVersion('1.1.0');
/// ```
class AppInfo extends GetxController {
  static AppInfo get to => Get.find<AppInfo>();
  
  /// 应用版本号 (如 "1.0.0")
  final RxString version = ''.obs;
  
  /// 构建号 (如 "1")
  final RxString buildNumber = ''.obs;
  
  /// 应用名称
  final RxString appName = ''.obs;
  
  /// 包名
  final RxString packageName = ''.obs;
  
  /// 是否已初始化
  final RxBool isInitialized = false.obs;
  
  /// 获取完整版本字符串 (如 "1.0.0+1")
  String get fullVersion => '${version.value}+${buildNumber.value}';
  
  /// 初始化应用信息
  Future<AppInfo> init() async {
    if (isInitialized.value) return this;
    
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      
      version.value = packageInfo.version;
      buildNumber.value = packageInfo.buildNumber;
      appName.value = packageInfo.appName;
      packageName.value = packageInfo.packageName;
      
      isInitialized.value = true;
      
      Logger.info('[AppInfo] Initialized: $fullVersion');
      Logger.info('[AppInfo] App: ${appName.value} (${packageName.value})');
    } catch (e) {
      Logger.error('[AppInfo] Failed to get package info: $e');
      // 使用默认值
      version.value = '1.0.0';
      buildNumber.value = '1';
      isInitialized.value = true;
    }
    
    return this;
  }
  
  /// 比较版本号，判断目标版本是否更新
  /// 
  /// [targetVersion] 目标版本号 (如 "1.1.0")
  /// 返回 true 表示目标版本比当前版本新
  bool isNewerVersion(String targetVersion) {
    try {
      final current = _parseVersion(version.value);
      final target = _parseVersion(targetVersion);
      
      for (int i = 0; i < 3; i++) {
        if (target[i] > current[i]) return true;
        if (target[i] < current[i]) return false;
      }
      
      return false; // 版本相同
    } catch (e) {
      Logger.error('[AppInfo] Version comparison failed: $e');
      return false;
    }
  }
  
  /// 解析版本号为数字数组
  List<int> _parseVersion(String version) {
    final parts = version.split('.');
    return [
      int.tryParse(parts.isNotEmpty ? parts[0] : '0') ?? 0,
      int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0,
      int.tryParse(parts.length > 2 ? parts[2] : '0') ?? 0,
    ];
  }
}
