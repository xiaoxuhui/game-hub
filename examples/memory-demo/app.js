/* global MemoryDemo, GameHubBridge */
(function () {
  'use strict';
  const core = MemoryDemo, key = 'memory-demo-state-v1';
  const message = document.getElementById('message');
  let state = core.initial();
  try { const saved = localStorage.getItem(key); if (saved) state = core.validate(JSON.parse(saved)); } catch { message.textContent = '旧存档未能读取，已保留原文件，可导入备份恢复。'; }
  function render() {
    document.getElementById('status').textContent = (state.complete ? '全部配对成功！' : `已找到 ${state.matched.length / 2}/3 对`) + ` · ${state.moves} 步 · 累计 ${state.wins} 胜局`;
    document.getElementById('cards').replaceChildren(...core.values.map((value, i) => {
      const button = document.createElement('button'), visible = state.matched.includes(i) || state.open.includes(i);
      button.textContent = visible ? value : '?'; button.disabled = state.matched.includes(i);
      button.setAttribute('aria-label', `第 ${i + 1} 张牌，${visible ? value : '未翻开'}${button.disabled ? '，已配对' : ''}`);
      button.onclick = () => { try { state = core.flip(state, i); save(); render(); } catch (error) { message.textContent = error.message; } };
      return button;
    }));
  }
  function save() { try { localStorage.setItem(key, JSON.stringify(state)); } catch { message.textContent = '无法保存进度，请导出备份。'; } }
  document.getElementById('restart').onclick = () => { state = core.initial(state.wins); save(); render(); };
  document.getElementById('export').onclick = () => {
    const content = JSON.stringify(state, null, 2), name = 'memory-demo-save.json';
    if (typeof GameHubBridge !== 'undefined') { message.textContent = GameHubBridge.saveFile(name, content) ? '已受理，请选择保存位置；保存结果由大厅提示。' : '当前无法受理，请稍后重试。'; return; }
    const url = URL.createObjectURL(new Blob([content], {type: 'application/json'})), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  document.getElementById('import').onchange = async event => {
    const input = event.target, file = input.files[0];
    try { if (!file) return; if (file.size > 65536) throw new Error('存档过大'); const candidate = core.validate(JSON.parse(await file.text())); state = candidate; save(); render(); message.textContent = '已导入存档。'; }
    catch (error) { message.textContent = `未导入：${error.message}`; } finally { input.value = ''; }
  };
  render();
})();
