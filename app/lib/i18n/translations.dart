import 'dart:ui';
import 'package:get/get.dart';
import 'zh_CN.dart';
import 'en_US.dart';

/// 应用国际化翻译配置
/// 
/// 支持的语言：
/// - 简体中文 (zh_CN) - 默认语言
/// - 英语 (en_US) - 备用语言
/// 
/// ## 使用方式
/// 
/// ### 1. 在 GetMaterialApp 中配置
/// ```dart
/// GetMaterialApp(
///   translations: AppTranslations(),
///   locale: const Locale('zh', 'CN'),
///   fallbackLocale: const Locale('en', 'US'),
/// )
/// ```
/// 
/// ### 2. 在代码中使用
/// ```dart
/// // 使用 .tr 扩展方法
/// Text('app_name'.tr)
/// 
/// // 带参数的翻译
/// Text('welcome_user'.trParams({'name': 'John'}))
/// ```
/// 
/// ### 3. 切换语言
/// ```dart
/// Get.updateLocale(const Locale('en', 'US'));
/// ```
class AppTranslations extends Translations {
  @override
  Map<String, Map<String, String>> get keys => {
    'zh_CN': zhCN,
    'en_US': enUS,
  };
}

/// 语言工具类
class LanguageUtils {
  /// 支持的语言列表
  static const List<Map<String, dynamic>> supportedLanguages = [
    {'code': 'zh_CN', 'name': '简体中文', 'locale': Locale('zh', 'CN')},
    {'code': 'en_US', 'name': 'English', 'locale': Locale('en', 'US')},
  ];

  /// 获取当前语言代码
  static String get currentLanguageCode {
    final locale = Get.locale;
    if (locale == null) return 'zh_CN';
    return '${locale.languageCode}_${locale.countryCode}';
  }

  /// 切换语言
  static void changeLanguage(String languageCode) {
    final parts = languageCode.split('_');
    if (parts.length == 2) {
      Get.updateLocale(Locale(parts[0], parts[1]));
    }
  }

  /// 获取语言名称
  static String getLanguageName(String code) {
    final lang = supportedLanguages.firstWhere(
      (l) => l['code'] == code,
      orElse: () => {'name': code},
    );
    return lang['name'] as String;
  }
}
