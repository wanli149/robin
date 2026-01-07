import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import 'package:get/get.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

/// 分享海报生成器
class SharePosterGenerator {
  /// 生成并分享海报
  static Future<void> generateAndShare({
    required String appName,
    required String downloadUrl,
    String? slogan,
  }) async {
    try {
      // 显示加载提示
      Get.dialog(
        const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(
                color: Color(0xFFFFC107),
              ),
              SizedBox(height: 16),
              Text(
                '正在生成海报...',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                ),
              ),
            ],
          ),
        ),
        barrierDismissible: false,
      );

      // 生成海报
      final posterWidget = _SharePosterWidget(
        appName: appName,
        downloadUrl: downloadUrl,
        slogan: slogan ?? '精彩影视，尽在掌握',
      );

      // 创建 GlobalKey
      final key = GlobalKey();

      // 构建 Widget
      final widget = RepaintBoundary(
        key: key,
        child: posterWidget,
      );

      // 渲染 Widget
      final renderObject = await _renderWidget(widget);

      // 转换为图片
      final image = await renderObject.toImage(pixelRatio: 3.0);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      final bytes = byteData!.buffer.asUint8List();

      // 保存到临时目录
      final tempDir = await getTemporaryDirectory();
      final file = File('${tempDir.path}/share_poster_${DateTime.now().millisecondsSinceEpoch}.png');
      await file.writeAsBytes(bytes);

      // 关闭加载提示
      Get.back();

      // 分享
      await Share.shareXFiles(
        [XFile(file.path)],
        text: '推荐一个超棒的影视APP：$appName',
      );
    } catch (e) {
      print('❌ Failed to generate share poster: $e');
      Get.back(); // 关闭加载提示
      Get.snackbar(
        '失败',
        '生成海报失败',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.withOpacity(0.8),
        colorText: Colors.white,
      );
    }
  }

  /// 渲染 Widget
  static Future<RenderRepaintBoundary> _renderWidget(Widget widget) async {
    final view = WidgetsBinding.instance.platformDispatcher.views.first;
    final renderView = RenderView(
      view: view,
      child: RenderPositionedBox(
        alignment: Alignment.center,
        child: RenderConstrainedBox(
          additionalConstraints: const BoxConstraints(
            maxWidth: 375,
            maxHeight: 667,
          ),
        ),
      ),
      configuration: ViewConfiguration.fromView(view),
    );

    final pipelineOwner = PipelineOwner();
    final buildOwner = BuildOwner(focusManager: FocusManager());

    pipelineOwner.rootNode = renderView;
    renderView.prepareInitialFrame();

    final rootElement = RenderObjectToWidgetAdapter<RenderBox>(
      container: renderView,
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: widget,
      ),
    ).attachToRenderTree(buildOwner);

    buildOwner.buildScope(rootElement);
    buildOwner.finalizeTree();

    pipelineOwner.flushLayout();
    pipelineOwner.flushCompositingBits();
    pipelineOwner.flushPaint();

    final repaintBoundary = rootElement.findRenderObject() as RenderRepaintBoundary;
    return repaintBoundary;
  }
}

/// 分享海报 Widget
class _SharePosterWidget extends StatelessWidget {
  final String appName;
  final String downloadUrl;
  final String slogan;

  const _SharePosterWidget({
    required this.appName,
    required this.downloadUrl,
    required this.slogan,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 375,
      height: 667,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            const Color(0xFF1A1A1A),
            const Color(0xFF121212),
            const Color(0xFF0A0A0A),
          ],
        ),
      ),
      child: Stack(
        children: [
          // 背景装饰
          Positioned.fill(
            child: CustomPaint(
              painter: _BackgroundPainter(),
            ),
          ),

          // 内容
          Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // 顶部 Logo 和标题
                Column(
                  children: [
                    const SizedBox(height: 40),
                    // Logo
                    Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFC107),
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFFFFC107).withOpacity(0.5),
                            blurRadius: 20,
                            spreadRadius: 5,
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.play_circle_outline,
                        color: Color(0xFF121212),
                        size: 60,
                      ),
                    ),
                    const SizedBox(height: 24),

                    // APP 名称
                    Text(
                      appName,
                      style: const TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFFFC107),
                        letterSpacing: 2,
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Slogan
                    Text(
                      slogan,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 16,
                        color: Colors.white70,
                        letterSpacing: 1,
                      ),
                    ),
                  ],
                ),

                // 中间特性展示
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: const Color(0xFFFFC107).withOpacity(0.3),
                      width: 1,
                    ),
                  ),
                  child: Column(
                    children: [
                      _buildFeature(Icons.hd, '高清画质'),
                      const SizedBox(height: 16),
                      _buildFeature(Icons.speed, '极速播放'),
                      const SizedBox(height: 16),
                      _buildFeature(Icons.update, '实时更新'),
                    ],
                  ),
                ),

                // 底部二维码
                Column(
                  children: [
                    const Text(
                      '扫码下载',
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.white54,
                      ),
                    ),
                    const SizedBox(height: 12),

                    // 二维码
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: QrImageView(
                        data: downloadUrl,
                        version: QrVersions.auto,
                        size: 120,
                        backgroundColor: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 12),

                    const Text(
                      '长按识别二维码',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.white38,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 构建特性项
  Widget _buildFeature(IconData icon, String text) {
    return Row(
      children: [
        Icon(
          icon,
          color: const Color(0xFFFFC107),
          size: 24,
        ),
        const SizedBox(width: 12),
        Text(
          text,
          style: const TextStyle(
            fontSize: 16,
            color: Colors.white,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

/// 背景装饰画笔
class _BackgroundPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.fill
      ..color = const Color(0xFFFFC107).withOpacity(0.05);

    // 绘制装饰圆圈
    canvas.drawCircle(
      Offset(size.width * 0.2, size.height * 0.3),
      100,
      paint,
    );

    canvas.drawCircle(
      Offset(size.width * 0.8, size.height * 0.7),
      80,
      paint,
    );

    // 绘制装饰线条
    final linePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = const Color(0xFFFFC107).withOpacity(0.1);

    final path = Path()
      ..moveTo(0, size.height * 0.5)
      ..quadraticBezierTo(
        size.width * 0.5,
        size.height * 0.3,
        size.width,
        size.height * 0.5,
      );

    canvas.drawPath(path, linePaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
