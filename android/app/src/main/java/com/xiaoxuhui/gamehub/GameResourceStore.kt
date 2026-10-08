package com.xiaoxuhui.gamehub

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

internal data class ResourceSelection(val active: String = "builtin", val previous: String = "builtin", val ready: String? = null,
    val pinned: Boolean = false, val highestCode: Int = 1, val highestHash: String? = null, val quarantine: Set<Int> = emptySet())
internal class ResourceSession(val game: ResourceGame?, val root: File?, private val release: () -> Unit) : AutoCloseable {
    private var closed = false
    @Synchronized override fun close() { if (!closed) { closed = true; release() } }
}

/** One lock protects all pointer changes and session references. UI never hashes through this class. */
internal class GameResourceStore(private val directory: File, private val hostCode: Int, private val publicKey: ByteArray,
    private val stateFile: ResourceStateFile = AndroidResourceStateFile(File(directory, "state.json")), private val now: () -> Long = System::currentTimeMillis,
    private val freeSpace: () -> Long = { directory.usableSpace }) {
    private val lock = Any()
    private var sequence = 0L
    private var catalogHash = ""
    private var selections = listOf("conway", "eml", "light", "turing").associateWith { ResourceSelection() }
    private val references = HashMap<String, Int>()
    private var stateFailure: String? = null
    init {
        require(directory.isDirectory || directory.mkdirs())
        try {
            stateFile.read()?.let { bytes ->
                val json = StrictJson.parse(bytes, 1048576); require(ResourcePolicy.integer(json, "schemaVersion") == 1L)
                sequence = ResourcePolicy.integer(json, "sequence", 0); catalogHash = json.getString("catalogHash")
                val games = json.getJSONObject("games")
                selections = selections.mapValues { (id, _) ->
                    val item = games.getJSONObject(id)
                    fun identity(key: String) = item.getString(key).also { validateIdentity(it) }
                    val ready = if (item.isNull("ready")) null else identity("ready")
                    val quarantine = item.getJSONArray("quarantine")
                    ResourceSelection(identity("active"), identity("previous"), ready, item.getBoolean("pinned"), ResourcePolicy.integer(item, "highestCode", 1, Int.MAX_VALUE.toLong()).toInt(), if (item.isNull("highestHash")) null else item.getString("highestHash"), (0 until quarantine.length()).map { quarantine.getInt(it) }.toSet())
                }
            }
        } catch (error: Exception) { stateFailure = "资源状态损坏，请显式恢复内置资源；存档未删除" }
        // Uncommitted staging is never a version. Private children only; never follow links.
        File(directory, "staging").listFiles()?.forEach { deletePrivate(it) }
    }
    private fun validateIdentity(identity: String) { require(identity == "builtin" || Regex("[1-9][0-9]{0,9}-[0-9a-f]{64}").matches(identity)) }
    private fun version(id: String, identity: String): File { require(id in selections); validateIdentity(identity); require(identity != "builtin"); return File(directory, "versions/$id/$identity") }
    private fun persist(next: Map<String, ResourceSelection> = selections, nextSequence: Long = sequence, nextHash: String = catalogHash) {
        val games = JSONObject()
        next.forEach { (id, item) -> games.put(id, JSONObject().put("active", item.active).put("previous", item.previous).put("ready", item.ready ?: JSONObject.NULL).put("pinned", item.pinned).put("highestCode", item.highestCode).put("highestHash", item.highestHash ?: JSONObject.NULL).put("quarantine", JSONArray(item.quarantine.sorted()))) }
        stateFile.write(JSONObject().put("schemaVersion", 1).put("sequence", nextSequence).put("catalogHash", nextHash).put("games", games).toString().toByteArray())
        selections = next; sequence = nextSequence; catalogHash = nextHash
    }
    fun failure(): String? = synchronized(lock) { stateFailure }
    fun selection(id: String): ResourceSelection = synchronized(lock) { selections.getValue(id) }
    fun hasSessions(): Boolean = synchronized(lock) { references.values.sum() > 0 }
    fun acceptCatalog(catalog: ResourceCatalog) = synchronized(lock) {
        require(stateFailure == null) { stateFailure ?: "Resource state invalid" }; catalog.requireFresh(now())
        require(catalog.sequence > sequence || catalog.sequence == sequence && catalog.payloadSha256 == catalogHash) { "Resource catalog rollback or conflict" }
        val next = selections.toMutableMap()
        for (game in catalog.games) {
            val current = next.getValue(game.id)
            require(game.contentCode >= current.highestCode && (game.contentCode != current.highestCode || current.highestHash == null || current.highestHash == game.archiveSha256)) { "Resource code rollback or conflict" }
            next[game.id] = current.copy(highestCode = game.contentCode, highestHash = game.archiveSha256)
        }
        persist(next, catalog.sequence, catalog.payloadSha256)
    }
    fun isEligible(game: ResourceGame): Boolean = synchronized(lock) {
        val selected = selections.getValue(game.id)
        stateFailure == null && !selected.pinned && game.contentCode !in selected.quarantine && game.compatible(hostCode, ResourcePolicy.contract(game.id)) && game.contentCode > selected.active.substringBefore('-').toIntOrNull().let { it ?: 1 } && selected.ready != game.identity
    }
    fun install(game: ResourceGame, envelope: ByteArray, archive: File, cancelled: () -> Boolean = { false }) = synchronized(lock) {
        require(stateFailure == null && !hasSessions()) { "Install only while hall is idle" }
        val catalog = ResourcePolicy.verifyEnvelope(envelope, publicKey, now = now())
        require(catalog.games.single { it.id == game.id } == game && isEligible(game)) { "Resource not eligible" }
        acceptCatalog(catalog)
        val bytesNeeded = game.files.sumOf { it.bytes } + game.archiveBytes + envelope.size
        garbageCollect()
        require(usedBytes(directory) + bytesNeeded <= ResourcePolicy.MAX_STORE && freeSpace() >= bytesNeeded + ResourcePolicy.FREE_RESERVE) { "资源空间不足，旧版本保留" }
        val stagingParent = File(directory, "staging").apply { mkdirs() }; val staging = File(stagingParent, UUID.randomUUID().toString())
        try {
            ResourceArchive.extract(archive, staging, game, cancelled)
            require(!cancelled()); catalog.requireFresh(now())
            File(staging, "catalog.signed.json").outputStream().use { it.write(envelope) }
            val destination = version(game.id, game.identity); destination.parentFile!!.mkdirs()
            if (destination.exists()) { verifyVersion(game.id, game.identity); deletePrivate(staging) } else require(staging.renameTo(destination)) { "Cannot commit resource directory" }
            val current = selections.getValue(game.id)
            persist(selections + (game.id to current.copy(ready = game.identity)))
        } finally { if (staging.exists()) deletePrivate(staging) }
    }
    private fun verifyVersion(id: String, identity: String): ResourceGame {
        val root = version(id, identity); require(root.isDirectory && root.canonicalFile == root.absoluteFile)
        val proof = File(root, "catalog.signed.json"); require(proof.length() in 1..1048576)
        val game = ResourcePolicy.verifyInstalledProof(proof.inputStream().use { ResourceIo.readBounded(it, 1048576) }, publicKey).games.single { it.id == id }
        require(game.identity == identity && game.compatible(hostCode, ResourcePolicy.contract(id)))
        val actual = mutableSetOf<String>()
        root.walkTopDown().forEach { file -> require(file.canonicalFile == file.absoluteFile) { "Resource link" }; if (file.isFile) actual.add(file.relativeTo(root).invariantSeparatorsPath) }
        require(actual == game.files.map { it.path }.toSet() + "catalog.signed.json")
        game.files.forEach { metadata -> val file = File(root, metadata.path); require(file.length() == metadata.bytes); require(ResourcePolicy.sha256(file.inputStream().use { ResourceIo.readBounded(it, metadata.bytes) }) == metadata.sha256) { "Installed resource corrupted" } }
        return game
    }
    fun openSession(id: String, cacheProxyCleared: Boolean): ResourceSession = synchronized(lock) {
        var selected = selections.getValue(id)
        if (selected.ready != null && !selected.pinned && !hasSessions()) {
            require(cacheProxyCleared) { "旧网页缓存代理尚未解除，暂停资源激活" }
            val game = verifyVersion(id, selected.ready!!)
            val proof = ResourcePolicy.verifyInstalledProof(File(version(id, game.identity), "catalog.signed.json").inputStream().use { ResourceIo.readBounded(it, 1048576) }, publicKey)
            val fresh = now() >= proof.issuedAt - 300000 && now() < proof.expiresAt
            if (fresh) {
                proof.requireFresh(now()); require(game.contentCode !in selected.quarantine)
                selected = selected.copy(previous = selected.active, active = selected.ready!!, ready = null)
            } else selected = selected.copy(ready = null) // Expired ready never blocks the intact active/builtin version.
            persist(selections + (id to selected))
        }
        val game = if (selected.active == "builtin") null else verifyVersion(id, selected.active)
        val reference = "$id/${selected.active}"; references[reference] = (references[reference] ?: 0) + 1
        ResourceSession(game, game?.let { version(id, it.identity) }) { synchronized(lock) { val count = references.getValue(reference) - 1; if (count == 0) references.remove(reference) else references[reference] = count } }
    }
    fun restore(id: String, builtin: Boolean, failedCode: Int? = null) = synchronized(lock) {
        require(!hasSessions()) { "Return to hall before restoring" }; val current = selections.getValue(id)
        val target = if (builtin) "builtin" else current.previous
        if (target != "builtin") verifyVersion(id, target)
        val next = current.copy(active = target, ready = null, pinned = true, quarantine = current.quarantine + listOfNotNull(failedCode))
        persist(selections + (id to next)); stateFailure = null
    }
    fun resumeAutomatic(id: String, retryCode: Int? = null) = synchronized(lock) {
        require(stateFailure == null); val selected = selections.getValue(id)
        persist(selections + (id to selected.copy(pinned = false, quarantine = if (retryCode == null) selected.quarantine else selected.quarantine - retryCode)))
    }
    private fun garbageCollect() {
        for ((id, selected) in selections) {
            val protected = setOfNotNull(selected.active, selected.previous, selected.ready)
            File(directory, "versions/$id").listFiles()?.forEach { file -> if (file.name !in protected && references["$id/${file.name}"] == null) deletePrivate(file) }
        }
    }
    private fun usedBytes(file: File): Long { require(file.canonicalFile == file.absoluteFile); return if (file.isFile) file.length() else file.listFiles()?.sumOf { usedBytes(it) } ?: 0 }
    private fun deletePrivate(file: File) {
        require(file.absolutePath.startsWith(directory.absolutePath + File.separator))
        if (file.canonicalFile != file.absoluteFile) { require(file.delete()); return }
        if (file.isDirectory) file.listFiles()?.forEach { deletePrivate(it) }
        require(file.delete() || !file.exists()) { "Cannot remove resource staging" }
    }
}
