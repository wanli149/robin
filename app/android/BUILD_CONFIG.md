# Android 构建配置说明

## 应用信息

- **应用名称（中文）**: 拾光影视
- **应用名称（英文）**: Fetch
- **包名**: com.fetch.video
- **版本号**: 1.0.0 (versionCode: 1)
- **最低 Android 版本**: Android 5.0 (API 21)

## 已配置权限

### 网络权限
- `INTERNET` - 访问网络
- `ACCESS_NETWORK_STATE` - 检查网络状态

### 存储权限
- `WRITE_EXTERNAL_STORAGE` - 写入外部存储
- `READ_EXTERNAL_STORAGE` - 读取外部存储

### DLNA/WiFi 权限
- `ACCESS_WIFI_STATE` - 访问 WiFi 状态
- `CHANGE_WIFI_MULTICAST_STATE` - 修改 WiFi 组播状态（用于 DLNA 投屏）

## 构建命令

### Debug 构建
```bash
flutter build apk --debug
```

### Release 构建
```bash
flutter build apk --release
```

### 分架构构建（减小包体积）
```bash
# 构建 ARM64 版本（推荐，适用于大多数现代设备）
flutter build apk --release --target-platform android-arm64

# 构建 ARM32 版本（兼容老设备）
flutter build apk --release --target-platform android-arm

# 构建所有架构
flutter build apk --release --split-per-abi
```

### App Bundle（用于 Google Play）
```bash
flutter build appbundle --release
```

## 签名配置

### 生成签名密钥

1. 创建密钥库：
```bash
keytool -genkey -v -keystore fetch-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias fetch
```

2. 创建 `android/key.properties` 文件：
```properties
storePassword=你的密钥库密码
keyPassword=你的密钥密码
keyAlias=fetch
storeFile=../fetch-release-key.jks
```

3. 更新 `android/app/build.gradle.kts`：

在 `android` 块之前添加：
```kotlin
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}
```

在 `android` 块内添加：
```kotlin
signingConfigs {
    create("release") {
        keyAlias = keystoreProperties["keyAlias"] as String
        keyPassword = keystoreProperties["keyPassword"] as String
        storeFile = file(keystoreProperties["storeFile"] as String)
        storePassword = keystoreProperties["storePassword"] as String
    }
}

buildTypes {
    release {
        signingConfig = signingConfigs.getByName("release")
        isMinifyEnabled = true
        isShrinkResources = true
        proguardFiles(
            getDefaultProguardFile("proguard-android-optimize.txt"),
            "proguard-rules.pro"
        )
    }
}
```

## 混淆配置

创建 `android/app/proguard-rules.pro`：
```proguard
# Flutter 相关
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.**  { *; }
-keep class io.flutter.util.**  { *; }
-keep class io.flutter.view.**  { *; }
-keep class io.flutter.**  { *; }
-keep class io.flutter.plugins.**  { *; }

# GetX
-keep class com.get.** { *; }

# Dio
-keep class com.dio.** { *; }

# 保留所有的 native 方法
-keepclasseswithmembernames class * {
    native <methods>;
}
```

## 应用图标

应用图标位于以下目录：
- `android/app/src/main/res/mipmap-hdpi/ic_launcher.png` (72x72)
- `android/app/src/main/res/mipmap-mdpi/ic_launcher.png` (48x48)
- `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` (96x96)
- `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` (144x144)
- `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` (192x192)

### 生成应用图标

使用在线工具或命令行工具生成：
```bash
# 使用 flutter_launcher_icons 包
flutter pub add dev:flutter_launcher_icons

# 在 pubspec.yaml 中配置
flutter_launcher_icons:
  android: true
  ios: false
  image_path: "assets/icon/app_icon.png"

# 生成图标
flutter pub run flutter_launcher_icons
```

## 启动页配置

启动页主题已在 `android/app/src/main/res/values/styles.xml` 中配置。

如需自定义启动页图片，修改：
- `android/app/src/main/res/drawable/launch_background.xml`
- `android/app/src/main/res/drawable-v21/launch_background.xml`

## 测试构建

1. 构建 APK：
```bash
flutter build apk --release
```

2. 安装到设备：
```bash
flutter install
```

3. 或手动安装：
```bash
adb install build/app/outputs/flutter-apk/app-release.apk
```

## 发布检查清单

- [ ] 更新版本号（versionCode 和 versionName）
- [ ] 配置签名密钥
- [ ] 测试 Release 版本
- [ ] 检查权限声明
- [ ] 测试所有功能
- [ ] 检查应用图标和启动页
- [ ] 准备应用商店截图和描述
- [ ] 生成签名的 APK 或 App Bundle

## 常见问题

### 1. 构建失败：找不到 Android SDK
确保已安装 Android SDK 并配置环境变量：
```bash
export ANDROID_HOME=/path/to/android/sdk
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```

### 2. 签名错误
检查 `key.properties` 文件路径和密码是否正确。

### 3. 包体积过大
使用 `--split-per-abi` 参数分架构构建，或启用代码混淆和资源压缩。

### 4. 网络请求失败
确保在 AndroidManifest.xml 中添加了 `android:usesCleartextTraffic="true"`（用于 HTTP 请求）。

## 性能优化建议

1. **启用 R8 代码压缩**（已在 Release 配置中启用）
2. **使用 App Bundle** 而非 APK 发布到 Google Play
3. **分架构构建** 减小单个 APK 大小
4. **移除未使用的资源** 使用 `shrinkResources`
5. **优化图片资源** 使用 WebP 格式

## 输出文件位置

- APK: `build/app/outputs/flutter-apk/app-release.apk`
- App Bundle: `build/app/outputs/bundle/release/app-release.aab`
- 分架构 APK: `build/app/outputs/flutter-apk/app-armeabi-v7a-release.apk` 等
