package com.xiaoxuhui.gamehub

import android.content.Context
import android.content.ContextWrapper
import androidx.test.core.app.ApplicationProvider
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.File
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Controlled HTTPS connections; production signature, HTTP budgets, copy, store and task gate run unchanged. */
class UpdateCoordinatorDeviceTest {
    private class Harness : AutoCloseable {
        val base = ApplicationProvider.getApplicationContext<Context>()
        val fixture = ResourceDeviceFixture(base)
        private val preferenceNames = mutableSetOf<String>()
        val context = object : ContextWrapper(base) {
            override fun getApplicationContext(): Context = this
            override fun getFilesDir() = File(fixture.root, "coordinator-files").apply { mkdirs() }
            override fun getCacheDir() = File(fixture.root, "coordinator-cache").apply { mkdirs() }
            override fun getSharedPreferences(name: String, mode: Int): android.content.SharedPreferences {
                val isolated = fixture.root.name + "-" + name
                preferenceNames.add(isolated)
                return base.getSharedPreferences(isolated, mode)
            }
        }
        @Volatile var network = UpdateNetwork(true, true)
        @Volatile var apkStatus = 200
        @Volatile var resourceStatus = 200
        val sourceStatuses = java.util.concurrent.ConcurrentHashMap<String, Int>()
        @Volatile var sourceTimeout: String? = null
        @Volatile var corruptArchive = false
        @Volatile var blockArchive = false
        val entered = CountDownLatch(1)
        val releaseRead = CountDownLatch(1)
        val requests = CopyOnWriteArrayList<String>()
        val disconnected = CopyOnWriteArrayList<String>()
        val envelope = fixture.onlyLightEnvelope()
        val catalog = ResourcePolicy.verifyEnvelope(envelope, fixture.publicKey)
        val light = catalog.games.single { it.id == "light" }
        private val http = PublicReleaseHttp({ url -> connection(url) })
        private val owners = mutableListOf<UpdateCoordinator>()
        fun owner(store: GameResourceStore = fixture.store) = UpdateCoordinator.createForVerification(context,
            CoordinatorVerificationEnvironment(store, fixture.publicKey, http, { network })).also { owners.add(it) }
        fun zipRequests() = requests.filter { url -> catalog.games.any { url.endsWith("/releases/assets/${it.assetId}") } }
        private fun connection(url: String): HttpURLConnection {
            requests.add(url)
            var status = 200
            val bytes = when {
                url == "${PublicReleaseHttp.API_ROOT}/releases/latest" -> {
                    status = apkStatus
                    JSONObject().put("draft", false).put("prerelease", false).put("tag_name", "v0.4.1")
                        .put("assets", JSONArray().put(JSONObject().put("name", "game-hub.apk").put("id", 900).put("size", 1234).put("digest", "sha256:" + "a".repeat(64)))).toString().toByteArray()
                }
                UpstreamReleasePolicy.repositories.any { it.latestUrl == url } -> {
                    val source = UpstreamReleasePolicy.repositories.single { it.latestUrl == url }
                    status = sourceStatuses[source.gameId] ?: 200
                    val version = when(source.gameId) {
                        "conway" -> "0.17.0"; "eml" -> "1.3.0"; "light" -> "1.2.1"; "turing" -> "0.5.1"
                        "abelian-sandpile" -> "0.1.2"; else -> "0.3.1"
                    }
                    JSONObject().put("id", 100).put("draft", false).put("prerelease", false).put("tag_name", "v$version")
                        .put("html_url", "https://github.com/xiaoxuhui/${source.repository}/releases/tag/v$version").toString().toByteArray()
                }
                url.endsWith("/releases/tags/game-resources-v1") -> {
                    status = resourceStatus
                    JSONObject().put("draft", false).put("prerelease", true).put("tag_name", "game-resources-v1").put("id", 1).toString().toByteArray()
                }
                url.endsWith("/releases/1/assets?per_page=100&page=1") -> JSONArray().apply {
                    put(JSONObject().put("id", 50).put("name", "catalog.signed.json").put("state", "uploaded").put("size", envelope.size).put("digest", "sha256:" + ResourcePolicy.sha256(envelope)))
                    catalog.games.forEach { put(JSONObject().put("id", it.assetId).put("name", it.assetName).put("state", "uploaded").put("size", it.archiveBytes).put("digest", "sha256:" + it.archiveSha256)) }
                }.toString().toByteArray()
                url.endsWith("/releases/assets/50") -> envelope
                else -> {
                    val game = catalog.games.singleOrNull { url.endsWith("/releases/assets/${it.assetId}") } ?: error("Unexpected download: $url")
                    fixture.archiveBytes(game.id).also { if (corruptArchive) it[0] = (it[0].toInt() xor 1).toByte() }
                }
            }
            return object : HttpURLConnection(URL(url)) {
                override fun connect() {}
                override fun usingProxy() = false
                override fun disconnect() { disconnected.add(url) }
                override fun getResponseCode(): Int {
                    if (sourceTimeout?.let { UpstreamReleasePolicy.repository(it).latestUrl == url } == true)
                        throw java.net.SocketTimeoutException("源查询超时")
                    return status
                }
                override fun getContentLengthLong() = bytes.size.toLong()
                override fun getHeaderField(name: String?) = if (name == "Retry-After") "60" else null
                override fun getInputStream(): InputStream {
                    val stream = ByteArrayInputStream(bytes)
                    if (!blockArchive || !url.endsWith("/releases/assets/${light.assetId}")) return stream
                    return object : java.io.FilterInputStream(stream) {
                        private var reads = 0
                        override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
                            if (reads++ == 1) { entered.countDown(); check(releaseRead.await(30, TimeUnit.SECONDS)) { "Fixture read was not released" } }
                            return `in`.read(buffer, offset, length)
                        }
                    }
                }
            }
        }
        override fun close() {
            releaseRead.countDown()
            owners.forEach { it.closeVerification() }
            preferenceNames.forEach { assertTrue(base.deleteSharedPreferences(it)) }
            fixture.close()
        }
    }
    private fun await(label: String, condition: () -> Boolean) {
        val end = System.nanoTime() + TimeUnit.SECONDS.toNanos(25)
        while (!condition()) { if (System.nanoTime() >= end) fail("Timeout: $label"); Thread.sleep(25) }
    }
    private fun checked(owner: UpdateCoordinator) = await("both queries complete: ${owner.snapshot()}") {
        val state = owner.snapshot(); state.apkCheckedAt != null && state.resourcesCheckedAt != null && !state.busy
    }
    private fun assertOnlyLight(h: Harness) {
        assertEquals(listOf("${PublicReleaseHttp.API_ROOT}/releases/assets/${h.light.assetId}"), h.zipRequests())
        assertFalse(h.requests.any { it.endsWith("/releases/assets/900") })
        val persisted = h.fixture.reopenedStore()
        assertTrue(persisted.selection("light").ready!!.startsWith("2-"))
        for (id in listOf("conway", "eml", "turing")) {
            assertEquals("builtin", persisted.selection(id).active)
            assertNull(persisted.selection(id).ready)
        }
        assertTrue(File(h.context.cacheDir, "resource-updates").listFiles().orEmpty().isEmpty())
        assertEquals(h.requests.size, h.disconnected.size)
    }
    @Test fun wifiAutomaticallyDownloadsOnlyChangedGameAndNeverTheApk() {
        Harness().use { h ->
            val owner = h.owner(); owner.presence(true, true)
            await("Light ready") { !owner.snapshot().busy && owner.snapshot().localResources["light"]?.ready?.contentCode == 2 }
            assertOnlyLight(h); assertEquals("0.4.1", owner.snapshot().apk!!.version)
            assertTrue(owner.snapshot().resources.isEmpty())
            val session = h.fixture.store.openSession("light", true)
            try { assertEquals(h.light.identity, h.fixture.store.selection("light").active) } finally { session.close() }
        }
    }
    @Test fun meteredNeedsManualConfirmationAndSavedAutomaticOptOutPersists() {
        Harness().use { h ->
            h.network = UpdateNetwork(true, false)
            val owner = h.owner(); owner.presence(true, true); checked(owner)
            assertTrue(h.zipRequests().isEmpty()); assertFalse(owner.downloadResource("light", false))
            assertTrue(owner.settings(false, false)); await("settings durable") { !owner.snapshot().settingsSaving }
            h.network = UpdateNetwork(true, true); owner.presence(true, true)
            assertTrue(h.zipRequests().isEmpty())
            owner.closeVerification()
            val reopened = h.owner(h.fixture.reopenedStore())
            await("historical metadata") { reopened.snapshot().apkRemembered && reopened.snapshot().resourcesRemembered }
            assertFalse(reopened.snapshot().automatic); assertTrue(reopened.snapshot().resources.isEmpty())
            assertFalse(reopened.downloadApk(false)); assertFalse(reopened.downloadResource("light", true))
            h.network = UpdateNetwork(true, false); reopened.presence(true, true); checked(reopened)
            assertFalse(reopened.downloadResource("light", false)); assertTrue(reopened.downloadResource("light", true))
            await("manual metered complete") { !reopened.snapshot().busy && reopened.snapshot().localResources["light"]?.ready != null }
            assertOnlyLight(h)
        }
    }
    @Test fun gameBackgroundAndMeteredTransitionsCancelHoldBusyUntilCleanupThenAllowManualRetry() {
        for (transition in listOf("game", "background", "metered")) Harness().use { h ->
            h.blockArchive = true
            val owner = h.owner(); owner.presence(true, true)
            assertTrue("download entered: $transition", h.entered.await(25, TimeUnit.SECONDS))
            when (transition) {
                "game" -> owner.presence(true, false)
                "background" -> owner.presence(false, true)
                else -> { h.network = UpdateNetwork(true, false); owner.presence(true, true) }
            }
            assertTrue(owner.snapshot().busy); assertTrue(owner.snapshot().done > 0); assertEquals(h.light.archiveBytes, owner.snapshot().total); assertFalse(owner.downloadResource("light", true)); assertFalse(owner.check(true))
            h.blockArchive = false; h.releaseRead.countDown()
            await("cancel cleanup: $transition") { !owner.snapshot().busy }
            assertEquals("builtin", h.fixture.store.selection("light").active); assertNull(h.fixture.store.selection("light").ready)
            assertTrue(File(h.context.cacheDir, "resource-updates").listFiles().orEmpty().isEmpty())
            h.network = UpdateNetwork(true, true); owner.presence(true, true)
            assertEquals(1, h.zipRequests().size) // Same-round automatic retry is suppressed.
            assertTrue(owner.downloadResource("light", false))
            await("manual retry ready: $transition") { !owner.snapshot().busy && owner.snapshot().localResources["light"]?.ready != null }
            assertEquals(2, h.zipRequests().size); assertEquals(h.requests.size, h.disconnected.size)
        }
    }
    @Test fun badArchivePreservesBuiltinAndCleansPartBeforeExplicitRetry() {
        Harness().use { h ->
            h.corruptArchive = true
            val owner = h.owner(); owner.presence(true, true)
            await("digest rejection") { h.zipRequests().size == 1 && !owner.snapshot().busy }
            assertNull(h.fixture.store.selection("light").ready); assertEquals("builtin", h.fixture.store.selection("light").active)
            assertTrue(owner.snapshot().resourceStatus.contains("校验失败"))
            assertTrue(File(h.context.cacheDir, "resource-updates").listFiles().orEmpty().isEmpty())
            h.corruptArchive = false; assertTrue(owner.downloadResource("light", false))
            await("retry installed") { !owner.snapshot().busy && owner.snapshot().localResources["light"]?.ready != null }
            assertEquals(2, h.zipRequests().size)
        }
    }
    @Test fun apkRateLimitsAndMissingReleaseDoNotBlockResourceChannel() {
        for (status in listOf(403, 429, 404)) Harness().use { h ->
            h.apkStatus = status
            val owner = h.owner(); owner.presence(true, true)
            await("resource despite APK $status") { !owner.snapshot().busy && owner.snapshot().localResources["light"]?.ready != null }
            assertNull(owner.snapshot().apkCheckedAt); assertOnlyLight(h)
            val apkQueries = h.requests.count { it == "${PublicReleaseHttp.API_ROOT}/releases/latest" }
            assertTrue(owner.check(true)); await("manual query ended") { !owner.snapshot().busy }
            assertEquals(if (status == 404) apkQueries + 1 else apkQueries, h.requests.count { it == "${PublicReleaseHttp.API_ROOT}/releases/latest" })
            assertEquals(1, h.zipRequests().size)
        }
    }
    @Test fun resourceRateLimitPersistsIndependentlyWhileApkReminderRemainsAvailable() {
        Harness().use { h ->
            h.resourceStatus = 429
            val owner = h.owner(); owner.presence(true, true)
            await("resource limit") { !owner.snapshot().busy && owner.snapshot().apkCheckedAt != null }
            assertNull(owner.snapshot().resourcesCheckedAt); assertTrue(h.zipRequests().isEmpty())
            owner.closeVerification()
            val reopened = h.owner(h.fixture.reopenedStore()); h.resourceStatus = 200
            reopened.presence(true, true)
            await("restored resource backoff") { !reopened.snapshot().busy && reopened.snapshot().resourceStatus.contains("限流") }
            assertEquals(1, h.requests.count { it.endsWith("/releases/tags/game-resources-v1") })
            assertEquals("0.4.1", reopened.snapshot().apk!!.version); assertFalse(reopened.snapshot().apkRemembered)
        }
    }

    @Test fun manualAndStartupQueriesIncludeAllRegisteredGameRepositories() {
        Harness().use { h ->
            h.network = UpdateNetwork(true, false)
            val owner = h.owner(); owner.presence(true, true); checked(owner)
            for (source in UpstreamReleasePolicy.repositories) assertEquals(source.gameId, 1, h.requests.count { it == source.latestUrl })
            assertTrue(owner.check(true)); await("manual query finished") { !owner.snapshot().busy }
            for (source in UpstreamReleasePolicy.repositories) assertEquals(source.gameId, 2, h.requests.count { it == source.latestUrl })
        }
    }

    @Test fun goingOfflineMarksSuccessfulResultsAsHistorical() {
        Harness().use { h ->
            h.network = UpdateNetwork(true, false)
            val owner = h.owner(); owner.presence(true, true); checked(owner)
            assertFalse(owner.snapshot().apkRemembered); assertFalse(owner.snapshot().resourcesRemembered)
            h.network = UpdateNetwork(false, false); owner.presence(true, true)
            assertTrue(owner.snapshot().apkRemembered); assertTrue(owner.snapshot().resourcesRemembered)
            assertTrue(owner.snapshot().apkStatus.contains("离线")); assertTrue(owner.snapshot().resourceStatus.contains("离线"))
            assertFalse(owner.downloadApk(false)); assertEquals("builtin", h.fixture.store.selection("light").active)
        }
    }

    @Test fun source404AndTimeoutDoNotHideOtherVersionsOrSignedResources() {
        Harness().use { h ->
            h.network = UpdateNetwork(true, false); h.sourceStatuses["abelian-sandpile"] = 404; h.sourceTimeout = "light"
            val owner = h.owner(); owner.presence(true, true); checked(owner)
            assertEquals("0.5.1", owner.snapshot().upstreamResults["turing"]!!.publication!!.version)
            assertEquals("0.3.1", owner.snapshot().upstreamResults["lambda-diagram-game"]!!.publication!!.version)
            assertTrue(owner.snapshot().upstreamResults["abelian-sandpile"]!!.issue!!.contains("未找到正式发布"))
            assertTrue(owner.snapshot().upstreamResults["light"]!!.issue!!.contains("超时"))
            assertTrue(owner.snapshot().resources.any { it.id == "light" }); assertFalse(owner.snapshot().resourcesRemembered)
            assertEquals("0.4.1", owner.snapshot().apk!!.version); assertEquals(h.requests.size, h.disconnected.size)
        }
    }

    @Test fun sourceRateLimitIsDurableAndDoesNotBlockOtherUpdateChannels() {
        Harness().use { h ->
            h.network = UpdateNetwork(true, false); h.sourceStatuses["light"] = 429
            val owner = h.owner(); owner.presence(true, true); checked(owner)
            assertTrue(owner.snapshot().upstreamResults["light"]!!.issue!!.contains("受限"))
            assertTrue(owner.snapshot().upstreamResults["turing"]!!.issue!!.contains("限流"))
            val sourceQueries = h.requests.count { url -> UpstreamReleasePolicy.repositories.any { it.latestUrl == url } }
            owner.closeVerification(); h.sourceStatuses.clear()
            val reopened = h.owner(h.fixture.reopenedStore()); reopened.presence(true, true); checked(reopened)
            assertEquals(sourceQueries, h.requests.count { url -> UpstreamReleasePolicy.repositories.any { it.latestUrl == url } })
            assertEquals("0.4.1", reopened.snapshot().apk!!.version); assertTrue(reopened.snapshot().resources.any { it.id == "light" })
        }
    }
}
