package com.xiaoxuhui.gamehub

import android.app.Application
import android.net.Uri
import android.os.StrictMode
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.view.accessibility.AccessibilityNodeInfo
import android.webkit.WebView
import android.webkit.WebChromeClient
import android.webkit.ValueCallback
import android.content.Intent
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.json.JSONObject

@RunWith(AndroidJUnit4::class)
class DocumentExportTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private fun flow(activity: MainActivity) = ViewModelProvider(activity)[DocumentExportFlow::class.java]
    private fun node(root: AccessibilityNodeInfo?, predicate: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo? {
        if (root == null) return null
        if (predicate(root)) return root
        for (index in 0 until root.childCount) node(root.getChild(index), predicate)?.let { return it }
        return null
    }
    private fun awaitNode(predicate: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo {
        val until = System.currentTimeMillis() + 15000
        do {
            node(instrumentation.uiAutomation.rootInActiveWindow, predicate)?.let { return it }
            Thread.sleep(100)
        } while (System.currentTimeMillis() < until)
        throw AssertionError("Expected DocumentsUI control not found")
    }
    private fun javascript(scenario: ActivityScenario<MainActivity>, script: String): String {
        val done = CountDownLatch(1); var result = ""
        scenario.onActivity { activity ->
            val view = MainActivity::class.java.getDeclaredField("webView").apply { isAccessible = true }.get(activity) as? WebView
            if (view == null) done.countDown() else view.evaluateJavascript(script) { result = it; done.countDown() }
        }
        assertTrue(done.await(10, TimeUnit.SECONDS)); return result
    }
    private fun setFilename(name: String) {
        val until = System.currentTimeMillis() + 15000
        do {
            val editor = awaitNode { it.packageName?.toString() == "com.android.documentsui" && it.viewIdResourceName == "android:id/title" &&
                it.className?.toString() == "android.widget.EditText" && it.isEnabled }
            if (editor.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, Bundle().apply {
                putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, name)
            })) {
                val updated = node(instrumentation.uiAutomation.rootInActiveWindow) { it.viewIdResourceName == "android:id/title" && it.text?.toString() == name }
                if (updated != null) return
            }
            Thread.sleep(100)
        } while (System.currentTimeMillis() < until)
        throw AssertionError("System filename editor did not accept $name")
    }

    @Test fun fourActualWebExportsSaveThroughSystemDocumentsUi() {
        val accessibility = instrumentation.uiAutomation.serviceInfo
        val originalAccessibilityFlags = accessibility.flags
        accessibility.flags = accessibility.flags or android.accessibilityservice.AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
        instrumentation.uiAutomation.serviceInfo = accessibility
        val triggers = mapOf("conway" to "document.getElementById('randomButton').click();document.getElementById('exportButton').click()",
            "eml" to "document.getElementById('saveButton').click()", "light" to "document.getElementById('btn-export').click()",
            "turing" to "document.getElementById('exportProject').click()")
        try {
            for ((id, trigger) in triggers) {
                ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                    var originalActivity = 0
                    lateinit var originalFlow: DocumentExportFlow
                    scenario.onActivity { activity ->
                        originalActivity = System.identityHashCode(activity)
                        originalFlow = flow(activity)
                        val games = MainActivity::class.java.getDeclaredField("games").apply { isAccessible = true }.get(activity) as List<*>
                        val game = games.first { it!!.javaClass.getDeclaredField("id").apply { isAccessible = true }.get(it) == id }!!
                        MainActivity::class.java.getDeclaredMethod("openGame", game.javaClass, Bundle::class.java).apply { isAccessible = true }.invoke(activity, game, null)
                    }
                    val until = System.currentTimeMillis() + 20000
                    val ready = if (id == "light") "Boolean(window.LightAndroid && window.LightStorage && document.readyState === 'complete')" else "Boolean(window.__gameHubExportBridge)"
                    while (javascript(scenario, ready) != "true" && System.currentTimeMillis() < until) Thread.sleep(100)
                    assertEquals("$id export ready", "true", javascript(scenario, ready))
                    javascript(scenario, "(()=>{$trigger;return true})()")
                    awaitNode { it.packageName?.toString() == "com.android.documentsui" && it.viewIdResourceName == "android:id/title" &&
                        it.className?.toString() == "android.widget.EditText" && it.isEnabled }
                    assertNotNull(awaitNode { it.text?.toString() == "Files in Downloads" })
                    // The system picker recreates and can reset its filename; select the name after rotation.
                    if (id == "light") instrumentation.uiAutomation.setRotation(android.app.UiAutomation.ROTATION_FREEZE_90)
                    val name = "gamehub-export-$id-${UUID.randomUUID()}.json"
                    setFilename(name)
                    assertTrue(awaitNode { it.packageName?.toString() == "com.android.documentsui" && it.viewIdResourceName == "android:id/button1" && it.isEnabled }
                        .performAction(AccessibilityNodeInfo.ACTION_CLICK))
                    var text = ""
                    val deadline = System.currentTimeMillis() + 15000
                    do {
                        text = ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand("cat /sdcard/Download/$name")).bufferedReader().use { it.readText() }
                        if (text.trim().startsWith("{")) break
                        Thread.sleep(100)
                    } while (System.currentTimeMillis() < deadline)
                    val saved = JSONObject(text)
                    if (id == "light") {
                        awaitNode { it.packageName?.toString() == "com.xiaoxuhui.gamehub" }
                        scenario.onActivity {
                            assertEquals("Manifest handles ordinary orientation changes", originalActivity, System.identityHashCode(it))
                            assertSame(originalFlow, flow(it))
                        }
                    }
                    if (id == "light") instrumentation.uiAutomation.setRotation(android.app.UiAutomation.ROTATION_FREEZE_0)
                    when (id) {
                        "conway" -> assertTrue(saved.has("format") && saved.getJSONArray("alive").length() > 0)
                        "eml" -> assertEquals(2, saved.getInt("schemaVersion"))
                        "light" -> assertTrue(saved.has("id") && saved.has("placement"))
                        "turing" -> assertEquals("turing-machine-simulator", saved.getString("format"))
                    }
                    System.out.println("Actual SAF export $id: /sdcard/Download/$name (${text.toByteArray().size} UTF-8 bytes)")
                }
            }
        } finally {
            instrumentation.uiAutomation.setRotation(android.app.UiAutomation.ROTATION_FREEZE_0)
            accessibility.flags = originalAccessibilityFlags
            instrumentation.uiAutomation.serviceInfo = accessibility
        }
    }

    @Test fun pendingDocumentSurvivesActivityRotationWithoutAnotherRequest() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            lateinit var before: DocumentExportFlow
            val export = DocumentExport("rotation.json", "{\"draft\":\"旋转保留\"}")
            scenario.onActivity { before = flow(it); assertTrue(before.offer(export)) }
            scenario.recreate()
            scenario.onActivity {
                val after = flow(it)
                assertSame(before, after); assertSame(export, after.pending); assertTrue(after.busy)
                assertFalse(after.offer(DocumentExport("duplicate.json", "{}")))
                after.cancelled(); assertFalse(after.busy)
            }
        }
    }

    @Test fun staleStoppedAndOverlappingFileChoosersReturnCancellation() {
        val runtime = ResourceRuntime.get(instrumentation.targetContext)
        val session = runtime.store.openSession("light", true)
        val params = object : WebChromeClient.FileChooserParams() {
            override fun getMode() = MODE_OPEN
            override fun getAcceptTypes() = arrayOf("application/json")
            override fun isCaptureEnabled() = false
            override fun getTitle(): CharSequence? = null
            override fun getFilenameHint(): String? = null
            override fun createIntent() = Intent(Intent.ACTION_GET_CONTENT).setType("application/json")
        }
        lateinit var activity: MainActivity
        lateinit var view: WebView
        lateinit var client: WebChromeClient
        val callbackField = MainActivity::class.java.getDeclaredField("filePathCallback").apply { isAccessible = true }
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity {
                activity = it
                val games = MainActivity::class.java.getDeclaredField("games").apply { isAccessible = true }.get(it) as List<*>
                val game = games.first { item -> item!!.javaClass.getDeclaredField("id").apply { isAccessible = true }.get(item) == "light" }!!
                MainActivity::class.java.getDeclaredMethod("openGamePrepared", game.javaClass, Bundle::class.java, ResourceSession::class.java, ResourceRuntime::class.java)
                    .apply { isAccessible = true }.invoke(it, game, null, session, runtime)
                view = MainActivity::class.java.getDeclaredField("webView").apply { isAccessible = true }.get(it) as WebView
                client = view.webChromeClient!!
                var priorCancelled = false
                val prior = ValueCallback<Array<Uri>> { priorCancelled = true }
                callbackField.set(it, prior)
                var duplicateCancelled = false
                assertTrue(client.onShowFileChooser(view, { value -> assertNull(value); duplicateCancelled = true }, params))
                assertTrue(duplicateCancelled); assertFalse(priorCancelled); assertSame(prior, callbackField.get(it))
                callbackField.set(it, null)
                assertTrue(flow(it).offer(DocumentExport("busy.json", "{}")))
                var busyCancelled = false
                assertTrue(client.onShowFileChooser(view, { value -> assertNull(value); busyCancelled = true }, params))
                assertTrue(busyCancelled); assertNull(callbackField.get(it)); flow(it).cancelled()
            }
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED)
            instrumentation.runOnMainSync {
                var stoppedCancelled = false
                assertTrue(client.onShowFileChooser(view, { value -> assertNull(value); stoppedCancelled = true }, params))
                assertTrue(stoppedCancelled); assertNull(callbackField.get(activity))
            }
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED)
            scenario.onActivity {
                MainActivity::class.java.getDeclaredMethod("showLobby").apply { isAccessible = true }.invoke(it)
                var staleCancelled = false
                assertTrue(client.onShowFileChooser(view, { value -> assertNull(value); staleCancelled = true }, params))
                assertTrue(staleCancelled); assertNull(callbackField.get(it))
            }
        }
        assertFalse(runtime.store.hasSessions())
    }

    @Test fun actualResolverWritesUtf8OffMainAndFailureReleasesTheReservation() {
        val store = ViewModelStore()
        val owner = object : ViewModelStoreOwner { override val viewModelStore = store }
        lateinit var exportFlow: DocumentExportFlow
        val violations = java.util.concurrent.CopyOnWriteArrayList<android.os.strictmode.Violation>()
        instrumentation.runOnMainSync {
            exportFlow = ViewModelProvider(owner, ViewModelProvider.AndroidViewModelFactory(
                instrumentation.targetContext.applicationContext as Application))[DocumentExportFlow::class.java]
        }
        val output = File(instrumentation.targetContext.cacheDir, "export-${UUID.randomUUID()}.json")
        try {
            fun execute(uri: Uri, expected: String) {
                val done = CountDownLatch(1); var message = ""
                instrumentation.runOnMainSync {
                    val previous = StrictMode.getThreadPolicy()
                    if (android.os.Build.VERSION.SDK_INT >= 28) StrictMode.setThreadPolicy(StrictMode.ThreadPolicy.Builder()
                        .detectDiskWrites().penaltyListener(java.util.concurrent.Executor { it.run() }) { violations.add(it) }.build())
                    try {
                        exportFlow.attach { exportFlow.consumeResult()?.let { message = it; done.countDown() } }
                        assertTrue(exportFlow.offer(DocumentExport("中文.json", "{\"draft\":\"保留数据\"}")))
                        exportFlow.finish(uri)
                        assertTrue(exportFlow.busy)
                        assertFalse(exportFlow.offer(DocumentExport("duplicate.json", "{}")))
                    } finally { StrictMode.setThreadPolicy(previous) }
                }
                assertTrue(done.await(15, TimeUnit.SECONDS)); assertTrue(message, message.startsWith(expected))
                assertFalse(exportFlow.busy)
            }
            execute(Uri.fromFile(output), "已保存")
            assertEquals("{\"draft\":\"保留数据\"}", output.readText())
            execute(Uri.parse("content://com.xiaoxuhui.gamehub.missing-test-provider/failure"), "保存失败")
            assertTrue("UI disk writes: $violations", violations.isEmpty())
        } finally {
            instrumentation.runOnMainSync { exportFlow.detach(); store.clear() }
            output.delete()
        }
    }

    @Test fun missingRequestIsReportedInsteadOfClaimingSaved() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity {
                val controller = flow(it)
                controller.detach()
                controller.finish(Uri.parse("content://com.xiaoxuhui.gamehub.missing-test-provider/lost"))
                assertEquals("保存请求已失效，请回到游戏后重试", controller.consumeResult())
                assertNull(controller.consumeResult()); assertFalse(controller.busy)
            }
        }
    }
}
