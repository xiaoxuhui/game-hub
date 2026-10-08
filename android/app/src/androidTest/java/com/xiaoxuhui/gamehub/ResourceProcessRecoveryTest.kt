package com.xiaoxuhui.gamehub

import android.content.Context
import android.content.ContextWrapper
import android.os.Process
import android.util.AtomicFile
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

/** Invoked in two separate instrumentation processes by resource_process_smoke.ps1. */
class ResourceProcessRecoveryTest {
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val root get() = File(context.filesDir, "process-recovery-verification")
    private val phase get() = InstrumentationRegistry.getArguments().getString("phase")!!.also {
        require(it in setOf("download", "extract", "state-before", "state-after", "journal-half"))
    }
    private fun blockAtCutpoint(extra: JSONObject = JSONObject()): Nothing {
        val marker = extra.put("phase", phase).put("pid", Process.myPid())
        when (phase) {
            "download" -> marker.put("partBytes", File(isolatedContext().cacheDir, "resource-updates").listFiles().orEmpty().sumOf { it.length() })
            "extract" -> marker.put("stagingFiles", File(root, "store/staging").walkTopDown().count { it.isFile })
            "state-before" -> marker.put("atomicNewExists", File(root, "store/state.json.new").isFile)
            "state-after" -> marker.put("persistedReady", JSONObject(File(root, "store/state.json").readText()).getJSONObject("games").getJSONObject("light").getString("ready"))
            "journal-half" -> {
                val key = File(root, "key.der").readBytes()
                marker.put("firstSequence", ResourcePolicy.verifyInstalledProof(File(root, "store/catalog-history/highest-a.signed.json").readBytes(), key).sequence)
                marker.put("secondSequence", ResourcePolicy.verifyInstalledProof(File(root, "store/catalog-history/highest-b.signed.json").readBytes(), key).sequence)
            }
        }
        FileOutputStream(File(root, "cutpoint.json")).use { output -> output.write(marker.toString().toByteArray()); output.fd.sync() }
        // The host must force-stop this actual application process, never return into test cleanup.
        Thread.sleep(120000)
        error("Host did not terminate the process at the cutpoint")
    }
    private fun isolatedContext() = object : ContextWrapper(context) {
        override fun getApplicationContext(): Context = this
        override fun getFilesDir() = File(root, "coordinator-files").apply { mkdirs() }
        override fun getCacheDir() = File(root, "coordinator-cache").apply { mkdirs() }
        override fun getSharedPreferences(name: String, mode: Int) = context.getSharedPreferences("process-recovery-$phase-$name", mode)
    }
    @Test fun prepareInterruptedOperation() {
        org.junit.Assume.assumeTrue("Requires the external force-stop controller", InstrumentationRegistry.getArguments().getString("phase") != null)
        val target = root.canonicalFile
        require(target.parentFile == context.filesDir.canonicalFile)
        if (target.exists()) require(target.deleteRecursively())
        require(target.mkdirs())
        ResourceDeviceFixture(context).use { fixture ->
            File(root, "key.der").writeBytes(fixture.publicKey)
            File(root, "catalog.json").writeBytes(fixture.onlyLightEnvelope())
            File(root, "next-catalog.json").writeBytes(fixture.renewal(3))
            File(root, "light.zip").writeBytes(fixture.archiveBytes("light"))
        } // Ephemeral private key and fixture tree are gone before the host kills us.
        val userSave = File(root, "coordinator-files/save-sentinel.json").apply { parentFile!!.mkdirs() }
        userSave.writeText("{\"fixtureSave\":\"retain-through-real-process-death\",\"value\":314159}")
        File(root, "save.sha256").writeText(ResourcePolicy.sha256(userSave.readBytes()))
        val key = File(root, "key.der").readBytes()
        val envelope = File(root, "catalog.json").readBytes()
        val game = ResourcePolicy.verifyEnvelope(envelope, key).games.single { it.id == "light" }
        val storeRoot = File(root, "store")
        val atomic = AndroidResourceStateFile(File(storeRoot, "state.json"))
        val state = object : ResourceStateFile {
            override fun read() = atomic.read()
            override fun write(bytes: ByteArray) {
                val ready = !JSONObject(String(bytes)).getJSONObject("games").getJSONObject("light").isNull("ready")
                if (ready && phase == "state-before") {
                    val actual = AtomicFile(File(storeRoot, "state.json"))
                    val output = actual.startWrite()
                    output.write(bytes); output.fd.sync()
                    blockAtCutpoint(JSONObject().put("newBytes", bytes.size)) // No finishWrite/failWrite before external kill.
                }
                atomic.write(bytes)
                if (ready && phase == "state-after") blockAtCutpoint()
            }
        }
        val store = GameResourceStore(storeRoot, 3, key, stateFile = state, proofFile = { file ->
            val actual = AndroidResourceStateFile(file)
            object : ResourceStateFile {
                override fun read() = actual.read()
                override fun write(bytes: ByteArray) {
                    actual.write(bytes)
                    if (phase == "journal-half" && file.name == "highest-a.signed.json" && ResourcePolicy.verifyInstalledProof(bytes, key).sequence == 3L) blockAtCutpoint()
                }
            }
        })
        store.acceptCatalog(envelope)
        when (phase) {
            "journal-half" -> store.acceptCatalog(File(root, "next-catalog.json").readBytes())
            "download" -> {
                val bytes = File(root, "light.zip").readBytes()
                val http = PublicReleaseHttp({ url ->
                    require(url == "${PublicReleaseHttp.API_ROOT}/releases/assets/${game.assetId}")
                    object : HttpURLConnection(URL(url)) {
                        override fun connect() {}
                        override fun disconnect() {}
                        override fun usingProxy() = false
                        override fun getResponseCode() = 200
                        override fun getContentLengthLong() = bytes.size.toLong()
                        override fun getInputStream() = ByteArrayInputStream(bytes)
                    }
                })
                ResourceCatalogClient(key, http).download(game, File(isolatedContext().cacheDir, "resource-updates"), { false }) { done, total ->
                    if (done > 0) blockAtCutpoint(JSONObject().put("done", done).put("total", total))
                }
            }
            else -> store.install(game, envelope, File(root, "light.zip")) {
                if (phase == "extract" && File(storeRoot, "staging").walkTopDown().any { it.isFile }) blockAtCutpoint()
                false
            }
        }
        fail("The operation did not reach its intended cutpoint")
    }
    @Test fun verifyAfterActualProcessRestart() {
        org.junit.Assume.assumeTrue("Requires the external force-stop controller", InstrumentationRegistry.getArguments().getString("phase") != null)
        assertTrue(File(root, "cutpoint.json").isFile)
        val before = JSONObject(File(root, "cutpoint.json").readText())
        assertEquals(phase, before.getString("phase"))
        when (phase) {
            "download" -> { assertTrue(before.getLong("done") > 0); assertTrue(before.getLong("partBytes") > 0) }
            "extract" -> assertTrue(before.getInt("stagingFiles") > 0)
            "state-before" -> assertTrue(before.getBoolean("atomicNewExists"))
            "state-after" -> assertTrue(before.getString("persistedReady").startsWith("2-"))
            "journal-half" -> { assertEquals(3L, before.getLong("firstSequence")); assertEquals(2L, before.getLong("secondSequence")) }
        }
        assertNotEquals(before.getInt("pid"), Process.myPid())
        val key = File(root, "key.der").readBytes()
        val storeRoot = File(root, "store")
        val store = GameResourceStore(storeRoot, 3, key)
        assertNull(store.failure())
        val app = isolatedContext()
        val owner = UpdateCoordinator.createForVerification(app, CoordinatorVerificationEnvironment(store, key,
            PublicReleaseHttp({ error("Offline recovery must not open a connection") }), { UpdateNetwork(false, false) }))
        try {
            val limit = System.nanoTime() + 10_000_000_000L
            while (!owner.snapshot().localLoaded) { check(System.nanoTime() < limit); Thread.sleep(25) }
            assertNull(owner.snapshot().localReadError)
            assertTrue(File(app.cacheDir, "resource-updates").listFiles().orEmpty().isEmpty())
            assertTrue(File(storeRoot, "staging").listFiles().orEmpty().isEmpty())
            assertEquals(File(root, "save.sha256").readText(), ResourcePolicy.sha256(File(app.filesDir, "save-sentinel.json").readBytes()))
            val catalog = store.rememberedCatalog()!!
            assertEquals(if (phase == "journal-half") 3L else 2L, catalog.sequence)
            assertEquals("builtin", store.selection("light").active)
            if (phase == "state-after") {
                assertNotNull(store.selection("light").ready)
                val session = store.openSession("light", true)
                try {
                    assertEquals(2, session.game!!.contentCode)
                    assertTrue(File(session.root!!, session.game!!.entry).readText().contains("signed compatibility candidate"))
                } finally { session.close() }
            } else assertNull(store.selection("light").ready)
            if (phase == "journal-half") {
                assertTrue(runCatching { store.acceptCatalog(File(root, "catalog.json").readBytes()) }.isFailure)
            }
            val result = JSONObject().put("phase", phase).put("previousPid", before.getInt("pid")).put("newPid", Process.myPid())
                .put("sequence", catalog.sequence).put("readyCommitted", phase == "state-after").put("saveSha256", File(root, "save.sha256").readText())
            File(root, "recovered.json").writeText(result.toString())
        } finally {
            owner.closeVerification()
            context.deleteSharedPreferences("process-recovery-$phase-update-policy")
        }
    }
}
