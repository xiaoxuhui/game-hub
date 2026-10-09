"""Task recovery archive: no deletion/original writes/signing-key access; optional in-memory GitHub API credential."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile

BASE = Path(r'D:\soft')
ARCHIVE = BASE / 'game-hub-archives/final-cleanup-20261009'
MAIN = BASE / 'game-hub'
TEMP = BASE / '.ci-tmp'
TOP = (
    'game-hub-build', 'game-hub-build-final', 'game-hub-build-icon-20261003',
    'game-hub-build-p3', 'game-hub-build-p6', 'game-hub-build-p7',
    'game-hub-build-resources-20261008', 'game-hub-build-v2',
    'game-hub-candidate-v0.2.0-153df9a', 'game-hub-continuous-audit-20261008',
    'game-hub-icon-audit-20261003', 'game-hub-planning-v0.3.0-20261003',
    'game-hub-release-v0.2.0-74216c3', 'game-hub-release-v0.2.0-f53a4c1',
    'game-hub-resource-producer-20261009', 'game-hub-upgrade-20261009',
    'game-hub-verify-v030-20261008',
)
CI = (
    'emulator-evidence', 'game-hub-avd', 'game-hub-final-153df9a', 'game-hub-license-audit',
    'game-hub-light-smoke-c861', 'game-hub-m3-emulator', 'game-hub-maintenance',
    'game-hub-p7-candidate', 'game-hub-p7-emulator', 'game-hub-p7-license-candidate',
    'game-hub-signing-tools', 'game-hub-tools', 'game-hub-upgrade-fixtures-20261009', 'game-hub-work',
)
env = dict(os.environ, GIT_OPTIONAL_LOCKS='0')
if len(sys.argv[1:]) != len(set(sys.argv[1:])) or set(sys.argv[1:]) - {'--authenticated-api', '--post-stop'}:
    raise RuntimeError('Unexpected archive arguments')
allow_authenticated_api = '--authenticated-api' in sys.argv[1:]
post_stop = '--post-stop' in sys.argv[1:]
if BASE.resolve() != BASE or TEMP.resolve() != TEMP or MAIN.resolve() != MAIN:
    raise RuntimeError('Workspace ancestry differs from exact intended roots')

def digest(data):
    return hashlib.sha256(data).hexdigest()

def sha(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        while chunk := stream.read(1024 * 1024):
            value.update(chunk)
    return value.hexdigest()

def git(root, *args):
    return subprocess.run(['git', '-C', str(root), *args], env=env, check=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout

def write_new_or_identical(path, data):
    if path.exists():
        if path.read_bytes() != data:
            raise RuntimeError(f'Existing archive differs; inspect outcome: {path.name}')
    else:
        with path.open('xb') as stream:
            stream.write(data)

def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')

def files(root):
    for parent, dirs, names in os.walk('\\\\?\\' + str(root), followlinks=False):
        for name in list(dirs):
            item = Path(parent) / name
            if item.stat(follow_symlinks=False).st_file_attributes & 1024:
                raise RuntimeError(f'Unexpected link inside archival root: {root.name}')
        for name in names:
            item = Path(parent) / name
            if item.stat(follow_symlinks=False).st_file_attributes & 1024:
                raise RuntimeError('Unexpected file link')
            yield item, str(item)[4 + len(str(root)) + 1:].replace('\\', '/')

def archive_zip(name, pairs):
    pairs = list(pairs)
    index = [{'path': relative, 'bytes': path.stat().st_size, 'sha256': sha(path)}
             for path, relative in pairs]
    target = ARCHIVE / (name + '.zip')
    if not target.exists():
        with zipfile.ZipFile(target, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zipped:
            for path, relative in pairs:
                if relative.startswith('/') or '..' in Path(relative).parts:
                    raise RuntimeError('Unsafe ZIP path')
                zipped.write(path, relative)
    with zipfile.ZipFile(target) as zipped:
        if zipped.testzip() is not None or zipped.namelist() != [r['path'] for r in index]:
            raise RuntimeError(f'Invalid ZIP snapshot: {name}')
        for item in index:
            if digest(zipped.read(item['path'])) != item['sha256']:
                raise RuntimeError(f'ZIP bytes changed: {name}')
    write_new_or_identical(ARCHIVE / (name + '.files.json'), json_bytes(index))
    print(f'Verified archive {name}: {len(index)} files', flush=True)

ARCHIVE.mkdir(parents=True, exist_ok=True)
if ARCHIVE.resolve() != ARCHIVE:
    raise RuntimeError('Permanent archive root is a link')
if post_stop:
    original_index = ARCHIVE / 'verified-archive-index.json'
    if sha(original_index) != '05b326523c0152ccb8ec8ab18074c194119220dd507ea303c67e42f13e3b78b3':
        raise RuntimeError('Pre-stop archive index changed')
    for entry in json.loads(original_index.read_text(encoding='utf-8')):
        path = ARCHIVE / entry['path']
        if path.resolve() != path or not path.is_relative_to(ARCHIVE) or path.stat().st_size != entry['bytes'] or sha(path) != entry['sha256']:
            raise RuntimeError('Pre-stop archive bytes changed')
# Revalidate existing ten snapshots against their still-present original task clones.
old_dir = BASE / 'game-hub-archives/retired-checkouts-20261009'
old_index = json.loads((old_dir / 'verified-index.json').read_text(encoding='utf-8'))
for record in old_index:
    root = Path(record['originalPath'])
    if root.parent != BASE or root.name not in TOP or root.resolve() != root:
        raise RuntimeError('Historical root escaped allowlist')
    snapshot = Path(record['archivePath'])
    if snapshot.parent != old_dir:
        raise RuntimeError('Historical archive escaped allowlist')
    if git(root, 'rev-parse', 'HEAD').decode().strip() != record['head']:
        raise RuntimeError('Historical HEAD changed')
    for name, args in (('status.txt', ('status', '--porcelain=v1', '--untracked-files=all')),
                       ('staged.patch', ('diff', '--cached', '--binary', 'HEAD')),
                       ('worktree.patch', ('diff', '--binary'))):
        if (snapshot / name).read_bytes() != git(root, *args):
            raise RuntimeError(f'Historical snapshot differs: {root.name}')
    for item in record['archiveFiles']:
        if sha(snapshot / item['name']) != item['sha256']:
            raise RuntimeError('Historical archive digest differs')
    git(root, 'bundle', 'verify', str(snapshot / 'repository.bundle'))
    heads = git(root, 'bundle', 'list-heads', str(snapshot / 'repository.bundle')).decode()
    if f"{record['head']} HEAD" not in heads:
        raise RuntimeError('Historical recovery HEAD missing')
    refs = git(root, 'for-each-ref', '--format=%(objectname) %(refname)').decode().splitlines()
    if any(ref not in heads.splitlines() for ref in refs):
        raise RuntimeError('Historical live refs differ from saved bundle')
    untracked = json.loads((snapshot / 'untracked-index.json').read_text(encoding='utf-8'))
    paths = [p.decode('utf-8') for p in git(root, 'ls-files', '--others', '--exclude-standard', '-z').split(b'\0') if p]
    if paths != [i['path'] for i in untracked]:
        raise RuntimeError('Historical untracked list changed')
    with zipfile.ZipFile(snapshot / 'untracked.zip') as zipped:
        if zipped.testzip() is not None:
            raise RuntimeError('Historical ZIP damaged')
        for item in untracked:
            if sha(root / item['path']) != item['sha256'] or digest(zipped.read(item['path'])) != item['sha256']:
                raise RuntimeError('Historical untracked bytes changed')
print('Revalidated ten historical checkout bundles, patches and untracked archives', flush=True)

producer = TEMP / 'game-hub-work/v030-final'
repos = [('upgrade-checkout', BASE / 'game-hub-upgrade-20261009'), ('final-producer', producer)]
repos += [('dynamic-' + name, producer / '.build/dynamic-sources' / name)
          for name in ('abelian-sandpile', 'lambda-diagram-game', 'memory-demo')]
repos += [('upstream-' + name, producer / '.build/upstream-dynamic' / name)
          for name in ('abelian-sandpile', 'lambda-diagram-game')]
repo_records = []
for label, root in repos:
    if root.resolve() != root or not (root / '.git').is_dir():
        raise RuntimeError('Expected ordinary task clone required')
    head = git(root, 'rev-parse', 'HEAD').decode().strip()
    snap = ARCHIVE / label
    snap.mkdir(exist_ok=True)
    if snap.resolve() != snap:
        raise RuntimeError('Git archive directory is a link')
    for name, args in (('status.txt', ('status', '--porcelain=v1', '--untracked-files=all')),
                       ('staged.patch', ('diff', '--cached', '--binary', 'HEAD')),
                       ('worktree.patch', ('diff', '--binary'))):
        write_new_or_identical(snap / name, git(root, *args))
    bundle = snap / 'repository.bundle'
    if not bundle.exists():
        git(root, 'bundle', 'create', str(bundle), '--all', 'HEAD')
    git(root, 'bundle', 'verify', str(bundle))
    heads = git(root, 'bundle', 'list-heads', str(bundle)).decode()
    if f'{head} HEAD' not in heads:
        raise RuntimeError('Detached HEAD missing from recovery bundle')
    refs = git(root, 'for-each-ref', '--format=%(objectname) %(refname)').decode().splitlines()
    if any(ref not in heads.splitlines() for ref in refs):
        raise RuntimeError('Live refs differ from recovery bundle')
    paths = [p.decode('utf-8') for p in git(root, 'ls-files', '--others', '--exclude-standard', '-z').split(b'\0') if p]
    for relative in paths:
        path = root / relative
        if path.resolve() != path or not path.is_file() or not path.is_relative_to(root):
            raise RuntimeError('Untracked path escaped task clone')
    archive_zip(label + '-untracked', [(root / p, p) for p in paths])
    repo_records.append({'name': label, 'originalPath': str(root), 'head': head,
                         'bundle': str(bundle), 'bundleSha256': sha(bundle),
                         'stagedPatchSha256': sha(snap / 'staged.patch'),
                         'worktreePatchSha256': sha(snap / 'worktree.patch')})
write_new_or_identical(ARCHIVE / 'repository-index.json', json_bytes(repo_records))

old_git_names = {r['name'] for r in old_index} | {'game-hub-upgrade-20261009'}
for name in TOP:
    if name not in old_git_names:
        archive_zip(name, files(BASE / name))
for name in CI:
    if name not in ('game-hub-avd', 'game-hub-signing-tools', 'game-hub-tools', 'game-hub-work'):
    snapshot_name = name + '-after-stop' if post_stop and name in ('game-hub-m3-emulator', 'game-hub-upgrade-fixtures-20261009') else name
    archive_zip(snapshot_name, files(TEMP / name))
archive_zip('final-evidence', files(TEMP / 'game-hub-work/v030-evidence'))
avd = TEMP / 'game-hub-avd'
expected_avds = {'gamehub-icon-20261003', 'gamehub-p7', 'gamehub-resource-20261008', 'gamehub-upgrade-20261009'}
if {p.stem for p in avd.glob('*.avd')} != expected_avds or {p.stem for p in avd.glob('*.ini')} != expected_avds:
    raise RuntimeError('Unexpected task AVD configuration')
avd_config = [(p, p.relative_to(avd).as_posix()) for p in sorted(avd.glob('*.ini'))]
avd_config += [(avd / (name + '.avd') / 'config.ini', name + '.avd/config.ini') for name in sorted(expected_avds)]
archive_zip('task-avd-config', avd_config)

# Public bytes remain anonymous. Optional metadata-only authentication handles shared-IP limits.
formal = ARCHIVE / 'formal-assets'
formal.mkdir(exist_ok=True)
if formal.resolve() != formal:
    raise RuntimeError('Formal asset directory is a link')
formal_records = []
api_token = None

class NoApiRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None

api_opener = urllib.request.build_opener(NoApiRedirect())

def existing_github_token():
    credential_env = dict(env, GIT_TERMINAL_PROMPT='0', GCM_INTERACTIVE='never')
    result = subprocess.run(['git', '-C', str(MAIN), 'credential', 'fill'],
                            input=b'protocol=https\nhost=github.com\n\n',
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            env=credential_env, timeout=30)
    fields = dict(line.split('=', 1) for line in result.stdout.decode('utf-8', errors='replace').splitlines()
                  if '=' in line)
    token = fields.get('password')
    if result.returncode or not token or '\r' in token or '\n' in token:
        raise RuntimeError('Existing GitHub credential unavailable; no API gate bypass permitted')
    return token

def api_json(url):
    global api_token
    if not url.startswith('https://api.github.com/repos/xiaoxuhui/game-hub/releases/'):
        raise RuntimeError('Unexpected metadata endpoint')
    headers = {'User-Agent': 'game-hub-cleanup-archive', 'Accept': 'application/vnd.github+json'}
    if api_token:
        headers['Authorization'] = 'Bearer ' + api_token
    request = urllib.request.Request(url, headers=headers)
    try:
        with api_opener.open(request, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        if not allow_authenticated_api or api_token or error.code != 403 or error.headers.get('X-RateLimit-Remaining') != '0':
            raise
    api_token = existing_github_token()
    print('Shared-IP limit: using existing credential for read-only GitHub metadata; public byte downloads stay anonymous', flush=True)
    return api_json(url)

def complete_release(tag):
    release = api_json('https://api.github.com/repos/xiaoxuhui/game-hub/releases/tags/' + tag)
    if release['draft'] or release['tag_name'] != tag or not isinstance(release['id'], int) or release['id'] <= 0:
        raise RuntimeError('Unexpected formal release')
    assets = []
    for page in range(1, 11):
        batch = api_json(f"https://api.github.com/repos/xiaoxuhui/game-hub/releases/{release['id']}/assets?per_page=100&page={page}")
        if not isinstance(batch, list) or len(batch) > 100:
            raise RuntimeError('Unexpected asset page')
        assets.extend(batch)
        if len(batch) < 100:
            break
    else:
        raise RuntimeError('Incomplete bounded asset pagination')
    if len(assets) > 30 or len({a['id'] for a in assets}) != len(assets) or len({a['name'] for a in assets}) != len(assets):
        raise RuntimeError('Duplicate or unexpected asset set')
    return release, assets

def identities(assets):
    return sorted((a['id'], a['name'], a['size'], a.get('digest'), a['state'], a['browser_download_url']) for a in assets)

for tag in ('v0.2.0', 'v0.3.0', 'v0.4.0', 'game-resources-v1', 'game-resources-v2'):
    release, assets = complete_release(tag)
    for asset in assets:
        name = asset['name']
        if Path(name).name != name or '/' in name or '\\' in name or name in ('.', '..'):
            raise RuntimeError('Unsafe asset filename')
        expected = asset.get('digest', '')
        if asset['state'] != 'uploaded' or not expected.startswith('sha256:') or len(expected) != 71 or not isinstance(asset['id'], int) or asset['id'] <= 0 or not isinstance(asset['size'], int) or not 0 < asset['size'] <= 26 * 1024 * 1024:
            raise RuntimeError('Formal asset lacks immutable digest')
        path = formal / (tag + '--' + name)
        url = 'https://github.com/xiaoxuhui/game-hub/releases/download/' + tag + '/' + name
        if asset['browser_download_url'] != url:
            raise RuntimeError('Unexpected asset origin')
        if not path.exists():
            # Asset ID is in the actual API path. A cache query alone is not identity binding.
            download = 'https://api.github.com/repos/xiaoxuhui/game-hub/releases/assets/' + str(asset['id'])
            request = urllib.request.Request(download + '?download=1', headers={'User-Agent': 'game-hub-cleanup-archive', 'Accept': 'application/octet-stream'})
            with urllib.request.urlopen(request, timeout=60) as response:
                data = response.read(asset['size'] + 1)
            if len(data) != asset['size'] or digest(data) != expected[7:]:
                raise RuntimeError('Formal public asset bytes differ')
            write_new_or_identical(path, data)
        if path.stat().st_size != asset['size'] or sha(path) != expected[7:]:
            raise RuntimeError('Permanent formal asset copy differs')
        formal_records.append({'tag': tag, 'releaseId': release['id'], 'assetId': asset['id'],
                               'name': name, 'bytes': asset['size'], 'sha256': expected[7:], 'file': path.name})
    after_release, after_assets = complete_release(tag)
    if after_release['id'] != release['id'] or identities(after_assets) != identities(assets):
        raise RuntimeError('Formal asset identities changed during archival')
    print(f'Archived formal release {tag}', flush=True)
write_new_or_identical(formal / 'verified-index.json', json_bytes(formal_records))

write_new_or_identical(ARCHIVE / 'README.txt', (
    'Private task recovery archive. Do not publish ZIPs, raw test saves or local browser data.\n'
    'Ten prior task clones: ../retired-checkouts-20261009/README.txt and verified-index.json.\n'
    'Seven additional Git snapshots: repository-index.json; bundles contain all refs and HEAD.\n'
    'Restore each bundle into a NEW empty directory, checkout its full HEAD, apply staged.patch\n'
    'with git apply --index, then worktree.patch with git apply. Extract the matching untracked ZIP.\n'
    'Every ZIP has a verified file index; formal-assets includes all public assets and API-bound SHA256.\n'
    'Ignored build/cache output and disposable AVD disk images are reproducible and omitted.\n'
    'Original six repositories, main repository, signing keys and backup are outside cleanup scope.\n'
    'Old maintenance scripts retain historical paths; consult permanent toolchain README before reuse.\n'
).encode('utf-8'))
index_name = 'verified-archive-index-after-stop.json' if post_stop else 'verified-archive-index.json'
if post_stop:
    write_new_or_identical(ARCHIVE / 'README-after-stop.txt', (
        'The original 96-file archive and original index remain byte-identical.\n'
        'Own emulator shutdown appended four logs in two task evidence directories.\n'
        'The two *-after-stop ZIPs preserve complete final directory states; original ZIPs preserve pre-stop states.\n'
        'The after-stop index binds both generations, including the original index.\n'
        'Only these two explicit task snapshots vary; other source/current clone gates are unchanged.\n'
    ).encode('utf-8'))
index = [{'path': relative, 'bytes': p.stat().st_size, 'sha256': sha(p)} for p, relative in files(ARCHIVE)
         if relative != index_name]
write_new_or_identical(ARCHIVE / index_name, json_bytes(index))
print(json.dumps({'ready': True, 'archivedFiles': len(index), 'archiveBytes': sum(r['bytes'] for r in index),
                  'formalAssets': len(formal_records), 'additionalGitClones': len(repo_records)}), flush=True)
