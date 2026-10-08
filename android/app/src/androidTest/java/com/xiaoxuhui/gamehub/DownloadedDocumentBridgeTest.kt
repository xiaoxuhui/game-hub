package com.xiaoxuhui.gamehub

import android.content.ContentValues
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.provider.MediaStore
import android.view.accessibility.AccessibilityNodeInfo
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Explicit offline controller only: verified downloaded sessions, actual bridges and DocumentsUI. */
class DownloadedDocumentBridgeTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private fun node(root: AccessibilityNodeInfo?, predicate: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo? {
        if (root == null) return null
        if (predicate(root)) return root
        for (i in 0 until root.childCount) node(root.getChild(i), predicate)?.let { return it }
        return null
    }
    private fun awaitNode(predicate: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo {
        val until = System.nanoTime() + TimeUnit.SECONDS.toNanos(15)
        do {
            node(instrumentation.uiAutomation.rootInActiveWindow, predicate)?.let { return it }
            Thread.sleep(100)
        } while (System.nanoTime() < until)
        error("Expected native document control missing")
    }
    private fun js(scenario: ActivityScenario<MainActivity>, script: String): String {
        val signal = CountDownLatch(1); var result = "null"
        scenario.onActivity { activity ->
            val view = MainActivity::class.java.getDeclaredField("webView").apply { isAccessible = true }.get(activity) as? WebView
            if (view == null) signal.countDown() else view.evaluateJavascript("(()=>{$script})()") { result = it; signal.countDown() }
        }
        assertTrue(signal.await(10, TimeUnit.SECONDS)); return result
    }
    private fun awaitJs(scenario: ActivityScenario<MainActivity>, expression: String) {
        val until = System.nanoTime() + TimeUnit.SECONDS.toNanos(20)
        while (js(scenario, "return $expression") != "true" && System.nanoTime() < until) Thread.sleep(100)
        assertEquals(expression, "true", js(scenario, "return $expression"))
    }
    private fun tapWebButton(scenario: ActivityScenario<MainActivity>, id: String) {
        // File input requires trusted user activation; evaluateJavascript .click() is intentionally blocked.
        val bounds = org.json.JSONArray(js(scenario, "const b=document.getElementById('$id');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,window.innerWidth,r.width,r.height]"))
        assertTrue(bounds.getDouble(3) > 0 && bounds.getDouble(4) > 0)
        var x = 0f; var y = 0f
        scenario.onActivity { activity ->
            val view = MainActivity::class.java.getDeclaredField("webView").apply { isAccessible = true }.get(activity) as WebView
            val location = IntArray(2); view.getLocationOnScreen(location)
            val scale = view.width / bounds.getDouble(2)
            x = (location[0] + bounds.getDouble(0) * scale).toFloat()
            y = (location[1] + bounds.getDouble(1) * scale).toFloat()
            assertTrue(x >= location[0] && x < location[0] + view.width)
            assertTrue(y >= location[1] && y < location[1] + view.height)
        }
        val time = android.os.SystemClock.uptimeMillis()
        for (action in listOf(android.view.MotionEvent.ACTION_DOWN, android.view.MotionEvent.ACTION_UP)) {
            val event = android.view.MotionEvent.obtain(time, android.os.SystemClock.uptimeMillis(), action, x, y, 0)
            event.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
            try { assertTrue(instrumentation.uiAutomation.injectInputEvent(event, true)) } finally { event.recycle() }
            if (action == android.view.MotionEvent.ACTION_DOWN) Thread.sleep(30)
        }
    }
    private fun export(scenario: ActivityScenario<MainActivity>, button: String, name: String): JSONObject {
        assertEquals("true", js(scenario, "document.getElementById('$button').click();return true"))
        val editor = awaitNode { it.packageName?.toString() == "com.android.documentsui" && it.viewIdResourceName == "android:id/title" && it.className?.toString() == "android.widget.EditText" }
        assertTrue(editor.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, name)
        }))
        awaitNode { it.viewIdResourceName == "android:id/title" && it.text?.toString() == name }
        assertTrue(awaitNode { it.packageName?.toString() == "com.android.documentsui" && it.viewIdResourceName == "android:id/button1" && it.isEnabled }
            .performAction(AccessibilityNodeInfo.ACTION_CLICK))
        val until = System.nanoTime() + TimeUnit.SECONDS.toNanos(15)
        do {
            val text = ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand("cat /sdcard/Download/$name"))
                .bufferedReader().use { it.readText() }
            if (text.trim().startsWith("{")) return JSONObject(text)
            Thread.sleep(100)
        } while (System.nanoTime() < until)
        error("Actual exported JSON was not saved")
    }
    @Test fun fourVerifiedDownloadedGamesImportAndExportThroughActualSystemPicker() {
        org.junit.Assume.assumeTrue("Explicit document bridge controller required", InstrumentationRegistry.getArguments().getString("downloadedDocuments") == "true")
        val service = instrumentation.uiAutomation.serviceInfo
        val oldFlags = service.flags
        service.flags = oldFlags or android.accessibilityservice.AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
        instrumentation.uiAutomation.serviceInfo = service
        val buttons = mapOf("conway" to ("exportButton" to "importButton"), "eml" to ("saveButton" to "importButton"),
            "light" to ("btn-export" to "btn-import"), "turing" to ("exportProject" to "importProject"))
        try { ResourceDeviceFixture(context).use { fixture ->
            for ((id, actions) in buttons) {
                fixture.install(id)
                val session = fixture.store.openSession(id, true)
                assertEquals(2, checkNotNull(session.game).contentCode)
                ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                    scenario.onActivity { activity ->
                        val runtime = ResourceRuntime.get(context)
                        MainActivity::class.java.getDeclaredField("resourceRuntime").apply { isAccessible = true }.set(activity, runtime)
                        val games = MainActivity::class.java.getDeclaredField("games").apply { isAccessible = true }.get(activity) as List<*>
                        val game = games.first { it!!.javaClass.getDeclaredField("id").apply { isAccessible = true }.get(it) == id }!!
                        MainActivity::class.java.getDeclaredMethod("openGamePrepared", game.javaClass, Bundle::class.java, ResourceSession::class.java, ResourceRuntime::class.java)
                            .apply { isAccessible = true }.invoke(activity, game, null, session, runtime)
                    }
                    awaitJs(scenario, if (id == "light") "Boolean(window.LightAndroid && window.LightStorage && document.readyState === 'complete')" else "Boolean(window.__gameHubExportBridge)")
                    if (id == "conway") assertEquals("true", js(scenario, "document.getElementById('randomButton').click();return true"))
                    val prefix = "gamehub-downloaded-$id-${UUID.randomUUID()}"
                    val original = export(scenario, actions.first, "$prefix-before.json")
                    val incoming = JSONObject(original.toString()).apply {
                        when (id) {
                            "conway" -> put("generation", if (original.getInt("generation") == 1234) 1235 else 1234)
                            "eml" -> {
                                val first = getJSONArray("valueOrder").getString(0)
                                put("selectedValueId", if (original.isNull("selectedValueId")) first else JSONObject.NULL)
                                put("inputXId", if (original.isNull("inputXId")) first else JSONObject.NULL)
                            }
                            "light" -> { put("id", "qa-downloaded-${UUID.randomUUID()}"); put("title", "下载资源文件桥验收") }
                            "turing" -> put("input", if (original.getString("input") == "10100110") "11001001" else "10100110")
                        }
                    }
                    val importName = "$prefix-import.json"
                    val resolver = context.contentResolver
                    val uri = checkNotNull(resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, importName); put(MediaStore.Downloads.MIME_TYPE, "application/json")
                        put(MediaStore.Downloads.RELATIVE_PATH, "Download"); put(MediaStore.Downloads.IS_PENDING, 1)
                    }))
                    try {
                        resolver.openOutputStream(uri)!!.bufferedWriter(Charsets.UTF_8).use { it.write(incoming.toString()) }
                        resolver.update(uri, ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }, null, null)
                        if (id == "eml") js(scenario, "document.getElementById('notice').textContent='';return true")
                        tapWebButton(scenario, actions.second)
                        awaitNode { it.packageName?.toString() == "com.android.documentsui" }
                        // GET_CONTENT starts in Recents; the newly inserted test-owned JSON is indexed there.
                        var document = awaitNode { it.packageName?.toString() == "com.android.documentsui" && it.text?.toString() == importName }
                        // Filename is a non-clickable TextView inside the selectable document row.
                        var parents = 0
                        while (!document.isClickable && parents++ < 8) document = checkNotNull(document.parent)
                        assertTrue(document.isClickable)
                        assertTrue(document.performAction(AccessibilityNodeInfo.ACTION_CLICK))
                        val check = when (id) {
                            "conway" -> "document.getElementById('toastMessage').textContent.includes('导入成功')"
                            "eml" -> {
                                val selected = incoming.optString("selectedValueId", "")
                                val ui = if (incoming.isNull("selectedValueId")) "document.querySelectorAll('.value-button[aria-pressed=\"true\"]').length === 0"
                                    else "document.querySelector('.value-button[aria-pressed=\"true\"]')?.parentElement.dataset.valueId === ${JSONObject.quote(selected)}"
                                "document.getElementById('notice').textContent.includes('导入成功') && ($ui)"
                            }
                            "light" -> "document.getElementById('level-title').textContent === '下载资源文件桥验收'"
                            else -> "document.getElementById('input').value === ${JSONObject.quote(incoming.getString("input"))}"
                        }
                        awaitJs(scenario, check)
                        val restored = export(scenario, actions.first, "$prefix-after.json")
                        when (id) {
                            "conway" -> {
                                assertNotEquals(original.getInt("generation"), incoming.getInt("generation"))
                                assertEquals(incoming.getInt("generation"), restored.getInt("generation"))
                                assertEquals(original.getJSONArray("alive").toString(), restored.getJSONArray("alive").toString())
                            }
                            "eml" -> {
                                for (field in listOf("selectedValueId", "inputXId")) {
                                    assertNotEquals("Import must change $field", original.get(field), incoming.get(field))
                                    assertEquals(incoming.get(field), restored.get(field))
                                    val expected = if (incoming.isNull(field)) "null" else JSONObject.quote(incoming.getString(field))
                                    assertEquals("true", js(scenario, "const r=EMLPersistence.loadFromCache(localStorage);return r.ok && r.state.$field === $expected"))
                                }
                            }
                            "light" -> { assertEquals(incoming.getString("id"), restored.getString("id")); assertEquals(incoming.getString("title"), restored.getString("title")) }
                            "turing" -> {
                                assertNotEquals(original.getString("input"), incoming.getString("input"))
                                assertEquals(incoming.getString("input"), restored.getString("input"))
                            }
                        }
                        val bytes = restored.toString().toByteArray(Charsets.UTF_8)
                        System.out.println("Downloaded resource $id code2 actual SAF import/export: ${bytes.size} bytes, SHA256 ${ResourcePolicy.sha256(bytes)}")
                    } finally {
                        resolver.delete(uri, null, null)
                        require(Regex("gamehub-downloaded-(conway|eml|light|turing)-[a-f0-9-]{36}").matches(prefix))
                        // Exact UUID names created by this test; never enumerate or remove user downloads.
                        ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand(
                            "rm -f /sdcard/Download/$prefix-before.json /sdcard/Download/$prefix-after.json"))
                            .use { assertTrue(it.bufferedReader().readText().isBlank()) }
                    }
                }
                assertFalse(fixture.store.hasSessions())
            }
        } } finally { service.flags = oldFlags; instrumentation.uiAutomation.serviceInfo = service }
    }
}
