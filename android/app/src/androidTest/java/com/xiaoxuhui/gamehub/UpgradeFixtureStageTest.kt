package com.xiaoxuhui.gamehub

import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest

/** Copies only an explicitly supplied local test APK asset; no production or public distribution asset. */
class UpgradeFixtureStageTest {
    @Test fun stageSameSignerFixtureForPrivatePreflight() {
        val arguments = InstrumentationRegistry.getArguments()
        org.junit.Assume.assumeTrue("Requires signed fixture controller", arguments.getString("stageFixture") == "true")
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        assertEquals("0.4.0", context.packageManager.getPackageInfo(context.packageName, 0).versionName)
        val target = File(context.cacheDir, "updates/fixture.apk")
        assertTrue(target.parentFile!!.isDirectory || target.parentFile!!.mkdirs())
        instrumentation.context.assets.open("newer-fixture.apk").use { input -> FileOutputStream(target).use { output -> input.copyTo(output); output.fd.sync() } }
        val actual = MessageDigest.getInstance("SHA-256").digest(target.readBytes()).joinToString("") { "%02x".format(it) }
        assertEquals(arguments.getString("fixtureSha256"), actual)
    }
}
