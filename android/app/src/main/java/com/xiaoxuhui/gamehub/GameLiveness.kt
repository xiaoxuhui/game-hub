package com.xiaoxuhui.gamehub

/** Monotonic deadline for a single active game; persistent game data is never touched. */
internal class GameLiveness(private val timeoutMs: Long) {
    init { require(timeoutMs > 0) }
    private var lastProgress: Long? = null
    fun start(now: Long) { lastProgress = now }
    fun progress(now: Long) { if (lastProgress != null) lastProgress = now }
    fun stop() { lastProgress = null }
    fun expired(now: Long): Boolean = lastProgress?.let { now >= it && now - it >= timeoutMs } ?: false
}
