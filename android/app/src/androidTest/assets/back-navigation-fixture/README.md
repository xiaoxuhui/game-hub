# Immutable navigation regression fixture

This test-only directory contains the original public memory-demo resource #1.
It is packaged only in the instrumentation APK, never in the installed game-hub APK.

- Source commit: 80898b3ba78ea51a62533c42362f00a4e37421f1, examples/memory-demo.
- Public asset: https://github.com/xiaoxuhui/game-hub/releases/download/game-resources-v2/game-memory-demo-1-27f1df3b689e.zip
- ZIP SHA-256: 27f1df3b689e6b4592cbfcae4a80e759a274cfd7857e2764ac2203d27bb0876b.
- License: MIT; the original LICENSE is inside the ZIP.
- games.json is the corresponding public game entry from the first signed v2 catalog.

ResourceDeviceFixture verifies the exact ZIP hash and file allowlist, then signs
private test candidates with an ephemeral key. No release private key is included.
The navigation regression is self-contained and does not need a local private
archive, network download or the optional generated dynamic-demo-fixture.

Run on the pinned API34 AOSP image with Launcher3. The test uses the real launcher
icon, system Back and actual WebView interaction, not ActivityScenario's task launch.
