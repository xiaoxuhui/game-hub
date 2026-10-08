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
