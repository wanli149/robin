import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:get/get.dart';

/// WebView 页面
/// 用于加载网页内容，支持前进后退和刷新
class WebViewPage extends StatefulWidget {
  final String url;
  final String? title;

  const WebViewPage({
    super.key,
    required this.url,
    this.title,
  });

  @override
  State<WebViewPage> createState() => _WebViewPageState();
}

class _WebViewPageState extends State<WebViewPage> {
  late final WebViewController _controller;
  final RxDouble _loadingProgress = 0.0.obs;
  final RxBool _canGoBack = false.obs;
  final RxBool _canGoForward = false.obs;
  final RxString _currentTitle = ''.obs;

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  /// 初始化 WebView
  void _initWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF121212))
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            _loadingProgress.value = progress / 100.0;
          },
          onPageStarted: (String url) {
            _loadingProgress.value = 0.0;
          },
          onPageFinished: (String url) {
            _loadingProgress.value = 1.0;
            _updateNavigationState();
            _updateTitle();
          },
          onWebResourceError: (WebResourceError error) {
            print('❌ WebView error: ${error.description}');
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.url));

    // 设置初始标题
    if (widget.title != null) {
      _currentTitle.value = widget.title!;
    }
  }

  /// 更新导航状态
  Future<void> _updateNavigationState() async {
    _canGoBack.value = await _controller.canGoBack();
    _canGoForward.value = await _controller.canGoForward();
  }

  /// 更新标题
  Future<void> _updateTitle() async {
    if (widget.title == null) {
      final title = await _controller.getTitle();
      if (title != null && title.isNotEmpty) {
        _currentTitle.value = title;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        backgroundColor: const Color(0xFF121212),
        elevation: 0,
        title: Obx(() => Text(
              _currentTitle.value.isEmpty ? '加载中...' : _currentTitle.value,
              style: const TextStyle(fontSize: 16),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            )),
        actions: [
          // 刷新按钮
          IconButton(
            onPressed: () {
              _controller.reload();
            },
            icon: const Icon(Icons.refresh),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(2),
          child: Obx(() {
            if (_loadingProgress.value < 1.0) {
              return LinearProgressIndicator(
                value: _loadingProgress.value,
                backgroundColor: Colors.transparent,
                valueColor: const AlwaysStoppedAnimation<Color>(
                  Color(0xFFFFC107),
                ),
              );
            }
            return const SizedBox.shrink();
          }),
        ),
      ),
      body: WebViewWidget(controller: _controller),
      bottomNavigationBar: _buildBottomBar(),
    );
  }

  /// 构建底部导航栏
  Widget _buildBottomBar() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              // 后退按钮
              Obx(() => IconButton(
                    onPressed: _canGoBack.value
                        ? () async {
                            await _controller.goBack();
                            _updateNavigationState();
                          }
                        : null,
                    icon: Icon(
                      Icons.arrow_back_ios,
                      color: _canGoBack.value
                          ? const Color(0xFFFFC107)
                          : Colors.white24,
                    ),
                  )),

              // 前进按钮
              Obx(() => IconButton(
                    onPressed: _canGoForward.value
                        ? () async {
                            await _controller.goForward();
                            _updateNavigationState();
                          }
                        : null,
                    icon: Icon(
                      Icons.arrow_forward_ios,
                      color: _canGoForward.value
                          ? const Color(0xFFFFC107)
                          : Colors.white24,
                    ),
                  )),

              // 刷新按钮
              IconButton(
                onPressed: () {
                  _controller.reload();
                },
                icon: const Icon(
                  Icons.refresh,
                  color: Color(0xFFFFC107),
                ),
              ),

              // 关闭按钮
              IconButton(
                onPressed: () {
                  Get.back();
                },
                icon: const Icon(
                  Icons.close,
                  color: Color(0xFFFFC107),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
