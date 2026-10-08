package com.xiaoxuhui.gamehub

import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Avoids newer production classes so this same-signer test APK can instrument the real v0.2.0. */
class UpgradeSaveDeviceTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private val mode get() = InstrumentationRegistry.getArguments().getString("saveMode")
    private val value = "覆盖升级存档-20261009"
    private fun js(view: WebView, source: String): String {
        val signal = CountDownLatch(1); var result = ""
        instrumentation.runOnMainSync { view.evaluateJavascript("(()=>{try{return ($source)}catch(e){return 'ERROR:'+e.message}})()") { result = it; signal.countDown() } }
        assertTrue("JavaScript completed", signal.await(15, TimeUnit.SECONDS)); return result
    }
    private fun page(id: String, entry: String, write: String, read: String) {
        val manifest = context.assets.open("bundle-manifest.json").bufferedReader().use { JSONObject(it.readText()) }
        val files = manifest.getJSONArray("files")
        val paths = (0 until files.length()).map { files.getJSONObject(it).getString("path") }.toSet()
        val loaded = CountDownLatch(1); lateinit var view: WebView
        instrumentation.runOnMainSync {
            view = WebView(context).apply {
                settings.javaScriptEnabled = true; settings.domStorageEnabled = true
                settings.blockNetworkLoads = true; settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
                webViewClient = object : WebViewClient() {
                    override fun shouldInterceptRequest(v: WebView, request: WebResourceRequest): WebResourceResponse {
                        val uri = request.url
                        val path = uri.path?.removePrefix("/assets/") ?: ""
                        if (request.method != "GET" || uri.scheme != "https" || uri.host != "appassets.androidplatform.net" || !uri.path.orEmpty().startsWith("/assets/") || path !in paths) {
                            return WebResourceResponse("text/plain", "UTF-8", 404, "Blocked", emptyMap(), java.io.ByteArrayInputStream(byteArrayOf()))
                        }
                        val mime = when (path.substringAfterLast('.')) {
                            "html" -> "text/html"; "js" -> "application/javascript"; "css" -> "text/css"
                            "json" -> "application/json"; "svg" -> "image/svg+xml"; "png" -> "image/png"; else -> "text/plain"
                        }
                        return WebResourceResponse(mime, "UTF-8", 200, "OK", mapOf("Cache-Control" to "no-store"), context.assets.open(path))
                    }
                    override fun onPageFinished(v: WebView, url: String) { loaded.countDown() }
                }
                loadUrl("https://appassets.androidplatform.net/assets/games/$id/$entry")
            }
        }
        try {
            assertTrue("Actual $id page loaded", loaded.await(20, TimeUnit.SECONDS))
            if (mode == "seed") assertEquals("$id saved", "true", js(view, write))
            assertEquals("$id actual stored state restored", "true", js(view, read))
            // Actual localStorage writes must reach the WebView storage process before external stop.
            Thread.sleep(500)
        } finally { instrumentation.runOnMainSync { view.destroy() } }
    }
    @Test fun fourRealGameSavesSurviveSameSignerApkUpgrade() {
        org.junit.Assume.assumeTrue("Explicit real APK upgrade controller required", mode != null)
        require(mode in setOf("seed", "verify"))
        val expected = InstrumentationRegistry.getArguments().getString("expectedVersion")!!
        assertEquals(expected, context.packageManager.getPackageInfo(context.packageName, 0).versionName)
        page("conway", "index.html",
            "(()=>{const p=PatternLibrary.createPatternFromWorld({cells:new Set(['0,0','0,1','1,0'])},{name:'$value'},{id:'custom-apk-upgrade-pattern'});PatternLibrary.saveLibrary(localStorage,PatternLibrary.createLibrary([p]));return true})()",
            "PatternLibrary.loadLibrary(localStorage).patterns[0].name === '$value'")
        page("eml", "eml-workbench.html",
            "(()=>{let s=EMLValueStore.createInitialState();s.inputXId=s.valueOrder[0];s.inputYId=null;EMLPersistence.saveToCache(localStorage,s);return EMLPersistence.loadFromCache(localStorage).ok})()",
            "(()=>{const r=EMLPersistence.loadFromCache(localStorage);return r.ok && r.state.inputXId===r.state.valueOrder[0] && r.state.inputYId===null})()")
        page("light", "index.html",
            "(()=>{const s=LightStorage.createStore();s.load();s.replace({schema:'light-game/save',version:1,stars:{'level-1':3},boards:{},snapshots:[]});return s.persist()})()",
            "LightStorage.createStore().load().stars['level-1'] === 3")
        page("turing", "index.html",
            "(()=>{document.getElementById('input').value='101101';document.getElementById('apply').click();return JSON.parse(localStorage.getItem('turing-machine-simulator.project.v1')).input === '101101'})()",
            "document.getElementById('input').value === '101101'")
        page("turing", "campaign.html",
            "(()=>{let e=document.getElementById('rulesEditor');e.value='#$value';e.dispatchEvent(new Event('input',{bubbles:true}));return Object.values(JSON.parse(localStorage.getItem('turing-machine-simulator.campaign.v1')).drafts).includes('#$value')})()",
            "document.getElementById('rulesEditor').value === '#$value'")
    }
}
