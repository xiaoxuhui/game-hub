package com.xiaoxuhui.gamehub

import org.json.JSONObject

/** A separate channel: accepting a dynamic game must never relax the four-game v1 parser. */
internal object DynamicGamePolicy {
    const val CHANNEL = "game-hub-resources-v2"
    const val MAX_GAMES = 16
    private val builtins = setOf("conway", "eml", "light", "turing")
    fun validId(id: String) = Regex("[a-z][a-z0-9-]{0,31}").matches(id) && id !in builtins
    fun contract(id: String) = "$id-dynamic-v1"
    fun verifyProof(bytes: ByteArray, publicKey: ByteArray, keyId: String = ResourcePolicy.KEY_ID): ResourceCatalog {
        val (json, digest) = ResourcePolicy.signedPayload(bytes, publicKey, keyId)
        return parseCatalog(json, digest)
    }
    fun verifyEnvelope(bytes: ByteArray, publicKey: ByteArray, now: Long = System.currentTimeMillis(), keyId: String = ResourcePolicy.KEY_ID) =
        verifyProof(bytes, publicKey, keyId).also { it.requireFresh(now) }
    fun parseCatalog(json: JSONObject, digest: String): ResourceCatalog {
        require(ResourcePolicy.integer(json, "schemaVersion") == 2L && ResourcePolicy.string(json, "channel", 64) == CHANNEL)
        val seq = ResourcePolicy.string(json, "catalogSequence", 19)
        require(Regex("[1-9][0-9]{0,18}").matches(seq))
        val issued = ResourcePolicy.timestamp(json, "issuedAt"); val expires = ResourcePolicy.timestamp(json, "expiresAt")
        require(expires > issued && expires - issued <= 90L * 86400000)
        val array = json.getJSONArray("games"); require(array.length() in 0..MAX_GAMES)
        val games = (0 until array.length()).map { parseGame(array.getJSONObject(it)) }
        require(games.map { it.id }.toSet().size == games.size && games.map { it.assetId }.toSet().size == games.size)
        return ResourceCatalog(seq.toLong(), digest, ResourcePolicy.integer(json, "releaseId", max = 9007199254740991), issued, expires, games)
    }
    fun parseGame(json: JSONObject): ResourceGame {
        fun text(key: String, max: Int) = ResourcePolicy.string(json, key, max)
        fun number(key: String, min: Long = 1, max: Long = Int.MAX_VALUE.toLong()) = ResourcePolicy.integer(json, key, min, max)
        val id = text("id", 32); require(validId(id))
        val repository = text("sourceRepository", 200)
        require(Regex("https://github\\.com/xiaoxuhui/[A-Za-z0-9_.-]+\\.git").matches(repository))
        val revision = text("sourceRevision", 40); require(Regex("[0-9a-f]{40}").matches(revision))
        val entry = ResourcePolicy.safePath(text("entryPage", 240)); require(entry.endsWith(".html"))
        val hash = text("archiveSha256", 64); require(Regex("[0-9a-f]{64}").matches(hash))
        val name = text("displayName", 80); require(name.none { it < ' ' })
        val icon = text("iconKind", 32); require(Regex("[a-z][a-z0-9-]{0,31}").matches(icon))
        val available = json.get("available"); require(available is Boolean)
        val min = number("minHostVersionCode", 4).toInt()
        // Future capabilities remain visible, but ResourceGame.compatible prevents installation.
        return ResourceGame(id, text("version", 64), number("contentCode").toInt(), repository, revision,
            min, number("maxHostVersionCode", min.toLong()).toInt(), text("storageContract", 100), entry,
            number("assetId", max = 9007199254740991), number("archiveBytes", max = ResourcePolicy.MAX_ARCHIVE), hash,
            ResourcePolicy.parseFiles(json, entry), text("releaseNotes", 2000), number("resourceProtocol").toInt(),
            number("bridgeProtocol").toInt(), name, icon, available)
    }
}
