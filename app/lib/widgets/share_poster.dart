import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:get/get.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../core/logger.dart';

/// 分享海报生成器
class SharePosterGenerator {
  /// 生成并分享海报
  static Future<void> generateAndShare({
    required String appName,
    required String downloadUrl,
    String? slogan,
  }) async {
    // 显示海报预览对话框，让用户确认后分享
    Get.dialog(
      _SharePosterDialog(
        appName: appName,
        downloadUrl: downloadUrl,
        slogan: slogan ?? '精彩影视，尽在掌握',
      ),
      barrierDismissible: true,
    );
  }
}

/// 分享海报对话框
class _SharePosterDialog extends StatefulWidget {
  final String appName;
  final String downloadUrl;
  final String slogan;

  const _SharePosterDialog({
    required this.appName,
    required this.downloadUrl,
    required this.slogan,
  });

  @override
  State<_SharePosterDialog> createState() => _SharePosterDialogState();
}

class _SharePosterDialogState extends State<_SharePosterDialog> {
  final GlobalKey _posterKey = GlobalKey();
  bool _isGenerating = false;

  Future<void> _shareImage() async {
    if (_isGenerating) return;
    
    setState(() {
      _isGenerating = true;
    });

    try {
      // 等待一帧确保渲染完成
      await Future.delayed(const Duration(milliseconds: 100));
      
      // 获取 RenderRepaintBoundary
      final boundary = _posterKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) {
        throw Exception('无法获取海报渲染对象');
      }

      // 转换为图片
      final image = await boundary.toImage(pixelRatio: 3.0);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData == null) {
        throw Exception('无法生成图片数据');
      }
      
      final Uint8List bytes = byteData.buffer.asUint8List();

      // 保存到临时目录
      final tempDir = await getTemporaryDirectory();
      final file = File('${tempDir.path}/share_poster_${DateTime.now().millisecondsSinceEpoch}.png');
      await file.writeAsBytes(bytes);

      // 关闭对话框
      Get.back();

      // 分享 - 使用 share_plus 的推荐方式
      final result = await Share.shareXFiles(
        [XFile(file.path)],
        text: '推荐一个超棒的影视APP：${widget.appName}',
      );
      
      // 处理分享结果
      if (result.status == ShareResultStatus.success) {
        Logger.info('Share poster success');
      } else if (result.status == ShareResultStatus.dismissed) {
        Logger.info('Share poster dismissed');
      }
    } catch (e) {
      Logger.error('Failed to generate share poster: $e');
      Get.snackbar(
        '失败',
        '生成海报失败: $e',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.withValues(alpha: 0.8),
        colorText: Colors.white,
      );
    } finally {
      if (mounted) {
        setState(() {
          _isGenerating = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 海报预览
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: RepaintBoundary(
              key: _posterKey,
              child: _SharePosterContent(
                appName: widget.appName,
                downloadUrl: widget.downloadUrl,
                slogan: widget.slogan,
              ),
            ),
          ),
          const SizedBox(height: 16),
          
          // 操作按钮
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // 取消按钮
              TextButton(
                onPressed: () => Get.back(),
                style: TextButton.styleFrom(
                  backgroundColor: Colors.white24,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
                child: const Text(
                  '取消',
                  style: TextStyle(color: Colors.white),
                ),
              ),
              const SizedBox(width: 16),
              
              // 分享按钮
              ElevatedButton.icon(
                onPressed: _isGenerating ? null : _shareImage,
                icon: _isGenerating 
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.black,
                        ),
                      )
                    : const Icon(Icons.share, color: Colors.black),
                label: Text(
                  _isGenerating ? '生成中...' : '分享海报',
                  style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFFC107),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// 分享海报内容
class _SharePosterContent extends StatelessWidget {
  final String appName;
  final String downloadUrl;
  final String slogan;

  const _SharePosterContent({
    required this.appName,
    required this.downloadUrl,
    required this.slogan,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 300,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF1A1A2E),
            Color(0xFF16213E),
            Color(0xFF0F0F1A),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Logo
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: const Color(0xFFFFC107),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFFFC107).withValues(alpha: 0.4),
                  blurRadius: 20,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: const Icon(
              Icons.play_circle_filled,
              color: Color(0xFF1A1A2E),
              size: 50,
            ),
          ),
          const SizedBox(height: 20),

          // APP 名称
          Text(
            appName,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: Color(0xFFFFC107),
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 8),

          // Slogan
          Text(
            slogan,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 14,
              color: Colors.white70,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 24),

          // 特性列表
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: const Color(0xFFFFC107).withValues(alpha: 0.2),
              ),
            ),
            child: Column(
              children: [
                _buildFeature(Icons.hd, '高清画质'),
                const SizedBox(height: 12),
                _buildFeature(Icons.speed, '极速播放'),
                const SizedBox(height: 12),
                _buildFeature(Icons.update, '实时更新'),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // 二维码
          const Text(
            '扫码下载',
            style: TextStyle(
              fontSize: 12,
              color: Colors.white54,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
            ),
            child: QrImageView(
              data: downloadUrl,
              version: QrVersions.auto,
              size: 100,
              backgroundColor: Colors.white,
              errorCorrectionLevel: QrErrorCorrectLevel.M,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            '长按识别二维码',
            style: TextStyle(
              fontSize: 10,
              color: Colors.white38,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeature(IconData icon, String text) {
    return Row(
      children: [
        Icon(
          icon,
          color: const Color(0xFFFFC107),
          size: 20,
        ),
        const SizedBox(width: 12),
        Text(
          text,
          style: const TextStyle(
            fontSize: 14,
            color: Colors.white,
          ),
        ),
      ],
    );
  }
}
