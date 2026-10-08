package com.xiaoxuhui.gamehub

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AssetAccessPolicyTest {
    private val paths = setOf(
        "/assets/games/conway/index.html",
        "/assets/games/turing/index.html",
        "/assets/games/turing/campaign.html",
        "/assets/games/turing/assets/route-worker.js"
    )

    @Test fun onlyRegisteredHttpsAssetsAreReadable() {
        assertTrue(AssetAccessPolicy.resourceAllowed("https", "appassets.androidplatform.net", -1, "/assets/games/turing/assets/route-worker.js", "/assets/games/turing/assets/route-worker.js", paths))
        assertFalse(AssetAccessPolicy.resourceAllowed("http", "appassets.androidplatform.net", -1, "/assets/games/turing/index.html", "/assets/games/turing/index.html", paths))
        assertFalse(AssetAccessPolicy.resourceAllowed("https", "example.org", -1, "/assets/games/turing/index.html", "/assets/games/turing/index.html", paths))
        assertFalse(AssetAccessPolicy.resourceAllowed("https", "appassets.androidplatform.net", 8443, "/assets/games/turing/index.html", "/assets/games/turing/index.html", paths))
        assertFalse(AssetAccessPolicy.resourceAllowed("https", "appassets.androidplatform.net", -1, "/assets/games/turing/missing.js", "/assets/games/turing/missing.js", paths))
    }

    @Test fun encodedTraversalAndCrossGameTopLevelNavigationAreRejected() {
        assertFalse(AssetAccessPolicy.resourceAllowed("https", "appassets.androidplatform.net", -1, "/assets/games/turing/%2e%2e/conway/index.html", "/assets/games/conway/index.html", paths))
        assertFalse(AssetAccessPolicy.resourceAllowed("https", "appassets.androidplatform.net", -1, "/assets/games/turing\\index.html", "/assets/games/turing/index.html", paths))
        assertTrue(AssetAccessPolicy.pageAllowed("turing", "/assets/games/turing/campaign.html", paths))
        assertFalse(AssetAccessPolicy.pageAllowed("turing", "/assets/games/conway/index.html", paths))
        assertFalse(AssetAccessPolicy.pageAllowed("turing", "/assets/games/turing/assets/route-worker.js", paths))
    }
    @Test fun dynamicOriginIsDerivedFromLegalIdentityAndKeepsOldFourOrigins() {
        for (id in listOf("conway","eml","light","turing")) assertTrue(AssetAccessPolicy.hostFor(id)=="appassets.androidplatform.net")
        assertTrue(AssetAccessPolicy.hostFor("memory-demo")=="memory-demo.appassets.androidplatform.net")
        for (id in listOf("../other","memory.demo","https://evil","Memory-demo","")) {
            assertTrue(runCatching {AssetAccessPolicy.hostFor(id)}.isFailure)
        }
        assertTrue(AssetAccessPolicy.isAppAssetHost("other-demo.appassets.androidplatform.net"))
        assertFalse(AssetAccessPolicy.isAppAssetHost("appassets.androidplatform.net.evil"))
    }
    @Test fun dynamicResourceRequestsCannotReadParentSiblingOrArbitraryHosts() {
        val path="/assets/games/memory-demo/index.html";val own=setOf(path);val host=AssetAccessPolicy.hostFor("memory-demo")
        assertTrue(AssetAccessPolicy.resourceAllowed("https",host,-1,path,path,own,host))
        for (other in listOf("appassets.androidplatform.net","other-demo.appassets.androidplatform.net","example.com")) {
            assertFalse(AssetAccessPolicy.resourceAllowed("https",other,-1,path,path,own,host))
        }
        assertFalse(AssetAccessPolicy.resourceAllowed("https","example.com",-1,path,path,own,"example.com"))
        assertFalse(AssetAccessPolicy.resourceAllowed("https",host,443,path,path,own,host))
        assertFalse(AssetAccessPolicy.resourceAllowed("https",host,-1,"/assets/games/memory-demo/%69ndex.html",path,own,host))
    }
}
