#!/usr/bin/env bash
# Cloud Agent install: deps + Node type-stripping for oxlint JS plugins.
# /exec-daemon/node is 22.14 and cannot import tools/oxlint/anti-slop/index.ts
# without --experimental-strip-types. Persist that flag for stop-hook pnpm check.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NODE_OPTIONS_VALUE='--experimental-strip-types --no-warnings'
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }${NODE_OPTIONS_VALUE}"

persist_node_options() {
  local file="$1"
  local line="export NODE_OPTIONS=\"\${NODE_OPTIONS:+\$NODE_OPTIONS }${NODE_OPTIONS_VALUE}\""
  mkdir -p "$(dirname "$file")"
  touch "$file"
  if ! grep -q 'experimental-strip-types' "$file"; then
    printf '\n%s\n' "$line" >> "$file"
  fi
}

persist_node_options "${HOME}/.profile"
persist_node_options "${HOME}/.bashrc"

if sudo -n true 2>/dev/null; then
  if sudo grep -q '^NODE_OPTIONS=--experimental-strip-types --no-warnings$' /etc/environment 2>/dev/null; then
    sudo sed -i 's/^NODE_OPTIONS=--experimental-strip-types --no-warnings$/NODE_OPTIONS="--experimental-strip-types --no-warnings"/' /etc/environment
  elif ! sudo grep -q 'experimental-strip-types' /etc/environment 2>/dev/null; then
    # Quote the value: /etc/environment is sourced as a shell script by
    # update-info-dir. Unquoted spaces make `--no-warnings` a command.
    printf 'NODE_OPTIONS="%s"\n' "${NODE_OPTIONS_VALUE}" | sudo tee -a /etc/environment >/dev/null
  fi

  sudo DEBIAN_FRONTEND=noninteractive apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    -o Dpkg::Options::="--force-confold" \
    libwebkit2gtk-4.1-dev \
    libgtk-3-dev \
    libappindicator3-dev \
    librsvg2-dev \
    patchelf \
    pkg-config
fi

if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  . "${HOME}/.nvm/nvm.sh"
  nvm install --lts
  nvm alias default 'lts/*'
  NODE_BIN_DIR="${NVM_DIR}/versions/node/$(nvm version default)/bin"
  export PATH="${NODE_BIN_DIR}:${PATH}"
  hash -r
  corepack enable
  corepack prepare pnpm@10.33.0 --activate
fi

pnpm install --frozen-lockfile --ignore-scripts
