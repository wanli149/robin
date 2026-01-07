package com.fetch.video

import android.app.PictureInPictureParams
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Build
import android.util.Rational
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.security.MessageDigest

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.fetch.video/pip"
    private val INTEGRITY_CHANNEL = "com.fetch.video/integrity"
    private var methodChannel: MethodChannel? = null
    private var integrityChannel: MethodChannel? = null
    private var isVideoPlaying = false
    private var isInPipMode = false

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        
        // PIP Channel
        methodChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
        methodChannel?.setMethodCallHandler { call, result ->
            when (call.method) {
                "enterPipMode" -> {
                    if (enterPipMode()) {
                        result.success(true)
                    } else {
                        result.error("PIP_FAILED", "Failed to enter PIP mode", null)
                    }
                }
                "isPipSupported" -> {
                    result.success(isPipSupported())
                }
                "setVideoPlaying" -> {
                    val isPlaying = call.arguments as Boolean
                    println("🎬 [Video] Playing state: $isPlaying")
                    isVideoPlaying = isPlaying
                    result.success(null)
                }
                "getDebugInfo" -> {
                    val debugInfo = mapOf(
                        "isVideoPlaying" to isVideoPlaying,
                        "isInPipMode" to isInPipMode,
                        "isPipSupported" to isPipSupported(),
                        "apiLevel" to Build.VERSION.SDK_INT
                    )
                    result.success(debugInfo)
                }
                else -> {
                    result.notImplemented()
                }
            }
        }
        
        // Integrity Channel - 用于 APP 完整性验证
        integrityChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, INTEGRITY_CHANNEL)
        integrityChannel?.setMethodCallHandler { call, result ->
            when (call.method) {
                "getSignatureHash" -> {
                    result.success(getAppSignatureHash())
                }
                "getPackageName" -> {
                    result.success(packageName)
                }
                "isDebuggable" -> {
                    result.success(isAppDebuggable())
                }
                else -> {
                    result.notImplemented()
                }
            }
        }
    }
    
    /// 获取 APP 签名哈希
    private fun getAppSignatureHash(): String? {
        return try {
            val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
            } else {
                @Suppress("DEPRECATION")
                packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNATURES)
            }
            
            val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo.signingInfo?.apkContentsSigners
            } else {
                @Suppress("DEPRECATION")
                packageInfo.signatures
            }
            
            signatures?.firstOrNull()?.let { signature ->
                val md = MessageDigest.getInstance("SHA-256")
                val digest = md.digest(signature.toByteArray())
                digest.joinToString("") { "%02x".format(it) }
            }
        } catch (e: Exception) {
            println("❌ Failed to get signature: ${e.message}")
            null
        }
    }
    
    /// 检查 APP 是否可调试
    private fun isAppDebuggable(): Boolean {
        return (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0
    }

    private fun enterPipMode(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && isPipSupported()) {
            try {
                println("🎬 [PIP] Entering PIP mode...")
                val aspectRatio = Rational(16, 9)
                val params = PictureInPictureParams.Builder()
                    .setAspectRatio(aspectRatio)
                    .build()
                
                enterPictureInPictureMode(params)
            } catch (e: Exception) {
                println("❌ [PIP] Failed to enter PIP: ${e.message}")
                false
            }
        } else {
            false
        }
    }

    private fun isPipSupported(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            packageManager.hasSystemFeature("android.software.picture_in_picture")
        } else {
            false
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        println("🎬 [Lifecycle] onUserLeaveHint - video: $isVideoPlaying, pip: $isInPipMode")
        
        if (isVideoPlaying && !isInPipMode) {
            enterPipMode()
        }
    }

    override fun onPictureInPictureModeChanged(
        isInPictureInPictureMode: Boolean,
        newConfig: Configuration
    ) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        
        println("🎬 [PIP] Mode changed: $isInPictureInPictureMode")
        isInPipMode = isInPictureInPictureMode
        
        // 关键：通知Flutter但不暂停播放器
        methodChannel?.invokeMethod("onPipModeChanged", mapOf(
            "isInPipMode" to isInPictureInPictureMode,
            "keepPlaying" to true  // 告诉Flutter保持播放
        ))
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        println("🎬 [Lifecycle] onNewIntent - restoring from PIP")
        // 从PIP返回时，确保恢复到正确的页面
        methodChannel?.invokeMethod("onRestoreFromPip", null)
    }

    // 重要：不要在PIP模式下调用onPause/onStop暂停播放
    override fun onPause() {
        super.onPause()
        println("🎬 [Lifecycle] onPause - pip: $isInPipMode")
        // 只有在非PIP模式下才通知暂停
        if (!isInPipMode) {
            methodChannel?.invokeMethod("onAppPaused", null)
        }
    }

    override fun onResume() {
        super.onResume()
        println("🎬 [Lifecycle] onResume - pip: $isInPipMode")
        if (!isInPipMode) {
            methodChannel?.invokeMethod("onAppResumed", null)
        }
    }
}