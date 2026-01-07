/// English Language Pack
/// 
/// Contains all translatable text in the application
/// 
/// ## Naming Convention
/// - Use lowercase letters and underscores
/// - Group by module
/// - Common text at the top

const Map<String, String> enUS = {
  // ==================== Common ====================
  'app_name': 'Robin Video',
  'app_slogan': 'Wonderful videos at your fingertips',
  
  // Common Actions
  'confirm': 'Confirm',
  'cancel': 'Cancel',
  'save': 'Save',
  'delete': 'Delete',
  'edit': 'Edit',
  'close': 'Close',
  'back': 'Back',
  'next': 'Next',
  'done': 'Done',
  'retry': 'Retry',
  'refresh': 'Refresh',
  'loading': 'Loading...',
  'more': 'More',
  'all': 'All',
  'search': 'Search',
  'share': 'Share',
  
  // Common Status
  'success': 'Success',
  'failed': 'Failed',
  'error': 'Error',
  'warning': 'Warning',
  'tip': 'Tip',
  'unknown': 'Unknown',
  
  // ==================== Home ====================
  'home_featured': 'Featured',
  'home_movie': 'Movies',
  'home_series': 'Series',
  'home_shorts': 'Shorts',
  'home_anime': 'Anime',
  'home_variety': 'Variety',
  'home_search_hint': 'Search videos',
  'home_continue_watching': 'Continue Watching',
  'home_hot_ranking': 'Hot Ranking',
  'home_new_release': 'New Releases',
  'home_recommend': 'Recommended',
  
  // ==================== Player ====================
  'player_no_source': 'No playback source',
  'player_loading': 'Loading...',
  'player_error': 'Playback error',
  'player_retry': 'Tap to retry',
  'player_episode': 'Episodes',
  'player_episode_count': '@count episodes',
  'player_quality': 'Quality',
  'player_quality_auto': 'Auto',
  'player_quality_1080p': 'FHD 1080P',
  'player_quality_720p': 'HD 720P',
  'player_quality_480p': 'SD 480P',
  'player_quality_360p': 'Low 360P',
  'player_speed': 'Speed',
  'player_cast': 'Cast',
  'player_pip': 'PiP',
  'player_fullscreen': 'Fullscreen',
  'player_exit_fullscreen': 'Exit Fullscreen',
  'player_next_episode': 'Next Episode',
  'player_completed': 'Completed',
  'player_all_episodes_completed': 'All episodes completed',
  
  // ==================== Video Detail ====================
  'detail_director': 'Director',
  'detail_actor': 'Cast',
  'detail_writer': 'Writer',
  'detail_synopsis': 'Synopsis',
  'detail_favorite': 'Favorite',
  'detail_favorited': 'Favorited',
  'detail_appointment': 'Subscribe',
  'detail_appointed': 'Subscribed',
  'detail_share': 'Share',
  'detail_add_favorite_success': 'Added to favorites',
  'detail_remove_favorite_success': 'Removed from favorites',
  'detail_appointment_success': 'Subscribed! We\'ll notify you on updates',
  'detail_cancel_appointment_success': 'Subscription cancelled',
  'detail_plays': '@count plays',
  'detail_today_plays': '@count today',
  
  // ==================== Search ====================
  'search_hint': 'Search videos',
  'search_history': 'Search History',
  'search_hot': 'Hot Searches',
  'search_clear_history': 'Clear History',
  'search_no_result': 'No results found',
  'search_try_other': 'Try different keywords',
  'search_history_cleared': 'Search history cleared',
  
  // ==================== Profile ====================
  'profile_login': 'Tap to Login',
  'profile_login_hint': 'Login to sync watch history and favorites',
  'profile_history': 'Watch History',
  'profile_favorites': 'My Favorites',
  'profile_appointments': 'My Subscriptions',
  'profile_app_center': 'App Center',
  'profile_share_app': 'Share App',
  'profile_source_settings': 'Source Settings',
  'profile_feedback': 'Feedback',
  'profile_clear_cache': 'Clear Cache',
  'profile_cache_size': 'Cache: @size',
  'profile_contact_support': 'Contact Support',
  'profile_official_group': 'Official Group',
  'profile_permanent_url': 'Permanent URL',
  'profile_check_update': 'Check Update',
  'profile_logout': 'Logout',
  'profile_logout_confirm': 'Are you sure you want to logout?',
  'profile_logout_success': 'Logged out',
  'profile_my_content': 'My Content',
  'profile_app_features': 'Features',
  'profile_help_support': 'Help & Support',
  
  // ==================== Login/Register ====================
  'auth_login': 'Login',
  'auth_register': 'Register',
  'auth_username': 'Username',
  'auth_password': 'Password',
  'auth_confirm_password': 'Confirm Password',
  'auth_username_hint': 'Enter username',
  'auth_password_hint': 'Enter password',
  'auth_confirm_password_hint': 'Enter password again',
  'auth_login_success': 'Login successful',
  'auth_register_success': 'Registration successful',
  'auth_login_failed': 'Login failed',
  'auth_register_failed': 'Registration failed',
  'auth_password_mismatch': 'Passwords do not match',
  'auth_username_required': 'Please enter username',
  'auth_password_required': 'Please enter password',
  'auth_no_account': 'Don\'t have an account?',
  'auth_has_account': 'Already have an account?',
  'auth_go_register': 'Register',
  'auth_go_login': 'Login',
  
  // ==================== Login Required ====================
  'login_required': 'Please login first',
  'login_required_history': 'Login to view watch history',
  'login_required_favorites': 'Login to save favorites',
  'login_required_appointments': 'Login to subscribe for updates',
  'login_required_sync': 'Login to sync watch progress',
  'login_required_feature': 'This feature requires login',
  'login_go': 'Login',
  
  // ==================== Network Errors ====================
  'network_error': 'Network error, please check your connection',
  'network_timeout': 'Connection timeout, please try again',
  'network_server_error': 'Server error, please try again later',
  'network_not_found': 'Resource not found',
  'network_no_permission': 'Access denied',
  
  // ==================== Video Errors ====================
  'video_format_error': 'Video format not supported',
  'video_not_found': 'Video not found',
  'video_play_failed': 'Playback failed, please retry',
  
  // ==================== Cache ====================
  'cache_clear_confirm': 'Clear cache?',
  'cache_clearing': 'Clearing...',
  'cache_clear_success': 'Cache cleared',
  'cache_clear_failed': 'Failed to clear cache',
  
  // ==================== Version Update ====================
  'update_title': 'Version Info',
  'update_current_version': 'Current: @version',
  'update_latest_version': 'Latest: @version',
  'update_changelog': 'Changelog:',
  'update_now': 'Update Now',
  'update_later': 'Later',
  'update_check_failed': 'Failed to check for updates',
  
  // ==================== Share ====================
  'share_title': 'Share',
  'share_copy_link': 'Copy Link',
  'share_save_poster': 'Save Poster',
  'share_to_wechat': 'WeChat',
  'share_to_moments': 'Moments',
  'share_to_qq': 'QQ',
  'share_to_weibo': 'Weibo',
  'share_link_copied': 'Link copied',
  'share_poster_saved': 'Poster saved',
  
  // ==================== Shorts ====================
  'shorts_no_content': 'No shorts available',
  'shorts_swipe_hint': 'Swipe up for more',
  'shorts_watch_full': 'Watch Full Version',
  'shorts_episode_info': 'Episode @current of @total',
  
  // ==================== Actor ====================
  'actor_works': 'Filmography',
  'actor_no_info': 'Actor info not found',
  
  // ==================== Feedback ====================
  'feedback_title': 'Feedback',
  'feedback_type': 'Type',
  'feedback_type_request': 'Request',
  'feedback_type_bug': 'Bug Report',
  'feedback_type_suggestion': 'Suggestion',
  'feedback_content': 'Content',
  'feedback_content_hint': 'Please describe your request or issue...',
  'feedback_contact': 'Contact (Optional)',
  'feedback_contact_hint': 'So we can reach you',
  'feedback_submit': 'Submit',
  'feedback_submit_success': 'Feedback submitted, thank you!',
  'feedback_submit_failed': 'Submit failed, please try again',
  'feedback_content_required': 'Please enter feedback content',
};
