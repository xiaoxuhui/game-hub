package com.xiaoxuhui.gamehub

import android.os.Bundle
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Simulates a file disappearing after session verification; no production catalog or state is written. */
class DynamicErrorDeviceTest {
    @Test fun missingDynamicEntryShowsErrorAndClosesSessionWithoutBuiltinIdCrash() {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val root=File(context.cacheDir,"dynamic-missing-entry-${UUID.randomUUID()}").apply {mkdirs()}
        val released=CountDownLatch(1)
        val game=ResourceGame("memory-demo","fixture",97,"https://github.com/xiaoxuhui/game-hub.git","a".repeat(40),4,100,
            DynamicGamePolicy.contract("memory-demo"),"index.html",1,1,"0".repeat(64),listOf(ResourceFile("index.html",1,"0".repeat(64),"text/html")),
            "Post-verification missing-file fixture",2,1)
        val session=ResourceSession(game,root){released.countDown()}
        try {
            ActivityScenario.launch(MainActivity::class.java).use {scenario ->
                scenario.onActivity {activity ->
                    val runtime=ResourceRuntime.get(activity)
                    MainActivity::class.java.getDeclaredField("resourceRuntime").apply {isAccessible=true}.set(activity,runtime)
                    val type=MainActivity::class.java.declaredClasses.single {it.simpleName=="Game"}
                    val descriptor=type.declaredConstructors.single().apply {isAccessible=true}.newInstance("memory-demo","Missing entry fixture","fixture","a".repeat(40),"index.html")
                    MainActivity::class.java.getDeclaredMethod("openGamePrepared",type,Bundle::class.java,ResourceSession::class.java,ResourceRuntime::class.java)
                        .apply {isAccessible=true}.invoke(activity,descriptor,null,session,runtime)
                }
                assertTrue("Missing entry must close the failed session",released.await(20,TimeUnit.SECONDS))
                scenario.onActivity {activity ->
                    assertTrue(MainActivity::class.java.getDeclaredField("loadFailed").apply {isAccessible=true}.getBoolean(activity))
                    assertNull(MainActivity::class.java.getDeclaredField("webView").apply {isAccessible=true}.get(activity))
                    assertNotNull(MainActivity::class.java.getDeclaredField("overlay").apply {isAccessible=true}.get(activity))
                }
            }
        } finally {session.close();require(requireNotNull(root.parentFile).canonicalFile==context.cacheDir.canonicalFile);root.deleteRecursively()}
    }
}
