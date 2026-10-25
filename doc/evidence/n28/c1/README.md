# C1 可复核验证证据

此目录记录Logic690f4b6与Traffic86f8fb7的更新验证；尚不是正式资源发行记录。

- source-compatibility-audit.json：固定正式seq33旧reader与新reader的源字节/布局比较。
- logic-unit.log / traffic-unit.log / traffic-browser.log：302、82核心及Traffic50浏览器实际通过。
- logic-browser-first.log：原始浏览器首跑，包括第38个XOR文件失败；logic-browser-calibrated-tail.log：独立校准XOR及其后20文件实际通过。
- logic-source-browser-coverage.json：默认57文件中37首跑通过+20续跑通过，记录可选large-live未启用。
- logic-xor-old-new-probe.json、logic-xor-calibration.json、logic-xor-calibration.patch：物理实例旧新310不变，guide新增131，总实例变化；原物理阈值312和其余断言保留，修改只在独立验证测试副本。
- candidate-browser.log：54c4c34真实候选ZIP模拟路径/桥stub14项；hall-unit.log：Windows100项。
- log-manifest.json：完整私有原日志SHA与公开日志路径替换说明。所有JSON来源均为实际命令输出；候选/原源浏览器不是正式Android/SAF/设备证明。
