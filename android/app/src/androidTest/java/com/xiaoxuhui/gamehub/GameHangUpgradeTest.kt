package com.xiaoxuhui.gamehub

import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Run with the production certificate on the old APK and again after install -r. */
class GameHangUpgradeTest {
    private fun find(view: View, predicate: (View) -> Boolean): View? {
        if (predicate(view)) return view
        if (view is ViewGroup) for (i in 0 until view.childCount) find(view.getChildAt(i), predicate)?.let { return it }
        return null
    }

    @Test fun oldSaveSurvivesSignedUpgrade() {
        val mode = InstrumentationRegistry.getArguments().getString("v054Upgrade")
        assumeTrue("requires explicit signed upgrade controller", mode != null)
        require(mode == "seed" || mode == "verify")
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        assertEquals(if (mode == "seed") "0.5.3" else "0.5.4", info.versionName)
        assertEquals(if (mode == "seed") 11L else 12L, info.longVersionCode)
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                val text = find(activity.window.decorView) { it is TextView && it.text.toString() == "光学游戏" }!!
                assertTrue((text.parent as View).performClick())
            }
            fun js(source: String): String? {
                val latch = CountDownLatch(1); var result: String? = null
                scenario.onActivity { activity ->
                    val view = find(activity.window.decorView) { it is WebView } as? WebView
                    if (view == null) latch.countDown() else view.evaluateJavascript(source) { result = it; latch.countDown() }
                }
                return if (latch.await(5, TimeUnit.SECONDS)) result else null
            }
            val deadline = System.currentTimeMillis() + 30_000
            var ready = false
            while (!ready && System.currentTimeMillis() < deadline) {
                ready = js("location.pathname.startsWith('/assets/games/light/') && document.readyState === 'complete'") == "true"
                if (!ready) Thread.sleep(200)
            }
            assertTrue("old or new game must load", ready)
            if (mode == "seed") {
                assertEquals("\"saved-before-upgrade\"", js("localStorage.setItem('v054-upgrade-sentinel','saved-before-upgrade');localStorage.getItem('v054-upgrade-sentinel')"))
                Thread.sleep(1_500)
            } else {
                assertEquals("\"saved-before-upgrade\"", js("localStorage.getItem('v054-upgrade-sentinel')"))
                js("localStorage.removeItem('v054-upgrade-sentinel')")
            }
        }
    }
}
