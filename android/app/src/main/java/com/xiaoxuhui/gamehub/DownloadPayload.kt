package com.xiaoxuhui.gamehub

import java.io.InputStream
import java.io.OutputStream
import java.security.MessageDigest

internal object DownloadPayload {
    fun copy(input: InputStream, output: OutputStream, maxBytes: Long, cancelled: () -> Boolean,
             progress: (Long, Long) -> Unit): Pair<Long, String> {
        val digest = MessageDigest.getInstance("SHA-256")
        var total = 0L
        val buffer = ByteArray(64 * 1024)
        while (true) {
            if (cancelled()) error("已取消下载")
            val count = input.read(buffer)
            if (count < 0) break
            total += count
            if (total > maxBytes) error("APK 文件超过发布声明的大小")
            output.write(buffer, 0, count)
            digest.update(buffer, 0, count)
            progress(total, maxBytes)
        }
        if (cancelled()) error("已取消下载")
        return total to digest.digest().joinToString("") { "%02x".format(it) }
    }
}
