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
}
