package com.xiaoxuhui.gamehub

internal data class DocumentExport(val name: String, val content: String)

/** A selected document remains busy until its actual output stream has closed. */
internal class ExportTaskState {
    private var pending: DocumentExport? = null
    private var writing: DocumentExport? = null
    @Synchronized fun pending() = pending
    @Synchronized fun busy() = pending != null || writing != null
    @Synchronized fun writing() = writing != null
    @Synchronized fun offer(export: DocumentExport): Boolean {
        if (busy() || export.content.isEmpty()) return false
        pending = export
        return true
    }
    @Synchronized fun selected(): DocumentExport? {
        if (writing != null) return null
        return pending?.also { writing = it; pending = null }
    }
    @Synchronized fun cancel(): Boolean {
        if (writing != null) return false
        pending = null
        return true
    }
    @Synchronized fun finished(export: DocumentExport): Boolean {
        if (writing !== export) return false
        writing = null
        return true
    }
}
