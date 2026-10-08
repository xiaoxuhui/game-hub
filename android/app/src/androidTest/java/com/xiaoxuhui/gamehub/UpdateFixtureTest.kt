package com.xiaoxuhui.gamehub

import android.content.Intent
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.security.MessageDigest

@RunWith(AndroidJUnit4::class)
class UpdateFixtureTest {
    @Test fun newerSameSignerApkPassesPreflightAndProducesSystemInstallerIntent() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val apk = File(context.cacheDir, "updates/fixture.apk")
        assertTrue("CI must copy the second APK into the app cache", apk.isFile)
        val digest = MessageDigest.getInstance("SHA-256").digest(apk.readBytes())
            .joinToString("") { "%02x".format(it) }
        val release = ReleaseApk("0.4.1", 42, apk.length(), digest)
        val updater = ApkUpdateManager(context)
        updater.verifyArchive(apk, release, apk.length(), digest)
        val intent = updater.installationIntent(apk)
        assertEquals(Intent.ACTION_INSTALL_PACKAGE, intent.action)
        assertEquals("content", intent.data?.scheme)
        assertTrue(intent.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION != 0)
        assertEquals(true, intent.getBooleanExtra(Intent.EXTRA_RETURN_RESULT, false))
    }
}
