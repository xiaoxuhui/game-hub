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

internal enum class LocalResourceAction { RESTORE_PREVIOUS, RESTORE_BUILTIN, RESUME, RETRY, RECOVER_ALL }
internal data class UpdateSnapshot(val apk: ReleaseApk? = null, val resources: List<ResourceGame> = emptyList(),
    val catalogGames: List<ResourceGame> = emptyList(), val apkCheckedAt: Long? = null, val resourcesCheckedAt: Long? = null,
    val localResources: Map<String, LocalResourceInfo> = emptyMap(),
    val localDiagnostic: String? = null,
    val localLoaded: Boolean = false, val localReadError: String? = null,
    val apkRemembered: Boolean = false, val resourcesRemembered: Boolean = false,
    val apkStatus: String = "尚未检查大厅更新", val resourceStatus: String = "尚未检查游戏更新",
    val busy: Boolean = false, val task: String? = null, val done: Long = 0, val total: Long = 0,
    val readyApk: File? = null, val automatic: Boolean = true, val metered: Boolean = false,
    val settingsSaving: Boolean = false, val settingsStatus: String? = null)

/** Package-only verification dependencies; production always uses its fixed repository and pinned key. */
internal data class CoordinatorVerificationEnvironment(val store: GameResourceStore, val publicKey: ByteArray,
    val http: PublicReleaseHttp, val network: () -> UpdateNetwork)

/** One process instance owns connections, queue, settings and cancellation across Activity recreation. */
internal class UpdateCoordinator private constructor(context: Context, private val verification: CoordinatorVerificationEnvironment? = null) {
    private val app = context.applicationContext
    private val preferences = UpdatePreferences(app.getSharedPreferences("update-policy", Context.MODE_PRIVATE))
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val connectivity = app.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private val http = verification?.http ?: PublicReleaseHttp()
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
    private val resourceStore by lazy { verification?.store ?: runtime.store }
    private val resourceClient by lazy { ResourceCatalogClient(verification?.publicKey ?: runtime.publicKey, http) }
    private val apkManager = ApkUpdateManager(app)
    private val metadataCache by lazy { UpdateMetadataCache(AndroidResourceStateFile(File(app.filesDir, "apk-reminder.json")),
        AndroidResourceStateFile(File(app.filesDir, "resources-reminder.json"))) }
    init {
        gate.settings(state.automatic, state.metered)
        // Only this process owner cleans abandoned private parts, before any worker can download.
        worker.execute {
            val directory = File(app.cacheDir, "resource-updates")
            directory.listFiles()?.filter { Regex("resource-(conway|eml|light|turing)-[0-9a-f-]{36}\\.part").matches(it.name) && it.canonicalFile.parentFile == directory.canonicalFile }?.forEach { it.delete() }
            readLocalResources()
            readRememberedUpdates()
        }
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) = refreshNetwork()
            override fun onLost(network: Network) = refreshNetwork()
            override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) = refreshNetwork()
        }
        if (verification == null) connectivity.registerNetworkCallback(NetworkRequest.Builder().addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET).build(), callback)
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
        val capabilities = if (verification == null) connectivity.getNetworkCapabilities(connectivity.activeNetwork) else null
        val supplied = verification?.network?.invoke()
        val online = supplied?.online ?: (capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED))
        if (!online) checkCancelled = true
        if (!online) publish { it.copy(
            apkStatus = if (it.apkCheckedAt == null) "大厅未检查：离线" else it.apkStatus,
            resourceStatus = if (it.resourcesCheckedAt == null) "游戏未检查：离线" else it.resourceStatus) }
        gate.setNetwork(supplied ?: UpdateNetwork(online, online && capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)))
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
                        val checkedAt = System.currentTimeMillis()
                        val saved = runCatching { metadataCache.saveApk(release, checkedAt) }.isSuccess
                        publish { it.copy(apk = release, apkRemembered = false, apkCheckedAt = checkedAt, apkStatus = (if (release == null) "大厅已是最新版本" else "大厅 ${release.version} 可更新") + if (saved) "" else "；历史提醒保存失败") }
                    } catch (error: Exception) { channelFailure("apk", error) }
                } else publish { it.copy(apkStatus = "大厅查询限流，稍后可重试") }
                if (!checkCancelled && foreground && gate.channelAllowed("resources")) {
                    try {
                        val next = resourceClient.query { checkCancelled || !foreground }
                        check(!checkCancelled && foreground) { "检查已取消" }
                        resourceStore.acceptCatalog(next.envelope)
                        resourceStore.refreshReadyProof(next.envelope)
                        val available = next.catalog.games.filter { resourceStore.isEligible(it) }
                        val checkedAt = System.currentTimeMillis()
                        val saved = runCatching { metadataCache.saveResources(next.catalog, checkedAt) }.isSuccess
                        readLocalResources()
                        synchronized(stateLock) {
                            attempted.clear(); offer = next
                            publish { it.copy(resources = available, catalogGames = next.catalog.games, resourcesRemembered = false, resourcesCheckedAt = checkedAt, resourceStatus = (if (available.isEmpty()) "没有可安装的游戏更新" else "${available.size} 个游戏有更新") + if (saved) "" else "；历史提醒保存失败") }
                        }
                    } catch (error: Exception) { channelFailure("resources", error) }
                } else if (foreground) publish { it.copy(resourceStatus = if (checkCancelled) "游戏检查已取消，已安装资源保留" else "游戏查询限流，稍后可重试") }
            } finally {
                synchronized(stateLock) { gate.endCheck(); publish(::idleStatus) }
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
                resourceStore.install(game, current.envelope, archive, { !gate.valid(token) })
                readLocalResources()
                publish { it.copy(resources = it.resources.filterNot { candidate -> candidate.id == game.id }, resourceStatus = "${game.id} 更新已就绪，下次进入生效") }
            } catch (error: Exception) {
                if (token.cancelled) publish { it.copy(resourceStatus = "游戏下载已取消，原版本保留") } else channelFailure("resources", error)
            } finally {
                archive?.delete()
                synchronized(stateLock) { gate.finish(token); publish(::idleStatus) }
                automaticNext()
            }
        }
        return true
    }
    fun downloadApk(meteredConfirmed: Boolean): Boolean = synchronized(stateLock) {
        if (state.apkRemembered) return false
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
                synchronized(stateLock) { gate.finish(token); publish(::idleStatus) }
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
    private fun idleStatus(value: UpdateSnapshot): UpdateSnapshot = value.copy(busy = gate.busy(), task = if (gate.busy()) "正在隔离失败资源" else null, done = 0, total = 0)
    fun reportResourceFailure(id: String, identity: String) = synchronized(stateLock) {
        checkCancelled = true
        gate.requestRepair()
        publish { it.copy(busy = true, task = "正在隔离失败资源", done = 0, total = 0) }
        worker.execute {
            // The serial queue places this after cleanup of the previously reserved network/local task.
            val token = checkNotNull(gate.beginRepair())
            try {
                resourceStore.quarantineFailedIdentity(id, identity)
                publish { it.copy(resourceStatus = "$id 失败资源已隔离，请恢复版本；存档保留") }
            } catch (error: Exception) { publish { it.copy(resourceStatus = "失败资源隔离未提交：${error.message}；请恢复版本") } }
            finally {
                readLocalResources()
                synchronized(stateLock) {
                    val available = runCatching { offer?.catalog?.games?.filter { resourceStore.isEligible(it) } ?: emptyList() }.getOrDefault(emptyList())
                    gate.finish(token); publish { idleStatus(it).copy(resources = available) }
                }
                automaticNext()
            }
        }
    }
    fun changeLocal(id: String?, action: LocalResourceAction, retryCode: Int? = null): Boolean = synchronized(stateLock) {
        require(action == LocalResourceAction.RECOVER_ALL || id in setOf("conway", "eml", "light", "turing"))
        require(action != LocalResourceAction.RETRY || retryCode != null && retryCode > 1)
        val token = gate.beginLocalChange() ?: return false
        publish { it.copy(busy = true, task = "正在处理本地资源", done = 0, total = 0) }
        worker.execute {
            var changed = false
            try {
                require(gate.valid(token)) { "本地操作已取消，请回到大厅重试" }
                // Once the store starts its atomic transaction, cancellation cannot undo a committed choice.
                val store = resourceStore
                when (action) {
                    LocalResourceAction.RECOVER_ALL -> store.recoverAllBuiltinsFromTrustedHistory()
                    LocalResourceAction.RESTORE_PREVIOUS, LocalResourceAction.RESTORE_BUILTIN -> {
                        val code = store.selection(id!!).active.substringBefore('-').toIntOrNull()?.takeIf { it > 1 }
                        store.restore(id, action == LocalResourceAction.RESTORE_BUILTIN, code)
                    }
                    LocalResourceAction.RESUME -> store.resumeAutomatic(id!!)
                    LocalResourceAction.RETRY -> store.resumeAutomatic(id!!, retryCode)
                }
                changed = true
                publish { it.copy(resourceStatus = when (action) {
                    LocalResourceAction.RESTORE_PREVIOUS, LocalResourceAction.RESTORE_BUILTIN, LocalResourceAction.RECOVER_ALL -> "已恢复并固定资源；存档保留"
                    LocalResourceAction.RESUME -> "已解除固定；失败编号仍隔离"
                    LocalResourceAction.RETRY -> "已允许重试指定编号；存档保留"
                }) }
            } catch (error: Exception) { publish { it.copy(resourceStatus = "本地操作失败：${error.message}；存档保留") } }
            finally {
                readLocalResources()
                synchronized(stateLock) {
                    val available = runCatching { offer?.catalog?.games?.filter { resourceStore.isEligible(it) } ?: emptyList() }.getOrDefault(emptyList())
                    if (changed && action == LocalResourceAction.RETRY) {
                        attempted.removeAll { it.startsWith("$id/$retryCode-") }
                    }
                    gate.finish(token)
                    publish { idleStatus(it).copy(resources = available) }
                }
                automaticNext()
            }
        }
        true
    }
    fun reloadLocalResources() { worker.execute { readLocalResources() } }
    private fun readRememberedUpdates() {
        try {
            val version = app.packageManager.getPackageInfo(app.packageName, 0).versionName ?: ""
            metadataCache.readApk(version)?.let { remembered ->
                publish { it.copy(apk = remembered.release, apkCheckedAt = remembered.checkedAt, apkRemembered = true,
                    apkStatus = remembered.release?.let { apk -> "上次发现大厅 ${apk.version}，待检查" } ?: "上次未发现大厅更新，待检查") }
            }
        } catch (error: Exception) { publish { it.copy(apkStatus = "大厅历史提醒不可用，请联网检查") } }
        try {
            resourceStore.rememberedCatalog()?.let { catalog ->
                val checkedAt = metadataCache.readResources(catalog)
                val fresh = runCatching { catalog.requireFresh(System.currentTimeMillis()) }.isSuccess
                publish { it.copy(catalogGames = catalog.games, resources = emptyList(), resourcesCheckedAt = checkedAt, resourcesRemembered = true,
                    resourceStatus = if (fresh) "上次验证的游戏目录，待检查" else "上次游戏目录已过期，请检查") }
            }
        } catch (error: Exception) { publish { it.copy(resourceStatus = "游戏历史提醒不可用，请联网检查；本地存档保留") } }
    }
    private fun readLocalResources() {
        try {
            val current = resourceStore.describeAll(); val diagnostic = resourceStore.failure()
            publish { it.copy(localResources = current, localDiagnostic = diagnostic, localLoaded = true, localReadError = null) }
        }
        catch (error: Exception) { publish { it.copy(localResources = emptyMap(), localLoaded = true, localReadError = error.message ?: "读取失败", resourceStatus = "本地资源状态不可用：${error.message}；存档保留") } }
    }
    fun unmeteredWifi(): Boolean {
        verification?.let { return it.network().unmeteredWifi }
        val capabilities = connectivity.getNetworkCapabilities(connectivity.activeNetwork) ?: return false
        return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
    }
    /** Verification owners must stop and drain their private worker before removing fixture files. */
    fun closeVerification() {
        check(verification != null) { "The production process owner cannot be closed by a screen" }
        check(Looper.myLooper() != Looper.getMainLooper()) { "Drain verification off the UI thread" }
        presence(false, false)
        gate.cancel()
        synchronized(stateLock) { listeners.clear() }
        worker.shutdown()
        check(worker.awaitTermination(45, java.util.concurrent.TimeUnit.SECONDS)) { "Verification worker did not finish cleanup" }
    }
    companion object {
        fun createForVerification(context: Context, environment: CoordinatorVerificationEnvironment) = UpdateCoordinator(context, environment)
        @Volatile private var instance: UpdateCoordinator? = null
        fun get(context: Context): UpdateCoordinator = instance ?: synchronized(this) { instance ?: UpdateCoordinator(context).also { instance = it } }
    }
}
