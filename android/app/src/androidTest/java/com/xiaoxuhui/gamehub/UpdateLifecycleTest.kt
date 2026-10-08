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
    @Test fun blockedCrossGameNavigationKeepsVerifiedDownloadedSessionAndDoesNotQuarantineIt() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val networkError = captureBlockedNetworkError(context)
        ResourceDeviceFixture(context).use { fixture ->
            fixture.install("light")
            val session = fixture.store.openSession("light", true)
            val before = fixture.store.selection("light")
            val runtime = ResourceRuntime.get(context)
            ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                scenario.onActivity { activity ->
                    UpdateCoordinator.get(context).presence(true, false, false)
                    MainActivity::class.java.getDeclaredField("resourceRuntime").apply { isAccessible = true }.set(activity, runtime)
                    val games = MainActivity::class.java.getDeclaredField("games").apply { isAccessible = true }.get(activity) as List<*>
                    val game = games.first { item -> item!!.javaClass.getDeclaredField("id").apply { isAccessible = true }.get(item) == "light" }!!
                    MainActivity::class.java.getDeclaredMethod("openGamePrepared", game.javaClass, android.os.Bundle::class.java, ResourceSession::class.java, ResourceRuntime::class.java)
                        .apply { isAccessible = true }.invoke(activity, game, null, session, runtime)
                    val field = MainActivity::class.java.getDeclaredField("webView").apply { isAccessible = true }
                    val view = field.get(activity) as WebView
                    val request = object : android.webkit.WebResourceRequest {
                        override fun getUrl() = android.net.Uri.parse("https://appassets.androidplatform.net/assets/games/conway/index.html")
                        override fun isForMainFrame() = true
                        override fun isRedirect() = false
                        override fun hasGesture() = true
                        override fun getMethod() = "GET"
                        override fun getRequestHeaders() = emptyMap<String, String>()
                    }
                    assertTrue(view.webViewClient.shouldOverrideUrlLoading(view, request))
                    assertSame(view, field.get(activity))
                    view.webViewClient.onReceivedHttpError(view, request, android.webkit.WebResourceResponse("text/html", "UTF-8", 404, "Not Found", emptyMap(), java.io.ByteArrayInputStream(byteArrayOf())))
                    assertSame(view, field.get(activity))
                    view.webViewClient.onReceivedError(view, request, networkError)
                    assertSame(view, field.get(activity))
                    assertFalse(texts(activity.window.decorView).contains("返回大厅并管理资源"))
                }
                assertTrue(fixture.store.hasSessions())
                assertEquals(before, fixture.store.selection("light"))
            }
            assertFalse(fixture.store.hasSessions())
            assertEquals(before, fixture.store.selection("light"))
        }
    }
    @Test fun loadingErrorDestroysActualViewRejectsOldBridgeAndKeepsActualLightSave() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        lateinit var bridge: Any
        lateinit var save: java.lang.reflect.Method
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            fun openLight() = scenario.onActivity { activity ->
                val card = find(activity.window.decorView) { it is TextView && it.text.toString() == "光学游戏" }!!
                assertTrue((card.parent as View).performClick())
            }
            fun js(script: String): String {
                var result = "null"; val done = java.util.concurrent.CountDownLatch(1)
                scenario.onActivity { activity ->
                    val view = find(activity.window.decorView) { it is WebView } as? WebView
                    if (view == null) done.countDown() else view.evaluateJavascript(script) { result = it; done.countDown() }
                }
                assertTrue(done.await(5, java.util.concurrent.TimeUnit.SECONDS)); return result
            }
            fun awaitLight() {
                val deadline = System.currentTimeMillis() + 20000
                while (js("typeof window.LightStorage !== 'undefined'") != "true" && System.currentTimeMillis() < deadline) Thread.sleep(100)
                assertEquals("true", js("typeof window.LightStorage !== 'undefined'"))
            }
            openLight(); awaitLight()
            assertEquals("true", js("(()=>{const s=LightStorage.createStore();s.load();s.replace({schema:'light-game/save',version:1,stars:{'level-1':1},boards:{},snapshots:[]});return s.persist()})()"))
            scenario.onActivity { activity ->
                val type = MainActivity::class.java.declaredClasses.single { it.simpleName == "SaveBridge" }
                bridge = type.getDeclaredConstructor(MainActivity::class.java).apply { isAccessible = true }.newInstance(activity)
                save = type.getDeclaredMethod("saveFile", String::class.java, String::class.java).apply { isAccessible = true }
                val currentView = find(activity.window.decorView) { it is WebView } as WebView
                val failedUrl = android.net.Uri.parse(currentView.url)
                val request = object : android.webkit.WebResourceRequest {
                    override fun getUrl() = failedUrl
                    override fun isForMainFrame() = true
                    override fun isRedirect() = false
                    override fun hasGesture() = false
                    override fun getMethod() = "GET"
                    override fun getRequestHeaders() = emptyMap<String, String>()
                }
                currentView.webViewClient.onReceivedHttpError(currentView, request, android.webkit.WebResourceResponse("text/html", "UTF-8", 404, "Not Found", emptyMap(), java.io.ByteArrayInputStream(byteArrayOf())))
                val view = MainActivity::class.java.getDeclaredField("webView").apply { isAccessible = true }
                assertNull(view.get(activity)); assertFalse(find(activity.window.decorView) { it is WebView } != null)
                assertTrue(texts(activity.window.decorView).contains("返回大厅并管理资源"))
            }
            assertFalse(ResourceRuntime.get(context).store.hasSessions())
            assertEquals(false, save.invoke(bridge, "stale-session.json", "{}"))
            scenario.onActivity { activity -> find(activity.window.decorView) { it is TextView && it.text.toString() == "返回大厅" }!!.performClick() }
            openLight(); awaitLight()
            assertEquals("true", js("LightStorage.createStore().load().stars['level-1'] === 1"))
        }
    }
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
                    render.invoke(activity, snapshot.copy(resourcesRemembered = true))
                    assertTrue(texts(activity.window.decorView).any { it.contains("已下载") && it.contains("上次发现更新 · 待检查") })
                    val column = android.widget.LinearLayout(activity)
                    val dialog = android.app.AlertDialog.Builder(activity).create()
                    val details = MainActivity::class.java.getDeclaredMethod("renderUpdateDetails", android.widget.LinearLayout::class.java, UpdateSnapshot::class.java, android.app.AlertDialog::class.java).apply { isAccessible = true }
                    val apk = ReleaseApk("0.4.0", 42, 1234, "a".repeat(64))
                    details.invoke(activity, column, snapshot.copy(apk = apk, apkRemembered = true, resourcesRemembered = true), dialog)
                    assertTrue(texts(column).any { it.contains("上次发现大厅 v0.4.0") })
                    assertFalse(texts(column).any { it.startsWith("下载大厅") })
                    details.invoke(activity, column, snapshot.copy(apk = apk), dialog)
                    assertTrue(texts(column).any { it.startsWith("下载大厅 v0.4.0") })
                }
                scenario.onActivity { activity ->
                    render.invoke(activity, snapshot)
                    val labels = texts(activity.window.decorView)
                    assertTrue(labels.any { it.contains("已下载") && it.contains("#3 可更新") })
                    assertFalse(labels.any { it.contains("99.0.0") })
                }
                fixture.store.quarantineFailedIdentity("light", fixture.catalog.games.single { it.id == "light" }.identity)
                snapshot = snapshot.copy(localResources = fixture.store.describeAll())
                scenario.onActivity { activity ->
                    render.invoke(activity, snapshot)
                    assertTrue(texts(activity.window.decorView).any { it.contains("已下载") && it.contains("失败已隔离 · 待恢复") })
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
    private fun captureBlockedNetworkError(context: android.content.Context): android.webkit.WebResourceError {
        val done = java.util.concurrent.CountDownLatch(1)
        val captured = java.util.concurrent.atomic.AtomicReference<android.webkit.WebResourceError>()
        lateinit var probe: WebView
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        instrumentation.runOnMainSync {
            probe = WebView(context)
            probe.settings.blockNetworkLoads = true
            probe.webViewClient = object : android.webkit.WebViewClient() {
                override fun onReceivedError(view: WebView, request: android.webkit.WebResourceRequest, error: android.webkit.WebResourceError) {
                    if (request.isForMainFrame) { captured.set(error); done.countDown() }
                }
            }
            probe.loadUrl("https://invalid.example/game-hub-network-block-probe")
        }
        try { assertTrue("Real blocked-network error must arrive", done.await(10, java.util.concurrent.TimeUnit.SECONDS)); return captured.get() }
        finally { instrumentation.runOnMainSync { probe.destroy() } }
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
