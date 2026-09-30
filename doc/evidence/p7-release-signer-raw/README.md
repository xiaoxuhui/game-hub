# P7 发行证书模拟器验证的命令输出

这些文件是 Android 34 AOSP 模拟器测试中的非秘密输出。`install-base.txt`、`package-before.txt`、`marker-before.txt`、`install-upgrade.txt`、`package-after.txt`、`marker-after.txt`、`launch-after.txt` 是升级时保存的 `adb` 输出。`apksigner-*.txt` 和 `aapt-*.txt` 是同一两包 APK 在复审批改时重新执行 `apksigner verify --verbose --print-certs`、`aapt dump badging` 的输出；两类命令均返回零。`emulator-smoke-output.txt` 是独立检出中的 `scripts/emulator_smoke.py` 对 0.2.1 夹具的完整标准输出及错误输出，`emulator-smoke-exit.txt` 保存其进程退出码。

安装和标记文件未逐条保存退出码，但保留了命令的实际输出；不要把它们表述为带退出码的逐命令转录。烟测脚本在四入口与返回之后还执行手动查询和 320dp/1.5 倍字体检查，只有通过这些步骤才会以零退出。该脚本在 `finally` 中写出四入口 JSON，因此仅看 JSON 不足以判定整轮通过。

对应的基包、夹具 SHA-256、证书指纹及测试范围见上级目录的 `p7-release-signer-upgrade.txt`。这里没有真实公开 Release 的下载或系统安装 UI 记录。

受检 APK（本机独立目录，复核时重新计算 SHA-256）：

| 对象 | 路径 | SHA-256 |
| --- | --- | --- |
| 基包 0.2.0/code2 | `D:\soft\.ci-tmp\game-hub-p7-license-candidate\game-hub.apk` | `164717f00ce0be2727fc1dac85c4aabe94bdd1063c868514914e20e2e946858a` |
| 夹具 0.2.1/code3 | `D:\soft\game-hub-build-p7\emulator-fixtures\fixture-0.2.1.apk` | `751df010914693edbc1ae5cccde91e1f8176161e19221f872856271248d9c4af` |

私有标记文件路径为 `/data/user/0/com.xiaoxuhui.gamehub/files/upgrade-marker.txt`，内容为 `p7-release-marker-20261001`。以下是依据保存的输出整理的**复现命令模板**，不是逐条原始终端转录；先以 `adb root` 获得本次 AOSP 模拟器的读写能力。测试时标记在安装基包后写入，并在覆盖夹具后再次读取。

```text
apksigner verify --verbose --print-certs BASE.apk
apksigner verify --verbose --print-certs FIXTURE.apk
aapt dump badging BASE.apk
aapt dump badging FIXTURE.apk
adb install -r BASE.apk
adb shell dumpsys package com.xiaoxuhui.gamehub
adb root
adb shell "printf p7-release-marker-20261001 > /data/user/0/com.xiaoxuhui.gamehub/files/upgrade-marker.txt"
adb shell cat /data/user/0/com.xiaoxuhui.gamehub/files/upgrade-marker.txt
adb install -r FIXTURE.apk
adb shell dumpsys package com.xiaoxuhui.gamehub
adb shell cat /data/user/0/com.xiaoxuhui.gamehub/files/upgrade-marker.txt
python scripts/emulator_smoke.py FIXTURE.apk
```

原始输出中的 `package-before/after.txt` 保留 `dumpsys` 返回的末尾空行；这是原样归档，不代表新增的断言或测试结果。
