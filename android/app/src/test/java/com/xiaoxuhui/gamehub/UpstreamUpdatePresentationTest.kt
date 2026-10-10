package com.xiaoxuhui.gamehub

import org.junit.Assert.*
import org.junit.Test

class UpstreamUpdatePresentationTest {
    private val release = UpstreamCheck(UpstreamPublication("1.2.1", 42), 100, null)
    private fun describe(check: UpstreamCheck? = release, actual: String? = "1.2.0", known: Boolean = true,
        catalog: String? = "1.2.0", issue: String? = null, eligible: Boolean = false,
        ready: String? = null, fresh: Boolean = false) = UpstreamUpdatePresentation.describe(check, actual, known, catalog, issue, eligible, ready, fresh)

    @Test fun newerSourceWithOlderCatalogIsPendingProductionNotCurrent() {
        val view = describe(); assertTrue(view.update); assertTrue(view.text.contains("1.2.1")); assertTrue(view.text.contains("资源包待制作"))
        assertFalse(view.text.contains("最新版")); assertFalse(view.text.contains("可更新"))
    }
    @Test fun onlyFreshEligibleMatchingCatalogCanSayInstallable() {
        assertTrue(describe(catalog = "1.2.1", eligible = true).text.contains("签名资源可更新"))
        for (reason in listOf("目录过期", "资源已停用", "存档合同不兼容", "固定版本", "资源已隔离")) {
            val view = describe(catalog = "1.2.1", issue = reason, eligible = true)
            assertTrue(view.text.contains(reason)); assertFalse(view.text.contains("可更新")); assertFalse(view.text.contains("最新版"))
        }
        assertTrue(describe(catalog = "1.2.1").text.contains("暂不可安装"))
    }
    @Test fun readyDoesNotPretendToBeActiveAndExpiredCandidateIsExplicit() {
        val view = describe(ready = "1.2.1", fresh = true)
        assertTrue(view.update); assertTrue(view.text.contains("已安装 v1.2.0")); assertTrue(view.text.contains("待生效"))
        assertTrue(describe(ready = "1.2.1").text.contains("已过期"))
        assertFalse(describe(ready = "1.2.1", fresh = true, issue = "固定版本").text.contains("待生效"))
    }
    @Test fun unknownFailedOfflineAndHistoricalStatesNeverClaimFreshness() {
        for (check in listOf(null, UpstreamCheck(), release.copy(issue = "离线"), release.copy(issue = "查询失败"))) {
            val view = describe(check = check); assertFalse(view.update); assertFalse(view.text.contains("已核对")); assertFalse(view.text.contains("可更新"))
        }
        assertTrue(describe(check = release.copy(issue = "离线")).text.contains("上次源发布"))
        assertTrue(describe(check = release.copy(publication = null, checkedAt = null, issue = "未找到正式发布")).text.contains("未找到正式发布"))
    }
    @Test fun uninstalledOrUnverifiedLocalVersionCannotBeLatest() {
        assertTrue(describe(actual = null).text.contains("尚未安装")); assertFalse(describe(actual = null).text.contains("已核对"))
        assertTrue(describe(actual = null, known = false).text.contains("本地实际版本未核验"))
        assertTrue(describe(actual = null, ready = "1.2.1", fresh = true).text.contains("待生效"))
    }
    @Test fun equalOrNewerInstalledShowsExactComparisonAndAnyResourceIssue() {
        for (actual in listOf("1.2.1", "1.2.2")) {
            val view = describe(actual = actual, issue = "目录过期")
            assertFalse(view.update); assertTrue(view.text.contains("已安装 v$actual")); assertTrue(view.text.contains("源正式发布 v1.2.1"))
            assertTrue(view.text.contains("目录过期")); assertFalse(view.text.contains("最新版"))
        }
    }
    @Test fun malformedResourceOrLocalVersionIsUnknownRatherThanCrashingUi() {
        for (view in listOf(describe(actual = "bad"), describe(catalog = "01.2.1"), describe(ready = "1.2.1-preview"))) {
            assertTrue(view.text.contains("格式待核验")); assertFalse(view.update)
        }
    }
}
