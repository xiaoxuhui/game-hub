package com.xiaoxuhui.gamehub

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.ByteArrayInputStream

class MainActivity : ComponentActivity() {
    private data class Game(val id: String, val name: String, val version: String, val revision: String, val entry: String)

    private lateinit var root: FrameLayout
    private lateinit var lobby: ScrollView
    private var webView: WebView? = null
    private var overlay: View? = null
    private var currentGame: Game? = null
    private var loadFailed = false
    private var games: List<Game> = emptyList()
    private var assetPaths: Set<String> = emptySet()
    private var bundleCommit = ""
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
        val scroll = ScrollView(this).apply { fillViewport = true; isVerticalScrollBarEnabled = false }
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
        }
        webView = view
        root.addView(view, FrameLayout.LayoutParams(-1, -1))
        showLoading("正在打开${game.name}…")
        val restored = if (restoredState != null) view.restoreState(restoredState) else null
        if (restored == null) view.loadUrl(gameUrl(game))
    }

    private fun gameClient(game: Game): WebViewClient = object : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse {
            val uri = request.url
            if (!isAllowedAsset(uri)) return blockedResponse()
            return assetLoader.shouldInterceptRequest(uri) ?: blockedResponse()
        }

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            if (!request.isForMainFrame) return !isAllowedAsset(request.url)
            val uri = request.url
            val path = uri.path ?: ""
            val ownPage = isAllowedAsset(uri) && path.startsWith("/assets/games/${game.id}/") && path.endsWith(".html")
            if (ownPage) return false
            if (uri.scheme == "https" || uri.scheme == "http") {
                if (uri.host != ASSET_DOMAIN) runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
            }
            if (uri.host == ASSET_DOMAIN) showError("已阻止未登记或跨项目的页面跳转")
            return true
        }

        override fun onPageFinished(view: WebView, url: String) {
            if (view === webView && currentGame?.id == game.id && !loadFailed) hideOverlay()
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: android.webkit.WebResourceError) {
            if (view === webView && request.isForMainFrame) showError("${game.name} 加载失败，请返回大厅后重试")
        }

        override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
            if (view === webView && response.statusCode >= 400) showError("${game.name} 资源缺失：${request.url.path ?: "未知路径"}")
        }
    }

    private fun isAllowedAsset(uri: Uri): Boolean {
        if (uri.scheme != "https" || uri.host != ASSET_DOMAIN || uri.port != -1) return false
        val encoded = uri.encodedPath ?: return false
        if (encoded.contains('%') || encoded.contains('\\')) return false
        return assetPaths.contains(uri.path)
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

    companion object {
        private const val ASSET_DOMAIN = "appassets.androidplatform.net"
        private const val STATE_GAME = "game-hub.current-game"
        private val BACKGROUND = Color.rgb(16, 20, 28)
        private val MUTED = Color.rgb(164, 180, 201)
    }
}
