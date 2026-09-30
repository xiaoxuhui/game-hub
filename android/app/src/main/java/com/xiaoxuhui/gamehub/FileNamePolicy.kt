package com.xiaoxuhui.gamehub

internal object FileNamePolicy {
    fun sanitize(name: String): String {
        val cleaned = name.replace(Regex("[\\\\/:*?\"<>|\\x00-\\x1f]"), "_").trim().trimEnd('.')
        val safe = if (cleaned.isBlank() || cleaned == "." || cleaned == "..") "game-hub-export.json" else cleaned
        return safe.take(120)
    }
}
