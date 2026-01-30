#!/usr/bin/env bash
set -euo pipefail

export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
export PATH="$PATH:$HOME/.maestro/bin"

adb start-server >/dev/null
adb reverse tcp:8081 tcp:8081 || true

# アプリデータを毎回リセット
adb shell pm clear com.astapi.LootDive >/dev/null

# Dev Client経由で起動
adb shell am start -a android.intent.action.VIEW -d "lootdive://" >/dev/null

maestro test .maestro
