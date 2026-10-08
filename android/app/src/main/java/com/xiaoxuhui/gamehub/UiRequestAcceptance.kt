package com.xiaoxuhui.gamehub

import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/** A queued request can time out, but a claimed UI action must deliver its actual acceptance result. */
internal class UiRequestAcceptance {
    private val state = AtomicInteger(0) // pending, running, complete, cancelled
    private val complete = CountDownLatch(1)
    @Volatile private var accepted = false
    fun cancelledBeforeAcceptance() = state.get() == 3
    fun dispatch(action: () -> Boolean) {
        if (!state.compareAndSet(0, 1)) return
        try { accepted = action() } finally { state.set(2); complete.countDown() }
    }
    fun awaitAccepted(queueTimeoutMillis: Long = 5000): Boolean {
        var interrupted = false
        try {
            try {
                if (complete.await(queueTimeoutMillis, TimeUnit.MILLISECONDS)) return accepted
            } catch (error: InterruptedException) { interrupted = true }
            if (state.compareAndSet(0, 3) || state.get() == 3) return false
            // Main-thread acceptance already began; a timeout must not report rejection while it launches.
            while (true) try { complete.await(); return accepted } catch (error: InterruptedException) { interrupted = true }
        } finally { if (interrupted) Thread.currentThread().interrupt() }
    }
}
