package com.xiaoxuhui.gamehub

import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class LambdaRescueReaderTest {
    private val inst = InstrumentationRegistry.getInstrumentation()
    private fun waitFor(latch: CountDownLatch) = assertTrue("WebView timed out", latch.await(30, TimeUnit.SECONDS))
    private fun js(view: WebView, code: String): String {
        val latch = CountDownLatch(1); var value = ""
        inst.runOnMainSync { view.evaluateJavascript(code) { value = it; latch.countDown() } }
        waitFor(latch); return value
    }
    private fun read(id: String): LambdaRescueReader.Result {
        val latch = CountDownLatch(1); var value: LambdaRescueReader.Result? = null
        inst.runOnMainSync { LambdaRescueReader.read(inst.targetContext, id) { value = it; latch.countDown() } }
        waitFor(latch); return value!!
    }
    @Test fun readsBackupWithoutRunningGameOrChangingStoredBytes() {
        val id = "lambda-rescue-fixture"; val url = "https://${AssetAccessPolicy.hostFor(id)}/runtime/seed"
        val ready = CountDownLatch(1); lateinit var view: WebView
        inst.runOnMainSync {
            WebViewCookiePolicy.disable()
            view = WebView(inst.targetContext).apply {
                WebViewCookiePolicy.configure(this)
                settings.javaScriptEnabled = true; settings.domStorageEnabled = true; settings.blockNetworkLoads = true
                webViewClient = object : WebViewClient() {
                    override fun shouldInterceptRequest(v: WebView, r: WebResourceRequest): WebResourceResponse =
                        if (r.url.toString() == url) WebResourceResponse("text/html", "UTF-8", 200, "OK", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream("<!doctype html>".toByteArray()))
                        else GameContentResolver.blocked()
                    override fun onPageFinished(v: WebView, u: String) { ready.countDown() }
                }
                loadUrl(url)
            }
        }
        val key = "lambda-lab-hub-before-run-v1.test"; val backup = "{\"version\":2,\"draft\":\"saved-before-run\"}"
        try {
            waitFor(ready)
            js(view, "localStorage.setItem('$key',${org.json.JSONObject.quote(backup)});localStorage.setItem('lambda-lab-hub-before-run-latest-v1','$key');true")
            assertEquals(backup, (read(id) as LambdaRescueReader.Result.Found).content)
            assertEquals(org.json.JSONObject.quote(backup), js(view, "localStorage.getItem('$key')"))
            js(view, "localStorage.setItem('lambda-lab-hub-before-run-latest-v1','not-a-backup-key');true")
            assertTrue(read(id) is LambdaRescueReader.Result.Unavailable)
            assertEquals(org.json.JSONObject.quote(backup), js(view, "localStorage.getItem('$key')"))
        } finally {
            js(view, "localStorage.removeItem('$key');localStorage.removeItem('lambda-lab-hub-before-run-latest-v1');true")
            inst.runOnMainSync { view.destroy() }
        }
    }
}
