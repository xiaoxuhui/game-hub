// Resource-only controller. The application supplies its existing engine/state operations.
export function installConwayArchiveUI(host, life, archives) {
  const doc = document;
  let active = false;
  const button = (label, action, parent) => {
    const node = doc.createElement('button'); node.type = 'button'; node.textContent = label;
    node.addEventListener('click', action); parent.append(node); return node;
  };
  const text = (parent, value) => { const node = doc.createElement('p'); node.textContent = value; parent.append(node); };
  const panel = doc.createElement('dialog'); panel.className = 'hub-world-backups'; panel.setAttribute('aria-label', '完整世界备份');
  doc.body.append(panel);
  const busy = doc.createElement('dialog'); busy.className = 'hub-world-backups'; busy.setAttribute('aria-label', '正在处理世界存档');
  busy.addEventListener('cancel', event => event.preventDefault()); doc.body.append(busy);
  function download(contents, name) {
    const url = URL.createObjectURL(new Blob([contents], {type:'application/json;charset=utf-8'}));
    const anchor = doc.createElement('a'); anchor.href = url; anchor.download = name; doc.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  async function transaction(action) {
    if (active) return;
    active = true; host.pause(); busy.replaceChildren(); text(busy, '正在处理存档，世界已暂停。'); busy.showModal();
    try { await action(); } catch (error) { host.toast(`存档处理失败：${error.message}`); }
    finally { busy.close(); active = false; }
  }
  function choose(matches) {
    busy.replaceChildren(); text(busy, '此旧文件没有规则。以下完整备份与其格局、代数和视图相同，请明确选择；不会自动使用最近一份。');
    return new Promise(resolve => {
      for (const entry of matches) button(`恢复 ${entry.rule} · 第 ${entry.generation} 代 · ${entry.savedAt}`, () => resolve(entry.fullText), busy);
      button('按旧文件加载 B3/S23', () => resolve('base'), busy);
      button('取消导入', () => resolve(null), busy);
    });
  }
  async function protect(fullText) {
    try {
      const current = host.capture();
      // Even an empty world owns its rule, generation, view and future extensions.
      await archives.add(current);
      await archives.add(fullText);
      return true;
    } catch (error) {
      return window.confirm(`完整备份尚未保存：${error.message}\n继续会替换当前世界；请先手动导出重要存档。是否仍继续？`);
    }
  }
  async function importText(original) {
    // Validate before pausing or replacing any state.
    life.deserialize(original);
    await transaction(async () => {
      let selected = original;
      const data = JSON.parse(original);
      if (data.rule === undefined || data.version === 1) {
        try {
          const matches = await archives.findMatches(original);
          if (matches.length) {
            const result = await choose(matches);
            if (result === null) return;
            if (result !== 'base') selected = result;
          } else if ((await archives.list()).some(entry => entry.rule !== life.DEFAULT_RULE)) {
            if (!window.confirm('此旧文件的基础内容与已有完整备份不同，不会套用备份规则。是否明确按 B3/S23 导入？两份原文会保留。')) return;
          }
        } catch (error) {
          if (!window.confirm(`无法查找规则备份：${error.message}\n是否明确按旧文件的 B3/S23 导入？`)) return;
        }
      }
      const restored = life.deserialize(selected);
      if (!await protect(original)) return;
      // An explicitly selected full backup remains in the archive; preserve the imported base independently.
      host.apply(restored);
      host.toast(`已导入世界，当前规则 ${restored.rule}。`);
    });
  }
  async function exportWorld() {
    await transaction(async () => {
      const contents = host.capture(), restored = life.deserialize(contents);
      if (restored.rule !== life.DEFAULT_RULE && !window.confirm(`当前规则为 ${restored.rule}。旧版只能读取格局、代数和视图，并按 B3/S23 演化；请保留完整文件以便新版恢复规则。是否导出？`)) return;
      let saved = true;
      try { await archives.add(contents); } catch (error) { saved = false; host.toast(`本地完整备份尚未保存：${error.message}；仍可手动保存导出文件。`); }
      download(contents, `life-infinite-generation-${restored.generation}.json`);
      if (saved) host.toast('已保存本地完整备份，并请求导出世界文件；请完成系统保存。');
    });
  }
  async function manage() {
    if (active || panel.open) return;
    host.pause();
    panel.replaceChildren(); text(panel, '完整世界备份（最多 10 条 / 3 MiB）。导出文件后请完成系统保存。');
    button('关闭', () => panel.close(), panel);
    const status = doc.createElement('p'); status.setAttribute('role', 'status'); panel.append(status);
    const guarded = action => async () => { if (active) return; active = true; try { await action(); } catch (error) { status.textContent = error.message; } finally { active = false; } };
    button('导出全部备份原文', guarded(async () => { download(await archives.exportArchive(), 'conway-world-backups.json'); status.textContent = '已请求导出，请完成系统保存。'; }), panel);
    const input = doc.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.hidden = true; panel.append(input);
    button('导入备份集合', () => input.click(), panel);
    input.addEventListener('change', guarded(async () => {
      try {
        const file = input.files?.[0]; if (!file) return;
        if (file.size > archives.limits.maxBytes) throw Error('备份集合超过 3 MiB 上限。');
        await archives.importArchive(await file.text()); status.textContent = '备份集合已合并；关闭后重新打开可查看列表。';
      } finally { input.value = ''; }
    }));
    button('清理本游戏完整备份', guarded(async () => {
      const preview = await archives.previewClear();
      if (!window.confirm(`只清理本游戏完整世界备份（${preview.unreadable ? '集合无法读取' : `${preview.count} 条`}）。请先导出原文保存；不会清理棋盘或其它记录。是否清理？`)) return;
      await archives.clear(true, preview.expectedRaw); status.textContent = '完整备份已清理。关闭后重新打开可刷新列表。';
      list.replaceChildren();
    }), panel);
    button('导出检测到的冲突原文', guarded(async () => {
      const conflict = archives.conflict(); if (!conflict) { status.textContent = '尚无检测到的冲突。'; return; }
      download(JSON.stringify(conflict, null, 2), 'conway-world-backup-conflict.json');
    }), panel);
    const list = doc.createElement('div'); panel.append(list);
    panel.showModal();
    try {
      const entries = await archives.list();
      if (!entries.length) text(list, '尚无完整世界备份。');
      for (const entry of entries) {
        const row = doc.createElement('div'); row.className = 'hub-backup-row'; list.append(row);
        text(row, `${entry.rule} · 第 ${entry.generation} 代 · ${entry.aliveCount} 个细胞 · ${entry.savedAt}`);
        button('恢复此份', async () => { if (active) return; panel.close(); try { await importText(entry.fullText); } catch (error) { host.toast(error.message); } }, row);
        button('导出此份原文', () => download(entry.fullText, `conway-world-${entry.id.slice(0,12)}.json`), row);
      }
    } catch (error) { status.textContent = `无法读取列表：${error.message}；可导出原文保管，明确确认后才清理。`; }
  }
  const launch = button('完整世界备份', manage, doc.querySelector('.file-controls'));
  launch.className = 'button';
  launch.id = 'hubWorldBackupsButton';
  window.addEventListener('storage', event => { if (event.key === archives.key || event.key === null) { archives.invalidate(); host.toast('其他页面已修改备份，请关闭其它实例后重开。'); } });
  return {exportWorld, importText};
}

export const conwayArchiveCSS = `\n.hub-world-backups{box-sizing:border-box;width:min(38rem,calc(100vw - 2rem));max-height:85dvh;overflow:auto;border:1px solid #8997aa;border-radius:12px;padding:1rem;color:#172334;background:#f7faff}.hub-world-backups::backdrop{background:#10233a99}.hub-world-backups button{display:inline-block;margin:.3rem;padding:.6rem;max-width:100%;white-space:normal;overflow-wrap:anywhere}.hub-world-backups p{overflow-wrap:anywhere}.hub-backup-row{border-top:1px solid #bdc9d8;padding:.6rem 0}\n`;
export function conwayUIRuntime() { return Buffer.from(`globalThis.installConwayArchiveUI=${installConwayArchiveUI.toString()};\n`); }
