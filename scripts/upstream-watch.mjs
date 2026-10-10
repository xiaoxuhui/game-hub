import {readFileSync, writeFileSync, mkdirSync, appendFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SHA = /^[a-f0-9]{40}$/;
const json = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
function requireValue(ok, message) { if (!ok) throw new Error(message); }
export function versionOrder(tag, baseline) {
  const parse = value => {
    requireValue(typeof value === 'string' && /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value), 'Unknown release version');
    return value.replace(/^v/, '').split('.').map(BigInt);
  };
  const a = parse(tag), b = parse(baseline);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 'new-release' : 'release-older-than-baseline';
  return 'same-version';
}

export function loadSources(root = ROOT) {
  const sources = json(join(root, 'resource-sources.lock.json')).sources.map(source => ({
    id: source.id, repository: source.repository, version: source.version,
    consumers: [{id: source.id, revision: source.revision, inputs: source.files}]
  }));
  for (const id of ['abelian-sandpile', 'lambda-diagram-game', 'red-green-puzzle']) {
    const proof = json(join(root, 'examples', id, 'upstream-source.json'));
    let source = sources.find(s => s.repository === proof.repository);
    if (!source) {
      source = {id, repository: proof.repository, version: proof.version, consumers: []};
      sources.push(source);
    }
    source.consumers.push({id, revision: proof.revision, inputs: proof.inputs.map(i => i.path)});
  }
  requireValue(sources.length === 6, 'Expected six upstream repositories');
  for (const source of sources) {
    requireValue(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/.test(source.repository), 'Invalid upstream repository');
    versionOrder(source.version, source.version);
    for (const consumer of source.consumers) {
      requireValue(SHA.test(consumer.revision) && Array.isArray(consumer.inputs) && consumer.inputs.length > 0, 'Invalid consumer baseline');
    }
  }
  return sources;
}

export function classifyChanges(files, inputs) {
  requireValue(Array.isArray(files) && files.length < 300, 'Incomplete comparison file list');
  const matches = path => inputs.some(input => input.endsWith('/**') ? path.startsWith(input.slice(0, -2)) : input === path);
  const resourceFiles = [], reviewFiles = [], metadataFiles = [];
  for (const file of files) {
    requireValue(typeof file.filename === 'string' && file.filename.length > 0 && !/[\u0000-\u001f]/.test(file.filename), 'Invalid comparison filename');
    const paths = [file.filename];
    if (file.previous_filename !== undefined) {
      requireValue(typeof file.previous_filename === 'string', 'Invalid rename source');
      paths.push(file.previous_filename);
    }
    const metadata = path => /^(?:\.github\/|tests?\/)/.test(path) || /\.md$/i.test(path);
    if (paths.some(matches)) resourceFiles.push(file.filename);
    else if (paths.every(metadata)) metadataFiles.push(file.filename);
    else reviewFiles.push(file.filename);
  }
  return {status: resourceFiles.length ? 'resource-change-pending-review' : reviewFiles.length ? 'other-change-pending-review' : 'metadata-only', resourceFiles, reviewFiles, metadataFiles};
}

export function githubClient(fetchImpl = fetch, token = process.env.GITHUB_TOKEN) {
  return async (path, noReleaseAllowed = false) => {
    let response;
    try {
      response = await fetchImpl(`https://api.github.com${path}`, {
        headers: {'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(token ? {Authorization: `Bearer ${token}`} : {})},
        signal: AbortSignal.timeout(20000), redirect: 'error'
      });
    } catch { throw new Error('GitHub request failed or timed out'); }
    if (noReleaseAllowed && response.status === 404) return null;
    requireValue(response.ok, `GitHub HTTP ${response.status}`);
    try { return await response.json(); } catch { throw new Error('Invalid GitHub JSON'); }
  };
}

export async function checkSource(source, get) {
  const repo = source.repository.slice('https://github.com/'.length, -4);
  const base = `/repos/${repo}`;
  const result = {id: source.id, repository: source.repository, baselineVersion: source.version, consumers: [], errors: []};
  try {
    const info = await get(base);
    requireValue(typeof info.default_branch === 'string' && info.default_branch.length > 0 && info.default_branch.length <= 255 && !/[\u0000-\u001f]/.test(info.default_branch), 'Invalid default branch');
    result.defaultBranch = info.default_branch;
    const head = await get(`${base}/commits/${encodeURIComponent(info.default_branch)}`);
    requireValue(SHA.test(head.sha), 'Invalid main commit');
    result.mainRevision = head.sha;
  } catch (error) { result.errors.push(error.message); }
  try {
    const release = await get(`${base}/releases/latest`, true);
    if (release === null) result.release = {status: 'no-release'};
    else {
      requireValue(release.draft === false && release.prerelease === false && typeof release.published_at === 'string' && Number.isFinite(Date.parse(release.published_at)), 'Invalid formal release');
      result.release = {status: versionOrder(release.tag_name, source.version), tag: release.tag_name, publishedAt: release.published_at,
        url: `https://github.com/${repo}/releases/tag/${encodeURIComponent(release.tag_name)}`};
    }
  } catch (error) { result.release = {status: 'unknown'}; result.errors.push(error.message); }
  for (const consumer of source.consumers) {
    const item = {id: consumer.id, baselineRevision: consumer.revision, status: 'unknown'};
    try {
      requireValue(result.mainRevision, 'Main revision unavailable');
      if (result.mainRevision === consumer.revision) item.status = 'same-revision';
      else {
        // Always compare immutable SHAs, never a moving branch ref.
        const diff = await get(`${base}/compare/${consumer.revision}...${result.mainRevision}`);
        requireValue(diff.status === 'ahead' && diff.base_commit?.sha === consumer.revision && diff.merge_base_commit?.sha === consumer.revision, 'Non-linear or invalid upstream history');
        Object.assign(item, classifyChanges(diff.files, consumer.inputs));
      }
    } catch (error) { item.error = error.message; result.errors.push(`${consumer.id}: ${error.message}`); }
    result.consumers.push(item);
  }
  result.status = result.errors.length ? 'unknown' : 'checked';
  return result;
}

const escape = value => String(value ?? 'unknown').replace(/[&<>|`\[\]\r\n]/g, c => `&#${c.charCodeAt(0)};`);
export function summary(report) {
  const lines = ['# Daily upstream resource check', '', 'Detection only: no resources signed or published.', '', '| Upstream | Release vs baseline | Consumer | Main vs pinned input |', '| --- | --- | --- | --- |'];
  for (const source of report.sources) for (const consumer of source.consumers) {
    lines.push(`| ${escape(source.id)} | ${escape(source.release?.status)} (${escape(source.release?.tag)}) | ${escape(consumer.id)} | ${escape(consumer.status)} |`);
  }
  for (const source of report.sources) {
    lines.push('', `## ${escape(source.id)}`, '', `Default branch: ${escape(source.defaultBranch)}; main SHA: ${escape(source.mainRevision)}`, `Baseline version: ${escape(source.baselineVersion)}`);
    for (const consumer of source.consumers) lines.push(`- ${escape(consumer.id)} baseline SHA: ${escape(consumer.baselineRevision)}`);
    for (const error of source.errors) lines.push(`- ERROR: ${escape(error)}`);
  }
  return lines.join('\n') + '\n';
}

export async function watch(sources, get = githubClient()) {
  const results = [];
  for (const source of sources) results.push(await checkSource(source, get));
  return {schemaVersion: 1, checkedAt: new Date().toISOString(), sourceCommit: process.env.GITHUB_SHA ?? null,
    publication: 'not-attempted', status: results.some(s => s.status === 'unknown') ? 'unknown' : 'checked', sources: results};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = join(ROOT, '.build', 'upstream-watch');
  mkdirSync(out, {recursive: true});
  const report = await watch(loadSources());
  const markdown = summary(report);
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(join(out, 'summary.md'), markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  console.log(markdown);
  if (report.status === 'unknown') process.exitCode = 1;
}
