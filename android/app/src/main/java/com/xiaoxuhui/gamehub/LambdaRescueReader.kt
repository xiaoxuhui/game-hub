package com.xiaoxuhui.gamehub

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebView
import android.webkit.WebViewClient
import java.io.ByteArrayInputStream
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONObject

/** Reads a pre-run snapshot from the game origin without loading the game. */
internal object LambdaRescueReader {
    sealed class Result {
        data class Found(val content: String) : Result()
        data class Unavailable(val reason: String) : Result()
    }
    @SuppressLint("SetJavaScriptEnabled")
    fun read(context: Context, gameId: String = "lambda-diagram-game", result: (Result) -> Unit) {
        require(Looper.myLooper() == Looper.getMainLooper())
        require(DynamicGamePolicy.validId(gameId))
        WebViewCookiePolicy.disable()
        val handler = Handler(Looper.getMainLooper())
        val view = WebView(context)
        WebViewCookiePolicy.configure(view)
        val origin = "https://${AssetAccessPolicy.hostFor(gameId)}"
        val url = "$origin/runtime/lambda-rescue"
        val responseServed = AtomicBoolean(false)
        var finished = false
        fun finish(value: Result) {
            if (finished) return
            finished = true
            view.stopLoading()
            view.destroy()
            result(value)
        }
        view.settings.apply {
            javaScriptEnabled = true; domStorageEnabled = true
            blockNetworkLoads = true; allowFileAccess = false; allowContentAccess = false
            cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
        }
        view.webViewClient = object : WebViewClient() {
            override fun onRenderProcessGone(webView: WebView, detail: RenderProcessGoneDetail): Boolean {
                finish(Result.Unavailable("备份检查进程已停止，原存档保持不变"))
                return true
            }
            override fun shouldInterceptRequest(webView: WebView, request: WebResourceRequest): WebResourceResponse {
                if (!request.isForMainFrame || request.url.toString() != url) return GameContentResolver.blocked()
                responseServed.set(true)
                return WebResourceResponse("text/html", "UTF-8", 200, "OK", mapOf("Cache-Control" to "no-store"),
                    ByteArrayInputStream("<!doctype html><meta charset=utf-8><title>本机备份检查</title>".toByteArray()))
            }
            override fun onPageFinished(webView: WebView, pageUrl: String) {
                if (finished) return
                if (pageUrl != url || !responseServed.get()) {
                    finish(Result.Unavailable("备份检查页面未通过校验，原存档保持不变")); return
                }
                webView.evaluateJavascript(SCRIPT) { value ->
                    if (finished) return@evaluateJavascript
                    val parsed = runCatching { JSONObject(value) }.getOrNull()
                    val content = parsed?.optString("content")
                    val valid = content != null && content.toByteArray(Charsets.UTF_8).size <= MAX_BYTES && runCatching {
                        val archive = JSONObject(content)
                        archive.optInt("version") in 2..4 && archive.opt("draft") is String && archive.opt("session") is JSONObject
                    }.getOrDefault(false)
                    if (parsed?.optString("status") == "ok" && valid) finish(Result.Found(content!!))
                    else finish(Result.Unavailable(parsed?.optString("reason")?.takeIf { it.isNotBlank() } ?: "未找到可读取的运行前备份"))
                }
            }
        }
        handler.postDelayed({ if (!finished) finish(Result.Unavailable("备份检查超时，原存档保持不变")) }, 10000)
        view.loadUrl(url)
    }
    private const val MAX_BYTES = 2 * 1024 * 1024
    private val SCRIPT = """
        (function(){try{
          if(navigator.serviceWorker && navigator.serviceWorker.controller)return {status:'error',reason:'备份检查被旧服务工作线程控制'};
          var prefix='lambda-lab-hub-before-run-v1.';
          var key=localStorage.getItem('lambda-lab-hub-before-run-latest-v1');
          if(!key || !key.startsWith(prefix))return {status:'error',reason:'没有运行前备份，原存档保持不变'};
          var content=localStorage.getItem(key);
          if(!content || content.length>2097152)return {status:'error',reason:'运行前备份缺失或超出大小限制'};
          return {status:'ok',content:content};
        }catch(e){return {status:'error',reason:'读取备份失败：'+String(e)};}})()
    """.trimIndent()
}
