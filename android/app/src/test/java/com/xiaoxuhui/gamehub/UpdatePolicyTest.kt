package com.xiaoxuhui.gamehub

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class UpdatePolicyTest {
    private fun release(tag: String = "v0.2.0", digest: String = "sha256:${"a".repeat(64)}", size: Long = 1234,
                        id: Long = 42, name: String = "game-hub.apk", prerelease: Boolean = false) = """
        {"tag_name":"$tag","draft":false,"prerelease":$prerelease,
         "assets":[{"id":$id,"name":"$name","size":$size,"digest":"$digest"}]}
    """.trimIndent()

    @Test fun acceptsOnlyNewerOfficialApkAndUsesAssetIdUrl() {
        val apk = UpdatePolicy.parseLatest(release(), "0.1.0")!!
        assertEquals("0.2.0", apk.version)
        assertEquals("a".repeat(64), apk.sha256)
        assertEquals("https://api.github.com/repos/xiaoxuhui/game-hub/releases/assets/42", apk.apiUrl)
        assertNull(UpdatePolicy.parseLatest(release("v0.1.0"), "0.1.0"))
        assertNull(UpdatePolicy.parseLatest(release("v0.0.9"), "0.1.0"))
    }

    @Test fun rejectsMissingOrUntrustedMetadataBeforeDownload() {
        for (raw in listOf(release(name = "other.apk"), release(digest = ""), release(size = 0),
                           release(size = 200L * 1024 * 1024), release(id = -1),
                           release(tag = "v0.2.0-rc1"), release(tag = "0.2.0"), release(prerelease = true))) {
            assertThrows(IllegalStateException::class.java) { UpdatePolicy.parseLatest(raw, "0.1.0") }
        }
    }
}
