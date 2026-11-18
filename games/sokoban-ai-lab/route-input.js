(function (root) {
  'use strict';

  function parse(text, devices) {
    if (!text.trim()) throw Error('请先输入步骤。');
    if (!devices) {
      const directions = { W: 0, D: 1, S: 2, F: 2, A: 3, '↑': 0, '→': 1, '↓': 2, '←': 3 };
      const letters = text.toUpperCase().replace(/[\s,，;；\-]/gu, '');
      if (!letters) throw Error('请先输入方向字母。');
      return Array.from(letters, (letter, index) => {
        if (directions[letter] === undefined) throw Error('第 ' + (index + 1) + ' 个方向无法识别，请用 W、A、S、D，F 也表示下。');
        return directions[letter];
      });
    }
    let entries;
    try {
      entries = JSON.parse(text);
    } catch {
      const matches = [...text.matchAll(/(-?\d+)\s*,\s*(-?\d+)/gu)];
      const remainder = text.replace(/(-?\d+)\s*,\s*(-?\d+)/gu, '').replace(/[\s;；|\[\],]/gu, '');
      if (!matches.length || remainder) throw Error('请用装置坐标，每步写成 x,y，例如 -19,-6。');
      entries = matches.map(match => [Number(match[1]), Number(match[2])]);
    }
    if (!Array.isArray(entries) || !entries.length) throw Error('请输入装置坐标列表。');
    return entries.map((entry, index) => {
      if (typeof entry === 'string' && !/^-?\d+\s*,\s*-?\d+$/u.test(entry.trim())) {
        throw Error('第 ' + (index + 1) + ' 步须为装置坐标 x,y。');
      }
      const pair = typeof entry === 'string' ? entry.split(',').map(Number) : entry;
      if (!Array.isArray(pair) || pair.length !== 2 ||
          !pair.every(value => Number.isSafeInteger(value) && Math.abs(value) <= 1e12)) {
        throw Error('第 ' + (index + 1) + ' 步须为装置坐标 x,y。');
      }
      return pair.join(',');
    });
  }

  function mount(element, game) {
    element.innerHTML = '<summary>步骤输入器</summary>' +
      '<div class="route-input-body"><label>提前输入步骤<textarea rows="3" spellcheck="false" autocapitalize="off"></textarea></label>' +
      '<p class="secondary route-help"></p><div class="route-actions">' +
      '<button class="outline route-load" type="button">载入步骤</button>' +
      '<button class="outline route-next" type="button" disabled>单步</button>' +
      '<button class="outline route-play" type="button" disabled>播放</button>' +
      '<label>间隔 <select aria-label="步骤播放间隔"><option value="100">0.1 秒</option><option value="250" selected>0.25 秒</option><option value="500">0.5 秒</option><option value="1000">1 秒</option></select></label>' +
      '</div><p class="route-status secondary" role="status">载入后，从当前局面执行。</p></div>';
    const input = element.querySelector('textarea');
    const help = element.querySelector('.route-help');
    const status = element.querySelector('.route-status');
    const load = element.querySelector('.route-load');
    const next = element.querySelector('.route-next');
    const play = element.querySelector('.route-play');
    const speed = element.querySelector('select');
    let actions = [];
    let index = 0;
    let expected;
    let timer = 0;
    let playing = false;

    function pause() {
      clearTimeout(timer);
      timer = 0;
      playing = false;
      play.textContent = '播放';
    }

    function reset() {
      pause();
      actions = [];
      index = 0;
      expected = undefined;
      next.disabled = true;
      play.disabled = true;
      const devices = game.devices();
      help.textContent = devices ?
        '点击编码使用当时的装置坐标 x,y，多步换行或用分号分隔。装置移动后，用它的新坐标。有电源时点击电源，无电源时点击拉推头。' :
        'W 上、A 左、S 下、D 右，F 也表示下。支持连续字母、空格和连字符，例如 W-A-S-D。';
      input.placeholder = devices ? '-19,-6\n-20,-6\n-18,-6' : 'wwaassdddd';
      status.textContent = '载入后，从当前局面执行。';
    }

    function advance() {
      if (!game.available() || game.state() !== expected) {
        pause();
        status.textContent = '局面已改变或已离开试玩，请重新载入步骤。';
        next.disabled = true;
        play.disabled = true;
        return;
      }
      if (game.won()) {
        pause();
        status.textContent = '已通关，已执行 ' + index + ' / ' + actions.length + ' 步。';
        next.disabled = true;
        play.disabled = true;
        return;
      }
      const error = game.execute(actions[index]);
      const after = game.state();
      if (after === expected) {
        pause();
        status.textContent = '第 ' + (index + 1) + ' 步未执行。' + (error || '该方向无法移动。');
        return;
      }
      expected = after;
      index++;
      const finished = index === actions.length || game.won();
      if (finished) pause();
      status.textContent = '已执行 ' + index + ' / ' + actions.length + ' 步' + (game.won() ? '，已通关。' : '。');
      next.disabled = finished;
      play.disabled = finished;
    }

    function schedule() {
      timer = setTimeout(() => {
        advance();
        if (playing) schedule();
      }, Number(speed.value));
    }

    load.addEventListener('click', () => {
      reset();
      try {
        const parsed = parse(input.value, game.devices());
        const error = game.prepare();
        if (error) throw Error(error);
        actions = parsed;
        expected = game.state();
        next.disabled = false;
        play.disabled = false;
        status.textContent = '已载入 ' + actions.length + ' 步，从当前局面执行。';
      } catch (error) {
        status.textContent = error.message;
      }
    });
    input.addEventListener('input', reset);
    next.addEventListener('click', () => { pause(); advance(); });
    play.addEventListener('click', () => {
      if (playing) return pause();
      playing = true;
      play.textContent = '暂停';
      advance();
      if (playing) schedule();
    });
    reset();
    return { reset, pause };
  }

  root.RouteInput = { parse, mount };
})(globalThis);
