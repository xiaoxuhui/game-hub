package com.xiaoxuhui.gamehub

import org.json.JSONObject
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.Signature
import java.security.interfaces.RSAPublicKey
import java.security.spec.X509EncodedKeySpec
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

internal data class ResourceFile(val path: String, val bytes: Long, val sha256: String, val mime: String)
internal data class ResourceGame(val id: String, val version: String, val contentCode: Int, val sourceRepository: String,
    val sourceRevision: String, val minHost: Int, val maxHost: Int, val storageContract: String, val entry: String,
    val assetId: Long, val archiveBytes: Long, val archiveSha256: String, val files: List<ResourceFile>, val notes: String) {
    val assetName get() = "game-$id-$contentCode-${archiveSha256.take(12)}.zip"
    val identity get() = "$contentCode-$archiveSha256"
    fun compatible(host: Int, contract: String) = host in minHost..maxHost && storageContract == contract
}
internal data class ResourceCatalog(val sequence: Long, val payloadSha256: String, val releaseId: Long, val issuedAt: Long, val expiresAt: Long, val games: List<ResourceGame>) {
    fun requireFresh(now: Long) { require(now >= issuedAt - 300000 && now < expiresAt) { "资源目录过期或设备时间异常，停止下载；已安装游戏仍可离线使用" } }
}

internal object ResourcePolicy {
    const val MAX_ARCHIVE = 25L * 1024 * 1024
    const val MAX_UNPACKED = 100L * 1024 * 1024
    const val MAX_FILE = 20L * 1024 * 1024
    const val MAX_STORE = 300L * 1024 * 1024
    const val FREE_RESERVE = 20L * 1024 * 1024
    const val KEY_ID = "resources-20261008"
    private val repositories = mapOf("conway" to "conway-life-game", "eml" to "EML", "light" to "light_game", "turing" to "turing-machine-simulator")
    fun contract(id: String) = "$id-baseline-v1"
    fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    fun safePath(path: String): String {
        require(path.isNotEmpty() && path.length <= 240 && path.split('/').size <= 16 && path.none { it < ' ' || it == '\\' || it == ':' || it == '%' } && path.split('/').none { it.isEmpty() || it == "." || it == ".." }) { "Unsafe resource path" }
        require(!Regex("\\.(dex|jar|so|class|apk)$", RegexOption.IGNORE_CASE).containsMatchIn(path)) { "Native executable resource" }
        return path
    }
    fun mime(path: String): String = if (path == "LICENSE") "text/plain" else when (path.substringAfterLast('.').lowercase(Locale.ROOT)) {
        "html" -> "text/html"; "js" -> "application/javascript"; "css" -> "text/css"; "json" -> "application/json"; "svg" -> "image/svg+xml"; "png" -> "image/png"; "jpg", "jpeg" -> "image/jpeg"; "webp" -> "image/webp"; "txt", "md" -> "text/plain"; else -> "application/octet-stream"
    }
    fun string(json: JSONObject, key: String, max: Int): String {
        val value = json.get(key); require(value is String && value.isNotEmpty() && value.length <= max && value.none { it < ' ' && it !in "\n\r\t" }) { "Invalid $key" }; return value
    }
    fun integer(json: JSONObject, key: String, min: Long = 1, max: Long = Long.MAX_VALUE): Long {
        val value = json.get(key); require(value is Int || value is Long) { "Invalid integer $key" }; val number = (value as Number).toLong(); require(number in min..max) { "Invalid range $key" }; return number
    }
    private fun timestamp(json: JSONObject, key: String): Long {
        val text = string(json, key, 24); require(Regex("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z").matches(text))
        val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT).apply { timeZone = TimeZone.getTimeZone("UTC"); isLenient = false }
        val date = format.parse(text) ?: error("Invalid time"); require(format.format(date) == text); return date.time
    }
    fun verifyEnvelope(bytes: ByteArray, publicKeyDer: ByteArray, keyId: String = KEY_ID, now: Long = System.currentTimeMillis()): ResourceCatalog =
        verifySignature(bytes, publicKeyDer, keyId).also { it.requireFresh(now) }
    /** Only an already installed complete version may use an expired proof for offline play. */
    fun verifyInstalledProof(bytes: ByteArray, publicKeyDer: ByteArray): ResourceCatalog = verifySignature(bytes, publicKeyDer, KEY_ID)
    private fun verifySignature(bytes: ByteArray, publicKeyDer: ByteArray, keyId: String): ResourceCatalog {
        val envelope = StrictJson.parse(bytes, 1048576)
        require(envelope.keys().asSequence().toSet() == setOf("envelopeVersion", "keyId", "payloadBase64", "signatureBase64"))
        require(integer(envelope, "envelopeVersion") == 1L && string(envelope, "keyId", 64) == keyId) { "Unknown signing key or envelope" }
        val payload = decodeBase64(string(envelope, "payloadBase64", 699052)); require(payload.size <= 524288)
        val signatureBytes = decodeBase64(string(envelope, "signatureBase64", 512)); require(signatureBytes.size == 384)
        val key = KeyFactory.getInstance("RSA").generatePublic(X509EncodedKeySpec(publicKeyDer)) as RSAPublicKey
        require(key.modulus.bitLength() == 3072)
        require(Signature.getInstance("SHA256withRSA").run { initVerify(key); update(payload); verify(signatureBytes) }) { "Resource catalog signature invalid" }
        return parseCatalog(StrictJson.parse(payload), sha256(payload))
    }
    fun parseCatalog(json: JSONObject, digest: String): ResourceCatalog {
        require(integer(json, "schemaVersion") == 1L && string(json, "channel", 64) == "game-hub-resources-v1")
        val sequenceText = string(json, "catalogSequence", 19); require(Regex("[1-9][0-9]{0,18}").matches(sequenceText)); val sequence = sequenceText.toLong()
        val issued = timestamp(json, "issuedAt"); val expires = timestamp(json, "expiresAt"); require(expires > issued && expires - issued <= 90L * 86400000)
        val array = json.getJSONArray("games"); require(array.length() == 4)
        val games = (0 until array.length()).map { parseGame(array.getJSONObject(it)) }
        require(games.map { it.id }.toSet() == repositories.keys && games.map { it.assetId }.toSet().size == games.size)
        return ResourceCatalog(sequence, digest, integer(json, "releaseId", max = 9007199254740991), issued, expires, games)
    }
    fun parseGame(json: JSONObject): ResourceGame {
        val id = string(json, "id", 64); val repo = repositories[id] ?: error("Unknown game")
        val repository = string(json, "sourceRepository", 200); require(repository == "https://github.com/xiaoxuhui/$repo.git")
        val revision = string(json, "sourceRevision", 40); require(Regex("[0-9a-f]{40}").matches(revision))
        require(integer(json, "resourceProtocol") == 1L)
        val storage = string(json, "storageContract", 100); require(storage == contract(id))
        val entry = safePath(string(json, "entryPage", 240)); require(entry == if (id == "eml") "eml-workbench.html" else "index.html")
        val array = json.getJSONArray("files"); require(array.length() in 1..2000)
        val seen = HashSet<String>(); var total = 0L
        val files = (0 until array.length()).map { index ->
            val file = array.getJSONObject(index); val path = safePath(string(file, "path", 240)); val lower = path.lowercase(Locale.ROOT)
            require(seen.none { lower == it || lower.startsWith("$it/") || it.startsWith("$lower/") }) { "Duplicate or conflicting path" }; seen.add(lower)
            val size = integer(file, "bytes", 0, MAX_FILE); total += size; require(total <= MAX_UNPACKED)
            val hash = string(file, "sha256", 64); require(Regex("[0-9a-f]{64}").matches(hash))
            val type = string(file, "mime", 100); require(type == mime(path))
            ResourceFile(path, size, hash, type)
        }
        require(files.any { it.path == entry } && files.any { it.path == "LICENSE" })
        val minHost = integer(json, "minHostVersionCode", 3, Int.MAX_VALUE.toLong()).toInt()
        val archiveHash = string(json, "archiveSha256", 64); require(Regex("[0-9a-f]{64}").matches(archiveHash))
        return ResourceGame(id, string(json, "version", 64), integer(json, "contentCode", max = Int.MAX_VALUE.toLong()).toInt(), repository, revision,
            minHost, integer(json, "maxHostVersionCode", minHost.toLong(), Int.MAX_VALUE.toLong()).toInt(), storage, entry,
            integer(json, "assetId", max = 9007199254740991), integer(json, "archiveBytes", max = MAX_ARCHIVE), archiveHash, files, string(json, "releaseNotes", 2000))
    }
    private const val ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    private fun decodeBase64(text: String): ByteArray {
        require(text.length % 4 == 0 && Regex("[A-Za-z0-9+/]+={0,2}").matches(text))
        val padding = text.takeLastWhile { it == '=' }.length; val result = ByteArray(text.length / 4 * 3 - padding); var at = 0
        for (offset in text.indices step 4) {
            val values = IntArray(4) { i -> if (text[offset + i] == '=') 0 else ALPHABET.indexOf(text[offset + i]) }
            val word = (values[0] shl 18) or (values[1] shl 12) or (values[2] shl 6) or values[3]
            for (shift in listOf(16, 8, 0)) if (at < result.size) result[at++] = (word shr shift).toByte()
            if (offset + 4 == text.length) require((padding != 1 || values[2] and 3 == 0) && (padding != 2 || values[1] and 15 == 0)) { "Noncanonical base64" }
        }
        return result
    }
}
