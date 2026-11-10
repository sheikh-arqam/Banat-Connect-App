#!/usr/bin/env bash
# TEST-ONLY build for Banat Connect WebView shell.
# Toolchain reused from ~/workspace/apk-build (JDK 17, SDK 36).
# Signing: standard Android debug key ONLY (androiddebugkey / "android").
# This is a test APK, NOT a Play Store release. It must never be signed
# with the Huffaz or Job Portal upload keystores.
set -euo pipefail

ROOT="$HOME/workspace/female-classes-app/android"
OUT="$HOME/workspace/female-classes-app/android-build"
SDK="$HOME/workspace/apk-build/android-sdk"
BT="$SDK/build-tools/36.1.0"
AJAR="$SDK/platforms/android-36/android.jar"
export JAVA_HOME="$HOME/workspace/apk-build/jdk-17.0.20.1+1"
export PATH="$JAVA_HOME/bin:$BT:$PATH"

KS_PATH="$ROOT/debug.keystore"
KS_ALIAS="androiddebugkey"
KS_PASS="android"

WORK="$ROOT/build-work"
rm -rf "$WORK"
mkdir -p "$WORK/gen" "$WORK/classes" "$WORK/dex" "$OUT"

if [ ! -f "$KS_PATH" ]; then
  keytool -genkeypair -keystore "$KS_PATH" -alias "$KS_ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -dname "CN=Android Debug, O=Android, C=US"
  echo "debug keystore created: $KS_PATH"
fi

"$BT/aapt2" compile --dir "$ROOT/src/main/res" -o "$WORK/res.zip"

"$BT/aapt2" link -o "$WORK/app-unsigned.apk" \
  -I "$AJAR" --manifest "$ROOT/src/main/AndroidManifest.xml" \
  -R "$WORK/res.zip" --java "$WORK/gen" --auto-add-overlay \
  --min-sdk-version 24 --target-sdk-version 36 \
  --version-code 3 --version-name "1.0.2"
find "$ROOT/src/main/java" "$WORK/gen" -name '*.java' > "$WORK/sources.txt"
javac -encoding UTF-8 -cp "$AJAR" -d "$WORK/classes" @"$WORK/sources.txt"
"$BT/d8" --release --min-api 24 --lib "$AJAR" --output "$WORK/dex" \
  $(find "$WORK/classes" -name '*.class')
[ -f "$WORK/dex/classes.dex" ] || { echo "D8_FAILED"; exit 1; }

cp "$WORK/app-unsigned.apk" "$WORK/app.apk"
(cd "$WORK/dex" && zip -q -j "$WORK/app.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$WORK/app.apk" "$WORK/app-aligned.apk"
"$BT/apksigner" sign --ks "$KS_PATH" --ks-key-alias "$KS_ALIAS" \
  --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --out "$OUT/BanatConnect-v1.0.2.apk" "$WORK/app-aligned.apk"
"$BT/apksigner" verify --verbose "$OUT/BanatConnect-v1.0.2.apk"

echo "BUILD_OK"
ls -la "$OUT"
