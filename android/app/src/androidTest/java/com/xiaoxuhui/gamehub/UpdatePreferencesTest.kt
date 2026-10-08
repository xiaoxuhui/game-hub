package com.xiaoxuhui.gamehub

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

class UpdatePreferencesTest {
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
            val restored = UpdateTaskGate({ 0 }, { clock }, recreated::saveBackoff, recreated.backoff())
            restored.setPresence(true, true); restored.setNetwork(UpdateNetwork(true, true))
            assertFalse(restored.channelAllowed("apk")); assertFalse(restored.channelAllowed("resources"))
            assertNull(restored.beginDownload(UpdateDownloadKind.APK, true))
            assertNull(restored.beginDownload(UpdateDownloadKind.RESOURCE, true))
            clock = 501
            assertTrue(restored.channelAllowed("resources")); assertFalse(restored.channelAllowed("apk"))
            clock = 901; assertTrue(restored.channelAllowed("apk"))
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
