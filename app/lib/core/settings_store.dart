import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 设置存储服务
class SettingsStore extends GetxService {
  static SettingsStore get to => Get.find<SettingsStore>();
  
  late SharedPreferences _prefs;
  
  // 播放设置
  final RxBool wifiOnlyPlay = false.obs;
  final RxString defaultQuality = 'auto'.obs;
  final RxDouble defaultSpeed = 1.0.obs;
  
  // 通知设置
  final RxBool pushNotification = true.obs;
  final RxBool updateReminder = true.obs;
  
  // 隐私设置
  final RxBool recordHistory = true.obs;
  final RxBool recordSearchHistory = true.obs;
  
  /// 初始化
  Future<SettingsStore> init() async {
    _prefs = await SharedPreferences.getInstance();
    _loadSettings();
    return this;
  }
  
  /// 加载设置
  void _loadSettings() {
    wifiOnlyPlay.value = _prefs.getBool('wifi_only_play') ?? false;
    defaultQuality.value = _prefs.getString('default_quality') ?? 'auto';
    defaultSpeed.value = _prefs.getDouble('default_speed') ?? 1.0;
    pushNotification.value = _prefs.getBool('push_notification') ?? true;
    updateReminder.value = _prefs.getBool('update_reminder') ?? true;
    recordHistory.value = _prefs.getBool('record_history') ?? true;
    recordSearchHistory.value = _prefs.getBool('record_search_history') ?? true;
  }
  
  Future<void> setWifiOnlyPlay(bool value) async {
    wifiOnlyPlay.value = value;
    await _prefs.setBool('wifi_only_play', value);
  }
  
  Future<void> setDefaultQuality(String value) async {
    defaultQuality.value = value;
    await _prefs.setString('default_quality', value);
  }
  
  Future<void> setDefaultSpeed(double value) async {
    defaultSpeed.value = value;
    await _prefs.setDouble('default_speed', value);
  }
  
  Future<void> setPushNotification(bool value) async {
    pushNotification.value = value;
    await _prefs.setBool('push_notification', value);
  }
  
  Future<void> setUpdateReminder(bool value) async {
    updateReminder.value = value;
    await _prefs.setBool('update_reminder', value);
  }
  
  Future<void> setRecordHistory(bool value) async {
    recordHistory.value = value;
    await _prefs.setBool('record_history', value);
  }
  
  Future<void> setRecordSearchHistory(bool value) async {
    recordSearchHistory.value = value;
    await _prefs.setBool('record_search_history', value);
  }
}
