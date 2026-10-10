import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSources, versionOrder, classifyChanges, checkSource, githubClient, watch, summary} from '../scripts/upstream-watch.mjs';

const pinned = 'a'.repeat(40), main = 'b'.repeat(40);
const source = {id: 'game', repository: 'https://github.com/owner/game.git', version: '1.2.3', consumers: [{id: 'game', revision: pinned, inputs: ['index.html', 'dist/**']}]};
const release = {draft: false, prerelease: false, tag_name: 'v1.2.3', published_at: '2026-10-01T00:00:00Z'};
const getter = (options = {}) => async path => {
  if (path.endsWith('/releases/latest')) return options.release === undefined ? release : options.release;
  if (path.endsWith('/commits/main')) return {sha: options.main ?? pinned};
  if (path.includes('/compare/')) return {status: options.history ?? 'ahead', base_commit: {sha: pinned}, merge_base_commit: {sha: pinned}, files: options.files ?? []};
  return {default_branch: 'main'};
};

test('six actual upstreams include separate red-green and turing baselines', () => {
  const sources = loadSources();
  assert.equal(sources.length, 6);
  const turing = sources.find(s => s.id === 'turing');
  assert.deepEqual(turing.consumers.map(c => c.id), ['turing', 'red-green-puzzle']);
  assert.notEqual(turing.consumers[0].revision, turing.consumers[1].revision);
  assert.ok(turing.consumers[1].inputs.includes('doc/red-green-puzzle.html'));
  assert.equal(sources.find(s => s.id === 'lambda-diagram-game').repository, 'https://github.com/xiaoxuhui/lambda-diagram-game.git');
});
test('release versions distinguish newer, equal and older without numeric rounding', () => {
  assert.equal(versionOrder('v1.2.4', '1.2.3'), 'new-release');
  assert.equal(versionOrder('v1.2.3', '1.2.3'), 'same-version');
  assert.equal(versionOrder('1.1.99', '1.2.3'), 'release-older-than-baseline');
  assert.equal(versionOrder('99999999999999999999.0.0', '2.0.0'), 'new-release');
  for (const bad of ['nightly', 'v01.2.3', '1.2.3-beta', null]) assert.throws(() => versionOrder(bad, '1.2.3'));
});
test('resource HTML in doc wins over metadata exclusion; rename and dist are detected', () => {
  assert.equal(classifyChanges([{filename: 'doc/red-green-puzzle.html'}], ['doc/red-green-puzzle.html']).status, 'resource-change-pending-review');
  assert.equal(classifyChanges([{filename: 'new.html', previous_filename: 'index.html'}], source.consumers[0].inputs).status, 'resource-change-pending-review');
  assert.equal(classifyChanges([{filename: 'dist/app.js'}], ['dist/**']).status, 'resource-change-pending-review');
});
test('unknown new dependencies need review; only known metadata can be ignored', () => {
  assert.equal(classifyChanges([{filename: 'package.json'}], []).status, 'other-change-pending-review');
  assert.equal(classifyChanges([{filename: 'doc/new.html'}], []).status, 'other-change-pending-review');
  assert.equal(classifyChanges([{filename: 'README.md'}, {filename: '.github/workflows/ci.yml'}], []).status, 'metadata-only');
  assert.throws(() => classifyChanges(Array.from({length: 300}, () => ({filename: 'a.js'})), []));
  assert.throws(() => classifyChanges([{filename: null}], []));
});
test('same revision and version do not fetch feature/dependabot branches', async () => {
  const paths = [];
  const result = await checkSource(source, async path => {paths.push(path); return getter()(path);});
  assert.equal(result.status, 'checked');
  assert.equal(result.release.status, 'same-version');
  assert.equal(result.consumers[0].status, 'same-revision');
  assert.equal(paths.length, 3);
  assert.ok(paths.every(p => !p.includes('/branches')));
});
test('unreleased main changes are pending review, not automatically published', async () => {
  const result = await checkSource(source, getter({main, files: [{filename: 'index.html'}]}));
  assert.equal(result.consumers[0].status, 'resource-change-pending-review');
  assert.equal(result.release.status, 'same-version');
});
test('no formal release stays distinct from failures', async () => {
  const result = await checkSource(source, getter({release: null}));
  assert.equal(result.release.status, 'no-release');
  assert.equal(result.status, 'checked');
  const get = githubClient(async () => ({status: 404, ok: false}), '');
  assert.equal(await get('/release', true), null);
  await assert.rejects(get('/commit'), /404/);
});
test('HTTP, network and malformed response failures never become latest', async () => {
  await assert.rejects(githubClient(async () => ({status: 403, ok: false}), '')('/test'), /403/);
  await assert.rejects(githubClient(async () => {throw new Error('secret');}, '')('/test'), /request failed/);
  await assert.rejects(githubClient(async () => ({ok: true, json: () => {throw new Error('secret');}}), '')('/test'), /Invalid GitHub JSON/);
  for (const bad of [{draft: true}, {...release, tag_name: 'nightly'}, {...release, published_at: null}]) {
    assert.equal((await checkSource(source, getter({release: bad}))).status, 'unknown');
  }
});
test('divergence and truncated diff fail; other sources still checked', async () => {
  const result = await checkSource(source, getter({main, history: 'diverged'}));
  assert.equal(result.status, 'unknown');
  const truncated = await checkSource(source, getter({main, files: Array.from({length: 300}, () => ({filename: 'a'}))}));
  assert.equal(truncated.status, 'unknown');
  let requests = 0;
  const report = await watch([source, {...source, id: 'second'}], async path => {
    requests++;
    if (requests === 1) throw new Error('GitHub HTTP 403');
    return getter()(path);
  });
  assert.equal(report.status, 'unknown');
  assert.equal(report.sources[1].status, 'checked');
  assert.equal(report.publication, 'not-attempted');
});
test('Markdown summary escapes remote branch strings', async () => {
  const result = await checkSource(source, async path => path.endsWith('/game') ? {default_branch: '<script>|`'} : path.includes('/commits/') ? {sha: pinned} : release);
  const text = summary({sources: [result]});
  assert.ok(!text.includes('<script>'));
  assert.ok(text.includes('&#60;script&#62;'));
});
