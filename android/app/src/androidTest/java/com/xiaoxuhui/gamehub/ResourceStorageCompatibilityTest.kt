package com.xiaoxuhui.gamehub

import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class ResourceStorageCompatibilityTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private fun js(view: WebView, script: String): String {
        val latch = CountDownLatch(1); var result = ""
        instrumentation.runOnMainSync { view.evaluateJavascript("(()=>{try{return ($script)}catch(e){return 'ERROR:'+e.message}})()") { result = it; latch.countDown() } }
        assertTrue(latch.await(15, TimeUnit.SECONDS)); return result
    }
    private fun loaded(f: ResourceDeviceFixture, id: String, entryOverride: String? = null, run: (WebView) -> Unit) {
        val entry = entryOverride ?: f.catalog.games.single { it.id == id }.entry
        val session = f.store.openSession(id, true)
        val resolver = GameContentResolver(context.assets, id, session, f.paths)
        val latch = CountDownLatch(1); lateinit var view: WebView
        instrumentation.runOnMainSync {
            view = WebView(context).apply {
                settings.javaScriptEnabled = true; settings.domStorageEnabled = true; settings.blockNetworkLoads = true; settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
                webViewClient = object : WebViewClient() {
                    override fun shouldInterceptRequest(v: WebView, request: WebResourceRequest) = resolver.response(request.url)
                    override fun onPageFinished(v: WebView, url: String) { latch.countDown() }
                }
                loadUrl("https://appassets.androidplatform.net/assets/games/$id/$entry")
            }
        }
        try { assertTrue(latch.await(15, TimeUnit.SECONDS)); run(view) }
        finally { instrumentation.runOnMainSync { view.destroy() }; session.close() }
    }
    private fun exercise(id: String, write: (Int) -> String, read: (Int) -> String, entry: String? = null) {
        ResourceDeviceFixture(context).use { f ->
            loaded(f, id, entry) { assertEquals("true", js(it, write(1))); assertEquals("true", js(it, read(1))) }
            f.install(id)
            loaded(f, id, entry) { assertEquals(2, f.store.selection(id).active.substringBefore('-').toInt()); assertEquals("true", js(it, read(1))); assertEquals("true", js(it, write(2))) }
            f.store.restore(id, true)
            loaded(f, id, entry) { assertTrue(f.store.selection(id).pinned); assertEquals("true", js(it, read(2))); assertEquals("true", js(it, write(3))) }
            loaded(f, id, entry) { assertEquals("true", js(it, read(3))) }
        }
    }
    @Test fun conwayPatternLibrarySurvivesResourceUpgradeAndBuiltinRestore() = exercise("conway", { phase ->
        "(()=>{const p=PatternLibrary.createPatternFromWorld({cells:new Set(['0,0','0,1','1,0'])},{name:'兼容图案$phase'},{id:'custom-compatibility-pattern'});PatternLibrary.saveLibrary(localStorage,PatternLibrary.createLibrary([p]));return true})()"
    }, { phase -> "PatternLibrary.loadLibrary(localStorage).patterns[0].name === '兼容图案$phase'" })
    @Test fun emlRealSelectionStateSurvivesResourceUpgradeAndBuiltinRestore() = exercise("eml", { phase ->
        "(()=>{let s=EMLValueStore.createInitialState();s.inputXId=${if (phase == 1) "s.valueOrder[0]" else "null"};s.inputYId=${if (phase == 2) "s.valueOrder[0]" else "null"};s.selectedValueId=${if (phase == 3) "s.valueOrder[0]" else "null"};EMLPersistence.saveToCache(localStorage,s);return EMLPersistence.loadFromCache(localStorage).ok})()"
    }, { phase -> "(()=>{const r=EMLPersistence.loadFromCache(localStorage);return r.ok && r.state.${when (phase) {1 -> "inputXId";2 -> "inputYId";else -> "selectedValueId"}} === r.state.valueOrder[0]})()" })
    @Test fun lightActualStarsSurviveResourceUpgradeAndBuiltinRestore() = exercise("light", { phase ->
        "(()=>{const s=LightStorage.createStore();s.load();s.replace({schema:'light-game/save',version:1,stars:{'level-1':$phase},boards:{},snapshots:[]});return s.persist()})()"
    }, { phase -> "LightStorage.createStore().load().stars['level-1'] === $phase" })
    @Test fun turingActualProjectEditorSurvivesResourceUpgradeAndBuiltinRestore() = exercise("turing", { phase ->
        "(()=>{document.getElementById('input').value='${"1".repeat(phase + 1)}';document.getElementById('apply').click();return JSON.parse(localStorage.getItem('turing-machine-simulator.project.v1')).input === '${"1".repeat(phase + 1)}'})()"
    }, { phase -> "document.getElementById('input').value === '${"1".repeat(phase + 1)}'" })
    @Test fun turingCampaignDraftSurvivesResourceUpgradeAndBuiltinRestore() = exercise("turing", { phase ->
        "(()=>{let editor=document.getElementById('rulesEditor');editor.value='#兼容草稿$phase';editor.dispatchEvent(new Event('input',{bubbles:true}));return Object.values(JSON.parse(localStorage.getItem('turing-machine-simulator.campaign.v1')).drafts).includes('#兼容草稿$phase')})()"
    }, { phase -> "document.getElementById('rulesEditor').value === '#兼容草稿$phase'" }, "campaign.html")
    @Test fun downloadedTuringWorkerUsesSessionResourcesAndCompletesActualProtocol() {
        ResourceDeviceFixture(context).use { f ->
            f.install("turing")
            val path = f.catalog.games.single { it.id == "turing" }.files.single { it.path.contains("route-worker") && it.path.endsWith(".js") }.path
            loaded(f, "turing") { view ->
                assertEquals("true", js(view, "(()=>{window.workerDone=false;window.workerError='';let worker=new Worker('/assets/games/turing/$path',{type:'module'});worker.onmessage=e=>{if(e.data.type==='complete'){window.workerDone=Array.isArray(e.data.frames);worker.terminate()}else if(e.data.type==='error'){window.workerError=e.data.message;worker.terminate()}};worker.onerror=e=>window.workerError=e.message;worker.postMessage({definition:{blankSymbol:'_',initialState:'q0',acceptStates:[],rejectStates:[],haltStates:['q0'],transitions:[]},initialTape:[],maxSteps:1});return true})()"))
                val until = System.currentTimeMillis() + 10000
                while (js(view, "window.workerDone") != "true" && System.currentTimeMillis() < until) Thread.sleep(50)
                assertEquals(js(view, "window.workerError"), "true", js(view, "window.workerDone"))
            }
        }
    }
}
