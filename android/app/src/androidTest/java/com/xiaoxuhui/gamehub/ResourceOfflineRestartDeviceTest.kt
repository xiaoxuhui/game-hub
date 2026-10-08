package com.xiaoxuhui.gamehub

import android.os.Bundle
import android.os.Process
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Two explicitly controlled processes; never equates object recreation with actual process death. */
class ResourceOfflineRestartDeviceTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private val root get() = File(context.filesDir, "offline-four-verification")
    private val runId get() = InstrumentationRegistry.getArguments().getString("offlineRun")!!.also {
        require(Regex("[a-f0-9]{32}").matches(it))
    }
    private val marker = "下载资源重启存档-20261009"
    private fun js(scenario: ActivityScenario<MainActivity>, expression: String): String {
        val signal = CountDownLatch(1); var result = "null"
        scenario.onActivity { activity ->
            val view = MainActivity::class.java.getDeclaredField("webView").apply { isAccessible = true }.get(activity) as? WebView
            if (view == null) signal.countDown() else view.evaluateJavascript("(()=>{try{return ($expression)}catch(e){return 'ERROR:'+e.message}})()") { result = it; signal.countDown() }
        }
        assertTrue(signal.await(10, TimeUnit.SECONDS)); return result
    }
    private fun awaitJs(scenario: ActivityScenario<MainActivity>, expression: String) {
        val until = System.nanoTime() + TimeUnit.SECONDS.toNanos(20)
        while (js(scenario, expression) != "true" && System.nanoTime() < until) Thread.sleep(50)
        assertEquals(expression, "true", js(scenario, expression))
    }
    private fun page(store: GameResourceStore, id: String, seed: Boolean, entry: String? = null) {
        val session = store.openSession(id, true)
        assertEquals(2, checkNotNull(session.game).contentCode)
        assertNotNull(session.root)
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                val runtime = ResourceRuntime.get(context)
                MainActivity::class.java.getDeclaredField("resourceRuntime").apply { isAccessible = true }.set(activity, runtime)
                val games = MainActivity::class.java.getDeclaredField("games").apply { isAccessible = true }.get(activity) as List<*>
                val original = games.first { it!!.javaClass.getDeclaredField("id").apply { isAccessible = true }.get(it) == id }!!
                val game = if (entry == null) original else original.javaClass.getDeclaredConstructor(*Array(5) { String::class.java })
                    .apply { isAccessible = true }.newInstance(id,
                        original.javaClass.getDeclaredField("name").apply { isAccessible = true }.get(original),
                        original.javaClass.getDeclaredField("version").apply { isAccessible = true }.get(original),
                        original.javaClass.getDeclaredField("revision").apply { isAccessible = true }.get(original), entry)
                MainActivity::class.java.getDeclaredMethod("openGamePrepared", game.javaClass, Bundle::class.java, ResourceSession::class.java, ResourceRuntime::class.java)
                    .apply { isAccessible = true }.invoke(activity, game, null, session, runtime)
            }
            val ready = when (id) {
                "conway" -> "Boolean(window.PatternLibrary && document.readyState === 'complete')"
                "eml" -> "Boolean(window.EMLPersistence && document.readyState === 'complete')"
                "light" -> "Boolean(window.LightStorage && document.readyState === 'complete')"
                else -> if (entry == null) "Boolean(document.getElementById('input') && document.readyState === 'complete')" else "Boolean(document.getElementById('rulesEditor') && document.readyState === 'complete')"
            }
            awaitJs(scenario, ready)
            // Each signed fixture's registered entry has a distinct appended comment; prove actual resolver bytes.
            if (entry == null) {
                assertEquals("true", js(scenario, "(()=>{window.offlineEntryVerified=false;fetch(location.href,{cache:'no-store'}).then(r=>r.text()).then(t=>window.offlineEntryVerified=t.includes('signed compatibility candidate'));return true})()"))
                awaitJs(scenario, "window.offlineEntryVerified")
            }
            val write = when (id) {
                "conway" -> "(()=>{const p=PatternLibrary.createPatternFromWorld({cells:new Set(['0,0','0,1','1,0'])},{name:'$marker'},{id:'custom-offline-resource-pattern'});PatternLibrary.saveLibrary(localStorage,PatternLibrary.createLibrary([p]));return true})()"
                "eml" -> "(()=>{const s=EMLValueStore.createInitialState();s.inputXId=null;s.inputYId=s.valueOrder[0];s.selectedValueId=s.valueOrder[0];EMLPersistence.saveToCache(localStorage,s);return true})()"
                "light" -> "(()=>{const s=LightStorage.createStore();s.load();s.replace({schema:'light-game/save',version:1,stars:{'level-1':2},boards:{},snapshots:[]});return s.persist()})()"
                else -> if (entry == null) "(()=>{document.getElementById('input').value='110101';document.getElementById('apply').click();return true})()"
                    else "(()=>{const e=document.getElementById('rulesEditor');e.value='#$marker';e.dispatchEvent(new Event('input',{bubbles:true}));return true})()"
            }
            val read = when (id) {
                "conway" -> "PatternLibrary.loadLibrary(localStorage).patterns[0].name === '$marker'"
                "eml" -> "(()=>{const r=EMLPersistence.loadFromCache(localStorage);return r.ok && r.state.inputXId===null && r.state.inputYId===r.state.valueOrder[0] && r.state.selectedValueId===r.state.valueOrder[0]})()"
                "light" -> "LightStorage.createStore().load().stars['level-1'] === 2"
                else -> if (entry == null) "document.getElementById('input').value === '110101'" else "document.getElementById('rulesEditor').value === '#$marker'"
            }
            if (seed) { assertEquals("true", js(scenario, write)); Thread.sleep(500) }
            assertEquals("Actual $id save retained, entry=$entry", "true", js(scenario, read))
        }
        assertFalse(store.hasSessions())
        assertEquals(2, store.selection(id).active.substringBefore('-').toInt())
    }
    private fun requireOffline() {
        assertNull("External controller must disable task AVD network", context.getSystemService(android.net.ConnectivityManager::class.java).activeNetwork)
    }
    @Test fun prepareFourDownloadedOfflineSessionsAndPause() {
        org.junit.Assume.assumeTrue("Requires explicit external force-stop controller", InstrumentationRegistry.getArguments().getString("offlineRun") != null)
        requireOffline()
        val target = root.canonicalFile
        require(target.parentFile == context.filesDir.canonicalFile)
        if (target.exists()) require(target.deleteRecursively())
        require(target.mkdirs())
        ResourceDeviceFixture(context).use { fixture ->
            for (id in listOf("conway", "eml", "light", "turing")) { fixture.install(id); page(fixture.store, id, true) }
            page(fixture.store, "turing", true, "campaign.html")
            require(File(fixture.root, "store").copyRecursively(File(root, "store")))
            File(root, "key.der").writeBytes(fixture.publicKey)
        } // Private fixture key and source tree have been destroyed before process termination.
        val metadata = JSONObject().put("runId", runId).put("previousPid", Process.myPid()).put("hostCode", 3)
        FileOutputStream(File(root, "metadata.json")).use { it.write(metadata.toString().toByteArray()); it.fd.sync() }
        System.out.println("OFFLINE_FOUR_CUTPOINT $runId $metadata")
        Thread.sleep(120000)
        error("External controller did not terminate this process")
    }
    @Test fun readFourDownloadedGamesAndActualSavesAfterProcessRestart() {
        org.junit.Assume.assumeTrue("Requires explicit external force-stop controller", InstrumentationRegistry.getArguments().getString("offlineRun") != null)
        requireOffline()
        val metadata = JSONObject(File(root, "metadata.json").readText())
        assertEquals(runId, metadata.getString("runId"))
        assertNotEquals(metadata.getInt("previousPid"), Process.myPid())
        val store = GameResourceStore(File(root, "store"), 3, File(root, "key.der").readBytes())
        for (id in listOf("conway", "eml", "light", "turing")) page(store, id, false)
        page(store, "turing", false, "campaign.html")
        metadata.put("newPid", Process.myPid()).put("verifiedDownloadedGames", 4).put("actualSavePages", 5)
        System.out.println("OFFLINE_FOUR_RECOVERED $runId $metadata")
    }
}
