#!/usr/bin/env bash
set -euo pipefail

package=com.xiaoxuhui.gamehub
evidence=update-upgrade-evidence
mkdir -p "$evidence"

adb install -r emulator-fixtures/base.apk
adb install -r -t emulator-fixtures/test.apk
adb push emulator-fixtures/fixture.apk /data/local/tmp/game-hub-fixture.apk
adb shell run-as "$package" mkdir -p cache/updates files
adb shell run-as "$package" cp /data/local/tmp/game-hub-fixture.apk cache/updates/fixture.apk
adb shell run-as "$package" touch files/upgrade-marker.txt

adb shell am instrument -w -e class "$package.UpdateFixtureTest" "$package.test/androidx.test.runner.AndroidJUnitRunner" | tee "$evidence/instrumentation.txt"
grep -q 'OK (1 test)' "$evidence/instrumentation.txt"

adb install -r emulator-fixtures/fixture.apk | tee "$evidence/upgrade-install.txt"
adb shell dumpsys package "$package" > "$evidence/package-after-upgrade.txt"
grep 'versionCode=5' "$evidence/package-after-upgrade.txt"
adb shell run-as "$package" ls files/upgrade-marker.txt | tee "$evidence/preserved-data.txt"
