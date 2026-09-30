package com.xiaoxuhui.gamehub

import java.net.HttpURLConnection
import java.net.URL
import java.io.ByteArrayOutputStream

internal object ReleaseClient {
    private const val LATEST_URL = "https://api.github.com/repos/xiaoxuhui/game-hub/releases/latest"

    fun latest(installedVersion: String): ReleaseApk? {
        val connection = URL(LATEST_URL).openConnection() as HttpURLConnection
        connection.connectTimeout = 10_000
        connection.readTimeout = 15_000
        connection.instanceFollowRedirects = false
        connection.setRequestProperty("Accept", "application/vnd.github+json")
        connection.setRequestProperty("User-Agent", "game-hub-android")
        try {
            return when (connection.responseCode) {
                200 -> {
                    if (connection.contentLengthLong > 1_000_000) error("发布信息过大")
                    val output = ByteArrayOutputStream()
                    connection.inputStream.use { input ->
                        val buffer = ByteArray(8192)
                        while (true) {
                            val count = input.read(buffer)
                            if (count < 0) break
                            if (output.size() + count > 1_000_000) error("发布信息过大")
                            output.write(buffer, 0, count)
                        }
                    }
                    UpdatePolicy.parseLatest(output.toString("UTF-8"), installedVersion)
                }
                404 -> error("暂无公开版本（仓库仍私有或尚未发布）")
                403, 429 -> error("查询次数受限，请稍后重试")
                else -> error("查询失败：HTTP ${connection.responseCode}")
            }
        } finally {
            connection.disconnect()
        }
    }
}
