package com.xiaoxuhui.gamehub

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import org.json.JSONArray
import org.json.JSONObject

internal object ResourceCacheGuard {
    data class Assessment(val canActivate: Boolean, val canPlay: Boolean, val reason: String)
    /** Only registered resource URLs may be removed. Unknown CacheStorage is preserved and blocks activation. */
    @SuppressLint("SetJavaScriptEnabled")
    fun inspectAndClear(context: Context, registeredPaths: Set<String>, result: (Assessment) -> Unit) {
        inspect(context, registeredPaths, true, result)
    }
    @SuppressLint("SetJavaScriptEnabled")
    private fun inspect(context: Context, registeredPaths: Set<String>, mayRecreate: Boolean, result: (Assessment) -> Unit) {
        val handler = Handler(Looper.getMainLooper()); val view = WebView(context)
        var finished = false; val deadline = android.os.SystemClock.elapsedRealtime() + 10000
        fun finish(ok: Boolean, safe: Boolean, message: String) { if (finished) return; finished = true; view.stopLoading(); view.destroy(); result(Assessment(ok, safe, message)) }
        val paths = JSONArray(registeredPaths.sorted().map { "https://appassets.androidplatform.net$it" }).toString()
        val script = SCRIPT.replace("__PATHS__", paths)
        fun poll() {
            if (finished) return
            if (android.os.SystemClock.elapsedRealtime() >= deadline) { finish(false, false, "缓存检查超时，未启动游戏；资源和存档保留"); return }
            view.evaluateJavascript("window.__gameHubCacheCheck || null") { raw ->
                if (finished) return@evaluateJavascript
                if (raw == "null") handler.postDelayed({ poll() }, 50)
                else runCatching { JSONObject(raw) }.onSuccess {
                    if (it.optBoolean("recreate") && mayRecreate) {
                        finished = true; view.stopLoading(); view.destroy()
                        handler.post { inspect(context, registeredPaths, false, result) }
                    } else finish(it.optBoolean("ok"), it.optBoolean("safe"), it.optString("reason"))
                }.onFailure { finish(false, false, "缓存检查结果无效，未启动游戏") }
            }
        }
        view.settings.apply { javaScriptEnabled = true; domStorageEnabled = true; allowFileAccess = false; allowContentAccess = false; blockNetworkLoads = true; cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE }
        view.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(webView: WebView, request: WebResourceRequest): WebResourceResponse {
                if (request.url.toString() != "https://appassets.androidplatform.net/runtime/cache-check") return GameContentResolver.blocked()
                return WebResourceResponse("text/html", "UTF-8", 200, "OK", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream("<!doctype html><meta charset=utf-8><title>缓存检查</title>".toByteArray()))
            }
            override fun onPageFinished(webView: WebView, url: String) { if (!finished) view.evaluateJavascript(script) { poll() } }
        }
        handler.postDelayed({ if (!finished) finish(false, false, "缓存检查超时，未启动游戏；资源和存档保留") }, 10000)
        view.loadUrl("https://appassets.androidplatform.net/runtime/cache-check")
    }
    private val SCRIPT = """
        (function () {
          if (window.__gameHubCacheStarted) return;
          window.__gameHubCacheStarted = true;
          var paths = new Set(__PATHS__);
          var origin = 'https://appassets.androidplatform.net';
          function relevant(reg) {
            return reg.scope.startsWith(origin + '/assets/games/') || Array.from(paths).some(function (p) { return p.startsWith(reg.scope); });
          }
          (async function () {
            var registrations = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : [];
            for (var reg of registrations.filter(relevant)) {
              if (!await reg.unregister()) throw new Error('无法解除旧Service Worker');
            }
            var remaining = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : [];
            if (remaining.some(relevant)) throw new Error('旧Service Worker仍在注册');
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
              window.__gameHubCacheCheck = { ok: false, safe: false, recreate: true, reason: '旧Service Worker仍控制页面，未启动游戏' };
              return;
            }
            var names = window.caches ? await caches.keys() : [];
            var resources = [];
            for (var name of names) {
              var cache = await caches.open(name);
              var requests = await cache.keys();
              for (var request of requests) {
                if (request.method !== 'GET' || !paths.has(request.url.split(/[?#]/)[0])) {
                  window.__gameHubCacheCheck = { ok: false, safe: true, reason: '发现用途不明的缓存，未删除存档或缓存；暂停激活，使用旧资源' };
                  return;
                }
              }
              resources.push({ name: name, cache: cache, requests: requests });
            }
            for (var group of resources) {
              for (var request of group.requests) { if (!await group.cache.delete(request)) throw new Error('无法清理资源缓存'); }
              if ((await group.cache.keys()).length === 0) await caches.delete(group.name);
            }
            remaining = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : [];
            if (remaining.some(relevant)) throw new Error('旧Service Worker仍在注册');
            if (window.caches && (await caches.keys()).length) throw new Error('缓存发生并发变化');
            window.__gameHubCacheCheck = { ok: true, safe: true, reason: '资源缓存已核验；存档保留' };
          })().catch(function (error) { window.__gameHubCacheCheck = { ok: false, safe: false, reason: error.message || '缓存检查失败，未启动游戏' }; });
        })();
    """.trimIndent()
}
