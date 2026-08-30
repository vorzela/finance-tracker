/**
 * plugins/with-sms-permissions.js
 *
 * Adds Android READ_SMS so Duo Wallet can import M-Pesa messages.
 * iOS has no equivalent API — paste remains the path there.
 *
 * RECEIVE_SMS is intentionally NOT requested: the app only reads the
 * existing inbox on demand (SmsAndroid.list), it never listens for live
 * incoming SMS, so that permission would be unused. Carrying an unused
 * dangerous permission needlessly widens the app's attack surface and
 * makes it look more like SMS-stealing malware to on-device scanners
 * (e.g. Google Play Protect), which specifically flag finance apps that
 * request broad SMS read+receive access.
 */

const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");

const PERMISSIONS = ["android.permission.READ_SMS"];

function withSmsPermissions(config) {
  return withAndroidManifest(config, (config) => {
    for (const permission of PERMISSIONS) {
      AndroidConfig.Permissions.ensurePermission(config.modResults, permission);
    }
    return config;
  });
}

module.exports = withSmsPermissions;
