/**
 * plugins/with-sms-permissions.js
 *
 * Adds Android READ_SMS / RECEIVE_SMS so Duo Wallet can import M-Pesa messages.
 * iOS has no equivalent API — paste remains the path there.
 */

const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");

const PERMISSIONS = [
  "android.permission.READ_SMS",
  "android.permission.RECEIVE_SMS",
];

function withSmsPermissions(config) {
  return withAndroidManifest(config, (config) => {
    for (const permission of PERMISSIONS) {
      AndroidConfig.Permissions.ensurePermission(config.modResults, permission);
    }
    return config;
  });
}

module.exports = withSmsPermissions;
