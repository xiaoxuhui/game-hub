package com.xiaoxuhui.gamehub

import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.JavascriptInterface
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.UUID

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
        val fixtureId="lambda-noloss-"+UUID.randomUUID().toString().replace("-", "").take(12)
        val url="https://${AssetAccessPolicy.hostFor(fixtureId)}/runtime/test";val useNew=AtomicBoolean(false)
        val exported=CountDownLatch(1);var exportText=""
        val bridge=object{@JavascriptInterface fun saveFile(name:String,text:String):Boolean{if(name=="lambda-all-local-storage.json"){exportText=text;exported.countDown()};return true}}
        var ready=CountDownLatch(1);lateinit var view:WebView
        inst.runOnMainSync{view=WebView(inst.targetContext).apply{
            settings.javaScriptEnabled=true;settings.domStorageEnabled=true;settings.blockNetworkLoads=true
            addJavascriptInterface(bridge,"FakeBridge")
            webViewClient=object:WebViewClient(){
                override fun shouldInterceptRequest(v:WebView,r:WebResourceRequest):WebResourceResponse =
                    if(r.url.toString()==url)WebResourceResponse("text/html","UTF-8",200,"OK",mapOf("Cache-Control" to "no-store"),ByteArrayInputStream(if(useNew.get())updated else old)) else GameContentResolver.blocked()
                override fun onPageFinished(v:WebView,u:String){
                    val field=MainActivity::class.java.getDeclaredField("EXPORT_BRIDGE_JS").apply{isAccessible=true}
                    v.evaluateJavascript((field.get(null) as String).replace("__BRIDGE__","FakeBridge")){ready.countDown()}
                }
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
            js(view,"[...document.querySelectorAll('button')].find(b=>b.textContent==='导出所有本机存档').click();true")
            waitFor(exported);val storage=JSONObject(exportText).getJSONObject("storage")
            val keys=storage.keys();var archiveFound=false;while(keys.hasNext())if(keys.next().startsWith("lambda-hub-session-archive-v1."))archiveFound=true
            assertTrue("Android export omitted the preserved archive",archiveFound)
            js(view,"window.prompt=(message)=>{const row=message.split('\\n').find(line=>line.includes('preserved'));return row?row.match(/^\\d+/)[0]:null};const data=new DataTransfer();data.items.add(new File([${JSONObject.quote(exportText)}],'all.json',{type:'application/json'}));const input=document.querySelector('#import-file');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));true")
            val deadline=System.currentTimeMillis()+15000;var restored=false
            while(!restored&&System.currentTimeMillis()<deadline){restored=js(view,"document.querySelector('#expression').value==='(λoriginal.original) preserved'")=="true";if(!restored)Thread.sleep(100)}
            assertTrue("Android could not restore the archived session from its full export",restored)
            val beforeLarge=js(view,"localStorage.getItem('lambda-lab-hub-v4')")
            js(view,"window.__largePrompt=false;window.prompt=(message)=>{window.__largePrompt=message.includes('preserved');return null};const large=new DataTransfer();large.items.add(new File([JSON.stringify({schemaVersion:1,type:'raw-local-storage',game:'lambda-diagram-game',storage:{'lambda-lab-hub-v4':${JSONObject.quote(raw)},'lambda-hub-padding':'x'.repeat(8*1024*1024)}})],'large.json',{type:'application/json'}));const fileInput=document.querySelector('#import-file');fileInput.files=large.files;fileInput.dispatchEvent(new Event('change',{bubbles:true}));true")
            val largeDeadline=System.currentTimeMillis()+15000;var offered=false
            while(!offered&&System.currentTimeMillis()<largeDeadline){offered=js(view,"window.__largePrompt")=="true";if(!offered)Thread.sleep(100)}
            assertTrue("Android rejected the valid large raw archive",offered)
            assertEquals("cancelling import changed the current save",beforeLarge,js(view,"localStorage.getItem('lambda-lab-hub-v4')"))
        }finally{inst.runOnMainSync{view.destroy()}}
    }
}
