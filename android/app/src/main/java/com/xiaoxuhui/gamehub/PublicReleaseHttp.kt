package com.xiaoxuhui.gamehub

import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.LinkedHashMap
import java.util.Locale
import java.util.TimeZone
import java.text.SimpleDateFormat

internal class UpdateRateLimited(val until: Long) : java.io.IOException("查询次数受限，按服务器要求稍后重试")
internal class PublicReleaseMissing : java.io.IOException("资源通道尚未发布")
internal data class PublicBytes(val bytes: ByteArray, val link: String?)

/** Anonymous fixed-repository HTTP. No credential/header follows redirects. Serialized by coordinator. */
internal class PublicReleaseHttp(private val connections: (String) -> HttpURLConnection = { URL(it).openConnection() as HttpURLConnection },
    private val now: () -> Long = System::currentTimeMillis) {
    private data class Cached(val bytes: ByteArray, val etag: String, val link: String?)
    private val cache = LinkedHashMap<String, Cached>()
    fun metadata(url: String, limit: Int, deadline: Long, cancelled: () -> Boolean = { false }): PublicBytes {
        require(url.startsWith(API_ROOT + "/")) { "Metadata endpoint outside fixed repository" }
        return queryMetadata(url, limit, deadline, cancelled)
    }
    fun upstreamMetadata(id: String, limit: Int, deadline: Long, cancelled: () -> Boolean): PublicBytes =
        queryMetadata(UpstreamReleasePolicy.repository(id).latestUrl, limit, deadline, cancelled)

    private fun queryMetadata(url: String, limit: Int, deadline: Long, cancelled: () -> Boolean): PublicBytes {
        val cached = cache[url]
        val connection = open(url, "application/vnd.github+json", cached?.etag)
        try {
            check(deadline, cancelled)
            val status = connection.responseCode
            check(deadline, cancelled)
            when (status) {
                304 -> return cached?.let { require(it.bytes.size <= limit); PublicBytes(it.bytes.clone(), it.link) } ?: error("304 没有可用缓存，不能判断最新")
                200 -> {
                    require(connection.contentLengthLong <= limit || connection.contentLengthLong == -1L) { "发布信息过大" }
                    val bytes = connection.inputStream.use { bounded(it, limit, deadline, cancelled) }
                    val etag = connection.getHeaderField("ETag")
                    val link = connection.getHeaderField("Link")
                    if (etag != null && etag.length <= 512) {
                        cache.remove(url); cache[url] = Cached(bytes.clone(), etag, link)
                        while (cache.size > 8 || cache.values.sumOf { it.bytes.size.toLong() } > 8L * 1024 * 1024) cache.remove(cache.keys.first())
                    }
                    return PublicBytes(bytes, link)
                }
                404 -> throw PublicReleaseMissing()
                403, 429 -> throw UpdateRateLimited(backoff(connection))
                else -> error("发布查询失败：HTTP $status")
            }
        } finally { connection.disconnect() }
    }
    fun asset(id: Long, expectedBytes: Long, deadline: Long, cancelled: () -> Boolean, consume: (InputStream) -> Unit) {
        require(id > 0 && expectedBytes > 0)
        var url = "$API_ROOT/releases/assets/$id"
        for (redirect in 0..5) {
            check(deadline, cancelled); require(UpdatePolicy.allowDownloadUrl(url))
            val connection = open(url, "application/octet-stream", null)
            try {
                val status = connection.responseCode
                check(deadline, cancelled)
                when (status) {
                    200 -> {
                        require(connection.contentLengthLong <= expectedBytes || connection.contentLengthLong == -1L) { "资源超过签名声明的大小" }
                        connection.inputStream.use { raw ->
                            consume(object : java.io.FilterInputStream(raw) {
                                override fun read(): Int { check(deadline, cancelled); return super.read() }
                                override fun read(buffer: ByteArray, offset: Int, length: Int): Int { check(deadline, cancelled); return `in`.read(buffer, offset, length) }
                            })
                        }
                        check(deadline, cancelled); return
                    }
                    403, 429 -> throw UpdateRateLimited(backoff(connection))
                    301, 302, 303, 307, 308 -> {
                        require(redirect < 5) { "资源重定向过多" }
                        url = UpdatePolicy.resolvedRedirect(url, connection.getHeaderField("Location") ?: error("重定向缺少地址"))
                    }
                    else -> error("资源下载失败：HTTP $status")
                }
            } finally { connection.disconnect() }
        }
        error("资源下载未完成")
    }
    private fun open(url: String, accept: String, etag: String?) = connections(url).apply {
        connectTimeout = 10000; readTimeout = if (accept == "application/octet-stream") 30000 else 15000; instanceFollowRedirects = false
        useCaches = false
        setRequestProperty("Cache-Control", "no-cache")
        setRequestProperty("Accept", accept); setRequestProperty("User-Agent", "game-hub-android")
        if (etag != null) setRequestProperty("If-None-Match", etag)
    }
    private fun backoff(connection: HttpURLConnection): Long {
        val time = now()
        val retry = connection.getHeaderField("Retry-After")?.let { value ->
            value.toLongOrNull()?.takeIf { it in 0..86400 }?.let { time + it * 1000 }
                ?: runCatching { SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss zzz", Locale.US).apply { timeZone = TimeZone.getTimeZone("GMT"); isLenient = false }.parse(value)?.time }.getOrNull()
        }
        val reset = connection.getHeaderField("X-RateLimit-Reset")?.toLongOrNull()?.takeIf { it in 1..Long.MAX_VALUE / 1000 }?.times(1000)
        return maxOf(retry ?: 0, reset ?: 0).takeIf { it > time }?.coerceIn(time + 60000, time + 86400000) ?: time + 3600000
    }
    companion object {
        const val API_ROOT = "https://api.github.com/repos/xiaoxuhui/game-hub"
        fun deadline(seconds: Long = 30) = System.nanoTime() + seconds * 1000000000
        fun check(deadline: Long, cancelled: () -> Boolean) { require(!cancelled()) { "已取消更新任务" }; require(System.nanoTime() < deadline) { "更新请求超过总时限" } }
        fun bounded(input: InputStream, limit: Int, deadline: Long, cancelled: () -> Boolean): ByteArray {
            val output = ByteArrayOutputStream(); val buffer = ByteArray(8192)
            while (true) { check(deadline, cancelled); val count = input.read(buffer); if (count < 0) break; require(output.size().toLong() + count <= limit) { "发布信息超过实际字节预算" }; output.write(buffer, 0, count) }
            check(deadline, cancelled); return output.toByteArray()
        }
    }
}
