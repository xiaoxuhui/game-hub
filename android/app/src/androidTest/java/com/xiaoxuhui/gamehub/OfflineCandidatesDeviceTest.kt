package com.xiaoxuhui.gamehub

import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.security.KeyPairGenerator
import java.security.Signature
import java.text.SimpleDateFormat
import java.util.Base64
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class OfflineCandidatesDeviceTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext

    private fun js(view: WebView, expression: String): String {
        val done = CountDownLatch(1)
        var result = ""
        instrumentation.runOnMainSync { view.evaluateJavascript(expression) { result = it; done.countDown() } }
        assertTrue("JavaScript timed out", done.await(30, TimeUnit.SECONDS))
        return result
    }

    private fun waitFor(view: WebView, expression: String) {
        val deadline = System.currentTimeMillis() + 120000
        while (System.currentTimeMillis() < deadline) {
            if (js(view, expression) == "true") return
            Thread.sleep(250)
        }
        fail("Timed out waiting for $expression")
    }

    @Test fun installAndRunCandidatesOffline() {
        val assets = instrumentation.context.assets
        val ids = listOf("snake-speed", "turbowarp-graph-lab")
        val games = JSONArray(assets.open("offline-candidates/games.json").bufferedReader().use { it.readText() })
        ids.indices.forEach { games.getJSONObject(it).put("assetId", it + 1) }
        val key = KeyPairGenerator.getInstance("RSA").apply { initialize(3072) }.generateKeyPair()
        val time = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT).apply { timeZone = TimeZone.getTimeZone("UTC") }
        val now = System.currentTimeMillis()
        val payload = JSONObject().put("schemaVersion", 2).put("channel", DynamicGamePolicy.CHANNEL)
            .put("releaseId", 10).put("catalogSequence", "1").put("issuedAt", time.format(Date(now - 60000)))
            .put("expiresAt", time.format(Date(now + 86400000))).put("games", games).toString().toByteArray()
        val signature = Signature.getInstance("SHA256withRSA").run { initSign(key.private); update(payload); sign() }
        val envelope = JSONObject().put("envelopeVersion", 1).put("keyId", ResourcePolicy.KEY_ID)
            .put("payloadBase64", Base64.getEncoder().encodeToString(payload))
            .put("signatureBase64", Base64.getEncoder().encodeToString(signature)).toString().toByteArray()
        val root = File(context.cacheDir, "offline-candidates-${UUID.randomUUID()}").apply { mkdirs() }
        try {
            val store = GameResourceStore(File(root, "store"), 9, key.public.encoded, policy = ResourceStorePolicy.DYNAMIC)
            val catalog = store.acceptCatalog(envelope)
            for (id in ids) {
                val game = catalog.games.single { it.id == id }
                val archive = File(root, "$id.zip").apply { writeBytes(assets.open("offline-candidates/$id.zip").use { it.readBytes() }) }
                store.install(game, envelope, archive)
                assertTrue(store.installed(id))
                store.openSession(id, true).use { session ->
                    val resolver = GameContentResolver(context.assets, id, session, emptySet())
                    val url = "https://${resolver.host}/assets/games/$id/${game.entry}"
                    if (id == "snake-speed") {
                        val wasm = Uri.parse("https://${resolver.host}/assets/games/$id/pyodide/pyodide.asm.wasm")
                        assertEquals("application/wasm", resolver.response(wasm).mimeType)
                    }
                    val loaded = CountDownLatch(1)
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
                                override fun shouldInterceptRequest(v: WebView, request: WebResourceRequest): WebResourceResponse = resolver.response(request.url)
                                override fun onPageFinished(v: WebView, pageUrl: String) { loaded.countDown() }
                            }
                            loadUrl(url)
                        }
                    }
                    try {
                        assertTrue("Page load timed out: $id", loaded.await(60, TimeUnit.SECONDS))
                        if (id == "snake-speed") {
                            js(view, "document.querySelector('#python-code').value='import math\\nprint(\\\"offline\\\", math.isqrt(81))\\nprint(\\\"D\\\")'; document.querySelector('#python-run').click(); true")
                            waitFor(view, "document.querySelector('#python-output').textContent.includes('offline 9') && !document.querySelector('#python-run').disabled")
                            assertEquals("[1,0]", js(view, "window.snakeGame.snapshot().head"))
                        } else {
                            waitFor(view, "Boolean(window.graphHall && window.graphHall.ready)")
                            assertEquals("true", js(view, "window.graphHall.save()"))
                            assertNotEquals("null", js(view, "localStorage.getItem('turbowarp-graph-lab.state.v1')"))
                        }
                    } finally { instrumentation.runOnMainSync { view.destroy() } }
                }
                store.openSession(id, true).use { assertEquals(id, it.game?.id) }
            }
        } finally {
            require(root.canonicalFile.parentFile == context.cacheDir.canonicalFile)
            root.deleteRecursively()
        }
    }
}
