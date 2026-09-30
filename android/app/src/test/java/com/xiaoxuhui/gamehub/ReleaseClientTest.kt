package com.xiaoxuhui.gamehub

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

class ReleaseClientTest {
    private class FakeConnection(private val status: Int, private val body: String = "") :
        HttpURLConnection(URL("https://api.github.com/repos/xiaoxuhui/game-hub/releases/latest")) {
        override fun getResponseCode() = status
        override fun getInputStream(): InputStream = ByteArrayInputStream(body.toByteArray())
        override fun getContentLengthLong() = body.toByteArray().size.toLong()
        override fun connect() {}
        override fun disconnect() {}
        override fun usingProxy() = false
    }

    @Test fun mapsPrivateRepositoryAndRateLimitWithoutParsingResponseBody() {
        val privateError = assertThrows(IllegalStateException::class.java) { ReleaseClient.latest("0.1.0") { FakeConnection(404) } }
        assertEquals("暂无公开版本（仓库仍私有或尚未发布）", privateError.message)
        val limitError = assertThrows(IllegalStateException::class.java) { ReleaseClient.latest("0.1.0") { FakeConnection(403) } }
        assertEquals("查询次数受限，请稍后重试", limitError.message)
    }

    @Test fun parsesNewReleaseAndRejectsRedirectOrOversizedResponse() {
        val body = """{"tag_name":"v0.2.0","assets":[{"id":42,"name":"game-hub.apk","size":3,"digest":"sha256:${"a".repeat(64)}"}]}"""
        assertEquals("0.2.0", ReleaseClient.latest("0.1.0") { FakeConnection(200, body) }!!.version)
        assertThrows(IllegalStateException::class.java) { ReleaseClient.latest("0.1.0") { FakeConnection(302) } }
        assertThrows(IllegalStateException::class.java) { ReleaseClient.latest("0.1.0") { FakeConnection(200, "x".repeat(1_000_001)) } }
    }
}
