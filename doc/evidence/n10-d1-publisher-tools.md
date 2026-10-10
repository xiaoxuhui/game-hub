# N10-D1 继承资源发行工具

- 新`resource-v1-successor.mjs`：固定v1 release407293817/生产DER摘要/4身份/原合同；preflight匿名验证当前签名、全资产分页和干净候选，payload重新捕获真实资产绑定，sign先用生产公钥认证previous及snapshot再读stdin私钥，finally擦除Node key；online用匿名完整字节验证当前与本地签名字节相同、上一目录归档、全部连续历史和所有历史ZIP。
- v1 successor严格seq+1、拒绝内容回退和同code任何元数据/资产变动。更高code仍受固定仓库/entry/storageContract/protocol约束。ZIP先传，旧catalog仅改历史名称并保留asset ID/摘要，新catalog最后激活；未知结果须只读协调，禁止重签/重传覆盖。
- 新`publish-resource-v1-successor.ps1`仅N10，现有v2发行器增加N10范围。均要求精确已推送main、干净检出、fresh evidence child、固定已发布tag、上一目录完整SHA；密钥DPAPI内存解密/管道，无私钥落盘，无共享Git配置修改。GitHub凭据仅任务内显式wincred读取，禁止交互prompt；App继续匿名只读。
- 实际`node --test`：51通过/0失败/0跳过。初轮50/51，因为测试把candidate给定assetId当成不可变签名资产ID；真实attachAssets应从服务端snapshot重新绑定ID。将该拒绝断言移至真实签名输入的assetId篡改层后通过；未改生产策略。红绿日志保留。
- 两份PS脚本经PowerShell Language.Parser语法检查通过；`git diff --check`通过。尚未使用密钥或执行发行。

审阅CLOSED后，在最终工具及验收代码的干净SHA重跑资源producer，然后展开执行：

```powershell
./scripts/publish-resource-v1-successor.ps1 -TaskScope n10 -Commit <完整新producerSHA> -ExpectedPreviousSha e7f017b35cbb2fad04f5a521c47508f3616fea0ef471f4bd7245f42cd02f7d62 -NextSequence 2 -EvidenceDirectory D:\soft\.ci-tmp\game-hub-n10\evidence\publication\v1-seq2
./scripts/publish-resource-successor.ps1 -TaskScope n10 -Commit <同一完整producerSHA> -ExpectedPreviousSha 7a0312859ae27ccec42e737006a4deb46d57e7620cdd44dbfb8619a377bb17ac -NextSequence 5 -EvidenceDirectory D:\soft\.ci-tmp\game-hub-n10\evidence\publication\v2-seq5
```

v1 online只读核验CLI为`node scripts/resource-v1-successor.mjs online <实际目录> <旧完整SHA> 2`；v2原对应online/seq5保持。失败目录不得重执行publisher，先只读核对已经发生的事务。
