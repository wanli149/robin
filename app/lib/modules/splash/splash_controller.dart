import 'dart:async';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/http_client.dart';
import '../../core/router.dart';
import '../../core/updater.dart';
import '../../core/logger.dart';

/// 启动页控制器
class SplashController extends GetxController {
  final HttpClient _httpClient = HttpClient();

  // 显示加载动画
  final RxBool showLoading = true.obs;

  // 显示广告
  final RxBool showAd = false.obs;

  // 广告图片 URL
  final RxString adImageUrl = ''.obs;

  // 广告跳转链接
  final RxString adActionUrl = ''.obs;

  // 广告倒计时
  final RxInt adCountdown = 5.obs;

  Timer? _countdownTimer;

  @override
  void onInit() {
    super.onInit();
    _startupFlow();
  }

  @override
  void onClose() {
    _countdownTimer?.cancel();
    super.onClose();
  }

  /// 启动流程
  Future<void> _startupFlow() async {
    try {
      // 🚀 并行执行：显示 Logo 的同时请求广告
      final adFuture = _fetchSplashAd();
      
      // 1. 显示 Logo 最少 1 秒
      await Future.delayed(const Duration(milliseconds: 1000));
      
      // 2. 等待广告请求完成（最多再等 1.5 秒）
      await adFuture.timeout(
        const Duration(milliseconds: 1500),
        onTimeout: () {
          Logger.warning('[SplashController] Ad request timeout, skipping');
        },
      );

      // 3. 如果有广告，显示广告；否则直接进入首页
      if (showAd.value) {
        _startAdCountdown();
      } else {
        _navigateToHome();
      }
      
      // 4. 🚀 后台检查更新（不阻塞启动）
      _checkUpdateInBackground();
      
    } catch (e) {
      Logger.error('[SplashController] Startup flow error: $e');
      // 出错也要进入首页
      _navigateToHome();
    }
  }

  /// 🚀 后台检查更新（不阻塞启动）
  void _checkUpdateInBackground() {
    Future.delayed(const Duration(seconds: 2), () async {
      try {
        if (Get.context != null) {
          await Updater.checkUpdate(Get.context!);
        }
      } catch (e) {
        Logger.error('[SplashController] Check update error: $e');
      }
    });
  }

  /// 获取开屏广告
  Future<void> _fetchSplashAd() async {
    try {
      // 检查今日是否已显示过开屏广告
      if (await _hasShownAdToday()) {
        Logger.info('[SplashController] Ad already shown today, skipping');
        return;
      }

      final response = await _httpClient.get('/api/ads/splash');

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;

        if (data['enabled'] == true && data['image_url'] != null) {
          adImageUrl.value = data['image_url'];
          adActionUrl.value = data['action_url'] ?? '';
          adCountdown.value = data['duration'] ?? 5;

          showAd.value = true;
          showLoading.value = false;

          Logger.success('[SplashController] Splash ad loaded');
        }
      }
    } catch (e) {
      Logger.error('[SplashController] Failed to fetch splash ad: $e');
      // 广告加载失败不影响启动
    }
  }

  /// 检查今日是否已显示过广告
  Future<bool> _hasShownAdToday() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final lastShownDate = prefs.getString('last_ad_shown_date');
      final today = DateTime.now().toString().substring(0, 10);

      return lastShownDate == today;
    } catch (e) {
      return false;
    }
  }

  /// 记录今日已显示广告
  Future<void> _markAdShownToday() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final today = DateTime.now().toString().substring(0, 10);
      await prefs.setString('last_ad_shown_date', today);
    } catch (e) {
      Logger.error('[SplashController] Failed to mark ad shown: $e');
    }
  }

  /// 开始广告倒计时
  void _startAdCountdown() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (adCountdown.value > 0) {
        adCountdown.value--;
      } else {
        timer.cancel();
        skipAd();
      }
    });
  }

  /// 跳过广告
  void skipAd() {
    _countdownTimer?.cancel();
    _markAdShownToday();
    _navigateToHome();
  }

  /// 广告点击
  void onAdClick() {
    if (adActionUrl.value.isNotEmpty) {
      _countdownTimer?.cancel();
      _markAdShownToday();

      // 使用通用路由器处理跳转
      UniversalRouter.navigate(adActionUrl.value);

      // 延迟进入首页
      Future.delayed(const Duration(milliseconds: 500), () {
        _navigateToHome();
      });
    }
  }

  /// 跳转到首页
  void _navigateToHome() {
    Get.offAllNamed('/');
  }
}
