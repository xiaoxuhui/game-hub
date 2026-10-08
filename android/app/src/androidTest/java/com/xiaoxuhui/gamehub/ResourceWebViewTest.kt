package com.xiaoxuhui.gamehub

import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class ResourceWebViewTest {
    private var guardReason = ""
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private fun await(latch: CountDownLatch) { assertTrue("WebView callback timed out", latch.await(20, TimeUnit.SECONDS)) }
    private fun js(view: WebView, script: String): String {
        val latch = CountDownLatch(1); var value = ""
        instrumentation.runOnMainSync { view.evaluateJavascript(script) { value = it; latch.countDown() } }
        await(latch); return value
    }
    private fun page(): WebView {
        val latch = CountDownLatch(1); lateinit var view: WebView
        instrumentation.runOnMainSync {
            view = WebView(context).apply {
                settings.javaScriptEnabled = true; settings.domStorageEnabled = true; settings.blockNetworkLoads = true
                webViewClient = object : WebViewClient() { override fun onPageFinished(v: WebView, url: String) { latch.countDown() } }
                loadDataWithBaseURL("https://appassets.androidplatform.net/runtime/test", "<!doctype html><title>Test</title>", "text/html", "UTF-8", null)
            }
        }
        await(latch); return view
    }
    private fun guard(paths: Set<String>): Boolean {
        val latch = CountDownLatch(1); var ok = false
        instrumentation.runOnMainSync { ResourceCacheGuard.inspectAndClear(context, paths) { result, reason -> ok = result; guardReason = reason; latch.countDown() } }
        await(latch); return ok
    }
    @Test fun registeredCacheIsRemovedAndActualLightSaveIsPreservedButUnknownCacheBlocks() {
        val view = page()
        try {
            // The actual game's schema/key, not a private marker. Full bidirectional game tests follow in M6.
            js(view, "localStorage.setItem('light-game/save', JSON.stringify({schema:'light-game/save',version:1,stars:{'level-1':2},boards:{},snapshots:[]})); window.testReady=false; caches.open('resource-test').then(c=>c.put('/assets/games/light/index.html',new Response('old'))).then(()=>window.testReady=true)")
            val until = System.currentTimeMillis() + 10000
            while (js(view, "window.testReady") != "true" && System.currentTimeMillis() < until) Thread.sleep(50)
            assertEquals("true", js(view, "window.testReady"))
            val cleared = guard(setOf("/assets/games/light/index.html"))
            assertTrue(guardReason, cleared)
            assertEquals("2", js(view, "JSON.parse(localStorage.getItem('light-game/save')).stars['level-1']"))
            js(view, "window.testReady=false; caches.open('unknown-test').then(c=>c.put('/unknown-saved-document',new Response('preserve'))).then(()=>window.testReady=true)")
            val second = System.currentTimeMillis() + 10000
            while (js(view, "window.testReady") != "true" && System.currentTimeMillis() < second) Thread.sleep(50)
            assertEquals("true", js(view, "window.testReady")); assertFalse(guard(setOf("/assets/games/light/index.html")))
            assertEquals("2", js(view, "JSON.parse(localStorage.getItem('light-game/save')).stars['level-1']"))
            js(view, "caches.delete('unknown-test')")
        } finally { instrumentation.runOnMainSync { view.destroy() } }
    }
    @Test fun builtinResolverLoadsRealGameAtStableOriginAndRejectsOtherGameResources() {
        val manifest = context.assets.open("bundle-manifest.json").bufferedReader().use { JSONObject(it.readText()) }
        val files = manifest.getJSONArray("files")
        val paths = (0 until files.length()).map { "/assets/" + files.getJSONObject(it).getString("path") }.toSet()
        val session = ResourceSession(null, null) {}
        val resolver = GameContentResolver(context.assets, "light", session, paths)
        val latch = CountDownLatch(1); lateinit var view: WebView
        instrumentation.runOnMainSync {
            view = WebView(context).apply {
                settings.javaScriptEnabled = true; settings.domStorageEnabled = true; settings.blockNetworkLoads = true
                webViewClient = object : WebViewClient() {
                    override fun shouldInterceptRequest(v: WebView, request: WebResourceRequest): WebResourceResponse = resolver.response(request.url)
                    override fun onPageFinished(v: WebView, url: String) { latch.countDown() }
                }
                loadUrl("https://appassets.androidplatform.net/assets/games/light/index.html")
            }
        }
        try {
            await(latch)
            assertEquals("\"https://appassets.androidplatform.net\"", js(view, "location.origin"))
            assertEquals("\"function\"", js(view, "typeof LightStorage.createStore"))
            assertEquals(404, resolver.response(android.net.Uri.parse("https://appassets.androidplatform.net/assets/games/conway/index.html")).statusCode)
            assertEquals(404, resolver.response(android.net.Uri.parse("https://example.com/index.html")).statusCode)
        } finally { instrumentation.runOnMainSync { view.destroy() }; session.close() }
    }
}
