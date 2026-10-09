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

internal enum class LocalResourceAction { RESTORE_PREVIOUS, RESTORE_BUILTIN, RESUME, RETRY, RECOVER_ALL, REMOVE, RECOVER_DYNAMIC }
internal data class UpdateSnapshot(val apk: ReleaseApk? = null, val resources: List<ResourceGame> = emptyList(),
    val catalogGames: List<ResourceGame> = emptyList(), val apkCheckedAt: Long? = null, val resourcesCheckedAt: Long? = null,
    val localResources: Map<String, LocalResourceInfo> = emptyMap(),
    val localDiagnostic: String? = null,
    val localLoaded: Boolean = false, val localReadError: String? = null,
    val apkRemembered: Boolean = false, val resourcesRemembered: Boolean = false,
    val apkStatus: String = "尚未检查大厅更新", val resourceStatus: String = "尚未检查游戏更新",
    val busy: Boolean = false, val task: String? = null, val done: Long = 0, val total: Long = 0,
    val readyApk: File? = null, val automatic: Boolean = true, val metered: Boolean = false,
    val settingsSaving: Boolean = false, val settingsStatus: String? = null,
    val dynamicResources: List<ResourceGame> = emptyList(), val dynamicCatalogGames: List<ResourceGame> = emptyList(),
    val localDynamicResources: Map<String, LocalResourceInfo> = emptyMap(), val dynamicCheckedAt: Long? = null,
    val dynamicRemembered: Boolean = false, val dynamicStatus: String = "尚未检查新游戏目录",
    val dynamicDiagnostic: String? = null, val dynamicReadError: String? = null)

/** Package-only verification dependencies; production always uses its fixed repository and pinned key. */
internal data class CoordinatorVerificationEnvironment(val store: GameResourceStore, val publicKey: ByteArray,
    val http: PublicReleaseHttp, val network: () -> UpdateNetwork, val dynamicStore: GameResourceStore? = null)

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
    @Volatile private var dynamicOffer: ResourceOffer? = null
    private val attempted = HashSet<String>()
    private val runtime by lazy { ResourceRuntime.get(app) }
    private val resourceStore by lazy { verification?.store ?: runtime.store }
    private val resourceClient by lazy { ResourceCatalogClient(verification?.publicKey ?: runtime.publicKey, http) }
    // Existing v1-only verification owners cannot touch the production dynamic store.
    private val dynamicStore by lazy { if (verification == null) runtime.dynamicStore else verification.dynamicStore }
    private val dynamicClient by lazy { ResourceCatalogClient(verification?.publicKey ?: runtime.publicKey, http, policy = ResourceStorePolicy.DYNAMIC) }
    private fun storeFor(policy: ResourceStorePolicy) = if (policy == ResourceStorePolicy.BUILTIN) resourceStore else requireNotNull(dynamicStore)
    private fun policyFor(id: String) = if (DynamicGamePolicy.validId(id)) ResourceStorePolicy.DYNAMIC else ResourceStorePolicy.BUILTIN
    private val apkManager = ApkUpdateManager(app)
    private val metadataCache by lazy { UpdateMetadataCache(AndroidResourceStateFile(File(app.filesDir, "apk-reminder.json")),
        AndroidResourceStateFile(File(app.filesDir, "resources-reminder.json"))) }
    private val dynamicMetadataCache by lazy { UpdateMetadataCache(AndroidResourceStateFile(File(app.filesDir, "apk-reminder.json")),
        AndroidResourceStateFile(File(app.filesDir, "dynamic-reminder.json"))) }
    init {
        gate.settings(state.automatic, state.metered)
        // Only this process owner cleans abandoned private parts, before any worker can download.
        worker.execute {
            val directory = File(app.cacheDir, "resource-updates")
            directory.listFiles()?.filter { Regex("resource-[a-z][a-z0-9-]{0,31}-[0-9a-f-]{36}\\.part").matches(it.name) && it.canonicalFile.parentFile == directory.canonicalFile }?.forEach { it.delete() }
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
            resourceStatus = if (it.resourcesCheckedAt == null) "游戏未检查：离线" else it.resourceStatus,
            dynamicStatus = if (it.dynamicCheckedAt == null) "新游戏目录未检查：离线" else it.dynamicStatus) }
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
                checkResourceChannel(ResourceStorePolicy.BUILTIN)
                if (dynamicStore != null) checkResourceChannel(ResourceStorePolicy.DYNAMIC)
            } finally {
                synchronized(stateLock) { gate.endCheck(); publish(::idleStatus) }
                automaticNext()
            }
        }
        true
    }
    private fun resourceStatus(policy: ResourceStorePolicy, message: String) {
        publish { if (policy == ResourceStorePolicy.BUILTIN) it.copy(resourceStatus = message) else it.copy(dynamicStatus = message) }
    }
    private fun checkResourceChannel(policy: ResourceStorePolicy) {
        val channel = policy.updateChannel
        if (checkCancelled || !foreground || !gate.channelAllowed(channel)) {
            if (foreground) resourceStatus(policy, if(checkCancelled) "游戏检查已取消，已安装资源保留" else "游戏查询限流，稍后可重试")
            return
        }
        try {
            val store=storeFor(policy)
            val next=(if(policy==ResourceStorePolicy.BUILTIN) resourceClient else dynamicClient).query {checkCancelled || !foreground}
            check(!checkCancelled && foreground) {"检查已取消"}
            store.acceptCatalog(next.envelope);store.refreshReadyProof(next.envelope)
            val available=next.catalog.games.filter {store.isEligible(it)}
            val checkedAt=System.currentTimeMillis()
            val saved=runCatching {(if(policy==ResourceStorePolicy.BUILTIN) metadataCache else dynamicMetadataCache).saveResources(next.catalog,checkedAt)}.isSuccess
            readLocalResources()
            synchronized(stateLock) {
                val ids=next.catalog.games.map {it.id}.toSet()
                attempted.removeAll {it.substringBefore('/') in ids}
                val status=if(policy==ResourceStorePolicy.BUILTIN) {
                    if(available.isEmpty()) "没有可安装的游戏更新" else "${available.size} 个游戏有更新"
                } else {
                    val fresh=available.count {!store.installed(it.id)}
                    val pending=next.catalog.games.count {it.available && !store.installed(it.id)}
                    "发现 $pending 个目录游戏（$fresh 个可安装），${available.size-fresh} 个已装游戏有更新"
                } + if(saved) "" else "；历史提醒保存失败"
                if(policy==ResourceStorePolicy.BUILTIN) {
                    offer=next
                    publish {it.copy(resources=available,catalogGames=next.catalog.games,resourcesRemembered=false,resourcesCheckedAt=checkedAt,resourceStatus=status)}
                } else {
                    dynamicOffer=next
                    publish {it.copy(dynamicResources=available,dynamicCatalogGames=next.catalog.games,dynamicRemembered=false,dynamicCheckedAt=checkedAt,dynamicStatus=status)}
                }
            }
        } catch(error:Exception) {channelFailure(channel,error)}
    }
    private fun channelFailure(channel: String, error: Exception) {
        var message = error.message ?: "查询失败，已安装内容仍可使用"
        if (error is UpdateRateLimited) {
            try { gate.rateLimited(channel, error.until) } catch (saveError: Exception) { message += "；${saveError.message}" }
        }
        publish { when(channel) {"apk" -> it.copy(apkStatus=message);"resources" -> it.copy(resourceStatus=message);else -> it.copy(dynamicStatus=message)} }
    }
    private fun automaticNext() {
        synchronized(stateLock) {
            for(policy in ResourceStorePolicy.entries) {
                if(!gate.canAutoDownload(policy.updateChannel)) continue
                val current=(if(policy==ResourceStorePolicy.BUILTIN) offer else dynamicOffer) ?: continue
                val candidates=if(policy==ResourceStorePolicy.BUILTIN) state.resources else state.dynamicResources
                val game=candidates.firstOrNull {"${it.id}/${it.identity}" !in attempted &&
                    storeFor(policy).isEligible(it) &&
                    (policy==ResourceStorePolicy.BUILTIN || storeFor(policy).installed(it.id))} ?: continue
                startResource(current,game,false,false);return
            }
        }
    }
    fun downloadResource(id: String, meteredConfirmed: Boolean): Boolean = synchronized(stateLock) {
        val policy=policyFor(id)
        val current = (if(policy==ResourceStorePolicy.BUILTIN) offer else dynamicOffer) ?: return false
        val game = (if(policy==ResourceStorePolicy.BUILTIN) state.resources else state.dynamicResources).singleOrNull { it.id == id } ?: return false
        startResource(current, game, true, meteredConfirmed)
    }
    private fun startResource(current: ResourceOffer, game: ResourceGame, manual: Boolean, meteredConfirmed: Boolean): Boolean {
        val token = try {
            require(storeFor(current.policy).isEligible(game)) {"本地资源授权已改变，请重新检查"}
            current.reserveDownload(game, gate, manual, meteredConfirmed)
        }
        catch (error: Exception) { resourceStatus(current.policy,"${error.message}；请重新检查更新"); return false }
        if (token == null) return false
        attempted.add("${game.id}/${game.identity}")
        val displayName=if(current.policy==ResourceStorePolicy.DYNAMIC)game.displayName else game.id
        publish { it.copy(busy = true, task = "下载 $displayName", done = 0, total = game.archiveBytes) }
        worker.execute {
            var archive: File? = null
            try {
                current.requireDownload(game)
                val client=if(current.policy==ResourceStorePolicy.BUILTIN) resourceClient else dynamicClient
                archive = client.download(game, File(app.cacheDir, "resource-updates"), { !gate.valid(token) }, progressReporter())
                check(gate.valid(token)) { "更新已取消" }
                storeFor(current.policy).install(game, current.envelope, archive, { !gate.valid(token) })
                readLocalResources()
                publish { if(current.policy==ResourceStorePolicy.BUILTIN) it.copy(resources=it.resources.filterNot {candidate->candidate.id==game.id},resourceStatus="${game.id} 更新已就绪，下次进入生效")
                    else it.copy(dynamicResources=it.dynamicResources.filterNot {candidate->candidate.id==game.id},dynamicStatus="${game.displayName} 资源已就绪，下次进入生效") }
            } catch (error: Exception) {
                if (token.cancelled) resourceStatus(current.policy,"游戏下载已取消，原版本保留") else channelFailure(current.policy.updateChannel, error)
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
                val failedStore = storeFor(policyFor(id))
                failedStore.quarantineFailedIdentity(id, identity)
                resourceStatus(policyFor(id),"$id 失败资源已隔离，请恢复版本；存档保留")
            } catch (error: Exception) { resourceStatus(policyFor(id),"失败资源隔离未提交：${error.message}；请恢复版本") }
            finally {
                readLocalResources()
                synchronized(stateLock) {
                    gate.finish(token);publish {refreshOffers(idleStatus(it))}
                }
                automaticNext()
            }
        }
    }
    fun changeLocal(id: String?, action: LocalResourceAction, retryCode: Int? = null): Boolean = synchronized(stateLock) {
        val global=action in setOf(LocalResourceAction.RECOVER_ALL,LocalResourceAction.RECOVER_DYNAMIC)
        require(!global || id==null)
        val policy=when(action) {LocalResourceAction.RECOVER_ALL -> ResourceStorePolicy.BUILTIN;LocalResourceAction.RECOVER_DYNAMIC -> ResourceStorePolicy.DYNAMIC;else -> policyFor(requireNotNull(id))}
        require(action in setOf(LocalResourceAction.RECOVER_ALL,LocalResourceAction.RECOVER_DYNAMIC) || id!=null && policy.validId(id))
        require(action!=LocalResourceAction.REMOVE || policy==ResourceStorePolicy.DYNAMIC)
        require(action != LocalResourceAction.RETRY || retryCode != null && retryCode > policy.baselineCode)
        val token = gate.beginLocalChange() ?: return false
        publish { it.copy(busy = true, task = "正在处理本地资源", done = 0, total = 0) }
        worker.execute {
            var changed = false
            try {
                require(gate.valid(token)) { "本地操作已取消，请回到大厅重试" }
                // Once the store starts its atomic transaction, cancellation cannot undo a committed choice.
                val store = storeFor(policy)
                when (action) {
                    LocalResourceAction.RECOVER_ALL,LocalResourceAction.RECOVER_DYNAMIC -> store.recoverAllBuiltinsFromTrustedHistory()
                    LocalResourceAction.REMOVE -> store.removeResources(id!!)
                    LocalResourceAction.RESTORE_PREVIOUS, LocalResourceAction.RESTORE_BUILTIN -> {
                        val code = store.selection(id!!).active.substringBefore('-').toIntOrNull()?.takeIf { it > policy.baselineCode }
                        store.restore(id, action == LocalResourceAction.RESTORE_BUILTIN, code)
                    }
                    LocalResourceAction.RESUME -> store.resumeAutomatic(id!!)
                    LocalResourceAction.RETRY -> store.resumeAutomatic(id!!, retryCode)
                }
                changed = true
                resourceStatus(policy,when (action) {
                    LocalResourceAction.RESTORE_PREVIOUS, LocalResourceAction.RESTORE_BUILTIN, LocalResourceAction.RECOVER_ALL -> "已恢复并固定资源；存档保留"
                    LocalResourceAction.RECOVER_DYNAMIC -> "已从可信历史恢复目录，需明确重试并手动重新安装；存档保留"
                    LocalResourceAction.REMOVE -> "游戏资源已移除；存档和历史水位保留，重装需手动选择"
                    LocalResourceAction.RESUME -> "已解除固定；失败编号仍隔离"
                    LocalResourceAction.RETRY -> "已允许重试指定编号；存档保留"
                })
            } catch (error: Exception) { resourceStatus(policy,"本地操作失败：${error.message}；存档保留") }
            finally {
                readLocalResources()
                synchronized(stateLock) {
                    if (changed && action == LocalResourceAction.RETRY) {
                        attempted.removeAll { it.startsWith("$id/$retryCode-") }
                    }
                    gate.finish(token)
                    publish {refreshOffers(idleStatus(it))}
                }
                automaticNext()
            }
        }
        true
    }
    private fun refreshOffers(value:UpdateSnapshot)=value.copy(
        resources=runCatching {offer?.catalog?.games?.filter {resourceStore.isEligible(it)} ?: emptyList()}.getOrDefault(emptyList()),
        dynamicResources=runCatching {dynamicOffer?.catalog?.games?.filter {storeFor(ResourceStorePolicy.DYNAMIC).isEligible(it)} ?: emptyList()}.getOrDefault(emptyList()))
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
        try {
            dynamicStore?.rememberedCatalog()?.let {catalog->
                val checkedAt=dynamicMetadataCache.readResources(catalog)
                val fresh=runCatching {catalog.requireFresh(System.currentTimeMillis())}.isSuccess
                publish {it.copy(dynamicCatalogGames=catalog.games,dynamicResources=emptyList(),dynamicCheckedAt=checkedAt,dynamicRemembered=true,
                    dynamicStatus=if(fresh) "上次验证的新游戏目录，待检查" else "上次新游戏目录已过期，请检查")}
            }
        } catch(error:Exception) {publish {it.copy(dynamicStatus="新游戏历史提醒不可用，请联网检查；本地存档保留")}}
    }
    private fun readLocalResources() {
        try {
            val current = resourceStore.describeAll(); val diagnostic = resourceStore.failure()
            publish { it.copy(localResources = current, localDiagnostic = diagnostic, localReadError = null) }
        }
        catch (error: Exception) { publish { it.copy(localResources = emptyMap(), localReadError = error.message ?: "读取失败", resourceStatus = "本地资源状态不可用：${error.message}；存档保留") } }
        try {
            val current=dynamicStore?.describeAll() ?: emptyMap();val diagnostic=dynamicStore?.failure()
            publish {it.copy(localDynamicResources=current,dynamicDiagnostic=diagnostic,dynamicReadError=null,localLoaded=true)}
        } catch(error:Exception) {publish {it.copy(localDynamicResources=emptyMap(),dynamicReadError=error.message ?: "读取失败",localLoaded=true,dynamicStatus="动态资源状态不可用：${error.message}；存档保留")}}
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
