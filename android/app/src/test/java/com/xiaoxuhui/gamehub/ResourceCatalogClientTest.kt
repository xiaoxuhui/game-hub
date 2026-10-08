package com.xiaoxuhui.gamehub

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.net.HttpURLConnection
import java.net.URL
import java.io.ByteArrayInputStream
import java.nio.file.Files
import java.security.KeyPairGenerator
import java.security.Signature
import java.util.Base64

class ResourceCatalogClientTest {
    private data class Reply(val body: ByteArray = byteArrayOf(), val status: Int = 200, val headers: Map<String, String> = emptyMap(), val beforeStatus: () -> Unit = {})
    private class Fake(private val address: String, private val reply: Reply) : HttpURLConnection(URL(address)) {
        var closed = false
        override fun connect() {}
        override fun disconnect() { closed = true }
        override fun usingProxy() = false
        override fun getResponseCode(): Int { reply.beforeStatus(); return reply.status }
        override fun getInputStream() = ByteArrayInputStream(reply.body)
        override fun getHeaderField(name: String) = reply.headers[name]
        override fun getContentLengthLong() = -1L // actual byte budget must still apply.
    }
    private class Network {
        val replies = mutableMapOf<String, Reply>(); val calls = mutableListOf<Fake>()
        fun open(url: String): HttpURLConnection = Fake(url, replies[url] ?: error("Unexpected endpoint: $url")).also { calls.add(it) }
    }
    private class Fixture {
        val now = 1791417600000L
        val pair = KeyPairGenerator.getInstance("RSA").apply { initialize(3072) }.generateKeyPair()
        val network = Network()
        val root = PublicReleaseHttp.API_ROOT
        val releaseUrl = "$root/releases/tags/game-resources-v1"
        val pageUrl = "$root/releases/10/assets?per_page=100&page=1"
        val envelope: ByteArray
        val catalog: ResourceCatalog
        val assets: List<JSONObject>
        init {
            val repos = mapOf("conway" to "conway-life-game", "eml" to "EML", "light" to "light_game", "turing" to "turing-machine-simulator")
            val games = repos.entries.mapIndexed { index, (id, repo) ->
                val entry = if (id == "eml") "eml-workbench.html" else "index.html"
                JSONObject().put("id", id).put("version", "1.0.0").put("contentCode", 2).put("sourceRepository", "https://github.com/xiaoxuhui/$repo.git").put("sourceRevision", "a".repeat(40))
                    .put("minHostVersionCode", 3).put("maxHostVersionCode", 100).put("resourceProtocol", 1).put("storageContract", ResourcePolicy.contract(id)).put("entryPage", entry)
                    .put("assetId", index + 100).put("archiveBytes", 100).put("archiveSha256", "b".repeat(64)).put("releaseNotes", "fixture")
                    .put("files", JSONArray(listOf(entry, "LICENSE").map { path -> JSONObject().put("path", path).put("bytes", 10).put("sha256", "c".repeat(64)).put("mime", ResourcePolicy.mime(path)) }))
            }
            val payload = JSONObject().put("schemaVersion", 1).put("channel", "game-hub-resources-v1").put("releaseId", 10).put("catalogSequence", "2")
                .put("issuedAt", "2026-10-08T00:00:00.000Z").put("expiresAt", "2026-10-09T00:00:00.000Z").put("games", JSONArray(games)).toString().toByteArray()
            val signature = Signature.getInstance("SHA256withRSA").run { initSign(pair.private); update(payload); sign() }
            envelope = JSONObject().put("envelopeVersion", 1).put("keyId", ResourcePolicy.KEY_ID).put("payloadBase64", Base64.getEncoder().encodeToString(payload)).put("signatureBase64", Base64.getEncoder().encodeToString(signature)).toString().toByteArray()
            catalog = ResourcePolicy.verifyEnvelope(envelope, pair.public.encoded, now = now)
            assets = listOf(asset(50, "catalog.signed.json", envelope.size.toLong(), ResourcePolicy.sha256(envelope))) + catalog.games.map { asset(it.assetId, it.assetName, it.archiveBytes, it.archiveSha256) }
            network.replies[releaseUrl] = Reply(JSONObject().put("id", 10).put("draft", false).put("prerelease", true).put("tag_name", "game-resources-v1").toString().toByteArray(), headers = mapOf("ETag" to "release"))
            network.replies[pageUrl] = Reply(JSONArray(assets).toString().toByteArray(), headers = mapOf("ETag" to "assets"))
            network.replies["$root/releases/assets/50"] = Reply(envelope)
        }
        fun http() = PublicReleaseHttp(network::open, now = { now })
        fun client(http: PublicReleaseHttp = http(), clock: () -> Long = { now }) = ResourceCatalogClient(pair.public.encoded, http, clock)
        fun asset(id: Long, name: String, size: Long, hash: String) = JSONObject().put("id", id).put("name", name).put("size", size).put("digest", "sha256:$hash").put("state", "uploaded")
    }
    private fun rejected(block: () -> Unit) { try { block(); fail("Expected rejection") } catch (error: Exception) { assertNotNull(error) } }
    @Test fun signedCatalogBindsCompleteReleaseAssetsAndRevalidatesCachedMetadata() {
        val f = Fixture(); val http = f.http(); var clock = f.now; val client = f.client(http) { clock }
        assertEquals(4, client.query().catalog.games.size)
        f.network.replies[f.releaseUrl] = Reply(status = 304); f.network.replies[f.pageUrl] = Reply(status = 304)
        assertEquals(2L, client.query().catalog.sequence)
        assertTrue(f.network.calls.any { it.getRequestProperty("If-None-Match") == "release" })
        clock += 86400000; rejected { client.query() }
        assertTrue(f.network.calls.all { it.closed })
    }
    @Test fun incompleteWrongDuplicateOrTamperedAssetMembershipFails() {
        val f = Fixture()
        for (bad in listOf(f.assets.dropLast(1), f.assets + f.assets.last(), f.assets.mapIndexed { i, item -> if (i == 1) JSONObject(item.toString()).put("name", "wrong.zip") else item }, f.assets.mapIndexed { i, item -> if (i == 0) JSONObject(item.toString()).put("digest", "sha256:${"e".repeat(64)}") else item })) {
            f.network.replies[f.pageUrl] = Reply(JSONArray(bad).toString().toByteArray()); rejected { f.client().query() }
        }
        f.network.replies[f.releaseUrl] = Reply("{\"id\":11,\"draft\":false,\"prerelease\":false,\"tag_name\":\"game-resources-v1\"}".toByteArray()); rejected { f.client().query() }
    }
    @Test fun paginatedAssetsAreCompleteAndNextLinkCannotLeaveRepository() {
        val f = Fixture(); val fillers = (0 until 99).map { f.asset(1000L + it, "retained-$it.zip", 1, "d".repeat(64)) }
        val next = "${f.root}/releases/10/assets?per_page=100&page=2"
        f.network.replies[f.pageUrl] = Reply(JSONArray(listOf(f.assets.first()) + fillers).toString().toByteArray(), headers = mapOf("Link" to "<$next>; rel=\"next\""))
        f.network.replies[next] = Reply(JSONArray(f.assets.drop(1)).toString().toByteArray())
        assertEquals(4, f.client().query().catalog.games.size)
        f.network.replies[f.pageUrl] = f.network.replies[f.pageUrl]!!.copy(headers = mapOf("Link" to "<${f.root}/releases/10/assets?page=2&per_page=100>; rel=\"next\""))
        assertEquals(4, f.client().query().catalog.games.size)
        f.network.replies[f.pageUrl] = f.network.replies[f.pageUrl]!!.copy(headers = mapOf("Link" to "<https://evil.example/assets>; rel=\"next\"")); rejected { f.client().query() }
        f.network.replies[f.pageUrl] = f.network.replies[f.pageUrl]!!.copy(headers = mapOf("Link" to "not-a-valid-next-link")); rejected { f.client().query() }
        f.network.replies[f.pageUrl] = Reply(JSONArray(f.assets + fillers.take(95)).toString().toByteArray())
        f.network.replies[next] = Reply("[]".toByteArray()); assertEquals(4, f.client().query().catalog.games.size)
        f.network.replies[next] = Reply(JSONArray(listOf(f.assets.last())).toString().toByteArray()); rejected { f.client().query() }
    }
    @Test fun actualByteBudget304WithoutCacheAndRateLimitAreExplicitFailures() {
        val network = Network(); val url = "${PublicReleaseHttp.API_ROOT}/releases/latest"; val http = PublicReleaseHttp(network::open, now = { 100000L })
        network.replies[url] = Reply(ByteArray(20)); rejected { http.metadata(url, 10, PublicReleaseHttp.deadline()) }
        network.replies[url] = Reply(status = 304); rejected { http.metadata(url, 10, PublicReleaseHttp.deadline()) }
        network.replies[url] = Reply(status = 429, headers = mapOf("Retry-After" to "120"))
        try { http.metadata(url, 10, PublicReleaseHttp.deadline()); fail() } catch (e: UpdateRateLimited) { assertEquals(220000L, e.until) }
        network.replies[url] = Reply(status = 404); try { http.metadata(url, 10, PublicReleaseHttp.deadline()); fail() } catch (e: PublicReleaseMissing) { assertNotNull(e) }
        network.replies[url] = Reply(status = 403)
        try { http.metadata(url, 10, PublicReleaseHttp.deadline()); fail() } catch (e: UpdateRateLimited) { assertEquals(3700000L, e.until) }
        assertTrue(network.calls.all { it.closed })
    }
    @Test fun cancellationWhileResponseCodeWaitsCannotReturnCached304() {
        val network = Network(); val url = "${PublicReleaseHttp.API_ROOT}/releases/latest"; val http = PublicReleaseHttp(network::open)
        network.replies[url] = Reply("{}".toByteArray(), headers = mapOf("ETag" to "cached"))
        http.metadata(url, 10, PublicReleaseHttp.deadline())
        var cancelled = false
        network.replies[url] = Reply(status = 304, beforeStatus = { cancelled = true })
        rejected { http.metadata(url, 10, PublicReleaseHttp.deadline()) { cancelled } }
        assertTrue(network.calls.all { it.closed })
    }
    @Test fun resourceDownloadChecksActualHashSizeCancellationAndCleansPartial() {
        val f = Fixture(); val bytes = "exact resource archive".toByteArray(); val game = f.catalog.games.first().copy(archiveBytes = bytes.size.toLong(), archiveSha256 = ResourcePolicy.sha256(bytes))
        val url = "${f.root}/releases/assets/${game.assetId}"; val root = Files.createTempDirectory("game-hub-download-test-").toFile()
        try {
            f.network.replies[url] = Reply(bytes); val client = f.client(); val file = client.download(game, root, { false }) { _, _ -> }
            assertArrayEquals(bytes, file.readBytes()); file.delete()
            f.network.replies[url] = Reply(bytes + 1); rejected { client.download(game, root, { false }) { _, _ -> } }; assertTrue(root.listFiles()!!.isEmpty())
            f.network.replies[url] = Reply(bytes); rejected { client.download(game, root, { true }) { _, _ -> } }; assertTrue(root.listFiles()!!.isEmpty())
            f.network.replies[url] = Reply(status = 302, headers = mapOf("Location" to "https://evil.example/download")); rejected { client.download(game, root, { false }) { _, _ -> } }; assertTrue(root.listFiles()!!.isEmpty())
        } finally { root.deleteRecursively() }
    }
}
