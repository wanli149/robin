import 'package:get/get.dart';
import 'http_client.dart';
import 'logger.dart';

/// 全局配置服务
/// 管理应用级别的配置，如广告开关等
class GlobalConfig extends GetxService {
  static GlobalConfig get instance => Get.find<GlobalConfig>();
  
  final HttpClient _httpClient = HttpClient();
  
  // 广告开关
  final RxBool adsEnabled = true.obs;
  
  // 福利区开关
  final RxBool welfareEnabled = false.obs;
  
  // 跑马灯开关
  final RxBool marqueeEnabled = false.obs;
  
  // 热搜开关
  final RxBool hotSearchEnabled = true.obs;
  
  // 是否已加载
  final RxBool isLoaded = false.obs;
  
  @override
  void onInit() {
    super.onInit();
    loadConfig();
  }
  
  /// 加载全局配置
  Future<void> loadConfig() async {
    try {
      final response = await _httpClient.get('/api/config');
      
      if (response.data['code'] == 1) {
        final data = response.data['data'] ?? response.data;
        
        adsEnabled.value = data['ads_enabled'] == true;
        welfareEnabled.value = data['welfare_enabled'] == true;
        marqueeEnabled.value = data['marquee_enabled'] == true;
        hotSearchEnabled.value = data['hot_search_enabled'] == true;
        
        isLoaded.value = true;
        Logger.info('[GlobalConfig] Config loaded: ads=${adsEnabled.value}');
      }
    } catch (e) {
      Logger.error('[GlobalConfig] Failed to load config: $e');
      // 加载失败时使用默认值
      isLoaded.value = true;
    }
  }
  
  /// 刷新配置
  Future<void> refresh() async {
    await loadConfig();
  }
  
  /// 检查广告是否启用
  bool get isAdsEnabled => adsEnabled.value;
}
