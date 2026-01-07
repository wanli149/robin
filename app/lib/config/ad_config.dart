import 'package:shared_preferences/shared_preferences.dart';
import 'package:get/get.dart';
import '../core/http_client.dart';

/// 广告配置
/// 定义各个广告位的ID、展示策略和频次限制
class AdConfig {
  // 私有构造函数，防止实例化
  AdConfig._();

  // ==================== 广告位 ID ====================

  /// 开屏广告位
  static const String splashAdLocation = 'splash';

  /// 首页横幅广告位
  static const String homeBannerLocation = 'banner_home';

  /// 片库横幅广告位
  static const String libraryBannerLocation = 'banner_library';

  /// 搜索结果横幅广告位
  static const String searchBannerLocation = 'banner_search';

  /// 网格插入广告位
  static const String gridInsertLocation = 'insert_grid';

  /// 短剧插播广告位
  static const String shortsInsertLocation = 'shorts_insert';

  /// 暂停贴片广告位
  static const String pauseOverlayLocation = 'pause_overlay';

  /// 视频详情页广告位
  static const String detailBannerLocation = 'banner_detail';

  // ==================== 广告展示策略 ====================

  /// 开屏广告展示时长（秒）
  static const int splashAdDuration = 5;

  /// 开屏广告倒计时（秒）
  static const int splashAdCountdown = 5;

  /// 开屏广告每日展示次数限制
  static const int splashAdDailyLimit = 3;

  /// 短剧插播频率（每滑动 N 个视频插入一次广告）
  static const int shortsInsertFrequency = 5;

  /// 网格广告插入位置（第几个位置插入）
  static const int gridInsertIndex = 4;

  /// 暂停广告展示延迟（毫秒）
  static const int pauseAdDelay = 1000;

  // ==================== 广告频次控制 ====================

  /// SharedPreferences 键名前缀
  static const String _prefixAdCount = 'ad_count_';
  static const String _prefixAdDate = 'ad_date_';

  /// 检查是否可以展示广告
  static Future<bool> canShowAd(String location, {int? dailyLimit}) async {
    if (dailyLimit == null) return true;

    final prefs = await SharedPreferences.getInstance();
    final today = DateTime.now().toIso8601String().split('T')[0];
    final lastDate = prefs.getString('$_prefixAdDate$location');
    final count = prefs.getInt('$_prefixAdCount$location') ?? 0;

    // 如果是新的一天，重置计数
    if (lastDate != today) {
      await prefs.setString('$_prefixAdDate$location', today);
      await prefs.setInt('$_prefixAdCount$location', 0);
      return true;
    }

    // 检查是否超过每日限制
    return count < dailyLimit;
  }

  /// 记录广告展示
  static Future<void> recordAdShow(String location) async {
    final prefs = await SharedPreferences.getInstance();
    final today = DateTime.now().toIso8601String().split('T')[0];
    final lastDate = prefs.getString('$_prefixAdDate$location');
    final count = prefs.getInt('$_prefixAdCount$location') ?? 0;

    // 如果是新的一天，重置计数
    if (lastDate != today) {
      await prefs.setString('$_prefixAdDate$location', today);
      await prefs.setInt('$_prefixAdCount$location', 1);
    } else {
      await prefs.setInt('$_prefixAdCount$location', count + 1);
    }
  }

  /// 获取今日已展示次数
  static Future<int> getTodayAdCount(String location) async {
    final prefs = await SharedPreferences.getInstance();
    final today = DateTime.now().toIso8601String().split('T')[0];
    final lastDate = prefs.getString('$_prefixAdDate$location');

    // 如果不是今天的数据，返回 0
    if (lastDate != today) {
      return 0;
    }

    return prefs.getInt('$_prefixAdCount$location') ?? 0;
  }

  /// 重置广告计数（用于测试）
  static Future<void> resetAdCount(String location) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('$_prefixAdDate$location');
    await prefs.remove('$_prefixAdCount$location');
  }

  /// 重置所有广告计数
  static Future<void> resetAllAdCounts() async {
    final prefs = await SharedPreferences.getInstance();
    final keys = prefs.getKeys();
    for (final key in keys) {
      if (key.startsWith(_prefixAdCount) || key.startsWith(_prefixAdDate)) {
        await prefs.remove(key);
      }
    }
  }

  // ==================== 广告开关 ====================

  /// 全局广告开关键名
  static const String _keyGlobalAdSwitch = 'global_ad_switch';

  /// 获取全局广告开关状态
  static Future<bool> isAdEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyGlobalAdSwitch) ?? true;
  }

  /// 设置全局广告开关
  static Future<void> setAdEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyGlobalAdSwitch, enabled);
  }

  // ==================== VIP 用户检测 ====================

  /// 检查用户是否为 VIP（VIP 用户不展示广告）
  static bool isVipUser = false;

  /// 设置 VIP 状态
  static void setVipStatus(bool isVip) {
    isVipUser = isVip;
  }

  /// 是否应该展示广告（综合判断）
  static Future<bool> shouldShowAd(String location, {int? dailyLimit}) async {
    // VIP 用户不展示广告
    if (isVipUser) return false;

    // 检查全局开关
    if (!await isAdEnabled()) return false;

    // 检查频次限制
    if (dailyLimit != null) {
      return await canShowAd(location, dailyLimit: dailyLimit);
    }

    return true;
  }

  // ==================== 广告点击统计 ====================

  /// 记录广告点击
  static Future<void> recordAdClick(String location, int adId) async {
    try {
      final httpClient = Get.find<HttpClient>();
      await httpClient.post(
        '/api/ads/stats',
        data: {
          'ad_id': adId,
          'location': location,
          'event_type': 'click',
        },
      );
      print('📊 Ad clicked: location=$location, adId=$adId');
    } catch (e) {
      print('❌ Failed to record ad click: $e');
    }
  }

  /// 记录广告曝光
  static Future<void> recordAdImpression(String location, int adId) async {
    try {
      final httpClient = Get.find<HttpClient>();
      await httpClient.post(
        '/api/ads/stats',
        data: {
          'ad_id': adId,
          'location': location,
          'event_type': 'impression',
        },
      );
      print('📊 Ad impression: location=$location, adId=$adId');
    } catch (e) {
      print('❌ Failed to record ad impression: $e');
    }
  }
}
