package com.xiaoxuhui.gamehub

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files
import java.security.KeyPairGenerator
import java.security.Signature
import java.util.Base64
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class GameResourceStoreTest {
    private class MemoryState : ResourceStateFile {
        var bytes: ByteArray? = null; var writes = 0; var failAtWrite: Int? = null
        override fun read() = bytes
        override fun write(bytes: ByteArray) { writes++; if (writes == failAtWrite) error("Injected state commit failure"); this.bytes = bytes.clone() }
    }
    private class Fixture {
        val root = Files.createTempDirectory("game-hub-store-test-").toFile()
        val pair = KeyPairGenerator.getInstance("RSA").apply { initialize(3072) }.generateKeyPair()
        val state = MemoryState()
        var time = 1791417600000L
        fun proofFile(file: File) = object : ResourceStateFile { override fun read() = if (file.isFile) file.readBytes() else null; override fun write(bytes: ByteArray) { file.parentFile!!.mkdirs(); file.writeBytes(bytes) } }
        val store get() = GameResourceStore(root, 3, pair.public.encoded, state, now = { time }, proofFile = ::proofFile)
        fun release(code: Int = 2, sequence: Int = code, body: String = "new resource", issued: String = "2026-10-08T00:00:00.000Z", expires: String = "2026-10-09T00:00:00.000Z"): Triple<ResourceGame, ByteArray, File> {
            val resources = linkedMapOf("LICENSE" to "MIT License".toByteArray(), "index.html" to "<html>$body</html>".toByteArray())
            val output = ByteArrayOutputStream()
            ZipOutputStream(output).use { zip -> for ((path, bytes) in resources) {
                val entry = ZipEntry(path).apply { method = ZipEntry.STORED; size = bytes.size.toLong(); compressedSize = size; crc = CRC32().apply { update(bytes) }.value; setTime(315532800000L) }
                zip.putNextEntry(entry); zip.write(bytes); zip.closeEntry()
            } }
            val archive = File(root.parentFile, "${root.name}-$code-$sequence.zip").apply { writeBytes(output.toByteArray()); deleteOnExit() }
            val repos = mapOf("conway" to "conway-life-game", "eml" to "EML", "light" to "light_game", "turing" to "turing-machine-simulator")
            val games = repos.entries.mapIndexed { index, (id, repo) ->
                val entry = if (id == "eml") "eml-workbench.html" else "index.html"
                val files = if (id == "conway") resources else linkedMapOf("LICENSE" to "MIT License".toByteArray(), entry to "fixture".toByteArray())
                JSONObject().put("id", id).put("version", "1.0.$code").put("contentCode", if (id == "conway") code else 1)
                    .put("sourceRepository", "https://github.com/xiaoxuhui/$repo.git").put("sourceRevision", "a".repeat(40))
                    .put("minHostVersionCode", 3).put("maxHostVersionCode", 100).put("resourceProtocol", 1)
                    .put("storageContract", ResourcePolicy.contract(id)).put("entryPage", entry).put("assetId", index + 10)
                    .put("archiveBytes", archive.length()).put("archiveSha256", ResourcePolicy.sha256(archive.readBytes())).put("releaseNotes", "fixture")
                    .put("files", JSONArray(files.map { (path, bytes) -> JSONObject().put("path", path).put("bytes", bytes.size).put("sha256", ResourcePolicy.sha256(bytes)).put("mime", ResourcePolicy.mime(path)) }))
            }
            val payload = JSONObject().put("schemaVersion", 1).put("channel", "game-hub-resources-v1").put("releaseId", 1).put("catalogSequence", sequence.toString()).put("issuedAt", issued).put("expiresAt", expires).put("games", JSONArray(games)).toString().toByteArray()
            val signature = Signature.getInstance("SHA256withRSA").run { initSign(pair.private); update(payload); sign() }
            val envelope = JSONObject().put("envelopeVersion", 1).put("keyId", ResourcePolicy.KEY_ID).put("payloadBase64", Base64.getEncoder().encodeToString(payload)).put("signatureBase64", Base64.getEncoder().encodeToString(signature)).toString().toByteArray()
            return Triple(ResourcePolicy.verifyEnvelope(envelope, pair.public.encoded, now = time).games.first(), envelope, archive)
        }
        fun close() { root.deleteRecursively() }
    }
    private fun rejected(block: () -> Unit) { try { block(); fail("Expected rejection") } catch (error: Exception) { assertNotNull(error) } }
    @Test fun completeInstallActivatesOnlyWithoutSessionAndPinnedRestoreSurvivesRestart() {
        val f = Fixture(); try {
            val store = f.store; val (game, envelope, zip) = f.release()
            val old = store.openSession("conway", true); rejected { store.install(game, envelope, zip) }; old.close()
            store.install(game, envelope, zip); assertEquals("builtin", store.selection("conway").active); assertEquals(game.identity, store.selection("conway").ready)
            store.openSession("conway", false).use { assertNull(it.game) }; assertEquals(game.identity, store.selection("conway").ready)
            store.openSession("conway", true).use { assertEquals(2, it.game!!.contentCode); assertEquals("<html>new resource</html>", File(it.root, "index.html").readText()); rejected { store.restore("conway", true) } }
            store.restore("conway", true, 2); val restarted = f.store
            assertTrue(restarted.selection("conway").pinned); assertTrue(2 in restarted.selection("conway").quarantine); assertFalse(restarted.isEligible(game))
            restarted.resumeAutomatic("conway"); assertFalse(restarted.isEligible(game))
            restarted.resumeAutomatic("conway", 2); assertTrue(restarted.isEligible(game))
        } finally { f.close() }
    }
    @Test fun stateCommitFailureLeavesOldPointerAndStagingCannotActivateAfterRestart() {
        val f = Fixture(); try {
            val store = f.store; val (game, envelope, zip) = f.release()
            store.acceptCatalog(envelope)
            f.state.failAtWrite = f.state.writes + 2; rejected { store.install(game, envelope, zip) }; f.state.failAtWrite = null
            assertTrue(File(f.root, "versions/conway/${game.identity}").isDirectory)
            val restarted = f.store; assertEquals("builtin", restarted.selection("conway").active); assertNull(restarted.selection("conway").ready)
            restarted.openSession("conway", true).use { assertNull(it.game) }
            assertTrue(File(f.root, "staging").listFiles()?.isEmpty() ?: true)
        } finally { f.close() }
    }
    @Test fun spaceFailureAndInstalledFileCorruptionNeverSelectPartialResource() {
        val f = Fixture(); try {
            val (game, envelope, zip) = f.release()
            val noSpace = GameResourceStore(f.root, 3, f.pair.public.encoded, f.state, now = { f.time }, freeSpace = { 0 }, proofFile = f::proofFile)
            rejected { noSpace.install(game, envelope, zip) }; assertEquals("builtin", noSpace.selection("conway").active)
            val store = f.store; store.install(game, envelope, zip); store.openSession("conway", true).close()
            File(f.root, "versions/conway/${game.identity}/index.html").writeText("corrupted")
            rejected { f.store.openSession("conway", true) }
            store.restore("conway", true); store.openSession("conway", true).use { assertNull(it.game) }
        } finally { f.close() }
    }
    @Test fun zipSpecialAttributesAndNativeReadBudgetsAreRejectedBeforeWriting() {
        val f = Fixture(); try {
            val (game, _, zip) = f.release(); val original = zip.readBytes()
            val central = original.indices.first { at -> at + 4 <= original.size && original[at] == 0x50.toByte() && original[at + 1] == 0x4b.toByte() && original[at + 2] == 0x01.toByte() && original[at + 3] == 0x02.toByte() }
            val altered = original.clone(); altered[central + 38] = 1; zip.writeBytes(altered)
            val target = File(f.root, "extract-fixture")
            rejected { ResourceArchive.extract(zip, target, game.copy(archiveSha256 = ResourcePolicy.sha256(altered))) }
            assertFalse(target.exists())
            rejected { ResourceIo.readBounded(java.io.ByteArrayInputStream(ByteArray(20)), 10) }
        } finally { f.close() }
    }
    @Test fun replayCodeConflictTamperAndCancellationPreserveActive() {
        val f = Fixture(); try {
            val store = f.store; val (game, envelope, zip) = f.release()
            store.install(game, envelope, zip); store.openSession("conway", true).close()
            val (_, conflicting, _) = f.release(2, 3, "conflict")
            rejected { store.acceptCatalog(conflicting) }
            val (newGame, nextEnvelope, nextZip) = f.release(3, 4)
            rejected { store.install(newGame, nextEnvelope, nextZip) { true } }
            val tamper = nextZip.readBytes(); tamper[35] = (tamper[35].toInt() xor 1).toByte(); nextZip.writeBytes(tamper)
            rejected { store.install(newGame, nextEnvelope, nextZip) }
            assertEquals(game.identity, store.selection("conway").active)
        } finally { f.close() }
    }
    @Test fun expiredInstalledProofStaysPlayableButExpiredReadyNeverActivates() {
        val f = Fixture(); try {
            val store = f.store; val (game, envelope, zip) = f.release(); store.install(game, envelope, zip); store.openSession("conway", true).close()
            f.time += 2 * 86400000L; f.store.openSession("conway", true).use { assertEquals(2, it.game!!.contentCode) }
            f.time -= 2 * 86400000L; val (next, nextEnvelope, nextZip) = f.release(3, 3); store.install(next, nextEnvelope, nextZip)
            f.time += 2 * 86400000L; store.openSession("conway", true).use { assertEquals(2, it.game!!.contentCode) }; assertNull(store.selection("conway").ready)
        } finally { f.close() }
    }
    @Test fun damagedGlobalStateCannotBeClearedBySingleGameRestoreAndTrustedRecoveryRejectsReplay() {
        val f = Fixture(); try {
            val store = f.store; val (_, oldEnvelope, _) = f.release(2, 2)
            store.acceptCatalog(oldEnvelope); val (_, latest, _) = f.release(3, 3); store.acceptCatalog(latest)
            for (damaged in listOf("{", "{\"schemaVersion\":1,\"sequence\":3,\"catalogHash\":\"bad\",\"games\":{}}")) {
                f.state.bytes = damaged.toByteArray(); val broken = f.store
                assertNotNull(broken.failure()); rejected { broken.restore("conway", true) }; rejected { broken.acceptCatalog(latest) }
                assertEquals(damaged, String(f.state.bytes!!))
                broken.openSession("light", true).use { assertNull(it.game) }
                broken.recoverAllBuiltinsFromTrustedHistory()
                assertTrue(listOf("conway", "eml", "light", "turing").all { broken.selection(it).pinned })
                rejected { broken.acceptCatalog(oldEnvelope) }; assertEquals(3, broken.selection("conway").highestCode)
            }
        } finally { f.close() }
    }
    @Test fun brokenReadyOrMissingProofKeepsBuiltinPlayableAndQuarantinesCandidate() {
        for (missingProof in listOf(false, true)) {
            val f = Fixture(); try {
                val store = f.store; val (game, envelope, zip) = f.release(); store.install(game, envelope, zip)
                if (missingProof) File(f.root, "versions/conway/${game.identity}/catalog.signed.json").delete()
                else File(f.root, "versions/conway/${game.identity}/index.html").writeText("bad")
                store.openSession("conway", true).use { assertNull(it.game) }
                assertNull(store.selection("conway").ready); assertTrue(2 in store.selection("conway").quarantine)
            } finally { f.close() }
        }
    }
    @Test fun sameArchiveNewFreshCatalogReplacesExpiredProofAndActivates() {
        val f = Fixture(); try {
            val store = f.store; val (game, envelope, zip) = f.release(); store.install(game, envelope, zip)
            f.time += 2 * 86400000L; store.openSession("conway", true).close(); assertNull(store.selection("conway").ready)
            val retainedState = JSONObject(String(f.state.bytes!!)); retainedState.getJSONObject("games").getJSONObject("conway").put("previous", game.identity); f.state.bytes = retainedState.toString().toByteArray()
            val retainedStore = f.store // Protect existing identity as previous so install exercises proof replacement, not GC/re-extraction.
            val (same, fresh, freshZip) = f.release(2, 3, issued = "2026-10-10T00:00:00.000Z", expires = "2026-10-11T00:00:00.000Z")
            assertEquals(game.identity, same.identity); retainedStore.install(same, fresh, freshZip)
            val savedProof = File(f.root, "versions/conway/${same.identity}/catalog.signed.json").readBytes()
            assertEquals(3L, ResourcePolicy.verifyInstalledProof(savedProof, f.pair.public.encoded).sequence)
            retainedStore.openSession("conway", true).use { assertEquals(2, it.game!!.contentCode) }
        } finally { f.close() }
    }
    @Test fun unsignedOrAlteredCatalogCannotChangeWatermark() {
        val f = Fixture(); try {
            val store = f.store; val (_, envelope, _) = f.release()
            rejected { store.acceptCatalog("{}".toByteArray()) }; assertEquals(1, store.selection("conway").highestCode)
            val json = JSONObject(String(envelope)); json.put("payloadBase64", Base64.getEncoder().encodeToString("{}".toByteArray()))
            rejected { store.acceptCatalog(json.toString().toByteArray()) }; assertNull(f.state.bytes)
        } finally { f.close() }
    }
    @Test fun missingOrDamagedHighestHistoryNeverFallsBackToAnOlderWatermark() {
        for (damage in listOf("missing", "renamed", "content")) {
            val f = Fixture(); try {
                val store = f.store; val (_, old, _) = f.release(2, 2); store.acceptCatalog(old)
                val (_, latest, _) = f.release(3, 3); store.acceptCatalog(latest)
                // Simulate an interrupted history replacement with old second copy, then lose/break newest.
                File(f.root, "catalog-history/highest-b.signed.json").writeBytes(old)
                val newest = File(f.root, "catalog-history/highest-a.signed.json")
                when (damage) { "missing" -> newest.delete(); "renamed" -> newest.renameTo(File(newest.parentFile, "broken-name.json")); else -> newest.writeText("broken") }
                f.state.bytes = "{".toByteArray(); val broken = f.store
                assertNotNull(broken.failure()); rejected { broken.recoverAllBuiltinsFromTrustedHistory() }; rejected { broken.acceptCatalog(old) }
                assertEquals("{", String(f.state.bytes!!))
            } finally { f.close() }
        }
    }
    @Test fun missingSelectionWithExistingResourcesRequiresExplicitPinnedRecovery() {
        val f = Fixture(); try {
            val store = f.store; val (game, envelope, zip) = f.release(); store.install(game, envelope, zip); store.openSession("conway", true).close(); store.restore("conway", true)
            f.state.bytes = null; val broken = f.store
            assertNotNull(broken.failure()); rejected { broken.acceptCatalog(envelope) }; rejected { broken.restore("light", true) }
            broken.recoverAllBuiltinsFromTrustedHistory()
            assertTrue(listOf("conway", "eml", "light", "turing").all { broken.selection(it).pinned }); assertEquals(2, broken.selection("conway").highestCode)
            assertFalse(broken.isEligible(game))
        } finally { f.close() }
    }
}
