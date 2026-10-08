package com.xiaoxuhui.gamehub

import android.annotation.SuppressLint
import android.os.Build
import android.system.ErrnoException
import android.system.Os
import android.system.OsConstants
import java.io.File

internal object ResourcePathGuard {
    /** Android API21 lstat covers every ancestor without following links. SDK0 is only the host JVM stub. */
    @SuppressLint("NewApi")
    fun requireUnlinked(file: File) {
        if (Build.VERSION.SDK_INT == 0) { requireHostUnlinked(file); return }
        var current: File? = file.absoluteFile
        while (current != null) {
            try { require(!OsConstants.S_ISLNK(Os.lstat(current.path).st_mode)) { "Resource path contains a link" } }
            catch (error: ErrnoException) { if (error.errno != OsConstants.ENOENT) throw error }
            current = current.parentFile
        }
        require(file.canonicalFile == file.absoluteFile) { "Resource path alias" }
    }
    /** Windows File.canonicalFile does not reliably resolve directory junctions; use actual NIO resolution on host. */
    @SuppressLint("NewApi")
    private fun requireHostUnlinked(file: File) {
        var current = file.toPath().toAbsolutePath().normalize()
        while (!java.nio.file.Files.exists(current, java.nio.file.LinkOption.NOFOLLOW_LINKS)) current = current.parent ?: error("Missing resource root")
        require(current.toRealPath() == current.toAbsolutePath().normalize()) { "Resource path contains a link or junction" }
    }
}
