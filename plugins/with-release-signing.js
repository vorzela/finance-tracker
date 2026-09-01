/**
 * plugins/with-release-signing.js
 *
 * By default the Expo/RN Android template signs *release* builds with the
 * debug keystore (same file, same alias `androiddebugkey`, same password
 * `android` on every machine that has ever installed the Android SDK). That
 * is fine for `expo run:android` during development, but it is a serious
 * problem for any APK you actually hand to someone else: Google Play
 * Protect specifically flags apps signed with the well-known debug key as
 * untrusted, because it means there is no accountable signer — anyone could
 * have built it. Combined with sensitive permissions (like this app's SMS
 * read access for M-Pesa import), that's close to the exact signature Play
 * Protect uses for "potentially harmful app" warnings.
 *
 * This plugin wires up a real `release` signingConfig, sourced from
 * gradle.properties / environment variables, so `assembleRelease` uses your
 * own keystore instead. If you haven't generated one yet, it safely falls
 * back to the debug keystore so local dev builds keep working — see
 * README.md → "Build an APK to share" for how to generate one.
 */

const { withAppBuildGradle } = require("expo/config-plugins");

const SIGNING_CONFIG = `
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (project.hasProperty('DUOWALLET_UPLOAD_STORE_FILE')) {
                storeFile file(DUOWALLET_UPLOAD_STORE_FILE)
                storePassword System.getenv('DUOWALLET_UPLOAD_STORE_PASSWORD') ?: DUOWALLET_UPLOAD_STORE_PASSWORD
                keyAlias DUOWALLET_UPLOAD_KEY_ALIAS
                keyPassword System.getenv('DUOWALLET_UPLOAD_KEY_PASSWORD') ?: DUOWALLET_UPLOAD_KEY_PASSWORD
            } else {
                // No release keystore configured yet — fall back to the debug
                // key so local builds still work. DO NOT ship an APK signed
                // this way to anyone outside your own dev machine; see
                // README.md for how to generate a real keystore.
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
    }`;

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error("withReleaseSigning only supports Groovy build.gradle files");
    }

    let contents = config.modResults.contents;

    // Replace the template's debug-only signingConfigs block with ours.
    contents = contents.replace(
      /\n\s*signingConfigs\s*\{\s*debug\s*\{[^}]*\}\s*\}/,
      SIGNING_CONFIG,
    );

    // Point the release buildType at the new release signingConfig instead
    // of signingConfigs.debug.
    contents = contents.replace(
      /(release\s*\{\s*(?:\/\/[^\n]*\n\s*)*)signingConfig\s+signingConfigs\.debug/,
      "$1signingConfig signingConfigs.release",
    );

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withReleaseSigning;
