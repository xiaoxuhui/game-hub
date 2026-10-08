package com.xiaoxuhui.gamehub

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import java.io.File
import java.util.concurrent.Executors

internal data class UpdateSnapshot(val apk: ReleaseApk? = null, val resources: List<ResourceGame> = emptyList(),
    val catalogGames: List<ResourceGame> = emptyList(), val apkCheckedAt: Long? = null, val resourcesCheckedAt: Long? = null,
    val apkStatus: String = "尚未检查大厅更新", val resourceStatus: String = "尚未检查游戏更新",
    val busy: Boolean = false, val task: String? = null, val done: Long = 0, val total: Long = 0,
    val readyApk: File? = null, val automatic: Boolean = true, val metered: Boolean = false,
    val settingsSaving: Boolean = false, val settingsStatus: String? = null)

/** One process instance owns connections, queue, settings and cancellation across Activity recreation. */
internal class UpdateCoordinator private constructor(context: Context) {
    private val app = context.applicationContext
    private val preferences = UpdatePreferences(app.getSharedPreferences("update-policy", Context.MODE_PRIVATE))
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val connectivity = app.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private val http = PublicReleaseHttp()
    private val gate = UpdateTaskGate(SystemClock::elapsedRealtime, System::currentTimeMillis,
        preferences::saveBackoff, preferences.backoff())
    private val stateLock = Any()
    private var state = UpdateSnapshot(automatic = preferences.automatic(), metered = preferences.metered())
    private val listeners = LinkedHashSet<(UpdateSnapshot) -> Unit>()
    @Volatile private var foreground = false
    @Volatile private var hall = true
    @Volatile private var checkEligible = true
    @Volatile private var checkCancelled = false
    @Volatile private var offer: ResourceOffer? = null
    private val attempted = HashSet<String>()
    private val runtime by lazy { ResourceRuntime.get(app) }
    private val resourceClient by lazy { ResourceCatalogClient(runtime.publicKey, http) }
    private val apkManager = ApkUpdateManager(app)
    init {
        gate.settings(state.automatic, state.metered)
        // Only this process owner cleans abandoned private parts, before any worker can download.
        worker.execute {
            val directory = File(app.cacheDir, "resource-updates")
            directory.listFiles()?.filter { Regex("resource-(conway|eml|light|turing)-[0-9a-f-]{36}\\.part").matches(it.name) && it.canonicalFile.parentFile == directory.canonicalFile }?.forEach { it.delete() }
        }
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) = refreshNetwork()
            override fun onLost(network: Network) = refreshNetwork()
            override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) = refreshNetwork()
        }
        connectivity.registerNetworkCallback(NetworkRequest.Builder().addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET).build(), callback)
        refreshNetwork()
    }
    fun subscribe(listener: (UpdateSnapshot) -> Unit) {
        synchronized(stateLock) { listeners.add(listener) }
        main.post { synchronized(stateLock) { if (listener in listeners) listener(state) } }
    }
    fun unsubscribe(listener: (UpdateSnapshot) -> Unit) { synchronized(stateLock) { listeners.remove(listener) } }
    fun snapshot(): UpdateSnapshot = synchronized(stateLock) { state }
    private fun publish(change: (UpdateSnapshot) -> UpdateSnapshot) {
        synchronized(stateLock) { state = change(state) }
        main.post { val current = snapshot(); val targets = synchronized(stateLock) { listeners.toList() }
            targets.forEach { listener -> synchronized(stateLock) { if (listener in listeners) listener(current) } }
        }
    }
    fun presence(active: Boolean, inHall: Boolean, allowCheck: Boolean = true) {
        foreground = active; hall = inHall; checkEligible = allowCheck
        if (!active) checkCancelled = true
        gate.setPresence(active, hall, !allowCheck)
        refreshNetwork()
        if (active && allowCheck) check(false)
        if (active && hall && allowCheck) automaticNext()
    }
    private fun refreshNetwork() {
        val capabilities = connectivity.getNetworkCapabilities(connectivity.activeNetwork)
        val online = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        if (!online) checkCancelled = true
        if (!online) publish { it.copy(
            apkStatus = if (it.apkCheckedAt == null) "大厅未检查：离线" else it.apkStatus,
            resourceStatus = if (it.resourcesCheckedAt == null) "游戏未检查：离线" else it.resourceStatus) }
        gate.setNetwork(UpdateNetwork(online, online && capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)))
        // Reconnection may start a due check; existing cancelled attempts are never restarted this round.
        if (foreground) { if (checkEligible) check(false); if (hall) automaticNext() }
    }
    fun settings(automatic: Boolean, metered: Boolean): Boolean = synchronized(stateLock) {
        if (state.settingsSaving) return false
        val previous = state
        // Revoke immediately; granting permission waits for durable success on the worker.
        gate.settings(previous.automatic && automatic, previous.metered && metered)
        publish { it.copy(automatic = automatic, metered = metered, settingsSaving = true, settingsStatus = "正在保存设置…") }
        worker.execute {
            val success = runCatching { preferences.settings(automatic, metered) }.getOrDefault(false)
            synchronized(stateLock) {
                gate.settings(if (success) automatic else previous.automatic, if (success) metered else previous.metered)
                publish { it.copy(automatic = if (success) automatic else previous.automatic,
                    metered = if (success) metered else previous.metered, settingsSaving = false,
                    settingsStatus = if (success) "设置已保存" else "设置保存失败，已恢复原设置") }
            }
            automaticNext()
        }
        true
    }
    fun check(manual: Boolean): Boolean = synchronized(stateLock) {
        if (!manual && !checkEligible) return false
        if (!gate.beginCheck(manual)) return false
        checkCancelled = false
        publish { it.copy(busy = true, task = "检查更新", done = 0, total = 0) }
        worker.execute {
            try {
                if (gate.channelAllowed("apk")) {
                    try {
                        val version = app.packageManager.getPackageInfo(app.packageName, 0).versionName ?: ""
                        val response = http.metadata("${PublicReleaseHttp.API_ROOT}/releases/latest", 1000000, PublicReleaseHttp.deadline(), { checkCancelled || !foreground })
                        val release = UpdatePolicy.parseLatest(response.bytes.toString(Charsets.UTF_8), version)
                        publish { it.copy(apk = release, apkCheckedAt = System.currentTimeMillis(), apkStatus = if (release == null) "大厅已是最新版本" else "大厅 ${release.version} 可更新") }
                    } catch (error: Exception) { channelFailure("apk", error) }
                } else publish { it.copy(apkStatus = "大厅查询限流，稍后可重试") }
                if (!checkCancelled && foreground && gate.channelAllowed("resources")) {
                    try {
                        val next = resourceClient.query { checkCancelled || !foreground }
                        check(!checkCancelled && foreground) { "检查已取消" }
                        runtime.store.acceptCatalog(next.envelope)
                        val available = next.catalog.games.filter { runtime.store.isEligible(it) }
                        synchronized(stateLock) {
                            attempted.clear(); offer = next
                            publish { it.copy(resources = available, catalogGames = next.catalog.games, resourcesCheckedAt = System.currentTimeMillis(), resourceStatus = if (available.isEmpty()) "没有可安装的游戏更新" else "${available.size} 个游戏有更新") }
                        }
                    } catch (error: Exception) { channelFailure("resources", error) }
                } else if (foreground) publish { it.copy(resourceStatus = "游戏查询限流，稍后可重试") }
            } finally {
                synchronized(stateLock) { gate.endCheck(); publish { it.copy(busy = false, task = null) } }
                automaticNext()
            }
        }
        true
    }
    private fun channelFailure(channel: String, error: Exception) {
        var message = error.message ?: "查询失败，已安装内容仍可使用"
        if (error is UpdateRateLimited) {
            try { gate.rateLimited(channel, error.until) } catch (saveError: Exception) { message += "；${saveError.message}" }
        }
        publish { if (channel == "apk") it.copy(apkStatus = message) else it.copy(resourceStatus = message) }
    }
    private fun automaticNext() {
        synchronized(stateLock) {
            if (!gate.canAutoDownload()) return
            val current = offer ?: return
            val game = state.resources.firstOrNull { "${it.id}/${it.identity}" !in attempted } ?: return
            startResource(current, game, false, false)
        }
    }
    fun downloadResource(id: String, meteredConfirmed: Boolean): Boolean = synchronized(stateLock) {
        val current = offer ?: return false
        val game = state.resources.singleOrNull { it.id == id } ?: return false
        startResource(current, game, true, meteredConfirmed)
    }
    private fun startResource(current: ResourceOffer, game: ResourceGame, manual: Boolean, meteredConfirmed: Boolean): Boolean {
        val token = try { current.reserveDownload(game, gate, manual, meteredConfirmed) }
        catch (error: Exception) { publish { it.copy(resourceStatus = "${error.message}；请重新检查更新") }; return false }
        if (token == null) return false
        attempted.add("${game.id}/${game.identity}")
        publish { it.copy(busy = true, task = "下载 ${game.id}", done = 0, total = game.archiveBytes) }
        worker.execute {
            var archive: File? = null
            try {
                current.requireDownload(game)
                archive = resourceClient.download(game, File(app.cacheDir, "resource-updates"), { !gate.valid(token) }, progressReporter())
                check(gate.valid(token)) { "更新已取消" }
                runtime.store.install(game, current.envelope, archive, { !gate.valid(token) })
                publish { it.copy(resources = it.resources.filterNot { candidate -> candidate.id == game.id }, resourceStatus = "${game.id} 更新已就绪，下次进入生效") }
            } catch (error: Exception) {
                if (token.cancelled) publish { it.copy(resourceStatus = "游戏下载已取消，原版本保留") } else channelFailure("resources", error)
            } finally {
                archive?.delete()
                synchronized(stateLock) { gate.finish(token); publish { it.copy(busy = false, task = null) } }
                automaticNext()
            }
        }
        return true
    }
    fun downloadApk(meteredConfirmed: Boolean): Boolean = synchronized(stateLock) {
        val release = state.apk ?: return false
        if (state.readyApk?.exists() == true) return false
        val token = gate.beginDownload(UpdateDownloadKind.APK, true, meteredConfirmed) ?: return false
        publish { it.copy(busy = true, task = "下载大厅 APK", done = 0, total = release.size) }
        worker.execute {
            var ready: File? = null
            try {
                ready = apkManager.downloadAndVerify(release, { !gate.valid(token) }, progressReporter(), http)
                check(gate.valid(token)) { "更新已取消" }
                publish { it.copy(readyApk = ready, apkStatus = "大厅安装包已验证，点击安装") }
                ready = null // Ownership transfers to the user-confirmed installation flow.
            } catch (error: Exception) {
                if (token.cancelled) publish { it.copy(apkStatus = "大厅下载已取消") } else channelFailure("apk", error)
            } finally {
                ready?.delete()
                synchronized(stateLock) { gate.finish(token); publish { it.copy(busy = false, task = null) } }
                automaticNext()
            }
        }
        true
    }
    fun forgetApk(file: File) { publish { if (it.readyApk == file) it.copy(readyApk = null, apkStatus = "安装流程已结束，仍可检查更新") else it } }
    private fun progressReporter(): (Long, Long) -> Unit {
        var lastPercent = -1L
        return { done, total ->
            val percent = done * 100 / total
            if (percent != lastPercent) { lastPercent = percent; publish { it.copy(done = done, total = total) } }
        }
    }
    fun cancel() = gate.cancel()
    fun unmeteredWifi(): Boolean {
        val capabilities = connectivity.getNetworkCapabilities(connectivity.activeNetwork) ?: return false
        return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
    }
    companion object {
        @Volatile private var instance: UpdateCoordinator? = null
        fun get(context: Context): UpdateCoordinator = instance ?: synchronized(this) { instance ?: UpdateCoordinator(context).also { instance = it } }
    }
}
