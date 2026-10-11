package com.xiaoxuhui.gamehub

import android.content.Context
import android.net.ConnectivityManager
import android.os.Bundle
import android.os.SystemClock
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Assume
import org.junit.Test
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Explicit controller of the unmodified, signed formal APK. No test endpoint or fixture store. */
class N12ProductionResourceDeviceTest {
    private val inst = InstrumentationRegistry.getInstrumentation()
    private fun waitFor(label: String, predicate: () -> Boolean) {
        val end = SystemClock.uptimeMillis() + 180000
        do { if (predicate()) return; Thread.sleep(200) } while (SystemClock.uptimeMillis() < end)
        fail("Timed out: $label")
    }
    private fun js(s: ActivityScenario<MainActivity>, expression: String): String {
        val signal = CountDownLatch(1); var result = "null"
        s.onActivity { a ->
            val w = MainActivity::class.java.getDeclaredField("webView").apply { isAccessible = true }.get(a) as? WebView
            if (w == null) signal.countDown() else w.evaluateJavascript("(()=>{try{return ($expression)}catch(e){return 'ERROR:'+e.message}})()") { result = it; signal.countDown() }
        }
        assertTrue(signal.await(15, TimeUnit.SECONDS)); return result
    }
    @Test fun actualProductionUpdatesAndSaves() {
        val mode = InstrumentationRegistry.getArguments().getString("n12Resources")
        Assume.assumeTrue("Explicit N12 formal-host controller", mode != null)
        require(mode in setOf("seed", "update", "offline"))
        val ctx = inst.targetContext
        if (mode == "offline") {
            val network = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            assertNull("Offline run requires actual absence of a default network", network.activeNetwork)
        }
        assertEquals("0.4.1", ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName)
        val apkSha = MessageDigest.getInstance("SHA-256").digest(File(ctx.applicationInfo.sourceDir).readBytes()).joinToString("") { "%02x".format(it) }
        assertEquals("9f57c90af42efea54e4e079d637d964346a78e7e880493eac7887f9aaac323da", apkSha)
        val runtime = ResourceRuntime.get(ctx)
        assertEquals(5, runtime.hostCode)
        val keySha = MessageDigest.getInstance("SHA-256").digest(runtime.publicKey).joinToString("") { "%02x".format(it) }
        assertEquals("649107df10ad8f48e8da1d4f992fe652a63fea448fa17dce081b87333a892673", keySha)
        val updates = UpdateCoordinator.get(ctx)
        val expected = mapOf(
            "conway" to ("54e9dc88bcc90f426075d16d2037c50b1f992c87f3525aa599c7d8f9bc19629f" to "7d857cc9b9eb6a9ccf55afc15f05b0a2079970be"),
            "abelian-sandpile" to ("47a35517606cb363f25c73702873d8cb5a534577de3b2f8f5a1aa5dd74e1c7d3" to "06febcbf7ae9a16ed40cb10aa6507ce6e1ceb4cc"))
        for ((id, identity) in expected) {
            ActivityScenario.launch(MainActivity::class.java).use { s ->
                // Normal setting disables automatic downloads so this explicit manual flow is observable.
                if (mode != "offline") {
                    waitFor("idle before settings") { !updates.snapshot().busy }
                    assertTrue(updates.settings(false, false))
                    waitFor("settings persisted") { !updates.snapshot().settingsSaving }
                    waitFor("idle before public check") { !updates.snapshot().busy }
                    assertTrue(updates.check(true))
                    waitFor("public check completed") { !updates.snapshot().busy }
                    val snapshot = updates.snapshot()
                    assertFalse(snapshot.resourcesRemembered); assertFalse(snapshot.dynamicRemembered)
                    val catalogGame = (snapshot.catalogGames + snapshot.dynamicCatalogGames).single { it.id == id }
                    assertEquals(if (mode == "seed") 1 else 2, catalogGame.contentCode)
                    val info = runtime.storeFor(id).describeAll()[id]
                    val needDownload = if (mode == "seed") id == "abelian-sandpile" && info?.active == null else info?.active?.contentCode != 2 && info?.ready?.contentCode != 2
                    if (needDownload) {
                        assertTrue("Normal public download handler for $id", updates.downloadResource(id, true))
                        waitFor("$id download finished") { !updates.snapshot().busy }
                        assertEquals(catalogGame.archiveSha256, runtime.storeFor(id).describeAll().getValue(id).ready?.archiveSha256)
                    }
                }
                // Invoke the same player handler used by the card; it performs the real cache guard and activation.
                s.onActivity { a ->
                    val type = MainActivity::class.java.declaredClasses.single { it.simpleName == "Game" }
                    val game = type.declaredConstructors.single().apply { isAccessible = true }.newInstance(id, id, "", "", "index.html")
                    MainActivity::class.java.getDeclaredMethod("openGame", type, Bundle::class.java).apply { isAccessible = true }.invoke(a, game, null)
                }
                val loaded = if (id == "conway") "!!document.getElementById('importPatternsInput')" else "!!globalThis.SandpileApp && document.documentElement.dataset.ready==='true'"
                waitFor("$id actual WebView loaded") { js(s, loaded) == "true" }
                val info = runtime.storeFor(id).describeAll().getValue(id)
                assertNull(info.stateError); assertNull(info.activeError); assertNull(info.readyError)
                assertNull("Player handler activated ready", info.selection.ready)
                if (mode == "seed") {
                    if (id == "conway") assertNull(info.active) else {
                        assertEquals(1, info.active!!.contentCode)
                        assertEquals("8e9db7fc872072b43ed035673107d58e86bd6e486f83b05d44f57bb392f369e5", info.active.archiveSha256)
                    }
                    assertEquals("true", js(s, "(()=>{localStorage.setItem('__n12_unrelated','preserve');return true})()"))
                    if (id == "conway") {
                        val importScript = """(()=>{const t='2026-10-12T00:00:00.000Z';const pairs=[['importPatternsInput',{format:'conway-life-pattern-library',version:1,patterns:[{id:'custom-n12-old',name:'N12旧方块',description:'旧页导入',width:2,height:2,cells:[[0,0],[0,1],[1,0],[1,1]],createdAt:t,updatedAt:t}]}],['importLogicFunctionsInput',{format:'conway-life-logic-function-library',version:2,functions:[{id:'function-n12-old',name:'OLD',code:'AND(A,B)',inputs:[{name:'A',defaultValue:1},{name:'B',defaultValue:0}],createdAt:t,updatedAt:t}]}]];for(const [id,data]of pairs){const input=document.getElementById(id),d=new DataTransfer();d.items.add(new File([JSON.stringify(data)],id+'.json',{type:'application/json'}));input.files=d.files;input.dispatchEvent(new Event('change'));}return true})()"""
                        assertEquals("true", js(s, importScript))
                        waitFor("old UI parsed imports") { js(s, "!document.getElementById('confirmImportPatternsButton').disabled && !document.getElementById('confirmImportLogicFunctionsButton').disabled") == "true" }
                        assertEquals("true", js(s, "(()=>{document.getElementById('confirmImportPatternsButton').click();document.getElementById('confirmImportLogicFunctionsButton').click();const keys=['conway-life-game.custom-patterns.v1','conway-life-game.logic-functions.v1'];const saved=keys.map(k=>localStorage.getItem(k));localStorage.setItem('__n12_expected_conway',JSON.stringify(saved));return saved.every(Boolean)})()"))
                    } else {
                        assertEquals("true", js(s, "(()=>{const amount=document.getElementById('amount');amount.value='7';amount.dispatchEvent(new Event('change'));const c=document.getElementById('main-board'),r=c.getBoundingClientRect();c.dispatchEvent(new MouseEvent('click',{clientX:r.left+r.width/2,clientY:r.top+r.height/2,bubbles:true}));return true})()"))
                        waitFor("actual old seven grain save") { js(s, "SandpileApp.snapshot().experiment.state.added===7 && !!localStorage.getItem('abelian-sandpile.experiment.v1')") == "true" }
                        assertEquals("true", js(s, "(()=>{localStorage.setItem('__n12_expected_abel',JSON.stringify(SandpileApp.snapshot()));return true})()"))
                    }
                } else {
                    assertEquals(2, info.active!!.contentCode)
                    assertEquals(identity.first, info.active.archiveSha256); assertEquals(identity.second, info.active.sourceRevision)
                    val saved = if (id == "conway") "JSON.stringify(['conway-life-game.custom-patterns.v1','conway-life-game.logic-functions.v1'].map(k=>localStorage.getItem(k)))===localStorage.getItem('__n12_expected_conway')" else "JSON.stringify(SandpileApp.snapshot())===localStorage.getItem('__n12_expected_abel')"
                    assertEquals("$id actual old save intact", "true", js(s, saved))
                    if (id == "conway") {
                        assertEquals("true", js(s, "typeof showDirectoryPicker==='undefined' && typeof showSaveFilePicker==='undefined'"))
                        assertEquals("true", js(s, "(()=>{document.getElementById('exportDeleteAllRecordsButton').click();return true})()"))
                        waitFor("WebView unsupported-safe-delete message") { js(s, "document.getElementById('exportAllRecordsError').textContent.includes('不支持')") == "true" }
                        assertEquals("true", js(s, saved))
                    } else assertEquals("true", js(s, "(()=>{const e=document.getElementById('pour-interval');e.value='250';return e.checkValidity() && e.step==='1'})()"))
                }
                assertEquals("true", js(s, "localStorage.getItem('__n12_unrelated')==='preserve'"))
                Thread.sleep(6000)
                println("N12 formal APK $id $mode actual resource/save PASS")
            }
        }
    }
}
