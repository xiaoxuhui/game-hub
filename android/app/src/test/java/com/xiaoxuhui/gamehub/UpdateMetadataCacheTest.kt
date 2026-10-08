package com.xiaoxuhui.gamehub

import org.junit.Assert.*
import org.junit.Test

class UpdateMetadataCacheTest {
    private class Memory : ResourceStateFile {
        var bytes: ByteArray? = null
        var fail = false
        override fun read() = bytes?.clone()
        override fun write(bytes: ByteArray) { check(!fail); this.bytes = bytes.clone() }
    }
    private val apk = ReleaseApk("0.4.0", 42, 1234, "a".repeat(64))
    @Test fun recreatedReminderKeepsOriginalTimeAndSuppressesAlreadyInstalledApk() {
        val file = Memory(); val resources = Memory()
        assertNull(UpdateMetadataCache(file, resources).readApk("0.3.0", 100))
        UpdateMetadataCache(file, resources).saveApk(apk, 100)
        val recreated = UpdateMetadataCache(file, resources)
        assertEquals(RememberedApk(100, apk), recreated.readApk("0.3.0", 500))
        assertEquals(RememberedApk(100, null), recreated.readApk("0.4.0", 500))
        assertEquals(RememberedApk(100, null), recreated.readApk("0.5.0", 500))
        recreated.saveApk(null, 200)
        assertEquals(RememberedApk(200, null), recreated.readApk("0.3.0", 500))
    }
    @Test fun malformedFutureAndForgedApkMetadataAreRejected() {
        val file = Memory(); val cache = UpdateMetadataCache(file, Memory())
        cache.saveApk(apk, 400000)
        assertThrows(IllegalArgumentException::class.java) { cache.readApk("0.3.0", 100) }
        cache.saveApk(apk, 100); val original = String(file.bytes!!)
        for (raw in listOf(original.replace("1234", "0"), original.replace("0.4.0", "bad"),
            original.replace("a".repeat(64), "invalid-digest"), original.replace("\"checkedAt\":100", "\"checkedAt\":\"100\""),
            original.replace("\"schemaVersion\":1", "\"schemaVersion\":1,\"schemaVersion\":1"), " ".repeat(32769))) {
            file.bytes = raw.toByteArray()
            assertThrows(Exception::class.java) { cache.readApk("0.3.0", 500) }
        }
    }
    @Test fun resourceTimeBelongsToExactSignedCatalogNotANewerOrDifferentDirectory() {
        val cache = UpdateMetadataCache(Memory(), Memory())
        val catalog = ResourceCatalog(2, "a".repeat(64), 10, 1, 200, emptyList())
        assertNull(cache.readResources(catalog, 500))
        cache.saveResources(catalog, 100)
        assertEquals(100L, cache.readResources(catalog, 500)) // Historical expiry is never made fresh.
        assertNull(cache.readResources(catalog.copy(sequence = 3), 500))
        assertNull(cache.readResources(catalog.copy(payloadSha256 = "b".repeat(64)), 500))
        assertThrows(IllegalArgumentException::class.java) { catalog.requireFresh(500) }
    }
    @Test fun failedAtomicReplacementKeepsThePreviousReminder() {
        val file = Memory(); val cache = UpdateMetadataCache(file, Memory())
        cache.saveApk(apk, 100); file.fail = true
        assertThrows(IllegalStateException::class.java) { cache.saveApk(apk.copy(version = "0.5.0"), 200) }
        assertEquals(RememberedApk(100, apk), UpdateMetadataCache(file, Memory()).readApk("0.3.0", 500))
    }
}
