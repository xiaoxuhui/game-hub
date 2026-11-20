package com.xiaoxuhui.gamehub

import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Uses a fresh emulator profile and stops if the real Lambda origin already has data. */
class LambdaRescueFlowTest {
    private val inst = InstrumentationRegistry.getInstrumentation()
    private fun waitFor(latch: CountDownLatch) = assertTrue(latch.await(30, TimeUnit.SECONDS))
    private fun js(view: WebView, code: String): String {
        val latch = CountDownLatch(1); var value = ""
        inst.runOnMainSync { view.evaluateJavascript(code) { value = it; latch.countDown() } }
        waitFor(latch); return value
    }
    @Test fun timeoutRequestsExportWithoutChangingSnapshot() {
        val url = "https://${AssetAccessPolicy.hostFor("lambda-diagram-game")}/runtime/seed-test"
        val loaded = CountDownLatch(1); lateinit var seed: WebView
        inst.runOnMainSync {
            WebViewCookiePolicy.disable()
            seed = WebView(inst.targetContext).apply {
                WebViewCookiePolicy.configure(this); settings.javaScriptEnabled = true; settings.domStorageEnabled = true; settings.blockNetworkLoads = true
                webViewClient = object : WebViewClient() {
                    override fun shouldInterceptRequest(v: WebView, r: WebResourceRequest): WebResourceResponse =
                        if (r.url.toString() == url) WebResourceResponse("text/html", "UTF-8", 200, "OK", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream("<!doctype html>".toByteArray()))
                        else GameContentResolver.blocked()
                    override fun onPageFinished(v: WebView, u: String) { loaded.countDown() }
                }
                loadUrl(url)
            }
        }
        waitFor(loaded)
        val key = "lambda-lab-hub-before-run-v1.emulator-test"
        val index = "lambda-lab-hub-before-run-latest-v1"
        val saved = "{\"version\":2,\"draft\":\"pre-hang\",\"session\":{\"steps\":0}}"
        var seeded = false
        try {
            assumeTrue("existing user backup must not be modified", js(seed, "localStorage.getItem('$index')===null&&localStorage.getItem('$key')===null") == "true")
            js(seed, "localStorage.setItem('$key',${org.json.JSONObject.quote(saved)});localStorage.setItem('$index','$key');true")
            seeded = true
            ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                lateinit var exports: DocumentExportFlow
                scenario.onActivity { activity ->
                    exports = ViewModelProvider(activity)[DocumentExportFlow::class.java]
                    val type = MainActivity::class.java.declaredClasses.single { it.simpleName == "Game" }
                    val descriptor = type.declaredConstructors.single().apply { isAccessible = true }
                        .newInstance("lambda-diagram-game", "Lambda", "test", "a".repeat(40), "index.html")
                    MainActivity::class.java.getDeclaredField("currentGame").apply { isAccessible = true }.set(activity, descriptor)
                    MainActivity::class.java.getDeclaredMethod("skipUnresponsiveGame", Boolean::class.javaPrimitiveType).apply { isAccessible = true }.invoke(activity, false)
                }
                val deadline = System.currentTimeMillis() + 15000
                while (exports.pending == null && System.currentTimeMillis() < deadline) Thread.sleep(50)
                assertEquals(saved, exports.pending?.content)
                assertEquals("lambda-before-run.json", exports.pending?.name)
                assertEquals(org.json.JSONObject.quote(saved), js(seed, "localStorage.getItem('$key')"))
                inst.uiAutomation.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK)
            }
        } finally {
            if (seeded) js(seed, "if(localStorage.getItem('$index')==='$key'&&localStorage.getItem('$key')===${org.json.JSONObject.quote(saved)}){localStorage.removeItem('$key');localStorage.removeItem('$index')};true")
            inst.runOnMainSync { seed.destroy() }
        }
    }
}
