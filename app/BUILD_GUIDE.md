# 构建指南

## 环境变量配置

应用支持通过环境变量配置 API 地址，避免硬编码。

### 1. 创建环境变量文件

```bash
cp .env.example .env
```

### 2. 编辑 .env 文件

```env
API_BASE_URL=https://your-actual-domain.workers.dev
API_FALLBACK_URLS=https://backup1.com,https://backup2.com
FORCE_DEV_MODE=false
```

### 3. 使用环境变量构建

#### 开发构建（使用本地 API）
```bash
flutter run --dart-define=FORCE_DEV_MODE=true
```

#### 生产构建（使用环境变量）
```bash
flutter build apk \
  --dart-define=API_BASE_URL=https://your-domain.workers.dev \
  --dart-define=API_FALLBACK_URLS=https://backup1.com,https://backup2.com \
  --dart-define=FORCE_DEV_MODE=false
```

#### 使用 .env 文件构建
```bash
# 安装 flutter_dotenv
flutter pub add flutter_dotenv

# 或者使用脚本读取 .env 并传递给 flutter build
```

## 默认行为

- 开发模式：使用 `http://localhost:8787`（需要 ADB 端口转发）
- 生产模式：使用环境变量或默认占位符地址
- 强制开发模式：通过 `FORCE_DEV_MODE=true` 强制使用开发地址

## ADB 端口转发（本地测试）

```bash
adb reverse tcp:8787 tcp:8787
```
