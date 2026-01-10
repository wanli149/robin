import 'package:media_kit/media_kit.dart';
import '../logger.dart';

/// Media Kit 初始化器
/// 
/// 负责在应用启动时初始化 media_kit 库。
/// 必须在 runApp() 之前调用 [initialize]。
class MediaKitInitializer {
  static bool _initialized = false;
  
  /// 初始化 media_kit
  /// 
  /// 必须在 main() 函数中、runApp() 之前调用。
  /// 
  /// ```dart
  /// void main() {
  ///   WidgetsFlutterBinding.ensureInitialized();
  ///   MediaKitInitializer.initialize();
  ///   runApp(MyApp());
  /// }
  /// ```
  static void initialize() {
    if (_initialized) return;
    
    MediaKit.ensureInitialized();
    _initialized = true;
    
    Logger.success('[MediaKit] Initialized');
  }
  
  /// 检查是否已初始化
  static bool get isInitialized => _initialized;
}
