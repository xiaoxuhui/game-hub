package com.xiaoxuhui.gamehub

import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

internal data class ResourceOffer(val catalog: ResourceCatalog, val envelope: ByteArray, val policy: ResourceStorePolicy = ResourceStorePolicy.BUILTIN) {
    fun requireDownload(game: ResourceGame, now: Long = System.currentTimeMillis()) {
        catalog.requireFresh(now)
        require(catalog.games.singleOrNull { it.id == game.id } == game) { "待下载游戏不属于已验签目录，请重新检查" }
        require(policy.validId(game.id) && game.available) { "游戏已退役或不属于当前通道，停止下载" }
    }
    fun reserveDownload(game: ResourceGame, gate: UpdateTaskGate, manual: Boolean, meteredConfirmed: Boolean, now: Long = System.currentTimeMillis()): UpdateDownloadToken? {
        requireDownload(game, now)
        return gate.beginDownload(policy.downloadKind, manual, meteredConfirmed)
    }
}

internal class ResourceCatalogClient(private val publicKey: ByteArray, private val http: PublicReleaseHttp = PublicReleaseHttp(),
    private val now: () -> Long = System::currentTimeMillis, private val policy: ResourceStorePolicy = ResourceStorePolicy.BUILTIN) {
    fun query(cancelled: () -> Boolean = { false }): ResourceOffer {
        val deadline = PublicReleaseHttp.deadline()
        val release = StrictJson.parse(http.metadata("${PublicReleaseHttp.API_ROOT}/releases/tags/${policy.releaseTag}", 4194304, deadline, cancelled).bytes, 4194304)
        require(release.get("draft") == false && release.get("prerelease") == true && release.getString("tag_name") == policy.releaseTag) { "资源通道身份错误" }
        val releaseId = ResourcePolicy.integer(release, "id", 1)
        val assets = mutableListOf<JSONObject>(); var page = 1; var remaining = 4194304
        while (true) {
            require(page <= 100 && remaining > 0) { "资源资产清单超过预算" }
            val url = "${PublicReleaseHttp.API_ROOT}/releases/$releaseId/assets?per_page=100&page=$page"
            val response = http.metadata(url, remaining, deadline, cancelled); remaining -= response.bytes.size
            val items = StrictJson.parseArray(response.bytes)
            require(items.length() <= 100)
            for (i in 0 until items.length()) assets.add(items.getJSONObject(i))
            val next = response.link?.split(',')?.mapNotNull { part ->
                val parsed = Regex("^\\s*<([^>]+)>;\\s*rel=\"(next|prev|first|last)\"\\s*$").matchEntire(part) ?: error("资产分页Link格式无效")
                if (parsed.groupValues[2] == "next") parsed.groupValues[1] else null
            } ?: emptyList()
            require(next.size <= 1) { "重复分页链接" }
            if (next.isEmpty()) {
                if (items.length() < 100) break
                // A full last page can legitimately have no next Link. Probe the fixed next page
                // instead of claiming completeness while hidden duplicate names could remain.
                page++; continue
            }
            val target = java.net.URI(next.single()); val query = target.rawQuery?.split('&') ?: emptyList()
            require(items.length() == 100 && target.scheme == "https" && target.host == "api.github.com" && target.port == -1 && target.userInfo == null && target.fragment == null &&
                target.rawPath == "/repos/xiaoxuhui/game-hub/releases/$releaseId/assets" && query.size == 2 && query.toSet() == setOf("per_page=100", "page=${page + 1}")) { "资产分页地址不可信" }
            page++
        }
        val ids = assets.map { ResourcePolicy.integer(it, "id", 1) }; val names = assets.map { it.getString("name") }
        require(ids.size == ids.toSet().size && names.size == names.toSet().size) { "资产编号或名称重复" }
        val signed = assets.singleOrNull { it.getString("name") == "catalog.signed.json" } ?: error("没有唯一签名资源目录")
        require(signed.getString("state") == "uploaded")
        val size = ResourcePolicy.integer(signed, "size", 1, 1048576).toInt(); val catalogDigest = digest(signed)
        var envelope = byteArrayOf()
        http.asset(ResourcePolicy.integer(signed, "id", 1), size.toLong(), deadline, cancelled) { envelope = PublicReleaseHttp.bounded(it, size, deadline, cancelled) }
        require(envelope.size == size && ResourcePolicy.sha256(envelope) == catalogDigest) { "签名目录资产大小或摘要错误" }
        val catalog = policy.fresh(envelope, publicKey, now())
        require(catalog.releaseId == releaseId) { "签名目录所属Release不一致" }
        catalog.games.forEach { game ->
            val asset = assets.singleOrNull { ResourcePolicy.integer(it, "id", 1) == game.assetId } ?: error("资源ZIP不属于发行通道")
            require(asset.getString("name") == game.assetName && asset.getString("state") == "uploaded" && ResourcePolicy.integer(asset, "size", 1) == game.archiveBytes && digest(asset) == game.archiveSha256) { "资源ZIP身份或摘要错误" }
        }
        catalog.requireFresh(now()); return ResourceOffer(catalog, envelope, policy)
    }
    fun download(game: ResourceGame, directory: File, cancelled: () -> Boolean, progress: (Long, Long) -> Unit): File {
        require(game.archiveBytes in 1..ResourcePolicy.MAX_ARCHIVE)
        val root = directory.canonicalFile; require(root.isDirectory || root.mkdirs())
        require(root.usableSpace >= game.archiveBytes + ResourcePolicy.FREE_RESERVE) { "下载空间不足" }
        val file = File(root, "resource-${game.id}-${java.util.UUID.randomUUID()}.part")
        val deadline = PublicReleaseHttp.deadline(600)
        try {
            http.asset(game.assetId, game.archiveBytes, deadline, cancelled) { input ->
                val copied = FileOutputStream(file).use { output -> DownloadPayload.copy(input, output, game.archiveBytes, cancelled, progress).also { output.fd.sync() } }
                require(copied.first == game.archiveBytes && copied.second == game.archiveSha256) { "资源ZIP大小或摘要校验失败" }
            }
            require(!cancelled()); return file
        } catch (error: Exception) { file.delete(); throw error }
    }
    private fun digest(asset: JSONObject): String = Regex("^sha256:([0-9a-f]{64})$").matchEntire(asset.getString("digest"))?.groupValues?.get(1) ?: error("资产缺少有效SHA256")
}
