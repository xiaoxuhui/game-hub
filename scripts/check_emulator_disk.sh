#!/usr/bin/env bash
set -euo pipefail

available_mb=$(df -Pm "$HOME" | awk 'NR == 2 {print $4}')
echo "Free space before AVD launch: ${available_mb} MB"
if [ "$available_mb" -lt 7800 ]; then
  echo "Insufficient disk space for AVD userdata partition" >&2
  exit 1
fi
