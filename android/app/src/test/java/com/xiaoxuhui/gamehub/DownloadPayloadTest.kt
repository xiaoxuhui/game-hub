package com.xiaoxuhui.gamehub

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

class DownloadPayloadTest {
    @Test fun hashesExactBytesAndRejectsOversizedPayload() {
        val output = ByteArrayOutputStream()
        val (size, digest) = DownloadPayload.copy(ByteArrayInputStream("abc".toByteArray()), output, 3, { false }) { _, _ -> }
        assertEquals(3L, size)
        assertEquals("abc", output.toString("UTF-8"))
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", digest)
        assertThrows(IllegalStateException::class.java) {
            DownloadPayload.copy(ByteArrayInputStream("abcd".toByteArray()), ByteArrayOutputStream(), 3, { false }) { _, _ -> }
        }
    }

    @Test fun cancelledTransferNeverReturnsAValidatedResult() {
        assertThrows(IllegalStateException::class.java) {
            DownloadPayload.copy(ByteArrayInputStream("abc".toByteArray()), ByteArrayOutputStream(), 3, { true }) { _, _ -> }
        }
    }
}
