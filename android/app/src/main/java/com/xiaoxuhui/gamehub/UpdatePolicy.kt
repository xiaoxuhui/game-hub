package com.xiaoxuhui.gamehub

import org.json.JSONObject

internal data class ReleaseApk(val version: String, val assetId: Long, val size: Long, val sha256: String) {
    val apiUrl: String get() = "https://api.github.com/repos/xiaoxuhui/game-hub/releases/assets/$assetId"
}

internal object UpdatePolicy {
    private const val MAX_APK_BYTES = 150L * 1024 * 1024
    private val versionPattern = Regex("^v(\\d+)\\.(\\d+)\\.(\\d+)$")
    private val digestPattern = Regex("^sha256:([a-fA-F0-9]{64})$")

    fun parseLatest(raw: String, installedVersion: String): ReleaseApk? {
        val release = JSONObject(raw)
        if (release.optBoolean("draft") || release.optBoolean("prerelease")) error("不是正式发布版本")
        val tag = release.optString("tag_name")
        val latest = versionParts(tag) ?: error("发布版本号格式错误")
        val current = versionParts("v$installedVersion") ?: error("当前版本号格式错误")
        if (compareVersions(latest, current) <= 0) return null
        val assets = release.optJSONArray("assets") ?: error("发布缺少 APK 文件")
        val matches = (0 until assets.length()).map { assets.getJSONObject(it) }
            .filter { it.optString("name") == "game-hub.apk" }
        if (matches.size != 1) error("发布必须包含唯一的 game-hub.apk")
        val asset = matches.single()
        val id = asset.optLong("id")
        val size = asset.optLong("size")
        val digest = digestPattern.matchEntire(asset.optString("digest"))?.groupValues?.get(1)
            ?: error("发布 APK 缺少有效的 SHA-256")
        if (id <= 0 || size <= 0 || size > MAX_APK_BYTES) error("发布 APK 的编号或大小无效")
        return ReleaseApk(tag.removePrefix("v"), id, size, digest.lowercase())
    }

    private fun versionParts(version: String): List<Long>? {
        val match = versionPattern.matchEntire(version) ?: return null
        return match.groupValues.drop(1).map { it.toLongOrNull() ?: return null }
    }

    private fun compareVersions(a: List<Long>, b: List<Long>): Int {
        for (index in 0..2) {
            val result = a[index].compareTo(b[index])
            if (result != 0) return result
        }
        return 0
    }
}
