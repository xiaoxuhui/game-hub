# N20 EML 资源候选与范围核验

- Producer source commit: `d54b51d7ddab0ae59fe0668ded765a0e69bd7b83`
- Source mode: independent immutable upstream checkouts; original game repositories were not modified.
- Scope: static game-resource packages and signed catalog only; no APK build/upload.
- Daily upstream report: `.build/upstream-watch/report.json` at `2026-10-31T01:25:38Z`, status `checked`, 14 source consumers, no errors.

## Deterministic candidate

Two independent `node scripts/resource-sources.mjs` builds from the same producer commit produced identical candidate ZIPs and passed `node scripts/resource-bundle.mjs --verify` (four ZIPs, 80 resource files):

| Game | Content code | ZIP bytes | SHA-256 | Outcome |
| --- | ---: | ---: | --- | --- |
| Conway | 3 | 328,473 | `f9207e077589e67bc7d9d531e302a95fffc4027c8497035509ca258f803e6285` | Identical to current online asset |
| EML | 3 | 861,794 | `d13a6ac888dd8662225788ca016824a3370a3c3683f3c2f114a6a9656bb424c7` | New resource candidate |
| Light | 2 | 115,671 | `19adc2db9b143289c4c8fa6b83d024209ce050fd7744888bd932a7035d115267` | Identical to current online asset |
| Turing | 3 | 177,496 | `282aabcc00306551df4e8d31aec8db58e43a2142203c818ff8abd96f046ae626` | Identical to current online asset |

Staged resource bundle manifest SHA-256: `5428fc30b3546bad0d3bc4767d410cf3a13630895588117424da431951b0c57a`.
The EML built HTML is 221,191 bytes. The locked source is `cb408648ad4233baba757a530aa39278ecdb5127`; the 40-entry source proof, old-reader compatibility tests, MIT and KaTeX licenses are validated by the suite.

## Current directory preflight

- Online v1 current sequence: `6`.
- Current signed catalog SHA-256: `1c144d7f87f8d26c5cdafe2d40c5c5843b3288f366ed13c183c3df3290f29d20`.
- Current EML identity: content code 2, source `63cbfd8fdce98874802cf1ac608b1084c8e48d40`, ZIP `6f3dff273d70e47243bce75b167a9ce5ab4b6513deed35b363b903ddc5738935`.
- Anonymous v1 preflight passed the exact successor sequence 7 and all four immutable candidate identities. This is preflight only: no credentials, signing, or uploads were used.

## Other update candidates

The upstream watch found Lambda and Traffic resource-file changes, but their current storage/reader compatibility reviews remain open; they are not eligible for this catalog. Hex has pending resource changes but is outside the reviewed v2 publisher scope for an existing content update. Turing's latest upstream delta is outside packaged resource inputs. Other watched sources were same-revision, metadata-only, or non-resource changes. They were not added to this package.

## Browser-test limitation

The existing `scripts/eml-hall-browser.cjs --candidate` harness could not start because this independent checkout has no `playwright` Node module. No browser or device result is claimed. The EML compatibility, resource-lock, preservation, UI adaptation, license tests and full Node suite pass.


## 可复核的发行前证据

- 两次构建的逐次输出和 ZIP 摘要：`doc/evidence/n20-eml-resource-builds.json`；报告断言两次清单、manifest 和每个 ZIP SHA-256 完全一致。
- sequence 7 匿名预检输入摘要、原始输出和前快照摘要：`doc/evidence/n20-eml-v1-preflight.json`。上一份已签名目录原文 SHA 与 GitHub 当前资产一致。
- 今日上游巡检的完整只读结果：`doc/evidence/n20-eml-upstream-watch.json`。
