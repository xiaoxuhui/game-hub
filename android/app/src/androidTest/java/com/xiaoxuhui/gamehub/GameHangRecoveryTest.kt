package com.xiaoxuhui.gamehub

import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class GameHangRecoveryTest {
    private fun find(view: View, predicate: (View) -> Boolean): View? {
        if (predicate(view)) return view
        if (view is ViewGroup) for (index in 0 until view.childCount) find(view.getChildAt(index), predicate)?.let { return it }
        return null
    }

    @Test fun infiniteLoopIsSkippedOtherGameOpensAndSavedDataSurvives() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            fun open(name: String) = scenario.onActivity { activity ->
                val text = find(activity.window.decorView) { it is TextView && it.text.toString() == name }!!
                assertTrue((text.parent as View).performClick())
            }
            fun javascript(source: String): String? {
                var result: String? = null
                val latch = CountDownLatch(1)
                scenario.onActivity { activity ->
                    val view = find(activity.window.decorView) { it is WebView } as? WebView
                    if (view == null) latch.countDown() else view.evaluateJavascript(source) { result = it; latch.countDown() }
                }
                return if (latch.await(5, TimeUnit.SECONDS)) result else null
            }
            fun waitReady(game: String) {
                val deadline = System.currentTimeMillis() + 30_000
                while (System.currentTimeMillis() < deadline) {
                    if (javascript("location.pathname.startsWith('/assets/games/$game/') && document.readyState === 'complete'") == "true") return
                    Thread.sleep(200)
                }
                fail("game did not load")
            }
            open("光学游戏"); waitReady("light")
            assertEquals("\"saved\"", javascript("localStorage.setItem('v054-recovery-test','saved');localStorage.getItem('v054-recovery-test')"))
            javascript("setTimeout(function(){while(true){}},0); 'started'")
            val deadline = System.currentTimeMillis() + 50_000
            var returned = false
            while (System.currentTimeMillis() < deadline && !returned) {
                scenario.onActivity { activity ->
                    val lobby = MainActivity::class.java.getDeclaredField("lobby").apply { isAccessible = true }.get(activity) as View
                    returned = lobby.visibility == View.VISIBLE && find(activity.window.decorView) { it is WebView } == null
                }
                if (!returned) Thread.sleep(250)
            }
            assertTrue("unresponsive game should return to the lobby", returned)
            open("康威生命游戏"); waitReady("conway")
            scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
            open("光学游戏"); waitReady("light")
            assertEquals("\"saved\"", javascript("localStorage.getItem('v054-recovery-test')"))
            javascript("localStorage.removeItem('v054-recovery-test')")
        }
    }
}
