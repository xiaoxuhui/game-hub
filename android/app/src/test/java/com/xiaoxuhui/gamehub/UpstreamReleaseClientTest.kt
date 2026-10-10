package com.xiaoxuhui.gamehub

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL

class UpstreamReleaseClientTest {
    private fun release(id: String = "light", version: String = "1.2.1") = JSONObject()
        .put("id", 42).put("draft", false).put("prerelease", false).put("tag_name", "v$version")
        .put("html_url", "https://github.com/xiaoxuhui/${UpstreamReleasePolicy.repository(id).repository}/releases/tag/v$version")
    @Test fun fixedSixSourcesHaveDistinctIdentitiesAndExcludeHubExamples() {
        assertEquals(6, UpstreamReleasePolicy.repositories.size)
        assertEquals(6, UpstreamReleasePolicy.repositories.map { it.latestUrl }.toSet().size)
        for (id in listOf("red-green-puzzle", "memory-demo", "evil", "../light")) {
            assertThrows(IllegalStateException::class.java) { UpstreamReleasePolicy.repository(id) }
        }
        for (source in UpstreamReleasePolicy.repositories) {
            assertEquals("1.2.1", UpstreamReleasePolicy.parse(source.gameId, release(source.gameId).toString()).version)
        }
    }
    @Test fun sourceHintsRejectUnpublishedForeignAndMalformedMetadata() {
        val invalid = listOf(release().put("draft", true), release().put("prerelease", true),
            release().put("draft", "false"), release().put("id", 0), release().put("html_url", "https://evil.example/"),
            release().put("html_url", "https://github.com/xiaoxuhui/EML/releases/tag/v1.2.1"),
            release().put("tag_name", "1.2.1"), release(version = "1.2.1-rc1"), release(version = "01.2.1"),
            release(version = "9999999999999999999999.2.1"), release().apply { remove("prerelease") })
        for (raw in invalid) assertThrows(Exception::class.java) { UpstreamReleasePolicy.parse("light", raw.toString()) }
        assertEquals(1, UpstreamReleasePolicy.compare("1.10.0", "1.2.99"))
        assertEquals(0, UpstreamReleasePolicy.compare("0.3.1", "0.3.1"))
        assertEquals(-1, UpstreamReleasePolicy.compare("0.3.0", "0.3.1"))
    }
    @Test fun onlyFixedLatestMetadataIsQueriedAndSource404IsUnknown() {
        val requests = mutableListOf<String>()
        var status = 200
        val http = PublicReleaseHttp({ url ->
            requests.add(url)
            object : HttpURLConnection(URL(url)) {
                val body = release().toString().toByteArray()
                override fun getResponseCode() = status
                override fun getContentLengthLong() = body.size.toLong()
                override fun getInputStream() = ByteArrayInputStream(body)
                override fun connect() {}
                override fun disconnect() {}
                override fun usingProxy() = false
            }
        })
        assertEquals("1.2.1", UpstreamReleaseClient(http).query("light", PublicReleaseHttp.deadline()) { false }.version)
        assertEquals(listOf("https://api.github.com/repos/xiaoxuhui/light_game/releases/latest"), requests)
        status = 404
        val failure = assertThrows(java.io.IOException::class.java) {
            UpstreamReleaseClient(http).query("light", PublicReleaseHttp.deadline()) { false }
        }
        assertEquals("未找到正式发布，待检查", failure.message)
        val before = requests.size
        assertThrows(IllegalStateException::class.java) { UpstreamReleaseClient(http).query("evil", PublicReleaseHttp.deadline()) { false } }
        assertThrows(IllegalArgumentException::class.java) {
            http.metadata("https://api.github.com/repos/xiaoxuhui/light_game/releases/latest", 1000, PublicReleaseHttp.deadline())
        }
        assertEquals(before, requests.size)
    }
}
