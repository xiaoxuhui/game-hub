package com.xiaoxuhui.gamehub

import android.view.View
import android.view.ViewGroup
import android.app.AlertDialog
import android.webkit.WebView
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.lifecycle.Lifecycle
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

    @Test fun earlyReturnCancelsOldOpenAndKeepsOtherGamesAvailable() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                val card = find(activity.window.decorView) { it is TextView && it.text.toString() == "光学游戏" }!!
                assertTrue((card.parent as View).performClick())
                val back = find(activity.window.decorView) { it is android.widget.Button && it.text.toString() == "返回大厅" }!!
                assertTrue(back.performClick())
            }
            Thread.sleep(3_000)
            scenario.onActivity { activity ->
                val lobby = MainActivity::class.java.getDeclaredField("lobby").apply { isAccessible = true }.get(activity) as View
                assertEquals(View.VISIBLE, lobby.visibility)
                assertNull(find(activity.window.decorView) { it is WebView })
                assertNotNull(find(activity.window.decorView) { it is TextView && it.text.toString() == "康威生命游戏" })
            }
        }
    }

    @Test fun backgroundAndResumeDoesNotTreatElapsedTimeAsHang() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                val card = find(activity.window.decorView) { it is TextView && it.text.toString() == "光学游戏" }!!
                assertTrue((card.parent as View).performClick())
                val liveness = MainActivity::class.java.getDeclaredField("gameLiveness").apply { isAccessible = true }.get(activity) as GameLiveness
                liveness.progress(android.os.SystemClock.uptimeMillis() - 31_000)
            }
            scenario.moveToState(Lifecycle.State.CREATED)
            Thread.sleep(3_000)
            scenario.moveToState(Lifecycle.State.RESUMED)
            Thread.sleep(4_000)
            scenario.onActivity { activity ->
                val lobby = MainActivity::class.java.getDeclaredField("lobby").apply { isAccessible = true }.get(activity) as View
                assertNotEquals("game should remain open after resume", View.VISIBLE, lobby.visibility)
            }
        }
    }

    @Test fun javascriptDialogsPauseWatchdogAndPromptReturnsInput() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                val card = find(activity.window.decorView) { it is TextView && it.text.toString() == "光学游戏" }!!
                assertTrue((card.parent as View).performClick())
            }
            val readyDeadline = System.currentTimeMillis() + 30_000
            var ready = false
            while (!ready && System.currentTimeMillis() < readyDeadline) {
                scenario.onActivity { activity -> ready = MainActivity::class.java.getDeclaredField("gamePageReady").apply { isAccessible = true }.getBoolean(activity) }
                if (!ready) Thread.sleep(200)
            }
            assertTrue("game ready", ready)
            val promptDone = CountDownLatch(1)
            var promptValue: String? = null
            scenario.onActivity { activity ->
                val view = find(activity.window.decorView) { it is WebView } as WebView
                view.evaluateJavascript("prompt('test prompt','initial')") { promptValue = it; promptDone.countDown() }
            }
            var dialog: AlertDialog? = null
            val dialogDeadline = System.currentTimeMillis() + 10_000
            while (dialog == null && System.currentTimeMillis() < dialogDeadline) {
                scenario.onActivity { activity ->
                    @Suppress("UNCHECKED_CAST")
                    val dialogs = MainActivity::class.java.getDeclaredField("gameDialogs").apply { isAccessible = true }.get(activity) as Set<AlertDialog>
                    dialog = dialogs.firstOrNull()
                }
                if (dialog == null) Thread.sleep(100)
            }
            assertNotNull("prompt shown", dialog)
            scenario.onActivity { activity ->
                val liveness = MainActivity::class.java.getDeclaredField("gameLiveness").apply { isAccessible = true }.get(activity) as GameLiveness
                liveness.progress(android.os.SystemClock.uptimeMillis() - 31_000)
            }
            Thread.sleep(4_000)
            scenario.onActivity { activity ->
                assertTrue(dialog!!.isShowing)
                assertNotNull(find(activity.window.decorView) { it is WebView })
                val input = find(dialog!!.window!!.decorView) { it is android.widget.EditText } as android.widget.EditText
                input.setText("kept")
                dialog!!.getButton(AlertDialog.BUTTON_POSITIVE).performClick()
            }
            assertTrue("prompt callback", promptDone.await(5, TimeUnit.SECONDS))
            assertEquals("\"kept\"", promptValue)
        }
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
