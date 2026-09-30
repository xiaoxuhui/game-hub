"""Recheck NOTICE files in the resolved 0.2.0 Maven runtime archives."""

import argparse
import csv
import hashlib
import io
import json
import re
import urllib.request
import zipfile
from pathlib import Path
from urllib.parse import urlparse


def notice_entries(archive: zipfile.ZipFile) -> list[str]:
    return sorted(name for name in archive.namelist() if re.fullmatch(
        r"(?:.*/)?NOTICE(?:\.[^/]*)?", name, re.IGNORECASE
    ))


def scan(row: dict[str, str]) -> dict[str, object]:
    coordinate = row["coordinate"]
    packaging = row["packaging"]
    pom_url = row["pom_url"]
    if urlparse(pom_url).hostname not in {"dl.google.com", "repo.maven.apache.org"}:
        raise ValueError(f"Unexpected Maven host: {pom_url}")
    if packaging == "pom":
        return {"coordinate": coordinate, "packaging": packaging, "archive": None}
    if packaging not in {"aar", "jar"} or not pom_url.endswith(".pom"):
        raise ValueError(f"Unexpected artifact type: {coordinate}: {packaging}")
    archive_url = pom_url[:-4] + "." + packaging
    with urllib.request.urlopen(archive_url, timeout=60) as response:
        data = response.read()
    with zipfile.ZipFile(io.BytesIO(data)) as outer:
        direct = notice_entries(outer)
        nested = []
        if packaging == "aar":
            for name in outer.namelist():
                if name.endswith(".jar"):
                    with zipfile.ZipFile(io.BytesIO(outer.read(name))) as inner:
                        nested.extend(f"{name}:{entry}" for entry in notice_entries(inner))
    return {
        "coordinate": coordinate,
        "packaging": packaging,
        "archive": archive_url,
        "sha256": hashlib.sha256(data).hexdigest(),
        "notice_entries": direct,
        "nested_jar_notice_entries": sorted(nested),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pom_tsv", type=Path)
    parser.add_argument("output_json", type=Path)
    args = parser.parse_args()
    with args.pom_tsv.open(encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source, delimiter="\t"))
    if len(rows) != 36 or len({row["coordinate"] for row in rows}) != 36:
        raise ValueError("Expected 36 unique resolved coordinates")
    results = [scan(row) for row in rows]
    args.output_json.write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    archives = [item for item in results if item["archive"]]
    notices = [item for item in archives if item["notice_entries"] or item["nested_jar_notice_entries"]]
    print(f"Scanned {len(archives)} archives and {len(results) - len(archives)} POM-only coordinates; {len(notices)} with NOTICE entries")


if __name__ == "__main__":
    main()
