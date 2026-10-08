package com.xiaoxuhui.gamehub

import android.content.Context
import android.os.Build
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import androidx.webkit.ServiceWorkerClientCompat
import androidx.webkit.ServiceWorkerControllerCompat
import androidx.webkit.WebViewFeature
import java.io.File
import java.util.concurrent.atomic.AtomicReference

internal class ResourceRuntime private constructor(context: Context) {
    private val app = context.applicationContext
    val publicKey = app.resources.openRawResource(R.raw.resource_public_key).use { ResourceIo.readBounded(it, 4096) }
    private val packageInfo = app.packageManager.getPackageInfo(app.packageName, 0)
    val hostCode = if (Build.VERSION.SDK_INT >= 28) packageInfo.longVersionCode.toInt() else packageInfo.versionCode
    val store = GameResourceStore(File(app.filesDir, "game-resources"), hostCode, publicKey)
    private val resolver = AtomicReference<GameContentResolver?>(null)
    fun bind(content: GameContentResolver?) { resolver.set(content) }
    fun unbind(content: GameContentResolver?) { if (content != null) resolver.compareAndSet(content, null) }
    fun prepareWorkerInterceptor() {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(object : ServiceWorkerClientCompat() {
                override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse = resolver.get()?.response(request.url) ?: GameContentResolver.blocked()
            })
        }
    }
    companion object {
        @Volatile private var instance: ResourceRuntime? = null
        fun get(context: Context): ResourceRuntime = instance ?: synchronized(this) { instance ?: ResourceRuntime(context).also { instance = it } }
    }
}
