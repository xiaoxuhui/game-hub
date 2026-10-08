package com.xiaoxuhui.gamehub

import android.os.Process
import android.util.AtomicFile
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.security.KeyPairGenerator
import java.security.Signature
import java.text.SimpleDateFormat
import java.util.Base64
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.zip.CRC32

/** Host terminates this actual process; fixture key/resources never authorize production stores. */
class DynamicResourceProcessRecoveryTest {
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val root get() = File(context.filesDir.canonicalFile, "dynamic-process-recovery-verification")
    private val evidence get() = File(requireNotNull(context.getExternalFilesDir(null)), "dynamic-process-verification")
    private val phase get() = InstrumentationRegistry.getArguments().getString("dynamicPhase")!!.also {
        require(it in setOf("state-before", "state-after", "retirement-half"))
    }
    private fun writeSynced(file: File, bytes: ByteArray) {
        file.parentFile!!.mkdirs()
        FileOutputStream(file).use { it.write(bytes); it.fd.sync() }
    }
    private fun cutpoint(extra: JSONObject = JSONObject()): Nothing {
        writeSynced(File(evidence,"cutpoint.json"), extra.put("phase",phase).put("pid",Process.myPid()).toString().toByteArray())
        Thread.sleep(120000)
        error("External controller did not terminate the application")
    }
    // Android ZipOutputStream may omit the protocol-required UTF8 flag for ASCII names.
    // Emit the same exact stored format as the production producer and existing device fixture.
    private fun storedZip(resources: Map<String,ByteArray>): ByteArray {
        val local=ByteArrayOutputStream();val central=ByteArrayOutputStream()
        fun ByteArrayOutputStream.u16(value:Long){write((value and 255).toInt());write((value ushr 8 and 255).toInt())}
        fun ByteArrayOutputStream.u32(value:Long){u16(value);u16(value ushr 16)}
        resources.forEach { (path,bytes) ->
            val name=path.toByteArray(Charsets.UTF_8);val crc=CRC32().apply {update(bytes)}.value;val offset=local.size().toLong()
            local.u32(0x04034b50);local.u16(20);local.u16(0x0800);local.u16(0);local.u16(0);local.u16(33)
            local.u32(crc);local.u32(bytes.size.toLong());local.u32(bytes.size.toLong());local.u16(name.size.toLong());local.u16(0);local.write(name);local.write(bytes)
            central.u32(0x02014b50);central.u16(20);central.u16(20);central.u16(0x0800);central.u16(0);central.u16(0);central.u16(33)
            central.u32(crc);central.u32(bytes.size.toLong());central.u32(bytes.size.toLong());central.u16(name.size.toLong());central.u16(0);central.u16(0);central.u16(0);central.u16(0);central.u32(0);central.u32(offset);central.write(name)
        }
        val offset=local.size().toLong();local.write(central.toByteArray());local.u32(0x06054b50);local.u16(0);local.u16(0);local.u16(resources.size.toLong());local.u16(resources.size.toLong());local.u32(central.size().toLong());local.u32(offset);local.u16(0)
        return local.toByteArray()
    }
    @Test fun prepareInterruptedOperation() {
        assumeTrue(InstrumentationRegistry.getArguments().getString("dynamicPhase") != null)
        require(root.parentFile == context.filesDir.canonicalFile)
        if (root.exists()) require(root.deleteRecursively())
        require(root.mkdirs()); evidence.mkdirs()
        File(evidence,"cutpoint.json").delete(); File(evidence,"recovered.json").delete()
        val pair = KeyPairGenerator.getInstance("RSA").apply { initialize(3072) }.generateKeyPair()
        val resources = linkedMapOf("LICENSE" to "MIT License".toByteArray(), "index.html" to "<html>dynamic process fixture</html>".toByteArray())
        val archive = storedZip(resources)
        val game = JSONObject().put("id","memory-demo").put("displayName","Process fixture").put("iconKind","puzzle").put("available",true)
            .put("sourceRepository","https://github.com/xiaoxuhui/game-hub.git").put("sourceRevision","a".repeat(40)).put("version","1.0.0").put("contentCode",1)
            .put("minHostVersionCode",4).put("maxHostVersionCode",100).put("resourceProtocol",2).put("bridgeProtocol",1)
            .put("storageContract",DynamicGamePolicy.contract("memory-demo")).put("entryPage","index.html").put("assetId",100)
            .put("archiveBytes",archive.size).put("archiveSha256",ResourcePolicy.sha256(archive)).put("releaseNotes","Private device fixture")
            .put("files",JSONArray(resources.map { (name,bytes) -> JSONObject().put("path",name).put("bytes",bytes.size).put("sha256",ResourcePolicy.sha256(bytes)).put("mime",ResourcePolicy.mime(name)) }))
        val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",Locale.ROOT).apply {timeZone=TimeZone.getTimeZone("UTC")}
        val now=System.currentTimeMillis()
        fun envelope(sequence: Int, available: Boolean): ByteArray {
            val payload=JSONObject().put("schemaVersion",2).put("channel",DynamicGamePolicy.CHANNEL).put("releaseId",10).put("catalogSequence",sequence.toString())
                .put("issuedAt",format.format(Date(now-60000))).put("expiresAt",format.format(Date(now+86400000)))
                .put("games",JSONArray().put(JSONObject(game.toString()).put("available",available))).toString().toByteArray()
            val signed=Signature.getInstance("SHA256withRSA").run {initSign(pair.private);update(payload);sign()}
            return JSONObject().put("envelopeVersion",1).put("keyId",ResourcePolicy.KEY_ID).put("payloadBase64",Base64.getEncoder().encodeToString(payload))
                .put("signatureBase64",Base64.getEncoder().encodeToString(signed)).toString().toByteArray()
        }
        val initial=envelope(1,true);val retired=envelope(2,false)
        writeSynced(File(root,"key.der"),pair.public.encoded);writeSynced(File(root,"initial.json"),initial)
        writeSynced(File(root,"retired.json"),retired);writeSynced(File(root,"game.zip"),archive)
        val sentinel=File(root,"save-sentinel.json");writeSynced(sentinel,"{\"fixtureProgress\":314159}".toByteArray())
        writeSynced(File(root,"save.sha256"),ResourcePolicy.sha256(sentinel.readBytes()).toByteArray())
        val directory=File(root,"store");val atomic=AndroidResourceStateFile(File(directory,"state.json"))
        val state=object:ResourceStateFile {
            override fun read()=atomic.read()
            override fun write(bytes:ByteArray) {
                val json=JSONObject(String(bytes));val ready=!json.getJSONObject("games").getJSONObject("memory-demo").isNull("ready")
                if (ready && phase=="state-before") {
                    val pending=AtomicFile(File(directory,"state.json"));val output=pending.startWrite()
                    output.write(bytes);output.fd.sync()
                    cutpoint(JSONObject().put("atomicNewExists",File(directory,"state.json.new").isFile))
                }
                atomic.write(bytes)
                if (ready && phase=="state-after") cutpoint(JSONObject().put("ready",json.getJSONObject("games").getJSONObject("memory-demo").getString("ready")))
            }
        }
        val store=GameResourceStore(directory,4,pair.public.encoded,state,proofFile={file ->
            val original=AndroidResourceStateFile(file)
            object:ResourceStateFile {
                override fun read()=original.read()
                override fun write(bytes:ByteArray) {
                    original.write(bytes)
                    if (phase=="retirement-half" && file.name=="highest-a.signed.json" && DynamicGamePolicy.verifyProof(bytes,pair.public.encoded).sequence==2L)
                        cutpoint(JSONObject().put("firstSequence",2).put("secondSequence",DynamicGamePolicy.verifyProof(File(directory,"catalog-history/highest-b.signed.json").readBytes(),pair.public.encoded).sequence))
                }
            }
        },policy=ResourceStorePolicy.DYNAMIC)
        val catalog=store.acceptCatalog(initial);store.install(catalog.games.single(),initial,File(root,"game.zip"))
        if (phase=="retirement-half") store.acceptCatalog(retired)
        fail("Expected external process termination")
    }
    @Test fun verifyAfterActualProcessRestart() {
        assumeTrue(InstrumentationRegistry.getArguments().getString("dynamicPhase") != null)
        val marker=JSONObject(File(evidence,"cutpoint.json").readText())
        assertEquals(phase,marker.getString("phase"));assertNotEquals(marker.getInt("pid"),Process.myPid())
        if (phase=="state-before") assertTrue(marker.getBoolean("atomicNewExists"))
        if (phase=="state-after") assertTrue(marker.getString("ready").startsWith("1-"))
        if (phase=="retirement-half") {assertEquals(2,marker.getInt("firstSequence"));assertEquals(1,marker.getInt("secondSequence"))}
        val store=GameResourceStore(File(root,"store"),4,File(root,"key.der").readBytes(),policy=ResourceStorePolicy.DYNAMIC)
        assertNull(store.failure());assertEquals(1,store.selection("memory-demo").highestCode)
        assertTrue(File(root,"store/staging").listFiles().orEmpty().isEmpty())
        assertEquals(File(root,"save.sha256").readText(),ResourcePolicy.sha256(File(root,"save-sentinel.json").readBytes()))
        val remembered=store.rememberedCatalog()!!
        assertEquals(if(phase=="retirement-half") 2L else 1L,remembered.sequence)
        if (phase=="state-after") store.openSession("memory-demo",true).use {
            assertEquals(1,it.game!!.contentCode);assertTrue(File(it.root!!,"index.html").readText().contains("dynamic process fixture"))
        } else {
            assertNull(store.selection("memory-demo").ready);assertFalse(store.installed("memory-demo"))
            assertTrue(runCatching {store.openSession("memory-demo",true)}.isFailure)
        }
        if (phase=="retirement-half") {
            assertFalse(store.selection("memory-demo").available)
            assertTrue(runCatching {store.acceptCatalog(File(root,"initial.json").readBytes())}.isFailure)
        }
        val result=JSONObject().put("phase",phase).put("previousPid",marker.getInt("pid")).put("newPid",Process.myPid())
            .put("sequence",remembered.sequence).put("available",store.selection("memory-demo").available).put("active",store.selection("memory-demo").active)
            .put("saveHashRetained",true).put("stagingEmpty",true)
        writeSynced(File(evidence,"recovered.json"),result.toString().toByteArray())
    }
}
