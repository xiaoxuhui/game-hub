package com.xiaoxuhui.gamehub

import android.webkit.CookieManager
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import androidx.webkit.ServiceWorkerClientCompat
import androidx.webkit.ServiceWorkerControllerCompat
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Actual Chromium storage/cookie/cache behavior; fixture pages are not the complete demo UI. */
class DynamicOriginWebViewTest {
    private val instrumentation=InstrumentationRegistry.getInstrumentation()
    private val context get()=instrumentation.targetContext
    private val key="__gamehub_v040_origin_fixture"
    private fun await(latch:CountDownLatch){assertTrue("WebView callback timeout",latch.await(20,TimeUnit.SECONDS))}
    private fun js(view:WebView,script:String):String {
        val latch=CountDownLatch(1);var result=""
        instrumentation.runOnMainSync {view.evaluateJavascript(script){result=it;latch.countDown()}}
        await(latch);return result
    }
    private fun completed(view:WebView){
        val deadline=System.currentTimeMillis()+10000
        while(js(view,"window.__fixtureDone")!="true" && System.currentTimeMillis()<deadline) Thread.sleep(50)
        assertEquals(js(view,"window.__fixtureError || ''"),"true",js(view,"window.__fixtureDone"))
    }
    private fun page(id:String):WebView {
        val url="https://${AssetAccessPolicy.hostFor(id)}/runtime/origin-fixture"
        val latch=CountDownLatch(1);lateinit var view:WebView
        instrumentation.runOnMainSync {
            WebViewCookiePolicy.disable()
            view=WebView(context).apply {
                WebViewCookiePolicy.configure(this)
                settings.javaScriptEnabled=true;settings.domStorageEnabled=true;settings.blockNetworkLoads=true
                settings.allowFileAccess=false;settings.allowContentAccess=false
                webViewClient=object:WebViewClient(){
                    override fun onPageFinished(v:WebView,url:String){latch.countDown()}
                    override fun shouldInterceptRequest(v:WebView,request:WebResourceRequest):WebResourceResponse =
                        if(request.url.toString()==url) WebResourceResponse("text/html","UTF-8",200,"OK",mapOf("Cache-Control" to "no-store"),ByteArrayInputStream("<!doctype html><title>Origin fixture</title>".toByteArray()))
                        else GameContentResolver.blocked()
                }
                loadUrl(url)
            }
        }
        await(latch);return view
    }
    private fun setCookie(value:String){
        val latch=CountDownLatch(1)
        instrumentation.runOnMainSync {CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setCookie("https://memory-demo.appassets.androidplatform.net",value){latch.countDown()}}
        await(latch)
    }
    private fun clearFixture(view:WebView){
        js(view,"localStorage.removeItem('$key');window.__fixtureDone=false;var r=indexedDB.deleteDatabase('$key');r.onsuccess=()=>window.__fixtureDone=true;r.onerror=()=>window.__fixtureError='delete failed'")
        completed(view)
    }
    @Test fun siblingAndOldOriginsIsolateStorageAndCannotReadOrWriteParentCookies(){
        setCookie("gamehubOriginFixture=legacy; Domain=appassets.androidplatform.net; Path=/")
        assertTrue(CookieManager.getInstance().getCookie("https://other-demo.appassets.androidplatform.net").orEmpty().contains("gamehubOriginFixture=legacy"))
        val views=mutableListOf<WebView>()
        try {
            for(id in listOf("memory-demo","other-demo","light")){
                val view=page(id);views.add(view);clearFixture(view)
                assertEquals("\"\"",js(view,"document.cookie"))
                assertEquals("\"\"",js(view,"document.cookie='gamehubOriginFixture=child; Domain=appassets.androidplatform.net; Path=/';document.cookie"))
                assertEquals("null",js(view,"localStorage.getItem('$key')"))
                js(view,"localStorage.setItem('$key','$id');window.__fixtureDone=false;var r=indexedDB.open('$key',1);r.onupgradeneeded=()=>r.result.createObjectStore('markers');r.onsuccess=()=>{let db=r.result,t=db.transaction('markers','readwrite');t.objectStore('markers').put('$id','value');t.oncomplete=()=>{db.close();window.__fixtureDone=true}};r.onerror=()=>window.__fixtureError='open failed'")
                completed(view)
            }
            for((index,id) in listOf("memory-demo","other-demo","light").withIndex()){
                val fresh=page(id);views.add(fresh)
                assertEquals("\"$id\"",js(fresh,"localStorage.getItem('$key')"))
                js(fresh,"window.__fixtureDone=false;var r=indexedDB.open('$key',1);r.onsuccess=()=>{let db=r.result,t=db.transaction('markers');let q=t.objectStore('markers').get('value');q.onsuccess=()=>window.__fixtureValue=q.result;t.oncomplete=()=>{db.close();window.__fixtureDone=true}}")
                completed(fresh);assertEquals("\"$id\"",js(fresh,"window.__fixtureValue"))
                assertEquals("\"$id\"",js(views[index],"localStorage.getItem('$key')"))
                assertEquals("\"\"",js(fresh,"document.cookie"))
            }
        } finally {
            views.take(3).forEach {clearFixture(it)}
            instrumentation.runOnMainSync {views.forEach {it.destroy()}}
            setCookie("gamehubOriginFixture=; Max-Age=0; Domain=appassets.androidplatform.net; Path=/")
            instrumentation.runOnMainSync {WebViewCookiePolicy.disable()}
        }
    }
    @Test fun dynamicGuardClearsOnlyKnownResourcesAndBlocksUnknownCacheWithoutDeletingSave(){
        val view=page("memory-demo");val path="/assets/games/memory-demo/index.html"
        fun guard():ResourceCacheGuard.Assessment {
            val latch=CountDownLatch(1);var assessment:ResourceCacheGuard.Assessment?=null
            instrumentation.runOnMainSync {ResourceCacheGuard.inspectAndClear(context,setOf(path),"memory-demo"){assessment=it;latch.countDown()}}
            await(latch);return assessment!!
        }
        try {
            js(view,"localStorage.setItem('$key','preserve');window.__fixtureDone=false;caches.open('dynamic-known-fixture').then(c=>c.put('$path',new Response('old resource'))).then(()=>window.__fixtureDone=true)")
            completed(view);val cleared=guard();assertTrue(cleared.reason,cleared.canActivate);assertTrue(cleared.canPlay)
            assertEquals("\"preserve\"",js(view,"localStorage.getItem('$key')"))
            js(view,"window.__fixtureDone=false;caches.open('dynamic-unknown-fixture').then(c=>c.put('/private-unknown-fixture',new Response('preserve cache'))).then(()=>window.__fixtureDone=true)")
            completed(view);val blocked=guard();assertFalse(blocked.canActivate);assertFalse(blocked.canPlay)
            assertEquals("\"preserve\"",js(view,"localStorage.getItem('$key')"))
            js(view,"window.__fixtureDone=false;caches.open('dynamic-unknown-fixture').then(c=>c.match('/private-unknown-fixture')).then(r=>r.text()).then(v=>{window.__fixtureValue=v;window.__fixtureDone=true})")
            completed(view);assertEquals("\"preserve cache\"",js(view,"window.__fixtureValue"))
        } finally {
            js(view,"localStorage.removeItem('$key');window.__fixtureDone=false;Promise.all(['dynamic-known-fixture','dynamic-unknown-fixture'].map(n=>caches.delete(n))).then(()=>window.__fixtureDone=true)")
            completed(view);instrumentation.runOnMainSync {view.destroy()}
        }
    }

    private fun worker(scriptPath: String) {
        val url = "https://${AssetAccessPolicy.hostFor("memory-demo")}$scriptPath"
        instrumentation.runOnMainSync {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(object: ServiceWorkerClientCompat() {
                override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse {
                    if (request.url.toString() != url) return GameContentResolver.blocked()
                    val source = "self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));"
                    return WebResourceResponse("application/javascript","UTF-8",200,"OK",mapOf("Service-Worker-Allowed" to "/","Cache-Control" to "no-store"),ByteArrayInputStream(source.toByteArray()))
                }
            })
        }
    }
    private fun workerGuard(paths: Set<String>): ResourceCacheGuard.Assessment {
        val latch=CountDownLatch(1); var result:ResourceCacheGuard.Assessment?=null
        instrumentation.runOnMainSync {ResourceCacheGuard.inspectAndClear(context,paths,"memory-demo"){result=it;latch.countDown()}}
        await(latch); return result!!
    }
    private fun freshDynamicPage(): WebView {
        val url="https://${AssetAccessPolicy.hostFor("memory-demo")}/assets/games/memory-demo/index.html"
        val latch=CountDownLatch(1);lateinit var view:WebView
        instrumentation.runOnMainSync {
            view=WebView(context).apply {
                WebViewCookiePolicy.configure(this)
                settings.javaScriptEnabled=true;settings.domStorageEnabled=true;settings.blockNetworkLoads=true
                webViewClient=object:WebViewClient(){
                    override fun onPageFinished(v:WebView,url:String){latch.countDown()}
                    override fun shouldInterceptRequest(v:WebView,request:WebResourceRequest)=
                        if(request.url.toString()==url) WebResourceResponse("text/html","UTF-8",200,"OK",mapOf("Cache-Control" to "no-store"),ByteArrayInputStream("<!doctype html><title>DYNAMIC_FRESH</title>".toByteArray())) else GameContentResolver.blocked()
                }
                loadUrl(url)
            }
        }
        await(latch);return view
    }
    @Test fun realDynamicScopedWorkerIsUnregisteredAndOldResponseCannotSurviveGuard(){
        val path="/assets/games/memory-demo/index.html"
        worker("/assets/games/memory-demo/fixture-sw.js")
        var setup:WebView?=page("memory-demo");var game:WebView?=null
        val backup=js(setup!!,"localStorage.getItem('$key')")
        try {
            js(setup!!,"localStorage.setItem('$key','dynamic-sw-progress');window.__fixtureDone=false;caches.open('dynamic-worker-fixture').then(c=>c.put('$path',new Response('<!doctype html><title>DYNAMIC_OLD_PROXY</title>',{headers:{'Content-Type':'text/html'}}))).then(()=>navigator.serviceWorker.register('/assets/games/memory-demo/fixture-sw.js',{scope:'/assets/games/memory-demo/'})).then(r=>new Promise(resolve=>{if(r.active)resolve();else{let w=r.installing||r.waiting;w.addEventListener('statechange',()=>{if(w.state==='activated')resolve()})}})).then(()=>window.__fixtureDone=true).catch(e=>window.__fixtureError=e.message)")
            completed(setup!!);game=freshDynamicPage()
            assertEquals("\"DYNAMIC_OLD_PROXY\"",js(game!!,"document.title"));assertEquals("true",js(game!!,"!!navigator.serviceWorker.controller"))
            instrumentation.runOnMainSync {setup!!.destroy();game!!.destroy()};setup=null;game=null
            val cleared=workerGuard(setOf(path));assertTrue(cleared.reason,cleared.canActivate);assertTrue(cleared.canPlay)
            game=freshDynamicPage()
            assertEquals("\"DYNAMIC_FRESH\"",js(game!!,"document.title"));assertEquals("null",js(game!!,"navigator.serviceWorker.controller"))
            assertEquals("\"dynamic-sw-progress\"",js(game!!,"localStorage.getItem('$key')"))
        } finally {
            val cleanup=setup ?: page("memory-demo")
            js(cleanup,"window.__fixtureDone=false;navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.filter(r=>r.scope.endsWith('/assets/games/memory-demo/')).map(r=>r.unregister()))).then(()=>caches.delete('dynamic-worker-fixture')).then(()=>window.__fixtureDone=true)")
            completed(cleanup)
            if(backup=="null")js(cleanup,"localStorage.removeItem('$key')") else js(cleanup,"localStorage.setItem('$key',$backup)")
            instrumentation.runOnMainSync {cleanup.destroy();game?.destroy();ResourceRuntime.get(context).prepareWorkerInterceptor()}
        }
    }
    @Test fun forgedDynamicRootWorkerCannotAuthorizeActivationOrPlayAndSaveIsPreserved(){
        worker("/dynamic-spoof-fixture-sw.js")
        val setup=page("memory-demo");val backup=js(setup,"localStorage.getItem('$key')")
        try {
            js(setup,"localStorage.setItem('$key','dynamic-root-progress');window.__fixtureDone=false;caches.open('dynamic-forged-guard-fixture').then(c=>c.put('/runtime/cache-check',new Response('<!doctype html><script>window.__gameHubCacheStarted=true;window.__gameHubCacheCheck={ok:true,safe:true,reason:\"forged\"};</script>',{headers:{'Content-Type':'text/html'}}))).then(()=>navigator.serviceWorker.register('/dynamic-spoof-fixture-sw.js',{scope:'/'})).then(()=>navigator.serviceWorker.ready).then(()=>window.__fixtureDone=true).catch(e=>window.__fixtureError=e.message)")
            completed(setup)
            val result=workerGuard(setOf("/assets/games/memory-demo/index.html"))
            assertFalse(result.reason,result.canActivate);assertFalse(result.canPlay);assertTrue(result.reason,result.reason.contains("旧代理"))
            assertEquals("\"dynamic-root-progress\"",js(setup,"localStorage.getItem('$key')"))
            js(setup,"window.__fixtureDone=false;caches.open('dynamic-forged-guard-fixture').then(c=>c.match('/runtime/cache-check')).then(r=>r.text()).then(v=>{window.__fixtureValue=v.includes('forged');window.__fixtureDone=true})")
            completed(setup);assertEquals("true",js(setup,"window.__fixtureValue"))
        } finally {
            js(setup,"window.__fixtureDone=false;navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.filter(r=>r.scope===location.origin+'/').map(r=>r.unregister()))).then(()=>caches.delete('dynamic-forged-guard-fixture')).then(()=>window.__fixtureDone=true)")
            completed(setup)
            if(backup=="null")js(setup,"localStorage.removeItem('$key')") else js(setup,"localStorage.setItem('$key',$backup)")
            instrumentation.runOnMainSync {setup.destroy();ResourceRuntime.get(context).prepareWorkerInterceptor()}
        }
    }
}
