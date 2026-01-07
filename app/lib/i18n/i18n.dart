/// 国际化模块导出文件
/// 
/// 统一导出国际化相关的所有类和配置
/// 
/// ## 使用示例
/// ```dart
/// import 'package:robin_video/i18n/i18n.dart';
/// 
/// // 在 GetMaterialApp 中配置
/// GetMaterialApp(
///   translations: AppTranslations(),
///   locale: const Locale('zh', 'CN'),
///   fallbackLocale: const Locale('en', 'US'),
/// )
/// 
/// // 在代码中使用
/// Text('app_name'.tr)
/// ```

export 'translations.dart';
export 'zh_CN.dart';
export 'en_US.dart';
