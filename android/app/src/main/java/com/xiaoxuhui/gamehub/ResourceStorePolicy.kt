package com.xiaoxuhui.gamehub

/** Only these two application-defined trust policies may interpret installation proofs. */
internal enum class ResourceStorePolicy {
    BUILTIN, DYNAMIC;
    val releaseTag get() = if (this == BUILTIN) "game-resources-v1" else "game-resources-v2"
    val updateChannel get() = if (this == BUILTIN) "resources" else "dynamic"
    val downloadKind get() = if (this == BUILTIN) UpdateDownloadKind.RESOURCE else UpdateDownloadKind.DYNAMIC
    val baselineCode get() = if (this == BUILTIN) 1 else 0
    val initialIds get() = if (this == BUILTIN) setOf("conway", "eml", "light", "turing") else emptySet()
    fun validId(id: String) = if (this == BUILTIN) id in initialIds else DynamicGamePolicy.validId(id)
    fun contract(id: String) = if (this == BUILTIN) ResourcePolicy.contract(id) else DynamicGamePolicy.contract(id)
    fun proof(bytes: ByteArray, key: ByteArray) = if (this == BUILTIN) ResourcePolicy.verifyInstalledProof(bytes, key) else DynamicGamePolicy.verifyProof(bytes, key)
    fun fresh(bytes: ByteArray, key: ByteArray, now: Long) = proof(bytes, key).also { it.requireFresh(now) }
    fun requireIds(known: Set<String>, catalog: ResourceCatalog) {
        val incoming = catalog.games.map { it.id }.toSet()
        require(known.all { it in incoming } && incoming.all(::validId)) { "目录遗漏已知游戏或游戏身份无效" }
        require(if (this == BUILTIN) incoming == initialIds else incoming.size <= DynamicGamePolicy.MAX_GAMES)
    }
}
