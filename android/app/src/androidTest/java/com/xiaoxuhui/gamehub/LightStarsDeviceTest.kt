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
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.zip.ZipInputStream

class LightStarsDeviceTest {
    private val inst=InstrumentationRegistry.getInstrumentation()
    private fun waitFor(latch:CountDownLatch)=assertTrue("WebView timed out",latch.await(30,TimeUnit.SECONDS))
    private fun js(view:WebView,code:String):String{val latch=CountDownLatch(1);var result="";inst.runOnMainSync{view.evaluateJavascript(code){result=it;latch.countDown()}};waitFor(latch);return result}
    @Test fun completedStarsPersistAcrossReload(){
        assumeTrue("requires independently staged Light candidate",inst.context.assets.list("")?.contains("light-stars.zip")==true)
        val entries=mutableMapOf<String,ByteArray>();ZipInputStream(inst.context.assets.open("light-stars.zip")).use{zip->while(true){val entry=zip.nextEntry?:break;if(!entry.isDirectory)entries[entry.name]=zip.readBytes()}}
        val host=AssetAccessPolicy.hostFor("light-test-"+UUID.randomUUID().toString().replace("-","").take(12));val prefix="https://$host/assets/games/light/";var ready=CountDownLatch(1);lateinit var view:WebView
        inst.runOnMainSync{view=WebView(inst.targetContext).apply{settings.javaScriptEnabled=true;settings.domStorageEnabled=true;settings.blockNetworkLoads=true;webViewClient=object:WebViewClient(){
            override fun shouldInterceptRequest(v:WebView,r:WebResourceRequest):WebResourceResponse{val url=r.url.toString();val path=url.removePrefix(prefix);val bytes=if(url.startsWith(prefix))entries[path] else null;return if(bytes==null)GameContentResolver.blocked() else WebResourceResponse(when{path.endsWith(".js")->"application/javascript";path.endsWith(".css")->"text/css";else->"text/html"},"UTF-8",200,"OK",mapOf("Cache-Control" to "no-store"),ByteArrayInputStream(bytes))}
            override fun onPageFinished(v:WebView,u:String){ready.countDown()}
        };loadUrl(prefix+"index.html")}}
        try{waitFor(ready);val deadline=System.currentTimeMillis()+15000;var saved="null";while(saved=="null"&&System.currentTimeMillis()<deadline){saved=js(view,"localStorage.getItem('light-game/save')");if(saved=="null")Thread.sleep(100)};assertNotEquals("initial completion did not persist", "null",saved)
            val raw=JSONObject("{\"v\":$saved}").getString("v");val stars=JSONObject(raw).getJSONObject("stars");val keys=stars.keys();var three=false;while(keys.hasNext())if(stars.getInt(keys.next())==3)three=true;assertTrue("three stars missing",three)
            ready=CountDownLatch(1);inst.runOnMainSync{view.reload()};waitFor(ready);assertEquals("saved progress changed after reload",saved,js(view,"localStorage.getItem('light-game/save')"))
        }finally{inst.runOnMainSync{view.destroy()}}
    }
}
