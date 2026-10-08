package com.xiaoxuhui.gamehub

import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test

class UpdateLifecycleTest {
    @Test fun localRecoveryCommitsOffUiAndPersistsAcrossStoreRecreation() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val coordinator = UpdateCoordinator.get(context)
        val runtime = ResourceRuntime.get(context)
        val original = runtime.store.selection("light")
        val violations = java.util.concurrent.CopyOnWriteArrayList<android.os.strictmode.Violation>()
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            val deadline = System.currentTimeMillis() + 45000
            while (coordinator.snapshot().busy && System.currentTimeMillis() < deadline) Thread.sleep(50)
            assertFalse(coordinator.snapshot().busy)
            scenario.onActivity {
                val gate = UpdateCoordinator::class.java.getDeclaredField("gate").apply { isAccessible = true }.get(coordinator) as UpdateTaskGate
                gate.setNetwork(UpdateNetwork(false, false))
                val previous = android.os.StrictMode.getThreadPolicy()
                if (android.os.Build.VERSION.SDK_INT >= 28) android.os.StrictMode.setThreadPolicy(android.os.StrictMode.ThreadPolicy.Builder().detectDiskWrites()
                    .penaltyListener(java.util.concurrent.Executor { task -> task.run() }) { violations.add(it) }.build())
                try { assertTrue(coordinator.changeLocal("light", LocalResourceAction.RESTORE_BUILTIN)) }
                finally { android.os.StrictMode.setThreadPolicy(previous) }
            }
            while (coordinator.snapshot().busy && System.currentTimeMillis() < deadline) Thread.sleep(50)
            assertFalse(coordinator.snapshot().busy); assertTrue(violations.isEmpty())
            val reopened = GameResourceStore(java.io.File(context.filesDir, "game-resources"), runtime.hostCode, runtime.publicKey)
            assertEquals("builtin", reopened.selection("light").active); assertTrue(reopened.selection("light").pinned)
            assertTrue(coordinator.snapshot().resourceStatus.contains("已恢复并固定"))
            if (!original.pinned) {
                scenario.onActivity { assertTrue(coordinator.changeLocal("light", LocalResourceAction.RESUME)) }
                while (coordinator.snapshot().busy && System.currentTimeMillis() < deadline) Thread.sleep(50)
                assertFalse(coordinator.snapshot().busy); assertFalse(runtime.store.selection("light").pinned)
            }
        }
    }
    @Test fun unknownAndFailedLocalScanNeverClaimBuiltinOrRemoteUpdates() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        ResourceDeviceFixture(context).use { fixture ->
            ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                val render = MainActivity::class.java.getDeclaredMethod("renderUpdates", UpdateSnapshot::class.java).apply { isAccessible = true }
                scenario.onActivity { activity ->
                    render.invoke(activity, UpdateSnapshot(catalogGames = fixture.catalog.games))
                    var labels = texts(activity.window.decorView)
                    assertEquals(4, labels.count { it == "本地资源核验中" })
                    assertFalse(labels.any { it.contains("内置") || it.contains("可更新") })
                    render.invoke(activity, UpdateSnapshot(localLoaded = true, localReadError = "Injected scan failure", catalogGames = fixture.catalog.games))
                    labels = texts(activity.window.decorView)
                    assertEquals(4, labels.count { it == "本地状态不可用 · 待恢复" })
                    assertFalse(labels.any { it.contains("内置") || it.contains("可更新") })
                    render.invoke(activity, UpdateSnapshot(localResources = fixture.store.describeAll(), localLoaded = true))
                    assertEquals(4, texts(activity.window.decorView).count { it.contains("内置") })
                }
            }
        }
    }
    @Test fun oneOfFourRenewalFailuresDoesNotPreventOthersAndClearsAfterItsSuccess() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        ResourceDeviceFixture(context).use { fixture ->
            fixture.catalog.games.forEach { fixture.install(it.id) }
            val changed = fixture.renewal(3, "light")
            fixture.store.acceptCatalog(changed); fixture.store.refreshReadyProof(changed)
            assertTrue(fixture.store.failure()!!.startsWith("light："))
            fixture.catalog.games.forEach { game ->
                val proof = java.io.File(fixture.root, "store/versions/${game.id}/${game.identity}/catalog.signed.json").readBytes()
                assertArrayEquals(if (game.id == "light") fixture.envelope else changed, proof)
                assertEquals(game, fixture.store.describeAll().getValue(game.id).ready)
            }
            val valid = fixture.renewal(4)
            fixture.store.acceptCatalog(valid); fixture.store.refreshReadyProof(valid)
            assertNull(fixture.store.failure())
            fixture.catalog.games.forEach { game ->
                assertArrayEquals(valid, java.io.File(fixture.root, "store/versions/${game.id}/${game.identity}/catalog.signed.json").readBytes())
            }
        }
    }
    @Test fun cardsDisplayActualCandidateAndActiveVersionsWithoutPromotingRemoteVersion() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        ResourceDeviceFixture(context).use { fixture ->
            fixture.install("light")
            ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                val render = MainActivity::class.java.getDeclaredMethod("renderUpdates", UpdateSnapshot::class.java).apply { isAccessible = true }
                var snapshot = UpdateCoordinator.get(context).snapshot().copy(localResources = fixture.store.describeAll(), catalogGames = fixture.catalog.games)
                scenario.onActivity { activity ->
                    render.invoke(activity, snapshot)
                    assertTrue(texts(activity.window.decorView).any { it.contains("#2 待生效") })
                    assertTrue(texts(activity.window.decorView).any { it.contains("内置") })
                }
                fixture.store.openSession("light", true).close()
                val remote = fixture.catalog.games.map { if (it.id == "light") it.copy(version = "99.0.0", contentCode = 3) else it }
                snapshot = snapshot.copy(localResources = fixture.store.describeAll(), catalogGames = remote)
                scenario.onActivity { activity ->
                    render.invoke(activity, snapshot)
                    val labels = texts(activity.window.decorView)
                    assertTrue(labels.any { it.contains("已下载") && it.contains("#3 可更新") })
                    assertFalse(labels.any { it.contains("99.0.0") })
                }
            }
        }
    }
    @Test fun stoppedActivitySaveBridgeRejectsBeforeOpeningExternalFlow() {
        lateinit var bridge: Any
        lateinit var activity: MainActivity
        lateinit var method: java.lang.reflect.Method
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { current ->
                activity = current
                val type = MainActivity::class.java.declaredClasses.single { it.simpleName == "SaveBridge" }
                bridge = type.getDeclaredConstructor(MainActivity::class.java).apply { isAccessible = true }.newInstance(current)
                method = type.getDeclaredMethod("saveFile", String::class.java, String::class.java).apply { isAccessible = true }
            }
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED)
            assertEquals(false, method.invoke(bridge, "must-not-open.json", "{}"))
            val pending = MainActivity::class.java.getDeclaredField("pendingExport").apply { isAccessible = true }
            assertNull(pending.get(activity))
        }
    }
    @Test fun settingsPersistWithoutUiThreadDiskWrites() {
        if (android.os.Build.VERSION.SDK_INT < 28) return
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val coordinator = UpdateCoordinator.get(instrumentation.targetContext)
        val original = coordinator.snapshot()
        val violations = java.util.concurrent.CopyOnWriteArrayList<android.os.strictmode.Violation>()
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity {
                val previous = android.os.StrictMode.getThreadPolicy()
                android.os.StrictMode.setThreadPolicy(android.os.StrictMode.ThreadPolicy.Builder().detectDiskWrites()
                    .penaltyListener(java.util.concurrent.Executor { task -> task.run() }) { violations.add(it) }.build())
                try { assertTrue(coordinator.settings(!original.automatic, original.metered)) }
                finally { android.os.StrictMode.setThreadPolicy(previous) }
            }
            val deadline = System.currentTimeMillis() + 10000
            while (coordinator.snapshot().settingsSaving && System.currentTimeMillis() < deadline) Thread.sleep(50)
            assertFalse(coordinator.snapshot().settingsSaving)
            assertEquals(!original.automatic, coordinator.snapshot().automatic)
            assertTrue("No synchronous UI disk writes allowed: $violations", violations.isEmpty())
            assertTrue(coordinator.settings(original.automatic, original.metered))
            while (coordinator.snapshot().settingsSaving && System.currentTimeMillis() < deadline) Thread.sleep(50)
            assertFalse(coordinator.snapshot().settingsSaving)
        }
    }
    @Test fun trackedConfirmationIsDismissedOnStopAndDoesNotReopenOnRotation() {
        lateinit var dialog: android.app.AlertDialog
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                dialog = android.app.AlertDialog.Builder(activity).setTitle("测试更新确认").setPositiveButton("继续", null).create()
                val track = MainActivity::class.java.getDeclaredMethod("trackConfirmation", android.app.AlertDialog::class.java)
                track.isAccessible = true; track.invoke(activity, dialog)
                assertTrue(dialog.isShowing)
            }
            scenario.recreate()
            assertFalse(dialog.isShowing)
            scenario.onActivity { activity ->
                val field = MainActivity::class.java.getDeclaredField("updateDialogs").apply { isAccessible = true }
                assertTrue((field.get(activity) as Set<*>).isEmpty())
            }
        }
    }
    private fun find(view: View, predicate: (View) -> Boolean): View? {
        if (predicate(view)) return view
        if (view is ViewGroup) for (i in 0 until view.childCount) find(view.getChildAt(i), predicate)?.let { return it }
        return null
    }
    private fun texts(view: View): List<String> = if (view is ViewGroup) (0 until view.childCount).flatMap { texts(view.getChildAt(it)) } else if (view is TextView) listOf(view.text.toString()) else emptyList()
    @Test fun lobbyIsImmediatelyUsableAndRotationKeepsOneCoordinator() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val coordinator = UpdateCoordinator.get(instrumentation.targetContext)
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                val visible = texts(activity.window.decorView)
                for (name in listOf("康威生命游戏", "EML 计算台", "光学游戏", "图灵机实验台")) assertTrue("Missing card: $name", name in visible)
                assertFalse(visible.any { it.startsWith("正在校验") || it.startsWith("正在打开") })
                assertSame(coordinator, UpdateCoordinator.get(activity))
            }
            scenario.recreate()
            scenario.onActivity { activity ->
                assertSame(coordinator, UpdateCoordinator.get(activity))
                assertTrue(texts(activity.window.decorView).any { it == "检查更新" || it == "更新详情" })
            }
        }
    }
    @Test fun startupChecksDoNotBlockOpeningActualOfflineGame() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                val label = find(activity.window.decorView) { it is TextView && it.text.toString() == "光学游戏" }!!
                assertTrue((label.parent as View).performClick())
            }
            var ready = false
            val deadline = System.currentTimeMillis() + 20000
            while (!ready && System.currentTimeMillis() < deadline) {
                val result = java.util.concurrent.CountDownLatch(1)
                scenario.onActivity { activity ->
                    val view = find(activity.window.decorView) { it is WebView } as? WebView
                    if (view == null) result.countDown() else view.evaluateJavascript("typeof window.LightStorage !== 'undefined'") { value -> ready = value == "true"; result.countDown() }
                }
                assertTrue(result.await(5, java.util.concurrent.TimeUnit.SECONDS))
                if (!ready) Thread.sleep(100)
            }
            assertTrue("Actual LightStorage must load while startup metadata is handled separately", ready)
        }
    }
}
