package com.xiaoxuhui.gamehub

import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
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

/** Real producer ZIP and production WebView/SAF; an ephemeral key authorizes only a private fixture store. */
class DynamicDemoDeviceTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private val key = "memory-demo-state-v1"
    private fun js(scenario: ActivityScenario<MainActivity>, script: String): String {
        val latch = CountDownLatch(1); var result = ""
        scenario.onActivity { activity ->
            val view = MainActivity::class.java.getDeclaredField("webView").apply { isAccessible = true }.get(activity) as WebView
            view.evaluateJavascript(script) { result = it; latch.countDown() }
        }
        assertTrue(latch.await(15, TimeUnit.SECONDS)); return result
    }
    private fun awaitJs(scenario: ActivityScenario<MainActivity>, script: String) {
        val deadline = SystemClock.uptimeMillis() + 20000
        while (js(scenario, script) != "true" && SystemClock.uptimeMillis() < deadline) Thread.sleep(100)
        assertEquals(script, "true", js(scenario, script))
    }
    private fun click(scenario: ActivityScenario<MainActivity>, selector: String) {
        val rect = JSONObject(js(scenario, "(()=>{const r=document.querySelector(${JSONObject.quote(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:innerWidth}})()"))
        var x = 0f; var y = 0f
        scenario.onActivity { activity ->
            val view = MainActivity::class.java.getDeclaredField("webView").apply { isAccessible = true }.get(activity) as WebView
            val location = IntArray(2); view.getLocationOnScreen(location)
            val scale = view.width / rect.getDouble("width")
            x = (location[0] + rect.getDouble("x") * scale).toFloat()
            y = (location[1] + rect.getDouble("y") * scale).toFloat()
        }
        val time = SystemClock.uptimeMillis()
        for (action in listOf(MotionEvent.ACTION_DOWN, MotionEvent.ACTION_UP)) {
            val event = MotionEvent.obtain(time, SystemClock.uptimeMillis(), action, x, y, 0)
            try { assertTrue(instrumentation.uiAutomation.injectInputEvent(event, true)) } finally { event.recycle() }
        }
        instrumentation.waitForIdleSync()
    }
    private fun find(root: AccessibilityNodeInfo?, predicate: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo? {
        if (root == null) return null
        if (predicate(root)) return root
        for (index in 0 until root.childCount) find(root.getChild(index), predicate)?.let { return it }
        return null
    }
    private fun node(predicate: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo {
        val deadline = SystemClock.uptimeMillis() + 20000
        do { find(instrumentation.uiAutomation.rootInActiveWindow, predicate)?.let { return it }; Thread.sleep(100) }
        while (SystemClock.uptimeMillis() < deadline)
        throw AssertionError("Expected actual system file-picker control missing")
    }
    private fun shell(command: String) = ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand(command)).bufferedReader().use { it.readText() }
    private fun export(scenario: ActivityScenario<MainActivity>, name: String): JSONObject {
        click(scenario, "#export")
        val editor = node { it.packageName?.toString() == "com.android.documentsui" && it.viewIdResourceName == "android:id/title" && it.className?.toString() == "android.widget.EditText" }
        assertTrue(editor.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, Bundle().apply { putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, name) }))
        assertTrue(node { it.packageName?.toString() == "com.android.documentsui" && it.viewIdResourceName == "android:id/button1" && it.isEnabled }.performAction(AccessibilityNodeInfo.ACTION_CLICK))
        val deadline = SystemClock.uptimeMillis() + 15000; var text = ""
        do { text = shell("cat /sdcard/Download/$name"); if (text.trim().startsWith("{")) break; Thread.sleep(100) }
        while (SystemClock.uptimeMillis() < deadline)
        node { it.packageName?.toString() == "com.xiaoxuhui.gamehub" }
        println("Dynamic demo actual SAF export: /sdcard/Download/$name SHA256=${ResourcePolicy.sha256(text.toByteArray())}")
        return JSONObject(text)
    }
    private fun open(store: GameResourceStore): ActivityScenario<MainActivity> {
        val session = store.openSession("memory-demo", true)
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            val runtime = ResourceRuntime.get(activity)
            MainActivity::class.java.getDeclaredField("resourceRuntime").apply { isAccessible = true }.set(activity, runtime)
            val type = MainActivity::class.java.declaredClasses.single { it.simpleName == "Game" }
            val game = session.game!!
            val descriptor = type.declaredConstructors.single().apply { isAccessible = true }.newInstance(game.id, game.displayName, game.version, game.sourceRevision, game.entry)
            MainActivity::class.java.getDeclaredMethod("openGamePrepared", type, Bundle::class.java, ResourceSession::class.java, ResourceRuntime::class.java)
                .apply { isAccessible = true }.invoke(activity, descriptor, null, session, runtime)
        }
        awaitJs(scenario, "document.readyState==='complete' && document.querySelectorAll('#cards button').length===6 && typeof GameHubBridge==='object'")
        return scenario
    }
    @Test fun actualPinnedDemoTouchesKeyboardSafAndResourceRemovalPreserveProgress() {
        val assets = instrumentation.context.assets
        assumeTrue("Prepare optional independent producer fixture first", assets.list("dynamic-demo-fixture").orEmpty().contains("game.zip"))
        val root = File(context.filesDir.canonicalFile, "dynamic-demo-verification-${UUID.randomUUID()}").apply { mkdirs() }
        val pair = KeyPairGenerator.getInstance("RSA").apply { initialize(3072) }.generateKeyPair()
        val archive = File(root, "game.zip").apply { writeBytes(assets.open("dynamic-demo-fixture/game.zip").use { it.readBytes() }) }
        val metadata = JSONArray(assets.open("dynamic-demo-fixture/games.json").bufferedReader().use { it.readText() }).getJSONObject(0).put("assetId", 100)
        assertEquals("memory-demo", metadata.getString("id"))
        assertEquals("81bdef33331fefedbb858b1ce109ebc437759bb6", metadata.getString("sourceRevision"))
        assertEquals("27f1df3b689e6b4592cbfcae4a80e759a274cfd7857e2764ac2203d27bb0876b", ResourcePolicy.sha256(archive.readBytes()))
        val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT).apply { timeZone = TimeZone.getTimeZone("UTC") }
        val now = System.currentTimeMillis()
        val payload = JSONObject().put("schemaVersion", 2).put("channel", DynamicGamePolicy.CHANNEL).put("releaseId", 10).put("catalogSequence", "1")
            .put("issuedAt", format.format(Date(now - 60000))).put("expiresAt", format.format(Date(now + 86400000))).put("games", JSONArray().put(metadata)).toString().toByteArray()
        val signature = Signature.getInstance("SHA256withRSA").run { initSign(pair.private); update(payload); sign() }
        val envelope = JSONObject().put("envelopeVersion", 1).put("keyId", ResourcePolicy.KEY_ID).put("payloadBase64", Base64.getEncoder().encodeToString(payload))
            .put("signatureBase64", Base64.getEncoder().encodeToString(signature)).toString().toByteArray()
        val store = GameResourceStore(File(root, "store"), 4, pair.public.encoded, policy = ResourceStorePolicy.DYNAMIC)
        val game = store.acceptCatalog(envelope).games.single(); store.install(game, envelope, archive)
        val accessibility = instrumentation.uiAutomation.serviceInfo; val originalFlags = accessibility.flags
        accessibility.flags = accessibility.flags or android.accessibilityservice.AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
        instrumentation.uiAutomation.serviceInfo = accessibility
        var backup: String? = null; var saved = ""
        try {
            open(store).use { scenario ->
                backup = js(scenario, "localStorage.getItem('$key')")
                click(scenario, "#restart")
                click(scenario, "#cards button:nth-child(1)"); click(scenario, "#cards button:nth-child(2)")
                awaitJs(scenario, "JSON.parse(localStorage.getItem('$key')).moves===1 && JSON.parse(localStorage.getItem('$key')).matched.length===0")
                click(scenario, "#restart")
                // Exercise actual keyboard event delivery, not a synthetic DOM event.
                js(scenario, "document.querySelector('#cards button').focus();true")
                instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_ENTER)
                awaitJs(scenario, "JSON.parse(localStorage.getItem('$key')).open[0]===0")
                click(scenario, "#cards button:nth-child(4)"); click(scenario, "#cards button:nth-child(2)"); click(scenario, "#cards button:nth-child(6)")
                click(scenario, "#cards button:nth-child(3)"); click(scenario, "#cards button:nth-child(5)")
                awaitJs(scenario, "JSON.parse(localStorage.getItem('$key')).complete && document.querySelectorAll('#cards button:disabled').length===6")
                saved = js(scenario, "localStorage.getItem('$key')")
                val firstName = "gamehub-dynamic-first-${UUID.randomUUID()}.json"
                val first = export(scenario, firstName)
                assertTrue(first.getBoolean("complete")); assertEquals(3, first.getInt("moves"))
                click(scenario, "#restart"); awaitJs(scenario, "!JSON.parse(localStorage.getItem('$key')).complete")
                click(scenario, "#import")
                val file = node { it.packageName?.toString() == "com.android.documentsui" && it.text?.toString() == firstName }
                var target: AccessibilityNodeInfo? = file
                while (target != null && !target.isClickable) target = target.parent
                assertNotNull("Exported file must have a clickable DocumentsUI row", target)
                assertTrue(target!!.performAction(AccessibilityNodeInfo.ACTION_CLICK))
                awaitJs(scenario, "document.querySelector('#message').textContent==='已导入并保存存档。' && JSON.parse(localStorage.getItem('$key')).complete")
                assertEquals(saved, js(scenario, "localStorage.getItem('$key')"))
                val second = export(scenario, "gamehub-dynamic-second-${UUID.randomUUID()}.json")
                assertEquals(first.toString(), second.toString())
            }
            assertFalse(store.hasSessions()); store.removeResources("memory-demo")
            assertFalse(store.installed("memory-demo")); assertEquals(1, store.selection("memory-demo").highestCode)
            store.install(game, envelope, archive)
            open(store).use { scenario ->
                assertEquals("Actual game progress survives resource removal/reinstallation", saved, js(scenario, "localStorage.getItem('$key')"))
                awaitJs(scenario, "JSON.parse(localStorage.getItem('$key')).complete")
                println("Dynamic demo actual touch/keyboard/SAF/remove-reinstall verified; saved-state SHA256=${ResourcePolicy.sha256(saved.toByteArray())}")
            }
        } finally {
            try {
                if (backup != null) {
                    if (!store.installed("memory-demo")) store.install(game, envelope, archive)
                    open(store).use { scenario ->
                        if (backup == "null") js(scenario, "localStorage.removeItem('$key')")
                        else js(scenario, "localStorage.setItem('$key',$backup)")
                        assertEquals("Restore pre-test demo storage even after a failed assertion", backup, js(scenario, "localStorage.getItem('$key')"))
                    }
                }
            } finally {
                accessibility.flags = originalFlags; instrumentation.uiAutomation.serviceInfo = accessibility
                // Preserve fixture resources for diagnosis; N8 centrally removes task-owned leftovers.
                println("Private dynamic device fixture: ${root.path}")
            }
        }
    }
}
