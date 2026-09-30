package com.xiaoxuhui.gamehub

internal object AssetAccessPolicy {
    private const val DOMAIN = "appassets.androidplatform.net"

    fun resourceAllowed(
        scheme: String?,
        host: String?,
        port: Int,
        encodedPath: String?,
        path: String?,
        registeredPaths: Set<String>
    ): Boolean {
        if (scheme != "https" || host != DOMAIN || port != -1) return false
        if (encodedPath == null || encodedPath.contains('%') || encodedPath.contains('\\')) return false
        return path != null && path in registeredPaths
    }

    fun pageAllowed(gameId: String, path: String?, registeredPaths: Set<String>): Boolean {
        return path != null && path in registeredPaths &&
            path.startsWith("/assets/games/$gameId/") && path.endsWith(".html")
    }
}
