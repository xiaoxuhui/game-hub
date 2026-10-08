# v0.4.0 N0 独立规划首审

- 受审提交：`d7a3a8921931dfc6986493b13f2f8cc401ac85b3`。
- 范围：`doc/需求与测试用例-v0.4.0.md`、`doc/设计文档-v0.4.0.md`、`doc/实施计划-v0.4.0.md`、`doc/自我评审-v0.4.0.md`，并只读对照现有 Android 资源解析、仓库和 WebView 配置。未构建或修改主仓库及四原游戏仓库。提交只含规划与证据，没有 v0.4 功能或发行实现。

## 阻塞 N1 前应批改的规划问题

1. **P1：派生子域没有完整隔离 Cookie。** 设计 D3（第 27、31 行）以 `<id>.appassets.androidplatform.net` 为独立 origin，并用它承诺动态游戏与四原游戏数据隔离；U51（需求第 37 行）只要求资源请求拒绝。现有 `MainActivity.kt` 开启 DOM 存储、未配置 `CookieManager`；[Android 官方文档](https://developer.android.com/reference/android/webkit/CookieManager#setAcceptCookie(boolean))说明 WebView 默认接受 Cookie，[HTTP Cookie 域规则](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies#define_where_cookies_are_sent)允许子域设置父域 Cookie 并被兄弟子域读取。因而 origin 分开足以隔离 localStorage/IndexedDB，却不足以直接推导 Cookie 隔离。应明定 cookie 策略，例如确认四旧游戏不依赖 Cookie 后全局禁用；N3 增加实际 WebView 中动态↔动态、动态↔旧域的父域 Cookie 读写负例，并验证旧游戏存档回归。不应仅以跨资源 404 推断存储隔离。
2. **P1：退役条目的资产归属规则未定义可执行的发行形态。** 原提交设计 D1 第 9、11、13 行同时要求每项资产属于固定 v2 Release、历史 ID 永久保留为 `available=false`、每项继续包含完整资产信息。若后续 Release 不再携带已退役 ZIP，则完整目录会因退役条目归属失败；若携带，则需把保留历史资产列为发行规则。建议固定同一 v2 Release，追加新 ZIP 且保留退役资产 ID/字节，最后替换签名目录；禁止对 `available=false` 首装/更新。未来换 Release 前必须搬迁累计历史资产。U47/U48 加退役资产缺失、退役下载拒绝、历史编号重放负例。主执行端已回复拟采用此方案，待批改提交复核。

## 非阻塞但应纳入验收的项目

3. **P2：旧代理和 CacheStorage 的重装边界需明确。** 设计 D3 第 31 行仅写“新源码禁止 Service Worker/缓存代理”及“缓存门禁针对当前 origin”，但稳定 origin 会让卸载前的注册、控制器或缓存继续存在。N3/U54 应注入真实受控 Service Worker 和旧资源响应，验证移除/重装后页面只能从已验签 resolver 取资源；无法解除时应拒绝加载而非展示旧缓存。缓存清理不得触碰 localStorage/IndexedDB 或其他游戏的 origin。已有 v1 M3 门禁可复用，但动态域必须实测。
4. **P2：阶段状态早于门禁。** 实施计划 N0（第 9–13 行）标 `[COMPLETE]`，同一 DoD 却把“提交后独立审阅批改闭环”列为完成条件。首审尚未闭环时宜标 `IN_REVIEW`/`PENDING`，批改及复审完成后再标完成；自评文档自身 `COMPLETE` 已清楚限定为自评完成，可保留。

## 已具可行性的规划边界

- v1 固定四游戏与 v2 动态目录分通道，v0.3 客户端不解析 v2，正式 latest 仅供 APK；明确三通道单独退避与失败隔离。
- 动态资源先手动安装、已安装才自动更新，移除保留 WebView 数据、阻止运行会话中移除；独立状态根和共享 300 MiB 预算均有 N2/N4 与 U46/U54/U56/U60 验收。
- 自有示范游戏先提交旧完整 SHA 再构建候选，避免来源锁自引用；U63/U64 将临时签名夹具与正式生产公钥在线局部更新区分。真机、TalkBack 和异机密钥恢复保留未完成边界，没有冒称已通过。

**首审结论：** N0 规划尚有两项 P1 安全/协议规则要批改，四项意见闭环后可进入 N1。此结论只针对规划，不表示任何 U45–U64 功能已实现或发行通过。
