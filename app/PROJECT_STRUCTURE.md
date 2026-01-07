# 拾光影视 Mobile APP 项目结构

## 目录结构

```
app/
├── lib/
│   ├── config/          # 配置文件（主题、API、广告等）
│   ├── core/            # 核心服务（HTTP客户端、路由、状态管理等）
│   ├── modules/         # 功能模块（首页、短剧、个人中心等）
│   ├── widgets/         # 通用组件（播放器、图片代理等）
│   └── main.dart        # 应用入口
├── assets/
│   ├── images/          # 图片资源（默认头像、占位图等）
│   └── logo/            # Logo 资源
├── android/             # Android 平台配置
├── ios/                 # iOS 平台配置
└── pubspec.yaml         # 依赖配置
```

## 技术栈

- **状态管理**: GetX
- **网络请求**: Dio
- **视频播放**: MediaKit
- **图片缓存**: CachedNetworkImage
- **本地存储**: SharedPreferences
- **WebView**: webview_flutter
- **分享功能**: share_plus
- **二维码**: qr_flutter
- **URL启动**: url_launcher

## 配置说明

### Android
- 最低版本: Android 5.0 (API 21)
- 权限: 网络、存储、WiFi（用于DLNA投屏）

### iOS
- 最低版本: iOS 12.0

## 依赖安装位置

所有 Flutter 依赖已配置安装到 I 盘：
- PUB_CACHE: `I:\.pub-cache`

## 开发命令

```bash
# 安装依赖
flutter pub get

# 运行应用（开发模式）
flutter run

# 构建 Android APK
flutter build apk --release

# 构建 iOS IPA
flutter build ios --release
```


