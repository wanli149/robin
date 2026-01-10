# Robin Video APP - Flutter

拾光影视移动端应用

## 技术栈

- Flutter 3.x (SDK ^3.10.0)
- 状态管理：GetX
- 网络请求：Dio
- 视频播放：video_player
- 图片缓存：cached_network_image
- 本地存储：shared_preferences

## 项目结构

```
app/lib/
├── config/       # 配置（API、主题、广告）
├── core/         # 核心服务（HTTP、路由、状态）
├── modules/      # 功能模块（首页、短剧、个人中心）
├── services/     # 业务服务
├── widgets/      # 通用组件
├── i18n/         # 国际化
├── debug/        # 调试工具
└── main.dart     # 入口
```

## 快速开始

```bash
# 安装依赖
flutter pub get

# 运行（开发模式）
flutter run

# 构建 APK
flutter build apk --release

# 构建分架构 APK（推荐）
flutter build apk --release --split-per-abi
```

## 核心依赖

| 依赖 | 用途 |
|------|------|
| get | 状态管理 |
| dio | 网络请求 |
| video_player | 视频播放 |
| cached_network_image | 图片缓存 |
| shared_preferences | 本地存储 |
| webview_flutter | WebView |
| share_plus | 分享功能 |
| qr_flutter | 二维码 |

## 平台要求

- Android: API 21+ (Android 5.0)
- iOS: 12.0+

## 构建问题

如遇到网络问题，参考 [快速构建指南](快速构建指南.md)
