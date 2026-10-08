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

class DynamicResourceStoreTest {
    private class Fixture : AutoCloseable {
        val parent = Files.createTempDirectory("dynamic-store-test-").toFile()
        val root = File(parent,"store")
        val pair = KeyPairGenerator.getInstance("RSA").apply { initialize(3072) }.generateKeyPair()
        var now = 1791504000000L
        var otherBytes = 0L
        fun disk(file: File) = object : ResourceStateFile {
            override fun read() = if(file.isFile) file.readBytes() else null
            override fun write(bytes: ByteArray) { file.parentFile!!.mkdirs();file.writeBytes(bytes) }
        }
        fun store() = GameResourceStore(root,4,pair.public.encoded,disk(File(root,"state.json")),{now},{Long.MAX_VALUE},::disk,
            ResourceStorePolicy.DYNAMIC,{otherBytes})
        fun release(sequence: Int = 1, code: Int = 1, ids: List<String> = listOf("memory-demo"), available: Boolean = true, bridge: Int = 1,
            body: String = "<html>resource $code</html>"): Triple<ResourceCatalog,ByteArray,File> {
            val resources=linkedMapOf("LICENSE" to "MIT License".toByteArray(),"index.html" to body.toByteArray())
            val bytes=ByteArrayOutputStream();ZipOutputStream(bytes).use { zip->resources.forEach { (path,data)->
                zip.putNextEntry(ZipEntry(path).apply {method=ZipEntry.STORED;size=data.size.toLong();compressedSize=size;crc=CRC32().apply {update(data)}.value;setTime(315532800000L) });zip.write(data);zip.closeEntry()
            }}
            val archive=File(parent,"$sequence-$code.zip").apply {writeBytes(bytes.toByteArray())}
            val games=ids.mapIndexed { i,id->JSONObject().put("id",id).put("displayName","示范 $id").put("iconKind","puzzle").put("available",available)
                .put("sourceRepository","https://github.com/xiaoxuhui/game-hub.git").put("sourceRevision","a".repeat(40)).put("version","1.0.$code").put("contentCode",code)
                .put("minHostVersionCode",4).put("maxHostVersionCode",100).put("resourceProtocol",2).put("bridgeProtocol",bridge).put("storageContract",DynamicGamePolicy.contract(id))
                .put("entryPage","index.html").put("assetId",i+100).put("archiveBytes",archive.length()).put("archiveSha256",ResourcePolicy.sha256(archive.readBytes())).put("releaseNotes","fixture")
                .put("files",JSONArray(resources.map { (path,data)->JSONObject().put("path",path).put("bytes",data.size).put("sha256",ResourcePolicy.sha256(data)).put("mime",ResourcePolicy.mime(path)) })) }
            val payload=JSONObject().put("schemaVersion",2).put("channel",DynamicGamePolicy.CHANNEL).put("releaseId",10).put("catalogSequence",sequence.toString())
                .put("issuedAt","2026-10-09T00:00:00.000Z").put("expiresAt","2026-10-10T00:00:00.000Z").put("games",JSONArray(games)).toString().toByteArray()
            val signed=Signature.getInstance("SHA256withRSA").run {initSign(pair.private);update(payload);sign()}
            val envelope=JSONObject().put("envelopeVersion",1).put("keyId",ResourcePolicy.KEY_ID).put("payloadBase64",Base64.getEncoder().encodeToString(payload)).put("signatureBase64",Base64.getEncoder().encodeToString(signed)).toString().toByteArray()
            return Triple(DynamicGamePolicy.verifyEnvelope(envelope,pair.public.encoded,now),envelope,archive)
        }
        override fun close() {parent.deleteRecursively()}
    }
    private fun rejected(block:()->Unit) {try{block();fail("Expected rejection")}catch(_:Exception){}}
    @Test fun firstInstallRemovalReinstallRetainsWatermarksAndSeparateSaveFiles() {
        Fixture().use { f->
            val (catalog,envelope,archive)=f.release();val game=catalog.games.single();val store=f.store()
            assertFalse(store.isEligible(game));store.acceptCatalog(envelope);assertTrue(store.isEligible(game));assertFalse(store.installed(game.id))
            rejected {store.openSession(game.id,true)}
            store.install(game,envelope,archive);assertTrue(store.installed(game.id));assertEquals(game.identity,store.selection(game.id).ready)
            store.openSession(game.id,true).use { assertEquals(game,it.game);rejected {store.removeResources(game.id)} }
            val saved=File(f.parent,"webview-data-sentinel").apply {writeText("private fixture progress")};val digest=ResourcePolicy.sha256(saved.readBytes())
            store.removeResources(game.id);assertFalse(store.installed(game.id));assertFalse(File(f.root,"versions/${game.id}/${game.identity}").exists())
            val restarted=f.store();assertEquals(1,restarted.selection(game.id).highestCode);assertTrue(restarted.isEligible(game));assertFalse(restarted.installed(game.id))
            restarted.install(game,envelope,archive);restarted.openSession(game.id,true).use {assertEquals(game.identity,it.game!!.identity)}
            assertEquals(digest,ResourcePolicy.sha256(saved.readBytes())) // Disk sentinel; actual WebView retention belongs to N3.
        }
    }
    @Test fun cumulativeIdsRetirementAndCodeSequenceReplayAreFailClosed() {
        Fixture().use { f->val store=f.store();val (first,initial,archive)=f.release();store.acceptCatalog(initial);store.install(first.games.single(),initial,archive)
            store.openSession("memory-demo",true).close()
            val (_,expanded,_)=f.release(2,1,listOf("memory-demo","other-demo"));store.acceptCatalog(expanded)
            val (_,missing,_)=f.release(3);rejected {store.acceptCatalog(missing)}
            val (_,retired,_)=f.release(3,1,listOf("memory-demo","other-demo"),available=false);val accepted=store.acceptCatalog(retired)
            assertTrue(accepted.games.none(store::isEligible));store.openSession("memory-demo",true).use {assertEquals(1,it.game!!.contentCode)}
            rejected {store.acceptCatalog(initial)}
            val (_,newer,_)=f.release(4,2,listOf("memory-demo","other-demo"));store.acceptCatalog(newer)
            val (_,rollback,_)=f.release(5,1,listOf("memory-demo","other-demo"));rejected {store.acceptCatalog(rollback)}
            val (_,conflict,_)=f.release(4,3,listOf("memory-demo","other-demo"));rejected {store.acceptCatalog(conflict)}
            assertEquals(setOf("memory-demo","other-demo"),f.store().describeAll().keys)
        }
    }
    @Test fun retirementRevokesReadyInLiveProcessAndAfterRestartButKeepsActiveOffline() {
        Fixture().use { f ->
            val store = f.store(); val (first, initial, archive) = f.release()
            store.acceptCatalog(initial); store.install(first.games.single(), initial, archive)
            val (_, retired, _) = f.release(2, available = false)
            store.acceptCatalog(retired)
            assertNull("Retirement must revoke first activation", store.selection("memory-demo").ready)
            assertFalse(store.installed("memory-demo"))
            rejected { store.openSession("memory-demo", true) }
            val restarted = f.store()
            assertNull(restarted.selection("memory-demo").ready)
            rejected { restarted.openSession("memory-demo", true) }
            assertFalse(restarted.isEligible(first.games.single()))
        }
        Fixture().use { f ->
            val store = f.store(); val (first, initial, archive) = f.release()
            store.acceptCatalog(initial); store.install(first.games.single(), initial, archive)
            store.openSession("memory-demo", true).close()
            val (second, update, nextArchive) = f.release(2, 2)
            store.acceptCatalog(update); store.install(second.games.single(), update, nextArchive)
            val (_, retired, _) = f.release(3, 2, available = false)
            store.acceptCatalog(retired)
            assertNull(store.selection("memory-demo").ready)
            store.openSession("memory-demo", true).use { assertEquals(1, it.game!!.contentCode) }
            val restarted = f.store()
            restarted.openSession("memory-demo", true).use { assertEquals(1, it.game!!.contentCode) }
            assertFalse(restarted.isEligible(second.games.single()))
            // Explicit republishing with a new signed sequence may reuse identical content;
            // the previous revoked candidate is not silently reinstated.
            val (_, offeredAgain, _) = f.release(4, 2)
            restarted.acceptCatalog(offeredAgain)
            assertNull(restarted.selection("memory-demo").ready)
            assertTrue(restarted.isEligible(second.games.single()))
        }
    }
    @Test fun sharedBudgetIncludesOtherStoreAndNeverSelectsPartialResources() {
        Fixture().use {f->val store=f.store();val (catalog,envelope,archive)=f.release(body="<html>${"x".repeat(20000)}</html>");val game=catalog.games.single();store.acceptCatalog(envelope)
            f.otherBytes=ResourcePolicy.MAX_STORE-ResourceDiskBudget.usedBytes(f.root)-envelope.size*2L-1
            rejected {store.install(game,envelope,archive)};assertNull(store.selection(game.id).ready)
            f.otherBytes=0;store.install(game,envelope,archive);store.openSession(game.id,true).close()
            val sentinel=File(f.parent,"other-resource-root").apply {mkdirs()};File(sentinel,"occupied").writeBytes(ByteArray(123))
            assertEquals(123L,ResourceDiskBudget.usedBytes(sentinel))
        }
    }
    @Test fun expiredReadyCannotFirstActivateButPreviouslyActiveProofWorksOffline() {
        Fixture().use {f->val (catalog,envelope,archive)=f.release();val store=f.store();store.acceptCatalog(envelope);store.install(catalog.games.single(),envelope,archive)
            f.now+=86400000;rejected {store.openSession("memory-demo",true)};assertFalse(store.installed("memory-demo"))
        }
        Fixture().use {f->val (catalog,envelope,archive)=f.release();val store=f.store();store.acceptCatalog(envelope);store.install(catalog.games.single(),envelope,archive);store.openSession("memory-demo",true).close()
            f.now+=86400000;f.store().openSession("memory-demo",true).use {assertEquals(catalog.games.single(),it.game)}
        }
    }
    @Test fun damagedStateAndWrongChannelCannotAuthorizeNewInstall() {
        Fixture().use {f->val (catalog,envelope,_)=f.release();val store=f.store();store.acceptCatalog(envelope)
            rejected {ResourceStorePolicy.BUILTIN.proof(envelope,f.pair.public.encoded)}
            File(f.root,"state.json").writeText("{");val broken=f.store();assertNotNull(broken.failure());rejected {broken.acceptCatalog(envelope)}
            broken.recoverAllBuiltinsFromTrustedHistory();assertEquals(catalog.games.single().contentCode,broken.selection("memory-demo").highestCode);assertTrue(broken.selection("memory-demo").pinned)
        }
    }
    @Test fun unsupportedBridgeAndOversizedCumulativeDirectoryNeverInstall() {
        Fixture().use {f->val store=f.store();val (catalog,envelope,_)=f.release(bridge=2);store.acceptCatalog(envelope);assertFalse(store.isEligible(catalog.games.single()))
            rejected {f.release(ids=(0..16).map {"demo-$it"})}
        }
    }
    @Test fun collectionRejectsLinkedParentWithoutTouchingItsTarget() {
        Fixture().use {f->val store=f.store();val (_,envelope,_)=f.release();store.acceptCatalog(envelope)
            val external=File(f.parent,"private-save-directory").apply {mkdirs()};val sentinel=File(external,"save.json").apply {writeText("retain fixture save")}
            val versions=File(f.root,"versions").apply {mkdirs()};val link=File(versions,"memory-demo")
            if(System.getProperty("os.name").orEmpty().startsWith("Windows")) {
                val process=ProcessBuilder("cmd.exe","/c","mklink","/J",link.absolutePath,external.absolutePath).redirectErrorStream(true).start()
                val output=process.inputStream.bufferedReader().readText();assertEquals(output,0,process.waitFor())
            } else Files.createSymbolicLink(link.toPath(),external.toPath())
            try {val failure=runCatching {store.removeResources("memory-demo")}.exceptionOrNull();assertTrue("Linked target save must remain",sentinel.isFile);assertEquals("retain fixture save",sentinel.readText());assertNotNull(failure)}
            finally {assertTrue(link.delete())}
        }
    }
    @Test fun signedJournalLinksAreRejectedBeforeProofAdapterReadsOutsideRoot() {
        for (backupOnly in listOf(false, true)) Fixture().use { f ->
            var reads = 0
            fun counted(file: File) = object : ResourceStateFile {
                val delegate = f.disk(file)
                override fun read(): ByteArray? { reads++; return delegate.read() }
                override fun write(bytes: ByteArray) = delegate.write(bytes)
            }
            val store = GameResourceStore(f.root,4,f.pair.public.encoded,f.disk(File(f.root,"state.json")),
                {f.now},{Long.MAX_VALUE},::counted,ResourceStorePolicy.DYNAMIC)
            val (_, envelope, _) = f.release(); store.acceptCatalog(envelope)
            val history = File(f.root,"catalog-history")
            val external = File(f.parent,"external-signed-proofs")
            val link = if (backupOnly) {
                external.mkdirs(); File(history,"highest-a.signed.json.bak")
            } else {
                assertTrue(history.renameTo(external)); history
            }
            val sentinel = File(external,"private-save").apply { writeText("unchanged external data") }
            if (System.getProperty("os.name").orEmpty().startsWith("Windows")) {
                val process = ProcessBuilder("cmd.exe","/c","mklink","/J",link.absolutePath,external.absolutePath).redirectErrorStream(true).start()
                val output = process.inputStream.bufferedReader().readText(); assertEquals(output,0,process.waitFor())
            } else Files.createSymbolicLink(link.toPath(),external.toPath())
            try {
                reads = 0; rejected { store.rememberedCatalog() }
                assertEquals("No linked proof may reach the read adapter",0,reads)
                assertEquals("unchanged external data",sentinel.readText())
            } finally { assertTrue(link.delete()) }
        }
    }
    @Test fun failedStateAfterNewSignedJournalsCannotOverwriteHighWatermarkInLiveProcess() {
        Fixture().use {f->val original=f.disk(File(f.root,"state.json"));var failWrite=false
            val faulty=object:ResourceStateFile {override fun read()=original.read();override fun write(bytes:ByteArray){if(failWrite)throw java.io.IOException("Injected state write failure");original.write(bytes)}}
            val store=GameResourceStore(f.root,4,f.pair.public.encoded,faulty,{f.now},{Long.MAX_VALUE},f::disk,ResourceStorePolicy.DYNAMIC)
            val (_,old,_)=f.release();store.acceptCatalog(old);val (_,newer,_)=f.release(2,2);failWrite=true
            rejected {store.acceptCatalog(newer)};assertNotNull(store.failure());rejected {store.acceptCatalog(old)}
            for(name in listOf("highest-a.signed.json","highest-b.signed.json")) assertEquals(2L,DynamicGamePolicy.verifyProof(File(f.root,"catalog-history/$name").readBytes(),f.pair.public.encoded).sequence)
            failWrite=false;store.recoverAllBuiltinsFromTrustedHistory();assertEquals(2,store.selection("memory-demo").highestCode)
            assertFalse(store.isEligible(DynamicGamePolicy.verifyEnvelope(old,f.pair.public.encoded,f.now).games.single()))
        }
    }
}
