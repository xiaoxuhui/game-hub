import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (name) => readFileSync(join(root, name), 'utf8');

test('Android application identity and minimum API stay independent of source APKs', () => {
  const gradle = text('android/app/build.gradle.kts');
  assert.match(gradle, /applicationId\s*=\s*"com\.xiaoxuhui\.gamehub"/);
  assert.match(gradle, /minSdk\s*=\s*24/);
  assert.equal(gradle.match(/versionName\s*=\s*"([^"]+)"/)[1], JSON.parse(text('package.json')).version);
  assert.match(gradle, /versionCode\s*=\s*3/);
  assert.doesNotMatch(gradle, /storeFile\s*=\s*file\("debug\.keystore"\)/);
});

test('Manifest has one launcher and only the planned update permission', () => {
  const manifest = text('android/app/src/main/AndroidManifest.xml');
  assert.equal((manifest.match(/android\.intent\.category\.LAUNCHER/g) ?? []).length, 1);
  assert.match(manifest, /android\.permission\.INTERNET/);
  assert.match(manifest, /android\.permission\.REQUEST_INSTALL_PACKAGES/);
  assert.doesNotMatch(manifest, /android\.permission\.(?!INTERNET|REQUEST_INSTALL_PACKAGES)[A-Z_]+/);
  assert.match(manifest, /androidx\.core\.content\.FileProvider/);
  assert.ok(existsSync(join(root, 'android/app/src/main/res/xml/update_paths.xml')));
  assert.match(manifest, /android:exported="true"/);
  assert.ok(existsSync(join(root, 'android/gradle/wrapper/gradle-wrapper.jar')));
});

test('compact lobby uses four fixed source icons and clickable cards', () => {
  const activity = text('android/app/src/main/java/com/xiaoxuhui/gamehub/MainActivity.kt');
  for (const id of ['conway', 'eml', 'light', 'turing']) {
    assert.ok(existsSync(join(root, `android/app/src/main/res/drawable-nodpi/game_${id}.png`)));
    assert.match(activity, new RegExp(`R\\.drawable\\.game_${id}`));
  }
  assert.match(activity, /contentDescription = "\$\{game\.name\}，版本/);
  assert.doesNotMatch(activity, /"进入项目"/);
  assert.match(activity, /blockNetworkLoads\s*=\s*true/);
});

test('CI builds pinned sources and checks APK without a publish step', () => {
  const workflow = text('.github/workflows/android-check.yml');
  assert.match(workflow, /pnpm run bundle/);
  assert.match(workflow, /pnpm run verify:bundle/);
  assert.match(workflow, /assembleDebug/);
  assert.match(workflow, /dump permissions/);
  assert.doesNotMatch(workflow, /action-gh-release|refs\/tags\/|deploy/);
});

test('four original export bridge names and a file chooser are wired', () => {
  const activity = text('android/app/src/main/java/com/xiaoxuhui/gamehub/MainActivity.kt');
  for (const bridge of ['ConwayAndroid', 'EMLAndroid', 'LightAndroid', 'TuringAndroid']) {
    assert.ok(activity.includes(`"${bridge}"`), `${bridge} is missing`);
  }
  assert.match(activity, /fun saveFile\(name: String, content: String\): Boolean/);
  assert.match(activity, /onShowFileChooser/);
  assert.match(activity, /FileChooserParams\.parseResult/);
  assert.match(activity, /Intent\.ACTION_CREATE_DOCUMENT/);
  assert.match(activity, /HTMLAnchorElement\.prototype\.click/);
  assert.match(activity, /blob\.text\(\)/);
});
