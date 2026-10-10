package com.xiaoxuhui.gamehub

import android.app.AlertDialog
import android.content.pm.PackageManager
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Assume
import org.junit.Test
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest

/** Explicit controller for the real signed 0.4.1; never injects transport, key or resource state. */
class ProductionHallUpdateDeviceTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private fun sha(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    private fun await(label: String, predicate: () -> Boolean) {
        val until = SystemClock.uptimeMillis() + 180000
        do { if (predicate()) return; Thread.sleep(150) } while (SystemClock.uptimeMillis() < until)
        fail("Actual formal check timed out: $label")
    }
    private fun button(view: View, text: String): TextView? {
        if (view is TextView && view.text.toString() == text) return view
        if (view is ViewGroup) for (index in 0 until view.childCount) button(view.getChildAt(index), text)?.let { return it }
        return null
    }
    @Test fun realFormalHallChecksAndPreservesActivatedResources() {
        val arguments = InstrumentationRegistry.getArguments()
        val mode = arguments.getString("formalHallMode")
        Assume.assumeTrue("Explicit real formal 0.4.1 controller required", mode != null)
        require(mode in setOf("startup", "manual", "offline", "coldOffline", "stageFuture"))
        val context = instrumentation.targetContext
        val expectedApk = requireNotNull(arguments.getString("formalApkSha256"))
        require(Regex("^[0-9a-f]{64}$").matches(expectedApk))
        assertEquals(expectedApk, sha(File(context.applicationInfo.sourceDir).readBytes()))
        val info = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
        assertEquals("0.4.1", info.versionName); assertEquals(5L, info.longVersionCode)
        assertEquals(1, info.signingInfo!!.apkContentsSigners.size)
        assertEquals("44e92c1ad3d1a0462b33d844c32238bdeb4739fd5e5a6ef7639fdf4007125ae2", sha(info.signingInfo!!.apkContentsSigners.single().toByteArray()))
        val runtime = ResourceRuntime.get(context)
        assertEquals(5, runtime.hostCode)
        assertEquals("649107df10ad8f48e8da1d4f992fe652a63fea448fa17dce081b87333a892673", sha(runtime.publicKey))
        if (mode == "stageFuture") {
            val expectedFixture = requireNotNull(arguments.getString("fixtureSha256"))
            require(Regex("^[0-9a-f]{64}$").matches(expectedFixture))
            val target = File(context.cacheDir, "updates/fixture.apk")
            assertTrue(target.parentFile!!.isDirectory || target.parentFile!!.mkdirs())
            instrumentation.context.assets.open("newer-fixture.apk").use { input ->
                FileOutputStream(target).use { output -> input.copyTo(output); output.fd.sync() }
            }
            assertEquals(expectedFixture, sha(target.readBytes()))
            println("Formal 0.4.1 private future fixture staged; no install or public asset changed")
            return
        }
        val expectedResources = mapOf(
            "light" to "19adc2db9b143289c4c8fa6b83d024209ce050fd7744888bd932a7035d115267",
            "turing" to "ad26e84c8b60d88bcff9f6569172e2f2e518aa031e036ecafd1432731f63af43",
            "lambda-diagram-game" to "0ee2f0ef41545e2364172a3ec2c74481c9cb16ae3c6361a66786f24d0594cdb9")
        for ((id, digest) in expectedResources) {
            val local = runtime.storeFor(id).describeAll().getValue(id)
            assertNull(local.stateError); assertNull(local.activeError); assertNull(local.readyError)
            val active = requireNotNull(local.active)
            assertEquals(2, active.contentCode); assertEquals(digest, active.archiveSha256)
            assertEquals(active.identity, local.selection.active); assertNull(local.selection.ready)
        }
        val startedAt = System.currentTimeMillis()
        val owner = UpdateCoordinator.get(context)
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            val versions = mapOf("conway" to "0.17.0", "eml" to "1.3.0", "light" to "1.2.1", "turing" to "0.5.1", "lambda-diagram-game" to "0.3.1")
            fun fresh(after: Long): Boolean {
                val state = owner.snapshot()
                return !state.busy && state.localLoaded && state.upstreamResults.size == 6 && versions.all { (id, version) ->
                    val result = state.upstreamResults[id]
                    result?.issue == null && result?.publication?.version == version && (result?.checkedAt ?: 0) >= after
                }
            }
            if (mode == "coldOffline") {
                await("offline state") { owner.snapshot().localLoaded && owner.snapshot().upstreamStatus.contains("离线") && !owner.snapshot().busy }
                val state = owner.snapshot()
                assertTrue(state.apkRemembered); assertTrue(state.resourcesRemembered); assertTrue(state.dynamicRemembered)
                assertTrue(state.resources.isEmpty()); assertTrue(state.dynamicResources.isEmpty())
                assertTrue("Cold process has no persisted upstream publications", state.upstreamResults.isEmpty())
            } else {
                await("real startup five publications and sixth explicit issue") { fresh(startedAt) }
                if (mode == "manual") {
                    val before = versions.keys.associateWith { owner.snapshot().upstreamResults.getValue(it).checkedAt!! }
                    scenario.onActivity { activity ->
                        val summary = MainActivity::class.java.getDeclaredField("updateSummary").apply { isAccessible = true }.get(activity) as TextView
                        assertTrue(summary.performClick())
                        @Suppress("UNCHECKED_CAST")
                        val dialogs = MainActivity::class.java.getDeclaredField("updateDialogs").apply { isAccessible = true }.get(activity) as Set<AlertDialog>
                        val dialog = dialogs.single { it.isShowing }
                        val check = requireNotNull(button(dialog.window!!.decorView, "立即检查"))
                        assertTrue(check.isEnabled); assertTrue(check.performClick())
                    }
                    await("real manual requery") { fresh(startedAt) && versions.keys.all { owner.snapshot().upstreamResults.getValue(it).checkedAt!! > before.getValue(it) } }
                }
                val state = owner.snapshot()
                val missing = state.upstreamResults.getValue("abelian-sandpile")
                assertNull(missing.publication); assertNull(missing.checkedAt)
                assertTrue(missing.issue.orEmpty().contains("未找到正式发布"))
                assertFalse(state.apkRemembered); assertNotNull(state.apkCheckedAt); assertNull(state.apk)
                assertTrue(state.apkStatus.contains("已安装大厅 0.4.1")); assertTrue(state.apkStatus.contains("已核对"))
                assertFalse(state.resourcesRemembered); assertFalse(state.dynamicRemembered)
                for ((id, version) in versions) {
                    scenario.onActivity { activity ->
                        val message = MainActivity::class.java.getDeclaredMethod("sourceMessage", String::class.java, UpdateSnapshot::class.java)
                            .apply { isAccessible = true }.invoke(activity, id, state) as SourceVersionMessage
                        assertFalse(message.update); assertTrue(message.text.contains("已安装 v$version（已核对发布）"))
                    }
                }
                if (mode == "offline") {
                    // The external controller disconnects only its marked owned emulator after this line.
                    assertEquals(6, state.upstreamResults.size)
                    assertTrue("Real uninstalled directory offers exist before disconnect", state.dynamicResources.isNotEmpty())
                    println("WAITING_FOR_OWN_DEVICE_DISCONNECT: six real results and fresh directory offers recorded")
                    await("actual online-to-offline transition") { owner.snapshot().upstreamStatus.contains("离线") && !owner.snapshot().busy }
                    val disconnected = owner.snapshot()
                    assertEquals(state.upstreamResults.keys, disconnected.upstreamResults.keys)
                    for ((id, original) in state.upstreamResults) {
                        val retained = disconnected.upstreamResults.getValue(id)
                        assertEquals(original.publication, retained.publication)
                        assertEquals(original.checkedAt, retained.checkedAt)
                        assertTrue("$id explicitly historical", retained.issue.orEmpty().contains("离线"))
                    }
                    assertTrue(disconnected.apkRemembered); assertTrue(disconnected.resourcesRemembered); assertTrue(disconnected.dynamicRemembered)
                    assertTrue(disconnected.resources.isEmpty()); assertTrue(disconnected.dynamicResources.isEmpty())
                }
            }
            println("Formal 0.4.1 $mode production checks PASS: ${owner.snapshot().apkStatus}; ${owner.snapshot().upstreamStatus}")
            owner.snapshot().upstreamResults.forEach { (id, result) -> println("Actual source $id: version=${result.publication?.version}, checkedAt=${result.checkedAt}, issue=${result.issue}") }
        }
    }
}
