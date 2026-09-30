"""Verify that the Android APK contains exactly the locked, hashed game assets."""

import hashlib
import json
import sys
import zipfile
from pathlib import Path


def main(apk_path: Path, commit: str) -> None:
    root = Path(__file__).resolve().parent.parent
    lock = json.loads((root / "sources.lock.json").read_text(encoding="utf-8"))
    local_manifest = (root / "android/app/src/main/assets/bundle-manifest.json").read_bytes()
    with zipfile.ZipFile(apk_path) as apk:
        names = [name for name in apk.namelist() if name.startswith("assets/") and not name.endswith("/")]
        if len(names) != len(set(names)):
            raise ValueError("APK has duplicate asset paths")
        packaged_manifest = apk.read("assets/bundle-manifest.json")
        if packaged_manifest != local_manifest:
            raise ValueError("Packaged manifest differs from the verified local bundle")
        manifest = json.loads(packaged_manifest)
        if manifest["bundleCommit"] != commit:
            raise ValueError("Bundle commit differs from the workflow checkout")
        expected_sources = {item["id"]: item for item in lock["sources"]}
        actual_sources = {item["id"]: item for item in manifest["sources"]}
        if len(actual_sources) != 4 or set(actual_sources) != set(expected_sources):
            raise ValueError("Source list differs from the lock")
        for game_id, source in expected_sources.items():
            item = actual_sources[game_id]
            for field in ("revision", "version", "repository", "entryPage"):
                if item[field] != source[field]:
                    raise ValueError(f"{game_id}: {field} differs from the lock")
        expected_assets = {"assets/bundle-manifest.json"}
        for item in manifest["files"]:
            path = item["path"]
            if not path.startswith("games/") or ".." in path.split("/"):
                raise ValueError(f"Unsafe manifest path: {path}")
            packaged_path = f"assets/{path}"
            if packaged_path in expected_assets:
                raise ValueError(f"Duplicate manifest path: {path}")
            expected_assets.add(packaged_path)
            data = apk.read(packaged_path)
            if len(data) != item["bytes"] or hashlib.sha256(data).hexdigest() != item["sha256"]:
                raise ValueError(f"APK resource differs from manifest: {path}")
        if set(names) != expected_assets:
            raise ValueError(f"APK has missing or unregistered assets: {sorted(set(names) ^ expected_assets)}")
        for path in ["games/LICENSE", *(f"games/{game_id}/LICENSE" for game_id in expected_sources)]:
            if f"assets/{path}" not in expected_assets:
                raise ValueError(f"Missing bundled license: {path}")
    print(f"Verified {len(actual_sources)} sources and {len(expected_assets) - 1} APK resources for {commit}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: verify_apk.py APK FULL_GIT_SHA")
    main(Path(sys.argv[1]), sys.argv[2])
