import { buildSolution, validSize, restoreSize, flowText, STORAGE_KEY } from './core.js';

const ui = Object.fromEntries(['sizeInput', 'generateBtn', 'copyBtn', 'board', 'summary', 'stepStat', 'rowStat', 'notice', 'copyText', 'copyStatus'].map(id => [id, document.getElementById(id)]));
let latestStates = [], generation = 0;

function render(states) {
  const fragment = document.createDocumentFragment();
  states.forEach((state, rowIndex) => {
    const row = document.createElement('div'); row.className = 'row';
    const label = document.createElement('span'); label.textContent = `t=${rowIndex}`;
    const cells = document.createElement('div'); cells.className = 'cells';
    for (let i = 0; i < state.length; i++) {
      const cell = document.createElement('span'); cell.className = `cell ${state[i] === '1' ? 'one' : 'zero'}`;
      if (rowIndex && states[rowIndex - 1][i] !== state[i]) cell.style.outline = '2px solid #172033';
      cell.title = `bit ${i + 1} = ${state[i]}`; cells.appendChild(cell);
    }
    const text = document.createElement('span'); text.className = rowIndex === states.length - 1 ? 'state-text changed' : 'state-text';
    text.textContent = state; row.append(label, cells, text); fragment.appendChild(row);
  });
  ui.board.replaceChildren(fragment);
}
function generate() {
  const size = Number(ui.sizeInput.value);
  if (!validSize(size)) { ui.notice.hidden = false; ui.notice.textContent = '请输入1到10之间的整数。上次有效流程保持不变。'; return; }
  latestStates = buildSolution(size); generation++;
  ui.notice.hidden = true; ui.copyText.hidden = true; ui.copyStatus.textContent = '';
  ui.summary.textContent = `已生成 ${size} 个数字的流程，每一步都满足规则。`;
  ui.stepStat.textContent = `步数 ${latestStates.length - 1}`; ui.rowStat.textContent = `行数 ${latestStates.length}`;
  render(latestStates);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, size })); }
  catch { ui.notice.hidden = false; ui.notice.textContent = '本机暂不能保存参数，本次流程仍可使用。'; }
}
async function copySolution() {
  const text = flowText(latestStates), copiedGeneration = generation;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    if (generation === copiedGeneration) ui.copyStatus.textContent = '已复制完整流程。';
  } catch {
    if (generation !== copiedGeneration) return;
    ui.copyText.value = text; ui.copyText.hidden = false; ui.copyText.focus(); ui.copyText.select();
    let copied = false;
    try { copied = document.execCommand('copy') === true; } catch { /* Manual selection remains available. */ }
    if (copied) { ui.copyText.hidden = true; ui.copyBtn.focus(); ui.copyStatus.textContent = '已复制完整流程。'; }
    else { ui.copyStatus.textContent = '自动复制不可用，请在下方文本框长按或全选后手动复制。'; }
  }
}
try { ui.sizeInput.value = String(restoreSize(localStorage.getItem(STORAGE_KEY))); }
catch { ui.sizeInput.value = '6'; }
ui.generateBtn.addEventListener('click', generate);
ui.copyBtn.addEventListener('click', copySolution);
ui.sizeInput.addEventListener('keydown', event => { if (event.key === 'Enter') generate(); });
generate();
