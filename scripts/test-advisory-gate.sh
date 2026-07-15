#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

node "${root_dir}/scripts/test-advisory-gate.mjs"
node "${root_dir}/scripts/check-advisory-exceptions.mjs"

echo "advisory gate tests passed"
