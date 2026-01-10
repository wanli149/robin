import '../core/http_client.dart';
import '../core/logger.dart';

/// API 服务
/// 封装常用的 API 调用
class ApiService {
  static final HttpClient _httpClient = HttpClient();

  /// 获取排行榜数据
  /// [period] - 时间段: day(日榜), week(周榜), month(月榜)
  /// [typeId] - 分类ID，可选
  /// [limit] - 返回数量
  static Future<List<Map<String, dynamic>>> getRanking({
    String period = 'day',
    int? typeId,
    int limit = 10,
  }) async {
    try {
      final queryParams = <String, String>{
        'period': period,
        'limit': limit.toString(),
      };
      if (typeId != null) {
        queryParams['t'] = typeId.toString();
      }

      final response = await _httpClient.get(
        '/api/ranking',
        queryParameters: queryParams,
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1 && data['data'] != null) {
          return List<Map<String, dynamic>>.from(
            (data['data'] as List).map((e) => Map<String, dynamic>.from(e)),
          );
        }
      }
      return [];
    } catch (e) {
      Logger.error('ApiService.getRanking error: $e');
      return [];
    }
  }

  /// 获取分类下的视频列表
  /// [typeId] - 主分类ID
  /// [subTypeId] - 子分类ID，可选
  /// [page] - 页码
  /// [limit] - 每页数量
  static Future<List<Map<String, dynamic>>> getCategoryVideos({
    required int typeId,
    int? subTypeId,
    int page = 1,
    int limit = 12,
  }) async {
    try {
      final queryParams = <String, String>{
        't': typeId.toString(),
        'pg': page.toString(),
        'limit': limit.toString(),
      };
      if (subTypeId != null) {
        queryParams['class'] = subTypeId.toString();
      }

      final response = await _httpClient.get(
        '/api/videos',
        queryParameters: queryParams,
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1 && data['data'] != null) {
          return List<Map<String, dynamic>>.from(
            (data['data'] as List).map((e) => Map<String, dynamic>.from(e)),
          );
        }
      }
      return [];
    } catch (e) {
      Logger.error('ApiService.getCategoryVideos error: $e');
      return [];
    }
  }

  /// 获取热门演员列表
  /// [limit] - 返回数量
  static Future<List<Map<String, dynamic>>> getPopularActors({
    int limit = 20,
  }) async {
    try {
      final response = await _httpClient.get(
        '/api/actors/popular',
        queryParameters: {'limit': limit.toString()},
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1 && data['data'] != null) {
          return List<Map<String, dynamic>>.from(
            (data['data'] as List).map((e) => Map<String, dynamic>.from(e)),
          );
        }
      }
      return [];
    } catch (e) {
      Logger.error('ApiService.getPopularActors error: $e');
      return [];
    }
  }

  /// 获取子分类列表
  /// [parentId] - 父分类ID
  static Future<List<Map<String, dynamic>>> getSubCategories({
    required int parentId,
  }) async {
    try {
      final response = await _httpClient.get(
        '/api/categories/$parentId/subs',
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1 && data['data'] != null) {
          return List<Map<String, dynamic>>.from(
            (data['data'] as List).map((e) => Map<String, dynamic>.from(e)),
          );
        }
      }
      return [];
    } catch (e) {
      Logger.error('ApiService.getSubCategories error: $e');
      return [];
    }
  }

  /// 获取文章列表
  /// [typeId] - 文章分类ID，可选
  /// [page] - 页码
  /// [limit] - 每页数量
  /// [keyword] - 搜索关键词，可选
  static Future<List<Map<String, dynamic>>> getArticles({
    int? typeId,
    int page = 1,
    int limit = 20,
    String? keyword,
  }) async {
    try {
      final queryParams = <String, String>{
        'page': page.toString(),
        'limit': limit.toString(),
      };
      if (typeId != null) {
        queryParams['type_id'] = typeId.toString();
      }
      if (keyword != null && keyword.isNotEmpty) {
        queryParams['keyword'] = keyword;
      }

      final response = await _httpClient.get(
        '/api/articles',
        queryParameters: queryParams,
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1 && data['data'] != null) {
          return List<Map<String, dynamic>>.from(
            (data['data'] as List).map((e) => Map<String, dynamic>.from(e)),
          );
        }
      }
      return [];
    } catch (e) {
      Logger.error('ApiService.getArticles error: $e');
      return [];
    }
  }

  /// 获取文章详情
  /// [id] - 文章ID
  static Future<Map<String, dynamic>?> getArticleDetail(int id) async {
    try {
      final response = await _httpClient.get('/api/articles/$id');

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['code'] == 1 && data['data'] != null) {
          return Map<String, dynamic>.from(data['data']);
        }
      }
      return null;
    } catch (e) {
      Logger.error('ApiService.getArticleDetail error: $e');
      return null;
    }
  }
}
