package com.xiaoxuhui.gamehub

import android.view.accessibility.AccessibilityNodeInfo
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Opt-in only: requires a fresh dedicated emulator and the generated experimental asset. */
class LambdaEndToEndHangTest {
    private val inst = InstrumentationRegistry.getInstrumentation()
    private fun await(latch: CountDownLatch) = assertTrue("WebView timeout", latch.await(30, TimeUnit.SECONDS))
    private fun js(view: WebView, code: String): String {
        val latch = CountDownLatch(1); var value = ""
        inst.runOnMainSync { view.evaluateJavascript(code) { value = it; latch.countDown() } }
        await(latch); return value
    }
    private fun nodes(node: AccessibilityNodeInfo?): List<AccessibilityNodeInfo> =
        if (node == null) emptyList() else listOf(node) + (0 until node.childCount).flatMap { nodes(node.getChild(it)) }
    @Test fun stagedGameBackupSurvivesRealHangAndSavesDocument() {
        assumeTrue("requires dedicated emulator", InstrumentationRegistry.getArguments().getString("lambda_isolated") == "1")
        assumeTrue("fixture not generated", inst.context.assets.list("")?.contains("lambda-experiment.html") == true)
        val bytes = inst.context.assets.open("lambda-experiment.html").use { it.readBytes() }
        val url = "https://${AssetAccessPolicy.hostFor("lambda-diagram-game")}/assets/games/lambda-diagram-game/lambda-lab.html"
        val ready = CountDownLatch(1); lateinit var view: WebView; lateinit var exports: DocumentExportFlow
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                exports = ViewModelProvider(activity)[DocumentExportFlow::class.java]
                val type = MainActivity::class.java.declaredClasses.single { it.simpleName == "Game" }
                val descriptor = type.declaredConstructors.single().apply { isAccessible = true }
                    .newInstance("lambda-diagram-game", "Lambda", "test", "a".repeat(40), "lambda-lab.html")
                MainActivity::class.java.getDeclaredField("currentGame").apply { isAccessible = true }.set(activity, descriptor)
                view = WebView(activity).apply {
                    WebViewCookiePolicy.configure(this); settings.javaScriptEnabled = true; settings.domStorageEnabled = true; settings.blockNetworkLoads = true
                    webViewClient = object : WebViewClient() {
                        override fun shouldInterceptRequest(v: WebView, r: WebResourceRequest): WebResourceResponse =
                            if (r.url.toString() == url) WebResourceResponse("text/html", "UTF-8", 200, "OK", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(bytes)) else GameContentResolver.blocked()
                        override fun onPageFinished(v: WebView, u: String) { ready.countDown() }
                        override fun onRenderProcessGone(v: WebView, d: android.webkit.RenderProcessGoneDetail) = true
                    }
                }
                (MainActivity::class.java.getDeclaredField("root").apply { isAccessible = true }.get(activity) as FrameLayout).addView(view)
                MainActivity::class.java.getDeclaredField("webView").apply { isAccessible = true }.set(activity, view)
                view.loadUrl(url)
            }
            await(ready)
            assertEquals("true", js(view, "localStorage.getItem('lambda-lab-hub-before-run-latest-v1')===null"))
            js(view, "document.querySelector('#expression').value='(λx.x x) (λx.x x)';document.querySelector('#expression').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#convert').click()")
            val end = System.currentTimeMillis() + 10000
            while (js(view, "document.querySelector('#step').disabled") != "false" && System.currentTimeMillis() < end) Thread.sleep(50)
            js(view, "document.querySelector('#step').click()")
            val raw = JSONObject("{\"v\":${js(view, "localStorage.getItem(localStorage.getItem('lambda-lab-hub-before-run-latest-v1'))")}}").getString("v")
            assertEquals("(λx.x x) (λx.x x)", JSONObject(raw).getString("draft"))
            scenario.onActivity { activity ->
                MainActivity::class.java.getDeclaredField("gamePageReady").apply { isAccessible = true }.setBoolean(activity, true)
                MainActivity::class.java.getDeclaredMethod("startGameWatchdog").apply { isAccessible = true }.invoke(activity)
                view.evaluateJavascript("while(true){}", null)
            }
            val deadline = System.currentTimeMillis() + 50000
            while (exports.pending == null && System.currentTimeMillis() < deadline) Thread.sleep(100)
            assertEquals("watchdog did not export the staged resource backup", raw, exports.pending?.content)
            val chooserDeadline = System.currentTimeMillis() + 10000; var save: AccessibilityNodeInfo? = null
            while (save == null && System.currentTimeMillis() < chooserDeadline) {
                save = nodes(inst.uiAutomation.rootInActiveWindow).firstOrNull { it.isClickable && it.text?.toString()?.lowercase() in setOf("save", "保存") }
                if (save == null) Thread.sleep(100)
            }
            assertNotNull("system save action not found", save); assertTrue(save!!.performAction(AccessibilityNodeInfo.ACTION_CLICK))
            val writeDeadline = System.currentTimeMillis() + 10000
            while (exports.busy && System.currentTimeMillis() < writeDeadline) Thread.sleep(100)
            assertFalse("document write did not finish", exports.busy)
        }
    }
}
