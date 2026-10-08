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
import java.security.MessageDigest
import java.util.UUID

internal class ApkUpdateManager(private val context: Context) {
    fun downloadAndVerify(release: ReleaseApk, cancelled: () -> Boolean, progress: (Long, Long) -> Unit): File =
        downloadAndVerify(release, cancelled, progress, PublicReleaseHttp())

    fun downloadAndVerify(release: ReleaseApk, cancelled: () -> Boolean, progress: (Long, Long) -> Unit, http: PublicReleaseHttp): File {
        val directory = File(context.cacheDir, "updates")
        if (!directory.isDirectory && !directory.mkdirs()) error("无法创建下载缓存")
        val uniqueName = "game-hub-${release.assetId}-${UUID.randomUUID()}"
        val partial = File(directory, "$uniqueName.part.apk")
        val ready = File(directory, "$uniqueName.apk")
        try {
            val deadline = PublicReleaseHttp.deadline(600)
            var total = 0L
            var actualDigest = ""
            http.asset(release.assetId, release.size, deadline, cancelled) { input ->
                FileOutputStream(partial).use { output ->
                    val copied = DownloadPayload.copy(input, output, release.size, cancelled, progress)
                    output.fd.sync(); total = copied.first; actualDigest = copied.second
                }
            }
            val magic = partial.inputStream().use { input ->
                ByteArray(4).also { bytes -> if (input.read(bytes) != 4) error("APK 文件无效") }
            }
            if (!magic.contentEquals(byteArrayOf(0x50, 0x4b, 0x03, 0x04))) error("APK 文件不是有效的安装包")
            verifyArchive(partial, release, total, actualDigest)
            check(!cancelled()) { "更新已取消" }
            if (!partial.renameTo(ready)) error("无法保存已验证的 APK")
            return ready
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
