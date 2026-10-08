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
import org.json.JSONObject
import java.io.File

class MainActivity : ComponentActivity() {
    private data class Game(val id: String, val name: String, val version: String, val revision: String, val entry: String)
    private data class Export(val name: String, val content: String)

    private lateinit var root: FrameLayout
    private lateinit var lobby: ScrollView
    private lateinit var updateLink: TextView
    private lateinit var updateSummary: TextView
    private val updates by lazy { UpdateCoordinator.get(applicationContext) }
    private var activityStarted = false
    private val updateDialogs = mutableSetOf<AlertDialog>()
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
    private var navigationSerial = 0L
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    @Volatile private var pendingExport: Export? = null
    private val fileChooserLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        filePathCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
        filePathCallback = null
    }
    private val saveLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uri = if (result.resultCode == Activity.RESULT_OK) result.data?.data else null
        val export = pendingExport
        pendingExport = null
        if (uri == null) {
            toast("已取消保存")
        } else if (export != null) {
            runCatching {
                contentResolver.openOutputStream(uri)?.use { it.write(export.content.toByteArray(Charsets.UTF_8)) }
                    ?: error("无法写入所选文件")
            }.onSuccess { toast("已保存 ${export.name}") }
                .onFailure { toast("保存失败：${it.message ?: "未知错误"}") }
        }
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
    }
    private val installerLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        discardInstallFile(pendingInstallApk)
        pendingInstallApk = null
        updateLink.isEnabled = true
        updateLink.text = "检查更新"
        if (result.resultCode != Activity.RESULT_OK) toast("安装未完成，下载缓存已清理")
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
        if (::updateSummary.isInitialized) {
            updates.subscribe(updateListener)
            updates.presence(true, currentGame == null, pendingInstallApk == null && filePathCallback == null && pendingExport == null)
        }
    }

    override fun onStop() {
        activityStarted = false
        updateDialogs.toList().forEach { it.dismiss() }
        updateDialogs.clear()
        if (::updateSummary.isInitialized) {
            updates.unsubscribe(updateListener)
            if (!isChangingConfigurations) updates.presence(false, currentGame == null, false)
        }
        super.onStop()
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
        val cardMinDp = 176 + ((resources.configuration.fontScale - 1f).coerceAtLeast(0f) * 72).toInt()
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
        headerRow.addView(label("合集 v${installedVersionName()}  ·  ${bundleCommit.take(10)}", 11f, MUTED, false).apply {
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
                    contentDescription = "${game.name}，版本 ${game.version}，提交 ${game.revision.take(10)}，打开"
                    isClickable = true
                    isFocusable = true
                    setOnClickListener { openGame(game) }
                }
                row.addView(card, LinearLayout.LayoutParams(0, -1, 1f).apply { setMargins(dp(4), dp(4), dp(4), dp(4)) })
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
                card.addView(label("v${game.version}  ·  ${game.revision.take(6)}", 9.5f, MUTED, false).apply {
                    gravity = Gravity.CENTER
                    maxLines = 2
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
        if (state.task != null) {
            column.addView(label("${state.task}：${state.done / 1024} / ${state.total / 1024} KiB", 13f, Color.WHITE, false).apply { tag = "update-progress" })
            detailButton(column, "取消本次下载", state.total > 0) { updates.cancel() }
        }
        detailButton(column, "立即检查", !state.busy) { if (!updates.check(true)) toast("当前无可用网络或任务尚未结束") }
        val apk = state.readyApk?.takeIf { it.isFile }
        if (apk != null) detailButton(column, "安装已验证的大厅 APK", !state.busy && pendingInstallApk == null) {
            dialog.dismiss()
            AlertDialog.Builder(this).setTitle("安装大厅更新")
                .setMessage("安装包的摘要、包名、版本及签名已验证。继续将打开 Android 系统安装界面。")
                .setPositiveButton("继续安装") { _, _ -> requestSystemInstall(apk) }
                .setNegativeButton("稍后", null).show()
        } else state.apk?.let { release ->
            detailButton(column, "下载大厅 v${release.version}（${release.size / 1024} KiB）", !state.busy) {
                confirmDownload { allowed -> if (!updates.downloadApk(allowed)) toast("下载未开始，请检查网络或等待当前任务结束") }
            }
        }
        for (game in games) {
            val remote = state.catalogGames.singleOrNull { it.id == game.id }
            if (remote != null) {
                description("${game.name} · 远端 v${remote.version} / 资源 #${remote.contentCode}\n${remote.archiveBytes / 1024} KiB · 来源 ${remote.sourceRevision.take(10)}\n${remote.notes}")
                if (state.resources.any { it.id == game.id }) detailButton(column, "下载${game.name}更新", !state.busy) {
                    confirmDownload { allowed -> if (!updates.downloadResource(game.id, allowed)) toast("下载未开始，请检查网络或重新查询") }
                }
            }
        }
        column.addView(CheckBox(this).apply {
            text = "自动更新子游戏（默认仅非计费 Wi-Fi）"; setTextColor(Color.WHITE); isChecked = state.automatic
            setOnCheckedChangeListener { _, checked -> if (!updates.settings(checked, state.metered)) toast("设置未保存，请重试") }
        })
        column.addView(CheckBox(this).apply {
            text = "允许计费网络自动下载（可能产生流量费用）"; setTextColor(Color.WHITE); isChecked = state.metered
            setOnCheckedChangeListener { _, checked -> if (!updates.settings(state.automatic, checked)) toast("设置未保存，请重试") }
        })
    }

    private fun confirmDownload(action: (Boolean) -> Unit) {
        if (updates.unmeteredWifi()) { action(false); return }
        AlertDialog.Builder(this).setTitle("确认本次使用计费网络")
            .setMessage("当前不是非计费 Wi-Fi。仅允许本次下载使用移动或计费网络，不更改自动更新设置。")
            .setPositiveButton("允许本次下载") { _, _ -> action(true) }.setNegativeButton("取消", null).show()
    }

    private fun requestSystemInstall(apk: File) {
        if (Build.VERSION.SDK_INT >= 26 && !packageManager.canRequestPackageInstalls()) {
            pendingInstallApk = apk
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
                }
        } else {
            openSystemInstaller(apk)
        }
    }

    private fun openSystemInstaller(apk: File) {
        pendingInstallApk = apk
        updateLink.isEnabled = false
        updateLink.text = "安装处理中…"
        runCatching { installerLauncher.launch(updateManager.installationIntent(apk)) }
            .onFailure {
                pendingInstallApk = null
                discardInstallFile(apk)
                updateLink.isEnabled = true
                updateLink.text = "检查更新"
                toast("无法打开系统安装界面")
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
                            runOnUiThread selectedUi@{
                                if (isDestroyed || serial != navigationSerial) { selected.getOrNull()?.close(); return@selectedUi }
                                selected.onFailure { showError("资源校验失败：${it.message}") }.onSuccess selectedSession@{ session ->
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
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = filePathCallback
                    return try {
                        fileChooserLauncher.launch(fileChooserParams.createIntent())
                        true
                    } catch (error: Exception) {
                        this@MainActivity.filePathCallback = null
                        toast("无法打开文件选择器")
                        false
                    }
                }

                override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult): Boolean {
                    AlertDialog.Builder(this@MainActivity)
                        .setMessage(message)
                        .setPositiveButton("确定") { _, _ -> result.confirm() }
                        .setNegativeButton("取消") { _, _ -> result.cancel() }
                        .setOnCancelListener { result.cancel() }
                        .show()
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
            if (uri.host == ASSET_DOMAIN) showError("已阻止未登记或跨项目的页面跳转")
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
            if (view === webView && request.isForMainFrame) showError("${game.name} 加载失败，请返回大厅后重试")
        }

        override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
            if (view !== webView || response.statusCode < 400) return
            val path = request.url.path ?: "未知路径"
            if (request.isForMainFrame || resolver.allowed(request.url)) {
                showError("${game.name} 资源缺失：$path")
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

    private fun showError(message: String) {
        loadFailed = true
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
        updates.presence(activityStarted, true, pendingInstallApk == null)
    }

    private fun clearWebView() {
        filePathCallback?.onReceiveValue(null)
        filePathCallback = null
        webView?.let { view ->
            root.removeView(view)
            view.stopLoading()
            view.destroy()
        }
        webView = null
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
        @JavascriptInterface
        @Synchronized
        fun saveFile(name: String, content: String): Boolean {
            if (pendingExport != null || content.isEmpty()) {
                runOnUiThread { toast(if (content.isEmpty()) "导出内容为空" else "请先完成当前保存") }
                return false
            }
            val export = Export(FileNamePolicy.sanitize(name), content)
            pendingExport = export
            runOnUiThread {
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType(FileNamePolicy.mimeType(export.name))
                    .putExtra(Intent.EXTRA_TITLE, export.name)
                runCatching { saveLauncher.launch(intent) }
                    .onFailure {
                        pendingExport = null
                        toast("无法打开保存对话框")
                    }
            }
            return true
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
