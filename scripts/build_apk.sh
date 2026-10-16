#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
LUNA_SDK="${LUNA_SDK:-/tmp/android-sdk}"
LUNA_BUILD_TOOLS="${LUNA_BUILD_TOOLS:-$LUNA_SDK/android-15}"
LUNA_JAVAC="${LUNA_JAVAC:-/tmp/jdk17/usr/lib/jvm/java-17-openjdk-amd64/bin/javac}"
export LD_LIBRARY_PATH="/usr/lib/jvm/java-17-openjdk-amd64/lib:${LD_LIBRARY_PATH:-}"
mkdir -p build/classes build/dex dist
"$LUNA_BUILD_TOOLS/aapt2" compile --dir android/res -o build/resources.zip
"$LUNA_BUILD_TOOLS/aapt2" link -o build/resources.apk -I "$LUNA_SDK/android-35/android.jar" --manifest android/AndroidManifest.xml -R build/resources.zip -A web --min-sdk-version 26 --target-sdk-version 35 --auto-add-overlay -0 glb
"$LUNA_JAVAC" -source 8 -target 8 -bootclasspath "$LUNA_SDK/android-35/android.jar" -d build/classes android/src/com/luna/movement/MainActivity.java
"$LUNA_BUILD_TOOLS/d8" --lib "$LUNA_SDK/android-35/android.jar" --min-api 26 --output build/dex build/classes/com/luna/movement/*.class
cp build/resources.apk build/unsigned.apk
(cd build/dex && zip -q -u ../unsigned.apk classes.dex)
"$LUNA_BUILD_TOOLS/zipalign" -f -p 4 build/unsigned.apk build/aligned.apk
# Keep the development certificate outside the repository. Used only for this test APK.
LUNA_KEY="${LUNA_KEY:-/workspace/scratch/466d16a9ce68/source/luna19-test.keystore}"
if [ ! -f "$LUNA_KEY" ]; then
 keytool -genkeypair -keystore "$LUNA_KEY" -storepass android -alias luna19test -keypass android -keyalg RSA -keysize 2048 -validity 3650 -dname 'CN=Luna19 Development, O=Luna19, C=CN' >/dev/null 2>&1
fi
"$LUNA_BUILD_TOOLS/apksigner" sign --ks "$LUNA_KEY" --ks-key-alias luna19test --ks-pass pass:android --key-pass pass:android --out dist/DoubleMice-0.3.1.apk build/aligned.apk
"$LUNA_BUILD_TOOLS/apksigner" verify --verbose dist/DoubleMice-0.3.1.apk
"$LUNA_BUILD_TOOLS/aapt" dump badging dist/DoubleMice-0.3.1.apk | head -12
