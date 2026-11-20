package com.xiaoxuhui.gamehub

import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Isolated experimental resource; this is not an installed production game. */
class LambdaBackupExperimentTest {
    private val inst = InstrumentationRegistry.getInstrumentation()
    private fun waitFor(latch: CountDownLatch) = assertTrue("WebView timed out", latch.await(30, TimeUnit.SECONDS))
    private fun js(view: WebView, code: String): String {
        val latch = CountDownLatch(1); var value = ""
        inst.runOnMainSync { view.evaluateJavascript(code) { value = it; latch.countDown() } }
        waitFor(latch); return value
    }
    @Test fun omegaExportsSavedPreRunStateThroughActualBridgeScript() {
        assumeTrue("Experimental Lambda fixture not generated", inst.context.assets.list("")?.contains("lambda-experiment.html") == true)
        val fixture = inst.context.assets.open("lambda-experiment.html").use { it.readBytes() }
        val ready = CountDownLatch(1); val exported = CountDownLatch(1); var content = ""
        val bridge = object {
            @JavascriptInterface fun saveFile(name: String, text: String): Boolean {
                if (name == "lambda-before-run.json") { content = text; exported.countDown() }
                return true
            }
        }
        val url = "https://lambda-backup-fixture.appassets.androidplatform.net/runtime/test"
        lateinit var view: WebView
        inst.runOnMainSync {
            view = WebView(inst.targetContext).apply {
                settings.javaScriptEnabled = true; settings.domStorageEnabled = true; settings.blockNetworkLoads = true
                addJavascriptInterface(bridge, "FakeBridge")
                webViewClient = object : WebViewClient() {
                    override fun shouldInterceptRequest(v: WebView, r: WebResourceRequest): WebResourceResponse =
                        if (r.url.toString() == url) WebResourceResponse("text/html", "UTF-8", 200, "OK", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(fixture))
                        else GameContentResolver.blocked()
                    override fun onPageFinished(v: WebView, u: String) {
                        val field = MainActivity::class.java.getDeclaredField("EXPORT_BRIDGE_JS"); field.isAccessible = true
                        val script = (field.get(null) as String).replace("__BRIDGE__", "FakeBridge")
                        v.evaluateJavascript(script) { ready.countDown() }
                    }
                }
                loadUrl(url)
            }
        }
        try {
            waitFor(ready)
            js(view, "document.querySelector('#expression').value='(λx.x x) (λx.x x)';document.querySelector('#expression').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#convert').click()")
            Thread.sleep(1000)
            js(view, "document.querySelector('#fast-run').click()")
            waitFor(exported)
            val saved = JSONObject(content)
            assertEquals("(λx.x x) (λx.x x)", saved.getString("draft"))
            assertEquals(0, saved.getJSONObject("session").getInt("steps"))
            assertEquals("true", js(view, "!!localStorage.getItem(localStorage.getItem('lambda-lab-hub-before-run-latest-v1'))"))
        } finally { inst.runOnMainSync { view.destroy() } }
    }
}
