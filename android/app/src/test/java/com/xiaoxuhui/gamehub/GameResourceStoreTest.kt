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
        val store get() = GameResourceStore(root, 3, pair.public.encoded, state, now = { time })
        fun release(code: Int = 2, sequence: Int = code, body: String = "new resource"): Triple<ResourceGame, ByteArray, File> {
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
            val payload = JSONObject().put("schemaVersion", 1).put("channel", "game-hub-resources-v1").put("releaseId", 1).put("catalogSequence", sequence.toString()).put("issuedAt", "2026-10-08T00:00:00.000Z").put("expiresAt", "2026-10-09T00:00:00.000Z").put("games", JSONArray(games)).toString().toByteArray()
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
            rejected { store.openSession("conway", false) }
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
            store.acceptCatalog(ResourcePolicy.verifyEnvelope(envelope, f.pair.public.encoded, now = f.time))
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
            val noSpace = GameResourceStore(f.root, 3, f.pair.public.encoded, f.state, now = { f.time }, freeSpace = { 0 })
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
            rejected { store.acceptCatalog(ResourcePolicy.verifyEnvelope(conflicting, f.pair.public.encoded, now = f.time)) }
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
}
