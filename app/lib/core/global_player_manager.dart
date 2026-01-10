/// 全局播放器管理器 - 兼容性导出文件
///
/// 此文件保留用于向后兼容，实际实现已拆分到 player/ 目录。
/// 新代码请直接导入 'package:robin_video/core/player/player.dart'
///
/// ## 拆分后的文件结构
/// ```
/// lib/core/player/
/// ├── player.dart                    # 统一导出文件
/// ├── player_enums.dart              # 枚举定义
/// ├── player_config.dart             # 配置类
/// ├── player_state.dart              # 状态类
/// ├── global_player_manager.dart     # 主管理器
/// └── mixins/                        # 功能 Mixin
///     ├── player_wakelock_mixin.dart
///     ├── player_fullscreen_mixin.dart
///     ├── player_progress_mixin.dart
///     ├── player_preload_mixin.dart
///     ├── player_pip_mixin.dart
///     └── player_listeners_mixin.dart
/// ```
library;

// 重新导出所有播放器相关类，保持向后兼容
export 'player/player.dart';
