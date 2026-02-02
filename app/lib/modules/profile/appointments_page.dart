import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../core/http_client.dart';
import '../../core/logger.dart';
import '../../widgets/net_image.dart';

/// 预约页面
class AppointmentsPage extends StatefulWidget {
  const AppointmentsPage({super.key});

  @override
  State<AppointmentsPage> createState() => _AppointmentsPageState();
}

class _AppointmentsPageState extends State<AppointmentsPage> {
  final _httpClient = HttpClient();
  final _appointmentsList = <AppointmentItem>[].obs;
  final _isLoading = false.obs;

  @override
  void initState() {
    super.initState();
    _loadAppointments();
  }

  /// 加载预约列表
  Future<void> _loadAppointments() async {
    _isLoading.value = true;

    try {
      final response = await _httpClient.get('/api/user/appointments');

      if (response.data['code'] == 1) {
        final data = response.data['data'];
        final list = data is List ? data : [];

        _appointmentsList.value =
            list.map((item) => AppointmentItem.fromJson(item)).toList();
      }
    } catch (e) {
      Logger.error('Failed to load appointments: $e');
      Get.snackbar('错误', '加载失败，请重试');
    } finally {
      _isLoading.value = false;
    }
  }

  /// 取消预约
  Future<void> _cancelAppointment(AppointmentItem item) async {
    Get.dialog(
      AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text(
          '确认取消',
          style: TextStyle(color: Colors.white),
        ),
        content: Text(
          '确定要取消《${item.vodName}》的预约吗？',
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Get.back(),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () async {
              Get.back();

              try {
                final response = await _httpClient
                    .delete('/api/appointment/${item.vodId}');

                if (response.data['code'] == 1) {
                  _appointmentsList.remove(item);
                  Get.snackbar('成功', '已取消预约');
                }
              } catch (e) {
                Logger.error('Failed to cancel appointment: $e');
                Get.snackbar('失败', '取消预约失败');
              }
            },
            child: const Text(
              '确定',
              style: TextStyle(color: Colors.red),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        backgroundColor: const Color(0xFF121212),
        elevation: 0,
        leading: IconButton(
          onPressed: () => Get.back(),
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
        ),
        title: const Text(
          '我的预约',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      body: Obx(() {
        if (_isLoading.value) {
          return const Center(
            child: CircularProgressIndicator(
              color: Color(0xFFFFC107),
            ),
          );
        }

        if (_appointmentsList.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.notifications_none,
                  size: 80,
                  color: Colors.white.withValues(alpha: 0.3),
                ),
                const SizedBox(height: 24),
                const Text(
                  '暂无预约内容',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.white54,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  '预约即将上映的影视作品，第一时间收到通知',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.white38,
                  ),
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: _loadAppointments,
          color: const Color(0xFFFFC107),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: _appointmentsList.length,
            itemBuilder: (context, index) {
              final item = _appointmentsList[index];
              return _buildAppointmentItem(item);
            },
          ),
        );
      }),
    );
  }

  /// 构建预约项
  Widget _buildAppointmentItem(AppointmentItem item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          // 封面
          ClipRRect(
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(12),
              bottomLeft: Radius.circular(12),
            ),
            child: Stack(
              children: [
                NetImage(
                  url: item.vodPic ?? '',
                  width: 100,
                  height: 140,
                  fit: BoxFit.cover,
                ),
                // 预约标识
                Positioned(
                  top: 8,
                  left: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFC107),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      '已预约',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: Colors.black,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 信息
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 标题
                  Text(
                    item.vodName,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 8),

                  // 上映时间
                  if (item.releaseDate != null) ...[
                    Row(
                      children: [
                        const Icon(
                          Icons.calendar_today,
                          size: 14,
                          color: Color(0xFFFFC107),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '上映时间：${item.releaseDate}',
                          style: const TextStyle(
                            fontSize: 13,
                            color: Colors.white70,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                  ],

                  // 预约时间
                  Row(
                    children: [
                      const Icon(
                        Icons.access_time,
                        size: 14,
                        color: Colors.white54,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '预约于 ${_formatTime(item.createdAt)}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.white54,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // 操作按钮
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => _cancelAppointment(item),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white54,
                            side: const BorderSide(
                              color: Colors.white24,
                              width: 1,
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                          child: const Text(
                            '取消预约',
                            style: TextStyle(fontSize: 13),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () {
                            // 跳转到视频详情页
                            Get.toNamed('/video/detail', arguments: {'vodId': item.vodId});
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFFFC107),
                            foregroundColor: Colors.black,
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                            elevation: 0,
                          ),
                          child: const Text(
                            '查看详情',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 格式化时间
  String _formatTime(int timestamp) {
    final date = DateTime.fromMillisecondsSinceEpoch(timestamp * 1000);
    return '${date.month}-${date.day}';
  }
}

/// 预约项模型
class AppointmentItem {
  final String vodId;
  final String vodName;
  final String? vodPic;
  final String? releaseDate;
  final int createdAt;

  AppointmentItem({
    required this.vodId,
    required this.vodName,
    this.vodPic,
    this.releaseDate,
    required this.createdAt,
  });

  factory AppointmentItem.fromJson(Map<String, dynamic> json) {
    return AppointmentItem(
      vodId: json['vod_id']?.toString() ?? '',
      vodName: json['vod_name'] ?? '',
      vodPic: json['vod_pic'],
      releaseDate: json['release_date'],
      createdAt: json['created_at'] ?? 0,
    );
  }
}
