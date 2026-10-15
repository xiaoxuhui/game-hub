package com.xiaoxuhui.gamehub

import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assume.assumeTrue
import org.junit.Test

/** Run explicitly against the same-certificate formal baseline, then install -r the repair candidate. */
class BackNavigationUpgradeDeviceTest {
    @Test fun actualSignedApkUpgradePreservesGameplayAndBack() {
        val args = InstrumentationRegistry.getArguments()
        val mode = args.getString("n17Upgrade")
        assumeTrue("Explicit two-install upgrade controller required", mode != null)
        BackNavigationDeviceTest().upgradeStorageStep(requireNotNull(mode), requireNotNull(args.getString("n17ApkSha256")))
    }
}
