package com.xiaoxuhui.gamehub

import org.json.JSONArray
import org.json.JSONObject

internal data class RememberedApk(val checkedAt: Long, val release: ReleaseApk?)

/** Historical reminders only. Neither cache grants permission to download or install. Worker only. */
internal class UpdateMetadataCache(private val apkFile: ResourceStateFile, private val resourcesFile: ResourceStateFile) {
    private fun checked(json: JSONObject, now: Long): Long = ResourcePolicy.integer(json, "checkedAt").also {
        require(now in 0..Long.MAX_VALUE - 300000 && it <= now + 300000) { "更新提醒时间异常，请联网检查" }
        require(ResourcePolicy.integer(json, "schemaVersion") == 1L)
    }
    private fun latest(release: ReleaseApk): String = JSONObject().put("tag_name", "v${release.version}")
        .put("draft", false).put("prerelease", false).put("assets", JSONArray().put(JSONObject()
            .put("name", "game-hub.apk").put("id", release.assetId).put("size", release.size).put("digest", "sha256:${release.sha256}"))).toString()
    fun saveApk(release: ReleaseApk?, checkedAt: Long) {
        val target = release?.let {
            require(UpdatePolicy.parseLatest(latest(it), "0.0.0") == it)
            JSONObject().put("version", it.version).put("assetId", it.assetId).put("size", it.size).put("sha256", it.sha256)
        }
        require(checkedAt > 0)
        apkFile.write(JSONObject().put("schemaVersion", 1).put("checkedAt", checkedAt).put("target", target ?: JSONObject.NULL).toString().toByteArray())
    }
    fun readApk(installedVersion: String, now: Long = System.currentTimeMillis()): RememberedApk? {
        val json = apkFile.read()?.let { StrictJson.parse(it, 32768) } ?: return null
        require(json.keys().asSequence().toSet() == setOf("schemaVersion", "checkedAt", "target"))
        val time = checked(json, now)
        val release = if (json.isNull("target")) null else {
            val target = json.getJSONObject("target")
            require(target.keys().asSequence().toSet() == setOf("version", "assetId", "size", "sha256"))
            val apk = ReleaseApk(ResourcePolicy.string(target, "version", 64), ResourcePolicy.integer(target, "assetId", max = 9007199254740991),
                ResourcePolicy.integer(target, "size", max = 150L * 1024 * 1024), ResourcePolicy.string(target, "sha256", 64))
            require(UpdatePolicy.parseLatest(latest(apk), "0.0.0") == apk)
            UpdatePolicy.parseLatest(latest(apk), installedVersion)
        }
        return RememberedApk(time, release)
    }
    fun saveResources(catalog: ResourceCatalog, checkedAt: Long) {
        require(checkedAt > 0)
        resourcesFile.write(JSONObject().put("schemaVersion", 1).put("checkedAt", checkedAt)
            .put("catalogSequence", catalog.sequence.toString()).put("payloadSha256", catalog.payloadSha256).toString().toByteArray())
    }
    fun readResources(catalog: ResourceCatalog, now: Long = System.currentTimeMillis()): Long? {
        val json = resourcesFile.read()?.let { StrictJson.parse(it, 32768) } ?: return null
        require(json.keys().asSequence().toSet() == setOf("schemaVersion", "checkedAt", "catalogSequence", "payloadSha256"))
        val time = checked(json, now)
        require(json.get("catalogSequence") is String && json.get("payloadSha256") is String)
        return time.takeIf { json.getString("catalogSequence") == catalog.sequence.toString() && json.getString("payloadSha256") == catalog.payloadSha256 }
    }
}
