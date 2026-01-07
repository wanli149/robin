# Flutter相关
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-keep class io.flutter.embedding.** { *; }

# video_player
-keep class io.flutter.plugins.videoplayer.** { *; }

# WebView
-keep class io.flutter.plugins.webviewflutter.** { *; }

# Google Play Core (Flutter deferred components)
-dontwarn com.google.android.play.core.**
-keep class com.google.android.play.core.** { *; }

# 保留注解
-keepattributes *Annotation*

# 保留行号用于调试
-keepattributes SourceFile,LineNumberTable

# 移除日志
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}

# ============================================
# 防反编译增强配置
# ============================================

# 混淆字典（使用更难读的名称）
-obfuscationdictionary proguard-dict.txt
-classobfuscationdictionary proguard-dict.txt
-packageobfuscationdictionary proguard-dict.txt

# 优化选项
-optimizationpasses 5
-allowaccessmodification
-dontpreverify
-repackageclasses ''

# 移除调试信息
-renamesourcefileattribute SourceFile

# 隐藏原始类名
-keepattributes Exceptions,InnerClasses,Signature,Deprecated,EnclosingMethod

# 防止反射攻击
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# 加密字符串（需要配合代码实现）
# 敏感信息不要硬编码在代码中

# 防止动态调试
-keepclassmembers class * {
    native <methods>;
}
