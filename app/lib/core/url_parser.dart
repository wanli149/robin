import 'logger.dart';

/// 统一的URL解析服务
/// 处理各种视频URL格式的解析和兼容性
class UrlParser {
  /// 解析视频URL（统一入口）
  static String parseVideoUrl(String playUrl) {
    if (playUrl.isEmpty) return '';
    
    // 直接URL（新格式）
    if (_isDirectUrl(playUrl)) {
      return playUrl.trim();
    }
    
    // 苹果CMS格式：第1集$url1#第2集$url2
    if (_isCmsFormat(playUrl)) {
      return _parseCmsUrl(playUrl);
    }
    
    // 分享链接格式
    if (_isShareUrl(playUrl)) {
      // 分享链接需要通过API解析，这里返回原始URL
      return playUrl.trim();
    }
    
    // 其他格式，返回原始URL
    return playUrl.trim();
  }

  /// 从苹果CMS格式解析第一集URL
  static String _parseCmsUrl(String playUrl) {
    try {
      // 取第一集
      String firstEpisode = playUrl.contains('#') ? playUrl.split('#')[0] : playUrl;
      
      if (firstEpisode.contains('\$')) {
        final parts = firstEpisode.split('\$');
        if (parts.length > 1) {
          return parts[1].trim(); // 取 $ 后面的 URL
        }
      }
    } catch (e) {
      Logger.error('[UrlParser] Failed to parse CMS URL: $e');
    }
    
    return playUrl.trim();
  }

  /// 从苹果CMS格式解析指定集数URL
  static String parseCmsUrlByEpisode(String playUrl, int episodeIndex) {
    try {
      // 格式：播放源1$$播放源2
      final playUrls = playUrl.split('\$\$');
      
      // 优先选择m3u8播放源
      String selectedPlayUrl = '';
      for (final url in playUrls) {
        if (url.toLowerCase().contains('m3u8')) {
          selectedPlayUrl = url;
          break;
        }
      }
      
      // 如果没有m3u8，选择第一个
      if (selectedPlayUrl.isEmpty && playUrls.isNotEmpty) {
        selectedPlayUrl = playUrls[0];
      }
      
      if (selectedPlayUrl.isEmpty) return '';
      
      // 解析集数：第1集$url1#第2集$url2
      final episodes = selectedPlayUrl.split('#');
      if (episodeIndex <= episodes.length) {
        final episodeData = episodes[episodeIndex - 1];
        final parts = episodeData.split('\$');
        if (parts.length > 1) {
          return parts[1].trim();
        }
      }
    } catch (e) {
      Logger.error('[UrlParser] Failed to parse CMS URL by episode: $e');
    }
    
    return '';
  }

  /// 解析所有集数URL
  static List<Map<String, String>> parseAllEpisodes(String playUrl) {
    final episodes = <Map<String, String>>[];
    
    try {
      // 格式：播放源1$$播放源2
      final playUrls = playUrl.split('\$\$');
      
      // 优先选择m3u8播放源
      String selectedPlayUrl = '';
      for (final url in playUrls) {
        if (url.toLowerCase().contains('m3u8')) {
          selectedPlayUrl = url;
          break;
        }
      }
      
      // 如果没有m3u8，选择第一个
      if (selectedPlayUrl.isEmpty && playUrls.isNotEmpty) {
        selectedPlayUrl = playUrls[0];
      }
      
      if (selectedPlayUrl.isEmpty) return episodes;
      
      // 解析集数：第1集$url1#第2集$url2
      final episodeList = selectedPlayUrl.split('#');
      
      for (var i = 0; i < episodeList.length; i++) {
        final parts = episodeList[i].split('\$');
        if (parts.length >= 2) {
          episodes.add({
            'name': parts[0].trim(),
            'url': parts[1].trim(),
          });
        } else if (parts.isNotEmpty && parts[0].isNotEmpty) {
          // 如果没有$分隔，整个就是URL
          episodes.add({
            'name': '第${i + 1}集',
            'url': parts[0].trim(),
          });
        }
      }
    } catch (e) {
      Logger.error('[UrlParser] Failed to parse all episodes: $e');
    }
    
    return episodes;
  }

  /// 判断是否为直接URL
  static bool _isDirectUrl(String url) {
    return !url.contains('#') && !url.contains('\$') && !url.contains('/share/');
  }

  /// 判断是否为苹果CMS格式
  static bool _isCmsFormat(String url) {
    return url.contains('#') || url.contains('\$');
  }

  /// 判断是否为分享链接
  static bool _isShareUrl(String url) {
    return url.contains('/share/');
  }

  /// 验证URL是否有效
  static bool isValidUrl(String url) {
    if (url.isEmpty) return false;
    
    try {
      final uri = Uri.parse(url);
      return uri.hasScheme && (uri.scheme == 'http' || uri.scheme == 'https');
    } catch (e) {
      return false;
    }
  }

  /// 获取URL的文件扩展名
  static String getUrlExtension(String url) {
    try {
      final uri = Uri.parse(url);
      final path = uri.path;
      final lastDot = path.lastIndexOf('.');
      if (lastDot != -1 && lastDot < path.length - 1) {
        return path.substring(lastDot + 1).toLowerCase();
      }
    } catch (e) {
      Logger.error('[UrlParser] Failed to get URL extension: $e');
    }
    
    return '';
  }

  /// 判断是否为m3u8格式
  static bool isM3u8Url(String url) {
    return url.toLowerCase().contains('m3u8') || getUrlExtension(url) == 'm3u8';
  }

  /// 判断是否为mp4格式
  static bool isMp4Url(String url) {
    return url.toLowerCase().contains('mp4') || getUrlExtension(url) == 'mp4';
  }
}