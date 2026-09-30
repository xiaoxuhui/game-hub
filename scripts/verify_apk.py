"""Verify that the Android APK contains exactly the locked, hashed game assets."""

import hashlib
import json
import re
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
        fields = ("id", "displayName", "repository", "revision", "version", "entryPage")
        expected_sources = [{field: item[field] for field in fields} for item in lock["sources"]]
        if len(expected_sources) != 4 or manifest["sources"] != expected_sources:
            raise ValueError("Source list differs from the lock")
        source_ids = {item["id"] for item in expected_sources}
        expected_assets = {"assets/bundle-manifest.json"}
        for item in manifest["files"]:
            path = item["path"]
            if not re.fullmatch(r"games/(?:[A-Za-z0-9._-]+/)*[A-Za-z0-9._-]+", path) or any(
                part in ("", ".", "..") for part in path.split("/")
            ):
                raise ValueError(f"Unsafe manifest path: {path}")
            packaged_path = f"assets/{path}"
            if packaged_path in expected_assets:
                raise ValueError(f"Duplicate manifest path: {path}")
            expected_assets.add(packaged_path)
            data = apk.read(packaged_path)
            if len(data) != item["bytes"] or hashlib.sha256(data).hexdigest() != item["sha256"]:
                raise ValueError(f"APK resource differs from manifest: {path}")
        # Release builds may add Android's generated startup profile beside our locked game assets.
        generated_profiles = {"assets/dexopt/baseline.prof", "assets/dexopt/baseline.profm"}
        game_assets = set(names) - generated_profiles
        if game_assets != expected_assets:
            raise ValueError(f"APK has missing or unregistered game assets: {sorted(game_assets ^ expected_assets)}")
        for path in ["games/LICENSE", *(f"games/{game_id}/LICENSE" for game_id in source_ids)]:
            if f"assets/{path}" not in expected_assets:
                raise ValueError(f"Missing bundled license: {path}")
    print(f"Verified {len(expected_sources)} sources and {len(expected_assets) - 1} APK resources for {commit}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: verify_apk.py APK FULL_GIT_SHA")
    main(Path(sys.argv[1]), sys.argv[2])
