package com.xiaoxuhui.gamehub

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.security.KeyPairGenerator
import java.security.Signature
import java.util.Base64

class ResourcePolicyTest {
    private fun payload(): JSONObject {
        val repos = mapOf("conway" to "conway-life-game", "eml" to "EML", "light" to "light_game", "turing" to "turing-machine-simulator")
        return JSONObject().put("schemaVersion", 1).put("channel", "game-hub-resources-v1").put("releaseId", 10)
            .put("catalogSequence", "1").put("issuedAt", "2026-10-08T00:00:00.000Z").put("expiresAt", "2026-10-09T00:00:00.000Z")
            .put("games", JSONArray(repos.entries.mapIndexed { index, (id, repo) ->
                val entry = if (id == "eml") "eml-workbench.html" else "index.html"
                JSONObject().put("id", id).put("version", "1.0.0").put("contentCode", 1)
                    .put("sourceRepository", "https://github.com/xiaoxuhui/$repo.git").put("sourceRevision", "a".repeat(40))
                    .put("minHostVersionCode", 3).put("maxHostVersionCode", 100).put("resourceProtocol", 1)
                    .put("storageContract", ResourcePolicy.contract(id)).put("entryPage", entry).put("assetId", index + 100)
                    .put("archiveBytes", 100).put("archiveSha256", "b".repeat(64)).put("releaseNotes", "fixture")
                    .put("files", JSONArray(listOf(entry, "LICENSE").map { path -> JSONObject().put("path", path).put("bytes", 10).put("sha256", "c".repeat(64)).put("mime", ResourcePolicy.mime(path)) }))
            }))
    }
    private fun rejected(block: () -> Unit) { try { block(); fail("Expected rejection") } catch (error: Exception) { assertNotNull(error) } }
    @Test fun pendingOfferRejectsExpiryAndChangedAssetBeforeDownloadSlotOrNetwork() {
        val catalog = ResourcePolicy.parseCatalog(payload(), "d".repeat(64))
        val offer = ResourceOffer(catalog, byteArrayOf())
        val game = catalog.games.first()
        offer.requireDownload(game, catalog.expiresAt - 1)
        rejected { offer.requireDownload(game, catalog.expiresAt) }
        rejected { offer.requireDownload(game, catalog.issuedAt - 300001) }
        rejected { offer.requireDownload(game.copy(assetId = game.assetId + 1000), catalog.issuedAt) }
        for (manual in listOf(false, true)) {
            val gate = UpdateTaskGate({ 0 }, { catalog.issuedAt }, { _, _ -> })
            gate.setPresence(true, true); gate.setNetwork(UpdateNetwork(true, true))
            rejected { offer.reserveDownload(game, gate, manual, false, catalog.expiresAt) }
            assertFalse("Expired automatic/manual offer must not reserve a network task", gate.busy())
            val valid = offer.reserveDownload(game, gate, manual, false, catalog.issuedAt)!!
            assertTrue(gate.valid(valid)); gate.finish(valid)
        }
        // Rechecking can refresh the proof without moving the installed resource identity.
        offer.copy(catalog = catalog.copy(expiresAt = catalog.expiresAt + 1000)).requireDownload(game, catalog.expiresAt)
    }
    @Test fun strictJsonRejectsDuplicatesInvalidUtf8AndCoercion() {
        for (text in listOf("{\"a\":1,\"a\":2}", "{\"a\":1,\"\\u0061\":2}", "{\"a\":1,}", "{\"a\":01}", "{}{}", "\uFEFF{}")) rejected { StrictJson.parse(text.toByteArray()) }
        rejected { StrictJson.parse(byteArrayOf(0xff.toByte())) }
        assertEquals("你好", StrictJson.parse("{\"a\":\"你好\"}".toByteArray()).getString("a"))
        rejected { ResourcePolicy.integer(JSONObject().put("n", "1"), "n") }
        rejected { ResourcePolicy.integer(JSONObject().put("n", 1.5), "n") }
    }
    @Test fun fourGamesRequireSourceIdentityContractAndUniqueFiles() {
        val valid = ResourcePolicy.parseCatalog(payload(), "d".repeat(64)); assertEquals(4, valid.games.size)
        assertTrue(valid.games[0].compatible(3, ResourcePolicy.contract("conway")))
        assertFalse(valid.games[0].compatible(2, ResourcePolicy.contract("conway")))
        for (key in listOf("sourceRepository", "storageContract", "entryPage")) {
            val json = payload(); json.getJSONArray("games").getJSONObject(0).put(key, "changed"); rejected { ResourcePolicy.parseCatalog(json, "d".repeat(64)) }
        }
        val duplicate = payload(); duplicate.getJSONArray("games").put(1, duplicate.getJSONArray("games").getJSONObject(0)); rejected { ResourcePolicy.parseCatalog(duplicate, "d".repeat(64)) }
        val paths = payload(); val files = paths.getJSONArray("games").getJSONObject(0).getJSONArray("files"); files.put(files.getJSONObject(0)); rejected { ResourcePolicy.parseCatalog(paths, "d".repeat(64)) }
    }
    @Test fun signatureVerifiesRawBytesRejectsTamperAndUnknownKey() {
        val pair = KeyPairGenerator.getInstance("RSA").apply { initialize(3072) }.generateKeyPair()
        val bytes = payload().toString().toByteArray()
        val signature = Signature.getInstance("SHA256withRSA").run { initSign(pair.private); update(bytes); sign() }
        val envelope = JSONObject().put("envelopeVersion", 1).put("keyId", "test").put("payloadBase64", Base64.getEncoder().encodeToString(bytes)).put("signatureBase64", Base64.getEncoder().encodeToString(signature))
        val now = 1791417600000L // 2026-10-08T00:00:00Z; deterministic fixture clock.
        assertEquals(1L, ResourcePolicy.verifyEnvelope(envelope.toString().toByteArray(), pair.public.encoded, "test", now).sequence)
        rejected { ResourcePolicy.verifyEnvelope(envelope.toString().toByteArray(), pair.public.encoded, "test", now - 300001) }
        rejected { ResourcePolicy.verifyEnvelope(envelope.toString().toByteArray(), pair.public.encoded, "test", now + 86400000) }
        rejected { ResourcePolicy.verifyEnvelope(envelope.toString().toByteArray(), pair.public.encoded, "other") }
        envelope.put("payloadBase64", Base64.getEncoder().encodeToString("{}".toByteArray()))
        rejected { ResourcePolicy.verifyEnvelope(envelope.toString().toByteArray(), pair.public.encoded, "test") }
    }
    @Test fun catalogFreshnessBlocksExpiryAndClockAnomalyWithoutChangingInstalledProofPolicy() {
        val catalog = ResourcePolicy.parseCatalog(payload(), "d".repeat(64))
        catalog.requireFresh(catalog.issuedAt)
        catalog.requireFresh(catalog.issuedAt - 300000)
        rejected { catalog.requireFresh(catalog.issuedAt - 300001) }
        rejected { catalog.requireFresh(catalog.expiresAt) }
    }
    @Test fun pathsBudgetsAndTimestampAreStrict() {
        for (path in listOf("../x", "/x", "a\\b", "a//b", "C:x", "a%2fb", "plugin.dex", "plugin.so")) rejected { ResourcePolicy.safePath(path) }
        for (time in listOf("2026-02-30T00:00:00.000Z", "2026-10-08", "2026-10-08T00:00:00.000+00:00")) {
            val json = payload().put("issuedAt", time); rejected { ResourcePolicy.parseCatalog(json, "d".repeat(64)) }
        }
        val sequence = payload().put("catalogSequence", "9223372036854775808"); rejected { ResourcePolicy.parseCatalog(sequence, "d".repeat(64)) }
        val oversized = payload(); oversized.getJSONArray("games").getJSONObject(0).put("archiveBytes", ResourcePolicy.MAX_ARCHIVE + 1); rejected { ResourcePolicy.parseCatalog(oversized, "d".repeat(64)) }
    }
}
