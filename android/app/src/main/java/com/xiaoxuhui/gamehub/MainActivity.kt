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
import android.os.Bundle
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
import android.widget.FrameLayout
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
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.ByteArrayInputStream

class MainActivity : ComponentActivity() {
    private data class Game(val id: String, val name: String, val version: String, val revision: String, val entry: String)
    private data class Export(val name: String, val content: String)

    private lateinit var root: FrameLayout
    private lateinit var lobby: ScrollView
    private var webView: WebView? = null
    private var overlay: View? = null
    private var currentGame: Game? = null
    private var loadFailed = false
    private var games: List<Game> = emptyList()
    private var assetPaths: Set<String> = emptySet()
    private var bundleCommit = ""
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
    private val descriptions = mapOf(
        "conway" to "在无限棋盘上探索生命演化",
        "eml" to "公式、数值与计算树工作台",
        "light" to "布置元件，让光抵达目标",
        "turing" to "编程图灵机并挑战关卡"
    )
    private val accents = mapOf(
        "conway" to 0xFF6EE7B7.toInt(),
        "eml" to 0xFFF8C56A.toInt(),
        "light" to 0xFF8AB7FF.toInt(),
        "turing" to 0xFFD3A3FF.toInt()
    )

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .setDomain(ASSET_DOMAIN)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

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
                if (view != null) {
                    if (view.canGoBack()) view.goBack() else showLobby()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
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
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val side = if (resources.configuration.screenWidthDp >= 600) dp(48) else dp(20)
            setPadding(side, dp(28), side, dp(40))
        }
        scroll.addView(column, FrameLayout.LayoutParams(-1, -2))
        column.addView(label("游戏大厅", 32f, Color.WHITE, true))
        column.addView(label("四个项目，一个离线入口", 15f, MUTED, false).apply {
            setPadding(0, dp(8), 0, dp(6))
        })
        column.addView(label("合集 0.1.0  ·  ${bundleCommit.take(10)}", 12f, MUTED, false).apply {
            setPadding(0, 0, 0, dp(20))
        })
        for (game in games) {
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(18), dp(16), dp(18), dp(16))
                background = rounded(0xFF1B2330.toInt(), dp(18))
            }
            val layout = LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(14) }
            column.addView(card, layout)
            card.addView(label(game.name, 21f, accents[game.id] ?: Color.WHITE, true))
            card.addView(label(descriptions[game.id] ?: "离线项目", 14f, 0xFFE0E8F3.toInt(), false).apply {
                setPadding(0, dp(7), 0, dp(7))
            })
            card.addView(label("v${game.version}  ·  ${game.revision.take(10)}", 12f, MUTED, false))
            card.addView(Button(this).apply {
                text = "进入项目"
                isAllCaps = false
                setTextColor(BACKGROUND)
                background = rounded(accents[game.id] ?: Color.WHITE, dp(12))
                setOnClickListener { openGame(game) }
            }, LinearLayout.LayoutParams(-1, dp(48)).apply { topMargin = dp(14) })
        }
        column.addView(label("资源内置于应用；首次使用从新存档开始。", 12f, MUTED, false))
        return scroll
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun openGame(game: Game, restoredState: Bundle? = null) {
        clearWebView()
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
                textZoom = 100
            }
            webViewClient = gameClient(game)
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

    private fun gameClient(game: Game): WebViewClient = object : WebViewClient() {
        override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
            if (view === webView && AssetAccessPolicy.pageAllowed(game.id, Uri.parse(url).path, assetPaths)) {
                loadFailed = false
                showLoading("正在打开${game.name}…")
            }
        }

        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse {
            val uri = request.url
            if (!isAllowedAsset(uri)) return blockedResponse()
            return assetLoader.shouldInterceptRequest(uri) ?: blockedResponse()
        }

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            if (!request.isForMainFrame) return !isAllowedAsset(request.url)
            val uri = request.url
            val path = uri.path ?: ""
            val ownPage = isAllowedAsset(uri) && AssetAccessPolicy.pageAllowed(game.id, path, assetPaths)
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
            if (view === webView && currentGame?.id == game.id && !loadFailed) {
                if (game.id != "light" && AssetAccessPolicy.pageAllowed(game.id, Uri.parse(url).path, assetPaths)) {
                    view.evaluateJavascript(exportBridgeJs(bridgeName(game.id)), null)
                }
                if (game.id == "turing" && Uri.parse(url).path?.endsWith("/campaign.html") == true) {
                    view.evaluateJavascript(CAMPAIGN_MOBILE_FIT_JS) {
                        if (view === webView && currentGame?.id == game.id && !loadFailed) hideOverlay()
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
            if (request.isForMainFrame || (isAllowedAsset(request.url) && (path.endsWith(".js") || path.endsWith(".css") || path.endsWith(".html")))) {
                showError("${game.name} 资源缺失：$path")
            } else {
                Log.w("GameHub", "Blocked or optional resource: $path (${response.statusCode})")
            }
        }
    }

    private fun isAllowedAsset(uri: Uri): Boolean {
        return AssetAccessPolicy.resourceAllowed(uri.scheme, uri.host, uri.port, uri.encodedPath, uri.path, assetPaths)
    }

    private fun blockedResponse(): WebResourceResponse {
        val body = "Blocked unregistered resource".toByteArray(Charsets.UTF_8)
        return WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(body))
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
        hideOverlay()
        clearWebView()
        currentGame = null
        loadFailed = false
        lobby.visibility = View.VISIBLE
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
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        currentGame?.let { outState.putString(STATE_GAME, it.id) }
        webView?.saveState(outState)
    }

    override fun onDestroy() {
        clearWebView()
        super.onDestroy()
    }

    private fun gameUrl(game: Game) = "https://$ASSET_DOMAIN/assets/games/${game.id}/${game.entry}"
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
