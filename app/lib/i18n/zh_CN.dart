/// 简体中文语言包
/// 
/// 包含应用中所有需要翻译的文本
/// 
/// ## 命名规范
/// - 使用小写字母和下划线
/// - 按模块分组
/// - 通用文本放在最前面

const Map<String, String> zhCN = {
  // ==================== 通用 ====================
  'app_name': '拾光影视',
  'app_slogan': '精彩影视，尽在掌握',
  
  // 通用操作
  'confirm': '确定',
  'cancel': '取消',
  'save': '保存',
  'delete': '删除',
  'edit': '编辑',
  'close': '关闭',
  'back': '返回',
  'next': '下一步',
  'done': '完成',
  'retry': '重试',
  'refresh': '刷新',
  'loading': '加载中...',
  'more': '更多',
  'all': '全部',
  'search': '搜索',
  'share': '分享',
  
  // 通用状态
  'success': '成功',
  'failed': '失败',
  'error': '错误',
  'warning': '警告',
  'tip': '提示',
  'unknown': '未知',
  
  // ==================== 首页 ====================
  'home_featured': '精选',
  'home_movie': '电影',
  'home_series': '剧集',
  'home_shorts': '短剧',
  'home_anime': '动漫',
  'home_variety': '综艺',
  'home_search_hint': '搜索影片',
  'home_continue_watching': '继续观看',
  'home_hot_ranking': '热播榜',
  'home_new_release': '新片上线',
  'home_recommend': '猜你喜欢',
  
  // ==================== 播放器 ====================
  'player_no_source': '暂无播放源',
  'player_loading': '正在加载...',
  'player_error': '播放错误',
  'player_retry': '点击重试',
  'player_episode': '选集',
  'player_episode_count': '共@count集',
  'player_quality': '清晰度',
  'player_quality_auto': '自动',
  'player_quality_1080p': '蓝光 1080P',
  'player_quality_720p': '超清 720P',
  'player_quality_480p': '高清 480P',
  'player_quality_360p': '流畅 360P',
  'player_speed': '播放速度',
  'player_cast': '投屏',
  'player_pip': '小窗播放',
  'player_fullscreen': '全屏',
  'player_exit_fullscreen': '退出全屏',
  'player_next_episode': '下一集',
  'player_completed': '播放完成',
  'player_all_episodes_completed': '已播放完所有集数',
  
  // ==================== 视频详情 ====================
  'detail_director': '导演',
  'detail_actor': '主演',
  'detail_writer': '编剧',
  'detail_synopsis': '剧情简介',
  'detail_favorite': '收藏',
  'detail_favorited': '已收藏',
  'detail_appointment': '预约',
  'detail_appointed': '已预约',
  'detail_share': '分享',
  'detail_add_favorite_success': '已添加到收藏',
  'detail_remove_favorite_success': '已取消收藏',
  'detail_appointment_success': '预约成功，更新时将通知您',
  'detail_cancel_appointment_success': '已取消预约',
  'detail_plays': '@count次播放',
  'detail_today_plays': '今日@count',
  
  // ==================== 搜索 ====================
  'search_hint': '搜索影片',
  'search_history': '搜索历史',
  'search_hot': '热门搜索',
  'search_clear_history': '清除历史',
  'search_no_result': '没有找到相关内容',
  'search_try_other': '试试其他关键词吧',
  'search_history_cleared': '已清除搜索历史',
  
  // ==================== 个人中心 ====================
  'profile_login': '点击登录',
  'profile_login_hint': '登录后可同步观看历史和收藏',
  'profile_history': '观看历史',
  'profile_favorites': '我的收藏',
  'profile_appointments': '我的预约',
  'profile_app_center': '应用中心',
  'profile_share_app': '分享 APP',
  'profile_source_settings': '换源设置',
  'profile_feedback': '求片/反馈',
  'profile_clear_cache': '清除缓存',
  'profile_cache_size': '当前缓存：@size',
  'profile_contact_support': '联系客服',
  'profile_official_group': '官方群组',
  'profile_permanent_url': '永久网址',
  'profile_check_update': 'APP更新',
  'profile_logout': '退出登录',
  'profile_logout_confirm': '确定要退出登录吗？',
  'profile_logout_success': '已退出登录',
  'profile_my_content': '我的内容',
  'profile_app_features': '应用功能',
  'profile_help_support': '帮助与支持',
  
  // ==================== 登录/注册 ====================
  'auth_login': '登录',
  'auth_register': '注册',
  'auth_username': '用户名',
  'auth_password': '密码',
  'auth_confirm_password': '确认密码',
  'auth_username_hint': '请输入用户名',
  'auth_password_hint': '请输入密码',
  'auth_confirm_password_hint': '请再次输入密码',
  'auth_login_success': '登录成功',
  'auth_register_success': '注册成功',
  'auth_login_failed': '登录失败',
  'auth_register_failed': '注册失败',
  'auth_password_mismatch': '两次密码不一致',
  'auth_username_required': '请输入用户名',
  'auth_password_required': '请输入密码',
  'auth_no_account': '还没有账号？',
  'auth_has_account': '已有账号？',
  'auth_go_register': '去注册',
  'auth_go_login': '去登录',
  
  // ==================== 需要登录提示 ====================
  'login_required': '请先登录',
  'login_required_history': '登录后可查看观看历史',
  'login_required_favorites': '登录后可收藏喜欢的影片',
  'login_required_appointments': '登录后可预约更新提醒',
  'login_required_sync': '登录后可同步观看进度',
  'login_required_feature': '该功能需要登录后使用',
  'login_go': '去登录',
  
  // ==================== 网络错误 ====================
  'network_error': '网络连接失败，请检查网络后重试',
  'network_timeout': '连接超时，请稍后重试',
  'network_server_error': '服务器错误，请稍后重试',
  'network_not_found': '请求的资源不存在',
  'network_no_permission': '没有权限访问',
  
  // ==================== 视频错误 ====================
  'video_format_error': '视频格式不支持，请尝试其他视频',
  'video_not_found': '视频资源不存在',
  'video_play_failed': '播放失败，请重试',
  
  // ==================== 缓存 ====================
  'cache_clear_confirm': '确定要清除缓存吗？',
  'cache_clearing': '正在清除...',
  'cache_clear_success': '缓存已清除',
  'cache_clear_failed': '清除缓存失败',
  
  // ==================== 版本更新 ====================
  'update_title': '版本信息',
  'update_current_version': '当前版本：@version',
  'update_latest_version': '最新版本：@version',
  'update_changelog': '更新内容：',
  'update_now': '立即更新',
  'update_later': '稍后更新',
  'update_check_failed': '检查更新失败',
  
  // ==================== 分享 ====================
  'share_title': '分享',
  'share_copy_link': '复制链接',
  'share_save_poster': '保存海报',
  'share_to_wechat': '微信',
  'share_to_moments': '朋友圈',
  'share_to_qq': 'QQ',
  'share_to_weibo': '微博',
  'share_link_copied': '链接已复制',
  'share_poster_saved': '海报已保存',
  
  // ==================== 短剧 ====================
  'shorts_no_content': '暂无短剧',
  'shorts_swipe_hint': '上滑查看更多',
  'shorts_watch_full': '观看完整版',
  'shorts_episode_info': '第@current集/共@total集',
  
  // ==================== 演员 ====================
  'actor_works': '参演作品',
  'actor_no_info': '未找到演员信息',
  
  // ==================== 反馈 ====================
  'feedback_title': '求片/反馈',
  'feedback_type': '反馈类型',
  'feedback_type_request': '求片',
  'feedback_type_bug': '问题反馈',
  'feedback_type_suggestion': '功能建议',
  'feedback_content': '反馈内容',
  'feedback_content_hint': '请详细描述您的需求或问题...',
  'feedback_contact': '联系方式（选填）',
  'feedback_contact_hint': '方便我们联系您',
  'feedback_submit': '提交反馈',
  'feedback_submit_success': '反馈提交成功，感谢您的支持！',
  'feedback_submit_failed': '提交失败，请稍后重试',
  'feedback_content_required': '请输入反馈内容',
};
