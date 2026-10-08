package com.xiaoxuhui.gamehub

internal object AssetAccessPolicy {
    private const val DOMAIN = "appassets.androidplatform.net"
    private val builtinIds = setOf("conway", "eml", "light", "turing")
    fun hostFor(id: String): String {
        if (id in builtinIds) return DOMAIN
        require(DynamicGamePolicy.validId(id)) { "Invalid dynamic origin identity" }
        return "$id.$DOMAIN"
    }
    fun isAppAssetHost(host: String?) = host == DOMAIN || host?.endsWith(".$DOMAIN") == true
    private fun trustedHost(host: String) = host == DOMAIN ||
        host.endsWith(".$DOMAIN") && DynamicGamePolicy.validId(host.removeSuffix(".$DOMAIN"))

    fun resourceAllowed(
        scheme: String?,
        host: String?,
        port: Int,
        encodedPath: String?,
        path: String?,
        registeredPaths: Set<String>,
        expectedHost: String = DOMAIN
    ): Boolean {
        if (!trustedHost(expectedHost) || scheme != "https" || host != expectedHost || port != -1) return false
        if (encodedPath == null || encodedPath.contains('%') || encodedPath.contains('\\')) return false
        return path != null && path in registeredPaths
    }

    fun pageAllowed(gameId: String, path: String?, registeredPaths: Set<String>): Boolean {
        return path != null && path in registeredPaths &&
            path.startsWith("/assets/games/$gameId/") && path.endsWith(".html")
    }
}
