package com.xiaoxuhui.gamehub

import androidx.test.core.app.ActivityScenario
import org.junit.Assert.assertTrue
import org.junit.Test

class GameEntryReadyTest {
    @Test fun announcesEntryOnlyAfterGamePageResponds() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                val games = MainActivity::class.java.getDeclaredField("games").apply { isAccessible = true }.get(activity) as List<*>
                val game = games.first()!!
                MainActivity::class.java.getDeclaredMethod("openGame", game.javaClass, android.os.Bundle::class.java)
                    .apply { isAccessible = true }.invoke(activity, game, null)
            }
            var ready = false
            val deadline = System.currentTimeMillis() + 30000
            while (!ready && System.currentTimeMillis() < deadline) {
                Thread.sleep(100)
                scenario.onActivity { activity ->
                    val dialogs = MainActivity::class.java.getDeclaredField("gameDialogs").apply { isAccessible = true }.get(activity) as Set<*>
                    ready = MainActivity::class.java.getDeclaredField("gamePageReady").apply { isAccessible = true }.getBoolean(activity) &&
                        MainActivity::class.java.getDeclaredField("gameEntryAnnounced").apply { isAccessible = true }.getBoolean(activity) && dialogs.isNotEmpty()
                }
            }
            assertTrue("game never became responsive and announced entry", ready)
        }
    }
}
