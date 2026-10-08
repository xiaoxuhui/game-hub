package com.xiaoxuhui.gamehub

import org.junit.Assert.*
import org.junit.Test

class UpdateTaskGateTest {
    @Test fun offlineLocalChangeSharesMutexIgnoresNetworkAndHonorsForegroundHallCancellation() {
        val f = Fixture(); f.gate.setNetwork(UpdateNetwork(false, false))
        val local = f.gate.beginLocalChange()!!
        assertTrue(f.gate.valid(local)); assertTrue(f.gate.busy())
        assertNull(f.gate.beginLocalChange()); assertFalse(f.gate.beginCheck(true))
        f.gate.setNetwork(UpdateNetwork(true, true)); assertTrue(f.gate.valid(local))
        assertNull(f.gate.beginDownload(UpdateDownloadKind.APK, true, true))
        f.gate.setPresence(true, true, true); assertFalse(f.gate.valid(local))
        f.gate.setPresence(true, true); assertFalse(f.gate.valid(local))
        f.gate.finish(local); assertFalse(f.gate.busy())
        val next = f.gate.beginLocalChange()!!; f.gate.finish(local)
        assertTrue(f.gate.valid(next)); f.gate.setPresence(false, true)
        assertFalse(f.gate.valid(next)); f.gate.finish(next)
        assertNull(f.gate.beginLocalChange())
    }
    @Test fun externalResultPendingRevokesDownloadUntilCallbackReleasesGate() {
        val f = Fixture()
        val active = f.gate.beginDownload(UpdateDownloadKind.RESOURCE, false)!!
        f.gate.setPresence(true, true, true)
        assertFalse(f.gate.valid(active)); f.gate.finish(active)
        assertFalse(f.gate.canAutoDownload())
        assertNull(f.gate.beginDownload(UpdateDownloadKind.RESOURCE, false))
        assertNull(f.gate.beginDownload(UpdateDownloadKind.RESOURCE, true, true))
        assertNull(f.gate.beginDownload(UpdateDownloadKind.APK, true, true))
        f.gate.setPresence(true, true, false)
        assertTrue(f.gate.canAutoDownload())
        assertNotNull(f.gate.beginDownload(UpdateDownloadKind.RESOURCE, false))
    }
    private class Fixture {
        var elapsed = 0L; var epoch = 100000L
        val saved = mutableMapOf<String, Long>()
        val gate = UpdateTaskGate({ elapsed }, { epoch }, { channel, until -> saved[channel] = until }).apply { setPresence(true, true); setNetwork(UpdateNetwork(true, true)) }
    }
    @Test fun coldCheckCoalescesAndRotationShortReturnDoNotRecheckButThirtyMinutesDoes() {
        val f = Fixture(); assertTrue(f.gate.beginCheck(false)); assertFalse(f.gate.beginCheck(true)); f.gate.endCheck()
        f.gate.setPresence(true, true); assertFalse(f.gate.beginCheck(false))
        f.gate.setPresence(false, true); f.elapsed += 1000; f.gate.setPresence(true, true); assertFalse(f.gate.beginCheck(false))
        f.elapsed = 1800000; assertTrue(f.gate.beginCheck(false)); f.gate.endCheck(); assertTrue(f.gate.beginCheck(true))
    }
    @Test fun cancellationKeepsMutexUntilCleanupAndStaleWorkerCannotReleaseNewTask() {
        val f = Fixture(); val resource = f.gate.beginDownload(UpdateDownloadKind.RESOURCE, false)!!
        assertNull(f.gate.beginDownload(UpdateDownloadKind.APK, true, true)); assertFalse(f.gate.beginCheck(true))
        f.gate.cancel(); assertFalse(f.gate.valid(resource)); assertNull(f.gate.beginDownload(UpdateDownloadKind.APK, true, true))
        f.gate.finish(resource); val apk = f.gate.beginDownload(UpdateDownloadKind.APK, true, true)!!
        f.gate.finish(resource); assertTrue(f.gate.busy()); assertTrue(f.gate.valid(apk)); f.gate.finish(apk); assertFalse(f.gate.busy())
    }
    @Test fun gameBackgroundAndNetworkTransitionsCancelWithoutAutomaticResume() {
        for (change in listOf<(UpdateTaskGate) -> Unit>({ it.setPresence(true, false) }, { it.setPresence(false, true) }, { it.setNetwork(UpdateNetwork(true, false)) }, { it.setNetwork(UpdateNetwork(false, false)) })) {
            val f = Fixture(); val token = f.gate.beginDownload(UpdateDownloadKind.RESOURCE, false)!!
            change(f.gate); assertFalse(f.gate.valid(token)); f.gate.setPresence(true, true); f.gate.setNetwork(UpdateNetwork(true, true)); assertFalse(f.gate.valid(token)); assertTrue(f.gate.busy())
        }
    }
    @Test fun mobileNeedsExplicitConfirmationOrOptInAndApkNeverAutomaticallyDownloads() {
        val f = Fixture(); f.gate.setNetwork(UpdateNetwork(true, false)); assertFalse(f.gate.canAutoDownload()); assertNull(f.gate.beginDownload(UpdateDownloadKind.RESOURCE, false))
        assertNull(f.gate.beginDownload(UpdateDownloadKind.RESOURCE, true)); val manual = f.gate.beginDownload(UpdateDownloadKind.RESOURCE, true, true)!!
        f.gate.settings(false, false); assertTrue(f.gate.valid(manual)); f.gate.finish(manual)
        f.gate.settings(true, true); assertTrue(f.gate.canAutoDownload()); val auto = f.gate.beginDownload(UpdateDownloadKind.RESOURCE, false)!!
        f.gate.settings(true, false); assertFalse(f.gate.valid(auto)); f.gate.finish(auto)
        assertNull(f.gate.beginDownload(UpdateDownloadKind.APK, false, true))
    }
    @Test fun rateLimitPersistsPerChannelAndManualActionsCannotBypassIt() {
        val f = Fixture(); f.gate.rateLimited("resources", f.epoch + 3600000); assertFalse(f.gate.channelAllowed("resources")); assertTrue(f.gate.channelAllowed("apk"))
        assertFalse(f.gate.canAutoDownload())
        assertNull(f.gate.beginDownload(UpdateDownloadKind.RESOURCE, true, true))
        val restarted = UpdateTaskGate({ f.elapsed }, { f.epoch }, { _, _ -> }, initialBackoff = f.saved)
        assertFalse(restarted.channelAllowed("resources")); f.epoch += 3600000; assertTrue(restarted.channelAllowed("resources"))
    }
}
