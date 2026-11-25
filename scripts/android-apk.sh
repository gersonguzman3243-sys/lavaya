#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
if [[ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" && ! -d "$ANDROID_HOME/platforms" ]]; then
  echo "No encuentro el Android SDK en $ANDROID_HOME."
  echo "Instálalo y vuelve a correr: npm run android:apk"
  exit 1
fi
cd "$ROOT"
if [[ ! -d android ]]; then
  npx cap add android
fi
mkdir -p android
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > android/local.properties
npx cap sync android
cd android
chmod +x ./gradlew
./gradlew assembleDebug
echo "APK: $ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
