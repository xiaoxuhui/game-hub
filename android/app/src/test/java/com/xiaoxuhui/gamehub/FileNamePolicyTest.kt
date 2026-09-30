package com.xiaoxuhui.gamehub

import org.junit.Assert.assertEquals
import org.junit.Test

class FileNamePolicyTest {
    @Test fun stripsPathAndControlCharacters() {
        assertEquals(".._level_.json", FileNamePolicy.sanitize("../level?.json"))
        assertEquals("a_b_c.json", FileNamePolicy.sanitize("a/b\\c.json"))
        assertEquals("a_b.json", FileNamePolicy.sanitize("a\u0000b.json"))
    }

    @Test fun suppliesFallbackAndLimitsLength() {
        assertEquals("game-hub-export.json", FileNamePolicy.sanitize(".."))
        assertEquals("game-hub-export.json", FileNamePolicy.sanitize("   "))
        assertEquals(120, FileNamePolicy.sanitize("a".repeat(200)).length)
    }
}
