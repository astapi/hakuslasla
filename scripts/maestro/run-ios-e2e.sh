#!/usr/bin/env bash
set -euo pipefail

export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
export PATH="$PATH:$HOME/.maestro/bin"

# Booted Simulatorが必要
SIM_ID=$(xcrun simctl list devices booted | rg -o "\(([-0-9A-F]+)\)" -r '$1' | head -n 1 || true)
if [[ -z "$SIM_ID" ]]; then
  echo "No booted iOS Simulator found. Please boot one and retry." >&2
  exit 1
fi

# Dev ClientをopenLinkで起動
xcrun simctl openurl "$SIM_ID" "exp+lootdive://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081&disableOnboarding=1"

maestro test .maestro
