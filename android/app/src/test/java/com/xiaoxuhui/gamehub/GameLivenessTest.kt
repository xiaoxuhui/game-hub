package com.xiaoxuhui.gamehub

import org.junit.Assert.*
import org.junit.Test

class GameLivenessTest {
    @Test fun expiresOnlyAfterDeadline() {
        val liveness = GameLiveness(30_000)
        assertFalse(liveness.expired(100_000))
        liveness.start(1_000)
        assertFalse(liveness.expired(30_999))
        assertTrue(liveness.expired(31_000))
    }
    @Test fun responseOrResumeRestartsDeadline() {
        val liveness = GameLiveness(30_000)
        liveness.start(1_000)
        liveness.progress(25_000)
        assertFalse(liveness.expired(54_999))
        assertTrue(liveness.expired(55_000))
        liveness.start(100_000)
        assertFalse(liveness.expired(100_001))
    }
    @Test fun stoppedSessionCannotBeRevivedByStaleProgress() {
        val liveness = GameLiveness(30_000)
        liveness.start(1_000)
        liveness.stop()
        liveness.progress(9_000)
        assertFalse(liveness.expired(100_000))
    }
    @Test fun ignoresNonMonotonicTime() {
        val liveness = GameLiveness(30_000)
        liveness.start(50_000)
        assertFalse(liveness.expired(1))
    }
}
