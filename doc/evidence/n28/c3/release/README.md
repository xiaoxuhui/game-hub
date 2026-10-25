# C3 EML 最终发行证据

producer afcda0eaea0da1745e362f7dcbdd62bf291c78d8，现有v1通道seq4→5，仅EML1.3.1/content2变化。独立READY后正常脚本成功，无中断/重试；未发APK，未动固定标签/v2seq34。

- 两次严格远端生产完整games/candidate相同，实际ZIP31文件全部等于D已审目录，30个proof输出逐项相符；候选24/24，0错误/外域/缺资源，真正资源八键审计通过。
- 精确CI run40234759034/job121293826064成功：Linux159/1 Windows-only skip，本机160。完整收到的日志私有留存，公开元数据/摘录记录原文SHA。
- `preflight-scope.json`记录只读旧目录验签与唯一变化；旧Conway/Light/Turing完整对象含assetId不变。`catalog.signed.json`、`previous.signed.json`保留原字节；published/online/issued-facts保存实际身份。
- 新current asset676157886，原字节SHA155dfa7b60d8c69c7470a28eb6372c1444da90a6b560a1915897a663c0b14027。EML ZIP asset676157535/843507B/SHA6f3dff273d70e47243bce75b167a9ce5ab4b6513deed35b363b903ddc5738935，与被测候选完全相同。
- 严格匿名online核验5份签名目录/9个累计ZIP；独立公网探针再验目录/ZIP及旧三完整对象。CLI468c4488…是payload SHA，不是signed envelope摘要。

日志仅路径占位/LF/行尾空白处理；metadata列原始/公开摘要。浏览器合成CSP/生产桥JS与native stub仍不代表Android WebView、SAF、真机、Safari或离线冷启动。发行后独立终审待完成。
