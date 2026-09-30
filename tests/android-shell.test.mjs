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
  assert.match(gradle, /versionName\s*=\s*"0\.1\.0"/);
  assert.doesNotMatch(gradle, /storeFile\s*=\s*file\("debug\.keystore"\)/);
});

test('Manifest has one launcher and no extra Android permissions', () => {
  const manifest = text('android/app/src/main/AndroidManifest.xml');
  assert.equal((manifest.match(/android\.intent\.category\.LAUNCHER/g) ?? []).length, 1);
  assert.doesNotMatch(manifest, /uses-permission|android\.permission\./);
  assert.match(manifest, /android:exported="true"/);
  assert.ok(existsSync(join(root, 'android/gradle/wrapper/gradle-wrapper.jar')));
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
  assert.match(activity, /ActivityResultContracts\.CreateDocument/);
  assert.match(activity, /fetch\(node\.href\)/);
});
