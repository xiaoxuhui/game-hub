package com.xiaoxuhui.gamehub

import java.io.File

/** Metadata-only accounting shared by both stores; never follow links or lock the other store. */
internal object ResourceDiskBudget {
    fun usedBytes(root: File): Long {
        ResourcePathGuard.requireUnlinked(root)
        if (!root.exists()) return 0
        if (root.isFile) return root.length()
        require(root.isDirectory)
        var total = 0L
        for (child in root.listFiles() ?: error("Cannot inspect resource budget")) {
            val bytes = usedBytes(child)
            require(bytes >= 0 && total <= Long.MAX_VALUE - bytes)
            total += bytes
        }
        return total
    }
}
