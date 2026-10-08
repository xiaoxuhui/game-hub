package com.xiaoxuhui.gamehub

import android.content.res.AssetManager
import android.net.Uri
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream

internal class GameContentResolver(private val assets: AssetManager, val gameId: String, private val session: ResourceSession,
    builtinPaths: Set<String>) {
    private val prefix = "/assets/games/$gameId/"
    private val metadata = session.game?.files?.associateBy { prefix + it.path }
    val allowedPaths: Set<String> = metadata?.keys ?: builtinPaths.filter { it.startsWith(prefix) }.toSet()
    fun allowed(uri: Uri) = AssetAccessPolicy.resourceAllowed(uri.scheme, uri.host, uri.port, uri.encodedPath, uri.path, allowedPaths)
    fun response(uri: Uri): WebResourceResponse {
        if (!allowed(uri)) return blocked()
        val path = uri.path!!; val relative = path.removePrefix(prefix)
        return try {
            val type = metadata?.get(path)?.mime ?: ResourcePolicy.mime(relative)
            val input = if (session.root == null) assets.open(path.removePrefix("/assets/")) else java.io.File(session.root, relative).inputStream()
            WebResourceResponse(type, if (type.startsWith("text/") || type in setOf("application/javascript", "application/json", "image/svg+xml")) "UTF-8" else null,
                200, "OK", mapOf("Cache-Control" to "no-store", "X-Content-Type-Options" to "nosniff"), input)
        } catch (error: Exception) { blocked() }
    }
    companion object {
        fun blocked() = WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream("Blocked unregistered resource".toByteArray()))
    }
}
