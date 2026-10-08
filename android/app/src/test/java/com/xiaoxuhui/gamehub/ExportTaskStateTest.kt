package com.xiaoxuhui.gamehub

import org.junit.Assert.*
import org.junit.Test

class ExportTaskStateTest {
    @Test fun selectedFileStaysBusyUntilMatchingWriterCompletes() {
        val state = ExportTaskState(); val export = DocumentExport("one.json", "{}")
        assertTrue(state.offer(export)); assertTrue(state.busy())
        assertSame(export, state.pending()); assertSame(export, state.selected())
        assertNull(state.pending()); assertTrue(state.busy())
        assertNull(state.selected()); assertFalse(state.cancel())
        assertFalse(state.offer(DocumentExport("two.json", "{}")))
        assertFalse(state.finished(export.copy())); assertTrue(state.busy())
        assertTrue(state.finished(export)); assertFalse(state.busy())
        assertTrue(state.offer(DocumentExport("two.json", "{}")))
        assertFalse(state.finished(export)); assertTrue(state.busy())
    }
    @Test fun cancelledPickerAndEmptyRequestsDoNotReserveAWriter() {
        val state = ExportTaskState()
        assertFalse(state.offer(DocumentExport("empty.json", ""))); assertFalse(state.busy())
        assertTrue(state.offer(DocumentExport("cancel.json", "{}")))
        assertTrue(state.cancel()); assertFalse(state.busy()); assertNull(state.selected())
        assertTrue(state.offer(DocumentExport("retry.json", "{}")))
    }
}
