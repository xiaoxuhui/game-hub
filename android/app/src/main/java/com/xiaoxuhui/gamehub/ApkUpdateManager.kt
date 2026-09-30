package com.xiaoxuhui.gamehub

import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.content.pm.Signature
import android.net.Uri
import android.os.Build
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.security.MessageDigest

internal class ApkUpdateManager(private val context: Context) {
    fun downloadAndVerify(release: ReleaseApk, cancelled: () -> Boolean, progress: (Long, Long) -> Unit): File {
        val directory = File(context.cacheDir, "updates")
        if (!directory.isDirectory && !directory.mkdirs()) error("无法创建下载缓存")
        val partial = File(directory, "game-hub.part.apk")
        val ready = File(directory, "game-hub.apk")
        partial.delete()
        ready.delete()
        try {
            var url = release.apiUrl
            var connection: HttpURLConnection? = null
            for (redirect in 0..5) {
                if (!UpdatePolicy.allowDownloadUrl(url)) error("下载地址不可信")
                connection = (URL(url).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 10_000
                    readTimeout = 30_000
                    instanceFollowRedirects = false
                    setRequestProperty("Accept", "application/octet-stream")
                    setRequestProperty("User-Agent", "game-hub-android")
                }
                val response = connection.responseCode
                if (response == 200) break
                if (response !in setOf(301, 302, 303, 307, 308) || redirect == 5) {
                    connection.disconnect()
                    error("APK 下载失败：HTTP $response")
                }
                val location = connection.getHeaderField("Location") ?: error("下载重定向缺少地址")
                val next = URI(url).resolve(location).toString()
                connection.disconnect()
                url = next
            }
            val active = connection ?: error("无法连接下载地址")
            try {
                if (active.contentLengthLong > release.size) error("APK 文件超过发布声明的大小")
                val digest = MessageDigest.getInstance("SHA-256")
                var total = 0L
                active.inputStream.use { input ->
                    FileOutputStream(partial).use { output ->
                        val buffer = ByteArray(64 * 1024)
                        while (true) {
                            if (cancelled()) error("已取消下载")
                            val count = input.read(buffer)
                            if (count < 0) break
                            total += count
                            if (total > release.size) error("APK 文件超过发布声明的大小")
                            output.write(buffer, 0, count)
                            digest.update(buffer, 0, count)
                            progress(total, release.size)
                        }
                    }
                }
                if (cancelled()) error("已取消下载")
                val actualDigest = digest.digest().joinToString("") { "%02x".format(it) }
                val magic = partial.inputStream().use { input ->
                    ByteArray(4).also { bytes -> if (input.read(bytes) != 4) error("APK 文件无效") }
                }
                if (!magic.contentEquals(byteArrayOf(0x50, 0x4b, 0x03, 0x04))) error("APK 文件不是有效的安装包")
                verifyArchive(partial, release, total, actualDigest)
                if (!partial.renameTo(ready)) error("无法保存已验证的 APK")
                return ready
            } finally {
                active.disconnect()
            }
        } catch (error: Exception) {
            partial.delete()
            ready.delete()
            throw error
        }
    }

    private fun verifyArchive(apk: File, release: ReleaseApk, size: Long, digest: String) {
        val manager = context.packageManager
        val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
        val archive = manager.getPackageArchiveInfo(apk.absolutePath, flags) ?: error("下载的文件不是可识别的 APK")
        val installed = manager.getPackageInfo(context.packageName, flags)
        val archiveCode = if (Build.VERSION.SDK_INT >= 28) archive.longVersionCode else archive.versionCode.toLong()
        val installedCode = if (Build.VERSION.SDK_INT >= 28) installed.longVersionCode else installed.versionCode.toLong()
        UpdatePolicy.verifyCandidate(release, size, digest, archive.packageName, context.packageName,
            archiveCode, installedCode, signerHashes(archive), signerHashes(installed))
    }

    @Suppress("DEPRECATION")
    private fun signerHashes(info: PackageInfo): Set<String> {
        val signatures: Array<Signature> = if (Build.VERSION.SDK_INT >= 28) {
            info.signingInfo?.apkContentsSigners ?: emptyArray()
        } else {
            info.signatures ?: emptyArray()
        }
        return signatures.map { signature ->
            MessageDigest.getInstance("SHA-256").digest(signature.toByteArray()).joinToString("") { "%02x".format(it) }
        }.toSet()
    }

    fun installationIntent(apk: File): Intent {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.updates", apk)
        return Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            clipData = android.content.ClipData.newUri(context.contentResolver, "game-hub.apk", uri)
        }
    }
}
