package com.xiaoxuhui.gamehub

import android.util.AtomicFile
import java.io.File
import java.io.ByteArrayOutputStream
import java.io.InputStream

internal object ResourceIo {
    fun readBounded(input: InputStream, limit: Long): ByteArray {
        val output = ByteArrayOutputStream(); val buffer = ByteArray(8192)
        while (true) { val count = input.read(buffer); if (count < 0) break; require(output.size().toLong() + count <= limit) { "Resource read exceeds byte budget" }; output.write(buffer, 0, count) }
        return output.toByteArray()
    }
}

internal interface ResourceStateFile { fun read(): ByteArray?; fun write(bytes: ByteArray) }
internal class AndroidResourceStateFile(file: File) : ResourceStateFile {
    private val atomic = AtomicFile(file)
    override fun read(): ByteArray? = try { atomic.openRead().use { stream ->
        ResourceIo.readBounded(stream, 1048576)
    } } catch (error: java.io.FileNotFoundException) { null }
    override fun write(bytes: ByteArray) {
        val output = atomic.startWrite()
        try { output.write(bytes); atomic.finishWrite(output) } catch (error: Exception) { atomic.failWrite(output); throw error }
    }
}
