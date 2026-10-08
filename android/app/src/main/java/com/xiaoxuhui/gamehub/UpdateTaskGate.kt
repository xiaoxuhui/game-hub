package com.xiaoxuhui.gamehub

internal data class UpdateNetwork(val online: Boolean, val unmeteredWifi: Boolean)
internal enum class UpdateDownloadKind { APK, RESOURCE, LOCAL, REPAIR }
internal class UpdateDownloadToken(val serial: Long, val kind: UpdateDownloadKind, val mayUseMetered: Boolean) {
    @Volatile var cancelled = false
        internal set
}

/** Pure application-scope policy; cancellation retains the busy slot until worker cleanup acknowledges it. */
internal class UpdateTaskGate(private val elapsed: () -> Long, private val epoch: () -> Long,
    private val saveBackoff: (String, Long) -> Unit, initialBackoff: Map<String, Long> = emptyMap()) {
    private var lastCheck: Long? = null
    private var checking = false
    private var foreground = false
    private var inHall = true
    private var network = UpdateNetwork(false, false)
    private var serial = 0L
    private var active: UpdateDownloadToken? = null
    private var pendingRepairs = 0
    private val blockedUntil = initialBackoff.toMutableMap()
    var automaticResources = true
        private set
    var automaticMetered = false
        private set
    @Synchronized fun setPresence(isForeground: Boolean, hall: Boolean, externalFlowPending: Boolean = false) {
        foreground = isForeground; inHall = hall && !externalFlowPending
        if (!isForeground || !inHall) active?.let { if (it.kind != UpdateDownloadKind.REPAIR) it.cancelled = true }
    }
    @Synchronized fun setNetwork(value: UpdateNetwork) {
        network = value
        active?.let { if (it.kind in setOf(UpdateDownloadKind.APK, UpdateDownloadKind.RESOURCE) && (!network.online || !it.mayUseMetered && !network.unmeteredWifi)) it.cancelled = true }
    }
    @Synchronized fun settings(automatic: Boolean, metered: Boolean) {
        automaticResources = automatic; automaticMetered = metered
        // Turning settings off cannot revoke a manual action, but revokes the automatic task below.
        active?.let { if (it.kind == UpdateDownloadKind.RESOURCE && automaticTask && (!automatic || !metered && !network.unmeteredWifi)) it.cancelled = true }
    }
    private var automaticTask = false
    @Synchronized fun due(): Boolean = lastCheck?.let { elapsed() - it >= 30L * 60 * 1000 } ?: true
    @Synchronized fun beginCheck(manual: Boolean): Boolean {
        if (checking || active != null || pendingRepairs > 0 || !foreground || !network.online || !manual && !due()) return false
        checking = true; lastCheck = elapsed(); return true
    }
    @Synchronized fun endCheck() { checking = false }
    @Synchronized fun channelAllowed(channel: String): Boolean { require(channel in setOf("apk", "resources")); return (blockedUntil[channel] ?: 0L) <= epoch() }
    @Synchronized fun channelBlockedUntil(channel: String): Long { require(channel in setOf("apk", "resources")); return blockedUntil[channel] ?: 0 }
    @Synchronized fun rateLimited(channel: String, until: Long) {
        require(channel in setOf("apk", "resources"))
        val value = maxOf(blockedUntil[channel] ?: 0, until)
        blockedUntil[channel] = value; saveBackoff(channel, value)
    }
    @Synchronized fun canAutoDownload(): Boolean = foreground && inHall && network.online && automaticResources && (network.unmeteredWifi || automaticMetered) && channelAllowed("resources") && !checking && active == null && pendingRepairs == 0
    @Synchronized fun beginDownload(kind: UpdateDownloadKind, manual: Boolean, meteredConfirmed: Boolean = false): UpdateDownloadToken? {
        require(kind in setOf(UpdateDownloadKind.APK, UpdateDownloadKind.RESOURCE))
        if (checking || active != null || pendingRepairs > 0 || !foreground || !inHall || !network.online) return null
        if (kind == UpdateDownloadKind.RESOURCE && !channelAllowed("resources") || kind == UpdateDownloadKind.APK && !channelAllowed("apk")) return null
        val mayUseMetered = if (manual) meteredConfirmed else automaticMetered
        if (!manual && (kind == UpdateDownloadKind.APK || !automaticResources)) return null
        if (!network.unmeteredWifi && !mayUseMetered) return null
        automaticTask = !manual
        return UpdateDownloadToken(++serial, kind, mayUseMetered).also { active = it }
    }
    @Synchronized fun beginLocalChange(): UpdateDownloadToken? {
        if (checking || active != null || pendingRepairs > 0 || !foreground || !inHall) return null
        automaticTask = false
        return UpdateDownloadToken(++serial, UpdateDownloadKind.LOCAL, false).also { active = it }
    }
    @Synchronized fun requestRepair() {
        pendingRepairs++
        active?.let { if (it.kind in setOf(UpdateDownloadKind.APK, UpdateDownloadKind.RESOURCE)) it.cancelled = true }
    }
    @Synchronized fun beginRepair(): UpdateDownloadToken? {
        if (pendingRepairs == 0 || checking || active != null) return null
        pendingRepairs--; automaticTask = false
        return UpdateDownloadToken(++serial, UpdateDownloadKind.REPAIR, false).also { active = it }
    }
    @Synchronized fun cancel(): Boolean { val token = active ?: return false; if (token.kind == UpdateDownloadKind.REPAIR) return false; token.cancelled = true; return true }
    @Synchronized fun valid(token: UpdateDownloadToken): Boolean = active === token && !token.cancelled && (token.kind == UpdateDownloadKind.REPAIR || foreground && inHall && (token.kind == UpdateDownloadKind.LOCAL || network.online && (token.mayUseMetered || network.unmeteredWifi)))
    @Synchronized fun finish(token: UpdateDownloadToken) { if (active === token) { active = null; automaticTask = false } }
    @Synchronized fun busy(): Boolean = active != null || checking || pendingRepairs > 0
}
