package com.xiaoxuhui.gamehub

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
import java.util.Collections
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.zip.ZipInputStream
import java.security.KeyPairGenerator
import java.security.Signature
import java.text.SimpleDateFormat
import java.util.Base64
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class FiveCandidateWebViewTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private val ids = listOf("compass-polygon-studio", "fourier-drawing-studio", "ai-racing-lab")
    private fun js(view: WebView, expression: String): String {
        val done = CountDownLatch(1); var result = ""
        instrumentation.runOnMainSync { view.evaluateJavascript(expression) { result = it; done.countDown() } }
        assertTrue("JavaScript timeout", done.await(30, TimeUnit.SECONDS)); return result
    }
    @Test fun candidatePagesAndStorageWorkOffline() {
        val assets = instrumentation.context.assets
        val metadata = JSONArray(assets.open("five-candidate/games.json").bufferedReader().use { it.readText() })
        val views = mutableListOf<WebView>(); val roots = mutableListOf<File>(); val sessions = mutableListOf<ResourceSession>()
        val blocked = Collections.synchronizedList(mutableListOf<String>())
        try {
            ids.forEachIndexed { index, id ->
                val game = DynamicGamePolicy.parseGame(metadata.getJSONObject(index).put("assetId", index + 1))
                assertEquals(id, game.id)
                val bytes = assets.open("five-candidate/$id.zip").use { it.readBytes() }
                assertEquals(game.archiveSha256, ResourcePolicy.sha256(bytes))
                val root = File(context.cacheDir, "five-$id-${UUID.randomUUID()}").apply { mkdirs() }; roots.add(root)
                val actual = mutableSetOf<String>()
                ZipInputStream(bytes.inputStream()).use { zip -> while (true) {
                    val entry = zip.nextEntry ?: break; val path = ResourcePolicy.safePath(entry.name)
                    assertFalse(entry.isDirectory); assertTrue(actual.add(path))
                    val file = File(root, path); file.parentFile!!.mkdirs(); file.writeBytes(zip.readBytes())
                    assertEquals(game.files.single { it.path == path }.sha256, ResourcePolicy.sha256(file.readBytes()))
                } }
                assertEquals(game.files.map { it.path }.toSet(), actual)
                val session = ResourceSession(game, root) {}; sessions.add(session)
                val resolver = GameContentResolver(context.assets, id, session, emptySet())
                val latch = CountDownLatch(1); lateinit var view: WebView
                instrumentation.runOnMainSync { view = WebView(context).apply {
                    WebViewCookiePolicy.configure(this); settings.javaScriptEnabled = true; settings.domStorageEnabled = true
                    settings.blockNetworkLoads = true; settings.allowFileAccess = false; settings.allowContentAccess = false
                    webViewClient = object : WebViewClient() {
                        override fun shouldInterceptRequest(v: WebView, request: WebResourceRequest): WebResourceResponse {
                            if (!resolver.allowed(request.url)) blocked.add(request.url.toString())
                            return resolver.response(request.url)
                        }
                        override fun onPageFinished(v: WebView, url: String) { latch.countDown() }
                    }
                    loadUrl("https://${resolver.host}/assets/games/$id/${game.entry}")
                } }
                views.add(view); assertTrue("Page timeout: $id", latch.await(60, TimeUnit.SECONDS))
                val selector = when(id) { "compass-polygon-studio" -> "svg"; "fourier-drawing-studio" -> "#play"; else -> "#editTrack" }
                assertEquals("true", js(view, "Boolean(document.querySelector('$selector'))"))
                if (id == "fourier-drawing-studio") assertEquals("true", js(view, "document.querySelector('#play').click(); true"))
                if (id == "ai-racing-lab") {
                    assertEquals("true", js(view, "document.querySelector('#editTrack').click(); true"))
                    js(view, "window.__qa='waiting'; openLearningStorage().then(async s=>{if(!s){window.__qa='unavailable';return;} await s.write('__qa__',{value:42});const r=await s.read(['__qa__']);window.__qa=r.get('__qa__').value===42?'ok':'mismatch';}).catch(e=>window.__qa=String(e));")
                    val deadline=System.currentTimeMillis()+30000
                    while(js(view,"window.__qa") == "\"waiting\"" && System.currentTimeMillis()<deadline) Thread.sleep(100)
                    assertEquals("IndexedDB round trip", "\"ok\"", js(view,"window.__qa"))
                }
                assertEquals("\"https://${resolver.host}\"", js(view,"location.origin"))
            }
            assertTrue("Unexpected blocked requests: $blocked", blocked.all { url -> ids.any { url == "https://${AssetAccessPolicy.hostFor(it)}/favicon.ico" } })
        } finally {
            instrumentation.runOnMainSync { views.forEach { it.destroy() } }; sessions.forEach { it.close() }
            roots.forEach { require(it.canonicalFile.parentFile == context.cacheDir.canonicalFile); it.deleteRecursively() }
        }
    }
    @Test fun candidateResourcesInstallAndReopenFromPrivateStore() {
        val assets=instrumentation.context.assets
        val metadata=JSONArray(assets.open("five-candidate/games.json").bufferedReader().use { it.readText() })
        ids.forEachIndexed { i, _ -> metadata.getJSONObject(i).put("assetId",i+1) }
        val pair=KeyPairGenerator.getInstance("RSA").apply { initialize(3072) }.generateKeyPair()
        val format=SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",Locale.ROOT).apply { timeZone=TimeZone.getTimeZone("UTC") }
        val now=System.currentTimeMillis()
        val payload=JSONObject().put("schemaVersion",2).put("channel",DynamicGamePolicy.CHANNEL).put("releaseId",10).put("catalogSequence","1")
            .put("issuedAt",format.format(Date(now-60000))).put("expiresAt",format.format(Date(now+86400000))).put("games",metadata).toString().toByteArray()
        val signature=Signature.getInstance("SHA256withRSA").run { initSign(pair.private); update(payload); sign() }
        val envelope=JSONObject().put("envelopeVersion",1).put("keyId",ResourcePolicy.KEY_ID).put("payloadBase64",Base64.getEncoder().encodeToString(payload))
            .put("signatureBase64",Base64.getEncoder().encodeToString(signature)).toString().toByteArray()
        val root=File(context.cacheDir,"five-store-${UUID.randomUUID()}").apply { mkdirs() }
        try {
            val store=GameResourceStore(File(root,"store"),8,pair.public.encoded,policy=ResourceStorePolicy.DYNAMIC)
            val games=store.acceptCatalog(envelope).games
            ids.forEach { id ->
                val archive=File(root,"$id.zip").apply { writeBytes(assets.open("five-candidate/$id.zip").use { it.readBytes() }) }
                val game=games.single { it.id==id }; store.install(game,envelope,archive); assertTrue(store.installed(id))
                repeat(2) { store.openSession(id,true).use { session ->
                    val resolver=GameContentResolver(context.assets,id,session,emptySet())
                    val uri=android.net.Uri.parse("https://${resolver.host}/assets/games/$id/${game.entry}")
                    assertEquals(200,resolver.response(uri).statusCode)
                } }
            }
        } finally { require(root.canonicalFile.parentFile==context.cacheDir.canonicalFile); root.deleteRecursively() }
    }
}
