import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'widgets/hero_carousel.dart';
import 'widgets/grid_menu.dart';
import 'widgets/mixed_grid.dart';
import 'widgets/time_tree.dart';
import 'widgets/week_timeline.dart';
import 'widgets/continue_watching.dart';
import 'widgets/horizontal_scroll.dart';
import 'widgets/vertical_list.dart';
import 'widgets/banner.dart' as app_banner;
import 'widgets/notice.dart';
import 'widgets/ranking.dart';
import 'widgets/category_tabs.dart';
import 'widgets/actor_list.dart';
import 'widgets/topic_list.dart';
import 'widgets/article_list.dart';
import 'widgets/recommend_list.dart';
import '../../core/logger.dart';

/// 动态渲染引擎
/// 
/// 根据后端返回的 module_type 动态渲染对应的 UI 组件。
/// 这是首页模块化设计的核心，支持后端驱动 UI 布局。
/// 
/// ## 支持的模块类型
/// | module_type | 组件 | 说明 |
/// |-------------|------|------|
/// | carousel | HeroCarousel | 轮播图 |
/// | grid_icons | GridMenu | 金刚区（快捷入口） |
/// | grid_3x2/3x3 | MixedGrid | 混合网格 |
/// | horizontal_scroll | HorizontalScroll | 横向滚动列表 |
/// | vertical_list | VerticalList | 竖向列表 |
/// | ranking | Ranking | 排行榜 |
/// | continue_watching | ContinueWatching | 继续观看 |
/// | week_timeline | WeekTimeline | 周更时间轴 |
/// | category_tabs | CategoryTabs | 分类标签页 |
/// | actor_list | ActorList | 演员列表 |
/// | topic_list | TopicList | 专题列表 |
/// | banner | Banner | 横幅广告 |
/// | notice | Notice | 公告 |
/// | login_prompt | - | 登录提示 |
/// | waterfall | MixedGrid | 瀑布流 |
/// | timeline | TimeTree | 时间树 |
/// 
/// ## 数据格式
/// 每个模块的数据结构：
/// ```json
/// {
///   "id": "module_1",
///   "module_type": "carousel",
///   "title": "热门推荐",
///   "sort_order": 1,
///   "data": [...],
///   "api_params": {...},
///   "ad_config": {...}
/// }
/// ```
/// 
/// ## 使用示例
/// ```dart
/// // 渲染单个模块
/// Widget widget = DynamicRenderer.renderModule(moduleData);
/// 
/// // 验证模块数据
/// if (DynamicRenderer.validateModule(moduleData)) {
///   // 数据有效
/// }
/// ```
/// 
/// ## 扩展新模块
/// 1. 在 renderModule 的 switch 中添加新的 case
/// 2. 创建对应的 _build 方法
/// 3. 在 widgets/ 目录下创建组件文件
class DynamicRenderer {
  /// 渲染模块
  static Widget renderModule(Map<String, dynamic> module) {
    final moduleType = module['module_type'] as String?;
    
    if (moduleType == null) {
      return _buildErrorWidget('模块类型缺失');
    }
    
    try {
      switch (moduleType) {
        case 'carousel':
          return _buildCarousel(module);
        
        case 'grid_icons':
          return _buildGridIcons(module);
        
        case 'grid_3x2':
        case 'grid_3x2_ad':
        case 'grid_3x3':
        case 'grid_3x3_ad':
          return _buildMixedGrid(module);
        
        case 'waterfall':
        case 'waterfall_2col':
        case 'waterfall_3col':
          return _buildWaterfall(module);
        
        case 'timeline':
          return _buildTimeline(module);
        
        case 'week_timeline':
          return _buildWeekTimeline(module);
        
        case 'continue_watching':
          return _buildContinueWatching(module);
        
        case 'login_prompt':
          return _buildLoginPrompt(module);
        
        case 'horizontal_scroll':
          return _buildHorizontalScroll(module);
        
        case 'vertical_list':
          return _buildVerticalList(module);
        
        case 'banner':
          return _buildBanner(module);
        
        case 'notice':
          return _buildNotice(module);
        
        case 'ranking':
          return _buildRanking(module);
        
        case 'category_tabs':
          return _buildCategoryTabs(module);
        
        case 'actor_list':
          return _buildActorList(module);
        
        case 'topic_list':
          return _buildTopicList(module);
        
        case 'article_list':
          return _buildArticleList(module);
        
        case 'recommend':
        case 'recommend_similar':
        case 'recommend_trending':
        case 'recommend_personalized':
          return _buildRecommend(module);
        
        default:
          return _buildUnsupportedWidget(moduleType);
      }
    } catch (e) {
      Logger.error('[DynamicRenderer] Error rendering module: $e');
      return _buildErrorWidget('渲染失败: $e');
    }
  }
  
  /// 构建轮播图组件
  static Widget _buildCarousel(Map<String, dynamic> module) {
    final data = module['data'];
    
    Logger.debug('[Carousel] Raw data type: ${data.runtimeType}');
    
    // 解析轮播图数据
    List<Map<String, dynamic>> rawItems = [];
    if (data is List) {
      rawItems = data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } else if (data is Map) {
      // 如果 data 是对象，尝试提取 items 字段
      final itemsList = data['items'];
      if (itemsList is List) {
        rawItems = itemsList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    }
    
    Logger.debug('[Carousel] Parsed items count: ${rawItems.length}');
    
    if (rawItems.isEmpty) {
      return _buildPlaceholder(
        module: module,
        icon: Icons.view_carousel,
        description: '轮播图数据为空 (data type: ${data.runtimeType})',
      );
    }
    
    // 转换字段名，兼容后端返回的 vod_* 字段
    final items = rawItems.map((item) {
      return {
        ...item,
        // 图片URL：优先使用 image_url，其次 vod_pic_slide，再次 vod_pic
        'image_url': item['image_url'] ?? item['vod_pic_slide'] ?? item['vod_pic'] ?? '',
        // 标题：优先使用 title，其次 vod_name
        'title': item['title'] ?? item['vod_name'] ?? '',
        // 跳转动作：优先使用 jump_action，其次构造 video:// 链接
        'jump_action': item['jump_action'] ?? 
            (item['vod_id'] != null ? 'video://${item['vod_id']}' : ''),
      };
    }).toList();
    
    // 从 api_params 获取配置
    final apiParams = module['api_params'] as Map<String, dynamic>? ?? {};
    final height = (apiParams['height'] as num?)?.toDouble() ?? 220.0;
    final autoPlaySeconds = (apiParams['auto_play_seconds'] as num?)?.toInt() ?? 5;
    
    return HeroCarousel(
      items: items,
      height: height,
      aspectRatio: 16 / 9, // 16:9 宽高比
      autoPlay: true,
      autoPlayDuration: Duration(seconds: autoPlaySeconds),
    );
  }
  
  /// 构建金刚区组件
  static Widget _buildGridIcons(Map<String, dynamic> module) {
    final data = module['data'];
    
    Logger.debug('[GridIcons] Raw data type: ${data.runtimeType}');
    Logger.debug('[GridIcons] Raw data: $data');
    
    // 金刚区使用 api_params 中的配置，不需要从后端获取数据
    final apiParamsRaw = module['api_params'];
    final apiParams = apiParamsRaw != null 
        ? Map<String, dynamic>.from(apiParamsRaw as Map)
        : null;
    
    // 解析金刚区数据
    List<Map<String, dynamic>> items = [];
    
    // 优先使用 api_params 中的 items
    if (apiParams != null && apiParams['items'] is List) {
      items = (apiParams['items'] as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    } else if (data is List) {
      items = data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } else if (data is Map) {
      // 如果 data 是对象，尝试提取 items 字段
      final itemsList = data['items'];
      if (itemsList is List) {
        items = itemsList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    }
    
    Logger.debug('[GridIcons] Parsed items count: ${items.length}');
    
    if (items.isEmpty) {
      return _buildPlaceholder(
        module: module,
        icon: Icons.grid_view,
        description: '金刚区数据为空 (请在管理后台配置金刚区项目)',
      );
    }
    
    return GridMenu(
      items: items,
      crossAxisCount: 5,
      itemHeight: 80,
    );
  }
  
  /// 构建混合网格组件
  static Widget _buildMixedGrid(Map<String, dynamic> module) {
    final title = module['title'] as String? ?? '';
    final data = module['data'];
    final adConfigRaw = module['ad_config'];
    final adConfig = adConfigRaw != null 
        ? Map<String, dynamic>.from(adConfigRaw as Map)
        : null;
    
    Logger.debug('[MixedGrid] Title: $title');
    Logger.debug('[MixedGrid] Raw data type: ${data.runtimeType}');
    Logger.debug('[MixedGrid] Raw data: $data');
    
    // 解析视频列表数据
    List<Map<String, dynamic>> items = [];
    if (data is List) {
      items = data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } else if (data is Map) {
      // 如果 data 是对象，尝试提取 items 字段
      final itemsList = data['items'];
      if (itemsList is List) {
        items = itemsList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    }
    
    Logger.debug('[MixedGrid] Parsed items count: ${items.length}');
    
    if (items.isEmpty) {
      return _buildPlaceholder(
        module: module,
        icon: Icons.grid_on,
        description: '混合网格数据为空 (data type: ${data.runtimeType})',
      );
    }
    
    return MixedGrid(
      title: title,
      items: items,
      adConfig: adConfig,
      crossAxisCount: 3,
    );
  }
  
  /// 构建时间树组件
  static Widget _buildTimeline(Map<String, dynamic> module) {
    final title = module['title'] as String? ?? '';
    final data = module['data'];
    
    // 解析时间树数据
    List<Map<String, dynamic>> items = [];
    if (data is List) {
      items = data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } else if (data is Map) {
      // 如果 data 是对象，尝试提取 items 字段
      final itemsList = data['items'];
      if (itemsList is List) {
        items = itemsList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    }
    
    if (items.isEmpty) {
      return _buildPlaceholder(
        module: module,
        icon: Icons.timeline,
        description: '时间树数据为空',
      );
    }
    
    return TimeTree(
      title: title,
      items: items,
    );
  }
  
  /// 构建周时间轴组件
  static Widget _buildWeekTimeline(Map<String, dynamic> module) {
    final title = module['title'] as String? ?? '';
    final data = module['data'];
    
    // 解析周时间轴数据（按星期分组）
    Map<String, dynamic> schedule = {};
    if (data is Map) {
      schedule = Map<String, dynamic>.from(data);
    }
    
    if (schedule.isEmpty) {
      return _buildPlaceholder(
        module: module,
        icon: Icons.calendar_view_week,
        description: '周时间轴数据为空',
      );
    }
    
    return WeekTimeline(
      title: title,
      schedule: schedule,
    );
  }
  
  /// 构建继续观看组件
  static Widget _buildContinueWatching(Map<String, dynamic> module) {
    final data = module['data'];
    
    // 解析观看历史数据
    List<Map<String, dynamic>> items = [];
    if (data is List) {
      items = data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } else if (data is Map) {
      // 如果 data 是对象，尝试提取 items 字段
      final itemsList = data['items'];
      if (itemsList is List) {
        items = itemsList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    }
    
    // 如果没有观看历史，不显示该模块
    if (items.isEmpty) {
      return const SizedBox.shrink();
    }
    
    return ContinueWatching(items: items);
  }

  /// 构建登录提示组件
  static Widget _buildLoginPrompt(Map<String, dynamic> module) {
    final data = module['data'] as Map<String, dynamic>? ?? {};
    final message = data['message'] as String? ?? '登录后可查看个性化推荐、观看历史等更多内容';
    final loginText = data['login_text'] as String? ?? '立即登录';
    final registerText = data['register_text'] as String? ?? '注册账号';

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            const Color(0xFFFFC107).withValues(alpha: 0.1),
            const Color(0xFFFFC107).withValues(alpha: 0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFFFFC107).withValues(alpha: 0.3),
          width: 1,
        ),
      ),
      child: Column(
        children: [
          // 图标和标题
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFC107),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.account_circle,
                  color: Colors.black,
                  size: 32,
                ),
              ),
              const SizedBox(width: 16),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '登录获取更多内容',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      '解锁个性化体验',
                      style: TextStyle(
                        fontSize: 14,
                        color: Color(0xFFFFC107),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 16),
          
          // 描述文本
          Text(
            message,
            style: const TextStyle(
              fontSize: 14,
              color: Colors.white70,
              height: 1.5,
            ),
          ),
          
          const SizedBox(height: 20),
          
          // 按钮行
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    Get.toNamed('/login');
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFFC107),
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: Text(
                    loginText,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    Get.toNamed('/register');
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFFFC107),
                    side: const BorderSide(
                      color: Color(0xFFFFC107),
                      width: 1,
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: Text(
                    registerText,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
  
  /// 构建横向滚动组件
  static Widget _buildHorizontalScroll(Map<String, dynamic> module) {
    final title = module['title'] as String? ?? '';
    final data = module['data'];
    final apiParamsRaw = module['api_params'];
    final apiParams = apiParamsRaw != null 
        ? Map<String, dynamic>.from(apiParamsRaw as Map)
        : null;
    
    Logger.debug('[HorizontalScroll] Title: $title');
    Logger.debug('[HorizontalScroll] Raw data type: ${data.runtimeType}');
    
    // 解析视频列表数据
    List<Map<String, dynamic>> items = [];
    if (data is List) {
      items = data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } else if (data is Map) {
      final itemsList = data['items'];
      if (itemsList is List) {
        items = itemsList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    }
    
    Logger.debug('[HorizontalScroll] Parsed items count: ${items.length}');
    
    if (items.isEmpty) {
      return _buildPlaceholder(
        module: module,
        icon: Icons.view_column,
        description: '横向滚动数据为空',
      );
    }
    
    // 从 api_params 获取配置
    final itemWidth = (apiParams?['item_width'] as num?)?.toDouble() ?? 120.0;
    final itemHeight = (apiParams?['item_height'] as num?)?.toDouble() ?? 180.0;
    final moreRoute = apiParams?['more_route'] as String?;
    
    return HorizontalScroll(
      title: title,
      items: items,
      itemWidth: itemWidth,
      itemHeight: itemHeight,
      moreRoute: moreRoute,
    );
  }
  
  /// 构建竖向列表组件
  static Widget _buildVerticalList(Map<String, dynamic> module) {
    final title = module['title'] as String? ?? '';
    final data = module['data'];
    final apiParamsRaw = module['api_params'];
    final apiParams = apiParamsRaw != null 
        ? Map<String, dynamic>.from(apiParamsRaw as Map)
        : null;
    
    Logger.debug('[VerticalList] Title: $title');
    Logger.debug('[VerticalList] Raw data type: ${data.runtimeType}');
    
    // 解析视频列表数据
    List<Map<String, dynamic>> items = [];
    if (data is List) {
      items = data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } else if (data is Map) {
      final itemsList = data['items'];
      if (itemsList is List) {
        items = itemsList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    }
    
    Logger.debug('[VerticalList] Parsed items count: ${items.length}');
    
    if (items.isEmpty) {
      return _buildPlaceholder(
        module: module,
        icon: Icons.view_list,
        description: '竖向列表数据为空',
      );
    }
    
    final moreRoute = apiParams?['more_route'] as String?;
    
    return VerticalList(
      title: title,
      items: items,
      moreRoute: moreRoute,
    );
  }
  
  /// 构建横幅广告组件
  static Widget _buildBanner(Map<String, dynamic> module) {
    final data = module['data'] as Map<String, dynamic>? ?? {};
    final apiParams = module['api_params'] as Map<String, dynamic>? ?? {};
    
    final imageUrl = data['image_url'] as String? ?? apiParams['image_url'] as String? ?? '';
    final actionUrl = data['action_url'] as String? ?? apiParams['action_url'] as String? ?? '';
    final actionType = data['action_type'] as String? ?? apiParams['action_type'] as String? ?? 'browser';
    final height = (data['height'] as num?)?.toDouble() ?? (apiParams['height'] as num?)?.toDouble() ?? 100.0;
    
    if (imageUrl.isEmpty) {
      return _buildPlaceholder(
        module: module,
        icon: Icons.image,
        description: '横幅广告图片为空',
      );
    }
    
    return app_banner.Banner(
      imageUrl: imageUrl,
      actionUrl: actionUrl,
      actionType: actionType,
      height: height,
    );
  }
  
  /// 构建公告组件
  static Widget _buildNotice(Map<String, dynamic> module) {
    final data = module['data'] as Map<String, dynamic>? ?? {};
    final apiParams = module['api_params'] as Map<String, dynamic>? ?? {};
    
    final title = data['title'] as String? ?? apiParams['title'] as String? ?? module['title'] as String? ?? '公告';
    final content = data['content'] as String? ?? apiParams['content'] as String? ?? '';
    final actionUrl = data['action_url'] as String? ?? apiParams['action_url'] as String?;
    final type = data['type'] as String? ?? apiParams['type'] as String? ?? 'info';
    
    if (content.isEmpty) {
      return const SizedBox.shrink();
    }
    
    return Notice(
      title: title,
      content: content,
      actionUrl: actionUrl,
      type: type,
    );
  }
  
  /// 构建排行榜组件
  static Widget _buildRanking(Map<String, dynamic> module) {
    final title = module['title'] as String? ?? '热播榜';
    final data = module['data'];
    final apiParams = module['api_params'] as Map<String, dynamic>? ?? {};
    
    List<Map<String, dynamic>> items = [];
    if (data is List) {
      items = data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } else if (data is Map) {
      final itemsList = data['items'];
      if (itemsList is List) {
        items = itemsList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    }
    
    if (items.isEmpty) {
      return _buildPlaceholder(
        module: module,
        icon: Icons.leaderboard,
        description: '排行榜数据为空',
      );
    }
    
    final rankType = apiParams['rank_type'] as String? ?? 'hot';
    final moreRoute = apiParams['more_route'] as String?;
    final showPeriodTabs = apiParams['show_period_tabs'] as bool? ?? true;
    final typeId = apiParams['t'] as int?;
    
    return Ranking(
      title: title,
      items: items,
      rankType: rankType,
      moreRoute: moreRoute,
      showPeriodTabs: showPeriodTabs,
      typeId: typeId,
    );
  }
  
  /// 构建分类标签页组件
  static Widget _buildCategoryTabs(Map<String, dynamic> module) {
    final title = module['title'] as String? ?? '';
    final data = module['data'] as Map<String, dynamic>? ?? {};
    final apiParams = module['api_params'] as Map<String, dynamic>? ?? {};
    
    List<Map<String, dynamic>> tabs = [];
    if (data['tabs'] is List) {
      tabs = (data['tabs'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } else if (apiParams['tabs'] is List) {
      tabs = (apiParams['tabs'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    
    List<Map<String, dynamic>> items = [];
    if (data['items'] is List) {
      items = (data['items'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    
    if (tabs.isEmpty) {
      return _buildPlaceholder(
        module: module,
        icon: Icons.tab,
        description: '分类标签数据为空',
      );
    }
    
    // 获取主分类ID，用于动态加载子分类数据
    final typeId = apiParams['t'] as int?;
    
    return CategoryTabs(
      title: title,
      tabs: tabs,
      items: items,
      typeId: typeId,
    );
  }
  
  /// 构建演员列表组件
  static Widget _buildActorList(Map<String, dynamic> module) {
    final title = module['title'] as String? ?? '热门演员';
    final data = module['data'];
    final apiParams = module['api_params'] as Map<String, dynamic>? ?? {};
    
    List<Map<String, dynamic>> actors = [];
    if (data is List) {
      actors = data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } else if (data is Map) {
      final actorsList = data['actors'] ?? data['items'];
      if (actorsList is List) {
        actors = actorsList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    }
    
    // 演员列表允许为空，会自动从后端加载
    final moreRoute = apiParams['more_route'] as String?;
    final autoLoad = apiParams['auto_load'] as bool? ?? true;
    
    return ActorList(
      title: title,
      actors: actors,
      moreRoute: moreRoute,
      autoLoad: autoLoad,
    );
  }
  
  /// 构建专题列表组件
  static Widget _buildTopicList(Map<String, dynamic> module) {
    final title = module['title'] as String? ?? '精选专题';
    final data = module['data'];
    final apiParams = module['api_params'] as Map<String, dynamic>? ?? {};
    
    List<Map<String, dynamic>> topics = [];
    if (data is List) {
      topics = data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } else if (data is Map) {
      final topicsList = data['topics'] ?? data['items'];
      if (topicsList is List) {
        topics = topicsList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    }
    
    if (topics.isEmpty) {
      return _buildPlaceholder(
        module: module,
        icon: Icons.collections,
        description: '专题列表数据为空',
      );
    }
    
    final moreRoute = apiParams['more_route'] as String?;
    final displayStyle = apiParams['display_style'] as String? ?? 'card';
    
    return TopicList(
      title: title,
      topics: topics,
      moreRoute: moreRoute,
      displayStyle: displayStyle,
    );
  }
  
  /// 构建文章列表组件
  static Widget _buildArticleList(Map<String, dynamic> module) {
    final title = module['title'] as String? ?? '最新资讯';
    final data = module['data'];
    final apiParams = module['api_params'] as Map<String, dynamic>? ?? {};
    
    List<Map<String, dynamic>> articles = [];
    if (data is List) {
      articles = data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } else if (data is Map) {
      final articlesList = data['articles'] ?? data['items'];
      if (articlesList is List) {
        articles = articlesList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    }
    
    // 文章列表允许为空，会自动从后端加载
    final moreRoute = apiParams['more_route'] as String?;
    final displayStyle = apiParams['display_style'] as String? ?? 'card';
    final autoLoad = apiParams['auto_load'] as bool? ?? true;
    
    return ArticleList(
      title: title,
      articles: articles,
      moreRoute: moreRoute,
      displayStyle: displayStyle,
      autoLoad: autoLoad,
    );
  }
  
  /// 构建推荐模块组件
  static Widget _buildRecommend(Map<String, dynamic> module) {
    final title = module['title'] as String? ?? '推荐';
    final moduleType = module['module_type'] as String? ?? 'recommend';
    final data = module['data'];
    final apiParams = module['api_params'] as Map<String, dynamic>? ?? {};
    
    Logger.debug('[Recommend] Title: $title, Type: $moduleType');
    Logger.debug('[Recommend] Raw data type: ${data.runtimeType}');
    
    // 解析已有数据（后端可能已经返回了推荐数据）
    List<Map<String, dynamic>> items = [];
    if (data is List) {
      items = data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } else if (data is Map) {
      final itemsList = data['items'] ?? data['data'];
      if (itemsList is List) {
        items = itemsList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    }
    
    // 确定推荐策略
    String strategy = 'trending';
    if (moduleType == 'recommend_similar') {
      strategy = 'similar';
    } else if (moduleType == 'recommend_personalized') {
      strategy = 'personalized';
    } else if (apiParams['strategy'] != null) {
      strategy = apiParams['strategy'] as String;
    }
    
    final vodId = apiParams['vod_id'] as String?;
    final userId = apiParams['user_id'] as int?;
    final typeId = apiParams['t'] as int? ?? apiParams['type_id'] as int?;
    final limit = apiParams['limit'] as int? ?? 10;
    final moreRoute = apiParams['more_route'] as String?;
    
    return RecommendList(
      title: title,
      strategy: strategy,
      vodId: vodId,
      userId: userId,
      typeId: typeId,
      limit: limit,
      initialItems: items.isNotEmpty ? items : null,
      moreRoute: moreRoute,
      autoLoad: items.isEmpty, // 如果没有初始数据，自动加载
    );
  }
  
  /// 构建瀑布流组件
  static Widget _buildWaterfall(Map<String, dynamic> module) {
    final title = module['title'] as String? ?? '';
    final moduleType = module['module_type'] as String? ?? 'waterfall';
    final data = module['data'];
    
    Logger.debug('[Waterfall] Title: $title');
    Logger.debug('[Waterfall] Module type: $moduleType');
    Logger.debug('[Waterfall] Raw data type: ${data.runtimeType}');
    Logger.debug('[Waterfall] Raw data: $data');
    
    // 解析视频列表数据
    List<Map<String, dynamic>> items = [];
    if (data is List) {
      items = data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } else if (data is Map) {
      final itemsList = data['items'];
      if (itemsList is List) {
        items = itemsList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    }
    
    Logger.debug('[Waterfall] Parsed items count: ${items.length}');
    
    if (items.isEmpty) {
      return _buildPlaceholder(
        module: module,
        icon: Icons.view_stream,
        description: '瀑布流数据为空',
      );
    }
    
    // 根据类型确定列数
    int crossAxisCount = 2;
    if (moduleType == 'waterfall_3col') {
      crossAxisCount = 3;
    }
    
    // 使用 MixedGrid 组件渲染（它支持不同列数）
    return MixedGrid(
      title: title,
      items: items,
      crossAxisCount: crossAxisCount,
    );
  }
  
  /// 构建占位组件
  static Widget _buildPlaceholder({
    required Map<String, dynamic> module,
    required IconData icon,
    required String description,
  }) {
    final title = module['title'] as String? ?? '未命名模块';
    final moduleType = module['module_type'] as String? ?? 'unknown';
    
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: const Color(0xFF2E2E2E),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 标题
          Row(
            children: [
              Icon(
                icon,
                color: const Color(0xFFFFC107),
                size: 24,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 12),
          
          // 模块类型
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFF2E2E2E),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              'Type: $moduleType',
              style: const TextStyle(
                fontSize: 12,
                color: Colors.white54,
                fontFamily: 'monospace',
              ),
            ),
          ),
          
          const SizedBox(height: 12),
          
          // 描述
          Text(
            description,
            style: const TextStyle(
              fontSize: 14,
              color: Colors.white70,
            ),
          ),
          
          const SizedBox(height: 16),
          
          // 开发中提示
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF2E2E2E),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Row(
              children: [
                Icon(
                  Icons.construction,
                  color: Color(0xFFFFC107),
                  size: 16,
                ),
                SizedBox(width: 8),
                Text(
                  '组件开发中，敬请期待...',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white54,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  /// 构建不支持的模块类型
  static Widget _buildUnsupportedWidget(String moduleType) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Colors.orange.withValues(alpha: 0.3),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.warning_amber_rounded,
            color: Colors.orange,
            size: 24,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '不支持的模块类型',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Type: $moduleType',
                  style: const TextStyle(
                    fontSize: 12,
                    color: Colors.white54,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  /// 构建错误组件
  static Widget _buildErrorWidget(String message) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Colors.red.withValues(alpha: 0.3),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.error_outline,
            color: Colors.red,
            size: 24,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '模块渲染错误',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  message,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Colors.white54,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  /// 验证模块数据
  static bool validateModule(Map<String, dynamic> module) {
    // 检查必需字段
    if (!module.containsKey('module_type')) {
      Logger.warning('[DynamicRenderer] Module missing module_type');
      return false;
    }
    
    final moduleType = module['module_type'];
    if (moduleType == null || moduleType.toString().isEmpty) {
      Logger.warning('[DynamicRenderer] Module has empty module_type');
      return false;
    }
    
    return true;
  }
  
  /// 解析模块数据
  static Map<String, dynamic> parseModuleData(Map<String, dynamic> module) {
    // 提取通用字段
    final result = <String, dynamic>{
      'id': module['id'],
      'module_type': module['module_type'],
      'title': module['title'] ?? '',
      'sort_order': module['sort_order'] ?? 0,
    };
    
    // 解析 api_params（可能是 JSON 字符串或对象）
    if (module.containsKey('api_params')) {
      final apiParams = module['api_params'];
      if (apiParams is String) {
        // 如果是字符串，尝试解析为 JSON
        try {
          // 这里可以使用 json.decode 解析
          result['api_params'] = apiParams;
        } catch (e) {
          Logger.warning('[DynamicRenderer] Failed to parse api_params: $e');
          result['api_params'] = {};
        }
      } else {
        result['api_params'] = apiParams ?? {};
      }
    }
    
    // 解析 ad_config
    if (module.containsKey('ad_config')) {
      final adConfig = module['ad_config'];
      if (adConfig is String) {
        try {
          result['ad_config'] = adConfig;
        } catch (e) {
          Logger.warning('[DynamicRenderer] Failed to parse ad_config: $e');
          result['ad_config'] = {};
        }
      } else {
        result['ad_config'] = adConfig ?? {};
      }
    }
    
    // 解析 data 字段（模块具体数据）
    if (module.containsKey('data')) {
      result['data'] = module['data'];
    }
    
    return result;
  }
}
