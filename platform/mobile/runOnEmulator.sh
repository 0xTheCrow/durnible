#!/usr/bin/env bash
set -euo pipefail

emulator_avd_name="durnible-api371"
mobile_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
android_project_dir="$mobile_dir/android"

resolve_android_sdk_dir() {
  if [ -n "${ANDROID_HOME:-}" ]; then
    echo "$ANDROID_HOME"
    return 0
  fi
  local local_properties="$android_project_dir/local.properties"
  if [ -f "$local_properties" ]; then
    sed -n 's/^sdk\.dir=//p' "$local_properties" | head -1
    return 0
  fi
  return 1
}

android_sdk_dir="$(resolve_android_sdk_dir)" || {
  echo "Android SDK location unknown. Set ANDROID_HOME, or create $android_project_dir/local.properties with sdk.dir=<path>." >&2
  exit 1
}

adb="$android_sdk_dir/platform-tools/adb"
if [ ! -x "$adb" ]; then
  echo "adb not found at $adb. Install platform-tools into $android_sdk_dir." >&2
  exit 1
fi

find_emulator_serial() {
  local serial
  for serial in $("$adb" devices | awk '/^emulator-/{print $1}'); do
    if [ "$("$adb" -s "$serial" emu avd name 2>/dev/null | head -1 | tr -d '\r')" = "$emulator_avd_name" ]; then
      echo "$serial"
      return 0
    fi
  done
  return 1
}

emulator_serial="$(find_emulator_serial)" || {
  echo "No running emulator named $emulator_avd_name." >&2
  echo "Start it with: $android_sdk_dir/emulator/emulator -avd $emulator_avd_name -gpu swiftshader_indirect" >&2
  exit 1
}

"$android_project_dir/gradlew" -p "$android_project_dir" assembleDebug

exec "$adb" -s "$emulator_serial" install -r \
  "$android_project_dir/app/build/outputs/apk/debug/app-debug.apk"
