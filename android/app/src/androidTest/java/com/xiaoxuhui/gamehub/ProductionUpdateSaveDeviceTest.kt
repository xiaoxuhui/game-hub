package com.xiaoxuhui.gamehub

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

/** Explicit controller only: real formal v0.4.0, production stores/key and actual active pages. */
class ProductionUpdateSaveDeviceTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private fun sha(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    private fun js(scenario: ActivityScenario<MainActivity>, script: String): String {
        val signal = CountDownLatch(1); var result = ""
        scenario.onActivity { activity ->
            val view = MainActivity::class.java.getDeclaredField("webView").apply { isAccessible = true }.get(activity) as? WebView
            if (view == null) { result = "null"; signal.countDown() }
            else view.evaluateJavascript("(()=>{try{return ($script)}catch(e){return 'ERROR:'+e.message}})()") { result = it; signal.countDown() }
        }
        assertTrue(signal.await(15, TimeUnit.SECONDS)); return result
    }
    private fun awaitJs(scenario: ActivityScenario<MainActivity>, script: String) {
        val until = SystemClock.uptimeMillis() + 20000
        var result: String
        do { result = js(scenario, script); if (result == "true") return; Thread.sleep(100) } while (SystemClock.uptimeMillis() < until)
        fail("Actual page assertion failed: $script => $result")
    }
    @Test fun threeProductionResourceUpdatesPreserveRealSaves() {
        val mode = InstrumentationRegistry.getArguments().getString("productionUpdateSaves")
        Assume.assumeTrue("Explicit formal old APK resource-upgrade controller required", mode != null)
        require(mode in setOf("seed", "verify"))
        val context = instrumentation.targetContext
        assertEquals("0.4.0", context.packageManager.getPackageInfo(context.packageName, 0).versionName)
        assertEquals("c6e071e18eac1cb97f3d898d6eb4dab2c790b8d9310a907a7e44e3c34a78ee39", sha(File(context.applicationInfo.sourceDir).readBytes()))
        val runtime = ResourceRuntime.get(context)
        assertEquals(4, runtime.hostCode)
        assertEquals("649107df10ad8f48e8da1d4f992fe652a63fea448fa17dce081b87333a892673", sha(runtime.publicKey))
        val identities = mapOf(
            "light" to ("19adc2db9b143289c4c8fa6b83d024209ce050fd7744888bd932a7035d115267" to "85163534ccae2b023928c877e002581a8f35f0cb"),
            "turing" to ("ad26e84c8b60d88bcff9f6569172e2f2e518aa031e036ecafd1432731f63af43" to "32eb3b95eb78eab703abe8e64214bd8dbbb939c7"),
            "lambda-diagram-game" to ("0ee2f0ef41545e2364172a3ec2c74481c9cb16ae3c6361a66786f24d0594cdb9" to "64c8932af9a0b5cc886db25910b3923a16aa0677"))
        for ((id, identity) in identities) {
            val store = runtime.storeFor(id)
            // Verify the normal UI already activated the release; the test must not promote ready.
            val before = store.describeAll().getValue(id)
            assertNull(before.stateError); assertNull(before.activeError); assertNull(before.readyError)
            if (mode == "verify") {
                val selected = requireNotNull(before.active)
                assertEquals(2, selected.contentCode)
                assertEquals(identity.first, selected.archiveSha256)
                assertEquals(identity.second, selected.sourceRevision)
                assertEquals(selected.identity, before.selection.active)
                assertNull("Normal UI has already activated $id", before.selection.ready)
            }
            store.openSession(id, false).use { session ->
            val active = session.game
            if (mode == "verify") {
                assertNotNull("Downloaded $id active", active)
                assertEquals(2, active!!.contentCode); assertEquals(identity.first, active.archiveSha256); assertEquals(identity.second, active.sourceRevision)
                assertEquals(if (id == "lambda-diagram-game") "$id-dynamic-v1" else "$id-baseline-v1", active.storageContract)
            } else if (id == "lambda-diagram-game") {
                assertNotNull(active); assertEquals(1, active!!.contentCode)
                assertEquals("5e418cdff45e84ea6ed0b3b1d29d99e0ebb4d1841bc5f2171d48b20f1bf81bb8", active.archiveSha256)
            } else assertNull("Seed original builtin $id", active)
            val info = store.describeAll().getValue(id)
            assertNull(info.stateError); assertNull(info.activeError); assertNull(info.readyError)
            if (active != null) assertEquals(active.identity, info.selection.active)
            ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                scenario.onActivity { activity ->
                    val type = MainActivity::class.java.declaredClasses.single { it.simpleName == "Game" }
                    val game = type.declaredConstructors.single().apply { isAccessible = true }.newInstance(id, id, active?.version ?: "builtin", active?.sourceRevision ?: "builtin", if (id == "lambda-diagram-game") "lambda-lab.html" else "index.html")
                    MainActivity::class.java.getDeclaredMethod("openGamePrepared", type, Bundle::class.java, ResourceSession::class.java, ResourceRuntime::class.java)
                        .apply { isAccessible = true }.invoke(activity, game, null, session, runtime)
                }
                val loaded = when (id) {
                    "light" -> "!!globalThis.__lightGame && !!globalThis.LightStorage"
                    "turing" -> "!!document.getElementById('apply')"
                    else -> "!!document.getElementById('convert')"
                }
                awaitJs(scenario, loaded)
                if (mode == "seed") {
                    assertEquals("true", js(scenario, "(()=>{localStorage.setItem('__n10_unrelated_test_key','preserve');return true})()"))
                    val seed = when (id) {
                        "light" -> "(()=>{__lightGame.selectLevel('t02');document.querySelector('#toolbar button[data-type=mirror]').click();__lightGame.handleCell(3,2);document.getElementById('btn-snapshots').click();[...document.querySelectorAll('#sheet-actions button')].find(b=>b.textContent==='保存当前布局').click();document.getElementById('snapshot-name').value='N10正式旧资源工作台';[...document.querySelectorAll('#sheet-actions button')].find(b=>b.textContent==='保存').click();return JSON.parse(localStorage.getItem('light-game/save')).snapshots.some(s=>s.name==='N10正式旧资源工作台'&&s.placement.length===1)})()"
                        "turing" -> "(()=>{document.getElementById('input').value='101101';document.getElementById('apply').click();return JSON.parse(localStorage.getItem('turing-machine-simulator.project.v1')).input==='101101'})()"
                        else -> "(()=>{document.getElementById('expression').value='(λx.x) (λy.y)';document.getElementById('convert').click();document.getElementById('step').click();document.getElementById('save-state').click();return document.getElementById('step-count').textContent==='1'&&!document.getElementById('restore-state').disabled})()"
                    }
                    assertEquals("$id old actual state saved", "true", js(scenario, seed))
                }
                val saved = when (id) {
                    "light" -> "(()=>{const s=LightStorage.createStore().load();return s.boards.t02.length===1&&s.boards.t02[0].x===3&&s.boards.t02[0].y===2&&s.snapshots.some(v=>v.name==='N10正式旧资源工作台'&&v.placement.length===1)})()"
                    "turing" -> "document.getElementById('input').value==='101101'"
                    else -> "document.getElementById('step-count').textContent==='1'&&!document.getElementById('restore-state').disabled"
                }
                awaitJs(scenario, saved)
                assertEquals("true", js(scenario, "localStorage.getItem('__n10_unrelated_test_key')==='preserve'"))
                if (mode == "verify") {
                    val play = when (id) {
                        "light" -> "(()=>{__lightGame.selectLevel('t02');__lightGame.rotateAt(3,2);__lightGame.undo();return __lightGame.state.placement.length===1})()"
                        "turing" -> "(()=>{document.getElementById('step').click();return Number(document.getElementById('stepCount').textContent)>0})()"
                        else -> "(()=>{document.getElementById('reset').click();document.getElementById('restore-state').click();return document.getElementById('step-count').textContent==='1'})()"
                    }
                    assertEquals("$id new actual gameplay", "true", js(scenario, play))
                }
                Thread.sleep(if (mode == "seed") 6000 else 500)
            }
            }
            println("Formal v0.4.0 $id $mode actual active resource and real save PASS")
        }
    }
}
