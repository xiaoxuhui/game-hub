package com.xiaoxuhui.gamehub

import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL

class PublicReleaseHttpTest {
    private class Connection(val status: Int, val body: String, val etag: String? = null) :
        HttpURLConnection(URL("${PublicReleaseHttp.API_ROOT}/releases/latest")) {
        override fun getResponseCode() = status
        override fun getContentLengthLong() = body.toByteArray().size.toLong()
        override fun getInputStream() = ByteArrayInputStream(body.toByteArray())
        override fun getHeaderField(name: String?) = if (name == "ETag") etag else null
        override fun connect() {}
        override fun disconnect() {}
        override fun usingProxy() = false
    }

    @Test fun everyQueryRevalidatesWithServerAnd304NeedsExistingCache() {
        val connections = mutableListOf(Connection(200, "first", "etag-one"), Connection(304, ""), Connection(200, "changed", "etag-two"))
        var index = 0
        val http = PublicReleaseHttp({ connections[index++] })
        val url = "${PublicReleaseHttp.API_ROOT}/releases/latest"
        assertEquals("first", http.metadata(url, 100, PublicReleaseHttp.deadline()).bytes.toString(Charsets.UTF_8))
        assertEquals("first", http.metadata(url, 100, PublicReleaseHttp.deadline()).bytes.toString(Charsets.UTF_8))
        assertEquals("changed", http.metadata(url, 100, PublicReleaseHttp.deadline()).bytes.toString(Charsets.UTF_8))
        assertEquals("etag-one", connections[1].getRequestProperty("If-None-Match"))
        for (connection in connections) {
            assertFalse("HTTP cache must not pretend a server check happened", connection.useCaches)
            assertEquals("no-cache", connection.getRequestProperty("Cache-Control"))
        }
        assertThrows(IllegalStateException::class.java) {
            PublicReleaseHttp({ Connection(304, "") }).metadata(url, 100, PublicReleaseHttp.deadline())
        }
    }
}
