# N10-B1 HTTP重验证与当前发布资产校验

日期：2026-10-10。独立检出 `D:\soft\.ci-tmp\game-hub-n10\work`，基于规划复审 CLOSED 的 f2a735304b493884dde0eb0b17e56392da5fdaa0。

## 实际红绿过程

1. 新增两个有行为断言的回归，修改生产代码前执行：
   `D:\soft\game-hub-toolchain\gradle-8.7\bin\gradle.bat -p android testDebugUnitTest --tests com.xiaoxuhui.gamehub.UpdatePolicyTest --tests com.xiaoxuhui.gamehub.PublicReleaseHttpTest --console=plain`
   实际6项、2失败、exit1。失败精确落在 `validatesEqualAndOlderPublicationBeforeCallingItCurrent` 与 `everyQueryRevalidatesWithServerAnd304NeedsExistingCache` 的 AssertionError，非编译/环境失败；[原始红日志](n10-b1-red-regressions.log)。
2. 最小修复：同/较旧版本先验证唯一 APK、有效ID/大小/SHA再返回无新版；匿名 HTTP 禁本地缓存并请求 no-cache，保留既有 ETag/服务器304逻辑。
3. `D:\soft\game-hub-toolchain\gradle-8.7\bin\gradle.bat -p android testDebugUnitTest --console=plain` exit0，XML汇总 **84项、0失败、0跳过**；[绿日志](n10-b1-green-jvm.log)。
4. `node --test` exit0，**46项、0失败、0跳过**；[Node日志](n10-b1-node-regressions.log)。`git diff --check` exit0。

回归同时核对真实200→304→新200所返回字节、If-None-Match请求、每次 no-cache/useCaches=false、无缓存304拒绝，以及同/较旧版本分别缺资产/缺SHA/零大小/零ID拒绝。

## 边界

本切片只完成底层两项纠正，未接入六源、未修改UI/版本、未做APK/设备验收、未发行；N10-B仍PENDING。下一切片前须本提交后独立审阅 CLOSED。所有构建在独立检出，原游戏仓库无写入。
