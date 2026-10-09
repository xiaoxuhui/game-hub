(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./domain/sandpile.js') : root.SandpileCore,
    node ? require('./domain/challenge.js') : root.SandpileChallenge);
  if (node) module.exports = api; else root.SandpileController = api;
})(globalThis, function (C, H) {
  'use strict';
  class Controller {
    constructor(levels, { schedule = (fn) => setTimeout(fn, 16), cancel = (id) => clearTimeout(id), clock = () => performance.now(), onChange = () => {} } = {}) {
      this.levels = levels; this.schedule = schedule; this.cancel = cancel; this.clock = clock; this.onChange = onChange;
      this.experiment = C.preset(65, 'empty'); this.queue = []; this.selected = { x: 32, y: 32 };
      this.session = H.create(levels[0]); this.progress = {};
      this.settings = { mode: 'explore', speed: 20, amount: 1, levelId: levels[0].id };
      this.running = false; this.fast = false; this.generation = 0; this.handle = null; this.runner = null; this.lastWave = 0;
      this.pouring = null; this.lastPour = 0;
    }
    get state() { return this.settings.mode === 'explore' ? this.experiment : this.session.state; }
    get status() { return this.settings.mode === 'challenge' ? H.status(this.session) : this.state.stable && !this.queue.length ? 'stable' : 'pending'; }
    changed() { this.recordWin(); this.onChange(this); }
    recordWin() {
      if (this.settings.mode !== 'challenge' || H.status(this.session) !== 'won') return;
      const id = this.session.level.id, old = this.progress[id];
      this.progress[id] = { version: this.session.level.version, best: old ? Math.min(old.best, this.session.moves) : this.session.moves };
    }
    stop() {
      this.generation++; if (this.handle !== null) this.cancel(this.handle);
      this.handle = null; this.running = false; this.runner = null; this.fast = false;
      this.pouring = null;
    }
    pause() { this.stop(); this.changed(); }
    startPour(x, y, amount, interval = 500) {
      if (this.settings.mode !== 'explore') throw new Error('循环投沙仅用于自由探索');
      C.integer(x, 0, this.state.width - 1, '横坐标'); C.integer(y, 0, this.state.height - 1, '纵坐标');
      C.integer(amount, 1, C.LIMITS.input, '投沙量'); C.integer(interval, 100, 5000, '循环间隔');
      const pending = this.queue.reduce((n, p) => n + p.amount, 0);
      if (this.state.initialTotal + this.state.added + pending + amount > C.LIMITS.grains) throw new Error('本局累计投入不足下一次投沙，请开始新实验');
      this.run(true, Object.freeze({ x, y, amount, interval }));
    }
    run(fast = false, pouring = null) {
      this.stop(); this.running = true; this.fast = fast; this.lastWave = this.clock() - 1000;
      this.pouring = pouring; this.lastPour = this.clock() - (pouring?.interval || 0);
      const generation = this.generation;
      const frame = () => {
        if (generation !== this.generation || !this.running) return;
        this.handle = null;
        try {
          if (this.settings.mode === 'explore' && this.state.stable && this.queue.length) {
            const p = this.queue.shift(); C.drop(this.state, p.x, p.y, p.amount); this.runner = null;
          }
          if (this.pouring && this.state.stable && !this.queue.length && this.clock() - this.lastPour >= this.pouring.interval) {
            const p = this.pouring; C.drop(this.state, p.x, p.y, p.amount);
            this.lastPour = this.clock(); this.runner = null;
          }
          if (!this.state.stable) {
            if (this.fast) {
              if (!this.runner) this.runner = new C.Relaxer(this.state);
              const end = this.clock() + 8; this.runner.tick(100000, () => this.clock() >= end);
            } else if (this.clock() - this.lastWave >= 1000 / this.settings.speed) { C.wave(this.state); this.lastWave = this.clock(); }
          }
          this.changed();
          if (!this.pouring && this.state.stable && (this.settings.mode === 'challenge' || !this.queue.length)) { this.stop(); this.changed(); }
          else this.handle = this.schedule(frame);
        } catch (error) { this.stop(); this.onError?.(error); this.changed(); }
      };
      this.handle = this.schedule(frame); this.changed();
    }
    step() {
      this.stop();
      if (this.settings.mode === 'explore' && this.state.stable && this.queue.length) {
        const p = this.queue.shift(); C.drop(this.state, p.x, p.y, p.amount);
      }
      if (!this.state.stable) C.wave(this.state); this.changed();
    }
    drop(x, y, amount = this.settings.amount) {
      if (this.settings.mode === 'challenge') { H.move(this.session, x, y); this.run(false); return; }
      C.integer(x, 0, this.state.width - 1, '横坐标'); C.integer(y, 0, this.state.height - 1, '纵坐标');
      C.integer(amount, 1, C.LIMITS.input, '投沙量');
      const pending = this.queue.reduce((n, p) => n + p.amount, 0);
      if (this.state.initialTotal + this.state.added + pending + amount > C.LIMITS.grains) throw new Error('本局累计投入超过 1000000 粒，请开始新实验');
      if (!this.state.stable || this.queue.length) {
        if (this.queue.length >= C.LIMITS.queue) throw new Error('输入队列已满，请先运行或稳定化');
        this.queue.push({ x, y, amount });
      } else C.drop(this.state, x, y, amount);
      this.changed();
    }
    resetExperiment(size, preset) {
      const next = C.preset(size, preset); this.stop(); this.experiment = next; this.queue = [];
      this.selected = { x: Math.floor(size / 2), y: Math.floor(size / 2) }; this.changed();
    }
    chooseLevel(id) {
      const level = this.levels.find((x) => x.id === id); if (!level) throw new Error('未知关卡');
      this.stop(); this.session = H.create(level); this.settings.levelId = id; this.changed();
    }
    mode(mode) {
      if (!['explore', 'challenge'].includes(mode)) throw new Error('未知模式');
      this.stop(); this.settings.mode = mode; this.changed();
    }
    undo() { this.stop(); H.undo(this.session); this.changed(); }
    snapshot() {
      this.recordWin();
      return { schemaVersion: 1, gameId: 'abelian-sandpile', experiment: { state: C.clone(this.experiment), queue: C.clone(this.queue), selected: { ...this.selected } },
        progress: C.clone(this.progress), settings: { ...this.settings }, challenge: H.checkpoint(this.session) };
    }
    restore(bundle) {
      // Caller supplies a fully validated bundle. Construct before cancelling current work.
      const session = H.restore(this.levels.find((x) => x.id === bundle.settings.levelId), bundle.challenge);
      this.stop(); this.experiment = C.clone(bundle.experiment.state); this.queue = C.clone(bundle.experiment.queue);
      this.selected = { ...bundle.experiment.selected }; this.progress = C.clone(bundle.progress);
      this.settings = { ...bundle.settings }; this.session = session; this.changed();
    }
  }
  return Object.freeze({ Controller });
});
