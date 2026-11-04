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

class NewTurboWarpStoreDeviceTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private val ids = listOf("turbowarp-life-lab", "turbowarp-turing-lab")
    private fun js(view: WebView, expression: String): String {
        val done = CountDownLatch(1); var result = ""
        instrumentation.runOnMainSync { view.evaluateJavascript(expression) { result = it; done.countDown() } }
        assertTrue("JavaScript timeout", done.await(30, TimeUnit.SECONDS)); return result
    }
    @Test fun candidateResourcesInstallAndReopenFromPrivateStore() {
        val assets=instrumentation.context.assets
        val metadata=JSONArray(assets.open("two-turbowarp-candidate/games.json").bufferedReader().use { it.readText() })
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
                val archive=File(root,"$id.zip").apply { writeBytes(assets.open("two-turbowarp-candidate/$id.zip").use { it.readBytes() }) }
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
