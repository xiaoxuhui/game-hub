package com.xiaoxuhui.gamehub

import android.content.Context
import android.graphics.Rect
import android.os.ParcelFileDescriptor
import android.view.KeyEvent
import android.view.View
import android.view.accessibility.AccessibilityNodeInfo
import android.webkit.WebView
import androidx.lifecycle.Lifecycle
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry
import androidx.test.runner.lifecycle.Stage
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Real system back/launcher lifecycle, actual signed ready->active installs and production WebViews. */
class BackNavigationDeviceTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()

    /** Launch normally, without ActivityScenario's result/bootstrap task semantics. */
    private inner class ActivityHandle : AutoCloseable {
        private var activity: MainActivity? = null
        val state: Lifecycle.State get() {
            var value = Lifecycle.State.DESTROYED
            instrumentation.runOnMainSync { value = activity?.lifecycle?.currentState ?: value }
            return value
        }
        fun onActivity(action: (MainActivity) -> Unit) = instrumentation.runOnMainSync { action(checkNotNull(activity)) }
        private fun attachResumed(previous: MainActivity? = null) = await("normal launcher activity resumed") {
            var next: MainActivity? = null
            instrumentation.runOnMainSync {
                next = ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED)
                    .filterIsInstance<MainActivity>().singleOrNull { it !== previous }
                if (next != null) activity = next
            }
            next != null
        }
        fun launch() {
            launchFromHomeIcon()
            attachResumed()
            onActivity { assertTrue("Real launcher root required", it.isTaskRoot) }
        }
        fun recreate() {
            var previous: MainActivity? = null
            onActivity { previous = it; it.recreate() }
            attachResumed(previous)
        }
        override fun close() {
            instrumentation.runOnMainSync { activity?.let { if (!it.isDestroyed) it.finish() } }
            await("test-owned activity destroyed") { state == Lifecycle.State.DESTROYED }
        }
    }

    private fun field(activity: MainActivity, name: String): Any? =
        MainActivity::class.java.getDeclaredField(name).apply { isAccessible = true }.get(activity)

    private fun await(label: String, condition: () -> Boolean) {
        val end = System.nanoTime() + TimeUnit.SECONDS.toNanos(20)
        while (!condition()) {
            assertTrue("Timed out: $label", System.nanoTime() < end)
            Thread.sleep(50)
        }
    }

    private fun shell(command: String): String =
        ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand(command))
            .bufferedReader().use { it.readText().trim() }

    private fun launchFromHomeIcon() {
        // A MAIN intent from instrumentation/shell is not a launch originating from the home app.
        // Android's root-back policy distinguishes that source even when isTaskRoot is true.
        shell("input keyevent KEYCODE_HOME")
        instrumentation.uiAutomation.waitForIdle(200, 5000)
        val bounds = Rect()
        checkNotNull(instrumentation.uiAutomation.rootInActiveWindow).getBoundsInScreen(bounds)
        shell("input swipe ${bounds.centerX()} ${bounds.bottom * 86 / 100} ${bounds.centerX()} ${bounds.bottom / 5} 350")
        instrumentation.uiAutomation.waitForIdle(200, 5000)
        val label = instrumentation.targetContext.applicationInfo.loadLabel(instrumentation.targetContext.packageManager).toString()
        fun find(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
            if (node == null) return null
            if (node.packageName?.toString() == "com.android.launcher3" && node.isClickable &&
                (node.text?.toString() == label || node.contentDescription?.toString() == label)) return node
            for (index in 0 until node.childCount) find(node.getChild(index))?.let { return it }
            return null
        }
        await("actual launcher icon $label") {
            find(instrumentation.uiAutomation.rootInActiveWindow)?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true
        }
    }

    private fun js(scenario: ActivityHandle, script: String): String {
        val latch = CountDownLatch(1)
        var result = "null"
        scenario.onActivity { activity ->
            val web = field(activity, "webView") as? WebView
            if (web == null) latch.countDown()
            else web.evaluateJavascript(script) { result = it; latch.countDown() }
        }
        assertTrue("JavaScript callback", latch.await(10, TimeUnit.SECONDS))
        return result
    }

    private fun awaitGame(scenario: ActivityHandle) = await("loaded game") {
        scenario.state == Lifecycle.State.RESUMED && js(scenario, "document.readyState==='complete' && location.pathname.includes('/assets/games/')") == "true"
    }

    private fun awaitLobby(scenario: ActivityHandle) = await("system back must return to lobby; actual state=${scenario.state}") {
        if (scenario.state != Lifecycle.State.RESUMED) false else {
            var visible = false
            scenario.onActivity { activity ->
                visible = field(activity, "currentGame") == null && field(activity, "webView") == null &&
                    (field(activity, "lobby") as View).visibility == View.VISIBLE && !activity.isFinishing
            }
            visible
        }
    }

    private fun open(scenario: ActivityHandle, id: String) {
        await("actual game card: $id") {
            var clicked = false
            scenario.onActivity { activity ->
                @Suppress("UNCHECKED_CAST")
                val cards = field(activity, "gameCards") as Map<String, View>
                cards[id]?.let { clicked = it.performClick() }
            }
            clicked
        }
        awaitGame(scenario)
    }

    private fun back() {
        instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK)
        instrumentation.waitForIdleSync()
    }

    private fun backgroundAndResumeSameActivity(scenario: ActivityHandle) {
        var identity = 0
        scenario.onActivity { activity ->
            identity = System.identityHashCode(activity)
            assertTrue("Real launcher root required", activity.isTaskRoot)
            println("N17 before lobby back: activity=$identity task=${activity.taskId} pid=${android.os.Process.myPid()} root=${activity.isTaskRoot} intent=${activity.intent.toUri(0)}")
        }
        back()
        Thread.sleep(500)
        val afterBack = scenario.state
        println("N17 after lobby system BACK: state=$afterBack")
        assertTrue("Root must remain reusable; observed $afterBack", afterBack == Lifecycle.State.CREATED || afterBack == Lifecycle.State.RESUMED)
        if (afterBack == Lifecycle.State.CREATED) {
            launchFromHomeIcon()
            await("same task resumed") { scenario.state == Lifecycle.State.RESUMED }
        }
        scenario.onActivity { activity ->
            assertEquals("Regression must exercise existing Activity rather than recreate", identity, System.identityHashCode(activity))
            println("N17 resumed same activity=$identity task=${activity.taskId} pid=${android.os.Process.myPid()}")
        }
    }

    private fun withUi(
        configure: (DynamicCoordinatorDeviceTest.Harness) -> Unit = {},
        action: (DynamicCoordinatorDeviceTest.Harness, ActivityHandle) -> Unit
    ) {
        DynamicCoordinatorDeviceTest.Harness("back-navigation-fixture").use { harness ->
            harness.network = UpdateNetwork(false, false)
            configure(harness)
            val owner = harness.owner()
            val coordinatorField = UpdateCoordinator::class.java.getDeclaredField("instance").apply { isAccessible = true }
            val runtimeField = ResourceRuntime::class.java.getDeclaredField("instance").apply { isAccessible = true }
            val oldCoordinator = coordinatorField.get(null)
            val oldRuntime = runtimeField.get(null)
            val runtime = ResourceRuntime::class.java.getDeclaredConstructor(Context::class.java)
                .apply { isAccessible = true }.newInstance(harness.context)
            ResourceRuntime::class.java.getDeclaredField("store").apply { isAccessible = true }.set(runtime, harness.builtin)
            ResourceRuntime::class.java.getDeclaredField("dynamicStore").apply { isAccessible = true }.set(runtime, harness.dynamic)
            coordinatorField.set(null, owner)
            runtimeField.set(null, runtime)
            try {
                ActivityHandle().use { scenario ->
                    scenario.launch()
                    awaitLobby(scenario)
                    action(harness, scenario)
                }
            } finally {
                owner.presence(false, false)
                owner.closeVerification()
                coordinatorField.set(null, oldCoordinator)
                runtimeField.set(null, oldRuntime)
            }
        }
    }

    private fun stageBuiltin(h: DynamicCoordinatorDeviceTest.Harness) {
        val game = h.fixture.catalog.games.single { it.id == "light" }
        val archive = java.io.File(h.fixture.root, "n17-builtin-update.zip").apply { writeBytes(h.fixture.archiveBytes("light")) }
        h.builtin.install(game, h.fixture.envelope, archive)
        assertEquals("builtin", h.builtin.selection("light").active)
        assertEquals(game.identity, h.builtin.selection("light").ready)
        println("N17 builtin before first open: ${h.builtin.selection("light")}")
    }

    private fun stageDynamic(h: DynamicCoordinatorDeviceTest.Harness) {
        h.installFirst()
        h.current = h.fixture.dynamicRelease(sequence = 2, code = 2)
        val game = h.current.first.games.single()
        val archive = java.io.File(h.fixture.root, "n17-dynamic-update.zip").apply { writeBytes(h.current.third) }
        h.dynamic.install(game, h.current.second, archive)
        assertTrue(h.dynamic.selection("memory-demo").active.startsWith("1-"))
        assertEquals(game.identity, h.dynamic.selection("memory-demo").ready)
        println("N17 dynamic before first open: ${h.dynamic.selection("memory-demo")}")
    }

    private fun verifyUpdatedReturn(h: DynamicCoordinatorDeviceTest.Harness, scenario: ActivityHandle, id: String) {
        val store = if (id == "light") h.builtin else h.dynamic
        open(scenario, id)
        assertTrue("Actual ready->active promotion", store.selection(id).active.startsWith("2-"))
        assertNull(store.selection(id).ready)
        println("N17 after first open: id=$id ${store.selection(id)}")
        if (id == "memory-demo") {
            assertEquals("true", js(scenario, "(()=>{document.querySelector('#restart').click();document.querySelector('#cards button').click();return JSON.parse(localStorage.getItem('memory-demo-state-v1')).open[0]===0})()"))
        } else {
            assertEquals("true", js(scenario, "(()=>{localStorage.setItem('n17-return-proof','kept');return localStorage.getItem('n17-return-proof')==='kept'})()"))
        }
        back()
        try { awaitLobby(scenario) } finally { println("N17 after updated game BACK: id=$id activityState=${scenario.state}") }
        open(scenario, id)
        val proof = if (id == "memory-demo") "JSON.parse(localStorage.getItem('memory-demo-state-v1')).open[0]===0"
            else "localStorage.getItem('n17-return-proof')==='kept'"
        assertEquals("progress preserved after return/reentry", "true", js(scenario, proof))
        back()
        awaitLobby(scenario)
    }

    @Test fun firstActivatedBuiltinUpdateReturnsToLobby() = withUi(::stageBuiltin) { h, scenario ->
        verifyUpdatedReturn(h, scenario, "light")
    }

    @Test fun firstActivatedDynamicUpdateReturnsToLobby() = withUi(::stageDynamic) { h, scenario ->
        verifyUpdatedReturn(h, scenario, "memory-demo")
    }

    @Test fun lobbyBackResumeThenFirstUpdatedBuiltinBackReturnsToLobby() = withUi(::stageBuiltin) { h, scenario ->
        backgroundAndResumeSameActivity(scenario)
        verifyUpdatedReturn(h, scenario, "light")
    }

    @Test fun lobbyBackResumeThenFirstUpdatedDynamicBackReturnsToLobby() = withUi(::stageDynamic) { h, scenario ->
        backgroundAndResumeSameActivity(scenario)
        verifyUpdatedReturn(h, scenario, "memory-demo")
    }

    @Test fun gameHistoryReturnsBeforeLobby() = withUi { _, scenario ->
        open(scenario, "turing")
        println("N17 history before navigation: ${js(scenario, "JSON.stringify({url:location.href,ready:document.readyState,length:history.length})")}")
        // Native WebView back history must be tested with an actual user navigation,
        // not a script-only assignment that the browser can omit from Back UI history.
        val link = JSONObject(js(scenario, "(()=>{const a=document.querySelector('a.campaign-link');if(!a)throw new Error('Missing actual campaign link');a.scrollIntoView({block:'center'});const r=a.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,scale:devicePixelRatio}})()"))
        val screen = IntArray(2)
        scenario.onActivity { (field(it, "webView") as WebView).getLocationOnScreen(screen) }
        val x = screen[0] + (link.getDouble("x") * link.getDouble("scale")).toInt()
        val y = screen[1] + (link.getDouble("y") * link.getDouble("scale")).toInt()
        println("N17 actual campaign link system tap: $x,$y")
        shell("input tap $x $y")
        try {
            await("actual campaign navigation committed") {
                var canGoBack = false
                scenario.onActivity { canGoBack = (field(it, "webView") as? WebView)?.canGoBack() == true }
                canGoBack && js(scenario, "document.readyState==='complete' && location.pathname.endsWith('/campaign.html')") == "true"
            }
        } finally {
            println("N17 history after navigation: ${js(scenario, "JSON.stringify({url:location.href,ready:document.readyState,length:history.length})")}")
            scenario.onActivity {
                val web = field(it, "webView") as? WebView
                val history = web?.copyBackForwardList()
                println("N17 history state: failed=${field(it,"loadFailed")} canGoBack=${web?.canGoBack()} count=${history?.size} index=${history?.currentIndex} url=${history?.currentItem?.url} overlay=${field(it,"overlay")}")
            }
        }
        back()
        await("actual web history before lobby") { js(scenario, "location.pathname.endsWith('/index.html')") == "true" }
        back()
        awaitLobby(scenario)
    }

    @Test fun loadingBackCancelsLateOpenAndNextOpenReturnsToLobby() = withUi { _, scenario ->
        scenario.onActivity { activity ->
            @Suppress("UNCHECKED_CAST")
            val card = (field(activity, "gameCards") as Map<String, View>).getValue("light")
            card.performClick()
            activity.onBackPressedDispatcher.onBackPressed()
        }
        awaitLobby(scenario)
        Thread.sleep(1200)
        awaitLobby(scenario)
        open(scenario, "light")
        back()
        awaitLobby(scenario)
    }

    @Test fun repeatedBackgroundResumeAndRecreateKeepGameBackWorking() = withUi { _, scenario ->
        repeat(2) {
            backgroundAndResumeSameActivity(scenario)
            open(scenario, "light")
            scenario.recreate()
            awaitGame(scenario)
            back()
            awaitLobby(scenario)
        }
    }
}
