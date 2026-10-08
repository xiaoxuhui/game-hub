package com.xiaoxuhui.gamehub

import android.app.AlertDialog
import android.content.ContentValues
import android.graphics.Rect
import android.os.Bundle
import android.provider.MediaStore
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.LinearLayout
import android.widget.TextView
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Real native renderer/actions under explicit screen profiles; update metadata here is a UI fixture. */
class LobbyAccessibilityDeviceTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private fun find(view: View, predicate: (View) -> Boolean): View? {
        if (predicate(view)) return view
        if (view is ViewGroup) for (i in 0 until view.childCount) find(view.getChildAt(i), predicate)?.let { return it }
        return null
    }
    private fun node(root: AccessibilityNodeInfo, predicate: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo? {
        if (predicate(root)) return root
        for (i in 0 until root.childCount) root.getChild(i)?.let { child -> node(child, predicate)?.let { return it } }
        return null
    }
    private fun screenshot(prefix: String, suffix: String) {
        // View assertions can finish before the emulator compositor presents the first frame.
        instrumentation.waitForIdleSync()
        Thread.sleep(500)
        val bitmap = instrumentation.uiAutomation.takeScreenshot() ?: error("Screenshot unavailable")
        val resolver = instrumentation.targetContext.contentResolver
        val name = "$prefix-$suffix.png"
        val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, name); put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/game-hub-qa"); put(MediaStore.Images.Media.IS_PENDING, 1)
        }) ?: error("Cannot create test screenshot")
        try {
            resolver.openOutputStream(uri)!!.use { assertTrue(bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)) }
            resolver.update(uri, ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) }, null, null)
            instrumentation.addResults(Bundle().apply { putString("screenshot-$suffix", "/sdcard/Pictures/game-hub-qa/$name") })
        } finally { bitmap.recycle() }
    }
    @Test fun realLobbyAndUpdateDetailsRemainReachableAndCancellationActionReachesTaskGate() {
        val arguments = InstrumentationRegistry.getArguments()
        val profile = arguments.getString("uiProfile")
        org.junit.Assume.assumeTrue("Explicit UI profile controller required", profile != null)
        require(profile in setOf("phone", "large", "tablet"))
        val prefix = arguments.getString("uiFilePrefix")!!.also { require(Regex("[a-z0-9-]{1,80}").matches(it)) }
        val context = instrumentation.targetContext
        val coordinator = UpdateCoordinator.get(context)
        val gate = UpdateCoordinator::class.java.getDeclaredField("gate").apply { isAccessible = true }.get(coordinator) as UpdateTaskGate
        val service = instrumentation.uiAutomation.serviceInfo
        val oldFlags = service.flags
        service.flags = oldFlags or android.accessibilityservice.AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
            android.accessibilityservice.AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS or
            android.accessibilityservice.AccessibilityServiceInfo.FLAG_REQUEST_TOUCH_EXPLORATION_MODE
        instrumentation.uiAutomation.serviceInfo = service
        try { ResourceDeviceFixture(context).use { fixture ->
            ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                instrumentation.waitForIdleSync()
                val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
                while (!coordinator.snapshot().localLoaded || coordinator.snapshot().busy) {
                    check(System.nanoTime() < deadline) { "UI controller requires offline idle app" }; Thread.sleep(25)
                }
                val original = coordinator.snapshot()
                val local = fixture.store.describeAll()
                val remote = fixture.catalog.games.map { if (it.id in setOf("light", "conway")) it else it.copy(contentCode = 1) }
                val display = original.copy(localResources = local, localLoaded = true, localReadError = null,
                    apk = ReleaseApk("0.4.0", 900, 2621167, "a".repeat(64)), catalogGames = remote,
                    resources = remote.filter { it.id in setOf("light", "conway") },
                    apkStatus = "大厅 0.4.0 可更新", resourceStatus = "2 个游戏有更新")
                val renderLobby = MainActivity::class.java.getDeclaredMethod("renderUpdates", UpdateSnapshot::class.java).apply { isAccessible = true }
                scenario.onActivity { activity ->
                    val config = activity.resources.configuration
                    if (profile == "large") { assertEquals(320, config.screenWidthDp); assertTrue(config.fontScale >= 1.5f) }
                    if (profile == "tablet") { assertTrue(config.screenWidthDp >= 600); assertEquals(android.content.res.Configuration.ORIENTATION_LANDSCAPE, config.orientation) }
                    renderLobby.invoke(activity, display)
                    if (profile == "phone") for (name in listOf("康威生命游戏", "EML 计算台", "光学游戏", "图灵机实验台")) {
                        val card = find(activity.window.decorView) { it.contentDescription?.startsWith(name + "，") == true }!!
                        val visible = Rect(); assertTrue(card.getGlobalVisibleRect(visible)); assertEquals("Ordinary phone card fully visible: $name", card.height, visible.height())
                    }
                }
                instrumentation.waitForIdleSync(); screenshot(prefix, "lobby-top")
                for (name in listOf("康威生命游戏", "EML 计算台", "光学游戏", "图灵机实验台")) {
                    scenario.onActivity { activity ->
                        val card = find(activity.window.decorView) { it.contentDescription?.startsWith(name + "，") == true }!!
                        card.requestRectangleOnScreen(Rect(0, 0, card.width, card.height), true)
                    }
                    instrumentation.waitForIdleSync()
                    val cardNode = node(instrumentation.uiAutomation.rootInActiveWindow!!) { it.contentDescription?.startsWith(name + "，") == true } ?: error("Accessible card missing: $name")
                    assertTrue(cardNode.isVisibleToUser); assertTrue(cardNode.isClickable)
                    assertTrue(cardNode.contentDescription.toString().contains("内置"))
                    if (name in setOf("康威生命游戏", "光学游戏")) {
                        assertTrue(cardNode.contentDescription.toString().contains("#2 可更新"))
                        scenario.onActivity { activity ->
                            val status = find(activity.window.decorView) { it is TextView && it.text.toString().contains("#2 可更新") && (it.parent as? View)?.contentDescription?.startsWith(name + "，") == true } as TextView
                            val layout = checkNotNull(status.layout)
                            assertEquals("Update marker must not be clipped", status.text.length, layout.getLineEnd(layout.lineCount - 1))
                            assertTrue("All status lines fit", layout.height <= status.height - status.compoundPaddingTop - status.compoundPaddingBottom)
                        }
                    }
                    assertTrue(cardNode.performAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS))
                }
                screenshot(prefix, "lobby-bottom")
                lateinit var dialog: AlertDialog
                scenario.onActivity { activity ->
                    MainActivity::class.java.getDeclaredMethod("showUpdateDetails").apply { isAccessible = true }.invoke(activity)
                    val tracked = MainActivity::class.java.getDeclaredField("updateDialogs").apply { isAccessible = true }.get(activity) as Set<*>
                    dialog = tracked.filterIsInstance<AlertDialog>().single()
                }
                instrumentation.waitForIdleSync()
                gate.setPresence(true, true); gate.setNetwork(UpdateNetwork(true, true))
                val token = checkNotNull(gate.beginDownload(UpdateDownloadKind.RESOURCE, true))
                try {
                    scenario.onActivity { activity ->
                        val column = find(dialog.window!!.decorView) { it is LinearLayout && it.tag is UpdateSnapshot } as LinearLayout
                        MainActivity::class.java.getDeclaredMethod("renderUpdateDetails", LinearLayout::class.java, UpdateSnapshot::class.java, AlertDialog::class.java)
                            .apply { isAccessible = true }.invoke(activity, column, display.copy(busy = true, task = "下载 光学游戏", done = 32768, total = 2621167), dialog)
                        val cancel = find(dialog.window!!.decorView) { it is TextView && it.text.toString() == "取消本次下载" }!!
                        cancel.requestRectangleOnScreen(Rect(0, 0, cancel.width, cancel.height), true)
                    }
                    instrumentation.waitForIdleSync(); screenshot(prefix, "details-cancel")
                    val cancel = node(instrumentation.uiAutomation.rootInActiveWindow!!) { it.text?.toString() == "取消本次下载" } ?: error("Accessible cancel action missing")
                    assertTrue(cancel.isEnabled); assertTrue(cancel.isVisibleToUser)
                    assertTrue(cancel.performAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS))
                    assertTrue(cancel.performAction(AccessibilityNodeInfo.ACTION_CLICK))
                    instrumentation.waitForIdleSync(); assertTrue(token.cancelled); assertTrue(gate.busy())
                } finally { gate.finish(token); gate.setNetwork(UpdateNetwork(false, false)) }
                scenario.onActivity { activity -> dialog.dismiss(); renderLobby.invoke(activity, original)
                    val label = find(activity.window.decorView) { it is TextView && it.text.toString() == "光学游戏" }!!
                    assertTrue((label.parent as View).performClick())
                }
                var ready = false
                val until = System.nanoTime() + TimeUnit.SECONDS.toNanos(20)
                while (!ready && System.nanoTime() < until) {
                    val signal = CountDownLatch(1)
                    scenario.onActivity { activity ->
                        val view = find(activity.window.decorView) { it is WebView } as? WebView
                        if (view == null) signal.countDown() else view.evaluateJavascript("typeof LightStorage !== 'undefined'") { result -> ready = result == "true"; signal.countDown() }
                    }
                    assertTrue(signal.await(5, TimeUnit.SECONDS)); if (!ready) Thread.sleep(50)
                }
                assertTrue("Actual Light page opens after UI interactions", ready)
                instrumentation.addResults(Bundle().apply { putString("uiValidated", profile) })
            }
        } } finally {
            service.flags = oldFlags; instrumentation.uiAutomation.serviceInfo = service
            coordinator.presence(false, true)
        }
    }
}
