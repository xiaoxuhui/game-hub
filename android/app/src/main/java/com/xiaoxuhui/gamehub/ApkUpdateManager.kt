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
import java.net.URL
import java.security.MessageDigest
import java.util.UUID

internal class ApkUpdateManager(private val context: Context) {
    fun downloadAndVerify(release: ReleaseApk, cancelled: () -> Boolean, progress: (Long, Long) -> Unit): File {
        val directory = File(context.cacheDir, "updates")
        if (!directory.isDirectory && !directory.mkdirs()) error("无法创建下载缓存")
        val uniqueName = "game-hub-${release.assetId}-${UUID.randomUUID()}"
        val partial = File(directory, "$uniqueName.part.apk")
        val ready = File(directory, "$uniqueName.apk")
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
                val next = UpdatePolicy.resolvedRedirect(url, location)
                connection.disconnect()
                url = next
            }
            val active = connection ?: error("无法连接下载地址")
            try {
                if (active.contentLengthLong > release.size) error("APK 文件超过发布声明的大小")
                val (total, actualDigest) = active.inputStream.use { input ->
                    FileOutputStream(partial).use { output ->
                        DownloadPayload.copy(input, output, release.size, cancelled, progress)
                    }
                }
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

    internal fun verifyArchive(apk: File, release: ReleaseApk, size: Long, digest: String) {
        val manager = context.packageManager
        val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
        val archive = manager.getPackageArchiveInfo(apk.absolutePath, flags) ?: error("下载的文件不是可识别的 APK")
        val installed = manager.getPackageInfo(context.packageName, flags)
        val archiveCode = if (Build.VERSION.SDK_INT >= 28) archive.longVersionCode else archive.versionCode.toLong()
        val installedCode = if (Build.VERSION.SDK_INT >= 28) installed.longVersionCode else installed.versionCode.toLong()
        UpdatePolicy.verifyCandidate(release, size, digest, archive.packageName, context.packageName,
            archive.versionName ?: "",
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
        return Intent(Intent.ACTION_INSTALL_PACKAGE).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            clipData = android.content.ClipData.newUri(context.contentResolver, "game-hub.apk", uri)
            putExtra(Intent.EXTRA_RETURN_RESULT, true)
        }
    }
}
