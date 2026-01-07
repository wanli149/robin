# 拾光影视 (Fetch) 部署指南

本文档提供完整的生产环境部署流程。

---

## 📋 部署前检查清单

- [ ] 所有本地测试已通过
- [ ] 代码已提交到 Git 仓库
- [ ] 已准备好生产环境配置
- [ ] 已准备好域名和 SSL 证书
- [ ] 已准备好 Cloudflare 账号

---

## 🚀 Phase 1: 后端部署 (Cloudflare Workers)

### 1.1 准备工作

#### 登录 Cloudflare
```bash
npx wrangler login
```

#### 创建生产数据库
```bash
npx wrangler d1 create robin-db
```

**记录输出的数据库 ID**，例如：
```
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

#### 创建 KV 命名空间
```bash
npx wrangler kv:namespace create "ROBIN_CACHE"
```

**记录输出的 KV ID**，例如：
```
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### 1.2 配置 wrangler.toml

更新 `backend/wrangler.toml`：

```toml
name = "robin-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# 生产数据库配置
[[d1_databases]]
binding = "DB"
database_name = "robin-db"
database_id = "你的数据库ID"

# 生产 KV 配置
[[kv_namespaces]]
binding = "ROBIN_CACHE"
id = "你的KV ID"

# 环境变量（生产环境）
[vars]
ENVIRONMENT = "production"

# 密钥（通过命令行设置，不要写在文件里）
# JWT_SECRET
# DINGTALK_WEBHOOK
# ADMIN_SECRET_KEY
```

### 1.3 设置环境变量

```bash
cd backend

# 设置 JWT Secret
npx wrangler secret put JWT_SECRET
# 输入一个强密码，例如：your-super-secret-jwt-key-here

# 设置钉钉 Webhook（可选）
npx wrangler secret put DINGTALK_WEBHOOK
# 输入钉钉机器人 Webhook URL

# 设置 Admin Secret Key
npx wrangler secret put ADMIN_SECRET_KEY
# 输入管理后台密钥，例如：your-admin-secret-key-here
```

### 1.4 初始化生产数据库

```bash
# 应用数据库 Schema
npx wrangler d1 execute robin-db --remote --file=./schema.sql

# 验证表结构
npx wrangler d1 execute robin-db --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### 1.5 部署后端

```bash
# 构建并部署
npx wrangler deploy

# 或使用别名
npx wrangler publish
```

**预期结果**：
```
✨ Successfully published your script to
 https://robin-api.your-subdomain.workers.dev
```

### 1.6 配置自定义域名（可选）

在 Cloudflare Dashboard：
1. 进入 Workers & Pages
2. 选择 `robin-api`
3. 点击 "Settings" > "Triggers"
4. 添加自定义域名，例如：`api.fetch.com`

### 1.7 测试生产 API

```bash
# 测试系统配置
curl https://api.fetch.com/api/config

# 测试版本信息
curl https://api.fetch.com/api/version

# 测试首页布局
curl "https://api.fetch.com/home_layout?tab=featured"
```

---

## 🎨 Phase 2: 管理后台部署 (Cloudflare Pages)

### 2.1 准备工作

#### 更新 API 地址

编辑 `admin/src/config/api.ts`（或相应的配置文件）：

```typescript
export const API_BASE_URL = 'https://api.fetch.com';
```

### 2.2 构建生产版本

```bash
cd admin
npm run build
```

**预期结果**：
- 构建成功
- 输出目录：`dist/`

### 2.3 部署到 Cloudflare Pages

#### 方法 1：通过 Dashboard（推荐）

1. 登录 Cloudflare Dashboard
2. 进入 "Pages"
3. 点击 "Create a project"
4. 选择 "Connect to Git" 或 "Direct Upload"
5. 配置构建设置：
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `admin`
6. 点击 "Save and Deploy"

#### 方法 2：通过 Wrangler CLI

```bash
cd admin

# 安装 Wrangler（如果还没安装）
npm install -g wrangler

# 部署
npx wrangler pages deploy dist --project-name=robin-admin
```

### 2.4 配置自定义域名

在 Cloudflare Pages 项目设置中：
1. 进入 "Custom domains"
2. 添加域名，例如：`admin.fetch.com`
3. 等待 DNS 生效

### 2.5 测试管理后台

1. 访问 `https://admin.fetch.com`
2. 输入 Admin Key 登录
3. 测试所有功能

---

## 📱 Phase 3: 移动应用发布

### 3.1 更新 API 配置

编辑 `app/lib/config/api_config.dart`：

```dart
class ApiConfig {
  // 生产环境 API 地址
  static const String prodBaseUrl = 'https://api.fetch.com';
  
  // 当前使用的 Base URL
  static String get baseUrl => isProduction ? prodBaseUrl : devBaseUrl;
}
```

### 3.2 更新版本号

编辑 `app/pubspec.yaml`：

```yaml
version: 1.0.0+1  # 格式：版本号+构建号
```

编辑 `app/android/app/build.gradle.kts`：

```kotlin
defaultConfig {
    versionCode = 1
    versionName = "1.0.0"
}
```

### 3.3 配置签名（Android）

#### 生成签名密钥

```bash
cd app/android

# 生成密钥库
keytool -genkey -v -keystore fetch-release-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias fetch

# 按提示输入信息
```

#### 创建 key.properties

创建 `app/android/key.properties`：

```properties
storePassword=你的密钥库密码
keyPassword=你的密钥密码
keyAlias=fetch
storeFile=../fetch-release-key.jks
```

**⚠️ 重要**：将 `key.properties` 和 `*.jks` 添加到 `.gitignore`

#### 更新 build.gradle.kts

在 `app/android/app/build.gradle.kts` 中添加：

```kotlin
// 在 android 块之前
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    // ... 其他配置
    
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
        }
    }
}
```

### 3.4 构建 Release 版本

#### Android APK

```bash
cd app

# 构建所有架构的 APK
flutter build apk --release

# 或构建分架构 APK（推荐，包体积更小）
flutter build apk --release --split-per-abi
```

**输出文件**：
- `build/app/outputs/flutter-apk/app-release.apk`
- `build/app/outputs/flutter-apk/app-armeabi-v7a-release.apk`
- `build/app/outputs/flutter-apk/app-arm64-v8a-release.apk`
- `build/app/outputs/flutter-apk/app-x86_64-release.apk`

#### Android App Bundle（用于 Google Play）

```bash
flutter build appbundle --release
```

**输出文件**：
- `build/app/outputs/bundle/release/app-release.aab`

### 3.5 测试 Release 版本

```bash
# 安装到设备
flutter install --release

# 或手动安装
adb install build/app/outputs/flutter-apk/app-release.apk
```

**测试清单**：
- [ ] 应用正常启动
- [ ] 所有功能正常
- [ ] 性能流畅
- [ ] 无崩溃
- [ ] API 连接正常

### 3.6 发布到应用商店

#### Google Play Store

1. 登录 [Google Play Console](https://play.google.com/console)
2. 创建新应用
3. 填写应用信息：
   - 应用名称：拾光影视
   - 简短描述
   - 完整描述
   - 截图（至少 2 张）
   - 应用图标
4. 上传 App Bundle：`app-release.aab`
5. 设置定价和分发
6. 提交审核

#### 第三方应用商店

- 豌豆荚
- 应用宝
- 华为应用市场
- 小米应用商店
- OPPO 软件商店
- vivo 应用商店

每个商店都需要：
- APK 文件
- 应用图标
- 截图
- 应用描述
- 隐私政策

#### 自有渠道

1. 上传 APK 到 CDN 或服务器
2. 生成下载链接
3. 创建下载页面
4. 配置到后端版本管理

---

## 🔧 Phase 4: 配置生产环境

### 4.1 配置系统参数

使用管理后台配置：

#### 版本管理
- 当前版本：1.0.0
- 强制更新最低版本：1.0.0
- 下载链接：https://fetch.com/download
- 更新日志

#### 资源站配置
- 添加视频资源站 API
- 设置权重和优先级
- 配置福利源（可选）

#### 广告配置
- 上传广告素材
- 配置广告位
- 设置投放策略

#### 热搜配置
- 添加热搜关键词

#### 联系方式
- 客服联系方式
- 官方群组链接

#### 永久网址
- 添加备用域名

### 4.2 配置 Cron 任务

短剧抓取任务已在 `wrangler.toml` 中配置：

```toml
[triggers]
crons = ["0 */12 * * *"]  # 每 12 小时执行一次
```

验证 Cron 任务：
```bash
npx wrangler tail
```

---

## 📊 Phase 5: 监控和维护

### 5.1 设置监控

#### Cloudflare Analytics
1. 进入 Workers & Pages
2. 查看 Analytics 面板
3. 监控请求量、错误率

#### 钉钉告警
- 崩溃报告自动发送到钉钉
- 系统错误自动通知

### 5.2 日常维护

#### 数据库维护
```bash
# 查看数据库大小
npx wrangler d1 execute robin-db --remote --command="SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size();"

# 清理过期数据（根据需要）
npx wrangler d1 execute robin-db --remote --command="DELETE FROM daily_stats WHERE date < date('now', '-90 days');"
```

#### 缓存管理
- 定期清理 KV 缓存
- 通过管理后台清除缓存

#### 日志查看
```bash
# 实时查看日志
npx wrangler tail

# 查看特定 Worker 的日志
npx wrangler tail robin-api
```

### 5.3 备份策略

#### 数据库备份
```bash
# 导出数据库
npx wrangler d1 export robin-db --remote --output=backup-$(date +%Y%m%d).sql

# 定期备份（建议每天）
```

#### 配置备份
- 定期导出管理后台配置
- 保存到 Git 仓库

---

## 🔒 安全建议

### 密钥管理
- ✅ 使用强密码
- ✅ 定期更换密钥
- ✅ 不要将密钥提交到 Git
- ✅ 使用环境变量存储密钥

### API 安全
- ✅ 启用 HTTPS
- ✅ 配置 CORS
- ✅ 实施速率限制
- ✅ 验证所有输入

### 应用安全
- ✅ 启用代码混淆
- ✅ 使用签名 APK
- ✅ 实施证书固定（可选）

---

## 📝 部署检查清单

### 后端部署
- [ ] 数据库已创建并初始化
- [ ] KV 命名空间已创建
- [ ] 环境变量已设置
- [ ] Worker 已部署
- [ ] 自定义域名已配置
- [ ] API 测试通过

### 管理后台部署
- [ ] API 地址已更新
- [ ] 构建成功
- [ ] Pages 已部署
- [ ] 自定义域名已配置
- [ ] 功能测试通过

### 移动应用发布
- [ ] API 地址已更新
- [ ] 版本号已更新
- [ ] 签名已配置
- [ ] Release 版本已构建
- [ ] 真机测试通过
- [ ] 应用商店已提交

### 系统配置
- [ ] 版本管理已配置
- [ ] 资源站已配置
- [ ] 广告已配置
- [ ] 热搜已配置
- [ ] 联系方式已配置

### 监控和维护
- [ ] 监控已设置
- [ ] 告警已配置
- [ ] 备份策略已实施

---

## 🎉 部署完成

恭喜！拾光影视 (Fetch) 已成功部署到生产环境。

### 访问地址
- **后端 API**: https://api.fetch.com
- **管理后台**: https://admin.fetch.com
- **移动应用**: 应用商店搜索"拾光影视"

### 下一步
1. 监控系统运行状态
2. 收集用户反馈
3. 持续优化和迭代

---

**部署负责人**: ___________  
**部署日期**: ___________  
**部署版本**: 1.0.0  
**部署环境**: 生产环境
