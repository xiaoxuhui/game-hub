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

    @Test fun allowsOnlyHttpsGithubAssetRedirectHosts() {
        for (url in listOf("https://api.github.com/repos/xiaoxuhui/game-hub/releases/assets/42",
                           "https://release-assets.githubusercontent.com/a?token=123")) {
            assertEquals(true, UpdatePolicy.allowDownloadUrl(url))
        }
        for (url in listOf("http://api.github.com/x", "https://evil.example/x",
                           "https://api.github.com.evil.example/x", "https://user@github.com/x",
                           "https://github.com:444/x")) {
            assertEquals(false, UpdatePolicy.allowDownloadUrl(url))
        }
    }

    @Test fun rejectsWrongDigestPackageVersionAndSignerBeforeInstall() {
        val apk = UpdatePolicy.parseLatest(release(), "0.1.0")!!
        fun check(size: Long = apk.size, digest: String = apk.sha256, name: String = "com.xiaoxuhui.gamehub",
                  code: Long = 2, signers: Set<String> = setOf("certA")) = UpdatePolicy.verifyCandidate(
            apk, size, digest, name, "com.xiaoxuhui.gamehub", code, 1, signers, setOf("certA"))
        check()
        for (action in listOf<() -> Unit>({ check(size = 7) }, { check(digest = "b".repeat(64)) },
                                           { check(name = "other.app") }, { check(code = 1) },
                                           { check(signers = setOf("certB")) })) {
            assertThrows(IllegalStateException::class.java) { action() }
        }
    }
}
