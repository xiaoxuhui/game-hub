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
internal class GameResourceStore(directory: File, private val hostCode: Int, private val publicKey: ByteArray,
    private val stateFile: ResourceStateFile = AndroidResourceStateFile(File(directory, "state.json")), private val now: () -> Long = System::currentTimeMillis,
    private val freeSpace: () -> Long = { directory.usableSpace }, private val proofFile: (File) -> ResourceStateFile = { AndroidResourceStateFile(it) }) {
    // Android may expose filesDir through /data/user/0 while its canonical spelling is /data/data.
    // Normalize the trusted root once; child links remain forbidden by the checks below.
    private val directory = directory.canonicalFile
    private val lock = Any()
    private var sequence = 0L
    private var catalogHash = ""
    private var selections = listOf("conway", "eml", "light", "turing").associateWith { ResourceSelection() }
    private val references = HashMap<String, Int>()
    private var stateFailure: String? = null
    private var candidateFailure: String? = null
    private val journalNames = listOf("highest-a.signed.json", "highest-b.signed.json")
    init {
        require(directory.isDirectory || directory.mkdirs())
        try {
            val stateBytes = stateFile.read()
            if (stateBytes == null && (File(directory, "catalog-history").exists() || File(directory, "versions").exists())) stateFailure = "已有资源但选择状态缺失，已停止网络更新；请显式全局可信恢复"
            stateBytes?.let { bytes ->
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
        try { journalCatalogs().maxByOrNull { it.sequence }?.let { recoverWatermark(it) } }
        catch (error: Exception) { stateFailure = "资源信任记录损坏，已停止网络更新；内置游戏和存档仍保留" }
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
    fun failure(): String? = synchronized(lock) { stateFailure ?: candidateFailure }
    fun selection(id: String): ResourceSelection = synchronized(lock) { selections.getValue(id) }
    fun hasSessions(): Boolean = synchronized(lock) { references.values.sum() > 0 }
    fun knownResourcePaths(): Set<String> = synchronized(lock) {
        selections.flatMap { (id, selected) -> setOfNotNull(selected.active, selected.previous, selected.ready).filter { it != "builtin" }.flatMap { identity ->
            runCatching { ResourcePolicy.verifyInstalledProof(readProof(File(version(id, identity), "catalog.signed.json")), publicKey).games.single { it.id == id }.files.map { "/assets/games/$id/${it.path}" } }.getOrDefault(emptyList())
        } }.toSet()
    }
    private fun readProof(file: File) = proofFile(file).read() ?: error("Missing signed resource proof")
    private fun journalCatalogs(): List<ResourceCatalog> {
        val root = File(directory, "catalog-history"); if (!root.exists()) return emptyList()
        val permitted = journalNames.flatMap { listOf(it, "$it.new", "$it.bak") }.toSet()
        require(root.listFiles()?.all { it.name in permitted } == true) { "Unknown or damaged watermark file" }
        val catalogs = journalNames.map { ResourcePolicy.verifyInstalledProof(readProof(File(root, it)), publicKey) }
        if (catalogs[0].sequence == catalogs[1].sequence) require(catalogs[0].payloadSha256 == catalogs[1].payloadSha256)
        // Both required copies normally contain the SAME highest catalog. Interrupted replacement
        // may contain two valid adjacent catalogs; choose the higher, never a missing/invalid copy.
        return catalogs
    }
    private fun recoverWatermark(catalog: ResourceCatalog) {
        if (catalog.sequence < sequence) return
        if (catalog.sequence == sequence && catalogHash.isNotEmpty()) require(catalogHash == catalog.payloadSha256)
        sequence = catalog.sequence; catalogHash = catalog.payloadSha256
        selections = selections.mapValues { (id, current) ->
            val game = catalog.games.single { it.id == id }
            require(game.contentCode >= current.highestCode && (game.contentCode != current.highestCode || current.highestHash == null || game.archiveSha256 == current.highestHash))
            current.copy(highestCode = game.contentCode, highestHash = game.archiveSha256)
        }
    }
    fun acceptCatalog(envelope: ByteArray): ResourceCatalog = synchronized(lock) {
        val catalog = ResourcePolicy.verifyEnvelope(envelope, publicKey, now = now())
        require(stateFailure == null) { stateFailure ?: "Resource state invalid" }; catalog.requireFresh(now())
        require(catalog.sequence > sequence || catalog.sequence == sequence && catalog.payloadSha256 == catalogHash) { "Resource catalog rollback or conflict" }
        val next = selections.toMutableMap()
        for (game in catalog.games) {
            val current = next.getValue(game.id)
            require(game.contentCode >= current.highestCode && (game.contentCode != current.highestCode || current.highestHash == null || current.highestHash == game.archiveSha256)) { "Resource code rollback or conflict" }
            next[game.id] = current.copy(highestCode = game.contentCode, highestHash = game.archiveSha256)
        }
        val journalRoot = File(directory, "catalog-history")
        require(usedBytes(directory) + envelope.size * 2L <= ResourcePolicy.MAX_STORE && freeSpace() >= envelope.size * 2L + ResourcePolicy.FREE_RESERVE) { "资源信任记录空间不足，旧版本保留" }
        require(journalRoot.isDirectory || journalRoot.mkdirs())
        journalNames.forEach { proofFile(File(journalRoot, it)).write(envelope) }
        persist(next, catalog.sequence, catalog.payloadSha256)
        catalog
    }
    fun isEligible(game: ResourceGame): Boolean = synchronized(lock) {
        val selected = selections.getValue(game.id)
        stateFailure == null && !selected.pinned && game.contentCode !in selected.quarantine && game.compatible(hostCode, ResourcePolicy.contract(game.id)) && game.contentCode > selected.active.substringBefore('-').toIntOrNull().let { it ?: 1 } && selected.ready != game.identity
    }
    fun install(game: ResourceGame, envelope: ByteArray, archive: File, cancelled: () -> Boolean = { false }) = synchronized(lock) {
        require(stateFailure == null && !hasSessions()) { "Install only while hall is idle" }
        val catalog = ResourcePolicy.verifyEnvelope(envelope, publicKey, now = now())
        require(catalog.games.single { it.id == game.id } == game && isEligible(game)) { "Resource not eligible" }
        acceptCatalog(envelope)
        val bytesNeeded = game.files.sumOf { it.bytes } + game.archiveBytes + envelope.size
        garbageCollect()
        require(usedBytes(directory) + bytesNeeded <= ResourcePolicy.MAX_STORE && freeSpace() >= bytesNeeded + ResourcePolicy.FREE_RESERVE) { "资源空间不足，旧版本保留" }
        val stagingParent = File(directory, "staging").apply { mkdirs() }; val staging = File(stagingParent, UUID.randomUUID().toString())
        try {
            ResourceArchive.extract(archive, staging, game, cancelled)
            require(!cancelled()); catalog.requireFresh(now())
            proofFile(File(staging, "catalog.signed.json")).write(envelope)
            val destination = version(game.id, game.identity); destination.parentFile!!.mkdirs()
            if (destination.exists()) {
                verifyVersion(game.id, game.identity)
                proofFile(File(destination, "catalog.signed.json")).write(envelope)
                deletePrivate(staging)
            } else require(staging.renameTo(destination)) { "Cannot commit resource directory" }
            val current = selections.getValue(game.id)
            persist(selections + (game.id to current.copy(ready = game.identity)))
        } finally { if (staging.exists()) deletePrivate(staging) }
    }
    private fun verifyVersion(id: String, identity: String): ResourceGame {
        val root = version(id, identity); require(root.isDirectory && root.canonicalFile == root.absoluteFile)
        val proof = File(root, "catalog.signed.json"); require(proof.length() in 1..1048576)
        val game = ResourcePolicy.verifyInstalledProof(readProof(proof), publicKey).games.single { it.id == id }
        require(game.identity == identity && game.compatible(hostCode, ResourcePolicy.contract(id)))
        val actual = mutableSetOf<String>()
        root.walkTopDown().forEach { file -> require(file.canonicalFile == file.absoluteFile) { "Resource link" }; if (file.isFile) actual.add(file.relativeTo(root).invariantSeparatorsPath) }
        require(actual == game.files.map { it.path }.toSet() + "catalog.signed.json")
        game.files.forEach { metadata -> val file = File(root, metadata.path); require(file.length() == metadata.bytes); require(ResourcePolicy.sha256(file.inputStream().use { ResourceIo.readBounded(it, metadata.bytes) }) == metadata.sha256) { "Installed resource corrupted" } }
        return game
    }
    fun openSession(id: String, cacheProxyCleared: Boolean): ResourceSession = synchronized(lock) {
        var selected = selections.getValue(id)
        if (selected.ready != null && !selected.pinned && !hasSessions() && cacheProxyCleared && stateFailure == null) {
            val readyIdentity = selected.ready!!
            selected = try {
                val game = verifyVersion(id, readyIdentity)
                val proof = ResourcePolicy.verifyInstalledProof(readProof(File(version(id, game.identity), "catalog.signed.json")), publicKey)
                val fresh = now() >= proof.issuedAt - 300000 && now() < proof.expiresAt
                if (fresh) {
                    proof.requireFresh(now()); require(game.contentCode !in selected.quarantine)
                    selected.copy(previous = selected.active, active = readyIdentity, ready = null)
                } else selected.copy(ready = null)
            } catch (error: Exception) {
                candidateFailure = "候选资源校验失败，已保留旧版本：${error.message}"
                selected.copy(ready = null, quarantine = selected.quarantine + readyIdentity.substringBefore('-').toInt())
            }
            persist(selections + (id to selected))
        }
        val game = if (selected.active == "builtin") null else verifyVersion(id, selected.active)
        val reference = "$id/${selected.active}"; references[reference] = (references[reference] ?: 0) + 1
        ResourceSession(game, game?.let { version(id, it.identity) }) { synchronized(lock) { val count = references.getValue(reference) - 1; if (count == 0) references.remove(reference) else references[reference] = count } }
    }
    fun restore(id: String, builtin: Boolean, failedCode: Int? = null) = synchronized(lock) {
        require(stateFailure == null) { "全局状态损坏，单游戏恢复不能覆盖其他游戏；请使用全局可信恢复" }
        require(!hasSessions()) { "Return to hall before restoring" }; val current = selections.getValue(id)
        val target = if (builtin) "builtin" else current.previous
        if (target != "builtin") verifyVersion(id, target)
        val next = current.copy(active = target, ready = null, pinned = true, quarantine = current.quarantine + listOfNotNull(failedCode))
        persist(selections + (id to next)); stateFailure = null
    }
    fun recoverAllBuiltinsFromTrustedHistory() = synchronized(lock) {
        require(!hasSessions() && stateFailure != null) { "Global recovery is only for damaged state while hall is idle" }
        val catalogs = journalCatalogs(); require(catalogs.isNotEmpty()) { "没有完整可信高水位记录，请恢复状态备份；自动更新保持停止" }
        val newest = catalogs.maxByOrNull { it.sequence }!!
        require(newest.sequence >= sequence) { "可信记录不足以恢复最高序号，自动更新保持停止" }
        val next = newest.games.associate { game -> game.id to ResourceSelection(pinned = true, highestCode = game.contentCode, highestHash = game.archiveSha256, quarantine = if (game.contentCode > 1) setOf(game.contentCode) else emptySet()) }
        persist(next, newest.sequence, newest.payloadSha256); stateFailure = null
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
