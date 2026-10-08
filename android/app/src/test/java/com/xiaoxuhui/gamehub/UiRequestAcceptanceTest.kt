package com.xiaoxuhui.gamehub

import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class UiRequestAcceptanceTest {
    @Test fun timedOutQueuedRequestNeverRunsLater() {
        val receipt = UiRequestAcceptance(); var opened = false
        assertFalse(receipt.awaitAccepted(1))
        assertFalse(receipt.awaitAccepted(1))
        receipt.dispatch { opened = true; true }
        assertFalse(opened)
    }
    @Test fun mainThreadRejectionAndAcceptanceAreReturnedExactly() {
        for (live in listOf(false, true)) {
            val receipt = UiRequestAcceptance(); receipt.dispatch { live }
            assertEquals(live, receipt.awaitAccepted(1))
        }
    }
    @Test fun timeoutDuringClaimedActionCannotReturnFalseBeforeRealReceipt() {
        val receipt = UiRequestAcceptance(); val started = CountDownLatch(1); val release = CountDownLatch(1)
        val finished = CountDownLatch(1); var result = false
        val ui = Thread { receipt.dispatch { started.countDown(); assertTrue(release.await(2, TimeUnit.SECONDS)); true } }
        ui.start(); assertTrue(started.await(1, TimeUnit.SECONDS))
        val caller = Thread { result = receipt.awaitAccepted(1); finished.countDown() }; caller.start()
        assertFalse(finished.await(30, TimeUnit.MILLISECONDS))
        release.countDown(); assertTrue(finished.await(1, TimeUnit.SECONDS)); assertTrue(result)
        caller.join(); ui.join()
    }
}
