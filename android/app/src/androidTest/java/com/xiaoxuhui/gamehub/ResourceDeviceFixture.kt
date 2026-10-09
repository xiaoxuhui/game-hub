package com.xiaoxuhui.gamehub

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.ByteArrayOutputStream
import java.security.KeyPairGenerator
import java.security.Signature
import java.text.SimpleDateFormat
import java.util.Base64
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.zip.CRC32
import java.util.zip.ZipInputStream

/** Ephemeral test key; exercises production AtomicFile and full actual bundled games. Never a release key. */
internal class ResourceDeviceFixture(val context: Context) : AutoCloseable {
    val root = File(context.cacheDir, "resource-device-test-${UUID.randomUUID()}").apply { mkdirs() }
    private val pair = KeyPairGenerator.getInstance("RSA").apply { initialize(3072) }.generateKeyPair()
    val store = GameResourceStore(File(root, "store"), 3, pair.public.encoded)
    val manifest = context.assets.open("bundle-manifest.json").bufferedReader().use { JSONObject(it.readText()) }
    val paths: Set<String>
    val envelope: ByteArray
    val catalog: ResourceCatalog
    private val archives = mutableMapOf<String, File>()
    init {
        val files = manifest.getJSONArray("files"); val sources = manifest.getJSONArray("sources")
        paths = (0 until files.length()).map { "/assets/" + files.getJSONObject(it).getString("path") }.toSet()
        val games = JSONArray()
        for (i in 0 until sources.length()) {
            val source = sources.getJSONObject(i); val id = source.getString("id"); val entry = source.getString("entryPage")
            val resources = (0 until files.length()).map { files.getJSONObject(it).getString("path") }.filter { it.startsWith("games/$id/") }.sorted().associate { path ->
                val relative = path.removePrefix("games/$id/")
                val bytes = context.assets.open(path).use { it.readBytes() }
                relative to if (relative == entry) bytes + "\n<!-- signed compatibility candidate -->".toByteArray() else bytes
            }
            val archive = File(root, "$id.zip")
            archive.writeBytes(storedZip(resources))
            archives[id] = archive
            games.put(JSONObject().put("id", id).put("version", source.getString("version")).put("contentCode", 2)
                .put("sourceRepository", source.getString("repository")).put("sourceRevision", source.getString("revision"))
                .put("minHostVersionCode", 3).put("maxHostVersionCode", 100).put("resourceProtocol", 1).put("storageContract", ResourcePolicy.contract(id))
                .put("entryPage", entry).put("assetId", i + 10).put("archiveBytes", archive.length()).put("archiveSha256", ResourcePolicy.sha256(archive.readBytes()))
                .put("releaseNotes", "Device compatibility fixture, not a public resource release")
                .put("files", JSONArray(resources.map { (path, bytes) -> JSONObject().put("path", path).put("bytes", bytes.size).put("sha256", ResourcePolicy.sha256(bytes)).put("mime", ResourcePolicy.mime(path)) })))
        }
        val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT).apply { timeZone = TimeZone.getTimeZone("UTC") }
        val now = System.currentTimeMillis()
        val payload = JSONObject().put("schemaVersion", 1).put("channel", "game-hub-resources-v1").put("releaseId", 1).put("catalogSequence", "2")
            .put("issuedAt", format.format(java.util.Date(now - 60000))).put("expiresAt", format.format(java.util.Date(now + 86400000))).put("games", games).toString().toByteArray()
        val signature = Signature.getInstance("SHA256withRSA").run { initSign(pair.private); update(payload); sign() }
        envelope = JSONObject().put("envelopeVersion", 1).put("keyId", ResourcePolicy.KEY_ID).put("payloadBase64", Base64.getEncoder().encodeToString(payload)).put("signatureBase64", Base64.getEncoder().encodeToString(signature)).toString().toByteArray()
        catalog = ResourcePolicy.verifyEnvelope(envelope, pair.public.encoded)
    }
    private fun storedZip(resources: Map<String, ByteArray>): ByteArray {
        val local = ByteArrayOutputStream(); val central = ByteArrayOutputStream()
        fun ByteArrayOutputStream.u16(value: Long) { write((value and 255).toInt()); write((value ushr 8 and 255).toInt()) }
        fun ByteArrayOutputStream.u32(value: Long) { u16(value); u16(value ushr 16) }
        resources.forEach { (path, bytes) ->
            val name = path.toByteArray(Charsets.UTF_8); val crc = CRC32().apply { update(bytes) }.value; val offset = local.size().toLong()
            local.u32(0x04034b50); local.u16(20); local.u16(0x0800); local.u16(0); local.u16(0); local.u16(33)
            local.u32(crc); local.u32(bytes.size.toLong()); local.u32(bytes.size.toLong()); local.u16(name.size.toLong()); local.u16(0); local.write(name); local.write(bytes)
            central.u32(0x02014b50); central.u16(20); central.u16(20); central.u16(0x0800); central.u16(0); central.u16(0); central.u16(33)
            central.u32(crc); central.u32(bytes.size.toLong()); central.u32(bytes.size.toLong()); central.u16(name.size.toLong()); central.u16(0); central.u16(0); central.u16(0); central.u16(0); central.u32(0); central.u32(offset); central.write(name)
        }
        val offset = local.size().toLong(); local.write(central.toByteArray()); local.u32(0x06054b50); local.u16(0); local.u16(0); local.u16(resources.size.toLong()); local.u16(resources.size.toLong()); local.u32(central.size().toLong()); local.u32(offset); local.u16(0)
        return local.toByteArray()
    }
    val publicKey: ByteArray get() = pair.public.encoded.clone()
    /** Test-only v2 using the same ephemeral trust root as this fixture's actual v1 archives. */
    fun dynamicRelease(sequence: Int = 1, code: Int = 1, available: Boolean = true, minHost: Int = 4): Triple<ResourceCatalog,ByteArray,ByteArray> {
        val assets=androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().context.assets
        val original=assets.open("dynamic-demo-fixture/game.zip").use {it.readBytes()}
        require(ResourcePolicy.sha256(original)=="27f1df3b689e6b4592cbfcae4a80e759a274cfd7857e2764ac2203d27bb0876b")
        val game=JSONArray(assets.open("dynamic-demo-fixture/games.json").bufferedReader().use {it.readText()}).getJSONObject(0)
        val resources=linkedMapOf<String,ByteArray>()
        ZipInputStream(original.inputStream()).use {zip->
            while(true) {val entry=zip.nextEntry ?: break;val path=ResourcePolicy.safePath(entry.name);require(!entry.isDirectory);resources[path]=zip.readBytes()}
        }
        require(resources.keys==setOf("LICENSE","app.js","core.js","index.html","style.css"))
        if(code>1) resources["index.html"]=resources.getValue("index.html")+"\n<!-- private coordinator compatibility fixture $code -->".toByteArray()
        val archive=if(code==1) original else storedZip(resources)
        game.put("assetId",701).put("contentCode",code).put("version","1.0.${code-1}").put("available",available).put("minHostVersionCode",minHost)
            .put("archiveBytes",archive.size).put("archiveSha256",ResourcePolicy.sha256(archive))
            .put("files",JSONArray(resources.map {(path,bytes)->JSONObject().put("path",path).put("bytes",bytes.size).put("sha256",ResourcePolicy.sha256(bytes)).put("mime",ResourcePolicy.mime(path))}))
        val format=SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",Locale.ROOT).apply {timeZone=TimeZone.getTimeZone("UTC")}
        val now=System.currentTimeMillis()
        val payload=JSONObject().put("schemaVersion",2).put("channel",DynamicGamePolicy.CHANNEL).put("releaseId",2).put("catalogSequence",sequence.toString())
            .put("issuedAt",format.format(java.util.Date(now-60000))).put("expiresAt",format.format(java.util.Date(now+86400000))).put("games",JSONArray().put(game)).toString().toByteArray()
        val signature=Signature.getInstance("SHA256withRSA").run {initSign(pair.private);update(payload);sign()}
        val envelope=JSONObject().put("envelopeVersion",1).put("keyId",ResourcePolicy.KEY_ID).put("payloadBase64",Base64.getEncoder().encodeToString(payload))
            .put("signatureBase64",Base64.getEncoder().encodeToString(signature)).toString().toByteArray()
        return Triple(DynamicGamePolicy.verifyEnvelope(envelope,publicKey,now=now),envelope,archive)
    }
    fun archiveBytes(id: String) = archives.getValue(id).readBytes()
    fun onlyLightEnvelope(): ByteArray {
        val payload = JSONObject(String(Base64.getDecoder().decode(JSONObject(String(envelope)).getString("payloadBase64"))))
        val games = payload.getJSONArray("games")
        for (i in 0 until games.length()) if (games.getJSONObject(i).getString("id") != "light") games.getJSONObject(i).put("contentCode", 1)
        val bytes = payload.toString().toByteArray()
        val signature = Signature.getInstance("SHA256withRSA").run { initSign(pair.private); update(bytes); sign() }
        return JSONObject().put("envelopeVersion", 1).put("keyId", ResourcePolicy.KEY_ID).put("payloadBase64", Base64.getEncoder().encodeToString(bytes)).put("signatureBase64", Base64.getEncoder().encodeToString(signature)).toString().toByteArray()
    }
    fun install(id: String) { store.install(catalog.games.single { it.id == id }, envelope, archives.getValue(id)) }
    fun reopenedStore() = GameResourceStore(File(root, "store"), 3, pair.public.encoded)
    fun renewal(sequence: Int, changedId: String? = null): ByteArray {
        val payload = JSONObject(String(Base64.getDecoder().decode(JSONObject(String(envelope)).getString("payloadBase64"))))
        payload.put("catalogSequence", sequence.toString())
        val games = payload.getJSONArray("games")
        for (i in 0 until games.length()) if (games.getJSONObject(i).getString("id") == changedId) games.getJSONObject(i).put("version", "99.0.0")
        val bytes = payload.toString().toByteArray()
        val signature = Signature.getInstance("SHA256withRSA").run { initSign(pair.private); update(bytes); sign() }
        return JSONObject().put("envelopeVersion", 1).put("keyId", ResourcePolicy.KEY_ID).put("payloadBase64", Base64.getEncoder().encodeToString(bytes)).put("signatureBase64", Base64.getEncoder().encodeToString(signature)).toString().toByteArray()
    }
    override fun close() { require(root.canonicalFile.parentFile == context.cacheDir.canonicalFile); root.deleteRecursively() }
}
