package com.xiaoxuhui.gamehub

import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class LambdaWatchdogHangTest {
    private val inst = InstrumentationRegistry.getInstrumentation()
    private fun waitFor(latch: CountDownLatch) = assertTrue(latch.await(30, TimeUnit.SECONDS))
    private fun js(view: WebView, code: String): String {
        val latch = CountDownLatch(1); var value = ""
        inst.runOnMainSync { view.evaluateJavascript(code) { value = it; latch.countDown() } }
        waitFor(latch); return value
    }
    private fun fixtureView(): WebView {
        val url = "https://${AssetAccessPolicy.hostFor("lambda-diagram-game")}/runtime/watchdog-seed"
        val ready = CountDownLatch(1); lateinit var view: WebView
        inst.runOnMainSync {
            WebViewCookiePolicy.disable()
            view = WebView(inst.targetContext).apply {
                WebViewCookiePolicy.configure(this); settings.javaScriptEnabled = true; settings.domStorageEnabled = true; settings.blockNetworkLoads = true
                webViewClient = object : WebViewClient() {
                    override fun shouldInterceptRequest(v: WebView, r: WebResourceRequest): WebResourceResponse =
                        if (r.url.toString() == url) WebResourceResponse("text/html", "UTF-8", 200, "OK", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream("<!doctype html>".toByteArray())) else GameContentResolver.blocked()
                    override fun onPageFinished(v: WebView, u: String) { ready.countDown() }
                }
                loadUrl(url)
            }
        }
        waitFor(ready); return view
    }
    @Test fun blockedGameRendererTriggersLobbyExport() {
        val key = "lambda-lab-hub-before-run-v1.watchdog-test"; val index = "lambda-lab-hub-before-run-latest-v1"
        val saved = "{\"version\":2,\"draft\":\"before-freeze\",\"session\":{\"steps\":0}}"
        var seeded = false; val seed = fixtureView()
        try {
            assumeTrue("existing backup must not be modified", js(seed, "localStorage.getItem('$index')===null&&localStorage.getItem('$key')===null") == "true")
            js(seed, "localStorage.setItem('$key',${org.json.JSONObject.quote(saved)});localStorage.setItem('$index','$key');true"); seeded = true
        } finally { inst.runOnMainSync { seed.destroy() } }
        try {
            ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                lateinit var exports: DocumentExportFlow
                scenario.onActivity { activity ->
                    exports = ViewModelProvider(activity)[DocumentExportFlow::class.java]
                    val type = MainActivity::class.java.declaredClasses.single { it.simpleName == "Game" }
                    val descriptor = type.declaredConstructors.single().apply { isAccessible = true }
                        .newInstance("lambda-diagram-game", "Lambda", "test", "a".repeat(40), "index.html")
                    MainActivity::class.java.getDeclaredField("currentGame").apply { isAccessible = true }.set(activity, descriptor)
                    val view = WebView(activity).apply {
                        settings.javaScriptEnabled = true
                        webViewClient = object : WebViewClient() {
                            override fun onRenderProcessGone(v: WebView, d: android.webkit.RenderProcessGoneDetail) = true
                        }
                    }
                    val root = MainActivity::class.java.getDeclaredField("root").apply { isAccessible = true }.get(activity) as FrameLayout
                    root.addView(view)
                    MainActivity::class.java.getDeclaredField("webView").apply { isAccessible = true }.set(activity, view)
                    MainActivity::class.java.getDeclaredMethod("startGameWatchdog").apply { isAccessible = true }.invoke(activity)
                    view.loadDataWithBaseURL("https://lambda-diagram-game.appassets.androidplatform.net/", "<script>setTimeout(()=>{while(true){}},100)</script>", "text/html", "UTF-8", null)
                }
                val deadline = System.currentTimeMillis() + 50000
                while (exports.pending == null && System.currentTimeMillis() < deadline) Thread.sleep(100)
                assertEquals("watchdog did not offer the pre-run backup", saved, exports.pending?.content)
                inst.uiAutomation.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK)
            }
        } finally {
            if (seeded) {
                val cleanup = fixtureView()
                try { js(cleanup, "if(localStorage.getItem('$index')==='$key'&&localStorage.getItem('$key')===${org.json.JSONObject.quote(saved)}){localStorage.removeItem('$key');localStorage.removeItem('$index')};true") }
                finally { inst.runOnMainSync { cleanup.destroy() } }
            }
        }
    }
}
