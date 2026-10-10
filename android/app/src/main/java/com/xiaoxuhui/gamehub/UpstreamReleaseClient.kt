package com.xiaoxuhui.gamehub

import org.json.JSONObject

/** Display-only official publications. No source APK/URL is ever handed to an installer. */
internal data class UpstreamRepository(val gameId: String, val repository: String, val name: String) {
    val latestUrl get() = "https://api.github.com/repos/xiaoxuhui/$repository/releases/latest"
}
internal data class UpstreamPublication(val version: String, val releaseId: Long)

internal object UpstreamReleasePolicy {
    val repositories = listOf(
        UpstreamRepository("conway", "conway-life-game", "生命游戏"),
        UpstreamRepository("eml", "EML", "EML"),
        UpstreamRepository("light", "light_game", "光学游戏"),
        UpstreamRepository("turing", "turing-machine-simulator", "图灵机"),
        UpstreamRepository("abelian-sandpile", "abelian-sandpile", "阿贝尔沙堆"),
        UpstreamRepository("lambda-diagram-game", "lambda-diagram-game", "Lambda 图解")
    )
    fun repository(id: String) = repositories.singleOrNull { it.gameId == id }
        ?: error("未登记的游戏源仓库")
    private fun parts(version: String): List<Long> {
        require(Regex("^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$").matches(version)) { "正式版本号格式错误" }
        return version.split('.').map { it.toLongOrNull() ?: error("正式版本号超出范围") }
    }
    fun compare(a: String, b: String): Int {
        val left = parts(a); val right = parts(b)
        for (index in 0..2) { val value = left[index].compareTo(right[index]); if (value != 0) return value }
        return 0
    }
    fun parse(id: String, raw: String): UpstreamPublication {
        val source = repository(id)
        val release = JSONObject(raw)
        require(release.get("draft") == false && release.get("prerelease") == false) { "未找到有效的正式发布" }
        val tag = release.getString("tag_name")
        require(tag.startsWith("v")) { "正式发布标签格式错误" }
        val version = tag.removePrefix("v"); parts(version)
        require(release.getString("html_url") == "https://github.com/xiaoxuhui/${source.repository}/releases/tag/$tag") { "发布不属于已登记的源仓库" }
        val releaseId = release.getLong("id")
        require(releaseId > 0) { "正式发布编号无效" }
        return UpstreamPublication(version, releaseId)
    }
}

internal class UpstreamReleaseClient(private val http: PublicReleaseHttp) {
    fun query(id: String, deadline: Long, cancelled: () -> Boolean): UpstreamPublication {
        val response = try { http.upstreamMetadata(id, 1_000_000, deadline, cancelled) }
            catch (missing: PublicReleaseMissing) { throw java.io.IOException("未找到正式发布，待检查", missing) }
        return UpstreamReleasePolicy.parse(id, response.bytes.toString(Charsets.UTF_8))
    }
}
