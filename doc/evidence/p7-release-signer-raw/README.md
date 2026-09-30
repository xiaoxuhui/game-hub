# P7 发行证书模拟器验证的命令输出

这些文件是 Android 34 AOSP 模拟器测试中的非秘密输出。`install-base.txt`、`package-before.txt`、`marker-before.txt`、`install-upgrade.txt`、`package-after.txt`、`marker-after.txt`、`launch-after.txt` 是升级时保存的 `adb` 输出。`apksigner-*.txt` 和 `aapt-*.txt` 是同一两包 APK 在复审批改时重新执行 `apksigner verify --verbose --print-certs`、`aapt dump badging` 的输出；两类命令均返回零。`emulator-smoke-output.txt` 是独立检出中的 `scripts/emulator_smoke.py` 对 0.2.1 夹具的完整标准输出及错误输出，`emulator-smoke-exit.txt` 保存其进程退出码。

安装和标记文件未逐条保存退出码，但保留了命令的实际输出；不要把它们表述为带退出码的逐命令转录。烟测脚本在四入口与返回之后还执行手动查询和 320dp/1.5 倍字体检查，只有通过这些步骤才会以零退出。该脚本在 `finally` 中写出四入口 JSON，因此仅看 JSON 不足以判定整轮通过。

对应的基包、夹具 SHA-256、证书指纹及测试范围见上级目录的 `p7-release-signer-upgrade.txt`。这里没有真实公开 Release 的下载或系统安装 UI 记录。
