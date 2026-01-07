import 'package:flutter/material.dart';
import 'dart:ui';

/// 应用主题配置
/// 定义暗黑主题、琥珀金主色调和磨砂玻璃效果
class AppTheme {
  // 私有构造函数，防止实例化
  AppTheme._();

  // ==================== 颜色定义 ====================
  
  /// 背景色 - 深黑色
  static const Color backgroundColor = Color(0xFF121212);
  
  /// 表面色 - 稍浅的黑色
  static const Color surfaceColor = Color(0xFF1E1E1E);
  
  /// 卡片色
  static const Color cardColor = Color(0xFF2A2A2A);
  
  /// 主色调 - 琥珀金
  static const Color primaryColor = Color(0xFFFFC107);
  
  /// 主色调深色
  static const Color primaryDarkColor = Color(0xFFFFB300);
  
  /// 主色调浅色
  static const Color primaryLightColor = Color(0xFFFFD54F);
  
  /// 强调色 - 金色
  static const Color accentColor = Color(0xFFFFD700);
  
  /// 文字主色 - 白色
  static const Color textPrimaryColor = Colors.white;
  
  /// 文字次要色 - 半透明白色
  static const Color textSecondaryColor = Colors.white70;
  
  /// 文字禁用色 - 更透明的白色
  static const Color textDisabledColor = Colors.white38;
  
  /// 文字提示色
  static const Color textHintColor = Colors.white54;
  
  /// 分割线颜色
  static const Color dividerColor = Color(0xFF2A2A2A);
  
  /// 错误色
  static const Color errorColor = Color(0xFFCF6679);
  
  /// 成功色
  static const Color successColor = Color(0xFF4CAF50);
  
  /// 警告色
  static const Color warningColor = Color(0xFFFF9800);
  
  // ==================== 渐变色定义 ====================
  
  /// 金色渐变
  static const LinearGradient goldGradient = LinearGradient(
    colors: [Color(0xFFFFD700), Color(0xFFFFC107)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  
  /// VIP 渐变
  static const LinearGradient vipGradient = LinearGradient(
    colors: [Color(0xFFFFD700), Color(0xFFFFC107)],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );
  
  /// 背景渐变
  static LinearGradient backgroundGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      primaryColor.withOpacity(0.2),
      backgroundColor,
    ],
  );
  
  // ==================== 主题数据 ====================
  
  /// 暗黑主题
  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      primaryColor: primaryColor,
      scaffoldBackgroundColor: backgroundColor,
      
      // 颜色方案
      colorScheme: const ColorScheme.dark(
        primary: primaryColor,
        secondary: primaryColor,
        surface: surfaceColor,
        background: backgroundColor,
        error: errorColor,
        onPrimary: Colors.black,
        onSecondary: Colors.black,
        onSurface: textPrimaryColor,
        onBackground: textPrimaryColor,
        onError: Colors.white,
      ),
      
      // AppBar 主题
      appBarTheme: const AppBarTheme(
        backgroundColor: backgroundColor,
        elevation: 0,
        centerTitle: false,
        iconTheme: IconThemeData(color: textPrimaryColor),
        titleTextStyle: TextStyle(
          color: textPrimaryColor,
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      ),
      
      // 卡片主题
      cardTheme: CardThemeData(
        color: surfaceColor,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      
      // 按钮主题
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: Colors.black,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: primaryColor,
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
      
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primaryColor,
          side: const BorderSide(color: primaryColor),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      
      // 输入框主题
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceColor,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primaryColor, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: errorColor),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        hintStyle: const TextStyle(color: textHintColor),
      ),
      
      // 图标主题
      iconTheme: const IconThemeData(
        color: textPrimaryColor,
        size: 24,
      ),
      
      // 分割线主题
      dividerTheme: const DividerThemeData(
        color: dividerColor,
        thickness: 1,
        space: 1,
      ),
      
      // 底部导航栏主题
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: surfaceColor,
        selectedItemColor: primaryColor,
        unselectedItemColor: textDisabledColor,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
      
      // 对话框主题
      dialogTheme: DialogThemeData(
        backgroundColor: surfaceColor,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        titleTextStyle: const TextStyle(
          color: textPrimaryColor,
          fontSize: 20,
          fontWeight: FontWeight.w600,
        ),
        contentTextStyle: const TextStyle(
          color: textSecondaryColor,
          fontSize: 16,
        ),
      ),
      
      // 进度指示器主题
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: primaryColor,
      ),
      
      // 文字主题
      textTheme: const TextTheme(
        displayLarge: TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.bold,
          color: textPrimaryColor,
        ),
        displayMedium: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.bold,
          color: textPrimaryColor,
        ),
        displaySmall: TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.bold,
          color: textPrimaryColor,
        ),
        headlineLarge: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w600,
          color: textPrimaryColor,
        ),
        headlineMedium: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: textPrimaryColor,
        ),
        headlineSmall: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: textPrimaryColor,
        ),
        titleLarge: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w500,
          color: textPrimaryColor,
        ),
        titleMedium: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w500,
          color: textPrimaryColor,
        ),
        titleSmall: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: textPrimaryColor,
        ),
        bodyLarge: TextStyle(
          fontSize: 16,
          color: textPrimaryColor,
        ),
        bodyMedium: TextStyle(
          fontSize: 14,
          color: textPrimaryColor,
        ),
        bodySmall: TextStyle(
          fontSize: 12,
          color: textSecondaryColor,
        ),
        labelLarge: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: textPrimaryColor,
        ),
        labelMedium: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          color: textSecondaryColor,
        ),
        labelSmall: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w500,
          color: textHintColor,
        ),
      ),
    );
  }
  
  // ==================== 磨砂玻璃效果 ====================
  
  /// 创建磨砂玻璃效果的容器
  static Widget frostedGlass({
    required Widget child,
    double blur = 10.0,
    Color? color,
    BorderRadius? borderRadius,
  }) {
    return ClipRRect(
      borderRadius: borderRadius ?? BorderRadius.circular(12),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: Container(
          decoration: BoxDecoration(
            color: color ?? surfaceColor.withOpacity(0.7),
            borderRadius: borderRadius ?? BorderRadius.circular(12),
            border: Border.all(
              color: Colors.white.withOpacity(0.1),
              width: 1,
            ),
          ),
          child: child,
        ),
      ),
    );
  }
  
  /// 创建磨砂玻璃效果的底部导航栏
  static Widget frostedBottomBar({
    required Widget child,
    double blur = 10.0,
  }) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: Container(
          decoration: BoxDecoration(
            color: surfaceColor.withOpacity(0.8),
            border: Border(
              top: BorderSide(
                color: Colors.white.withOpacity(0.1),
                width: 1,
              ),
            ),
          ),
          child: child,
        ),
      ),
    );
  }
  
  // ==================== 阴影效果 ====================
  
  /// 卡片阴影
  static List<BoxShadow> get cardShadow => [
        BoxShadow(
          color: Colors.black.withOpacity(0.2),
          blurRadius: 8,
          offset: const Offset(0, 2),
        ),
      ];
  
  /// 浮动阴影
  static List<BoxShadow> get floatingShadow => [
        BoxShadow(
          color: Colors.black.withOpacity(0.3),
          blurRadius: 12,
          offset: const Offset(0, 4),
        ),
      ];
  
  // ==================== 圆角半径 ====================
  
  /// 小圆角
  static const double radiusSmall = 8.0;
  
  /// 中等圆角
  static const double radiusMedium = 12.0;
  
  /// 大圆角
  static const double radiusLarge = 16.0;
  
  /// 超大圆角
  static const double radiusXLarge = 24.0;
  
  // ==================== 间距 ====================
  
  /// 超小间距
  static const double spacingXSmall = 4.0;
  
  /// 小间距
  static const double spacingSmall = 8.0;
  
  /// 中等间距
  static const double spacingMedium = 16.0;
  
  /// 大间距
  static const double spacingLarge = 24.0;
  
  /// 超大间距
  static const double spacingXLarge = 32.0;
}
