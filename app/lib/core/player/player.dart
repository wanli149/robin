/// 播放器模块导出文件
/// 
/// 统一导出播放器相关的所有类和枚举，
/// 使用时只需导入此文件即可。
/// 
/// ## 使用示例
/// ```dart
/// import 'package:robin_video/core/player/player.dart';
/// 
/// // 使用播放器管理器
/// GlobalPlayerManager.to.play();
/// 
/// // 使用配置
/// final config = PlayerConfig.tvWindow();
/// 
/// // 使用枚举
/// if (state.contentType == ContentType.tv) { ... }
/// ```

// 枚举定义
export 'player_enums.dart';

// 配置类
export 'player_config.dart';

// 状态类
export 'player_state.dart';

// 主管理器
export 'global_player_manager.dart';

// Mixins（通常不需要直接导入，但提供导出以便扩展）
export 'mixins/player_wakelock_mixin.dart';
export 'mixins/player_fullscreen_mixin.dart';
export 'mixins/player_progress_mixin.dart';
export 'mixins/player_preload_mixin.dart';
export 'mixins/player_pip_mixin.dart';
export 'mixins/player_listeners_mixin.dart';
