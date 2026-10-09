package com.xiaoxuhui.gamehub

import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume
import org.junit.Test
import java.io.File
import java.security.MessageDigest

/** Explicit manual acceptance against the installed formal APK; no replacement store, key or transport. */
class ProductionResourceIdentityDeviceTest {
    private fun sha(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    @Test fun installedProductionIdentityMatchesReviewedRelease() {
        val args = InstrumentationRegistry.getArguments()
        Assume.assumeTrue("Explicit production resource acceptance only", args.getString("productionResourceIdentity") == "true")
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val id = requireNotNull(args.getString("gameId"))
        require(DynamicGamePolicy.validId(id))
        val code = requireNotNull(args.getString("expectedContentCode")).toInt()
        val archive = requireNotNull(args.getString("expectedArchiveSha256"))
        val source = requireNotNull(args.getString("expectedSourceRevision"))
        require(code > 0 && archive.matches(Regex("[0-9a-f]{64}")) && source.matches(Regex("[0-9a-f]{40}")))
        val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
        assertEquals("0.4.0", packageInfo.versionName)
        val runtime = ResourceRuntime.get(context) // Same process singleton and APK-pinned production key.
        assertEquals(4, runtime.hostCode)
        val apkSha = sha(File(context.applicationInfo.sourceDir).readBytes())
        assertEquals("c6e071e18eac1cb97f3d898d6eb4dab2c790b8d9310a907a7e44e3c34a78ee39", apkSha)
        assertEquals("649107df10ad8f48e8da1d4f992fe652a63fea448fa17dce081b87333a892673", sha(runtime.publicKey))
        val info = requireNotNull(runtime.dynamicStore.describeAll()[id])
        assertNull(info.stateError)
        assertNull(info.activeError)
        val active = requireNotNull(info.active)
        assertEquals(code, active.contentCode)
        assertEquals(archive, active.archiveSha256)
        assertEquals(source, active.sourceRevision)
        assertEquals(active.identity, info.selection.active)
        assertEquals("$id-dynamic-v1", active.storageContract)
        val identity = JSONObject().put("id", id).put("contentCode", active.contentCode).put("version", active.version)
            .put("active", info.selection.active).put("ready", info.selection.ready ?: JSONObject.NULL)
            .put("archiveSha256", active.archiveSha256).put("sourceRevision", active.sourceRevision)
            .put("storageContract", active.storageContract).put("apkSha256", apkSha).put("hostCode", runtime.hostCode)
        Log.i("GameHubResourceAcceptance", identity.toString())
    }
}
