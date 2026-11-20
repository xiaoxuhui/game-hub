package com.xiaoxuhui.gamehub

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
import java.util.concurrent.atomic.AtomicBoolean

class LambdaNoLossDeviceTest {
    private val inst = InstrumentationRegistry.getInstrumentation()
    private fun waitFor(latch: CountDownLatch) = assertTrue("WebView timed out", latch.await(30, TimeUnit.SECONDS))
    private fun js(view: WebView, code: String): String {
        val latch=CountDownLatch(1);var value="";inst.runOnMainSync{view.evaluateJavascript(code){value=it;latch.countDown()}};waitFor(latch);return value
    }
    @Test fun upgradingAndEditingPreservesEarlierSession() {
        val assets=inst.context.assets.list("")?.toSet().orEmpty()
        assumeTrue("requires independently staged old and new Lambda resources", assets.containsAll(setOf("lambda-noloss-old.html", "lambda-noloss-new.html")))
        val old=inst.context.assets.open("lambda-noloss-old.html").use{it.readBytes()}
        val updated=inst.context.assets.open("lambda-noloss-new.html").use{it.readBytes()}
        val url="https://${AssetAccessPolicy.hostFor("lambda-no-loss-fixture")}/runtime/test";val useNew=AtomicBoolean(false)
        var ready=CountDownLatch(1);lateinit var view:WebView
        inst.runOnMainSync{view=WebView(inst.targetContext).apply{
            settings.javaScriptEnabled=true;settings.domStorageEnabled=true;settings.blockNetworkLoads=true
            webViewClient=object:WebViewClient(){
                override fun shouldInterceptRequest(v:WebView,r:WebResourceRequest):WebResourceResponse =
                    if(r.url.toString()==url)WebResourceResponse("text/html","UTF-8",200,"OK",mapOf("Cache-Control" to "no-store"),ByteArrayInputStream(if(useNew.get())updated else old)) else GameContentResolver.blocked()
                override fun onPageFinished(v:WebView,u:String){ready.countDown()}
            };loadUrl(url)
        }}
        try{
            waitFor(ready)
            fun edit(value:String){js(view,"document.querySelector('#expression').value=${JSONObject.quote(value)};document.querySelector('#expression').dispatchEvent(new Event('input',{bubbles:true}));true");Thread.sleep(700)}
            edit("(λoriginal.original) preserved")
            val raw=JSONObject("{\"v\":${js(view,"localStorage.getItem('lambda-lab-hub-v4')")}}").getString("v")
            assertTrue(raw.contains("preserved"))
            ready=CountDownLatch(1);useNew.set(true);inst.runOnMainSync{view.reload()};waitFor(ready)
            edit("(λa.a) first");edit("(λb.b) second")
            val found=js(view,"Object.keys(localStorage).filter(k=>k.startsWith('lambda-hub-session-archive-v1.')).some(k=>Object.values(JSON.parse(localStorage.getItem(k)).storage).includes(${JSONObject.quote(raw)}))")
            assertEquals("earlier session lost", "true", found)
            assertEquals("true",js(view,"!![...document.querySelectorAll('button')].find(b=>b.textContent==='导出所有本机存档')"))
        }finally{inst.runOnMainSync{view.destroy()}}
    }
}
