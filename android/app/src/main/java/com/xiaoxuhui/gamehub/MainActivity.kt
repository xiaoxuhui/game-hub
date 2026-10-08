package com.xiaoxuhui.gamehub

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.View
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.JsResult
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.CheckBox
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.lifecycle.ViewModelProvider
import org.json.JSONObject
import java.io.File

class MainActivity : ComponentActivity() {
    private data class Game(val id: String, val name: String, val version: String, val revision: String, val entry: String)

    private lateinit var root: FrameLayout
    private lateinit var lobby: ScrollView
    private lateinit var updateLink: TextView
    private lateinit var updateSummary: TextView
    private val updates by lazy { UpdateCoordinator.get(applicationContext) }
    @Volatile private var activityStarted = false
    private val updateDialogs = mutableSetOf<AlertDialog>()
    private val gameDialogs = mutableSetOf<AlertDialog>()
    private val gameVersionLabels = mutableMapOf<String, TextView>()
    private val gameCards = mutableMapOf<String, View>()
    private val hostVersionCode by lazy { packageManager.getPackageInfo(packageName, 0).let { if (Build.VERSION.SDK_INT >= 28) it.longVersionCode.toInt() else it.versionCode } }
    private val updateListener: (UpdateSnapshot) -> Unit = { state -> renderUpdates(state) }
    private val updateManager by lazy { ApkUpdateManager(this) }
    private var pendingInstallApk: File? = null
    private var webView: WebView? = null
    private var overlay: View? = null
    private var currentGame: Game? = null
    private var loadFailed = false
    private var games: List<Game> = emptyList()
    private var assetPaths: Set<String> = emptySet()
    private var bundleCommit = ""
    private var resourceRuntime: ResourceRuntime? = null
    private var resourceSession: ResourceSession? = null
    private var gameResolver: GameContentResolver? = null
    @Volatile private var navigationSerial = 0L
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val exports by lazy { ViewModelProvider(this)[DocumentExportFlow::class.java] }
    private val pendingExport get() = exports.pending
    private val fileChooserLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        filePathCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
        filePathCallback = null
        refreshUpdatePresence()
    }
    private val saveLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uri = if (result.resultCode == Activity.RESULT_OK) result.data?.data else null
        exports.finish(uri)
        refreshUpdatePresence()
    }
    private val installSourcesLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        val apk = pendingInstallApk
        if (apk != null && apk.exists() && (Build.VERSION.SDK_INT < 26 || packageManager.canRequestPackageInstalls())) {
            openSystemInstaller(apk)
        } else {
            pendingInstallApk = null
            discardInstallFile(apk)
            updateLink.isEnabled = true
            updateLink.text = "检查更新"
            toast("未授权安装，更新已取消")
        }
        refreshUpdatePresence()
    }
    private val installerLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        discardInstallFile(pendingInstallApk)
        pendingInstallApk = null
        updateLink.isEnabled = true
        updateLink.text = "检查更新"
        if (result.resultCode != Activity.RESULT_OK) toast("安装未完成，下载缓存已清理")
        refreshUpdatePresence()
    }
    private val accents = mapOf(
        "conway" to 0xFF6EE7B7.toInt(),
        "eml" to 0xFFF8C56A.toInt(),
        "light" to 0xFF8AB7FF.toInt(),
        "turing" to 0xFFD3A3FF.toInt()
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = FrameLayout(this).apply { setBackgroundColor(BACKGROUND) }
        setContentView(root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            view.updatePadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        try {
            loadBundleManifest()
            lobby = buildLobby()
            root.addView(lobby, FrameLayout.LayoutParams(-1, -1))
            restorePendingInstall(savedInstanceState)
            cleanStaleUpdateFiles()
            val restoreId = savedInstanceState?.getString(STATE_GAME)
            if (restoreId != null) {
                games.firstOrNull { it.id == restoreId }?.let { openGame(it, savedInstanceState) }
            }
        } catch (error: Exception) {
            showFatal("内置资源清单不可用：${error.message ?: "未知错误"}")
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val view = webView
                if (view == null && currentGame != null) { showLobby(); return }
                if (view != null) {
                    if (view.canGoBack()) view.goBack() else showLobby()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    override fun onStart() {
        super.onStart()
        activityStarted = true
        exports.attach { exports.consumeResult()?.let { toast(it) }; refreshUpdatePresence() }
        if (::updateSummary.isInitialized) {
            updates.subscribe(updateListener)
            refreshUpdatePresence()
        }
    }

    override fun onStop() {
        activityStarted = false
        exports.detach()
        gameDialogs.toList().forEach { it.dismiss() }
        updateDialogs.toList().forEach { it.dismiss() }
        updateDialogs.clear()
        if (::updateSummary.isInitialized) {
            updates.unsubscribe(updateListener)
            if (!isChangingConfigurations) updates.presence(false, currentGame == null, false)
        }
        super.onStop()
    }

    private fun refreshUpdatePresence() {
        if (::updateSummary.isInitialized) updates.presence(activityStarted, currentGame == null,
            pendingInstallApk == null && filePathCallback == null && !exports.busy)
    }

    private fun trackConfirmation(dialog: AlertDialog): AlertDialog {
        updateDialogs.add(dialog)
        dialog.setOnDismissListener { updateDialogs.remove(dialog) }
        return dialog.apply { show() }
    }

    private fun loadBundleManifest() {
        val raw = assets.open("bundle-manifest.json").bufferedReader().use { it.readText() }
        val manifest = JSONObject(raw)
        bundleCommit = manifest.getString("bundleCommit")
        val sources = manifest.getJSONArray("sources")
        val files = manifest.getJSONArray("files")
        if (sources.length() != 4 || files.length() == 0) error("来源或资源数量错误")
        games = (0 until sources.length()).map { index ->
            val item = sources.getJSONObject(index)
            require(item.getInt("contentCode") == 1 && item.getInt("resourceProtocol") == 1 && item.getString("storageContract") == ResourcePolicy.contract(item.getString("id"))) { "内置资源合同不匹配" }
            Game(item.getString("id"), item.getString("displayName"), item.getString("version"), item.getString("revision"), item.getString("entryPage"))
        }
        if (games.map { it.id }.toSet() != setOf("conway", "eml", "light", "turing")) error("项目清单不完整")
        assetPaths = (0 until files.length()).map { index ->
            "/assets/${files.getJSONObject(index).getString("path")}"
        }.toSet()
        for (game in games) {
            if (!assetPaths.contains("/assets/games/${game.id}/${game.entry}")) error("${game.name} 入口缺失")
        }
    }

    private fun buildLobby(): ScrollView {
        val scroll = ScrollView(this).apply { isFillViewport = true; isVerticalScrollBarEnabled = false }
        val cardMinDp = 192 + ((resources.configuration.fontScale - 1f).coerceAtLeast(0f) * 160).toInt()
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val side = if (resources.configuration.screenWidthDp >= 600) dp(48) else dp(14)
            setPadding(side, dp(16), side, dp(12))
        }
        scroll.addView(column, FrameLayout.LayoutParams(-1, -2))
        column.addView(label("游戏大厅", 27f, Color.WHITE, true).apply {
            setPadding(dp(6), 0, 0, dp(2))
        })
        val headerRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        column.addView(headerRow, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(10) })
        headerRow.addView(label("合集 v${installedVersionName()}", 11f, MUTED, false).apply {
            setPadding(dp(6), 0, 0, 0)
        }, LinearLayout.LayoutParams(0, -2, 1f))
        updateLink = label("检查更新", 13f, 0xFF8AB7FF.toInt(), true).apply {
            setPadding(dp(8), dp(4), dp(6), dp(4))
            isClickable = true
            isFocusable = true
            setOnClickListener { checkUpdates() }
        }
        headerRow.addView(updateLink)
        updateSummary = label("更新尚未检查 · 点击查看", 11f, MUTED, false).apply {
            setPadding(dp(6), dp(3), dp(6), dp(6))
            maxLines = 2
            isClickable = true; isFocusable = true
            setOnClickListener { showUpdateDetails() }
        }
        column.addView(updateSummary, LinearLayout.LayoutParams(-1, -2))
        for (rowIndex in 0..1) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                minimumHeight = dp(cardMinDp + 8)
            }
            column.addView(row, LinearLayout.LayoutParams(-1, 0, 1f))
            for (columnIndex in 0..1) {
                val game = games[rowIndex * 2 + columnIndex]
                val accent = accents[game.id] ?: Color.WHITE
                val card = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    gravity = Gravity.CENTER
                    minimumHeight = dp(cardMinDp)
                    setPadding(dp(8), dp(12), dp(8), dp(12))
                    background = rounded(0xFF1B2330.toInt(), dp(16)).apply { setStroke(dp(1), accent) }
                    contentDescription = "${game.name}，本地资源核验中，打开"
                    isClickable = true
                    isFocusable = true
                    setOnClickListener { openGame(game) }
                }
                row.addView(card, LinearLayout.LayoutParams(0, -1, 1f).apply { setMargins(dp(4), dp(4), dp(4), dp(4)) })
                gameCards[game.id] = card
                card.addView(ImageView(this).apply {
                    setImageResource(iconFor(game.id))
                    scaleType = ImageView.ScaleType.CENTER_CROP
                    background = rounded(BACKGROUND, dp(17))
                    clipToOutline = true
                    contentDescription = null
                }, LinearLayout.LayoutParams(dp(76), dp(76)))
                card.addView(label(game.name, 17f, Color.WHITE, true).apply {
                    gravity = Gravity.CENTER
                    maxLines = 2
                    setPadding(0, dp(9), 0, 0)
                })
                card.addView(label("本地资源核验中", 9.5f, MUTED, false).apply {
                    gameVersionLabels[game.id] = this
                    gravity = Gravity.CENTER
                    setPadding(0, dp(4), 0, 0)
                })
            }
        }
        return scroll
    }

    private fun iconFor(id: String) = when (id) {
        "conway" -> R.drawable.game_conway
        "eml" -> R.drawable.game_eml
        "light" -> R.drawable.game_light
        "turing" -> R.drawable.game_turing
        else -> error("未知项目：$id")
    }

    private fun checkUpdates() {
        if (!updates.check(true)) toast("已有任务正在进行，或网络不可用")
        showUpdateDetails()
    }

    private fun renderUpdates(state: UpdateSnapshot) {
        if (!activityStarted || isDestroyed || !::updateSummary.isInitialized) return
        updateLink.isEnabled = pendingInstallApk == null
        updateLink.text = if (state.busy) "更新详情" else "检查更新"
        updateSummary.text = if (state.task != null) {
            "${state.task} · ${if (state.total > 0) "${state.done * 100 / state.total}%" else "查询中"} · 点击查看"
        } else "${state.apkStatus}\n${state.resourceStatus} · 点击查看"
        updateSummary.contentDescription = "更新状态：${state.apkStatus}；${state.resourceStatus}；点击查看详情"
        for (game in games) {
            val local = state.localResources[game.id]
            val actual = when {
                local == null -> if (state.localReadError != null || state.localLoaded) "本地状态不可用 · 待恢复" else "本地资源核验中"
                local.selection.active == "builtin" -> "v${game.version} · 内置"
                local.active != null -> "v${local.active.version} · 已下载"
                else -> "资源校验失败 · 待恢复"
            }
            val remote = state.catalogGames.singleOrNull { it.id == game.id }
            val code = local?.selection?.active?.substringBefore('-')?.toIntOrNull() ?: 1
            val marker = when {
                local == null -> null
                local.selection.active.substringBefore('-').toIntOrNull() in local.selection.quarantine -> "失败已隔离 · 待恢复"
                local?.readyError != null -> "候选损坏，旧版保留"
                local?.ready != null && !local.readyFresh -> "候选已过期，请检查"
                local?.ready != null -> "#${local.ready.contentCode} 待生效"
                remote != null && remote.contentCode > code && !remote.compatible(hostVersionCode, ResourcePolicy.contract(game.id)) -> "更新与此大厅不兼容"
                remote != null && remote.contentCode > code && state.resourcesRemembered -> if (local.selection.pinned) "固定版本 · 上次发现更新 · 待检查" else "上次发现更新 · 待检查"
                remote != null && remote.contentCode > code -> if (local?.selection?.pinned == true) "有更新 · 固定版本" else "#${remote.contentCode} 可更新"
                local?.selection?.pinned == true -> "固定版本"
                else -> null
            }
            gameVersionLabels[game.id]?.text = actual + (marker?.let { "\n$it" } ?: "")
            gameCards[game.id]?.contentDescription = "${game.name}，$actual，${marker ?: "打开"}"
        }
    }

    private fun checkedTime(value: Long?): String = value?.let {
        java.text.SimpleDateFormat("MM-dd HH:mm", java.util.Locale.CHINA).format(java.util.Date(it))
    } ?: "尚无成功检查"

    private fun showUpdateDetails() {
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(8), dp(18), dp(8))
        }
        val scroll = ScrollView(this).apply { addView(content) }
        val dialog = AlertDialog.Builder(this).setTitle("更新与资源管理").setView(scroll)
            .setPositiveButton("关闭", null).create()
        val detailListener: (UpdateSnapshot) -> Unit = { state ->
            if (!isDestroyed && dialog.isShowing) renderUpdateDetails(content, state, dialog)
        }
        dialog.setOnDismissListener { updates.unsubscribe(detailListener); updateDialogs.remove(dialog) }
        updateDialogs.add(dialog)
        dialog.show()
        renderUpdateDetails(content, updates.snapshot(), dialog)
        updates.subscribe(detailListener)
    }

    private fun detailButton(column: LinearLayout, title: String, enabled: Boolean = true, action: () -> Unit) {
        column.addView(Button(this).apply {
            text = title; isAllCaps = false; isEnabled = enabled
            setOnClickListener { action() }
        }, LinearLayout.LayoutParams(-1, -2))
    }

    private fun renderUpdateDetails(column: LinearLayout, state: UpdateSnapshot, dialog: AlertDialog) {
        val previous = column.tag as? UpdateSnapshot
        column.tag = state
        if (previous?.copy(done = 0) == state.copy(done = 0)) {
            column.findViewWithTag<TextView>("update-progress")?.text = "${state.task}：${state.done / 1024} / ${state.total / 1024} KiB"
            return
        }
        column.removeAllViews()
        fun description(text: String) { column.addView(label(text, 13f, Color.WHITE, false).apply { setPadding(0, dp(8), 0, dp(4)) }) }
        description("大厅：${state.apkStatus}\n最后成功检查：${checkedTime(state.apkCheckedAt)}")
        description("游戏：${state.resourceStatus}\n最后成功检查：${checkedTime(state.resourcesCheckedAt)}")
        state.localDiagnostic?.let { description("本地资源诊断：$it；存档未删除") }
        state.localReadError?.let { description("本地资源读取失败：$it；存档未删除") }
        if (state.localResources.values.any { it.stateError != null }) detailButton(column, "全局可信恢复内置资源", !state.busy) {
            confirmLocalChange(null, LocalResourceAction.RECOVER_ALL)
        }
        if (state.task != null) {
            column.addView(label("${state.task}：${state.done / 1024} / ${state.total / 1024} KiB", 13f, Color.WHITE, false).apply { tag = "update-progress" })
            detailButton(column, "取消本次下载", state.total > 0) { updates.cancel() }
        }
        detailButton(column, "立即检查", !state.busy) { if (!updates.check(true)) toast("当前无可用网络或任务尚未结束") }
        val apk = state.readyApk?.takeIf { it.isFile }
        if (apk != null) detailButton(column, "安装已验证的大厅 APK", !state.busy && pendingInstallApk == null) {
            dialog.dismiss()
            trackConfirmation(AlertDialog.Builder(this).setTitle("安装大厅更新")
                .setMessage("安装包的摘要、包名、版本及签名已验证。继续将打开 Android 系统安装界面。")
                .setPositiveButton("继续安装") { _, _ ->
                    if (activityStarted && !isDestroyed && updates.snapshot().readyApk == apk && apk.isFile) requestSystemInstall(apk)
                }
                .setNegativeButton("稍后", null).create())
        } else state.apk?.let { release ->
            if (state.apkRemembered) description("上次发现大厅 v${release.version}；请先重新检查后下载")
            else detailButton(column, "下载大厅 v${release.version}（${release.size / 1024} KiB）", !state.busy) {
                confirmDownload { allowed -> if (!updates.downloadApk(allowed)) toast("下载未开始，请检查网络或等待当前任务结束") }
            }
        }
        for (game in games) {
            val local = state.localResources[game.id]
            if (local == null) description("${game.name}：" + if (state.localReadError != null || state.localLoaded) "本地状态不可用，待恢复" else "本地资源核验中")
            if (local != null) {
                val active = local.active
                description("${game.name} · 实际版本：" + when {
                    local.selection.active == "builtin" -> "内置 v${game.version} / 资源 #1\n来源 ${game.revision}"
                    active != null -> "已下载 v${active.version} / 资源 #${active.contentCode}\n来源 ${active.sourceRevision}"
                    else -> "校验失败，尚未恢复"
                })
                local.ready?.let { description("候选：v${it.version} / 资源 #${it.contentCode}" + if (local.readyFresh) "（下次进入，校验通过后生效）" else "（目录已过期，暂不生效，请检查更新）") }
                local.activeError?.let { description("当前资源错误：$it；存档未删除") }
                local.readyError?.let { description("候选资源错误：$it；旧版本保留") }
                local.stateError?.let { description("状态异常：$it") }
                if (local.selection.pinned) description("当前固定版本；自动检查不会改变选择")
                if (local.selection.quarantine.isNotEmpty()) description("已隔离失败编号：${local.selection.quarantine.sorted().joinToString()}")
                if (local.stateError == null) {
                    if (local.selection.previous != local.selection.active) detailButton(column, "恢复${game.name}上个版本并固定", !state.busy) { confirmLocalChange(game.id, LocalResourceAction.RESTORE_PREVIOUS) }
                    if (local.selection.active != "builtin" || local.selection.ready != null) detailButton(column, "恢复${game.name}内置版本并固定", !state.busy) { confirmLocalChange(game.id, LocalResourceAction.RESTORE_BUILTIN) }
                    if (local.selection.pinned) detailButton(column, "解除${game.name}版本固定", !state.busy) { confirmLocalChange(game.id, LocalResourceAction.RESUME) }
                    local.selection.quarantine.sorted().forEach { code -> detailButton(column, "明确重试${game.name}资源 #$code", !state.busy) { confirmLocalChange(game.id, LocalResourceAction.RETRY, code) } }
                }
            }
            val remote = state.catalogGames.singleOrNull { it.id == game.id }
            if (remote != null) {
                description("${game.name} · 远端 v${remote.version} / 资源 #${remote.contentCode}\n${remote.archiveBytes / 1024} KiB · 来源 ${remote.sourceRevision.take(10)}\n${remote.notes}")
                if (!remote.compatible(hostVersionCode, ResourcePolicy.contract(game.id))) description("不兼容：需要大厅资源协议/存档合同一致，版本编号位于 ${remote.minHost}–${remote.maxHost}；当前大厅编号 $hostVersionCode")
                if (state.resources.any { it.id == game.id }) detailButton(column, "下载${game.name}更新", !state.busy) {
                    confirmDownload { allowed -> if (!updates.downloadResource(game.id, allowed)) toast("下载未开始，请检查网络或重新查询") }
                }
            }
        }
        column.addView(CheckBox(this).apply {
            text = "自动更新子游戏（默认仅非计费 Wi-Fi）"; setTextColor(Color.WHITE); isChecked = state.automatic
            isEnabled = !state.settingsSaving
            setOnCheckedChangeListener { _, checked -> if (!updates.settings(checked, state.metered)) toast("设置未保存，请重试") }
        })
        column.addView(CheckBox(this).apply {
            text = "允许计费网络自动下载（可能产生流量费用）"; setTextColor(Color.WHITE); isChecked = state.metered
            isEnabled = !state.settingsSaving
            setOnCheckedChangeListener { _, checked -> if (!updates.settings(state.automatic, checked)) toast("设置未保存，请重试") }
        })
        state.settingsStatus?.let { description(it) }
    }

    private fun confirmDownload(action: (Boolean) -> Unit) {
        if (!activityStarted || isDestroyed) return
        if (updates.unmeteredWifi()) { action(false); return }
        trackConfirmation(AlertDialog.Builder(this).setTitle("确认本次使用计费网络")
            .setMessage("当前不是非计费 Wi-Fi。仅允许本次下载使用移动或计费网络，不更改自动更新设置。")
            .setPositiveButton("允许本次下载") { _, _ -> if (activityStarted && !isDestroyed) action(true) }
            .setNegativeButton("取消", null).create())
    }

    private fun requestSystemInstall(apk: File) {
        if (Build.VERSION.SDK_INT >= 26 && !packageManager.canRequestPackageInstalls()) {
            pendingInstallApk = apk
            refreshUpdatePresence()
            updateLink.isEnabled = false
            updateLink.text = "安装处理中…"
            val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName"))
            runCatching { installSourcesLauncher.launch(intent) }
                .onFailure {
                    pendingInstallApk = null
                    discardInstallFile(apk)
                    updateLink.isEnabled = true
                    updateLink.text = "检查更新"
                    toast("无法打开安装授权设置")
                    refreshUpdatePresence()
                }
        } else {
            openSystemInstaller(apk)
        }
    }

    private fun confirmLocalChange(id: String?, action: LocalResourceAction, retryCode: Int? = null) {
        val message = when (action) {
            LocalResourceAction.RECOVER_ALL -> "仅使用完整可信签名历史恢复四个内置版本并固定，保留最高更新编号。无法验证历史时不会重置。游戏存档保留。"
            LocalResourceAction.RESTORE_PREVIOUS, LocalResourceAction.RESTORE_BUILTIN -> "恢复资源后固定该游戏版本，隔离当前下载版本。游戏存档保留，但不会回到过去；下一次进入使用恢复版本。"
            LocalResourceAction.RESUME -> "解除固定后允许自动更新；此前失败编号继续隔离，需另行明确重试。游戏存档保留。"
            LocalResourceAction.RETRY -> "解除资源 #$retryCode 的隔离并解除固定。签名目录仍提供该编号且兼容时，允许重新尝试；更新继续遵守网络设置。游戏存档保留。"
        }
        trackConfirmation(AlertDialog.Builder(this).setTitle("资源恢复与更新设置").setMessage(message)
            .setPositiveButton("确认") { _, _ ->
                if (activityStarted && !isDestroyed && currentGame == null && pendingInstallApk == null && filePathCallback == null && !exports.busy) {
                    if (!updates.changeLocal(id, action, retryCode)) toast("请等待当前任务结束后重试")
                }
            }.setNegativeButton("取消", null).create())
    }

    private fun openSystemInstaller(apk: File) {
        pendingInstallApk = apk
        refreshUpdatePresence()
        updateLink.isEnabled = false
        updateLink.text = "安装处理中…"
        runCatching { installerLauncher.launch(updateManager.installationIntent(apk)) }
            .onFailure {
                pendingInstallApk = null
                discardInstallFile(apk)
                updateLink.isEnabled = true
                updateLink.text = "检查更新"
                toast("无法打开系统安装界面")
                refreshUpdatePresence()
            }
    }

    private fun restorePendingInstall(state: Bundle?) {
        val name = state?.getString(STATE_PENDING_INSTALL) ?: return
        if (!Regex("^game-hub-[0-9]+-[0-9a-f-]{36}\\.apk$").matches(name)) return
        val file = File(File(cacheDir, "updates"), name)
        if (!file.isFile) return
        pendingInstallApk = file
        updateLink.isEnabled = false
        updateLink.text = "安装处理中…"
    }

    private fun cleanStaleUpdateFiles() {
        val cutoff = System.currentTimeMillis() - 24L * 60 * 60 * 1000
        File(cacheDir, "updates").listFiles()?.forEach { file ->
            if (file.isFile && file != pendingInstallApk && file != updates.snapshot().readyApk && file.lastModified() < cutoff) file.delete()
        }
    }

    private fun discardInstallFile(file: File?) {
        if (file != null) { file.delete(); updates.forgetApk(file) }
    }

    private fun openGame(game: Game, restoredState: Bundle? = null) {
        val serial = ++navigationSerial
        updates.presence(activityStarted, false, false)
        clearWebView()
        currentGame = game
        showLoading("正在校验${game.name}资源…")
        Thread {
            val prepared = runCatching {
                ResourceRuntime.get(this).also { resourceRuntime = it }.let { it to (assetPaths + it.store.knownResourcePaths()) }
            }
            runOnUiThread {
                if (isDestroyed || serial != navigationSerial) return@runOnUiThread
                prepared.onFailure { showError("资源状态不可用：${it.message}") }.onSuccess { (runtime, paths) ->
                    runtime.prepareWorkerInterceptor()
                    ResourceCacheGuard.inspectAndClear(this, paths) { assessment ->
                        if (isDestroyed || serial != navigationSerial) return@inspectAndClear
                        if (!assessment.canPlay) { showError(assessment.reason); return@inspectAndClear }
                        Thread {
                            val selected = runCatching { runtime.store.openSession(game.id, assessment.canActivate) }
                            val failedIdentity = if (selected.isFailure) runtime.store.selection(game.id).active.takeIf { it != "builtin" } else null
                            runOnUiThread selectedUi@{
                                if (isDestroyed || serial != navigationSerial) { selected.getOrNull()?.close(); return@selectedUi }
                                selected.onFailure { showError("资源校验失败：${it.message}", failedIdentity) }.onSuccess selectedSession@{ session ->
                                    openGamePrepared(game, restoredState, session, runtime)
                                }
                            }
                        }.start()
                    }
                }
            }
        }.start()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun openGamePrepared(game: Game, restoredState: Bundle?, session: ResourceSession, runtime: ResourceRuntime) {
        clearWebView()
        resourceSession = session
        val resolver = GameContentResolver(assets, game.id, session, assetPaths)
        gameResolver = resolver
        runtime.bind(resolver)
        currentGame = game
        loadFailed = false
        lobby.visibility = View.GONE
        val view = WebView(this).apply {
            setBackgroundColor(BACKGROUND)
            overScrollMode = View.OVER_SCROLL_NEVER
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = false
                allowContentAccess = false
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
                javaScriptCanOpenWindowsAutomatically = false
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                blockNetworkLoads = true
                textZoom = 100
                cacheMode = WebSettings.LOAD_NO_CACHE
            }
            clearCache(true)
            webViewClient = gameClient(game, resolver)
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView,
                    filePathCallback: ValueCallback<Array<Uri>>,
                    fileChooserParams: FileChooserParams
                ): Boolean {
                    if (webView !== this@MainActivity.webView || !activityStarted || loadFailed || exports.busy ||
                        pendingInstallApk != null || this@MainActivity.filePathCallback != null) {
                        filePathCallback.onReceiveValue(null)
                        return true
                    }
                    this@MainActivity.filePathCallback = filePathCallback
                    refreshUpdatePresence()
                    return try {
                        fileChooserLauncher.launch(fileChooserParams.createIntent())
                        true
                    } catch (error: Exception) {
                        this@MainActivity.filePathCallback = null
                        filePathCallback.onReceiveValue(null)
                        refreshUpdatePresence()
                        toast("无法打开文件选择器")
                        false
                    }
                }

                override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult): Boolean {
                    if (view !== webView || loadFailed || !activityStarted) { result.cancel(); return true }
                    var completed = false
                    val dialog = AlertDialog.Builder(this@MainActivity)
                        .setMessage(message)
                        .setPositiveButton("确定") { _, _ -> completed = true; if (view === webView && !loadFailed && activityStarted) result.confirm() else result.cancel() }
                        .setNegativeButton("取消") { _, _ -> completed = true; result.cancel() }.create()
                    gameDialogs.add(dialog)
                    dialog.setOnDismissListener { gameDialogs.remove(dialog); if (!completed) result.cancel() }
                    dialog.show()
                    return true
                }
            }
            addJavascriptInterface(SaveBridge(), bridgeName(game.id))
        }
        webView = view
        root.addView(view, FrameLayout.LayoutParams(-1, -1))
        showLoading("正在打开${game.name}…")
        val restored = if (restoredState != null) view.restoreState(restoredState) else null
        if (restored == null) view.loadUrl(gameUrl(game))
    }

    private fun gameClient(game: Game, resolver: GameContentResolver): WebViewClient = object : WebViewClient() {
        override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
            if (view === webView && AssetAccessPolicy.pageAllowed(game.id, Uri.parse(url).path, resolver.allowedPaths)) {
                loadFailed = false
                showLoading("正在打开${game.name}…")
            }
        }

        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse {
            val uri = request.url
            return resolver.response(uri)
        }

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            if (view !== webView || currentGame?.id != game.id || loadFailed) return true
            if (!request.isForMainFrame) return !resolver.allowed(request.url)
            val uri = request.url
            val path = uri.path ?: ""
            val ownPage = resolver.allowed(uri) && AssetAccessPolicy.pageAllowed(game.id, path, resolver.allowedPaths)
            if (ownPage) return false
            if (uri.scheme == "https" || uri.scheme == "http") {
                if (uri.host != ASSET_DOMAIN) runCatching {
                    startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
                }.onFailure { toast("无法打开外部链接") }
            }
            if (uri.host == ASSET_DOMAIN) toast("已阻止未登记或跨项目的页面跳转")
            return true
        }

        override fun onPageFinished(view: WebView, url: String) {
            if (view === webView && view.url == url && currentGame?.id == game.id && !loadFailed) {
                if (game.id != "light" && AssetAccessPolicy.pageAllowed(game.id, Uri.parse(url).path, resolver.allowedPaths)) {
                    view.evaluateJavascript(exportBridgeJs(bridgeName(game.id)), null)
                }
                if (game.id == "turing" && Uri.parse(url).path?.endsWith("/campaign.html") == true) {
                    view.evaluateJavascript(CAMPAIGN_MOBILE_FIT_JS) {
                        if (view === webView && view.url == url && currentGame?.id == game.id && !loadFailed) hideOverlay()
                    }
                } else {
                    hideOverlay()
                }
            }
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: android.webkit.WebResourceError) {
            if (view !== webView) return
            val essential = resolver.allowed(request.url) && (!request.isForMainFrame || AssetAccessPolicy.pageAllowed(game.id, request.url.path, resolver.allowedPaths))
            if (essential) showResourceError("${game.name} 加载失败，请返回大厅后重试")
            else if (request.isForMainFrame) toast("未登记页面已被阻止，当前资源版本保留")
        }

        override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
            if (view !== webView || response.statusCode < 400) return
            val path = request.url.path ?: "未知路径"
            val essential = resolver.allowed(request.url) && (!request.isForMainFrame || AssetAccessPolicy.pageAllowed(game.id, path, resolver.allowedPaths))
            if (essential) {
                showResourceError("${game.name} 资源缺失：$path")
            } else if (request.isForMainFrame) {
                toast("未登记页面已被阻止，当前资源版本保留")
            } else {
                Log.w("GameHub", "Blocked or optional resource: $path (${response.statusCode})")
            }
        }
    }

    private fun showLoading(message: String) {
        hideOverlay()
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(BACKGROUND)
            addView(ProgressBar(this@MainActivity))
            addView(label(message, 16f, Color.WHITE, false).apply { setPadding(0, dp(18), 0, 0) })
        }
        overlay = panel
        root.addView(panel, FrameLayout.LayoutParams(-1, -1))
    }

    private fun showResourceError(message: String) = showError(message, resourceSession?.game?.identity)
    private fun showError(message: String) = showError(message, null)

    private fun showError(message: String, failedIdentity: String?) {
        if (loadFailed && webView == null) return
        val failedGame = currentGame?.id
        if (failedGame != null && failedIdentity != null) resourceRuntime?.store?.blockFailedIdentity(failedGame, failedIdentity)
        navigationSerial++
        loadFailed = true
        clearWebView()
        if (failedGame != null && failedIdentity != null) updates.reportResourceFailure(failedGame, failedIdentity)
        hideOverlay()
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(28), dp(28), dp(28), dp(28))
            setBackgroundColor(BACKGROUND)
            addView(label(message, 17f, Color.WHITE, false))
            addView(Button(this@MainActivity).apply {
                text = "返回大厅"
                isAllCaps = false
                setOnClickListener { showLobby() }
            })
            addView(Button(this@MainActivity).apply {
                text = "返回大厅并管理资源"
                isAllCaps = false
                setOnClickListener { showLobby(); showUpdateDetails() }
            })
        }
        overlay = panel
        root.addView(panel, FrameLayout.LayoutParams(-1, -1))
    }

    private fun showFatal(message: String) {
        root.addView(label(message, 18f, Color.WHITE, false).apply {
            gravity = Gravity.CENTER
            setPadding(dp(24), dp(24), dp(24), dp(24))
        }, FrameLayout.LayoutParams(-1, -1))
    }

    private fun hideOverlay() {
        overlay?.let { root.removeView(it) }
        overlay = null
    }

    private fun showLobby() {
        navigationSerial++
        hideOverlay()
        clearWebView()
        currentGame = null
        loadFailed = false
        lobby.visibility = View.VISIBLE
        updates.reloadLocalResources()
        updates.presence(activityStarted, true, pendingInstallApk == null)
    }

    private fun clearWebView() {
        val previousView = webView
        webView = null
        gameDialogs.toList().forEach { it.dismiss() }
        filePathCallback?.onReceiveValue(null)
        filePathCallback = null
        previousView?.let { view ->
            root.removeView(view)
            view.stopLoading()
            view.destroy()
        }
        resourceRuntime?.unbind(gameResolver)
        gameResolver = null
        resourceSession?.close()
        resourceSession = null
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        currentGame?.let { outState.putString(STATE_GAME, it.id) }
        pendingInstallApk?.let { outState.putString(STATE_PENDING_INSTALL, it.name) }
        webView?.saveState(outState)
    }

    override fun onDestroy() {
        navigationSerial++
        clearWebView()
        super.onDestroy()
    }

    private fun gameUrl(game: Game) = "https://$ASSET_DOMAIN/assets/games/${game.id}/${game.entry}"
    private fun installedVersionName() = packageManager.getPackageInfo(packageName, 0).versionName ?: "未知"
    private fun dp(value: Int) = (value * resources.displayMetrics.density + 0.5f).toInt()
    private fun label(text: String, size: Float, color: Int, bold: Boolean) = TextView(this).apply {
        this.text = text
        textSize = size
        setTextColor(color)
        if (bold) setTypeface(typeface, Typeface.BOLD)
    }
    private fun rounded(color: Int, radius: Int) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = radius.toFloat()
    }

    private inner class SaveBridge {
        private val bridgeSerial = navigationSerial
        @JavascriptInterface
        @Synchronized
        fun saveFile(name: String, content: String): Boolean {
            if (!activityStarted || bridgeSerial != navigationSerial) return false
            if (exports.busy || content.isEmpty()) {
                runOnUiThread { toast(if (content.isEmpty()) "导出内容为空" else "请先完成当前保存") }
                return false
            }
            val export = DocumentExport(FileNamePolicy.sanitize(name), content)
            val receipt = UiRequestAcceptance()
            runOnUiThread {
                receipt.dispatch {
                    if (!activityStarted || isDestroyed || bridgeSerial != navigationSerial || loadFailed || exports.busy || filePathCallback != null || pendingInstallApk != null) {
                        if (!isDestroyed) toast("保存请求未受理，请回到游戏后重试")
                        false
                    } else {
                        if (!exports.offer(export)) return@dispatch false
                        refreshUpdatePresence()
                        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT)
                            .addCategory(Intent.CATEGORY_OPENABLE)
                            .setType(FileNamePolicy.mimeType(export.name))
                            .putExtra(Intent.EXTRA_TITLE, export.name)
                        runCatching { saveLauncher.launch(intent) }.fold({ true }, {
                            exports.cancelled()
                            refreshUpdatePresence()
                            toast("无法打开保存对话框")
                            false
                        })
                    }
                }
            }
            val accepted = receipt.awaitAccepted()
            if (!accepted && receipt.cancelledBeforeAcceptance()) runOnUiThread {
                if (activityStarted && !isDestroyed) toast("保存请求超时，请重试")
            }
            return accepted
        }
    }

    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    private fun bridgeName(id: String) = when (id) {
        "conway" -> "ConwayAndroid"
        "eml" -> "EMLAndroid"
        "light" -> "LightAndroid"
        "turing" -> "TuringAndroid"
        else -> error("未知项目：$id")
    }

    private fun exportBridgeJs(bridge: String) = EXPORT_BRIDGE_JS.replace("__BRIDGE__", bridge)

    companion object {
        private const val ASSET_DOMAIN = "appassets.androidplatform.net"
        private const val STATE_GAME = "game-hub.current-game"
        private const val STATE_PENDING_INSTALL = "game-hub.pending-install"
        private val BACKGROUND = Color.rgb(16, 20, 28)
        private val MUTED = Color.rgb(164, 180, 201)
        private val CAMPAIGN_MOBILE_FIT_JS = """
            (function () {
              if (document.getElementById('game-hub-campaign-fit')) return;
              var style = document.createElement('style');
              style.id = 'game-hub-campaign-fit';
              style.textContent = '@media(max-width:980px){.course-layout > * {min-width:0}.level-sidebar{overflow-x:auto}}';
              document.head.appendChild(style);
            })();
        """.trimIndent()
        private val EXPORT_BRIDGE_JS = """
            (function () {
              if (window.__gameHubExportBridge) return;
              window.__gameHubExportBridge = true;
              var blobs = new Map();
              var create = URL.createObjectURL.bind(URL);
              var revoke = URL.revokeObjectURL.bind(URL);
              URL.createObjectURL = function (blob) {
                var url = create(blob);
                blobs.set(url, blob);
                return url;
              };
              URL.revokeObjectURL = function (url) {
                blobs.delete(url);
                return revoke(url);
              };
              function saveAnchor(anchor, event) {
                if (!anchor || !anchor.getAttribute('download') || !anchor.href.startsWith('blob:')) return false;
                var blob = blobs.get(anchor.href);
                if (!blob) return false;
                if (event) event.preventDefault();
                blob.text().then(function (content) {
                  window.__BRIDGE__.saveFile(anchor.getAttribute('download'), content);
                }).catch(function () { window.__BRIDGE__.saveFile(anchor.getAttribute('download'), ''); });
                return true;
              }
              var nativeClick = HTMLAnchorElement.prototype.click;
              HTMLAnchorElement.prototype.click = function () {
                if (!saveAnchor(this, null)) return nativeClick.call(this);
              };
              document.addEventListener('click', function (event) {
                var anchor = event.target && event.target.closest && event.target.closest('a[download]');
                saveAnchor(anchor, event);
              });
            })();
        """.trimIndent()
    }
}
