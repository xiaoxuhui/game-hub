import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REPOSITORIES, tagCommit, repositoryChanges, checkRepository, repositorySummary} from '../scripts/repository-watch.mjs';

const old = 'a'.repeat(40), head = 'b'.repeat(40), annotated = 'c'.repeat(40);
const repo = 'xiaoxuhui/lambda-diagram-game';
function getter(options = {}) {
  return async (path, allow404) => {
    if (path.endsWith('/releases/latest')) {assert.equal(allow404, true); return options.noRelease ? null : {draft: false, prerelease: false, tag_name: options.tag ?? 'v0.3.2', published_at: '2026-10-12T00:00:00Z'};}
    if (path.includes('/git/ref/tags/')) return {object: {type: options.annotated ? 'tag' : 'commit', sha: options.annotated ? annotated : old}};
    if (path.includes('/git/tags/')) return {object: {type: 'commit', sha: old}};
    if (path.includes('/compare/')) return {base_commit: {sha: old}, merge_base_commit: {sha: old}, status: 'ahead', files: options.files ?? [{filename: 'src/game.js'}], ...options.diff};
    if (path.includes('/commits/')) {assert.ok(path.endsWith('/master')); return {sha: options.head ?? head};}
    return {full_name: options.repo ?? repo, private: options.private ?? false, archived: false, disabled: false, default_branch: options.branch ?? 'master'};
  };
}

test('scope is exactly eight repositories and rejects other accounts/repos before API use', async () => {
  assert.equal(REPOSITORIES.length, 8); assert.equal(new Set(REPOSITORIES).size, 8);
  assert.ok(REPOSITORIES.includes('xiaoxuhui/mini-app-harness'));
  for (const bad of ['owner/EML', 'xiaoxuhui/other', 'xiaoxuhui/EML/../../secrets']) await assert.rejects(checkRepository(bad, () => {throw new Error('Must not query');}), /approved scope/);
});
test('actual master branch and lightweight release tag commit distinguish source changes', async () => {
  const paths = []; const get = getter();
  const result = await checkRepository(repo, async (...args) => {paths.push(args[0]); return get(...args);});
  assert.equal(result.defaultBranch, 'master'); assert.equal(result.release.revision, old);
  assert.equal(result.change.status, 'source-change-pending-contract'); assert.equal(result.status, 'checked');
  assert.ok(paths.includes(`/repos/${repo}/compare/${old}...${head}`));
  assert.ok(paths.every(path => !path.includes('/commits/main')));
  assert.deepEqual(result.publication, {status: 'blocked', reason: 'release-contract-not-configured', attempted: false});
});
test('annotated tag resolves commit rather than using mutable target_commitish', async () => {
  const result = await checkRepository(repo, getter({annotated: true, head: old}));
  assert.equal(result.release.revision, old); assert.equal(result.change.status, 'same-revision');
});
test('nested tag cycles, missing objects, wrong SHA/type and depth fail closed', async () => {
  for (const object of [undefined, {sha: 'main', type: 'commit'}, {sha: old, type: 'tree'}, {sha: old, type: 'tag'}]) await assert.rejects(tagCommit('/repos/owner/repo', 'v1.0.0', async () => ({object})), /tag/i);
  let i = 0; await assert.rejects(tagCommit('/x', 'v1.0.0', async () => ({object: {type: 'tag', sha: (++i).toString(16).padStart(40, '0')}})), /tag/);
});
test('no release is explicit initial release pending; private source stays private', async () => {
  const result = await checkRepository(repo, getter({noRelease: true, private: true}));
  assert.equal(result.private, true); assert.equal(result.release.status, 'no-release');
  assert.equal(result.change.status, 'initial-release-contract-required'); assert.equal(result.status, 'checked');
});
test('malformed release/version, repository identity and network fail without credential leakage', async () => {
  assert.equal((await checkRepository(repo, getter({tag: 'nightly'}))).status, 'unknown');
  assert.equal((await checkRepository(repo, getter({repo: 'owner/other'}))).status, 'unknown');
  for (const failure of ['GitHub HTTP 403', 'private-token-value']) {
    const result = await checkRepository(repo, async () => {throw new Error(failure);});
    assert.equal(result.status, 'unknown'); assert.ok(!JSON.stringify(result).includes('private-token-value'));
    assert.equal(result.release.status, 'unknown');
  }
});
test('diverged histories, invalid baseline and 300-file truncation cannot pass', () => {
  const diff = {status: 'ahead', base_commit: {sha: old}, merge_base_commit: {sha: old}, files: []};
  for (const change of [{status: 'diverged'}, {base_commit: {sha: head}}, {files: new Array(300).fill({filename: 'x'})}, {files: [{filename: 'x', previous_filename: '\nsecret'}]}]) assert.throws(() => repositoryChanges({...diff, ...change}, old, head));
  assert.equal(repositoryChanges({...diff, status: 'behind', merge_base_commit: {sha: head}}, old, head).status, 'release-ahead-of-default');
});
test('docs-only remains an unpublished change; HTML/dependencies/CI/renames need contract', async () => {
  assert.equal((await checkRepository(repo, getter({files: [{filename: 'doc/new.md'}]}))).change.status, 'documentation-change');
  for (const filename of ['doc/red-green-puzzle.html', 'package.json', '.github/workflows/check.yml']) assert.equal((await checkRepository(repo, getter({files: [{filename}]}))).change.status, 'source-change-pending-contract');
  assert.equal((await checkRepository(repo, getter({files: [{filename: 'doc/new.md', previous_filename: 'src/game.js'}]}))).change.status, 'source-change-pending-contract');
});
test('summary escapes API fields and makes publication distinction visible', () => {
  const markdown = repositorySummary({repository: '<script>|`', errors: ['<error>'], release: {status: 'unknown'}, change: {status: 'unknown'}});
  assert.ok(!markdown.includes('<script>')); assert.ok(!markdown.includes('<error>'));
  assert.ok(markdown.includes('Publication: blocked')); assert.ok(markdown.includes('No build, signing or release attempted'));
});
test('reusable workflow restricts token, checkout credentials and report retention', () => {
  const workflow = readFileSync(new URL('../.github/workflows/repository-watch-reusable.yml', import.meta.url), 'utf8');
  assert.ok(workflow.includes('workflow_call:')); assert.ok(workflow.includes('contents: read'));
  assert.ok(!workflow.includes('secrets: inherit')); assert.ok(!workflow.includes('contents: write'));
  assert.ok(workflow.includes('persist-credentials: false')); assert.ok(workflow.includes('if: always()'));
  assert.ok(workflow.includes('retention-days: 30')); assert.ok(workflow.includes('Implementation SHA mismatch'));
});
