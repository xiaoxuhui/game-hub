package com.xiaoxuhui.gamehub

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

class UpdatePreferencesTest {
    @Test fun realAtomicReminderAndSignedDirectoryReopenWithOriginalCheckTime() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        ResourceDeviceFixture(context).use { fixture ->
            val apkFile = java.io.File(fixture.root, "apk-reminder.json")
            val resourceFile = java.io.File(fixture.root, "resource-reminder.json")
            val first = UpdateMetadataCache(AndroidResourceStateFile(apkFile), AndroidResourceStateFile(resourceFile))
            val time = System.currentTimeMillis()
            val apk = ReleaseApk("0.4.0", 42, 1234, "a".repeat(64))
            fixture.store.acceptCatalog(fixture.envelope)
            first.saveApk(apk, time); first.saveResources(fixture.catalog, time)
            val recreated = UpdateMetadataCache(AndroidResourceStateFile(apkFile), AndroidResourceStateFile(resourceFile))
            assertEquals(RememberedApk(time, apk), recreated.readApk("0.3.0", time + 1000))
            assertEquals(RememberedApk(time, null), recreated.readApk("0.4.0", time + 1000))
            val signed = fixture.reopenedStore().rememberedCatalog()!!
            assertEquals(fixture.catalog, signed); assertEquals(time, recreated.readResources(signed, time + 1000))
        }
    }
    @Test fun realPreferencesRestoreSeparateBackoffAndSettings() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val name = "update-test-${UUID.randomUUID()}"
        val shared = context.getSharedPreferences(name, Context.MODE_PRIVATE)
        try {
            val first = UpdatePreferences(shared)
            assertTrue(first.automatic()); assertFalse(first.metered())
            var clock = 100L
            val gate = UpdateTaskGate({ 0 }, { clock }, first::saveBackoff, first.backoff())
            gate.rateLimited("apk", 900); gate.rateLimited("resources", 500)
            gate.rateLimited("apk", 700) // Cannot shorten the saved limit.
            assertTrue(first.settings(false, true))
            val recreated = UpdatePreferences(context.getSharedPreferences(name, Context.MODE_PRIVATE))
            assertFalse(recreated.automatic()); assertTrue(recreated.metered())
            assertEquals("Old preferences have no dynamic backoff", 0L, recreated.backoff().getValue("dynamic"))
            recreated.saveBackoff("dynamic", 1200)
            val restored = UpdateTaskGate({ 0 }, { clock }, recreated::saveBackoff, recreated.backoff())
            restored.setPresence(true, true); restored.setNetwork(UpdateNetwork(true, true))
            assertFalse(restored.channelAllowed("apk")); assertFalse(restored.channelAllowed("resources"))
            assertFalse(restored.channelAllowed("dynamic")); assertEquals(1200L, restored.channelBlockedUntil("dynamic"))
            assertNull(restored.beginDownload(UpdateDownloadKind.APK, true))
            assertNull(restored.beginDownload(UpdateDownloadKind.RESOURCE, true))
            assertNull(restored.beginDownload(UpdateDownloadKind.DYNAMIC, true))
            clock = 501
            assertTrue(restored.channelAllowed("resources")); assertFalse(restored.channelAllowed("apk"))
            clock = 901; assertTrue(restored.channelAllowed("apk")); assertFalse(restored.channelAllowed("dynamic"))
            clock = 1201; assertTrue(restored.channelAllowed("dynamic"))
        } finally { assertTrue(shared.edit().clear().commit()); context.deleteSharedPreferences(name) }
    }
    @Test fun coordinatorSubscriptionsDoNotRetainDetachedActivityCallbacks() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val coordinator = UpdateCoordinator.get(context)
        assertSame(coordinator, UpdateCoordinator.get(context))
        var calls = 0
        val listener: (UpdateSnapshot) -> Unit = { calls++ }
        val instrumentation = androidx.test.platform.app.InstrumentationRegistry.getInstrumentation()
        instrumentation.runOnMainSync { coordinator.subscribe(listener); coordinator.unsubscribe(listener) }
        instrumentation.waitForIdleSync()
        assertEquals(0, calls)
        instrumentation.runOnMainSync { coordinator.subscribe(listener) }
        instrumentation.waitForIdleSync(); assertEquals(1, calls)
        instrumentation.runOnMainSync { coordinator.unsubscribe(listener) }
    }
}
