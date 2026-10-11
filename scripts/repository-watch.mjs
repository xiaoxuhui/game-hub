import {mkdirSync, writeFileSync, appendFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {githubClient, versionOrder} from './upstream-watch.mjs';

export const REPOSITORIES = Object.freeze([
  'game-hub', 'conway-life-game', 'EML', 'light_game', 'turing-machine-simulator',
  'abelian-sandpile', 'lambda-diagram-game', 'mini-app-harness'
].map(name => `xiaoxuhui/${name}`));
const SHA = /^[a-f0-9]{40}$/;
const ROOT = fileURLToPath(new URL('../', import.meta.url));
class CheckError extends Error {}
function requireValue(ok, message) {if (!ok) throw new CheckError(message);}
// Only our own diagnostics and the HTTP client's fixed messages reach artifacts.
function diagnostic(error) {
  return error instanceof CheckError || /^GitHub HTTP \d{3}$|^GitHub request failed or timed out$|^Invalid GitHub JSON$/.test(error?.message ?? '')
    ? error.message : 'Repository query failed';
}
const escape = value => String(value ?? 'unknown').replace(/[&<>|`\[\]\r\n]/g, c => `&#${c.charCodeAt(0)};`);

export async function tagCommit(base, tag, get) {
  requireValue(typeof tag === 'string' && tag.length > 0 && !/[\u0000-\u001f]/.test(tag), 'Invalid release tag');
  let object = (await get(`${base}/git/ref/tags/${encodeURIComponent(tag)}`)).object;
  const visited = new Set();
  for (let depth = 0; depth <= 4; depth++) {
    requireValue(object && SHA.test(object.sha), 'Invalid tag object');
    if (object.type === 'commit') return object.sha;
    requireValue(object.type === 'tag' && depth < 4 && !visited.has(object.sha), 'Unsupported or cyclic tag');
    visited.add(object.sha);
    object = (await get(`${base}/git/tags/${object.sha}`)).object;
  }
}

export function repositoryChanges(diff, baseline, main) {
  requireValue(diff?.base_commit?.sha === baseline, 'Invalid comparison baseline');
  if (diff.status === 'behind' && diff.merge_base_commit?.sha === main) return {status: 'release-ahead-of-default'};
  requireValue(diff.status === 'ahead' && diff.merge_base_commit?.sha === baseline, 'Non-linear repository history');
  requireValue(Array.isArray(diff.files) && diff.files.length < 300, 'Incomplete comparison file list');
  const files = diff.files.map(file => {
    requireValue(typeof file.filename === 'string' && file.filename.length > 0 && !/[\u0000-\u001f]/.test(file.filename), 'Invalid comparison filename');
    requireValue(file.previous_filename === undefined || (typeof file.previous_filename === 'string' && file.previous_filename.length > 0 && !/[\u0000-\u001f]/.test(file.previous_filename)), 'Invalid rename source');
    return {path: file.filename, ...(file.previous_filename ? {previousPath: file.previous_filename} : {})};
  });
  // Even docs/CI-only commits remain unpublished commits; this is not an APK release decision.
  const documentation = path => /^(?:doc|docs)\/.*\.md$/i.test(path) || /^(?:README|CHANGELOG|CONTRIBUTING|SECURITY|CODE_OF_CONDUCT)(?:\.[\w-]+)?\.md$/i.test(path);
  return {status: files.length && files.every(file => documentation(file.path) && (!file.previousPath || documentation(file.previousPath)))
    ? 'documentation-change' : 'source-change-pending-contract', files};
}

export async function checkRepository(repository, get = githubClient()) {
  requireValue(REPOSITORIES.includes(repository), 'Repository outside approved scope');
  const base = `/repos/${repository}`;
  const report = {schemaVersion: 1, repository, checkedAt: new Date().toISOString(),
    implementationRevision: process.env.IMPLEMENTATION_SHA ?? null,
    invocationRevision: process.env.GITHUB_SHA ?? null,
    artifactKinds: repository.endsWith('/mini-app-harness') ? ['private-skill-source'] : repository.endsWith('/game-hub') ? ['hall-apk', 'signed-resource-catalogs'] : ['web', 'game-apk', 'hall-resource-source'],
    publication: {status: 'blocked', reason: 'release-contract-not-configured', attempted: false},
    status: 'unknown', errors: []};
  try {
    const info = await get(base);
    requireValue(info.full_name === repository && typeof info.private === 'boolean', 'Invalid repository identity');
    requireValue(info.archived === false && info.disabled === false, 'Repository archived or disabled');
    requireValue(typeof info.default_branch === 'string' && info.default_branch.length > 0 && info.default_branch.length <= 255 && !/[\u0000-\u001f]/.test(info.default_branch), 'Invalid default branch');
    report.private = info.private;
    report.defaultBranch = info.default_branch;
    const head = await get(`${base}/commits/${encodeURIComponent(info.default_branch)}`);
    requireValue(SHA.test(head.sha), 'Invalid default branch commit');
    report.defaultRevision = head.sha;
  } catch (error) {report.errors.push(diagnostic(error));}
  try {
    // Metadata must succeed before treating release 404 as a legitimate no-release.
    requireValue(report.defaultRevision, 'Default branch unavailable');
    const release = await get(`${base}/releases/latest`, true);
    if (release === null) {
      report.release = {status: 'no-release'};
      report.change = {status: 'initial-release-contract-required'};
    } else {
      requireValue(release.draft === false && release.prerelease === false && typeof release.published_at === 'string' && Number.isFinite(Date.parse(release.published_at)), 'Invalid formal release');
      try {versionOrder(release.tag_name, release.tag_name);} catch {throw new CheckError('Unknown release version');}
      const revision = await tagCommit(base, release.tag_name, get);
      report.release = {status: 'formal-release', tag: release.tag_name, revision, publishedAt: release.published_at,
        url: `https://github.com/${repository}/releases/tag/${encodeURIComponent(release.tag_name)}`};
      report.change = revision === report.defaultRevision ? {status: 'same-revision'}
        : repositoryChanges(await get(`${base}/compare/${revision}...${report.defaultRevision}`), revision, report.defaultRevision);
    }
  } catch (error) {report.errors.push(diagnostic(error)); if (!report.release) report.release = {status: 'unknown'}; report.change = {status: 'unknown'};}
  report.status = report.errors.length ? 'unknown' : 'checked';
  return report;
}

export function repositorySummary(report) {
  return ['# Daily repository maintenance', '', `Repository: ${escape(report.repository)}`,
    `Checked: ${escape(report.checkedAt)}`, `Default branch: ${escape(report.defaultBranch)}`,
    `Default SHA: ${escape(report.defaultRevision)}`, `Formal release: ${escape(report.release?.tag ?? report.release?.status)}`,
    `Release SHA: ${escape(report.release?.revision)}`, `Change: ${escape(report.change?.status)}`,
    `Query status: ${escape(report.status)}`, '', 'Publication: blocked — release-contract-not-configured. No build, signing or release attempted.',
    'Hall resource consumer updates are checked separately by upstream-watch; a game Release is not a signed hall resource.',
    'Private repository reports stay in the calling repository. Schedule may be delayed; workflow_dispatch can retry.',
    ...report.errors.map(error => `ERROR: ${escape(error)}`), ''].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = join(ROOT, '.build', 'repository-watch');
  mkdirSync(out, {recursive: true});
  let report;
  try {report = await checkRepository(process.env.GITHUB_REPOSITORY);}
  catch {report = {schemaVersion: 1, status: 'unknown', errors: ['Repository outside approved scope'], publication: {attempted: false}};}
  const markdown = repositorySummary(report);
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(join(out, 'summary.md'), markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  console.log(markdown);
  if (report.status !== 'checked') process.exitCode = 1;
}
