package com.xiaoxuhui.gamehub

import android.content.Context
import android.content.Intent
import android.os.ParcelFileDescriptor
import android.view.KeyEvent
import android.view.View
import android.webkit.WebView
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Real system back/launcher lifecycle, actual signed ready->active installs and production WebViews. */
class BackNavigationDeviceTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()

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

    private fun js(scenario: ActivityScenario<MainActivity>, script: String): String {
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

    private fun awaitGame(scenario: ActivityScenario<MainActivity>) = await("loaded game") {
        scenario.state == Lifecycle.State.RESUMED && js(scenario, "document.readyState==='complete' && location.pathname.includes('/assets/games/')") == "true"
    }

    private fun awaitLobby(scenario: ActivityScenario<MainActivity>) = await("system back must return to lobby; actual state=${scenario.state}") {
        if (scenario.state != Lifecycle.State.RESUMED) false else {
            var visible = false
            scenario.onActivity { activity ->
                visible = field(activity, "currentGame") == null && field(activity, "webView") == null &&
                    (field(activity, "lobby") as View).visibility == View.VISIBLE && !activity.isFinishing
            }
            visible
        }
    }

    private fun open(scenario: ActivityScenario<MainActivity>, id: String) {
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

    private fun backgroundAndResumeSameActivity(scenario: ActivityScenario<MainActivity>) {
        var identity = 0
        scenario.onActivity { activity ->
            identity = System.identityHashCode(activity)
            println("N17 before lobby back: activity=$identity task=${activity.taskId} pid=${android.os.Process.myPid()}")
        }
        back()
        await("launcher root task must move to background") { scenario.state == Lifecycle.State.CREATED }
        val component = "${instrumentation.targetContext.packageName}/.MainActivity"
        println(shell("am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n $component --activity-new-task --activity-reset-task-if-needed"))
        await("same task resumed") { scenario.state == Lifecycle.State.RESUMED }
        scenario.onActivity { activity ->
            assertEquals("Regression must exercise existing Activity rather than recreate", identity, System.identityHashCode(activity))
            println("N17 resumed same activity=$identity task=${activity.taskId} pid=${android.os.Process.myPid()}")
        }
    }

    private fun withUi(
        configure: (DynamicCoordinatorDeviceTest.Harness) -> Unit = {},
        action: (DynamicCoordinatorDeviceTest.Harness, ActivityScenario<MainActivity>) -> Unit
    ) {
        DynamicCoordinatorDeviceTest.Harness().use { harness ->
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
                val launch = instrumentation.targetContext.packageManager.getLaunchIntentForPackage(instrumentation.targetContext.packageName)!!
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
                ActivityScenario.launch<MainActivity>(launch).use { scenario ->
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

    private fun verifyUpdatedReturn(h: DynamicCoordinatorDeviceTest.Harness, scenario: ActivityScenario<MainActivity>, id: String) {
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
        awaitLobby(scenario)
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
        js(scenario, "location.href='campaign.html'")
        await("actual campaign navigation") { js(scenario, "location.pathname.endsWith('/campaign.html')") == "true" }
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
