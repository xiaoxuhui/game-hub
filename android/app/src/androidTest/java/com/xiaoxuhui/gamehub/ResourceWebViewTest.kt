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
import java.io.ByteArrayInputStream
import androidx.webkit.ServiceWorkerClientCompat
import androidx.webkit.ServiceWorkerControllerCompat

@RunWith(AndroidJUnit4::class)
class ResourceWebViewTest {
    private var guardReason = ""
    private var guardSafe = false
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
                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(v: WebView, url: String) { latch.countDown() }
                    override fun shouldInterceptRequest(v: WebView, request: WebResourceRequest): WebResourceResponse = if (request.url.toString() == "https://appassets.androidplatform.net/runtime/test") html("<!doctype html><title>Test</title>") else GameContentResolver.blocked()
                }
                loadUrl("https://appassets.androidplatform.net/runtime/test")
            }
        }
        await(latch); return view
    }
    private fun html(body: String) = WebResourceResponse("text/html", "UTF-8", 200, "OK", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(body.toByteArray()))
    private fun ready(view: WebView) {
        val until = System.currentTimeMillis() + 10000
        while (js(view, "window.testReady") != "true" && System.currentTimeMillis() < until) Thread.sleep(50)
        assertEquals(js(view, "window.testError || ''"), "true", js(view, "window.testReady"))
    }
    private fun guard(paths: Set<String>): Boolean {
        val latch = CountDownLatch(1); var ok = false
        instrumentation.runOnMainSync { ResourceCacheGuard.inspectAndClear(context, paths) { result -> ok = result.canActivate; guardReason = result.reason; guardSafe = result.canPlay; latch.countDown() } }
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
    @Test fun controllingWorkerCacheCannotSurviveFreshResolverSession() {
        val manifest = context.assets.open("bundle-manifest.json").bufferedReader().use { JSONObject(it.readText()) }
        val files = manifest.getJSONArray("files")
        val paths = (0 until files.length()).map { "/assets/" + files.getJSONObject(it).getString("path") }.toSet()
        val session = ResourceSession(null, null) {}
        val resolver = GameContentResolver(context.assets, "light", session, paths)
        instrumentation.runOnMainSync {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(object : ServiceWorkerClientCompat() {
                override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse {
                    if (request.url.toString() != "https://appassets.androidplatform.net/assets/games/light/test-sw.js") return GameContentResolver.blocked()
                    val source = "self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));"
                    return WebResourceResponse("application/javascript", "UTF-8", 200, "OK", mapOf("Service-Worker-Allowed" to "/", "Cache-Control" to "no-store"), ByteArrayInputStream(source.toByteArray()))
                }
            })
        }
        var setup: WebView? = page(); var gameView: WebView? = null
        fun game(): WebView {
            val latch = CountDownLatch(1); lateinit var view: WebView
            instrumentation.runOnMainSync {
                view = WebView(context).apply {
                    settings.javaScriptEnabled = true; settings.domStorageEnabled = true; settings.blockNetworkLoads = true
                    webViewClient = object : WebViewClient() {
                        override fun shouldInterceptRequest(v: WebView, request: WebResourceRequest) = resolver.response(request.url)
                        override fun onPageFinished(v: WebView, url: String) { latch.countDown() }
                    }
                    loadUrl("https://appassets.androidplatform.net/assets/games/light/index.html")
                }
            }
            await(latch); return view
        }
        try {
            js(setup!!, "window.testReady=false; caches.open('old-worker-resource').then(c=>c.put('/assets/games/light/index.html',new Response('<!doctype html><title>OLD_PROXY</title>',{headers:{'Content-Type':'text/html'}}))).then(()=>navigator.serviceWorker.register('/assets/games/light/test-sw.js',{scope:'/assets/games/light/'})).then(r=>new Promise(resolve=>{if(r.active)resolve();else{let w=r.installing||r.waiting;w.addEventListener('statechange',()=>{if(w.state==='activated')resolve()})}})).then(()=>window.testReady=true).catch(e=>window.testError=e.message)")
            ready(setup!!)
            gameView = game()
            assertEquals("\"OLD_PROXY\"", js(gameView!!, "document.title"))
            assertEquals("true", js(gameView!!, "!!navigator.serviceWorker.controller"))
            instrumentation.runOnMainSync { setup!!.destroy(); gameView!!.destroy() }; setup = null; gameView = null
            val cleared = guard(paths); assertTrue(guardReason, cleared)
            gameView = game()
            assertEquals("null", js(gameView!!, "navigator.serviceWorker.controller"))
            assertEquals("\"function\"", js(gameView!!, "typeof LightStorage.createStore"))
            assertNotEquals("\"OLD_PROXY\"", js(gameView!!, "document.title"))
        } finally {
            instrumentation.runOnMainSync { setup?.destroy(); gameView?.destroy(); ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(object : ServiceWorkerClientCompat() { override fun shouldInterceptRequest(request: WebResourceRequest) = GameContentResolver.blocked() }) }
            session.close()
        }
    }
    @Test fun forgedGuardPageFromRootWorkerCannotAuthorizeBuiltinOrActivation() {
        instrumentation.runOnMainSync {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(object : ServiceWorkerClientCompat() {
                override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse {
                    if (request.url.toString() != "https://appassets.androidplatform.net/spoof-sw.js") return GameContentResolver.blocked()
                    val source = "self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));"
                    return WebResourceResponse("application/javascript", "UTF-8", 200, "OK", mapOf("Service-Worker-Allowed" to "/", "Cache-Control" to "no-store"), ByteArrayInputStream(source.toByteArray()))
                }
            })
        }
        val setup = page()
        try {
            js(setup, "window.testReady=false;caches.open('forged-guard').then(c=>c.put('/runtime/cache-check',new Response('<!doctype html><script>window.__gameHubCacheStarted=true;window.__gameHubCacheCheck={ok:true,safe:true,reason:\"forged\"};</script>',{headers:{'Content-Type':'text/html'}}))).then(()=>navigator.serviceWorker.register('/spoof-sw.js',{scope:'/'})).then(()=>navigator.serviceWorker.ready).then(()=>window.testReady=true).catch(e=>window.testError=e.message)")
            ready(setup)
            assertFalse(guard(setOf("/assets/games/light/index.html")))
            assertFalse(guardReason, guardSafe)
            assertTrue(guardReason, guardReason.contains("旧代理"))
        } finally {
            js(setup, "window.testReady=false;navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister()))).then(()=>caches.delete('forged-guard')).then(()=>window.testReady=true)")
            ready(setup)
            instrumentation.runOnMainSync { setup.destroy(); ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(object : ServiceWorkerClientCompat() { override fun shouldInterceptRequest(request: WebResourceRequest) = GameContentResolver.blocked() }) }
        }
    }
}
