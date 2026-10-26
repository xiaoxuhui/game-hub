package com.xiaoxuhui.gamehub

import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.UUID
import java.util.Collections
import java.util.zip.ZipInputStream

/** Exact candidate ZIPs in test APK assets, loaded by the production content resolver and WebView policy. */
class TurboWarpCandidateWebViewTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private val testAssets get() = instrumentation.context.assets
    private val ids = listOf("turbowarp-neural-network", "turbowarp-logic-lab")

    private fun js(view: WebView, expression: String): String {
        val latch = CountDownLatch(1)
        var value = ""
        instrumentation.runOnMainSync { view.evaluateJavascript(expression) { value = it; latch.countDown() } }
        assertTrue("JavaScript timed out: $expression", latch.await(30, TimeUnit.SECONDS))
        return value
    }

    @Test fun originalGamesLoadOfflineAndKeepIndependentProgressAcrossReload() {
        val source = JSONArray(testAssets.open("turbowarp-candidate/games.json").bufferedReader().use { it.readText() })
        val opened = mutableListOf<WebView>()
        val roots = mutableListOf<File>()
        val sessions = mutableListOf<ResourceSession>()
        val blockedUrls = Collections.synchronizedList(mutableListOf<String>())
        try {
            for ((index, id) in ids.withIndex()) {
                val metadata = source.getJSONObject(index).put("assetId", index + 1)
                val game = DynamicGamePolicy.parseGame(metadata)
                assertEquals(id, game.id)
                val bytes = testAssets.open("turbowarp-candidate/$id.zip").use { it.readBytes() }
                assertEquals(game.archiveSha256, ResourcePolicy.sha256(bytes))
                val root = File(context.cacheDir, "turbowarp-candidate-$id-${UUID.randomUUID()}").apply { mkdirs() }
                roots.add(root)
                val actual = mutableSetOf<String>()
                ZipInputStream(bytes.inputStream()).use { zip ->
                    while (true) {
                        val entry = zip.nextEntry ?: break
                        val path = ResourcePolicy.safePath(entry.name)
                        assertFalse(entry.isDirectory)
                        assertTrue(actual.add(path))
                        val file = File(root, path)
                        file.parentFile!!.mkdirs()
                        file.writeBytes(zip.readBytes())
                        assertEquals(game.files.single { it.path == path }.sha256, ResourcePolicy.sha256(file.readBytes()))
                    }
                }
                assertEquals(game.files.map { it.path }.toSet(), actual)
                val session = ResourceSession(game, root) {}
                sessions.add(session)
                val resolver = GameContentResolver(context.assets, id, session, emptySet())
                val url = "https://${resolver.host}/assets/games/$id/${game.entry}"
                fun page(): WebView {
                    val latch = CountDownLatch(1)
                    lateinit var view: WebView
                    instrumentation.runOnMainSync {
                        view = WebView(context).apply {
                            WebViewCookiePolicy.configure(this)
                            settings.javaScriptEnabled = true
                            settings.domStorageEnabled = true
                            settings.blockNetworkLoads = true
                            settings.allowFileAccess = false
                            settings.allowContentAccess = false
                            webViewClient = object : WebViewClient() {
                                override fun shouldInterceptRequest(v: WebView, request: WebResourceRequest): WebResourceResponse {
                                    if (!resolver.allowed(request.url)) blockedUrls.add(request.url.toString())
                                    return resolver.response(request.url)
                                }
                                override fun onPageFinished(v: WebView, pageUrl: String) { latch.countDown() }
                            }
                            loadUrl(url)
                        }
                    }
                    assertTrue("Page load timed out: $id", latch.await(45, TimeUnit.SECONDS))
                    opened.add(view)
                    val deadline = System.currentTimeMillis() + 120000
                    while (js(view, "Boolean(window.hall && window.hall.ready)") != "true" && System.currentTimeMillis() < deadline) Thread.sleep(100)
                    assertEquals("Game did not start: $id; " + js(view, "window.hall && window.hall.error || ''"), "true", js(view, "Boolean(window.hall && window.hall.ready)"))
                    return view
                }
                val first = page()
                assertEquals("\"https://${resolver.host}\"", js(first, "location.origin"))
                assertEquals("\"$id.state.v1\"", js(first, "window.hall.storageKey"))
                js(first, "window.hall.save()")
                val saved = js(first, "localStorage.getItem('$id.state.v1')")
                assertNotEquals("null", saved)
                assertEquals("null", js(first, "localStorage.getItem('${ids[1-index]}.state.v1')"))
                val second = page()
                assertEquals(saved, js(second, "localStorage.getItem('$id.state.v1')"))
                assertEquals("false", js(second, "window.hall.storageError"))
                assertEquals(404, resolver.response(android.net.Uri.parse("https://example.com/index.html")).statusCode)
            }
            // WebView asks each origin for an implicit favicon; production resolver blocks it.
            assertTrue("Unexpected external or unknown requests: $blockedUrls", blockedUrls.all { url ->
                ids.any { id -> url == "https://${AssetAccessPolicy.hostFor(id)}/favicon.ico" }
            })
        } finally {
            instrumentation.runOnMainSync { opened.forEach { it.destroy() } }
            sessions.forEach { it.close() }
            roots.forEach { root ->
                require(root.canonicalFile.parentFile == context.cacheDir.canonicalFile)
                root.deleteRecursively()
            }
        }
    }
}
